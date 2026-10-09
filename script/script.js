const canvas = document.getElementById("field");
const ctx = canvas.getContext("2d");

const FIELD_OFF = 0;
const FIELD_ATTRACT = 1;
const FIELD_REPEL = 2;
const TWO_PI = Math.PI * 2;

const world = {
  width: 1280,
  height: 720,
  playerR: 28.8,
  grayR: 50.4,
  fieldR: 216,
  blackR: 32.4,
};

let width = 0;
let height = 0;
let dpr = 1;
let scale = 1;
let offX = 0;
let offY = 0;

const keys = new Set();
const moveVec = { x: 0, y: 0 };
let fieldMode = FIELD_OFF;
let myId = null;
let myName = "Player";
let myColor = "#ff3b3b";
let socket = null;
let started = false;
let lastIx = 0;
let lastIy = 0;

const targetPlayers = new Map();
let targetGrays = [];
let targetBlack = { x: 0, y: 0 };
let match = { state: "waiting", winnerId: null };

const shownPlayers = new Map();
let shownGrays = [];
let shownBlack = { x: 0, y: 0 };

let lastBannerKey = "";

function resize() {
  const rect = canvas.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = rect.width;
  height = rect.height;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  scale = Math.min(width / world.width, height / world.height);
  offX = (width - world.width * scale) / 2;
  offY = (height - world.height * scale) / 2;
}

function startGame(name, color) {
  myName = name;
  myColor = color;
  started = true;
  Menu.hide();
  Controls.show();
  Controls.setFieldMode(fieldMode);
  connect();
}

function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const host = location.host || "localhost:4444";
  socket = new WebSocket(`${proto}://${host}`);

  socket.addEventListener("open", () => {
    Menu.setHint("");
    send({ type: "join", name: myName, color: myColor });
  });

  socket.addEventListener("message", (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }

    if (msg.type === "welcome") {
      myId = msg.id;
      Object.assign(world, msg.world || {});
      applySnapshot(msg.snapshot);
    } else if (msg.type === "snapshot") {
      applySnapshot(msg);
    }
  });

  socket.addEventListener("close", () => {
    if (started) {
      Menu.setHint("Reconnecting...");
      setTimeout(connect, 1200);
    }
  });
}

function send(payload) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function applySnapshot(snap) {
  if (!snap) return;
  targetPlayers.clear();
  for (const p of snap.players) targetPlayers.set(p.id, p);
  targetGrays = snap.grays || [];
  if (snap.blackBall) targetBlack = snap.blackBall;
  if (snap.match) match = snap.match;
}

function sendInput() {
  let ix = 0;
  let iy = 0;
  if (Math.hypot(moveVec.x, moveVec.y) > 0.15) {
    ix = moveVec.x;
    iy = moveVec.y;
  } else {
    if (keys.has("w") || keys.has("arrowup")) iy -= 1;
    if (keys.has("s") || keys.has("arrowdown")) iy += 1;
    if (keys.has("a") || keys.has("arrowleft")) ix -= 1;
    if (keys.has("d") || keys.has("arrowright")) ix += 1;
  }
  if (Math.abs(ix - lastIx) > 0.05 || Math.abs(iy - lastIy) > 0.05) {
    lastIx = ix;
    lastIy = iy;
    send({ type: "input", ix, iy });
  }
}

function cycleField() {
  fieldMode = (fieldMode + 1) % 3;
  Controls.setFieldMode(fieldMode);
  send({ type: "field", field: fieldMode });
}

function update(dt) {
  const k = 1 - Math.exp(-dt / 0.06);

  for (const [id, t] of targetPlayers) {
    let s = shownPlayers.get(id);
    if (!s) {
      s = { x: t.x, y: t.y };
      shownPlayers.set(id, s);
    }
    s.x += (t.x - s.x) * k;
    s.y += (t.y - s.y) * k;
  }
  for (const id of Array.from(shownPlayers.keys())) {
    if (!targetPlayers.has(id)) shownPlayers.delete(id);
  }

  for (let i = 0; i < targetGrays.length; i++) {
    const t = targetGrays[i];
    if (!shownGrays[i]) shownGrays[i] = { x: t.x, y: t.y };
    const s = shownGrays[i];
    s.x += (t.x - s.x) * k;
    s.y += (t.y - s.y) * k;
  }
  shownGrays.length = targetGrays.length;

  shownBlack.x += (targetBlack.x - shownBlack.x) * k;
  shownBlack.y += (targetBlack.y - shownBlack.y) * k;
}

function circle(x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TWO_PI);
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawField(x, y, mode) {
  if (mode !== FIELD_ATTRACT && mode !== FIELD_REPEL) return;
  ctx.beginPath();
  ctx.arc(x, y, world.fieldR, 0, TWO_PI);
  ctx.fillStyle =
    mode === FIELD_ATTRACT ? "rgba(79, 140, 255, 0.10)" : "rgba(255, 79, 140, 0.10)";
  ctx.fill();
  ctx.strokeStyle =
    mode === FIELD_ATTRACT ? "rgba(79, 140, 255, 0.6)" : "rgba(255, 79, 140, 0.6)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawBlackBall() {
  const r = world.blackR;
  const x = shownBlack.x;
  const y = shownBlack.y;
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  grad.addColorStop(0, "#2c2c36");
  grad.addColorStop(0.7, "#101015");
  grad.addColorStop(1, "#050507");
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TWO_PI);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(150, 150, 185, 0.55)";
  ctx.stroke();
}

function drawName(x, y, name, color, glow) {
  ctx.font = "600 20px Segoe UI, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
  }
  ctx.fillStyle = color;
  ctx.fillText(name, x, y - world.playerR - 8);
  ctx.shadowBlur = 0;
}

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(offX, offY);
  ctx.scale(scale, scale);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 2 / scale;
  ctx.strokeRect(0, 0, world.width, world.height);

  for (const g of shownGrays) {
    circle(g.x, g.y, world.grayR, "#808080");
  }

  drawBlackBall();

  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 220);

  for (const [id, t] of targetPlayers) {
    if (!t.alive) continue;
    const s = shownPlayers.get(id) || { x: t.x, y: t.y };
    drawField(s.x, s.y, t.field);
  }

  for (const [id, t] of targetPlayers) {
    if (!t.alive) continue;
    const s = shownPlayers.get(id) || { x: t.x, y: t.y };
    const isWinner = match.state === "roundover" && match.winnerId === id;

    if (isWinner) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, world.playerR + 10 + pulse * 6, 0, TWO_PI);
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.5 + pulse * 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    circle(s.x, s.y, world.playerR, t.color);
    ctx.beginPath();
    ctx.arc(s.x, s.y, world.playerR, 0, TWO_PI);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
    ctx.lineWidth = 2;
    ctx.stroke();

    drawName(s.x, s.y, t.name, t.color, isWinner);
  }

  ctx.restore();
}

function updateHud() {
  let alive = 0;
  for (const t of targetPlayers.values()) if (t.alive) alive++;
  const total = targetPlayers.size;
  const me = myId !== null ? targetPlayers.get(myId) : null;

  let stateText = "Waiting for players...";
  if (match.state === "playing") stateText = "Survive the black ball";
  else if (match.state === "roundover") stateText = "Round over";

  Menu.showHud(stateText, `${alive} / ${total} alive`);

  let key = "none";
  let text = "";
  let color = null;

  if (match.state === "roundover") {
    const winner = match.winnerId !== null ? targetPlayers.get(match.winnerId) : null;
    if (winner) {
      key = "winner-" + winner.id;
      text =
        (myId === winner.id ? "You win, " : "") + winner.name + " wins!";
      color = winner.color;
    } else {
      key = "nowinner";
      text = "No winner";
    }
  } else if (match.state === "playing" && me && !me.alive) {
    key = "spectate";
    text = "Eliminated - spectating";
    color = "#9aa0b5";
  } else if (match.state === "waiting") {
    key = "waiting";
    text = "Waiting for other players...";
    color = "#9aa0b5";
  }

  if (key !== lastBannerKey) {
    lastBannerKey = key;
    if (key === "none") Menu.clearBanner();
    else Menu.banner(text, color);
  }
}

let last = performance.now();

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  update(dt);
  draw();
  updateHud();
  requestAnimationFrame(frame);
}

window.addEventListener("resize", resize);

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    cycleField();
    return;
  }
  keys.add(e.key.toLowerCase());
  sendInput();
});

window.addEventListener("keyup", (e) => {
  keys.delete(e.key.toLowerCase());
  sendInput();
});

if (
  (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ||
  "ontouchstart" in window
) {
  document.body.classList.add("touch");
}

resize();
requestAnimationFrame(frame);

Menu.init({ onPlay: startGame });
Menu.show();

Controls.init({
  onMove(ix, iy) {
    moveVec.x = ix;
    moveVec.y = iy;
    sendInput();
  },
  onField: cycleField,
});
