const { getGroupSettings, addWarn } = require('./db');
const { isSudo } = require('./permissions');
const { containsNsfwLink } = require('./nsfwFilter');
const { containsBadWord } = require('./badwords');
const config = require('../config');

// In-memory per-group-per-sender message history, used for antispam/antiflood.
// Intentionally not persisted — it only needs to live as long as the process does.
const messageLog = new Map();

function recordAndGetHistory(from, sender, text) {
  const key = `${from}:${sender}`;
  const now = Date.now();
  const arr = (messageLog.get(key) || []).filter((m) => now - m.timestamp < 60000);
  arr.push({ text, timestamp: now });
  messageLog.set(key, arr);
  return arr;
}

async function getSenderIsAdmin(sock, from, sender) {
  try {
    const metadata = await sock.groupMetadata(from);
    return !!metadata.participants.find((p) => p.id === sender)?.admin;
  } catch {
    return false;
  }
}

async function deleteAndWarn(sock, msg, from, sender, reasonText, settings) {
  try {
    await sock.sendMessage(from, { delete: msg.key });
  } catch (err) {
    console.error('Moderation: could not delete message (is the bot a group admin?):', err.message || err);
  }

  const count = addWarn(from, sender);
  const warningText = `🚫 @${sender.split('@')[0]} ${reasonText} (warning ${count}/${config.autoKickWarnThreshold})`;

  let sent;
  try {
    sent = await sock.sendMessage(from, { text: warningText, mentions: [sender] });
  } catch (err) {
    console.error('Moderation: could not send warning:', err.message || err);
  }

  if (settings.autodelete && sent) {
    setTimeout(() => {
      sock.sendMessage(from, { delete: sent.key }).catch(() => {});
    }, 10000);
  }

  if (count >= config.autoKickWarnThreshold) {
    try {
      await sock.groupParticipantsUpdate(from, [sender], 'remove');
      await sock.sendMessage(from, {
        text: `⚠️ @${sender.split('@')[0]} reached ${config.autoKickWarnThreshold} warnings and was removed.`,
        mentions: [sender],
      });
    } catch (err) {
      console.error('Moderation: could not auto-kick (is the bot a group admin?):', err.message || err);
    }
  }
}

// Returns true if the message was removed — caller should stop further processing.
async function runModerationChecks(sock, msg, from, sender, text) {
  const settings = getGroupSettings(from);

  const anyEnabled = settings.antilink || settings.nsfw || settings.antibadword
    || settings.antimention || settings.antiflood || settings.antispam;
  if (!anyEnabled) return false;

  if (isSudo(sender)) return false; // never moderate owner/sudo
  if (await getSenderIsAdmin(sock, from, sender)) return false; // never moderate group admins

  if (settings.antilink && /chat\.whatsapp\.com\/[A-Za-z0-9]+/i.test(text)) {
    await deleteAndWarn(sock, msg, from, sender, "group invite links aren't allowed here.", settings);
    return true;
  }

  if (settings.nsfw && containsNsfwLink(text)) {
    await deleteAndWarn(sock, msg, from, sender, "that kind of link isn't allowed here.", settings);
    return true;
  }

  if (settings.antibadword && containsBadWord(text)) {
    await deleteAndWarn(sock, msg, from, sender, 'please watch your language.', settings);
    return true;
  }

  const mentionCount = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length || 0;
  if (settings.antimention && mentionCount > config.antimention.maxMentions) {
    await deleteAndWarn(sock, msg, from, sender, "mass-mentioning members isn't allowed here.", settings);
    return true;
  }

  const history = recordAndGetHistory(from, sender, text);
  const now = Date.now();

  if (settings.antiflood) {
    const recent = history.filter((m) => now - m.timestamp < config.antiflood.windowMs);
    if (recent.length > config.antiflood.maxMessages) {
      await deleteAndWarn(sock, msg, from, sender, 'sending messages too quickly.', settings);
      return true;
    }
  }

  if (settings.antispam && text) {
    const recentSame = history.filter((m) => m.text === text && now - m.timestamp < config.antispam.windowMs);
    if (recentSame.length >= config.antispam.repeatCount) {
      await deleteAndWarn(sock, msg, from, sender, 'sending repeated/spam messages.', settings);
      return true;
    }
  }

  return false;
}

module.exports = { runModerationChecks };
