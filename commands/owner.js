const fs = require('fs');
const path = require('path');
const { isOwner, isSudo, normalizeJid } = require('../lib/permissions');
const { setBotSetting, getBotSettings, addBanned, removeBanned } = require('../lib/db');
const { formatUptime } = require('../lib/format');

function getTargetJid({ msg, args }) {
  const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
  const quoted = msg.message.extendedTextMessage?.contextInfo?.participant;
  if (quoted) return quoted;
  if (mentioned) return mentioned;
  if (args[0]) return normalizeJid(args[0]);
  return null;
}

module.exports = [
  {
    name: 'broadcast',
    description: 'Send a message to every group the bot is in — .broadcast <message> (owner only)',
    category: 'owner',
    async execute({ sock, from, sender, text }) {
      if (!isOwner(sender)) return sock.sendMessage(from, { text: '❌ Owner only.' });
      if (!text) return sock.sendMessage(from, { text: 'Usage: .broadcast <message>' });

      let groups;
      try {
        groups = await sock.groupFetchAllParticipating();
      } catch (err) {
        console.error('broadcast: could not list groups:', err.message || err);
        return sock.sendMessage(from, { text: '❌ Could not fetch the group list.' });
      }

      const jids = Object.keys(groups);
      let sent = 0;
      for (const jid of jids) {
        try {
          await sock.sendMessage(jid, { text: `📢 *Broadcast*\n\n${text}` });
          sent++;
          await new Promise((r) => setTimeout(r, 1200)); // avoid tripping spam limits
        } catch (err) {
          console.error(`broadcast failed for ${jid}:`, err.message || err);
        }
      }
      await sock.sendMessage(from, { text: `✅ Sent to ${sent}/${jids.length} group(s).` });
    },
  },

  {
    name: 'block',
    description: 'Block a user on WhatsApp — reply to them or .block <number> (owner only)',
    category: 'owner',
    async execute({ sock, msg, from, sender, args }) {
      if (!isOwner(sender)) return sock.sendMessage(from, { text: '❌ Owner only.' });
      const target = getTargetJid({ msg, args });
      if (!target) return sock.sendMessage(from, { text: 'Reply to a user or give a number.' });
      try {
        await sock.updateBlockStatus(target, 'block');
        await sock.sendMessage(from, { text: `✅ Blocked @${target.split('@')[0]}.`, mentions: [target] });
      } catch (err) {
        console.error('block failed:', err.message || err);
        await sock.sendMessage(from, { text: '❌ Could not block that user.' });
      }
    },
  },

  {
    name: 'unblock',
    description: 'Unblock a user on WhatsApp — reply to them or .unblock <number> (owner only)',
    category: 'owner',
    async execute({ sock, msg, from, sender, args }) {
      if (!isOwner(sender)) return sock.sendMessage(from, { text: '❌ Owner only.' });
      const target = getTargetJid({ msg, args });
      if (!target) return sock.sendMessage(from, { text: 'Reply to a user or give a number.' });
      try {
        await sock.updateBlockStatus(target, 'unblock');
        await sock.sendMessage(from, { text: `✅ Unblocked @${target.split('@')[0]}.`, mentions: [target] });
      } catch (err) {
        console.error('unblock failed:', err.message || err);
        await sock.sendMessage(from, { text: '❌ Could not unblock that user.' });
      }
    },
  },

  {
    name: 'ban',
    description: 'Stop the bot from responding to a user anywhere — reply to them or .ban <number> (owner only)',
    category: 'owner',
    async execute({ sock, msg, from, sender, args }) {
      if (!isOwner(sender)) return sock.sendMessage(from, { text: '❌ Owner only.' });
      const target = getTargetJid({ msg, args });
      if (!target) return sock.sendMessage(from, { text: 'Reply to a user or give a number.' });
      addBanned(target);
      await sock.sendMessage(from, { text: `✅ @${target.split('@')[0]} is now banned from using the bot.`, mentions: [target] });
    },
  },

  {
    name: 'unban',
    description: 'Restore bot access for a user — reply to them or .unban <number> (owner only)',
    category: 'owner',
    async execute({ sock, msg, from, sender, args }) {
      if (!isOwner(sender)) return sock.sendMessage(from, { text: '❌ Owner only.' });
      const target = getTargetJid({ msg, args });
      if (!target) return sock.sendMessage(from, { text: 'Reply to a user or give a number.' });
      removeBanned(target);
      await sock.sendMessage(from, { text: `✅ @${target.split('@')[0]} can use the bot again.`, mentions: [target] });
    },
  },

  {
    name: 'setprefix',
    description: 'Change the command prefix bot-wide — .setprefix ! (owner only)',
    category: 'owner',
    async execute({ sock, from, sender, args }) {
      if (!isOwner(sender)) return sock.sendMessage(from, { text: '❌ Owner only.' });
      const newPrefix = args[0];
      if (!newPrefix || newPrefix.length > 3) return sock.sendMessage(from, { text: 'Usage: .setprefix <symbol>, e.g. .setprefix !' });
      setBotSetting('prefix', newPrefix);
      await sock.sendMessage(from, { text: `✅ Prefix changed to "${newPrefix}".` });
    },
  },

  {
    name: 'mode',
    description: 'Set who can use commands — .mode public|private (owner only)',
    category: 'owner',
    async execute({ sock, from, sender, args }) {
      if (!isOwner(sender)) return sock.sendMessage(from, { text: '❌ Owner only.' });
      const choice = args[0]?.toLowerCase();
      if (!['public', 'private'].includes(choice)) return sock.sendMessage(from, { text: 'Usage: .mode public | .mode private' });
      setBotSetting('mode', choice);
      await sock.sendMessage(from, { text: `✅ Bot mode set to ${choice}.${choice === 'private' ? ' Only the owner and sudo users can run commands now.' : ''}` });
    },
  },

  {
    name: 'restart',
    description: 'Restart the bot process (owner only — the host must auto-restart on exit for this to work)',
    category: 'owner',
    async execute({ sock, from, sender }) {
      if (!isOwner(sender)) return sock.sendMessage(from, { text: '❌ Owner only.' });
      await sock.sendMessage(from, { text: '🔄 Restarting... the bot will reconnect once the process comes back up.' });
      setTimeout(() => process.exit(0), 1000);
    },
  },

  {
    name: 'shutdown',
    description: 'Stop the bot process (owner only — most free hosts auto-restart on exit, see README)',
    category: 'owner',
    async execute({ sock, from, sender }) {
      if (!isOwner(sender)) return sock.sendMessage(from, { text: '❌ Owner only.' });
      await sock.sendMessage(from, { text: '🛑 Stopping this process. Note: on Render/Railway the host will likely restart it automatically — stop the service from the host dashboard for a full shutdown.' });
      setTimeout(() => process.exit(0), 1000);
    },
  },

  {
    name: 'botstats',
    description: 'Show bot statistics (owner/sudo only)',
    category: 'owner',
    async execute({ sock, from, sender, commands }) {
      if (!isSudo(sender)) return sock.sendMessage(from, { text: '❌ Owner/sudo only.' });
      const mem = process.memoryUsage();
      let groupCount = 'unknown';
      try {
        groupCount = Object.keys(await sock.groupFetchAllParticipating()).length;
      } catch {
        // leave as 'unknown' if the fetch fails
      }
      const uniqueCommands = new Set([...commands.values()]).size;
      const settings = getBotSettings();
      await sock.sendMessage(from, {
        text: `📊 *Bot Stats*\nUptime: ${formatUptime(process.uptime())}\nMemory: ${(mem.rss / 1024 / 1024).toFixed(1)} MB\nCommands: ${uniqueCommands}\nGroups: ${groupCount}\nMode: ${settings.mode}`,
      });
    },
  },

  {
    name: 'plugins',
    description: 'List loaded command modules (owner/sudo only)',
    category: 'owner',
    async execute({ sock, from, sender }) {
      if (!isSudo(sender)) return sock.sendMessage(from, { text: '❌ Owner/sudo only.' });
      const files = fs.readdirSync(__dirname).filter((f) => f.endsWith('.js'));
      await sock.sendMessage(from, { text: `🔌 Loaded modules:\n${files.map((f) => '• ' + f.replace('.js', '')).join('\n')}` });
    },
  },
];
