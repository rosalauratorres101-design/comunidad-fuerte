'use strict';
// One-off knowledge update, for a scheduled job (cron, Render Cron Job, etc.).
// Usage: npm run refresh-knowledge
const ai = require('../lib/ai');
const knowledge = require('../lib/knowledge');

knowledge.load();
knowledge.refresh(ai)
  .then(r => { console.log('Knowledge refresh:', JSON.stringify(r)); })
  .catch(err => { console.error('Knowledge refresh failed:', err.message); process.exit(1); });
