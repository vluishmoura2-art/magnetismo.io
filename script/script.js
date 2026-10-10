const canvas = document.getElementById("field");
const ctx = canvas.getContext("2d");

const TWO_PI = Math.PI * 2;

const world = {
  width: 1280,
  height: 720,
  playerR: 28.8,
  grayR: 50.4,
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
let jumpHeld = false;
let massHeld = false;
let mode = "topdown";
let myId = null;
let myName = "Player";
let myColor = "#ff3b3b";
let socket = null;
let started = false;

const pointer = { down: false, x: 0, y: 0 };
let drainId = null;

let lastIx = 0;
let lastIy = 0;
let lastJump = false;
let lastMassUp = false;
let lastDrainId = null;

const targetPlayers = new Map();
let targetGrays = [];
let targetPlatforms = [];
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
  targetPlatforms = snap.platforms || [];
  if (snap.blackBall) targetBlack = snap.blackBall;
  if (snap.match) match = snap.match;
  if (snap.mode && snap.mode !== mode) {
    mode = snap.mode;
    jumpHeld = false;
    massHeld = false;
    Controls.setMode(mode);
  }
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
  const jump = mode === "platformer" ? jumpHeld : false;
  if (
    Math.abs(ix - lastIx) > 0.05 ||
    Math.abs(iy - lastIy) > 0.05 ||
    jump !== lastJump ||
    massHeld !== lastMassUp ||
    drainId !== lastDrainId
  ) {
    lastIx = ix;
    lastIy = iy;
    lastJump = jump;
    lastMassUp = massHeld;
    lastDrainId = drainId;
    send({ type: "input", ix, iy, jump, massUp: massHeld, drainId });
  }
}

function updateDrain() {
  if (!pointer.down || match.state !== "playing") {
    drainId = null;
    return;
  }
  const wx = (pointer.x - offX) / scale;
  const wy = (pointer.y - offY) / scale;
  let best = null;
  let bestDist = Infinity;
  for (const [id, t] of targetPlayers) {
    if (id === myId || !t.alive) continue;
    const s = shownPlayers.get(id) || { x: t.x, y: t.y };
    const r = t.r || world.playerR;
    const d = Math.hypot(wx - s.x, wy - s.y);
    if (d <= r && d < bestDist) {
      best = id;
      bestDist = d;
    }
  }
  drainId = best;
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

function drawName(x, y, name, color, glow, r) {
  ctx.font = "600 20px Segoe UI, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
  }
  ctx.fillStyle = color;
  ctx.fillText(name, x, y - r - 8);
  ctx.shadowBlur = 0;
}

function drawMass(x, y, mass, color) {
  ctx.font = "700 13px Segoe UI, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillText(mass.toFixed(1), x, y + 16);
}

function drawDrains(pulse) {
  for (const [id, t] of targetPlayers) {
    if (!t.alive || t.drainId == null) continue;
    const v = targetPlayers.get(t.drainId);
    if (!v || !v.alive) continue;
    const a = shownPlayers.get(id) || { x: t.x, y: t.y };
    const b = shownPlayers.get(v.id) || { x: v.x, y: v.y };

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = "rgba(255, 220, 96, 0.7)";
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(b.x, b.y, (v.r || world.playerR) + 8 + pulse * 4, 0, TWO_PI);
    ctx.strokeStyle = "rgba(255, 96, 96, 0.85)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
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

  if (mode === "platformer") {
    for (const r of targetPlatforms) {
      ctx.fillStyle = "#808080";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    }
  }

  drawBlackBall();

  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 220);
  drawDrains(pulse);

  for (const [id, t] of targetPlayers) {
    if (!t.alive) continue;
    const s = shownPlayers.get(id) || { x: t.x, y: t.y };
    const r = t.r || world.playerR;
    const isWinner = match.state === "roundover" && match.winnerId === id;

    if (isWinner) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, r + 10 + pulse * 6, 0, TWO_PI);
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.5 + pulse * 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    circle(s.x, s.y, r, t.color);
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, TWO_PI);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
    ctx.lineWidth = 2;
    ctx.stroke();

    drawName(s.x, s.y, t.name, t.color, isWinner, r);
    drawMass(s.x, s.y, t.m, t.color);
  }

  ctx.restore();
}

function updateHud() {
  let alive = 0;
  for (const t of targetPlayers.values()) if (t.alive) alive++;
  const total = targetPlayers.size;
  const me = myId !== null ? targetPlayers.get(myId) : null;

  let stateText = "Waiting for players...";
  if (match.state === "playing") {
    stateText = mode === "platformer" ? "Map 2 - Platformer" : "Map 1 - Survive the black ball";
  } else if (match.state === "roundover") {
    stateText = "Round over";
  }

  const sub =
    match.state === "playing" && me
      ? `${alive} / ${total} alive  ·  MASS ${me.m.toFixed(1)}  (hold Space/Shift = heavier, hold click on a ball = steal mass)`
      : `${alive} / ${total} alive`;

  Menu.showHud(stateText, sub);

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
  updateDrain();
  sendInput();
  draw();
  updateHud();
  requestAnimationFrame(frame);
}

function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = e.clientX - rect.left;
  pointer.y = e.clientY - rect.top;
}

canvas.addEventListener("pointerdown", (e) => {
  if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return;
  e.preventDefault();
  pointer.down = true;
  canvasPos(e);
  updateDrain();
  sendInput();
});
canvas.addEventListener("pointermove", (e) => {
  canvasPos(e);
  if (pointer.down) {
    updateDrain();
    sendInput();
  }
});
const endPointer = (e) => {
  if (!pointer.down) return;
  pointer.down = false;
  updateDrain();
  sendInput();
};
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("pointerleave", endPointer);
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

window.addEventListener("resize", resize);

window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();

  if (mode === "platformer") {
    if (e.code === "Space" || key === "w" || e.key === "ArrowUp") {
      e.preventDefault();
      jumpHeld = true;
      sendInput();
      return;
    }
    if (e.key === "Shift") {
      e.preventDefault();
      massHeld = true;
      sendInput();
      return;
    }
  } else if (e.code === "Space") {
    e.preventDefault();
    massHeld = true;
    sendInput();
    return;
  }

  keys.add(key);
  sendInput();
});

window.addEventListener("keyup", (e) => {
  const key = e.key.toLowerCase();
  if (mode === "platformer") {
    if (e.code === "Space" || key === "w" || e.key === "ArrowUp") {
      jumpHeld = false;
      sendInput();
      return;
    }
    if (e.key === "Shift") {
      massHeld = false;
      sendInput();
      return;
    }
  } else if (e.code === "Space") {
    massHeld = false;
    sendInput();
    return;
  }
  keys.delete(key);
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
    moveVec.y = mode === "platformer" ? 0 : iy;
    sendInput();
  },
  onJump(held) {
    jumpHeld = held;
    sendInput();
  },
  onMass(held) {
    massHeld = held;
    sendInput();
  },
});
Controls.setMode(mode);