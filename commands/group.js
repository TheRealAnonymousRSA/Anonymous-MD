js
const { handleRoleCommand, loadRoles } = require('./roles');

module.exports = async function handleGroupCommands(conn, message, body, reply) {
  const groupId = message.key.remoteJid;
  const sender = message.key.participant || message.key.remoteJid;
  const command = body.split(' ')[0].slice(1).toLowerCase();
  const args = body.trim().split(/\s+/).slice(1);

  const BOT_OWNER = '27698210064@s.whatsapp.net';
  const roles = loadRoles();
  const groupRoles = roles.groups[groupId] || { owner: '', coowners: [], ranks: {} };
  const isOwner = sender === groupRoles.owner;
  const isBotOwner = sender === BOT_OWNER;
  const isCoowner = groupRoles.coowners.includes(sender);

  // Example ranks object for permission
  // ranks: { 'user@s.whatsapp.net': 'diamond' }
  const rank = groupRoles.ranks?.[sender] || 'member'; 

  // Handle role commandsif (['setowner', 'removeowner', 'setcoowner', 'removecoowner'].includes(command)) {
    // Only bot owner can remove owner
    if (command === 'removeowner' && !isBotOwner) {
      return reply('❌ Only bot owner can remove group owner.');
    }
    // Other role commands check inside roles.js
    return await handleRoleCommand(command, args, groupId, sender, reply);
  }

  // !kick can be used by admins (check from WhatsApp metadata)
  if (command === 'kick') {
    try {
      const metadata = await conn.groupMetadata(groupId);
      const admins = metadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.id);
      if (!admins.includes(sender) && !isBotOwner) {
        return reply('❌ Only group admins can kick.');
      }
      const mentioned = message.mentionedJid;
      if (!mentioned || mentioned.length === 0) return reply('⚠️ Mention someone to kick.');
      await conn.groupParticipantsUpdate(groupId, mentioned, 'remove');
      return reply('✅ User kicked.');
    } catch {
      return reply('❌ Failed to kick user.');
    }
  }

  // !promote and !demote by co-owner or owner
  if (command === 'promote' || command === 'demote') {
    if (!isOwner && !isCoowner && !isBotOwner) {return reply('❌ Only owner or co-owner can promote/demote.');
    }
    const mentioned = message.mentionedJid;
    if (!mentioned || mentioned.length === 0) return reply('⚠️ Mention someone to promote/demote.');

    try {
      const action = command === 'promote' ? 'promote' : 'demote';
      await conn.groupParticipantsUpdate(groupId, mentioned, action);
      return reply(`✅ User actiond.`);
     catch 
      return reply(`❌ Failed to{command} user.`);
    }
  }

  // Example: rank-based commands (expand as you want)
  if (command === 'special') {
    // Only diamond rank users allowed example
    if (rank !== 'diamond') return reply('❌ Only diamond rank users can use this command.');
    return reply('✨ You have special access!');
  }

  // Add more commands as needed
};
