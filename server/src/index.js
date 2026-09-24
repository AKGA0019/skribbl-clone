const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');
const RoomManager = require('./RoomManager');

const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] }
});
const rooms = new RoomManager();

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'skribbl-clone-server' }));
app.get('/api/rooms', (_req, res) => res.json(rooms.publicRooms()));

function settingsFrom(input = {}) {
  const clamp = (n, min, max, fallback) => {
    const value = Number(n);
    return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
  };
  return {
    maxPlayers: clamp(input.maxPlayers, 2, 20, 8),
    rounds: clamp(input.rounds, 2, 10, 3),
    drawTime: clamp(input.drawTime, 15, 240, 60),
    wordCount: clamp(input.wordCount, 1, 5, 3),
    hints: clamp(input.hints, 0, 5, 2),
    private: Boolean(input.private)
  };
}

function roomState(room) {
  return room.snapshot();
}

function emitState(room) {
  const state = roomState(room);
  io.to(room.id).emit('room_state', state);
  if (room.game.drawer) {
    const privateGame = { ...state.game };
    if (room.game.phase === 'choosing') privateGame.wordOptions = room.game.wordOptions.map((x) => ({ word: x.word, category: x.category }));
    if (room.game.phase === 'drawing') privateGame.word = room.game.word;
    io.to(room.game.drawer.id).emit('room_state', { ...state, game: privateGame });
  }
  if (room.game.phase === 'drawing') io.to(room.id).emit('timer', { remaining: room.game.getRemaining() });
}

function sendError(socket, message) {
  socket.emit('app_error', { message });
}

function requireRoom(socket) {
  const room = rooms.get(socket.data.roomId);
  if (!room) {
    sendError(socket, 'Room no longer exists.');
    return null;
  }
  return room;
}

io.on('connection', (socket) => {
  socket.on('create_room', ({ hostName, settings } = {}) => {
    try {
      const name = String(hostName || '').trim().slice(0, 20);
      if (!name) return sendError(socket, 'Enter a player name.');
      const room = rooms.create(socket.id, name, settingsFrom(settings));
      socket.join(room.id);
      socket.data.roomId = room.id;
      socket.data.playerId = socket.id;
      socket.emit('room_created', { roomId: room.id });
      emitState(room);
    } catch (error) {
      sendError(socket, error.message || 'Could not create room.');
    }
  });

  socket.on('join_room', ({ roomId, playerName } = {}) => {
    try {
      const room = rooms.get(roomId);
      const name = String(playerName || '').trim().slice(0, 20);
      if (!room) return sendError(socket, 'Room not found. Check the code.');
      if (!name) return sendError(socket, 'Enter a player name.');
      const player = room.addPlayer(socket.id, name);
      socket.join(room.id);
      socket.data.roomId = room.id;
      socket.data.playerId = player.id;
      room.addChat(null, `${name} joined the room.`, true);
      io.to(room.id).emit('chat_message', room.chat[room.chat.length - 1]);
      emitState(room);
    } catch (error) {
      sendError(socket, error.message || 'Could not join room.');
    }
  });

  socket.on('get_public_rooms', () => socket.emit('public_rooms', rooms.publicRooms()));

  socket.on('start_game', () => {
    const room = requireRoom(socket);
    if (!room) return;
    if (room.hostId !== socket.id) return sendError(socket, 'Only the host can start the game.');
    if (room.players.length < 2) return sendError(socket, 'At least 2 players are required.');
    room.game.begin();
    emitRoundStart(room);
  });

  socket.on('word_chosen', ({ word } = {}) => {
    const room = requireRoom(socket);
    if (!room) return;
    if (room.game.drawer?.id !== socket.id) return sendError(socket, 'Only the drawer can choose a word.');
    if (!room.game.chooseWord(String(word || ''))) return sendError(socket, 'That word is not available.');
    io.to(room.id).emit('word_chosen_ack', { drawerId: socket.id });
    emitState(room);
  });

  socket.on('draw_start', (stroke = {}) => handleDrawing(socket, 'start', stroke));
  socket.on('draw_move', (stroke = {}) => handleDrawing(socket, 'move', stroke));
  socket.on('draw_end', () => {
    const room = requireRoom(socket);
    if (!room || room.game.drawer?.id !== socket.id || room.game.phase !== 'drawing') return;
    socket.to(room.id).emit('draw_end');
  });

  socket.on('canvas_clear', () => {
    const room = requireRoom(socket);
    if (!room || room.game.drawer?.id !== socket.id) return;
    room.game.strokes = [];
    io.to(room.id).emit('canvas_clear');
  });

  socket.on('draw_undo', () => {
    const room = requireRoom(socket);
    if (!room || room.game.drawer?.id !== socket.id || room.game.phase !== 'drawing') return;
    const strokes = room.game.strokes;
    let start = -1;
    for (let i = strokes.length - 1; i >= 0; i -= 1) {
      if (strokes[i].type === 'start') { start = i; break; }
    }
    if (start >= 0) room.game.strokes.splice(start);
    io.to(room.id).emit('canvas_state', room.game.strokes);
  });

  socket.on('guess', ({ text } = {}) => {
    const room = requireRoom(socket);
    if (!room) return;
    const player = room.getPlayer(socket.id);
    const guess = String(text || '').trim().slice(0, 80);
    if (!player || !guess || room.game.phase !== 'drawing') return;
    const result = room.game.checkGuess(player, guess);
    io.to(room.id).emit('guess_result', { correct: result.correct, playerId: player.id, playerName: player.name, points: result.points, text: guess });
    if (!result.correct) {
      const message = room.addChat(player, guess, false);
      io.to(room.id).emit('chat_message', message);
    } else {
      const message = room.addChat(null, `${player.name} guessed the word!`, true);
      io.to(room.id).emit('chat_message', message);
      emitState(room);
    }
  });

  socket.on('chat', ({ text } = {}) => {
    const room = requireRoom(socket);
    if (!room) return;
    const player = room.getPlayer(socket.id);
    const messageText = String(text || '').trim().slice(0, 160);
    if (!player || !messageText) return;
    const message = room.addChat(player, messageText, false);
    io.to(room.id).emit('chat_message', message);
  });

  socket.on('disconnect', () => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    const player = room.getPlayer(socket.id);
    if (player) {
      room.removePlayer(socket.id);
      io.to(room.id).emit('player_left', { playerId: socket.id, players: room.players.map((p) => ({ id: p.id, name: p.name, score: p.score, isHost: p.isHost, ready: p.ready })) });
      room.addChat(null, `${player.name} left the room.`, true);
      io.to(room.id).emit('chat_message', room.chat[room.chat.length - 1]);
      if (room.game.phase !== 'lobby' && room.players.length < 2) {
        room.game.clearTimer();
        room.game.phase = 'lobby';
        room.game.round = 0;
        room.game.word = null;
        room.game.wordOptions = [];
      }
      emitState(room);
    }
    rooms.deleteIfEmpty(room.id);
  });
});

function handleDrawing(socket, type, stroke) {
  const room = requireRoom(socket);
  if (!room || room.game.drawer?.id !== socket.id || room.game.phase !== 'drawing') return;
  const safe = {
    x: Number(stroke.x), y: Number(stroke.y),
    px: Number.isFinite(Number(stroke.px)) ? Number(stroke.px) : Number(stroke.x),
    py: Number.isFinite(Number(stroke.py)) ? Number(stroke.py) : Number(stroke.y),
    color: String(stroke.color || '#111827').slice(0, 20),
    size: Math.min(40, Math.max(1, Number(stroke.size) || 4)),
    tool: stroke.tool === 'eraser' ? 'eraser' : 'pen'
  };
  if (!Number.isFinite(safe.x) || !Number.isFinite(safe.y)) return;
  if (type === 'start') room.game.strokes.push({ ...safe, type: 'start' });
  else if (type === 'move') room.game.strokes.push({ ...safe, type: 'move' });
  socket.to(room.id).emit('draw_data', { ...safe, type });
}

function emitRoundStart(room) {
  const drawer = room.game.drawer;
  if (!drawer) return;
  io.to(room.id).emit('round_start', {
    drawerId: drawer.id,
    drawerName: drawer.name,
    wordOptions: [],
    drawTime: room.settings.drawTime,
    round: room.game.round,
    totalRounds: room.settings.rounds
  });
  io.to(drawer.id).emit('round_start', {
    drawerId: drawer.id,
    drawerName: drawer.name,
    wordOptions: room.game.wordOptions.map((x) => ({ word: x.word, category: x.category })),
    drawTime: room.settings.drawTime,
    round: room.game.round,
    totalRounds: room.settings.rounds
  });
  emitState(room);
}

// Game transition watcher. It is deliberately server-side so clients cannot control round timing.
setInterval(() => {
  for (const room of rooms.rooms.values()) {
    if (room.game.phase === 'choosing' && room.game.wordOptions.length && !room.game.startedAt) {
      // Waiting for drawer selection. No automatic transition.
    }
    if (room.game.phase === 'drawing') {
      const remaining = room.game.getRemaining();
      io.to(room.id).emit('timer', { remaining });
      const elapsed = room.settings.drawTime - remaining;
      const hintLimit = room.settings.hints;
      const revealEvery = hintLimit > 0 ? room.settings.drawTime / (hintLimit + 1) : Infinity;
      const targetHints = Math.min(hintLimit, Math.floor(elapsed / revealEvery));
      let hintChanged = false;
      while (room.game.hints.length < targetHints) {
        const before = room.game.hints.length;
        room.game.addHint();
        hintChanged = hintChanged || room.game.hints.length > before;
        if (room.game.hints.length === before) break;
      }
      if (hintChanged) emitState(room);
      if (remaining <= 0) room.game.endRound('time');
    }
    if (room.game.phase === 'round_end' && !room.game.roundEndEmitted) {
      room.game.roundEndEmitted = true;
      io.to(room.id).emit('round_end', {
        word: room.game.word,
        reason: 'round_complete',
        scores: room.players.map((p) => ({ id: p.id, name: p.name, score: p.score })),
        nextDrawer: null
      });
      emitState(room);
    }
    if (room.game.phase === 'game_over' && !room.game.gameOverEmitted) {
      room.game.gameOverEmitted = true;
      io.to(room.id).emit('game_over', {
        winner: [...room.players].sort((a, b) => b.score - a.score)[0] || null,
        leaderboard: room.players.map((p) => ({ id: p.id, name: p.name, score: p.score })).sort((a, b) => b.score - a.score)
      });
    }
    if (room.game.phase === 'choosing' && room.game.round > 0 && room.game.wordOptions.length) {
      if (room.game.lastAnnouncedRound !== room.game.round) {
        room.game.lastAnnouncedRound = room.game.round;
        emitRoundStart(room);
      }
    }
  }
}, 1000);

// Serve built frontend when deployed as one service.
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => err && next(err));
});

server.listen(PORT, () => console.log(`Skribbl server running on port ${PORT}`));
