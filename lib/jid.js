// Generic phone number normalization for .add — accepts full international
// format with country code (e.g. 27821234567, 14155552671, +447911123456,
// 0027821234567). We deliberately don't guess a country code for numbers
// that start with a single leading 0 (ambiguous without knowing the country),
// so those are rejected with a clear message rather than silently mis-normalized.
function normalizePhoneNumber(input) {
  let digits = String(input || '').replace(/[^0-9]/g, '');
  if (!digits) return null;

  if (digits.startsWith('00')) digits = digits.slice(2); // international dialing prefix

  if (digits.startsWith('0')) return null; // ambiguous local format, no country code

  // E.164: country code + subscriber number, 8-15 digits total.
  if (digits.length < 8 || digits.length > 15) return null;

  return digits;
}

function toJid(digits) {
  return `${digits}@s.whatsapp.net`;
}

module.exports = { normalizePhoneNumber, toJid };
