require('dotenv').config();
const nodemailer = require('nodemailer');

const mailService = process.env.MAIL_SERVICE || process.env.SMTP_SERVICE;
const mailHost = process.env.MAIL_HOST || process.env.SMTP_HOST || (mailService ? undefined : 'smtp.gmail.com');
const mailPort = Number(process.env.MAIL_PORT || process.env.SMTP_PORT || 465);
const mailUser = process.env.MAIL_USER || process.env.SMTP_USER;
const mailPass = process.env.MAIL_PASS || process.env.SMTP_PASS;
let mailFrom = process.env.MAIL_FROM || 'no-reply@veloxicity.com';
mailFrom = mailFrom
  .replace(/\r?\n/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/^"(.+)"$/, '$1');

const transporterOptions = mailService
  ? {
      service: mailService,
      auth: { user: mailUser, pass: mailPass }
    }
  : {
      host: mailHost,
      port: mailPort,
      secure: mailPort === 465,
      auth: mailUser && mailPass ? { user: mailUser, pass: mailPass } : undefined
    };

const transporter = nodemailer.createTransport(transporterOptions);

const sendMail = async (to, subject, html) => {
  if (!mailUser || !mailPass) {
    console.warn('Mailer not configured: missing MAIL_USER or MAIL_PASS. Skipping email.');
    return;
  }

  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  await transporter.sendMail({
    from: mailFrom,
    to,
    subject,
    text,
    html,
  });
};

const sendLoginEmail = async (email, fullName) => {
  const subject = 'Welcome back to Veloxicity';
  const html = `
    <p>Hi ${fullName},</p>
    <p>Welcome back! You have successfully signed in to your Veloxicity account.</p>
    <p>If this was not you, please contact support immediately.</p>
    <p>Thanks,<br/>Veloxicity Team</p>
  `;
  return sendMail(email, subject, html);
};

const sendCopyTradeEmail = async (email, fullName, expertName, amount) => {
  const subject = 'Your copy trade has started';
  const html = `
    <p>Hi ${fullName},</p>
    <p>Your copy trade is now active.</p>
    <p><strong>Expert:</strong> ${expertName}</p>
    <p><strong>Amount:</strong> $${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
    <p>The trade has started and is visible on your dashboard.</p>
    <p>Thanks,<br/>Veloxicity Team</p>
  `;
  return sendMail(email, subject, html);
};

const sendInvestmentEmail = async (email, fullName, planName, amount) => {
  const subject = 'Your investment has started';
  const html = `
    <p>Hi ${fullName},</p>
    <p>Your bot investment is now active.</p>
    <p><strong>Plan:</strong> ${planName}</p>
    <p><strong>Amount:</strong> $${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
    <p>The investment has started and is visible on your dashboard.</p>
    <p>Thanks,<br/>Veloxicity Team</p>
  `;
  return sendMail(email, subject, html);
};

module.exports = {
  sendLoginEmail,
  sendCopyTradeEmail,
  sendInvestmentEmail,
};
