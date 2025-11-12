const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const fs = require("fs");
const pino = require("pino");
const { exec } = require("child_process");
const axios = require("axios");

// Load commands dynamically
const commands = new Map();

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("session");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    auth: state,
    generateHighQualityLinkPreview: true,
    syncFullHistory: true,
    markOnlineOnConnect: true,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("📷 Scan this QR to connect:");
      console.log(qr);
    }

    if (connection === "close") {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      if (reason === DisconnectReason.loggedOut) {
        console.log("❌ Logged out. Deleting session...");
        fs.rmSync("session", { recursive: true, force: true });
      } else {
        console.log("🔁 Reconnecting...");
        startBot();
      }
    } else if (connection === "open") {
      console.log("✅ Bot connected successfully!");
    }
  });

  // Message handler
  sock.ev.on("messages.upsert", async (msg) => {
    const m = msg.messages[0];
    if (!m.message || m.key.fromMe) return;

    const text = (
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      m.message.imageMessage?.caption ||
      ""
    ).trim();

    const prefix = /^[°•π÷×¶∆£¢€¥®™✓_=|~!?#$%^&.+-,\\\@]/.test(text) ? text.match(/^[°•π÷×¶∆£¢€¥®™✓_=|~!?#$%^&.+-,\\\@]/gi)[0] : '/';
    const args = text.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const isCmd = text.startsWith(prefix);
    const sender = m.key.participant || m.key.remoteJid;
    const isGroup = m.key.remoteJid.endsWith('@g.us');
    const groupName = isGroup ? (await sock.groupMetadata(m.key.remoteJid)).subject : '';
    const pushName = m.pushName || "Unknown";

    // Auto-read messages
    await sock.readMessages([m.key]);

    // Command handler
    if (isCmd) {
      console.log(`[CMD] ${command} from ${pushName} in ${isGroup ? groupName : 'Private Chat'}`);
      
      try {
        // Ping command
        if (command === "ping") {
          const timestamp = new Date().getTime();
          const latency = timestamp - (m.messageTimestamp * 1000);
          await sock.sendMessage(
            m.key.remoteJid, 
            { 
              text: `🏓 Pong!\n⏱️ Latency: ${latency}ms` 
            }, 
            { quoted: m }
          );
        }

        // Menu command
        else if (command === "menu" || command === "help") {
          const menu = `🤖 *Anonymous-MD Bot Commands* 🤖

📊 *General Commands:*
» ${prefix}ping - Check bot latency
» ${prefix}menu/${prefix}help - Show this menu
» ${prefix}runtime - Bot uptime
» ${prefix}owner - Contact owner

🎭 *Fun Commands:*
» ${prefix}joke - Get a random joke
» ${prefix}quote - Get an inspiring quote
» ${prefix}meme - Get a random meme

🌐 *Utility Commands:*
» ${prefix}weather <city> - Get weather info
» ${prefix}define <word> - Get word definition
» ${prefix}shorten <url> - Shorten a URL

🎵 *Media Commands:*
» ${prefix}song <title> - Search for a song
» ${prefix}video <query> - Search for a video

🔄 *Group Commands:*
» ${prefix}promote @user - Promote a user
» ${prefix}demote @user - Demote a user
» ${prefix}kick @user - Kick a user
» ${prefix}group open/close - Open/close group

📝 *Note:* Commands marked with @ require mentioning a user.`;

          await sock.sendMessage(
            m.key.remoteJid,
            { 
              text: menu,
              contextInfo: {
                externalAdReply: {
                  title: "Anonymous-MD Bot",
                  body: "Advanced WhatsApp Bot",
                  thumbnailUrl: "https://i.ibb.co/0XJ0dY0/qr.png",
                  mediaType: 1,
                  renderLargerThumbnail: true
                }
              }
            },
            { quoted: m }
          );
        }

        // Runtime command
        else if (command === "runtime") {
          const uptime = process.uptime();
          const days = Math.floor(uptime / (3600 * 24));
          const hours = Math.floor(uptime % (3600 * 24) / 3600);
          const minutes = Math.floor(uptime % 3600 / 60);
          const seconds = Math.floor(uptime % 60);
          
          const runtime = `⏱️ *Bot Uptime:*
📅 ${days} Days
🕰️ ${hours} Hours
⏰ ${minutes} Minutes
⏱️ ${seconds} Seconds`;
          
          await sock.sendMessage(
            m.key.remoteJid, 
            { text: runtime }, 
            { quoted: m }
          );
        }

        // Owner command
        else if (command === "owner") {
          await sock.sendMessage(
            m.key.remoteJid,
            { 
              contacts: {
                displayName: 'Owner',
                contacts: [{ vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:Anonymous\nTEL;type=CELL;type=VOICE;waid=919876543210:+91 98765 43210\nEND:VCARD` }]
              }
            },
            { quoted: m }
          );
        }

        // Joke command
        else if (command === "joke") {
          try {
            const response = await axios.get('https://official-joke-api.appspot.com/random_joke');
            const joke = `😂 *Joke:*\n\n*${response.data.setup}*\n\n_${response.data.punchline}_`;
            await sock.sendMessage(m.key.remoteJid, { text: joke }, { quoted: m });
          } catch (error) {
            await sock.sendMessage(m.key.remoteJid, { text: "⚠️ Couldn't fetch a joke right now!" }, { quoted: m });
          }
        }

        // Quote command
        else if (command === "quote") {
          try {
            const response = await axios.get('https://api.quotable.io/random');
            const quote = `❝ ${response.data.content} ❞\n\n— ${response.data.author}`;
            await sock.sendMessage(m.key.remoteJid, { text: quote }, { quoted: m });
          } catch (error) {
            await sock.sendMessage(m.key.remoteJid, { text: "⚠️ Couldn't fetch a quote right now!" }, { quoted: m });
          }
        }

        // Weather command
        else if (command === "weather") {
          if (args.length === 0) {
            await sock.sendMessage(m.key.remoteJid, { text: "🌤️ Please provide a city name!\nUsage: /weather London" }, { quoted: m });
            return;
          }
          
          const city = args.join(" ");
          try {
            // Note: You would need to get a free API key from openweathermap.org
            // const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=YOUR_API_KEY&units=metric`);
            // For demo, sending a template:
            const weather = `🌤️ *Weather in ${city}:*\n\n🌡️ Temperature: 25°C\n☁️ Conditions: Partly Cloudy\n💧 Humidity: 65%\n🌬️ Wind: 10 km/h`;
            await sock.sendMessage(m.key.remoteJid, { text: weather }, { quoted: m });
          } catch (error) {
            await sock.sendMessage(m.key.remoteJid, { text: "⚠️ Couldn't fetch weather data!" }, { quoted: m });
          }
        }

        // Define command
        else if (command === "define") {
          if (args.length === 0) {
            await sock.sendMessage(m.key.remoteJid, { text: "📚 Please provide a word to define!\nUsage: /define programming" }, { quoted: m });
            return;
          }
          
          const word = args.join(" ");
          try {
            const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
            const definition = response.data[0];
            const result = `📘 *Definition of ${word}:*\n\n📝 *Part of Speech:* ${definition.meanings[0].partOfSpeech}\n\n💬 *Meaning:* ${definition.meanings[0].definitions[0].definition}\n\n✍️ *Example:* ${definition.meanings[0].definitions[0].example || 'Not available'}`;
            await sock.sendMessage(m.key.remoteJid, { text: result }, { quoted: m });
          } catch (error) {
            await sock.sendMessage(m.key.remoteJid, { text: "⚠️ Word not found!" }, { quoted: m });
          }
        }

        // Group commands (only work in groups)
        else if (isGroup) {
          // Promote command
          if (command === "promote") {
            const mentionedJid = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentionedJid.length === 0) {
              await sock.sendMessage(m.key.remoteJid, { text: "👤 Please mention a user to promote!" }, { quoted: m });
              return;
            }
            
            try {
              await sock.groupParticipantsUpdate(m.key.remoteJid, mentionedJid, "promote");
              await sock.sendMessage(m.key.remoteJid, { text: "✅ User promoted successfully!" }, { quoted: m });
            } catch (error) {
              await sock.sendMessage(m.key.remoteJid, { text: "⚠️ Could not promote user!" }, { quoted: m });
            }
          }

          // Demote command
          else if (command === "demote") {
            const mentionedJid = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentionedJid.length === 0) {
              await sock.sendMessage(m.key.remoteJid, { text: "👤 Please mention a user to demote!" }, { quoted: m });
              return;
            }
            
            try {
              await sock.groupParticipantsUpdate(m.key.remoteJid, mentionedJid, "demote");
              await sock.sendMessage(m.key.remoteJid, { text: "✅ User demoted successfully!" }, { quoted: m });
            } catch (error) {
              await sock.sendMessage(m.key.remoteJid, { text: "⚠️ Could not demote user!" }, { quoted: m });
            }
          }

          // Kick command
          else if (command === "kick") {
            const mentionedJid = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentionedJid.length === 0) {
              await sock.sendMessage(m.key.remoteJid, { text: "👤 Please mention a user to kick!" }, { quoted: m });
              return;
            }
            
            try {
              await sock.groupParticipantsUpdate(m.key.remoteJid, mentionedJid, "remove");
              await sock.sendMessage(m.key.remoteJid, { text: "✅ User kicked successfully!" }, { quoted: m });
            } catch (error) {
              await sock.sendMessage(m.key.remoteJid, { text: "⚠️ Could not kick user!" }, { quoted: m });
            }
          }

          // Group settings
          else if (command === "group") {
            const action = args[0]?.toLowerCase();
            if (!action) {
              await sock.sendMessage(m.key.remoteJid, { text: "🔄 Please specify action: open or close\nUsage: /group open" }, { quoted: m });
              return;
            }
            
            try {
              if (action === "open") {
                await sock.groupSettingUpdate(m.key.remoteJid, "unlocked");
                await sock.sendMessage(m.key.remoteJid, { text: "🔓 Group opened!" }, { quoted: m });
              } else if (action === "close") {
                await sock.groupSettingUpdate(m.key.remoteJid, "locked");
                await sock.sendMessage(m.key.remoteJid, { text: "🔒 Group closed!" }, { quoted: m });
              } else {
                await sock.sendMessage(m.key.remoteJid, { text: "🔄 Invalid action! Use open or close" }, { quoted: m });
              }
            } catch (error) {
              await sock.sendMessage(m.key.remoteJid, { text: "⚠️ Could not update group settings!" }, { quoted: m });
            }
          }
        }

        // Default response for unknown commands
        else {
          await sock.sendMessage(
            m.key.remoteJid,
            { text: `❓ Unknown command! Type ${prefix}menu to see all available commands.` },
            { quoted: m }
          );
        }
      } catch (error) {
        console.error("Error in command handler:", error);
        await sock.sendMessage(
          m.key.remoteJid,
          { text: "⚠️ An error occurred while processing your command!" },
          { quoted: m }
        );
      }
    }

    // Auto-responses
    else {
      // Simple auto-responses
      if (text.includes("hello") || text.includes("hi")) {
        await sock.sendMessage(
          m.key.remoteJid,
          { text: `👋 Hello ${pushName}! How can I help you today? Type ${prefix}menu to see my commands.` },
          { quoted: m }
        );
      } else if (text.includes("how are you") || text.includes("how are u")) {
        await sock.sendMessage(
          m.key.remoteJid,
          { text: "🤖 I'm just a bot, but I'm functioning perfectly! Thanks for asking." },
          { quoted: m }
        );
      }
    }
  });
}

startBot();

// Handle uncaught errors
process.on('uncaughtException', console.error);
process.on('unhandledRejection', console.error);