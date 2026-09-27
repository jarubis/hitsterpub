const path = require("path");
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.use("/audio", express.static(path.join(__dirname, "audio")));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const rooms = new Map();
const MAX_PLAYERS = 4;
const REVEAL_DELAY_MS = 3000;

function generateGameId() {
  let gameId;
  do {
    gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
  } while (rooms.has(gameId));
  return gameId;
}

function getPublicPlayers(room) {
  return room.players.map((player) => ({
    id: player.id,
    name: player.name,
    score: player.score,
    timeline: player.timeline,
  }));
}

function broadcastPlayers(gameId) {
  const room = rooms.get(gameId);
  if (!room) return;
  io.to(gameId).emit("players_updated", getPublicPlayers(room));
}

function getCurrentSong(room) {
  return room.songs[room.currentSongIndex];
}

function currentTurnPlayerId(room) {
  return room.turnOrder[room.currentTurnIndex] ?? null;
}

function correctIndexFor(year, timeline) {
  let index = 0;
  while (index < timeline.length && timeline[index].year < year) {
    index += 1;
  }
  return index;
}

function removeFromTurnOrder(room, playerId) {
  if (!room.turnOrder) return;
  const idx = room.turnOrder.indexOf(playerId);
  if (idx === -1) return;

  const wasCurrentTurn = idx === room.currentTurnIndex;
  room.turnOrder.splice(idx, 1);
  if (room.turnOrder.length === 0) return;

  if (idx < room.currentTurnIndex) room.currentTurnIndex -= 1;
  room.currentTurnIndex = room.currentTurnIndex % room.turnOrder.length;

  if (wasCurrentTurn && room.started && !room.roundFinished) {
    room.roundFinished = true;
  }
}

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("create_game", (callback) => {
    const gameId = generateGameId();

    const room = {
      id: gameId,
      hostId: socket.id,
      players: [],
      songs: [],
      currentSongIndex: 0,
      turnOrder: [],
      currentTurnIndex: 0,
      started: false,
      roundFinished: false,
    };

    rooms.set(gameId, room);
    socket.join(gameId);

    room.players.push({ id: socket.id, name: "Host", score: 0, timeline: [] });
    socket.data.gameId = gameId;

    callback({ success: true, gameId, isHost: true });
    broadcastPlayers(gameId);

    console.log(`Game created: ${gameId}`);
  });

  socket.on("set_host_name", ({ gameId, username }, callback) => {
    const room = rooms.get(gameId);
    if (!room) return callback?.({ success: false, message: "Game does not exist" });
    if (room.hostId !== socket.id) return callback?.({ success: false, message: "Only the host can do this" });

    const host = room.players.find((player) => player.id === socket.id);
    if (host) host.name = username || "Host";

    callback?.({ success: true });
    broadcastPlayers(gameId);
  });

  socket.on("set_songs", ({ gameId, songs }, callback) => {
    const room = rooms.get(gameId);
    if (!room) return callback?.({ success: false, message: "Game does not exist" });
    if (room.hostId !== socket.id) return callback?.({ success: false, message: "Only the host can select songs" });
    if (!Array.isArray(songs) || songs.length === 0) {
      return callback?.({ success: false, message: "At least one song is required" });
    }

    room.songs = songs;
    room.currentSongIndex = 0;

    callback?.({ success: true, songCount: songs.length });
    io.to(gameId).emit("game_ready", { songCount: songs.length });
  });

  socket.on("join_game", ({ gameId, username }, callback) => {
    const normalizedGameId = String(gameId || "").trim().toUpperCase();
    const normalizedUsername = String(username || "").trim();
    const room = rooms.get(normalizedGameId);

    if (!room) return callback({ success: false, message: "Game not found" });
    if (!normalizedUsername) return callback({ success: false, message: "Username is required" });
    if (room.started) return callback({ success: false, message: "The game has already started" });
    if (room.players.length >= MAX_PLAYERS) {
      return callback({ success: false, message: `Room is full (max ${MAX_PLAYERS} players)` });
    }

    const duplicateName = room.players.some(
      (player) => player.name.toLowerCase() === normalizedUsername.toLowerCase()
    );
    if (duplicateName) return callback({ success: false, message: "That username is already being used" });

    socket.join(normalizedGameId);
    socket.data.gameId = normalizedGameId;

    room.players.push({ id: socket.id, name: normalizedUsername, score: 0, timeline: [] });

    callback({ success: true, gameId: normalizedGameId, isHost: room.hostId === socket.id });
    broadcastPlayers(normalizedGameId);
  });

  socket.on("start_game", ({ gameId }, callback) => {
    const room = rooms.get(gameId);
    if (!room) return callback?.({ success: false, message: "Game not found" });
    if (room.hostId !== socket.id) return callback?.({ success: false, message: "Only the host can start the game" });
    if (room.songs.length === 0) return callback?.({ success: false, message: "No songs have been selected" });
    if (room.players.length === 0) return callback?.({ success: false, message: "No players in the room" });

    room.started = true;
    room.currentSongIndex = 0;
    room.roundFinished = false;
    room.turnOrder = room.players.map((player) => player.id);
    room.currentTurnIndex = 0;
    room.players.forEach((player) => {
      player.timeline = [];
      player.score = 0;
    });

    io.to(gameId).emit("new_song", {
      song: getCurrentSong(room),
      currentTurnPlayerId: currentTurnPlayerId(room),
    });
    broadcastPlayers(gameId);

    callback?.({ success: true });
  });

  socket.on("card_drag", ({ gameId, lx, loutward, y, index }) => {
    const room = rooms.get(gameId);
    if (!room || !room.started || room.roundFinished) return;
    if (socket.id !== currentTurnPlayerId(room)) return;

    socket.to(gameId).emit("card_drag", { lx, loutward, y, index });
  });

  socket.on("card_drawn", ({ gameId }) => {
    const room = rooms.get(gameId);
    if (!room || !room.started) return;
    if (socket.id !== currentTurnPlayerId(room)) return;

    socket.to(gameId).emit("card_drawn");
  });

  socket.on("audio_play", ({ gameId, time }) => {
    const room = rooms.get(gameId);
    if (!room || !room.started) return;
    if (socket.id !== currentTurnPlayerId(room)) return;

    socket.to(gameId).emit("audio_play", { time });
  });

  socket.on("audio_pause", ({ gameId }) => {
    const room = rooms.get(gameId);
    if (!room || !room.started) return;
    if (socket.id !== currentTurnPlayerId(room)) return;

    socket.to(gameId).emit("audio_pause");
  });

  socket.on("submit_placement", ({ gameId, index }, callback) => {
    const room = rooms.get(gameId);
    if (!room) return callback?.({ success: false, message: "Game not found" });
    if (!room.started) return callback?.({ success: false, message: "The game has not started" });
    if (room.roundFinished) return callback?.({ success: false, message: "This round is already over" });

    if (socket.id !== currentTurnPlayerId(room)) {
      return callback?.({ success: false, message: "It is not your turn" });
    }

    const player = room.players.find((item) => item.id === socket.id);
    if (!player) return callback?.({ success: false, message: "You are not in this room" });

    const numericIndex = Number(index);
    if (!Number.isInteger(numericIndex) || numericIndex < 0 || numericIndex > player.timeline.length) {
      return callback?.({ success: false, message: "Invalid placement" });
    }

    callback?.({ success: true });
    evaluateTurn(gameId, numericIndex);
  });

  socket.on("disconnect", () => {
    const gameId = socket.data.gameId;
    const room = rooms.get(gameId);
    if (!room) return;

    room.players = room.players.filter((player) => player.id !== socket.id);
    removeFromTurnOrder(room, socket.id);

    if (room.players.length === 0) {
      rooms.delete(gameId);
      return;
    }

    if (room.hostId === socket.id) {
      room.hostId = room.players[0].id;
      io.to(gameId).emit("host_changed", { hostId: room.hostId });
    }

    broadcastPlayers(gameId);

    if (room.started && room.roundFinished) {
      // The disconnecting player was mid-turn (or a reveal was already in
      // flight) — nobody is going to submit a placement for this round, so
      // move the game on instead of leaving everyone stuck waiting.
      // advanceRound() is idempotent (it bails if roundFinished is already
      // false), so this is safe even if a normal evaluateTurn timeout is
      // also pending.
      advanceRound(gameId);
    } else if (room.started) {
      io.to(gameId).emit("turn_update", {
        currentTurnPlayerId: currentTurnPlayerId(room),
        roundFinished: room.roundFinished,
      });
    }
  });
});

function evaluateTurn(gameId, submittedIndex) {
  const room = rooms.get(gameId);
  if (!room || room.roundFinished) return;

  room.roundFinished = true;

  const song = getCurrentSong(room);
  const playerId = currentTurnPlayerId(room);
  const player = room.players.find((item) => item.id === playerId);
  if (!player) return;

  const correctIndex = correctIndexFor(song.year, player.timeline);
  const correct = submittedIndex === correctIndex;

  if (correct) {
    player.timeline.splice(correctIndex, 0, {
      songId: song.id,
      name: song.name,
      artist: song.artist,
      year: song.year,
      image: song.image,
    });
    player.score += 1;
  }

  io.to(gameId).emit("round_results", {
    actualYear: song.year,
    song,
    result: {
      playerId: player.id,
      playerName: player.name,
      submittedIndex,
      correctIndex,
      correct,
      points: correct ? 1 : 0,
    },
    players: getPublicPlayers(room),
  });

  setTimeout(() => advanceRound(gameId), REVEAL_DELAY_MS);
}

function advanceRound(gameId) {
  const room = rooms.get(gameId);
  if (!room || !room.roundFinished || room.turnOrder.length === 0) return;

  room.currentSongIndex += 1;

  if (room.currentSongIndex >= room.songs.length) {
    const winners = [...room.players].sort((a, b) => b.score - a.score).slice(0, 3);
    io.to(gameId).emit("game_end", {
      winners: getPublicPlayers({ players: winners }),
      players: getPublicPlayers(room),
    });
    rooms.delete(gameId);
    return;
  }

  room.currentTurnIndex = (room.currentTurnIndex + 1) % room.turnOrder.length;
  room.roundFinished = false;

  io.to(gameId).emit("new_song", {
    song: getCurrentSong(room),
    currentTurnPlayerId: currentTurnPlayerId(room),
  });
}

app.get("/", (req, res) => {
  res.send("Hitster server is running");
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});