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
