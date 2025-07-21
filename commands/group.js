js
const fs = require('fs');
const path = './roles.json';

function loadRoles() {
  if (!fs.existsSync(path)) {
    fs.writeFileSync(path, JSON.stringify({ groups: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(path));
}

function saveRoles(data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

async function handleRoleCommands(sock, message, sender, groupId) {
  const { text } = message.message.conversation || { text: '' };
  if (!text) return;

  const args = text.trim().split(' ');
  const cmd = args[0].toLowerCase();

  if (!cmd.startsWith('!')) return; // commands start with !

  // Load roles
  let roles = loadRoles();
  if (!roles.groups[groupId]) {
    roles.groups[groupId] = { owner: '', coOwners: [] };
  }

  const groupRoles = roles.groups[groupId];

  // Assign owner if not set
  if (!groupRoles.owner) {groupRoles.owner = sender; // first user to run command becomes owner (optional)
    saveRoles(roles);
  }

  // Check permissions
  const isOwner = sender === groupRoles.owner;
  const isCoOwner = groupRoles.coOwners.includes(sender);

  // Set co-owner command
  if (cmd === '!setcoowner') {
    if (!isOwner) {
      await sock.sendMessage(groupId, { text: 'Only the group owner can set co-owners.' }, { quoted: message });
      return;
    }

    if (args.length < 2) {
      await sock.sendMessage(groupId, { text: 'Usage: !setcoowner @number' }, { quoted: message });
      return;
    }

    // extract mentioned number (should be in format @number)
    const mentioned = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentioned.length === 0) {
      await sock.sendMessage(groupId, { text: 'Please mention a user to set as co-owner.' }, { quoted: message });
      return;
    }

    const newCoOwner = mentioned[0];
    if (!groupRoles.coOwners.includes(newCoOwner)) {
      groupRoles.coOwners.push(newCoOwner);
      saveRoles(roles);
      await sock.sendMessage(groupId, { text: `Added newCoOwner as co-owner.` ,  quoted: message );
     else 
      await sock.sendMessage(groupId,  text: `{newCoOwner} is already a co-owner.` }, { quoted: message });}
    return;
  }

  // Remove co-owner command
  if (cmd === '!removecoowner') {
    if (!isOwner) {
      await sock.sendMessage(groupId, { text: 'Only the group owner can remove co-owners.' }, { quoted: message });
      return;
    }

    const mentioned = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentioned.length === 0) {
      await sock.sendMessage(groupId, { text: 'Please mention a user to remove from co-owners.' }, { quoted: message });
      return;
    }

    const coOwnerToRemove = mentioned[0];
    const index = groupRoles.coOwners.indexOf(coOwnerToRemove);
    if (index > -1) {
      groupRoles.coOwners.splice(index, 1);
      saveRoles(roles);
      await sock.sendMessage(groupId, { text: `Removed coOwnerToRemove from co-owners.` ,  quoted: message );
     else 
      await sock.sendMessage(groupId,  text: `{coOwnerToRemove} is not a co-owner.` }, { quoted: message });
    }
    return;
  }

  // Example: check co-owner command
  if (cmd === '!listcoowners') {
    let list = groupRoles.coOwners.length
      ? groupRoles.coOwners.map(jid => jid).join('\n')
      : 'No co-owners set.';
    await sock.sendMessage(groupId, { text: `Co-owners:\n${list}` }, { quoted: message });
  }
}// Export this function and call it in your message handler with proper params
module.exports = { handleRoleCommands };
```

---

How to use:

- Load this command handler and call `handleRoleCommands(sock, message, sender, groupId)` inside your main message event.
- Owner can do inside the group chat:

```
!setcoowner @1234567890
!removecoowner @1234567890
!listcoowners
