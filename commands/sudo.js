const { addSudo, removeSudo, getSudoList } = require('../lib/db');
const { isOwner, normalizeJid } = require('../lib/permissions');

function getTargetJid({ msg, args }) {
  const quoted = msg.message.extendedTextMessage?.contextInfo?.participant;
  if (quoted) return quoted;
  if (args[0]) return normalizeJid(args[0]);
  return null;
}

module.exports = [
  {
    name: 'addsudo',
    description: 'Grant trusted-user access — reply to their message, or .addsudo <number> (owner only)',
    category: 'owner',
    async execute({ sock, msg, from, sender, args }) {
      if (!isOwner(sender)) return sock.sendMessage(from, { text: '❌ Owner only.' });
      const target = getTargetJid({ msg, args });
      if (!target) return sock.sendMessage(from, { text: 'Reply to a user, or: .addsudo 254712345678' });
      addSudo(target);
      await sock.sendMessage(from, { text: `✅ @${target.split('@')[0]} now has sudo access.`, mentions: [target] });
    },
  },

  {
    name: 'delsudo',
    description: 'Revoke trusted-user access — reply to their message, or .delsudo <number> (owner only)',
    category: 'owner',
    async execute({ sock, msg, from, sender, args }) {
      if (!isOwner(sender)) return sock.sendMessage(from, { text: '❌ Owner only.' });
      const target = getTargetJid({ msg, args });
      if (!target) return sock.sendMessage(from, { text: 'Reply to a user, or: .delsudo 254712345678' });
      removeSudo(target);
      await sock.sendMessage(from, { text: `✅ Removed @${target.split('@')[0]} from sudo.`, mentions: [target] });
    },
  },

  {
    name: 'sudolist',
    description: 'List numbers with sudo access',
    category: 'owner',
    async execute({ sock, from }) {
      const list = getSudoList();
      if (!list.length) return sock.sendMessage(from, { text: 'No sudo users yet — only the owner has elevated access.' });
      const text = 'Sudo users:\n' + list.map((j) => `• ${j.split('@')[0]}`).join('\n');
      await sock.sendMessage(from, { text });
    },
  },
];
