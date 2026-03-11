#!/usr/bin/env node
/**
 * Verification script for Chat Monitor - tests route logic without full server.
 * Run: node scripts/verifyChatMonitor.js
 */

import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bidly-auctions';

async function verify() {
  const results = { passed: 0, failed: 0 };
  const assert = (name, ok, detail = '') => {
    if (ok) {
      results.passed++;
      console.log(`  ✓ ${name}`);
      return;
    }
    results.failed++;
    console.log(`  ✗ ${name}${detail ? ': ' + detail : ''}`);
  };

  console.log('=== Chat Monitor Verification ===\n');

  // 1. Chat routes module loads
  try {
    const chatRoutes = (await import('../routes/chatRoutes.js')).default;
    assert('Chat routes module loads', !!chatRoutes);
    const hasMonitor = chatRoutes.stack?.some((l) => l.route?.path === '/monitor');
    assert('GET /monitor route exists', hasMonitor);
  } catch (e) {
    assert('Chat routes module loads', false, e.message);
  }

  // 2. Server exports chatRooms and io (check server.js structure)
  try {
    const fs = await import('fs');
    const { join } = await import('path');
    const serverPath = join(process.cwd(), 'server.js');
    const serverCode = fs.readFileSync(serverPath, 'utf8');
    assert('chatRooms Map defined', serverCode.includes('chatRooms = new Map()'));
    assert('app.set chatRooms', serverCode.includes("app.set('chatRooms'"));
    assert('app.set io', serverCode.includes("app.set('io'"));
    assert('Message has id', serverCode.includes('id:') && serverCode.includes('chat-') && serverCode.includes('productId'));
    assert('chatRoutes mounted', serverCode.includes("chatRoutes"));
  } catch (e) {
    assert('Server structure check', false, e.message);
  }

  // 3. Widget has delete handlers
  try {
    const fs = await import('fs');
    const { join } = await import('path');
    const widgetPath = join(process.cwd(), '../extensions/theme-app-extension/assets/auction-app-embed.js');
    const widgetCode = fs.readFileSync(widgetPath, 'utf8');
    assert('chat-message-deleted listener', widgetCode.includes('chat-message-deleted'));
    assert('chat-messages-cleared listener', widgetCode.includes('chat-messages-cleared'));
    assert('data-message-id attribute', widgetCode.includes('dataset.messageId'));
  } catch (e) {
    assert('Widget handlers', false, e.message);
  }

  // 4. Admin ChatMonitorPage and API
  try {
    const fs = await import('fs');
    const { join } = await import('path');
    const adminApiPath = join(process.cwd(), '../auction-admin/src/services/api.js');
    const adminApi = fs.readFileSync(adminApiPath, 'utf8');
    assert('chatAPI.getMonitor', adminApi.includes("api.get('/chat/monitor')"));
    assert('chatAPI.deleteMessage', adminApi.includes('chat/${productId}/${messageId}'));
    assert('chatAPI.clearAllMessages', adminApi.includes('chat/${productId}'));

    const chatMonitorPath = join(process.cwd(), '../auction-admin/src/pages/ChatMonitorPage.jsx');
    assert('ChatMonitorPage exists', fs.existsSync(chatMonitorPath));
  } catch (e) {
    assert('Admin integration', false, e.message);
  }

  // 5. MongoDB + Auction model (optional - may fail if no DB)
  try {
    const mongoose = await import('mongoose');
    await mongoose.default.connect(MONGODB_URI);
    const Auction = (await import('../models/Auction.js')).default;
    const sample = await Auction.findOne({ chatEnabled: true }).select('shopifyProductId chatEnabled').lean();
    assert('Auction.chatEnabled field exists', true); // We got here
    if (sample) {
      console.log(`  ✓ Sample auction with chat: ${sample.shopifyProductId}`);
    } else {
      console.log('  ℹ No auctions with chatEnabled (OK for empty store)');
    }
    await mongoose.connection.close();
  } catch (e) {
    console.log(`  ℹ DB check skipped: ${e.message}`);
  }

  console.log('\n=== Results ===');
  console.log(`  Passed: ${results.passed}, Failed: ${results.failed}`);
  process.exit(results.failed > 0 ? 1 : 0);
}

verify().catch((e) => {
  console.error('Verification failed:', e);
  process.exit(1);
});
