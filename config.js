module.exports = {
  // Command prefix (change to "!", ".", etc. if you want)
  prefix: "/",

  // Array of owner numbers (international format, no +)
  owners: ["27698210064", "27834923277"],

  // Bot display name
  botName: "Anonymous-MD Bot",

  // Session folder name
  sessionName: "session",

  // Logging settings
  logCommands: true,
  logMessages: false,

  // Bot presence settings
  presence: {
    online: true, // Show bot as online
    composing: false, // Show typing indicator when processing
  },

  // Auto-read messages
  autoRead: true,
  autoReadStatus: true,

  // Self-response settings
  selfResponse: false, // Respond to own messages (for testing)

  // Group settings
  group: {
    enable: true, // Enable group commands
    antiLink: false, // Remove WhatsApp link messages
    antiToxic: false, // Filter toxic words (requires word list)
    welcome: true, // Send welcome message to new members
    goodbye: true, // Send goodbye message to leaving members
  },

  // Media settings
  media: {
    autoDownload: false, // Auto download media files
    maxSize: 100, // Max media size in MB
  },

  // API Keys (add your own keys here)
  keys: {
    openWeather: "", // Get from openweathermap.org
    newsAPI: "", // Get from newsapi.org
    tenor: "", // Get from tenor.com
  },

  // Fun settings
  fun: {
    enable: true,
    memeLanguage: "en", // Language for memes
  },

  // Utility settings
  util: {
    enable: true,
    shortenAPI: "", // URL shortener API key
  },

  // Advanced settings
  advanced: {
    multiprocess: false, // Enable multi-processing
    reconnectTimeout: 5000, // Reconnection timeout in ms
    maxRetry: 3, // Max reconnection attempts
  },

  // Status messages
  status: {
    enable: true,
    message: "Anonymous-MD Bot | /help for commands",
    type: "available", // available, unavailable, typing, recording
  },

  // Database settings (if you plan to use database)
  database: {
    enable: false,
    type: "json", // json, mongodb, sqlite
    path: "./database.json",
  },

  // Add more config options here as needed
};