
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
-----

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

 🗺️ Future Ideas (Roadmap)

  * Add shapes (rectangles, circles) and text tools.
  * Add layers.
  * Record and replay drawings.
  * Export drawings as PNG or SVG files.
  * Support pen pressure for tablets.


