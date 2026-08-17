require('dotenv').config();

module.exports = {
  prefix: process.env.PREFIX || '.',
  botName: process.env.BOT_NAME || 'Anonymous-MD',
  ownerNumber: process.env.OWNER_NUMBER || '', // e.g. 27821234567 (country code, no +)
  usePairingCode: process.env.USE_PAIRING_CODE === 'true',
  version: '2.0',

  // Moderation thresholds — all configurable via .env, no magic numbers buried in code.
  autoKickWarnThreshold: parseInt(process.env.AUTO_KICK_WARN_THRESHOLD || '3', 10),
  antispam: {
    repeatCount: parseInt(process.env.ANTISPAM_REPEAT_COUNT || '3', 10),
    windowMs: parseInt(process.env.ANTISPAM_WINDOW_MS || '30000', 10),
  },
  antiflood: {
    maxMessages: parseInt(process.env.ANTIFLOOD_MAX_MESSAGES || '6', 10),
    windowMs: parseInt(process.env.ANTIFLOOD_WINDOW_MS || '8000', 10),
  },
  antimention: {
    maxMentions: parseInt(process.env.ANTIMENTION_MAX || '5', 10),
  },
  aiCooldownMs: parseInt(process.env.AI_COOLDOWN_MS || '15000', 10),
};
