js
const { loadRoles, saveRoles } = require('./roles');

// Your WhatsApp JID
const BOT_CREATOR = '27698210064@s.whatsapp.net';

module.exports = {
  name: 'setrole',
  description: 'Manage owner and co-owner roles',
  async execute(sock, msg, args, sender, groupId, reply) {
    const roles = loadRoles();

    if (!roles.groups[groupId]) {
      roles.groups[groupId] = { owner: sender, coowners: [] };
      saveRoles(roles);
    }

    const group = roles.groups[groupId];
    const subCommand = args[0]?.toLowerCase();
    const mention = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    if (!mention && subCommand !== 'removeowner') {
      return reply('❌ Mention a user to set or remove role.');
    }

    if (subCommand === 'setowner') {
      if (sender !== group.owner) return reply('❌ Only current owner can set new owner.');
      group.owner = mention;
      saveRoles(roles);
      return reply('✅ New owner set.');
    }

    if (subCommand === 'setcoowner') {
      if (sender !== group.owner) return reply('❌ Only owner can add co-owners.');
      if (!group.coowners.includes(mention)) {
        group.coowners.push(mention);saveRoles(roles);
        return reply('✅ Co-owner added.');
      } else {
        return reply('⚠️ User is already a co-owner.');
      }
    }

    if (subCommand === 'removecoowner') {
      if (sender !== group.owner) return reply('❌ Only owner can remove co-owners.');
      group.coowners = group.coowners.filter(u => u !== mention);
      saveRoles(roles);
      return reply('✅ Co-owner removed.');
    }

    if (subCommand === 'removeowner') {
      if (sender !== BOT_CREATOR) return reply('❌ Only the bot creator can remove ownership.');
      group.owner = null;
      saveRoles(roles);
      return reply('⚠️ Owner removed by bot creator.');
    }

    reply('❓ Usage: !setrole setowner/setcoowner/removecoowner/removeowner @user');
  }
};
