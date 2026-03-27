const jwt = require('jsonwebtoken');
const Message = require('../models/Message');

// Track online users: userId -> Set of socket IDs
const onlineUsers = new Map();

module.exports = (io) => {
  // JWT Authentication middleware for Socket.io
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      return next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`[Socket] User ${userId} connected (${socket.id})`);

    // Track online presence
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);
    socket.broadcast.emit('user_online', { userId });

    // ─── Task Room ─────────────────────────────────────────────────────
    socket.on('join_task_room', (taskId) => {
      socket.join(`task:${taskId}`);
      console.log(`[Socket] ${userId} joined task room: ${taskId}`);
    });

    socket.on('leave_task_room', (taskId) => {
      socket.leave(`task:${taskId}`);
    });

    // ─── Messaging ──────────────────────────────────────────────────────
    socket.on('send_message', async (data) => {
      try {
        const { taskId, receiverId, message, type = 'text' } = data;

        if (!taskId || !receiverId || !message) {
          return socket.emit('error', { message: 'taskId, receiverId, and message are required' });
        }

        // Validate sender is socket.userId (prevent impersonation)
        const savedMessage = await Message.create({
          taskId,
          senderId: userId,  // Always use authenticated userId from socket
          receiverId,
          message,
          type
        });

        // Broadcast to room
        io.to(`task:${taskId}`).emit('message_received', savedMessage);

      } catch (error) {
        console.error('[Socket] send_message error:', error.message);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ─── Typing Indicators ──────────────────────────────────────────────
    socket.on('typing', (data) => {
      if (data?.taskId) {
        socket.to(`task:${data.taskId}`).emit('typing', { senderId: userId });
      }
    });

    socket.on('stop_typing', (data) => {
      if (data?.taskId) {
        socket.to(`task:${data.taskId}`).emit('stop_typing', { senderId: userId });
      }
    });

    // ─── Read Receipts ──────────────────────────────────────────────────
    socket.on('read_receipt', async (data) => {
      try {
        const { messageId, taskId } = data;
        await Message.findByIdAndUpdate(messageId, { isRead: true });
        socket.to(`task:${taskId}`).emit('read_receipt', { messageId, readerId: userId });
      } catch (error) {
        console.error('[Socket] read_receipt error:', error.message);
      }
    });

    // ─── Task Status Events (called from controllers) ────────────────────
    // These allow controllers to push real-time task updates via io
    socket.on('subscribe_task', (taskId) => {
      socket.join(`task:${taskId}`);
    });

    // ─── Disconnect ─────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          socket.broadcast.emit('user_offline', { userId });
        }
      }
      console.log(`[Socket] User ${userId} disconnected`);
    });
  });

  // Export helper to emit task status events from controllers
  io.emitTaskStatusUpdate = (taskId, event, data) => {
    io.to(`task:${taskId}`).emit(event, data);
  };

  return io;
};
