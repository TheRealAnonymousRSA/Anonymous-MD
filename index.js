/* -------------------------------------------------------------------------- */
/*                                 index.js                                   */
/* -------------------------------------------------------------------------- */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { performance } = require('perf_hooks');
const config = require('./config');

// Custom Managers
const { 
  loadAntimentionSettings, 
  loadAntilinkSettings, 
} = require('./groupSettingsManager');

// Command Imports
const antigroupmentionCommand = require('./commands/antigroupmention');
const antilinkCommand = require('./commands/antilink');
const healthCommand = require('./commands/health');
const lockdownCommand = require('./commands/lockdown');
const nukeCommand = require('./commands/nuke');
const decryptCommand = require('./commands/decrypt');
const geminiCommand = require('./commands/gemini');

// --- Global Constants and State ---
const BOT_START_TIME = Date.now();
const prefix = config.BOT_PREFIX; 


async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth');
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        shouldSyncHistory: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const startTime = performance.now();
        const groupId = m.key.remoteJid;
        const isGroup = groupId.endsWith('@g.us');
        const sender = m.key.participant || m.key.remoteJid;
        
        let body = m.message?.conversation || m.message?.extendedTextMessage?.text || '';
        
        // Helper for quick reply
        const reply = async (text) => {
            await sock.sendMessage(groupId, { text: text }, { quoted: m });
        };
        
        // --- 1. NON-COMMAND MODERATION ENFORCEMENT ---
        if (isGroup) {
            const groupMetadata = await sock.groupMetadata(groupId);
            const participant = groupMetadata.participants.find(p => p.id === sender);
            const isGroupAdmin = participant && (participant.admin === 'admin' || participant.admin === 'superadmin');

            // a. Anti-Group-Mention Enforcement (Highest priority)
            const deletedMention = await deleteOnGroupMention(sock, m, groupMetadata);
            if (deletedMention) return; 

            // b. Anti-Link Enforcement
            const deletedLink = await deleteOnExternalLink(sock, m, isGroupAdmin);
            if (deletedLink) return;
        }


        // --- 2. COMMAND HANDLER ---
        if (!body.startsWith(prefix)) return;

        const args = body.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();
        
        // Re-check for admin status before executing an admin command
        const groupMetadata = isGroup ? await sock.groupMetadata(groupId) : null;
        const participant = groupMetadata ? groupMetadata.participants.find(p => p.id === sender) : null;
        const isGroupAdmin = participant && (participant.admin === 'admin' || participant.admin === 'superadmin');

        try {
            switch (command) {
                // MODERATION COMMANDS
                case 'antigroupmention':
                    await antigroupmentionCommand.execute(sock, m, args, sender, isGroup, isGroupAdmin);
                    break;
                case 'antilink':
                    await antilinkCommand.execute(sock, m, args, sender, isGroup, isGroupAdmin);
                    break;
                case 'lock':
                case 'unlock':
                    await lockdownCommand.execute(sock, m, command, sender, isGroup, isGroupAdmin, groupMetadata, reply);
                    break;
                case 'nuke': 
                    await nukeCommand.execute(sock, m, args, reply, isGroup, isGroupAdmin, groupId);
                    break;

                // UTILITY & AI FEATURES
                case 'health':
                case 'status':
                    await healthCommand.execute(sock, m, BOT_START_TIME, startTime);
                    break;
                case 'decrypt':
                    await decryptCommand.execute(sock, m, args, reply);
                    break;
                case 'gemini':
                    await geminiCommand.execute(sock, m, args, reply);
                    break;

                default:
                    // Optional: reply('❓ Unknown command.')
            }
        } catch (error) {
            console.error(`Error executing command ${command}:`, error);
            await reply(`⚠️ Error: ${error.message}`);
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                startBot();
            } else {
                console.log('❌ Bot connection closed. Logged out.');
            }
        }
    });
}

// Start the bot
startBot();


/* -------------------------------------------------------------------------- */
/*                           MODERATION FUNCTIONS                             */
/* -------------------------------------------------------------------------- */

async function deleteOnGroupMention(sock, m, groupMetadata) {
    const groupId = m.key.remoteJid;
    const settings = loadAntimentionSettings(groupId);
    
    if (!settings.enabled || settings.action !== 'delete') return false; 
    
    const sender = m.key.participant || m.key.remoteJid;
    const mentionedJids = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const text = m.message?.conversation || m.message?.extendedTextMessage?.text || '';

    const participantCount = groupMetadata.participants.length;
    const requiredMentions = Math.max(5, Math.ceil(participantCount * 0.80));
    const isMassMention = mentionedJids.length >= requiredMentions;

    const normalizedText = text.toLowerCase();
    const groupMentionKeywords = ['@all', '@everyone', '@tagall'];
    const hasGroupMentionKeyword = groupMentionKeywords.some(keyword => normalizedText.includes(keyword));

    if (isMassMention || hasGroupMentionKeyword) {
        try {
            await sock.sendMessage(groupId, { delete: m.key });
            await sock.sendMessage(groupId, { text: `🗑️ Group Mention message deleted.` }, { quoted: m });
            return true;
        } catch (error) {
            await sock.sendMessage(groupId, { 
                text: `❌ Anti-Group-Mention failed. @${sender.split('@')[0]} - please stop group tagging.`,
                mentions: [sender]
            }, { quoted: m });
            return false;
        }
    }
    return false;
}

async function deleteOnExternalLink(sock, m, isGroupAdmin) {
    const groupId = m.key.remoteJid;
    const settings = loadAntilinkSettings(groupId);
    if (!settings.enabled) return false;

    if (isGroupAdmin && settings.exemptAdmins) return false;

    const messageText = m.message?.conversation || m.message?.extendedTextMessage?.text || '';
    const sender = m.key.participant || m.key.remoteJid;
    
    const urlRegex = /(https?:\/\/[^\s]+|wa\.me\/[0-9]+|chat\.whatsapp\.com\/[^\s]+)/gi;

    if (urlRegex.test(messageText)) {
        try {
            await sock.sendMessage(groupId, { delete: m.key });
            await sock.sendMessage(groupId, { 
                text: `🔗 Link detected and deleted. @${sender.split('@')[0]} - Anti-Link is enabled.` 
            }, { quotes: m, mentions: [sender] });
            return true;
        } catch (error) {
            await sock.sendMessage(groupId, { 
                text: `❌ Bot failed to delete link. @${sender.split('@')[0]} - No external links are allowed.` 
            }, { mentions: [sender], quoted: m });
            return false;
        }
    }
    return false;
}