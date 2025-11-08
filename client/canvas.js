export function createCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const preview = document.createElement('canvas'); // peer live strokes
  preview.width = canvas.width; preview.height = canvas.height;
  const pctx = preview.getContext('2d');

  // Remote cursors overlay
  const cursorLayer = document.createElement('div');
  cursorLayer.style.position = 'relative';
  cursorLayer.style.width = canvas.width + 'px';
  cursorLayer.style.height = canvas.height + 'px';
  canvas.parentElement.style.position = 'relative';
  canvas.parentElement.appendChild(cursorLayer);
  canvas.parentElement.appendChild(preview);
  preview.style.position = 'absolute';
  preview.style.left = canvas.offsetLeft + 'px';
  preview.style.top = canvas.offsetTop + 'px';
  preview.style.pointerEvents = 'none';

  /** @type {Array<any>} */
  let ops = [];

  // Local drawing state
  let drawing = false;
  let livePoints = [];
  let tool = 'brush';
  let color = '#22d3ee';
  let width = 6;
  let clientOpId = null;

  const listeners = { draw: [], cursor: [] };
  const onDraw = (fn) => listeners.draw.push(fn);
  const onCursor = (fn) => listeners.cursor.push(fn);

  function setStyleFor(tool, color, width, targetCtx) {
    targetCtx.lineCap = 'round';
    targetCtx.lineJoin = 'round';
    targetCtx.lineWidth = width;
    if (tool === 'eraser') {
      targetCtx.globalCompositeOperation = 'destination-out';
      targetCtx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      targetCtx.globalCompositeOperation = 'source-over';
      targetCtx.strokeStyle = color;
    }
  }

  function strokePath(points, tool, color, width, targetCtx) {
    if (points.length < 2) return;
    setStyleFor(tool, color, width, targetCtx);
    targetCtx.beginPath();
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      // Quadratic smoothing to p1 using midpoint
      const mx = (p0.x + p1.x) / 2;
      const my = (p0.y + p1.y) / 2;
      if (i === 0) targetCtx.moveTo(p0.x, p0.y);
      targetCtx.quadraticCurveTo(p0.x, p0.y, mx, my);
    }
    targetCtx.stroke();
  }

  function redrawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const op of ops) {
      if (op.kind === 'stroke') strokePath(op.points, op.tool, op.color, op.width, ctx);
    }
  }

  // Public state APIs
  function loadOps(newOps) {
    ops = newOps.slice();
    redrawAll();
  }
  function applyOp(op) {
    ops.push(op);
    if (op.kind === 'stroke') strokePath(op.points, op.tool, op.color, op.width, ctx);
  }

  // Peer live previews
  const peerLive = new Map();
  function peerStart({ userId, x, y, color, width, tool }) {
    peerLive.set(userId, { color, width, tool, points: [{ x, y }] });
  }
  function peerPoint({ userId, x, y }) {
    const stream = peerLive.get(userId);
    if (!stream) return;
    stream.points.push({ x, y });
    pctx.clearRect(0, 0, preview.width, preview.height);
    for (const { color, width, tool, points } of peerLive.values()) {
      strokePath(points, tool, color, width, pctx);
    }
  }

  // Cursor indicators
  const cursors = new Map();
  function showCursor(userId, x, y, color) {
    let el = cursors.get(userId);
    if (!el) {
      el = document.createElement('div');
      el.className = 'cursor';
      el.style.border = '1px solid rgba(255,255,255,0.5)';
      el.style.borderRadius = '50%';
      el.style.width = '10px';
      el.style.height = '10px';
      el.style.position = 'absolute';
      el.style.transform = 'translate(-50%, -50%)';
      const label = document.createElement('div');
      label.style.position = 'absolute';
      label.style.top = '12px';
      label.style.left = '0';
      label.style.fontSize = '10px';
      label.style.whiteSpace = 'nowrap';
      label.style.opacity = '0.8';
      el.appendChild(label);
      cursorLayer.appendChild(el);
      cursors.set(userId, el);
    }
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.background = color;
    el.firstChild.textContent = '';
  }

  // Local input handling
  const getTool = () => document.getElementById('tool').value;
  const getColor = () => document.getElementById('color').value;
  const getWidth = () => Number(document.getElementById('width').value);

  const toCanvasPoint = (evt) => {
    const rect = canvas.getBoundingClientRect();
    const x = (evt.clientX - rect.left) * (canvas.width / rect.width);
    const y = (evt.clientY - rect.top) * (canvas.height / rect.height);
    return { x, y, t: performance.now() };
  };

  function notifyCursor(pt) { listeners.cursor.forEach(fn => fn(pt)); }
  function notifyDraw(ev) { listeners.draw.forEach(fn => fn(ev)); }

  // Throttle cursor updates
  let lastCursorSent = 0;
  function onPointerMove(evt) {
    if (!drawing) {
      const pt = toCanvasPoint(evt);
      const now = performance.now();
      if (now - lastCursorSent > 33) { lastCursorSent = now; notifyCursor(pt); }
      return;
    }
    const pt = toCanvasPoint(evt);
    livePoints.push(pt);
    notifyDraw({ phase: 'point', point: pt });
    // optimistic local segment
    strokePath([livePoints[livePoints.length-2], pt], getTool(), getColor(), getWidth(), ctx);
  }

  function onPointerDown(evt) {
    drawing = true;
    tool = getTool(); color = getColor(); width = getWidth();
    livePoints = [toCanvasPoint(evt)];
    clientOpId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    notifyDraw({ phase: 'start', point: livePoints[0], clientOpId });
  }

  function onPointerUp(evt) {
    if (!drawing) return;
    drawing = false;
    notifyDraw({ phase: 'end', point: livePoints[livePoints.length-1], livePoints, clientOpId });
    livePoints = [];
    clientOpId = null;
    pctx.clearRect(0, 0, preview.width, preview.height);
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerUp);

  function reconcileOpId(localId, serverId) {
    // hook for dedup if you add local op cache
  }

  return {
    onDraw,
    onCursor,
    loadOps,
    applyOp,
    peerStart,
    peerPoint,
    showCursor,
    reconcileOpId
  };
}
