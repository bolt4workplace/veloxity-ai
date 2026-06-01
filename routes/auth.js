require('dotenv').config();
const fs = require('fs');
const path = require('path');
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
  ? Object.assign(
      {
        pool: true,
        maxConnections: 5,
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 10000
      },
      { service: mailService, auth: { user: mailUser, pass: mailPass } }
    )
  : Object.assign(
      {
        pool: true,
        maxConnections: 5,
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 10000,
        tls: { rejectUnauthorized: false }
      },
      { host: mailHost, port: mailPort, secure: mailPort === 465, auth: mailUser && mailPass ? { user: mailUser, pass: mailPass } : undefined }
    );

const transporter = nodemailer.createTransport(transporterOptions);

const dataDir = path.join(__dirname, 'data');
const failedEmailsPath = path.join(dataDir, 'failed_emails.json');

if (!fs.existsSync(dataDir)) {
  try { fs.mkdirSync(dataDir); } catch (e) { /* ignore */ }
}

let transporterReady = false;
transporter.verify()
  .then(() => {
    transporterReady = true;
    console.info('Mailer: transporter verified and ready');
  })
  .catch((err) => {
    transporterReady = false;
    console.error('Mailer verify failed:', err && err.message ? err.message : err);
  });

const enqueueFailedEmail = (to, subject, html, err) => {
  try {
    const record = { to, subject, html, error: (err && err.message) || String(err), createdAt: new Date().toISOString() };
    let arr = [];
    if (fs.existsSync(failedEmailsPath)) {
      try { arr = JSON.parse(fs.readFileSync(failedEmailsPath, 'utf8') || '[]'); } catch (e) { arr = []; }
    }
    arr.push(record);
    fs.writeFileSync(failedEmailsPath, JSON.stringify(arr, null, 2));
  } catch (e) {
    console.error('Failed to enqueue email:', e && e.message ? e.message : e);
  }
};

const sendMail = async (to, subject, html) => {
  if (!mailUser || !mailPass) {
    console.warn('Mailer not configured: missing MAIL_USER or MAIL_PASS. Skipping email and enqueueing.');
    enqueueFailedEmail(to, subject, html, 'missing-credentials');
    return false;
  }

  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  // If transporter didn't verify, don't block the request; enqueue and return
  if (!transporterReady) {
    console.warn('Transporter not ready; enqueueing email for later delivery');
    enqueueFailedEmail(to, subject, html, 'transporter-not-ready');
    return false;
  }

  const mailOptions = { from: mailFrom, to, subject, text, html };

  // Retry loop for transient errors
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await transporter.sendMail(mailOptions);
      return true;
    } catch (err) {
      const code = err && err.code ? err.code : null;
      console.error(`Mailer send attempt ${attempt} failed:`, err && err.message ? err.message : err);
      if (attempt === maxAttempts) {
        enqueueFailedEmail(to, subject, html, err);
        return false;
      }
      // backoff
      await new Promise(r => setTimeout(r, 500 * attempt));
      continue;
    }
  }
  return false;
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
