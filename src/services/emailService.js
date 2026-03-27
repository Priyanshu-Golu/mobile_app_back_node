const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Reuse transporter (don't recreate on every call)
let _transporter = null;

const getTransporter = () => {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: (parseInt(process.env.EMAIL_PORT) || 587) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
  return _transporter;
};

/**
 * HTML email templates
 */
const templates = {
  passwordReset: (resetUrl) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #667eea; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0;">🤝 Tap2Help</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 8px 8px;">
        <h2 style="color: #333;">Reset Your Password</h2>
        <p style="color: #666; line-height: 1.6;">You requested a password reset. Click the button below to set a new password. This link expires in <strong>10 minutes</strong>.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: #667eea; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold;">Reset Password</a>
        </div>
        <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email. Your password will remain unchanged.</p>
      </div>
    </div>
  `,

  welcome: (name) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #667eea; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0;">🤝 Tap2Help</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 8px 8px;">
        <h2 style="color: #333;">Welcome, ${name}! 🎉</h2>
        <p style="color: #666; line-height: 1.6;">You've joined the Tap2Help community — a local network where neighbors help neighbors.</p>
        <p style="color: #666; line-height: 1.6;">You've received <strong>50 free credits</strong> to get started. Use them to get help or earn more by helping others!</p>
        <div style="background: #e8edff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #667eea; margin-top: 0;">How It Works</h3>
          <ol style="color: #666; padding-left: 20px;">
            <li>Post a help request with your location</li>
            <li>Nearby helpers get notified instantly</li>
            <li>A helper accepts and completes the task</li>
            <li>Both users rate each other — earn credits!</li>
          </ol>
        </div>
        <p style="color: #999; font-size: 12px;">Tap2Help — Local Help in One Tap</p>
      </div>
    </div>
  `,

  taskCompleted: (requesterName, helperName, taskTitle) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #48bb78; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0;">✅ Task Completed</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 8px 8px;">
        <h2 style="color: #333;">Great news, ${requesterName}!</h2>
        <p style="color: #666; line-height: 1.6;">Your task <strong>"${taskTitle}"</strong> has been marked as completed by ${helperName}.</p>
        <p style="color: #666; line-height: 1.6;">Please take a moment to rate your experience — your feedback helps build trust in the community.</p>
        <p style="color: #999; font-size: 12px;">Thank you for using Tap2Help!</p>
      </div>
    </div>
  `
};

/**
 * Send an email.
 * @param {object} options - { email, subject, message, html, template }
 */
const sendEmail = async (options) => {
  if (process.env.NODE_ENV === 'test') {
    logger.info(`[Email] Skipping in test mode: ${options.subject}`);
    return;
  }

  const transporter = getTransporter();

  const mailOptions = {
    from: `${process.env.FROM_NAME || 'Tap2Help'} <${process.env.FROM_EMAIL || process.env.EMAIL_USER}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    ...(options.html && { html: options.html }),
    ...(!options.html && options.template && { html: options.template })
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`[Email] Sent to ${options.email}: ${info.messageId}`);
    return info;
  } catch (err) {
    logger.error(`[Email] Failed to send to ${options.email}: ${err.message}`);
    throw err;
  }
};

sendEmail.templates = templates;

module.exports = sendEmail;
