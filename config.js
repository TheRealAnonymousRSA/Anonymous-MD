/* config.js */

module.exports = {
    // IMPORTANT: Storing the key directly in code is a security risk. 
    // Recommended: Use an environment variable (process.env.GEMINI_API_KEY)
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || "AIzaSyBXxsiAPxs9GIlkwUFtexiDUszTCXCrRLA", 
    
    // Standard endpoint for Gemini's Text Generation models
    GEMINI_API_ENDPOINT: "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent", 
    
    BOT_PREFIX: '!'
};