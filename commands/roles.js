js
const fs = require('fs');
const path = './roles.json'; // File to store owner/co-owner data

// Load or create roles file
function loadRoles() {
  if (!fs.existsSync(path)) {
    fs.writeFileSync(path, JSON.stringify({ groups: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(path));
}

// Save roles data
function saveRoles(data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

/**
 * Handle owner/co-owner commands:
 * Commands:
 *  !setcoowner @user
 *  !removecoowner @user
 *  !listcoowners
 */
async function handleRoleCommands(sock, message, sender, groupId) {
  if (!message.message.conversation && !message.message.extendedTextMessage) return;

  const text = message.message.conversation || message.message.extendedTextMessage?.text || '';
  if (!text.startsWith('!')) return;

  const args = text.trim().split(' ');
  const cmd = args[0].toLowerCase();

  let roles = loadRoles();
  if (!roles.groups[groupId]) roles.groups[groupId] = { owner: '', coOwners: [] };
  let groupRoles = roles.groups[groupId];

  // Auto-assign owner if not set
  if (!groupRoles.owner) {
    groupRoles.owner = sender;
    saveRoles(roles);
  }const isOwner = sender === groupRoles.owner;
  const isCoOwner = groupRoles.coOwners.includes(sender);

  if (cmd === '!setcoowner') {
    if (!isOwner) {
      await sock.sendMessage(groupId, { text: 'Only the owner can set co-owners.' }, { quoted: message });
      return;
    }
    const mentioned = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (!mentioned.length) {
      await sock.sendMessage(groupId, { text: 'Mention a user to set as co-owner.' }, { quoted: message });
      return;
    }
    const newCoOwner = mentioned[0];
    if (!groupRoles.coOwners.includes(newCoOwner)) {
      groupRoles.coOwners.push(newCoOwner);
      saveRoles(roles);
      await sock.sendMessage(groupId, { text: `Added co-owner: newCoOwner` ,  quoted: message );
     else 
      await sock.sendMessage(groupId,  text: `{newCoOwner} is already a co-owner.` }, { quoted: message });
    }
  } else if (cmd === '!removecoowner') {
    if (!isOwner) {
      await sock.sendMessage(groupId, { text: 'Only the owner can remove co-owners.' }, { quoted: message });
      return;
    }
    const mentioned = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (!mentioned.length) {await sock.sendMessage(groupId, { text: 'Mention a user to remove from co-owners.' }, { quoted: message });
      return;
    }
    const toRemove = mentioned[0];
    if (groupRoles.coOwners.includes(toRemove)) {
      groupRoles.coOwners = groupRoles.coOwners.filter(jid => jid !== toRemove);
      saveRoles(roles);
      await sock.sendMessage(groupId, { text: `Removed co-owner: toRemove` ,  quoted: message );
     else 
      await sock.sendMessage(groupId,  text: `{toRemove} is not a co-owner.` }, { quoted: message });
    }
  } else if (cmd === '!listcoowners') {
    if (groupRoles.coOwners.length === 0) {
      await sock.sendMessage(groupId, { text: 'No co-owners set.' }, { quoted: message });
    } else {
      const list = groupRoles.coOwners.join('\n');
      await sock.sendMessage(groupId, { text: `Co-owners:\n${list}` }, { quoted: message });
    }
  }
}

module.exports = { handleRoleCommands };
