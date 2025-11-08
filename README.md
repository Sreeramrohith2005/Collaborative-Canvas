```md
# 🎨 Collaborative Canvas — Real-Time Drawing (Vanilla JS + Node.js)

A lightweight, production-ready starter for a **real-time collaborative drawing** app.  
Client is plain HTML/CSS/JS (Canvas 2D + Pointer Events). Server is Node.js + Express + Socket.IO.  
Supports rooms, presence, undo/redo, clear canvas, cursors, and optional chat. Ships with rate limiting and horizontal-scaling via Redis adapter.

---

## ✨ Features

- **Live multi-user drawing**: pen / eraser, color, width
- **Rooms**: share by URL `/room/:id`
- **Presence**: online list + remote cursors
- **Undo / Redo**: per client (broadcast to keep room in sync)
- **Clear Canvas**: room-wide reset
- **Optional chat** (toggle in UI)
- **Latency-tolerant streaming**: `stroke:begin` → `stroke:point`* → `stroke:end`
- **Rate limiting** + payload caps, basic abuse protection
- **Scale-out ready** using Redis pub/sub adapter

---

## 🧱 Tech Stack

- **Client:** Vanilla JS (Canvas 2D, Pointer Events, ES Modules)
- **Transport:** WebSocket (**Socket.IO**)
- **Server:** Node.js, Express, Socket.IO
- **Optional:** Redis (Socket.IO Redis adapter) for multi-instance deployments
- **Dev Tooling:** Nodemon, ESLint (optional)

---

## 📦 Project Structure

```

collaborative-canvas/
├── server/
│   ├── server.js           # HTTP + WebSocket server, routes, middleware
│   ├── roomState.js        # in-memory room registry + helpers
│   ├── rateLimit.js        # token bucket limiter per socket
│   └── adapters/
│       └── redis.js        # optional Socket.IO Redis adapter
├── public/
│   ├── index.html          # landing - create/join room
│   ├── room.html           # drawing room UI
│   ├── styles.css          # minimal styling
│   ├── client.js           # canvas logic (draw, undo/redo, presence, chat)
│   └── vendor/socket.io.min.js
├── .env.example
├── package.json
└── README.md

````

> If your filenames differ, adjust imports accordingly.

---

## ⚙️ Setup

```bash
git clone <your-repo>
cd collaborative-canvas
cp .env.example .env        # then edit
npm install
npm run dev                 # http://localhost:3000
````

### `.env` (Environment Variables)

```env
PORT=3000
NODE_ENV=development

# Room + client limits
MAX_ROOM_SIZE=32
MAX_UNDO_STACK=50

# Socket rate limiting (token bucket)
RATE_LIMIT_POINTS=400       # tokens per minute per socket
RATE_LIMIT_BURST=80         # maximum instant burst

# CORS / security
ALLOWED_ORIGINS=http://localhost:3000

# Scale-out (optional)
REDIS_URL=redis://localhost:6379
```

---

## ▶️ Usage

1. Visit **`http://localhost:3000`**
2. Create a room or paste an existing room link, e.g.
   `http://localhost:3000/room/abc123`
3. Draw together! Multiple tabs/browsers will sync.

### Default Controls

* **Pen / Eraser**: toolbar toggle
* **Color / Width**: toolbar inputs
* **Undo**: `Ctrl/Cmd + Z`
* **Redo**: `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y`
* **Clear Canvas**: toolbar button (broadcast)
* **Shift** (optional): constrain to straight line
* **Touch + stylus** supported (Pointer Events)

---

## 🧪 NPM Scripts

```jsonc
{
  "scripts": {
    "dev": "nodemon server/server.js",
    "start": "node server/server.js",
    "lint": "eslint ."
  }
}
```

---

## 🔌 Socket API (Events & Payloads)

**Namespace:** `/ws`

### Client → Server

| Event             | Payload                                                            |
| ----------------- | ------------------------------------------------------------------ |
| `room:join`       | `{ roomId, userName }`                                             |
| `stroke:begin`    | `{ roomId, strokeId, x, y, color, width, tool }`                   |
| `stroke:point`    | `{ roomId, strokeId, x, y }` *(streamed ~60–120 Hz, rate-limited)* |
| `stroke:end`      | `{ roomId, strokeId, x, y }`                                       |
| `undo`/`redo`     | `{ roomId }`                                                       |
| `canvas:clear`    | `{ roomId }`                                                       |
| `presence:cursor` | `{ roomId, x, y }`                                                 |
| `chat:message`    | `{ roomId, text }`                                                 |

### Server → Client

| Event             | Payload                          |
| ----------------- | -------------------------------- |
| `room:state`      | `{ participants, snapshot? }`    |
| `presence:join`   | `{ userId, userName }`           |
| `presence:leave`  | `{ userId }`                     |
| `stroke:begin`    | (mirrors client payload)         |
| `stroke:point`    | (mirrors client payload)         |
| `stroke:end`      | (mirrors client payload)         |
| `undo` / `redo`   | `{ roomId }`                     |
| `canvas:clear`    | `{ roomId }`                     |
| `presence:cursor` | `{ userId, x, y }`               |
| `chat:message`    | `{ userId, userName, text, ts }` |
| `error`           | `{ code, message }`              |

**Size targets**:

* `stroke:point` ≈ **≤ 64 bytes**
* `presence:cursor` ≈ **≤ 48 bytes** (throttled to ~20 Hz)

---

## 🧩 Architecture

A multi-user canvas where each client streams pointer strokes to a room over WebSockets.
Server is a **stateless relay** with light coordination (room membership, rate limiting, idempotent `strokeId`s).
Designed for **horizontal scaling** using Socket.IO’s Redis adapter.

```
+----------+        WebSocket         +-----------+        Pub/Sub        +-----------+
| Client A |  <-------------------->  |  Node.js  |  <----------------->  |   Redis   |
| (Canvas) |                          |  (Socket) |                       | (Adapter) |
+----------+                          +-----------+                       +-----------+
     ^                                       ^                                   ^
     | draw events                            | broadcast                         |
     v                                       v                                   v
+----------+                             +-----------+                       +-----------+
| Client B |                             |  (More)   |                       |  (More)   |
+----------+                             +-----------+                       +-----------+
```

### Components

**Client (public/):**

* **Canvas renderer** (2D context), double-buffered for smooth paths
* **Stroke model**: `{ strokeId, tool, color, width, points:[{x,y,t}] }`
* **Input**: Pointer Events; uses `getCoalescedEvents()` when available
* **State**: local undo/redo; remote strokes merged live
* **Net**: Socket.IO client with auto-reconnect and backoff
* **Presence**: remote cursors throttled (~20 Hz)

**Server (server/):**

* **HTTP**: serves static assets and room pages
* **WS**: Socket.IO namespace `/ws` for rooms & events
* **Rooms**: in-memory registry `{ roomId → { participants, snapshot?, lruStrokeIds } }`
* **Guards**: payload validation, token bucket limiter, room size limit
* **Scale-out**: Redis adapter to broadcast across instances

### Data Flow

**Join**

1. `room:join { roomId, userName }`
2. Server validates, adds member, sends `room:state` (+ optional snapshot), broadcasts `presence:join`.

**Draw**

1. Client emits `stroke:begin` (local `strokeId`).
2. Streams `stroke:point` until `stroke:end` (throttled, rate-limited).
3. Server echoes to room; clients render incrementally; origin reconciles after echo.

**Undo/Redo**

* Client emits `undo`/`redo`; server re-broadcasts so all clients apply the same logical change by `strokeId`.

**Clear**

* `canvas:clear` by a client → server broadcasts → all reset view (also a good snapshot boundary).

### Consistency

* **Idempotency**: LRU per room for recent `strokeId`s to drop duplicates.
* **Ordering**: process in arrival order; last-write-wins at stroke level.
* **Reconnect**: server sends `room:state` + latest snapshot; client repaints base and replays recent stroke buffer.

---

## 🚀 Performance

### Client

* **Coalesced pointer events** for dense sampling when supported.
* **rAF drawing**; incremental path updates (no full redraw on every point).
* **Double buffer** or offscreen canvas (optional) to avoid tearing.
* **Undo stack** bounded by `MAX_UNDO_STACK`.

### Server

* **Token bucket** limiter per socket (`RATE_LIMIT_*`).
* **Payload caps** (e.g., `~4KB` per event) with schema checks.
* **Broadcast** to room; Redis adapter makes fan-out O(subscribers).

**Targets**

* ~**60 FPS** local rendering on modern hardware.
* **<100 ms** round-trip echo (LAN).
* Typical room **2–16 users**; hard max adjustable.

---

## 💾 Persistence & Snapshots (Optional)

Default is ephemeral (in-memory).

* **When**: every N strokes or every M seconds.
* **What**: PNG raster of canvas + compact stroke list (JSON) + `version`.
* **Where**: S3/MinIO (preferred) or local FS. Index table `{roomId, version, snapshotKey}`.
* **Restore**: on join, server emits latest snapshot → client paints PNG → replays strokes after that `version`.

**Trade-offs**

* PNG: instant paint, heavier storage.
* JSON strokes: smaller, fully vector, slower to replay.
* **Hybrid recommended**: PNG baseline + recent strokes window.

---

## 📈 Scaling

* **Single node**: in-memory, simplest.
* **Multi node**: enable Redis adapter; rooms become logical across instances.
* **Sharding**: sticky routing by `roomId` hash (reverse proxy) for locality.
* **K8s**: app is stateless; Redis/S3 externalize state.

**Observability**

* `/healthz` probe
* Room counts, per-event TPS, error rate
* P50/P95/P99 latency (Prometheus + Grafana)
* Log sampling for `stroke:*` spikes

---

## 🔒 Security

* **Origin allow-list** via `ALLOWED_ORIGINS`
* **Join tokens** (JWT) scoped to `roomId` (optional)
* **Payload validation** + size limits
* **Rate limiting** with disconnect on abuse
* **Room privacy levels**

  * Public: short, guessable IDs
  * Private: signed invites, short-lived tokens
  * Protected: authenticated users + ACL (owner/mods)

---

## ✅ Testing Strategy

* **Unit**: room state, limiter, schema validators
* **Integration**: join/draw/undo flows using `socket.io-client`
* **Load**: k6/artillery pushing `stroke:point` at target TPS; watch drops & latency
* **E2E**: Playwright — two browsers drawing in same room, visual diff via canvas PNG

---

## 🧰 Troubleshooting

* **Cannot connect**: check CORS; set `ALLOWED_ORIGINS`
* **Laggy lines**: lower client sampling (≤ 60 Hz), ensure rate limiter isn’t throttling
* **Desyncs**: enable Redis adapter across instances, check clock skew
* **Memory growth**: confirm undo stack and snapshot GC are bounded

---

## 🗺️ Roadmap

* Shapes & text tools, selection/transform
* Layers with CRDT (e.g., Yjs) for object-level edits
* Recording & replay (timeline scrubber)
* Exports: PNG/SVG/JSON
* Mobile-first UI and pen pressure (`PointerEvent.pressure`)

---

## 📜 License

MIT — free to use and modify. Attribution appreciated.

---

```
```
