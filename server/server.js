const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");
const { RoomManager, MAX_PLAYERS } = require("./rooms");
const { worldInfo } = require("./physics");

const PORT = process.env.PORT || 4444;
const ROOT = path.join(__dirname, "..");
const TICK_MS = 1000 / 30;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const manager = new RoomManager(MAX_PLAYERS);

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";

  if (urlPath === "/status") {
    res.writeHead(200, { "Content-Type": MIME[".json"] });
    res.end(
      JSON.stringify({
        name: "magnet.io",
        status: "online",
        maxPlayersPerRoom: MAX_PLAYERS,
        rooms: manager.activeRooms().map((r) => ({
          id: r.id,
          players: r.size,
          state: r.world.match.state,
        })),
      })
    );
    return;
  }

  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer(serveStatic);
const wss = new WebSocketServer({ server });

let nextPlayerId = 1;

function send(ws, payload) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

function broadcast(room, payload) {
  const data = JSON.stringify(payload);
  for (const player of room.players.values()) {
    if (player.ws.readyState === player.ws.OPEN) player.ws.send(data);
  }
}

function sanitizeName(name) {
  if (typeof name !== "string") return "Player";
  const trimmed = name.trim().slice(0, 14);
  return trimmed.length ? trimmed : "Player";
}

function sanitizeColor(color) {
  if (typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color)) {
    return color.toLowerCase();
  }
  return "#ff3b3b";
}

wss.on("connection", (ws) => {
  const player = {
    id: nextPlayerId++,
    name: "Player",
    color: "#ff3b3b",
    ws,
    room: null,
  };

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "join") {
      if (player.room) return;
      player.name = sanitizeName(msg.name);
      player.color = sanitizeColor(msg.color);

      const { room, created } = manager.join(player);
      player.room = room;
      room.world.addPlayer(player.id, player.name, player.color);

      if (created) console.log(`room ${room.id} opened (0 players)`);
      console.log(
        `player ${player.id} "${player.name}" joined room ${room.id} (${room.size}/${MAX_PLAYERS})`
      );

      send(ws, {
        type: "welcome",
        id: player.id,
        roomId: room.id,
        maxPlayers: MAX_PLAYERS,
        world: worldInfo(),
        snapshot: room.world.snapshot(),
      });
      return;
    }

    if (!player.room) return;

    if (msg.type === "input") {
      player.room.world.setInput(player.id, msg.ix, msg.iy, msg.jump);
    } else if (msg.type === "field") {
      player.room.world.setField(player.id, msg.field);
    }
  });

  ws.on("close", () => {
    if (!player.room) return;
    const room = player.room;
    manager.leave(player);
    room.world.removePlayer(player.id);
    console.log(`player ${player.id} left room ${room.id} (${room.size}/${MAX_PLAYERS})`);
    if (room.size === 0) console.log(`room ${room.id} closed (empty)`);
  });
});

let accumulator = 0;
const MAX_DT = 0.1;
let lastTick = performance.now();

function tickLoop() {
  const now = performance.now();
  accumulator += now - lastTick;
  lastTick = now;
  accumulator = Math.min(accumulator, MAX_DT * 2000);

  while (accumulator >= TICK_MS) {
    accumulator -= TICK_MS;
    for (const room of manager.activeRooms()) {
      if (room.world.players.size === 0) continue;
      room.world.step(TICK_MS / 1000);
      broadcast(room, { type: "snapshot", ...room.world.snapshot() });
    }
  }
  setImmediate(tickLoop);
}
tickLoop();

server.listen(PORT, () => {
  console.log(`magnet.io server listening on http://localhost:${PORT}`);
  console.log(`max ${MAX_PLAYERS} players per room; a new room opens when one fills`);
});
