// Admin routes for Trading Platform
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { getCollection } = require('../db');

const getUsersCollection = () => getCollection('users');
const withdrawalsPath = path.join(__dirname, '../data/withdrawals.json');
const depositsPath = path.join(__dirname, '../data/deposits.json');

const getWithdrawals = () => {
  const data = fs.readFileSync(withdrawalsPath, 'utf8');
  return JSON.parse(data);
};

const saveWithdrawals = (withdrawals) => {
  fs.writeFileSync(withdrawalsPath, JSON.stringify(withdrawals, null, 2));
};

const getDeposits = () => {
  const data = fs.readFileSync(depositsPath, 'utf8');
  return JSON.parse(data);
};

const saveDeposits = (deposits) => {
  fs.writeFileSync(depositsPath, JSON.stringify(deposits, null, 2));
};

// KYC and credits helpers
const kycPath = path.join(__dirname, '../data/kyc.json');
const creditsPath = path.join(__dirname, '../data/credits.json');

const getKyc = () => { try { if (!fs.existsSync(kycPath)) fs.writeFileSync(kycPath, JSON.stringify([])); return JSON.parse(fs.readFileSync(kycPath,'utf8')); } catch(e){return[]} };
const saveKyc = (list) => { fs.writeFileSync(kycPath, JSON.stringify(list, null, 2)); };

const getCredits = () => { try { if (!fs.existsSync(creditsPath)) fs.writeFileSync(creditsPath, JSON.stringify([])); return JSON.parse(fs.readFileSync(creditsPath,'utf8')); } catch(e){return[]} };
const saveCredits = (list) => { fs.writeFileSync(creditsPath, JSON.stringify(list, null, 2)); };

// Admin authentication middleware
const checkAdmin = (req, res, next) => {
  if (req.session.isAdmin) {
    return next();
  }
  res.redirect('/admin/login');
};

// Admin dashboard route
router.get('/dashboard', checkAdmin, async (req, res) => {
  const users = await (await getUsersCollection()).find({}).toArray();
  const withdrawals = getWithdrawals();
  const deposits = getDeposits();
  const kyc = getKyc();
  const credits = getCredits();
  const query = req.query.search || '';
  const view = req.query.view || 'users';
  
  // Filter users based on search query
  let filteredUsers = users;
  if (query) {
    filteredUsers = users.filter(user => 
      user.id.toLowerCase().includes(query.toLowerCase()) || 
      (user.fullName && user.fullName.toLowerCase().includes(query.toLowerCase()))
    );
  }
  
  res.render('admin/dashboard', { 
    users: filteredUsers,
    withdrawals,
    deposits,
    kyc,
    credits,
    query,
    view,
    success: req.query.success
  });
});

// Update user balance route
router.post('/user/:id/update-balance', checkAdmin, async (req, res) => {
  const userId = req.params.id;
  const newBalance = parseFloat(req.body.balance);
  
  // Validate balance
  if (isNaN(newBalance) || newBalance < 0) {
    return res.redirect('/admin/dashboard?success=false');
  }

  const users = await getUsersCollection();
  const result = await users.updateOne({ id: userId }, { $set: { balance: newBalance } });
  if (result.matchedCount > 0) {
    return res.redirect('/admin/dashboard?success=true');
  }
  
  res.redirect('/admin/dashboard?success=false');
});

// Render single user details for admin
router.get('/user/:id', checkAdmin, async (req, res) => {
  const userId = req.params.id;
  const users = await getUsersCollection();
  const user = await users.findOne({ id: userId });
  if (!user) return res.redirect('/admin/dashboard?success=false');

  const withdrawals = getWithdrawals().filter(w => w.userId === userId);
  res.render('admin/user-details', { user, withdrawals, success: req.query.success });
});

// Update per-user stats (totalProfit, totalDeposit, totalWithdrawal, bonus)
router.post('/user/:id/update-stats', checkAdmin, async (req, res) => {
  const userId = req.params.id;
  const totalProfit = parseFloat(req.body.totalProfit) || 0;
  const totalDeposit = parseFloat(req.body.totalDeposit) || 0;
  const totalWithdrawal = parseFloat(req.body.totalWithdrawal) || 0;
  const bonus = parseFloat(req.body.bonus) || 0;

  const users = await getUsersCollection();
  const result = await users.updateOne({ id: userId }, { $set: { totalProfit, totalDeposit, totalWithdrawal, bonus } });
  if (result.matchedCount > 0) {
    return res.redirect(`/admin/user/${userId}?success=true`);
  }
  res.redirect(`/admin/user/${userId}?success=false`);
});

// Toggle user trading status
router.post('/user/:id/toggle-trading', checkAdmin, async (req, res) => {
  const userId = req.params.id;
  const action = req.body.action;
  
  const users = await getUsersCollection();
  const result = await users.updateOne({ id: userId }, { $set: { canTrade: action === 'approve' } });
  if (result.matchedCount > 0) {
    return res.redirect('/admin/dashboard?success=true');
  }
  
  res.redirect('/admin/dashboard?success=false');
});

// Handle withdrawal approval/rejection
router.post('/withdrawal/:id/:action', checkAdmin, async (req, res) => {
  const withdrawals = getWithdrawals();
  const withdrawalId = req.params.id;
  const action = req.params.action;
  
  const withdrawalIndex = withdrawals.findIndex(w => w.id === withdrawalId);
  
  if (withdrawalIndex !== -1) {
    withdrawals[withdrawalIndex].status = action === 'approve' ? 'approved' : 'rejected';
    
    if (action === 'approve') {
      const users = await getUsersCollection();
      const withdrawal = withdrawals[withdrawalIndex];
      await users.updateOne({ id: withdrawal.userId }, { $inc: { balance: -withdrawal.amount } });
    }
    
    saveWithdrawals(withdrawals);
    return res.redirect('/admin/dashboard?view=withdrawals&success=true');
  }
  
  res.redirect('/admin/dashboard?view=withdrawals&success=false');
});

// Handle deposit approval/rejection
router.post('/deposit/:id/:action', checkAdmin, async (req, res) => {
  const deposits = getDeposits();
  const depositId = req.params.id;
  const action = req.params.action;
  
  const depositIndex = deposits.findIndex(d => d.id === depositId);
  
  if (depositIndex !== -1) {
    deposits[depositIndex].status = action === 'approve' ? 'approved' : 'rejected';
    
    if (action === 'approve') {
      const users = await getUsersCollection();
      const deposit = deposits[depositIndex];
      await users.updateOne({ id: deposit.userId }, { $inc: { balance: deposit.amount } });
    }
    
    saveDeposits(deposits);
    return res.redirect('/admin/dashboard?view=deposits&success=true');
  }
  
  res.redirect('/admin/dashboard?view=deposits&success=false');
});

// KYC approval/rejection
router.post('/kyc/:id/:action', checkAdmin, async (req, res) => {
  const kycList = getKyc();
  const kycId = req.params.id;
  const action = req.params.action;
  const idx = kycList.findIndex(k => k.id === kycId);
  if (idx !== -1) {
    kycList[idx].status = action === 'approve' ? 'approved' : 'rejected';
    saveKyc(kycList);
    if (action === 'approve') {
      const users = await getUsersCollection();
      await users.updateOne({ id: kycList[idx].userId }, { $set: { canTrade: true } });
    }
    return res.redirect('/admin/dashboard?view=kyc&success=true');
  }
  return res.redirect('/admin/dashboard?view=kyc&success=false');
});

// Credit approval/rejection
router.post('/credit/:id/:action', checkAdmin, async (req, res) => {
  const credits = getCredits();
  const creditId = req.params.id;
  const action = req.params.action;
  const idx = credits.findIndex(c => c.id === creditId);
  if (idx !== -1) {
    credits[idx].status = action === 'approve' ? 'approved' : 'rejected';
    if (action === 'approve') {
      const users = await getUsersCollection();
      await users.updateOne(
        { id: credits[idx].userId },
        { $inc: { balance: credits[idx].amount || 0 } }
      );
    }
    saveCredits(credits);
    return res.redirect('/admin/dashboard?view=credits&success=true');
  }
  return res.redirect('/admin/dashboard?view=credits&success=false');
});

module.exports = router;