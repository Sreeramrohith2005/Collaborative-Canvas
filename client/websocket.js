export function connectWS({ room, onLatency }) {
  const socket = io({ query: { room } });

  // Simple latency ping
  let lastPing = 0;
  setInterval(() => { lastPing = performance.now(); socket.volatile.emit('ping:rt'); }, 2000);
  socket.on('pong:rt', () => { const ms = Math.round(performance.now() - lastPing); onLatency?.(ms); });
  socket.on('connect', () => onLatency?.(0));

  socket.onAny((event) => { /* could log */ });
  socket.on('state:init', (payload) => socket.emit('pong:rt'));

  return {
    on: (ev, fn) => socket.on(ev, fn),
    emit: (ev, payload, ack) => socket.emit(ev, payload, ack)
  };
}
