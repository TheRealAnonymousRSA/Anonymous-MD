const { setGroupSetting } = require('../lib/db');
const { canModerate } = require('../lib/groupAuth');

function toggleCommand(key, label, note = '') {
  return {
    name: key,
    description: `${label} — .${key} on|off (admins/sudo only)`,
    category: 'moderation',
    async execute({ sock, from, sender, args }) {
      if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: 'Groups only.' });
      if (!(await canModerate(sock, from, sender))) {
        return sock.sendMessage(from, { text: '❌ Admins only.' });
      }
      const choice = args[0]?.toLowerCase();
      if (!['on', 'off'].includes(choice)) {
        return sock.sendMessage(from, { text: `Usage: .${key} on | .${key} off` });
      }
      setGroupSetting(from, key, choice === 'on');
      await sock.sendMessage(from, { text: `${label} turned ${choice}.${note ? ' ' + note : ''}` });
    },
  };
}

module.exports = [
  toggleCommand('antilink', 'Auto-delete WhatsApp invite links', '(bot must be a group admin)'),
  toggleCommand('nsfw', 'Auto-delete known adult-site links', '(link-based filter only, not image scanning)'),
  toggleCommand('antispam', 'Auto-delete repeated/identical messages'),
  toggleCommand('antiflood', 'Auto-delete messages sent too quickly'),
  toggleCommand('antibadword', "Auto-delete messages with filtered words"),
  toggleCommand('antimention', 'Auto-delete mass-mention spam'),
  toggleCommand('autodelete', "Auto-delete the bot's own moderation warnings after 10s", '(keeps the chat clean)'),
];
