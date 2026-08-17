// In-memory game state — intentionally not persisted, games only need to
// live as long as the process does.
const pendingAnswers = new Map(); // chatJid -> answer string
const ttGames = new Map(); // chatJid -> { board, players:[xJid,oJid], turn }

const RIDDLES = [
  { q: "What has keys but can't open locks?", a: 'A piano' },
  { q: 'What has a face and two hands but no arms or legs?', a: 'A clock' },
  { q: 'The more you take, the more you leave behind. What am I?', a: 'Footsteps' },
  { q: 'What can travel around the world while staying in a corner?', a: 'A stamp' },
  { q: 'What gets wetter the more it dries?', a: 'A towel' },
];

const TRIVIA = [
  { q: 'What is the capital of Australia?', a: 'Canberra' },
  { q: 'How many continents are there?', a: '7' },
  { q: 'What planet is known as the Red Planet?', a: 'Mars' },
  { q: 'Who wrote Romeo and Juliet?', a: 'William Shakespeare' },
  { q: 'What is the largest ocean on Earth?', a: 'The Pacific Ocean' },
];

const EIGHTBALL_RESPONSES = [
  'Yes, definitely.', 'It is decidedly so.', 'Without a doubt.', 'Ask again later.',
  'Cannot predict now.', "Don't count on it.", 'My reply is no.', 'Outlook not so good.',
  'Signs point to yes.', 'Very doubtful.',
];

function renderBoard(board) {
  const s = board.map((c, i) => c || String(i + 1));
  return `${s[0]} | ${s[1]} | ${s[2]}\n${s[3]} | ${s[4]} | ${s[5]}\n${s[6]} | ${s[7]} | ${s[8]}`;
}

function checkWinner(board) {
  const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[b] === board[c]) return board[a];
  }
  return board.every(Boolean) ? 'draw' : null;
}

module.exports = [
  {
    name: '8ball',
    description: 'Ask the magic 8-ball a question — .8ball will I win?',
    category: 'games',
    async execute({ sock, from, text }) {
      if (!text) return sock.sendMessage(from, { text: 'Ask a question, e.g. .8ball will I win the lottery?' });
      const answer = EIGHTBALL_RESPONSES[Math.floor(Math.random() * EIGHTBALL_RESPONSES.length)];
      await sock.sendMessage(from, { text: `🎱 ${answer}` });
    },
  },

  {
    name: 'flip',
    aliases: ['coinflip'],
    description: 'Flip a coin',
    category: 'games',
    async execute({ sock, from }) {
      const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
      await sock.sendMessage(from, { text: `🪙 ${result}` });
    },
  },

  {
    name: 'dice',
    description: 'Roll a die (1-6)',
    category: 'games',
    async execute({ sock, from }) {
      const roll = Math.floor(Math.random() * 6) + 1;
      await sock.sendMessage(from, { text: `🎲 You rolled a ${roll}` });
    },
  },

  {
    name: 'rate',
    description: 'Rate anything out of 10 — .rate pineapple on pizza',
    category: 'games',
    async execute({ sock, from, text }) {
      if (!text) return sock.sendMessage(from, { text: 'Usage: .rate <anything>' });
      const score = Math.floor(Math.random() * 11);
      await sock.sendMessage(from, { text: `I'd rate "${text}" a ${score}/10.` });
    },
  },

  {
    name: 'riddle',
    description: 'Get a random riddle, then .answer to reveal it',
    category: 'games',
    async execute({ sock, from }) {
      const pick = RIDDLES[Math.floor(Math.random() * RIDDLES.length)];
      pendingAnswers.set(from, pick.a);
      await sock.sendMessage(from, { text: `🧩 ${pick.q}\n\nType .answer to reveal it.` });
    },
  },

  {
    name: 'trivia',
    description: 'Get a random trivia question, then .answer to reveal it',
    category: 'games',
    async execute({ sock, from }) {
      const pick = TRIVIA[Math.floor(Math.random() * TRIVIA.length)];
      pendingAnswers.set(from, pick.a);
      await sock.sendMessage(from, { text: `❓ ${pick.q}\n\nType .answer to reveal it.` });
    },
  },

  {
    name: 'answer',
    description: 'Reveal the answer to the last riddle/trivia in this chat',
    category: 'games',
    async execute({ sock, from }) {
      const ans = pendingAnswers.get(from);
      if (!ans) return sock.sendMessage(from, { text: 'No pending riddle/trivia here. Try .riddle or .trivia first.' });
      pendingAnswers.delete(from);
      await sock.sendMessage(from, { text: `💡 Answer: ${ans}` });
    },
  },

  {
    name: 'tictactoe',
    aliases: ['ttt'],
    description: 'Play tic-tac-toe — .tictactoe @opponent to start, .tictactoe <1-9> to move',
    category: 'games',
    async execute({ sock, msg, from, args, sender }) {
      const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

      if (mentioned) {
        if (ttGames.has(from)) return sock.sendMessage(from, { text: 'A game is already in progress here — finish it first.' });
        if (mentioned === sender) return sock.sendMessage(from, { text: "You can't play against yourself." });
        ttGames.set(from, { board: Array(9).fill(null), players: [sender, mentioned], turn: 'X' });
        return sock.sendMessage(from, {
          text: `🎮 Tic-tac-toe started!\n@${sender.split('@')[0]} is X, @${mentioned.split('@')[0]} is O.\n\n${renderBoard(Array(9).fill(null))}\n\n@${sender.split('@')[0]}'s turn — .tictactoe <1-9>`,
          mentions: [sender, mentioned],
        });
      }

      const game = ttGames.get(from);
      if (!game) return sock.sendMessage(from, { text: 'No game in progress. Start one with .tictactoe @opponent' });

      const currentPlayerJid = game.turn === 'X' ? game.players[0] : game.players[1];
      if (sender !== currentPlayerJid) return sock.sendMessage(from, { text: "It's not your turn." });

      const pos = parseInt(args[0], 10);
      if (!pos || pos < 1 || pos > 9 || game.board[pos - 1]) {
        return sock.sendMessage(from, { text: 'Pick an empty square 1-9, e.g. .tictactoe 5' });
      }

      game.board[pos - 1] = game.turn;
      const result = checkWinner(game.board);
      if (result) {
        ttGames.delete(from);
        const boardText = renderBoard(game.board);
        if (result === 'draw') return sock.sendMessage(from, { text: `${boardText}\n\nIt's a draw!` });
        const winnerJid = result === 'X' ? game.players[0] : game.players[1];
        return sock.sendMessage(from, { text: `${boardText}\n\n🏆 @${winnerJid.split('@')[0]} wins!`, mentions: [winnerJid] });
      }

      game.turn = game.turn === 'X' ? 'O' : 'X';
      const nextJid = game.turn === 'X' ? game.players[0] : game.players[1];
      await sock.sendMessage(from, { text: `${renderBoard(game.board)}\n\n@${nextJid.split('@')[0]}'s turn`, mentions: [nextJid] });
    },
  },
];
