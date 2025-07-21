js
const { owner, coOwners } = require('../config/roles');

function getRole(sender) {
  if (sender === owner) return 'owner';
  if (coOwners.includes(sender)) return 'co-owner';
  return 'user';
}

module.exports = {
  name: 'group',
  commands: ['remove', 'promote', 'demote', 'myrole'],

  run: async (sock, msg, args, command) => {
    const sender = msg.sender;
    const chatId = msg.chat;
    const mentioned = msg.mentionedJid[0];
    const role = getRole(sender);

    if (!['owner', 'co-owner'].includes(role)) {
      return sock.sendMessage(chatId, { text: '❌ You don’t have permission.' });
    }

    switch (command) {
      case 'remove':
        if (!mentioned) return sock.sendMessage(chatId, { text: '❗ Tag someone to remove.' });

        if (mentioned === owner || coOwners.includes(mentioned)) {
          return sock.sendMessage(chatId, { text: '❌ You can’t remove an owner or co-owner.' });
        }

        await sock.groupParticipantsUpdate(chatId, [mentioned], 'remove');
        break;

      case 'promote':
        if (!mentioned) return sock.sendMessage(chatId, { text: '❗ Tag someone to promote.' });
await sock.groupParticipantsUpdate(chatId, [mentioned], 'promote');
        break;

      case 'demote':
        if (!mentioned) return sock.sendMessage(chatId, { text: '❗ Tag someone to demote.' });
        await sock.groupParticipantsUpdate(chatId, [mentioned], 'demote');
        break;

      case 'myrole':
        await sock.sendMessage(chatId, { text: `👤 Your role: *${role.toUpperCase()}*` });
        break;

      default:
        await sock.sendMessage(chatId, { text: '⚠ Unknown group command.' });
    }
  }
};

