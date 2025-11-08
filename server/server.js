const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createRoomsManager } = require('./rooms');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 3000;

// --- Static client
app.use(express.static(path.join(__dirname, '..', 'client')));
app.use(express.json());

// --- Simple code generator (6 chars, no ambiguous chars) – no external deps
function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

// --- In-memory registry just to “reserve” codes (optional)
const createdRooms = new Set();

// Create a room code (client will redirect to /?room=CODE)
app.post('/api/rooms', (_req, res) => {
  let code;
  do { code = makeCode(); } while (createdRooms.has(code));
  createdRooms.add(code);
  res.json({
    roomId: code,
    url: `/?room=${code}`,
    short: `/r/${code}`
  });
});

// Short join link -> redirect
app.get('/r/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  res.redirect(`/?room=${code}`);
});

// Health
app.get('/health', (_req, res) => res.status(200).send('ok'));

const rooms = createRoomsManager();

io.on('connection', (socket) => {
  // Join a room (optional ?room=ROOM_ID)
  const roomId = (socket.handshake.query.room || 'LOBBY').toString().toUpperCase();

  // Allow ad-hoc codes if someone typed a new one directly
  createdRooms.add(roomId);

  const user = rooms.addUser(roomId, socket.id);
  socket.join(roomId);

  // Initial state to newcomer
  const snapshot = rooms.getSnapshot(roomId);
  socket.emit('state:init', { snapshot, self: user });

  // Tell others
  socket.to(roomId).emit('presence:join', { user });

  // latency ping/pong
  socket.on('ping:rt', () => socket.emit('pong:rt'));

  // Cursor updates (throttled on client)
  socket.on('cursor:update', (payload) => {
    socket.to(roomId).emit('cursor:update', { userId: socket.id, ...payload });
  });

  // Live stroke stream
  socket.on('stroke:start', (payload) => {
    socket.to(roomId).emit('stroke:peerStart', { userId: socket.id, ...payload });
  });
  socket.on('stroke:point', (payload) => {
    socket.to(roomId).emit('stroke:peerPoint', { userId: socket.id, ...payload });
  });
  socket.on('stroke:end', (payload, ack) => {
    const op = rooms.appendOperation(roomId, {
      kind: 'stroke',
      userId: socket.id,
      tool: payload.tool,
      color: payload.color,
      width: payload.width,
      points: payload.points,
      ts: Date.now(),
      id: payload.clientOpId || `${socket.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`
    });
    if (typeof ack === 'function') ack({ ok: true, serverOpId: op.id });
    io.to(roomId).emit('op:append', { op });
  });

  // Global undo/redo
  socket.on('history:undo', () => {
    const change = rooms.undo(roomId);
    if (change) io.to(roomId).emit('state:sync', rooms.getSnapshot(roomId));
  });
  socket.on('history:redo', () => {
    const change = rooms.redo(roomId);
    if (change) io.to(roomId).emit('state:sync', rooms.getSnapshot(roomId));
  });

  // Clear
  socket.on('canvas:clear', () => {
    rooms.clear(roomId);
    io.to(roomId).emit('state:sync', rooms.getSnapshot(roomId));
  });

  socket.on('disconnect', () => {
    rooms.removeUser(roomId, socket.id);
    socket.to(roomId).emit('presence:leave', { userId: socket.id });
  });
});

server.listen(PORT, () => {
  console.log(`Server on http://localhost:${PORT}`);
});
