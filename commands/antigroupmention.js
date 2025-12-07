/* commands/antigroupmention.js */

const { loadAntimentionSettings, saveAntimentionSettings } = require('../groupSettingsManager');

module.exports = {
  name: "antigroupmention",
  description: "Configure Anti-Group-Mention settings for a group.",
  usage: "!antigroupmention <on|off|action>",
  category: "admin",

  async execute(sock, m, args, sender, isGroup, isGroupAdmin) {
    const groupId = m.key.remoteJid;
    if (!isGroup) {
      return await sock.sendMessage(groupId, { text: "❌ This command is only for groups." }, { quoted: m });
    }
    if (!isGroupAdmin) {
      return await sock.sendMessage(groupId, { text: "❌ Only group admins can manage anti-group-mention settings." }, { quoted: m });
    }

    const settings = loadAntimentionSettings(groupId);
    const subcommand = args[0]?.toLowerCase();

    switch(subcommand) {
      case 'on':
        settings.enabled = true;
        saveAntimentionSettings(groupId, settings);
        await sock.sendMessage(groupId, { text: `✅ Anti-Group-Mention is now *ON*.\nAction on detection: ${settings.action.toUpperCase()}` }, { quoted: m });
        break;

      case 'off':
        settings.enabled = false;
        saveAntimentionSettings(groupId, settings);
        await sock.sendMessage(groupId, { text: "✅ Anti-Group-Mention is now *OFF*." }, { quoted: m });
        break;

      case 'action':
        const actionType = args[1]?.toLowerCase();
        if (!actionType || !['delete', 'warn', 'kick'].includes(actionType)) {
          return await sock.sendMessage(groupId, { 
            text: "⚠️ Invalid action. Current supported types are: *delete*, warn, kick." 
          }, { quoted: m });
        }
        
        settings.action = actionType;
        saveAntimentionSettings(groupId, settings);
        await sock.sendMessage(groupId, { text: `✅ Anti-Group-Mention action set to *${actionType.toUpperCase()}*.` }, { quoted: m });
        break;

      default:
        const status = settings.enabled ? `ON (Action: ${settings.action.toUpperCase()})` : "OFF";
        await sock.sendMessage(groupId, { 
          text: `🛡️ *Anti-Group-Mention Status*
Status: ${status}

*Commands:*
• !antigroupmention on - Enable Anti-Group-Mention
• !antigroupmention off - Disable Anti-Group-Mention
• !antigroupmention action <delete|warn|kick> - Set action`
        }, { quoted: m });
    }
  }
};