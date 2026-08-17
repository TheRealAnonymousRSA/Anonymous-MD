const { isSudo } = require('./permissions');

async function isSenderAdmin(sock, groupId, sender) {
  const metadata = await sock.groupMetadata(groupId);
  const p = metadata.participants.find((x) => x.id === sender);
  return p?.admin === 'admin' || p?.admin === 'superadmin';
}

// Group admins can moderate their own group; sudo/owner can moderate any group the bot is in.
async function canModerate(sock, groupId, sender) {
  return isSudo(sender) || (await isSenderAdmin(sock, groupId, sender));
}

module.exports = { isSenderAdmin, canModerate };
