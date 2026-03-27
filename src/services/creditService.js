const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');
const mongoose = require('mongoose');

/**
 * Handle credit transaction atomically.
 * Uses MongoDB sessions when replica set is available, falls back to non-transactional update otherwise.
 */
exports.processTransaction = async (userId, credits, type, reason, relatedTaskId = null) => {
  const supportsTransactions = mongoose.connection.topology &&
    (mongoose.connection.topology.description?.type === 'ReplicaSetWithPrimary' ||
     mongoose.connection.topology.description?.type === 'Sharded');

  if (supportsTransactions) {
    // Use atomic transaction (production path)
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const result = await _doTransaction(userId, credits, type, reason, relatedTaskId, session);
      await session.commitTransaction();
      session.endSession();
      return result;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } else {
    // Fallback: non-transactional (test / standalone MongoDB)
    return _doTransaction(userId, credits, type, reason, relatedTaskId, null);
  }
};

const _doTransaction = async (userId, credits, type, reason, relatedTaskId, session) => {
  const sessionOpt = session ? { session } : {};

  const user = await User.findById(userId).session(session || null);
  if (!user) throw new Error('User not found');

  if ((type === 'Spent' || type === 'Penalty') && user.credits < Math.abs(credits)) {
    throw new Error('Insufficient credits');
  }

  const delta = (type === 'Earned' || type === 'Bonus') ? Math.abs(credits) : -Math.abs(credits);
  user.credits += delta;
  await user.save(sessionOpt);

  const transactionData = {
    userId,
    credits: Math.abs(credits),
    type,
    reason,
    relatedTaskId,
    balanceAfter: user.credits
  };

  const transaction = session
    ? await CreditTransaction.create([transactionData], sessionOpt)
    : [await CreditTransaction.create(transactionData)];

  return transaction[0];
};
