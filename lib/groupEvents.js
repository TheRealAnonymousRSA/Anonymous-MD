const { getGroupSettings } = require('./db');

function fillTemplate(template, participant, groupName) {
  return template
    .replace(/\{user\}/g, `@${participant.split('@')[0]}`)
    .replace(/\{group\}/g, groupName || 'the group');
}

async function handleGroupParticipantsUpdate(sock, update) {
  const { id: groupJid, participants, action } = update;
  if (action !== 'add' && action !== 'remove') return;

  const settings = getGroupSettings(groupJid);
  if (action === 'add' && !settings.welcome) return;
  if (action === 'remove' && !settings.goodbye) return;

  let groupName = '';
  try {
    const metadata = await sock.groupMetadata(groupJid);
    groupName = metadata.subject;
  } catch {
    // group metadata unavailable — fall back to the generic {group} text
  }

  for (const participant of participants) {
    const template = action === 'add'
      ? (settings.welcomeMessage || 'Welcome {user} to {group}!')
      : (settings.goodbyeMessage || "Goodbye {user}, we'll miss you.");
    const text = fillTemplate(template, participant, groupName);
    try {
      await sock.sendMessage(groupJid, { text, mentions: [participant] });
    } catch (err) {
      console.error('Could not send welcome/goodbye message:', err.message || err);
    }
  }
}

module.exports = { handleGroupParticipantsUpdate };
