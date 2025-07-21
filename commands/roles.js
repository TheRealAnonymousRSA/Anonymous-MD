js
const fs = require('fs');
const path = './roles.json';

const BOT_OWNER = '27698210064@s.whatsapp.net';

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

// Handle role commands
async function handleRoleCommand(command, args, groupId, sender, reply) {
  const roles = loadRoles();
  roles.groups[groupId] = roles.groups[groupId] || { owner: '', coowners: [] };

  if (command === 'setowner') {
    if (sender !== BOT_OWNER) return reply('Only bot owner can set group owner.');
    const user = args[0].replace(/[@\s]/g, '') + '@s.whatsapp.net';
    roles.groups[groupId].owner = user;
    saveRoles(roles);
    return reply('Group owner set.');
  }

  if (command === 'removeowner') {
    if (sender !== BOT_OWNER) return reply('Only bot owner can remove group owner.');
    roles.groups[groupId].owner = '';
    saveRoles(roles);
    return reply('Group owner removed.');
  }if (command === 'setcoowner') {
    if (sender !== roles.groups[groupId].owner && sender !== BOT_OWNER) return reply('Only owner can set co-owner.');
    const user = args[0].replace(/[@\s]/g, '') + '@s.whatsapp.net';
    if (!roles.groups[groupId].coowners.includes(user)) {
      roles.groups[groupId].coowners.push(user);
      saveRoles(roles);
      return reply('Co-owner added.');
    } else {
      return reply('User is already a co-owner.');
    }
  }

  if (command === 'removecoowner') {
    if (sender !== roles.groups[groupId].owner && sender !== BOT_OWNER) return reply('Only owner can remove co-owner.');
    const user = args[0].replace(/[@\s]/g, '') + '@s.whatsapp.net';
    roles.groups[groupId].coowners = roles.groups[groupId].coowners.filter(u => u !== user);
    saveRoles(roles);
    return reply('Co-owner removed.');
  }
}

module.exports = {
  handleRoleCommand,
  loadRoles
};