/* commands/gemini.js */

const config = require('../config');
const fetch = require('node-fetch');

module.exports = {
    name: "gemini",
    description: "Accesses Gemini for complex analysis or creative tasks.",
    usage: "!gemini <prompt/technical query>",
    category: 'ai',

    async execute(sock, m, args, reply) {
        const prompt = args.join(" ").trim();
        
        if (!prompt) {
            return reply('💡 Please provide a prompt for the Gemini AI. Example: `!gemini What are the risks of using outdated SSH ciphers?`');
        }

        if (config.GEMINI_API_KEY === "AIzaSyBXxsiAPxs9GIlkwUFtexiDUszTCXCrRLA" || !config.GEMINI_API_KEY) {
             return reply("❌ Gemini API Key is missing or unconfigured in `config.js`.");
        }

        await reply(`✨ Querying Gemini with: *${prompt}*\n\n_...connecting securely to the Gemini service..._`);
        
        try {
            const response = await fetch(`${config.GEMINI_API_ENDPOINT}?key=${config.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    config: {
                        temperature: 0.7, 
                        maxOutputTokens: 2048
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Gemini API failed with status ${response.status}. Error: ${JSON.stringify(errorData)}`);
            }

            const data = await response.json();
            
            const geminiResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Error: Could not parse response from Gemini.";

            const finalReport = `*Gemini Analysis for:* "${prompt}"\n\n${geminiResponseText}`;
            
            await reply(finalReport);

        } catch (e) {
            console.error("Gemini API Error:", e);
            await reply(`❌ Gemini API Failure: ${e.message}\n\nPlease verify your API key and endpoint format.`);
        }
    }
};