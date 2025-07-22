js
const { handleRoleCommand, loadRoles } = require('./roles');

module.exports = async function handleGroupCommands(conn, message, body, reply) {
  const groupId = message.key.remoteJid;
  const sender = message.key.participant || message.key.remoteJid;
  const command = body.split(' ')[0].slice(1).toLowerCase();
  const args = body.trim().split(/\s+/).slice(1);

  const BOT_OWNER = '27698210064@s.whatsapp.net';
  const roles = loadRoles();
  const groupRoles = roles.groups[groupId] || {};
  const isOwner = sender === groupRoles.owner;
  const isCoOwner = groupRoles.coowners?.includes(sender);
  const isBotOwner = sender === BOT_OWNER;

  // Handle role commands
  if (['setowner', 'removeowner', 'setcoowner', 'removecoowner'].includes(command)) {
    return await handleRoleCommand(command, args, groupId, sender, reply);
  }

  // !kick
  if (command === 'kick') {
    if (!isOwner && !isCoOwner && !isBotOwner) return reply('❌ Only owner/co-owner can kick.');
    const mentioned = message.mentionedJid;
    if (!mentioned?.length) return reply('⚠️ Mention someone to kick.');
    try {await conn.groupParticipantsUpdate(groupId, mentioned, 'remove');
      reply('✅ User kicked.');
    } catch {
      reply('❌ Failed to kick user.');
    }
  }

  // !promote
  if (command === 'promote') {
    if (!isOwner && !isCoOwner && !isBotOwner) return reply('❌ Only owner/co-owner can promote.');
    const mentioned = message.mentionedJid;
    if (!mentioned?.length) return reply('⚠️ Mention someone to promote.');
    try {
      await conn.groupParticipantsUpdate(groupId, mentioned, 'promote');
      reply('✅ User promoted.');
    } catch {
      reply('❌ Failed to promote user.');
    }
  }

  // !demote
  if (command === 'demote') {
    if (!isOwner && !isCoOwner && !isBotOwner) return reply('❌ Only owner/co-owner can demote.');
    const mentioned = message.mentionedJid;
    if (!mentioned?.length) return reply('⚠️ Mention someone to demote.');
    try {
      await conn.groupParticipantsUpdate(groupId, mentioned, 'demote');
      reply('✅ User demoted.');
    } catch {
      reply('❌ Failed to demote user.');
    }
  }
};
