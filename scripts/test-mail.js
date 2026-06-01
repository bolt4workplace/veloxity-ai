require('dotenv').config();
const path = require('path');
const { sendLoginEmail, sendCopyTradeEmail, sendInvestmentEmail } = require(path.join(__dirname, '..', 'mailer'));

async function run() {
  const to = process.argv[2] || process.env.TEST_MAIL_TO;
  if (!to) {
    console.error('Usage: node scripts/test-mail.js recipient@example.com');
    process.exit(1);
  }

  try {
    console.log('Sending login test email to', to);
    await sendLoginEmail(to, 'Test User');
    console.log('Login email sent');

    console.log('Sending copy trade test email to', to);
    await sendCopyTradeEmail(to, 'Test User', 'Expert Alpha', 250);
    console.log('Copy trade email sent');

    console.log('Sending investment test email to', to);
    await sendInvestmentEmail(to, 'Test User', 'Starter Plan', 500);
    console.log('Investment email sent');

    console.log('All test emails queued (if SMTP configured)');
  } catch (err) {
    console.error('Test mail error', err);
    process.exit(1);
  }
}

run();
