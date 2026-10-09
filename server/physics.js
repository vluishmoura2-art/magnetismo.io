const WORLD_WIDTH = 1280;
const WORLD_HEIGHT = 720;

const ACCEL = 1600;
const FRICTION = 0.985;
const RESTITUTION = 0.75;
const MAX_SPEED = 700;

const FIELD_OFF = 0;
const FIELD_ATTRACT = 1;
const FIELD_REPEL = 2;

const MIN_DIM = Math.min(WORLD_WIDTH, WORLD_HEIGHT);
const PLAYER_R = MIN_DIM * 0.04;
const GRAY_R = MIN_DIM * 0.07;
const FIELD_R = MIN_DIM * 0.3;
const MARGIN = MIN_DIM * 0.12;

const BLACK_R = MIN_DIM * 0.045;
const BLACK_WANDER = 900;
const BLACK_SPEED = 240;

const PLAYER_MASS = 1;
const GRAY_MASS = 5;
const FIELD_STRENGTH = 900;

const ROUND_OVER_DURATION = 5;

function bounceWalls(body, width, height) {
  if (body.x < body.r) {
    body.x = body.r;
    body.vx = Math.abs(body.vx) * RESTITUTION;
  } else if (body.x > width - body.r) {
    body.x = width - body.r;
    body.vx = -Math.abs(body.vx) * RESTITUTION;
  }
  if (body.y < body.r) {
    body.y = body.r;
    body.vy = Math.abs(body.vy) * RESTITUTION;
  } else if (body.y > height - body.r) {
    body.y = height - body.r;
    body.vy = -Math.abs(body.vy) * RESTITUTION;
  }
}

function collideBodies(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dist = Math.hypot(dx, dy);
  const minDist = a.r + b.r;

  if (dist >= minDist || dist === 0) return;

  const nx = dx / dist;
  const ny = dy / dist;
  const totalM = a.m + b.m;
  const overlap = minDist - dist;

  a.x += nx * overlap * (b.m / totalM);
  a.y += ny * overlap * (b.m / totalM);
  b.x -= nx * overlap * (a.m / totalM);
  b.y -= ny * overlap * (a.m / totalM);

  const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (vn < 0) {
    const j = (-(1 + RESTITUTION) * vn) / (1 / a.m + 1 / b.m);
    a.vx += (j / a.m) * nx;
    a.vy += (j / a.m) * ny;
    b.vx -= (j / b.m) * nx;
    b.vy -= (j / b.m) * ny;
  }
}

function applyFieldForce(source, target, dir, dt) {
  const dx = source.x - target.x;
  const dy = source.y - target.y;
  const dist = Math.hypot(dx, dy);
  if (dist > FIELD_R || dist === 0) return;
  const falloff = 1 - dist / FIELD_R;
  const f = dir * FIELD_STRENGTH * falloff;
  target.vx += (dx / dist) * f * dt;
  target.vy += (dy / dist) * f * dt;
}

function spawnPoint(index, count) {
  const angle = -Math.PI / 2 + (index / Math.max(count, 1)) * Math.PI * 2;
  const rad = MIN_DIM * 0.2;
  return {
    x: WORLD_WIDTH / 2 + Math.cos(angle) * rad,
    y: WORLD_HEIGHT / 2 + Math.sin(angle) * rad,
  };
}

class World {
  constructor() {
    this.width = WORLD_WIDTH;
    this.height = WORLD_HEIGHT;
    this.players = new Map();
    this.resetGrays();
    this.blackBall = { x: this.width / 2, y: this.height / 2, vx: 0, vy: 0, r: BLACK_R };
    this.match = { state: "waiting", winnerId: null, timer: 0 };
  }

  resetGrays() {
    const m = MARGIN;
    this.grays = [
      { x: m, y: m, vx: 0, vy: 0, r: GRAY_R, m: GRAY_MASS },
      { x: this.width - m, y: m, vx: 0, vy: 0, r: GRAY_R, m: GRAY_MASS },
      { x: m, y: this.height - m, vx: 0, vy: 0, r: GRAY_R, m: GRAY_MASS },
      { x: this.width - m, y: this.height - m, vx: 0, vy: 0, r: GRAY_R, m: GRAY_MASS },
    ];
  }

  addPlayer(id, name, color) {
    const count = this.players.size;
    const spawn = spawnPoint(count, Math.max(count + 1, 2));
    const player = {
      id,
      name: name || "Player",
      color: color || "#ff3b3b",
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      r: PLAYER_R,
      m: PLAYER_MASS,
      ix: 0,
      iy: 0,
      field: FIELD_OFF,
      alive: this.match.state !== "playing",
    };
    this.players.set(id, player);
    this.placePlayers();
    return player;
  }

  removePlayer(id) {
    this.players.delete(id);
    this.placePlayers();
  }

  placePlayers() {
    let i = 0;
    const count = this.players.size;
    for (const p of this.players.values()) {
      const spawn = spawnPoint(i, Math.max(count, 2));
      p.x = spawn.x;
      p.y = spawn.y;
      p.vx = 0;
      p.vy = 0;
      i++;
    }
  }

  alivePlayers() {
    return Array.from(this.players.values()).filter((p) => p.alive);
  }

  aliveCount() {
    let n = 0;
    for (const p of this.players.values()) if (p.alive) n++;
    return n;
  }

  setInput(id, ix, iy) {
    const p = this.players.get(id);
    if (!p || !p.alive) return;
    p.ix = Math.max(-1, Math.min(1, ix || 0));
    p.iy = Math.max(-1, Math.min(1, iy || 0));
  }

  setField(id, field) {
    const p = this.players.get(id);
    if (!p || !p.alive) return;
    if (field === FIELD_ATTRACT || field === FIELD_REPEL || field === FIELD_OFF) {
      p.field = field;
    }
  }

  startRound() {
    this.resetGrays();
    this.blackBall.x = this.width / 2;
    this.blackBall.y = this.height / 2;
    const dir = Math.random() * Math.PI * 2;
    this.blackBall.vx = Math.cos(dir) * BLACK_SPEED;
    this.blackBall.vy = Math.sin(dir) * BLACK_SPEED;
    for (const p of this.players.values()) {
      p.alive = true;
      p.vx = 0;
      p.vy = 0;
      p.ix = 0;
      p.iy = 0;
      p.field = FIELD_OFF;
    }
    this.placePlayers();
    this.match.state = "playing";
    this.match.winnerId = null;
    this.match.timer = 0;
  }

  endRound() {
    const alive = this.alivePlayers();
    this.match.state = "roundover";
    this.match.winnerId = alive.length === 1 ? alive[0].id : null;
    this.match.timer = ROUND_OVER_DURATION;
  }

  step(dt) {
    if (this.match.state === "waiting") {
      if (this.players.size >= 2) this.startRound();
    } else if (this.match.state === "roundover") {
      this.match.timer -= dt;
      if (this.match.timer <= 0) {
        if (this.players.size >= 2) this.startRound();
        else this.match.state = "waiting";
      }
    }

    const playing = this.match.state === "playing";
    this.stepBodies(dt);
    if (playing) {
      this.stepBlackBall(dt);
      this.checkDeaths();
      if (this.aliveCount() <= 1) this.endRound();
    }
  }

  stepBodies(dt) {
    const alive = this.alivePlayers();

    for (const p of alive) {
      if (p.ix !== 0 || p.iy !== 0) {
        const len = Math.hypot(p.ix, p.iy);
        p.vx += (p.ix / len) * ACCEL * dt;
        p.vy += (p.iy / len) * ACCEL * dt;
      }
      p.vx *= FRICTION;
      p.vy *= FRICTION;
      const s = Math.hypot(p.vx, p.vy);
      if (s > MAX_SPEED) {
        p.vx = (p.vx / s) * MAX_SPEED;
        p.vy = (p.vy / s) * MAX_SPEED;
      }
    }

    for (const p of alive) {
      if (p.field === FIELD_OFF) continue;
      const dir = p.field === FIELD_ATTRACT ? 1 : -1;
      for (const q of alive) {
        if (q === p) continue;
        applyFieldForce(p, q, dir, dt);
      }
      for (const g of this.grays) applyFieldForce(p, g, dir, dt);
    }

    for (const g of this.grays) {
      g.vx *= FRICTION;
      g.vy *= FRICTION;
    }

    for (const p of alive) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (const g of this.grays) {
      g.x += g.vx * dt;
      g.y += g.vy * dt;
    }

    for (const p of alive) bounceWalls(p, this.width, this.height);
    for (const g of this.grays) bounceWalls(g, this.width, this.height);

    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        collideBodies(alive[i], alive[j]);
      }
      for (const g of this.grays) collideBodies(alive[i], g);
    }
    for (let i = 0; i < this.grays.length; i++) {
      for (let j = i + 1; j < this.grays.length; j++) {
        collideBodies(this.grays[i], this.grays[j]);
      }
    }
  }

  stepBlackBall(dt) {
    const bb = this.blackBall;
    bb.vx += (Math.random() - 0.5) * BLACK_WANDER * dt;
    bb.vy += (Math.random() - 0.5) * BLACK_WANDER * dt;
    const s = Math.hypot(bb.vx, bb.vy) || 1;
    bb.vx = (bb.vx / s) * BLACK_SPEED;
    bb.vy = (bb.vy / s) * BLACK_SPEED;
    bb.x += bb.vx * dt;
    bb.y += bb.vy * dt;
    bounceWalls(bb, this.width, this.height);
  }

  checkDeaths() {
    const bb = this.blackBall;
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      const dist = Math.hypot(p.x - bb.x, p.y - bb.y);
      if (dist < p.r + bb.r) {
        p.alive = false;
        p.vx = 0;
        p.vy = 0;
        p.field = FIELD_OFF;
      }
    }
  }

  snapshot() {
    return {
      players: Array.from(this.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        field: p.field,
        alive: p.alive,
      })),
      grays: this.grays.map((g) => ({ x: g.x, y: g.y })),
      blackBall: { x: this.blackBall.x, y: this.blackBall.y },
      match: { state: this.match.state, winnerId: this.match.winnerId },
    };
  }
}

function worldInfo() {
  return {
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    playerR: PLAYER_R,
    grayR: GRAY_R,
    fieldR: FIELD_R,
    blackR: BLACK_R,
  };
}

module.exports = {
  World,
  worldInfo,
  FIELD_OFF,
  FIELD_ATTRACT,
  FIELD_REPEL,
};
