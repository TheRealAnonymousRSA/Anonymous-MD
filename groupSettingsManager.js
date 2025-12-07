/* groupSettingsManager.js */

const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, 'group_settings.json');

// Default global settings
const DEFAULT_ANTIMENTION = {
    enabled: false,
    action: 'delete',
    maxMentions: 5 
};

const DEFAULT_ANTILINK = {
    enabled: false,
    exemptAdmins: true
};

// --- Persistence Helpers (Shared) ---
function loadAllSettings() {
    try {
        if (!fs.existsSync(SETTINGS_FILE)) {
            fs.writeFileSync(SETTINGS_FILE, JSON.stringify({}, null, 2));
            return {};
        }
        return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    } catch (e) {
        console.error("Error loading group settings:", e);
        return {};
    }
}

function saveAllSettings(settings) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

// --- Anti-Mention Functions ---
function loadAntimentionSettings(groupId) {
    const allSettings = loadAllSettings();
    const groupSettings = allSettings[groupId] || {};
    return { 
        ...DEFAULT_ANTIMENTION,
        ...(groupSettings.antimention || {})
    };
}

function saveAntimentionSettings(groupId, antimentionSettings) {
    const allSettings = loadAllSettings();
    allSettings[groupId] = allSettings[groupId] || {};
    allSettings[groupId].antimention = antimentionSettings;
    saveAllSettings(allSettings);
}

// --- Anti-Link Functions (New) ---
function loadAntilinkSettings(groupId) {
    const allSettings = loadAllSettings();
    const groupSettings = allSettings[groupId] || {};
    return { 
        ...DEFAULT_ANTILINK,
        ...(groupSettings.antilink || {})
    };
}

function saveAntilinkSettings(groupId, antilinkSettings) {
    const allSettings = loadAllSettings();
    allSettings[groupId] = allSettings[groupId] || {};
    allSettings[groupId].antilink = antilinkSettings;
    saveAllSettings(allSettings);
}

module.exports = {
    loadAntimentionSettings,
    saveAntimentionSettings,
    loadAntilinkSettings,
    saveAntilinkSettings
};