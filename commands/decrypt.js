/* commands/decrypt.js */

const { Buffer } = require('buffer');

module.exports = {
    name: 'decrypt',
    description: 'Detect and decrypt common obfuscated or encoded messages (Base64, URL, Hex, Caesar 3).',
    usage: '!decrypt <text> or reply to a message with !decrypt',
    category: 'utility',

    async execute(sock, m, args, reply) {
        let textToDecrypt = args.join(" ").trim();
        const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!textToDecrypt && quotedMsg) {
             textToDecrypt = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || '';
        }

        if (!textToDecrypt) {
            return reply("🔑 Please provide the obfuscated text or reply to a message containing it.");
        }
        
        let results = [];

        // --- 1. Base64 Decoding ---
        try {
            if (textToDecrypt.length % 4 === 0 && /^[A-Za-z0-9+/=]+$/.test(textToDecrypt)) {
                let decoded = Buffer.from(textToDecrypt, 'base64').toString('utf8');
                if (decoded.length && !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(decoded)) {
                    results.push(`Base64: ${decoded}`);
                }
            }
        } catch (e) { /* ignore */ }
        
        // --- 2. URL Decoding ---
        try {
            if (textToDecrypt.includes('%')) {
                let decoded = decodeURIComponent(textToDecrypt);
                if (decoded !== textToDecrypt) {
                    results.push(`URL Decode: ${decoded}`);
                }
            }
        } catch (e) { /* ignore */ }
        
        // --- 3. Hex Decoding (Simple) ---
        try {
            if (/^([0-9a-fA-F]{2})+$/.test(textToDecrypt)) {
                let decoded = Buffer.from(textToDecrypt, 'hex').toString('utf8');
                 if (decoded.length && !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(decoded)) {
                    results.push(`Hex: ${decoded}`);
                }
            }
        } catch (e) { /* ignore */ }

        // --- 4. Simple Caesar (-3 shift) ---
        const rot3 = (str) => str.replace(/[a-zA-Z]/g, (c) => {
            const charCode = c.charCodeAt(0);
            const base = charCode < 97 ? 65 : 97;
            return String.fromCharCode((charCode - base + 23) % 26 + base);
        });
        
        let decodedRot3 = rot3(textToDecrypt);
        if (decodedRot3 !== textToDecrypt) {
             results.push(`Caesar ROT-3: ${decodedRot3}`);
        }
        
        // --- Final Output ---
        if (results.length > 0) {
            const decryptionReport = `🗝️ *Decryption Analysis Report*

*Original Text:* ${textToDecrypt.substring(0, 100)}${textToDecrypt.length > 100 ? '...' : ''}

*Possible Decryptions:*
${results.map(r => `• ${r}`).join('\n')}`;

            await reply(decryptionReport);
        } else {
            await reply("❌ No common encodings (Base64, URL, Hex, ROT-3) detected or successfully decrypted.");
        }
    }
};