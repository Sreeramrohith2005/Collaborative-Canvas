import { connectWS } from './websocket.js';
import { createCanvas } from './canvas.js';

const params = new URLSearchParams(location.search);
const room = (params.get('room') || '').toUpperCase();

const landing = document.getElementById('landing');
const controls = document.getElementById('controls');
const usersPane = document.getElementById('users');
const stage = document.getElementById('stage');

if (!room) {
  // --- LANDING MODE ---
  landing.style.display = 'block';

  const createBtn = document.getElementById('createBtn');
  const createdInfo = document.getElementById('createdInfo');
  const joinBtn = document.getElementById('joinBtn');
  const joinCode = document.getElementById('joinCode');

  createBtn.onclick = async () => {
    const res = await fetch('/api/rooms', { method: 'POST' });
    const { roomId, url, short } = await res.json();
    createdInfo.style.display = 'block';
    createdInfo.textContent = `Created: ${roomId}. Opening…`;
    location.href = url; // redirect into the board
  };

  joinBtn.onclick = () => {
    const code = (joinCode.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code) return alert('Enter a room code.');
    location.href = `/?room=${code}`;
  };

  joinCode.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinBtn.click();
  });

} else {
  // --- BOARD MODE ---
  landing.style.display = 'none';
  controls.style.display = 'flex';
  usersPane.style.display = 'block';
  stage.style.display = 'grid';

  document.getElementById('room').textContent = `Room: ${room}`;
  const share = document.getElementById('share');
  const url = new URL(location.href);
  url.search = `?room=${room}`;
  share.textContent = `Share: ${url.toString()}`;
  share.style.cursor = 'pointer';
  share.title = 'Click to copy';
  share.onclick = async () => {
    try { await navigator.clipboard.writeText(url.toString()); share.textContent = 'Link copied!'; setTimeout(()=>share.textContent=`Share: ${url.toString()}`, 1400); } catch {}
  };

  const ui = {
    tool: document.getElementById('tool'),
    color: document.getElementById('color'),
    width: document.getElementById('width'),
    undo: document.getElementById('undo'),
    redo: document.getElementById('redo'),
    clear: document.getElementById('clear'),
    userList: document.getElementById('userList'),
    latency: document.getElementById('latency')
  };

  const canvasEl = document.getElementById('canvas');
  const canvas = createCanvas(canvasEl);

  const ws = connectWS({ room, onLatency: (ms)=> ui.latency.textContent = `⏱️ ${ms} ms` });

  // Initial state
  ws.on('state:init', ({ snapshot, self }) => {
    ui.color.value = hslToHex(self.color);
    renderUsers(snapshot.users);
    canvas.loadOps(snapshot.ops);
  });

  // Presence updates
  ws.on('presence:join', ({ user }) => renderAddUser(user));
  ws.on('presence:leave', ({ userId }) => document.getElementById(`u-${userId}`)?.remove());

  ws.on('op:append', ({ op }) => canvas.applyOp(op));
  ws.on('state:sync', (snapshot) => { renderUsers(snapshot.users); canvas.loadOps(snapshot.ops); });

  // Remote cursors + live previews
  ws.on('cursor:update', ({ userId, x, y, color }) => canvas.showCursor(userId, x, y, color));
  ws.on('stroke:peerStart', (msg) => canvas.peerStart(msg));
  ws.on('stroke:peerPoint', (msg) => canvas.peerPoint(msg));

  // UI events
  ui.undo.onclick = () => ws.emit('history:undo');
  ui.redo.onclick = () => ws.emit('history:redo');
  ui.clear.onclick = () => ws.emit('canvas:clear');

  // Shortcuts
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); ws.emit('history:undo'); }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); ws.emit('history:redo'); }
  });

  // Drawing interactions
  canvas.onDraw((event) => {
    if (event.phase === 'start') {
      ws.emit('stroke:start', { tool: tool(), color: color(), width: width(), x: event.point.x, y: event.point.y });
    } else if (event.phase === 'point') {
      ws.emit('stroke:point', { x: event.point.x, y: event.point.y });
    } else if (event.phase === 'end') {
      ws.emit('stroke:end', {
        clientOpId: event.clientOpId,
        tool: tool(),
        color: color(),
        width: width(),
        points: event.livePoints
      }, (ack) => canvas.reconcileOpId(event.clientOpId, ack?.serverOpId));
    }
  });

  // Cursor broadcast (throttled inside canvas)
  canvas.onCursor(({ x, y }) => ws.emit('cursor:update', { x, y, color: color() }));

  function tool() { return ui.tool.value; }
  function color() { return ui.color.value; }
  function width() { return Number(ui.width.value); }

  function renderUsers(users) {
    ui.userList.innerHTML = '';
    users.forEach(renderAddUser);
  }
  function renderAddUser(user) {
    const li = document.createElement('li');
    li.id = `u-${user.id}`;
    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = user.color;
    const label = document.createElement('span');
    label.textContent = user.name;
    li.appendChild(sw); li.appendChild(label);
    ui.userList.appendChild(li);
  }

  function hslToHex(hsl) {
    const m = /hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/.exec(hsl);
    if (!m) return '#22d3ee';
    let [h, s, l] = [Number(m[1])/360, Number(m[2])/100, Number(m[3])/100];
    const hue2rgb = (p, q, t) => { if (t<0) t+=1; if (t>1) t-=1; if (t<1/6) return p+(q-p)*6*t; if (t<1/2) return q; if (t<2/3) return p+(q-p)*(2/3-t)*6; return p; };
    const q = l < 0.5 ? l*(1+s) : l + s - l*s; const p = 2*l - q;
    const r = Math.round(hue2rgb(p,q,h+1/3)*255);
    const g = Math.round(hue2rgb(p,q,h)*255);
    const b = Math.round(hue2rgb(p,q,h-1/3)*255);
    return '#' + [r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');
  }
}
