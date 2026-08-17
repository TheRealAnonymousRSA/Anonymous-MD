// A short, generic starter list — not exhaustive. Edit this array to fit
// what your groups consider inappropriate; .antibadword uses it directly.
const BAD_WORDS = ['fuck', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'piss', 'crap'];

function containsBadWord(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return BAD_WORDS.some((word) => new RegExp(`\\b${word}\\b`, 'i').test(lower));
}

module.exports = { BAD_WORDS, containsBadWord };
