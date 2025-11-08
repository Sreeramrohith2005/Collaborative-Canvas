const { createDrawingState } = require('./drawing-state');

function createRoomsManager() {
  /** @type {Record<string, { users: Record<string, any>, state: ReturnType<typeof createDrawingState> }>} */
  const rooms = {};

  function ensure(roomId) {
    if (!rooms[roomId]) {
      rooms[roomId] = {
        users: {},
        state: createDrawingState()
      };
    }
    return rooms[roomId];
  }

  function addUser(roomId, socketId) {
    const room = ensure(roomId);
    const color = randomColor();
    const user = { id: socketId, color, name: shortId(socketId) };
    room.users[socketId] = user;
    return user;
  }

  function removeUser(roomId, socketId) {
    const room = ensure(roomId);
    const user = room.users[socketId];
    delete room.users[socketId];
    return user;
  }

  function getSnapshot(roomId) {
    const room = ensure(roomId);
    return {
      users: Object.values(room.users),
      ops: room.state.getOps(),
      redo: room.state.getRedoOps()
    };
  }

  return {
    addUser,
    removeUser,
    getSnapshot,
    appendOperation(roomId, op) {
      const room = ensure(roomId);
      return room.state.append(op);
    },
    undo(roomId) { return ensure(roomId).state.undo(); },
    redo(roomId) { return ensure(roomId).state.redo(); },
    clear(roomId) { return ensure(roomId).state.clear(); }
  };
}

function randomColor() {
  const hues = [0, 30, 60, 120, 180, 210, 240, 270, 300];
  const h = hues[Math.floor(Math.random() * hues.length)];
  const s = 70 + Math.floor(Math.random() * 20);
  const l = 50;
  return `hsl(${h} ${s}% ${l}%)`;
}

function shortId(id) {
  return id.slice(0, 4) + '…' + id.slice(-2);
}

module.exports = { createRoomsManager };
