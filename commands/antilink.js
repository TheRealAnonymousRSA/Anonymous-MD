/* commands/antilink.js */

const { loadAntilinkSettings, saveAntilinkSettings } = require('../groupSettingsManager');

module.exports = {
    name: "antilink",
    description: "Configures Anti-Link settings for a group.",
    usage: "!antilink <on|off|exempt|unexempt>",
    category: "admin",

    async execute(sock, m, args, sender, isGroup, isGroupAdmin) {
        const groupId = m.key.remoteJid;
        if (!isGroup) {
            return await sock.sendMessage(groupId, { text: "❌ This command is for groups only." }, { quoted: m });
        }
        if (!isGroupAdmin) {
            return await sock.sendMessage(groupId, { text: "❌ Only group admins can manage Anti-Link settings." }, { quoted: m });
        }

        const settings = loadAntilinkSettings(groupId);
        const subcommand = args[0]?.toLowerCase();

        switch (subcommand) {
            case 'on':
                settings.enabled = true;
                saveAntilinkSettings(groupId, settings);
                await sock.sendMessage(groupId, { text: "✅ Anti-Link is now *ON*. All non-exempt external links will be deleted." }, { quoted: m });
                break;

            case 'off':
                settings.enabled = false;
                saveAntilinkSettings(groupId, settings);
                await sock.sendMessage(groupId, { text: "✅ Anti-Link is now *OFF*. Links are allowed." }, { quoted: m });
                break;

            case 'exempt':
                settings.exemptAdmins = true;
                saveAntilinkSettings(groupId, settings);
                await sock.sendMessage(groupId, { text: "✅ Admins are now *exempt* from the Anti-Link rule." }, { quoted: m });
                break;

            case 'unexempt':
                settings.exemptAdmins = false;
                saveAntilinkSettings(groupId, settings);
                await sock.sendMessage(groupId, { text: "✅ Admins are *no longer exempt* and must follow the Anti-Link rule." }, { quoted: m });
                break;

            default:
                const status = settings.enabled ? `ON (${settings.exemptAdmins ? 'Admins Exempted' : 'Admins Included'})` : "OFF";
                await sock.sendMessage(groupId, { 
                    text: `🔗 *Anti-Link Status*
Status: ${status}

*Commands:*
• !antilink on - Enable Anti-Link
• !antilink off - Disable Anti-Link
• !antilink exempt - Exempt admins from rule
• !antilink unexempt - Include admins in rule`
                }, { quoted: m });
        }
    }
};