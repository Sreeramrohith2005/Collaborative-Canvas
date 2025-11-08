
 🎨 Collaborative Canvas

A simple project for a real-time drawing app. You can draw with other people at the same time.

This project uses plain HTML, CSS, and JavaScript (on the front-end) and Node.js with Socket.IO (on the back-end). It's a great starting point if you want to build your own live drawing tool.

-----

 ✨ Features

  * **Live Drawing:** Draw with multiple people in real-time.
  * **Tools:** Use a pen or an eraser.
  * **Rooms:** Create private drawing rooms by sharing a link (like `/room/my-room-123`).
  * **Presence:** See who is online in your room.
  * **Live Cursors:** See where other people's mouse cursors are.
  * **Undo / Redo:** Fix your mistakes.
  * **Clear Canvas:** A button to clear the drawing for everyone.
  * **Chat:** A simple chat box you can turn on or off.

-----

 🧱 Tech Stack

  * **Client (Front-end):** Vanilla JS (no frameworks), HTML Canvas
  * **Server (Back-end):** Node.js, Express
  * **Real-time:** WebSockets (using **Socket.IO**)
  * **Scaling (Optional):** Redis (to connect multiple servers)

-----

 📦 Project Structure

Here is how the files are organized:

```
collaborative-canvas/
├── server/
│   ├── server.js           # Main server file
│   ├── roomState.js        # Keeps track of rooms
│   ├── rateLimit.js        # Stops spam
│   └── adapters/
│       └── redis.js        # Helps connect multiple servers
├── public/
│   ├── index.html          # Join/Create room page
│   ├── room.html           # The drawing room
│   ├── styles.css          # Stylesheet
│   ├── client.js           # All the front-end drawing logic
│   └── vendor/socket.io.min.js
├── .env.example
├── package.json
└── README.md
```

-----

 ⚙️ Setup

Follow these steps to run the project on your computer.

1.  **Clone the project:**

    ```bash
    git clone <your-repo>
    cd collaborative-canvas
    ```

2.  **Create your settings file:**

    ```bash
    cp .env.example .env
    ```

    Now, open the `.env` file and edit the settings.

3.  **Install packages:**

    ```bash
    npm install
    ```

4.  **Run the server:**

    ```bash
    npm run dev
    ```

    The server will start at **http://localhost:3000**.

 `.env` (Settings File)

Here is what the settings in your `.env` file mean.

```env
# The port your server will run on
PORT=3000

# Set to "production" when you go live
NODE_ENV=development

# How many people can join one room
MAX_ROOM_SIZE=32
# How many times you can undo
MAX_UNDO_STACK=50

# Settings to prevent spam (how many messages per minute)
RATE_LIMIT_POINTS=400
RATE_LIMIT_BURST=80

# The website URL that is allowed to connect (for security)
ALLOWED_ORIGINS=http://localhost:3000

# (Optional) Add your Redis URL here if you want to use multiple servers
REDIS_URL=redis://localhost:6379
```

-----

 ▶️ How to Use

1.  Open **`http://localhost:3000`** in your browser.
2.  Type a room name to create a new room, or paste a link to join one.
3.  Share the room link (e.g., `http://localhost:3000/room/abc123`) with your friends.
4.  Draw together\!

 Controls

  * **Tools:** Click the **Pen** or **Eraser** button.
  * **Color/Width:** Use the inputs in the toolbar.
  * **Undo:** `Ctrl + Z` (or `Cmd + Z` on Mac)
  * **Redo:** `Ctrl + Shift + Z` or `Ctrl + Y`
  * **Clear:** Click the "Clear Canvas" button.

-----

 🧩 How It Works (Simple Version)

This app uses **WebSockets** (Socket.IO) to send messages very quickly.

The server's main job is to **pass messages**. When you draw, your browser sends a message to the server, and the server instantly sends that message to everyone else in your room.

By default, the server does **not** save the drawing. If the server restarts, the canvas will be empty.

```
+----------+       +-----------+
| You      | <---> | Node.js   |
| (Browser)|       | Server    |
+----------+       +-----------+
     ^                   |
     |                   v
     |             +-----------+
     +------------>| Friend    |
                   | (Browser) |
                   +-----------+
```

 What happens when you...

**...Join a Room?**

1.  Your browser sends a `room:join` message.
2.  The server adds you to the room.
3.  The server tells you who is already there (`room:state`).
4.  The server tells everyone else that you joined (`presence:join`).

**...Draw?**

1.  When you click, your browser sends `stroke:begin`.
2.  As you move your mouse, it sends `stroke:point` messages.
3.  When you let go, it sends `stroke:end`.
4.  The server sends all these messages to everyone else in the room so they can see your drawing live.

-----

 💾 How to Save Drawings (Optional)

Right now, drawings are **lost** when the server restarts.

If you want to save them permanently, you could:

1.  **Save as a Picture:** Every 5 minutes, save the canvas as a PNG file. When a new person joins, send them the picture first.
2.  **Save the Strokes:** Save all the drawing messages (like `stroke:begin`) to a JSON file. When a new person joins, send them the whole file so their browser can "re-draw" everything very fast.

**A hybrid approach is often best:** Save a picture (PNG) *and* the last 50 strokes. This is fast to load and accurate.

-----

 📈 How to Scale (For Many Users)

  * **One Server:** Works great for small groups.
  * **Many Servers:** If you get thousands of users, you will need more than one server. To make them work together, you must use the **Redis adapter**.
  * Just add your `REDIS_URL` to the `.env` file, and the servers will use Redis to share messages between rooms.

-----

 🔒 Security

  * **Allowed Origins:** Only lets your own website connect to the server (stops other websites from using your server).
  * **Rate Limiting:** Stops users from sending too many messages (spamming) and slowing down the server.
  * **Payload Validation:** The server checks every message to make sure it's valid.

-----

 🧰 Troubleshooting (Fixing Problems)

  * **"I can't connect\!"**
      * Check your `.env` file. Is `ALLOWED_ORIGINS` set to your website URL?
  * **"Drawing is slow or laggy."**
      * You might be sending too many messages. Check the `RATE_LIMIT_` settings.
  * **"My friends in the same room see different things."**
      * If you are using multiple servers, make sure you have **Redis** set up correctly.

-----

 🗺️ Future Ideas (Roadmap)

  * Add shapes (rectangles, circles) and text tools.
  * Add layers.
  * Record and replay drawings.
  * Export drawings as PNG or SVG files.
  * Support pen pressure for tablets.

-----

## 📜 License

MIT — This project is free for you to use and change.
