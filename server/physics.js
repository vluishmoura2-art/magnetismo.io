const WORLD_WIDTH = 1280;
const WORLD_HEIGHT = 720;

const FRICTION = 0.995;
const RESTITUTION = 0.75;
const IMPULSE_MULT = 1.2;
const WALL_IMPULSE_MULT = 1.05;
const SPEED_LIMIT = 1200;
const OVERLAP_CORRECTION = 1.0;
const WALL_RESTITUTION = RESTITUTION * WALL_IMPULSE_MULT;
const REST_THRESHOLD = 90;

const MIN_DIM = Math.min(WORLD_WIDTH, WORLD_HEIGHT);
const PLAYER_R = MIN_DIM * 0.04;
const GRAY_R = MIN_DIM * 0.07;
const MARGIN = MIN_DIM * 0.12;

const BLACK_R = MIN_DIM * 0.045;
const BLACK_WANDER = 900;
const BLACK_SPEED = 240;

const PLAYER_MASS = 1;
const MIN_MASS = 0.2;
const MAX_MASS = 5;
const MASS_UP_RATE = 1.0;
const DRAIN_RATE = 0.8;
const MOVE_FORCE = 900;
const GRAY_MASS = 5;

const GRAVITY = 350;
const JUMP_SPEED = 900;
const MOVE_ACCEL = 2600;
const MAX_FALL = SPEED_LIMIT;

const ROUND_OVER_DURATION = 5;

function playerRadius(mass) {
  return PLAYER_R * Math.sqrt(mass);
}

function motionFriction(mass) {
  return 1 - (1 - FRICTION) / mass;
}

function bounceWalls(body, width, height) {
  if (body.x < body.r) {
    body.x = body.r;
    if (body.vx < 0) body.vx = -body.vx * (Math.abs(body.vx) > REST_THRESHOLD ? WALL_RESTITUTION : 0);
  } else if (body.x > width - body.r) {
    body.x = width - body.r;
    if (body.vx > 0) body.vx = -body.vx * (Math.abs(body.vx) > REST_THRESHOLD ? WALL_RESTITUTION : 0);
  }
  if (body.y < body.r) {
    body.y = body.r;
    if (body.vy < 0) body.vy = -body.vy * (Math.abs(body.vy) > REST_THRESHOLD ? WALL_RESTITUTION : 0);
  } else if (body.y > height - body.r) {
    body.y = height - body.r;
    if (body.vy > 0) body.vy = -body.vy * (Math.abs(body.vy) > REST_THRESHOLD ? WALL_RESTITUTION : 0);
    body.onGround = true;
  }
}

function clampSpeed(body, limit) {
  const s = Math.hypot(body.vx, body.vy);
  if (s > limit) {
    const k = limit / s;
    body.vx *= k;
    body.vy *= k;
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
  const overlap = (minDist - dist) * OVERLAP_CORRECTION;

  a.x += nx * overlap * (b.m / totalM);
  a.y += ny * overlap * (b.m / totalM);
  b.x -= nx * overlap * (a.m / totalM);
  b.y -= ny * overlap * (a.m / totalM);

  const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (vn < 0) {
    const e = Math.abs(vn) > REST_THRESHOLD ? RESTITUTION : 0;
    const j = ((-(1 + e) * vn) / (1 / a.m + 1 / b.m)) * IMPULSE_MULT;
    a.vx += (j / a.m) * nx;
    a.vy += (j / a.m) * ny;
    b.vx -= (j / b.m) * nx;
    b.vy -= (j / b.m) * ny;
  }
}

function collidePlatform(body, rect) {
  const cx = Math.max(rect.x, Math.min(body.x, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(body.y, rect.y + rect.h));
  let dx = body.x - cx;
  let dy = body.y - cy;
  let dist = Math.hypot(dx, dy);

  if (dist === 0) {
    const left = body.x - rect.x;
    const right = rect.x + rect.w - body.x;
    const top = body.y - rect.y;
    const bottom = rect.y + rect.h - body.y;
    const m = Math.min(left, right, top, bottom);
    const ex = Math.abs(body.vx) > REST_THRESHOLD ? WALL_RESTITUTION : 0;
    const ey = Math.abs(body.vy) > REST_THRESHOLD ? WALL_RESTITUTION : 0;
    if (m === left) {
      body.x = rect.x - body.r;
      if (body.vx > 0) body.vx = -body.vx * ex;
    } else if (m === right) {
      body.x = rect.x + rect.w + body.r;
      if (body.vx < 0) body.vx = -body.vx * ex;
    } else if (m === top) {
      body.y = rect.y - body.r;
      if (body.vy > 0) body.vy = -body.vy * ey;
      body.onGround = true;
    } else {
      body.y = rect.y + rect.h + body.r;
      if (body.vy < 0) body.vy = -body.vy * ey;
    }
    return;
  }

  if (dist < body.r) {
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = (body.r - dist) * OVERLAP_CORRECTION;
    body.x += nx * overlap;
    body.y += ny * overlap;
    const vn = body.vx * nx + body.vy * ny;
    if (vn < 0) {
      const e = Math.abs(vn) > REST_THRESHOLD ? WALL_RESTITUTION : 0;
      body.vx -= (1 + e) * vn * nx;
      body.vy -= (1 + e) * vn * ny;
    }
    if (ny < -0.5) body.onGround = true;
  }
}

function buildPlatforms() {
  return [
    { x: 0, y: 660, w: 1280, h: 60 },
    { x: 160, y: 500, w: 240, h: 24 },
    { x: 560, y: 500, w: 240, h: 24 },
    { x: 880, y: 500, w: 240, h: 24 },
    { x: 360, y: 370, w: 220, h: 24 },
    { x: 700, y: 370, w: 220, h: 24 },
    { x: 520, y: 240, w: 240, h: 24 },
  ];
}

class World {
  constructor() {
    this.width = WORLD_WIDTH;
    this.height = WORLD_HEIGHT;
    this.players = new Map();
    this.mapId = 1;
    this.setupMap();
    this.blackBall = { x: this.width / 2, y: this.height / 2, vx: 0, vy: 0, r: BLACK_R };
    this.match = { state: "waiting", winnerId: null, timer: 0 };
  }

  setupMap() {
    this.platforms = [];
    this.grays = [];
    if (this.mapId === 2) {
      this.mode = "platformer";
      this.platforms = buildPlatforms();
    } else {
      this.mode = "topdown";
      const m = MARGIN;
      this.grays = [
        { x: m, y: m, vx: 0, vy: 0, r: GRAY_R, m: GRAY_MASS },
        { x: this.width - m, y: m, vx: 0, vy: 0, r: GRAY_R, m: GRAY_MASS },
        { x: m, y: this.height - m, vx: 0, vy: 0, r: GRAY_R, m: GRAY_MASS },
        { x: this.width - m, y: this.height - m, vx: 0, vy: 0, r: GRAY_R, m: GRAY_MASS },
      ];
    }
  }

  toggleMap() {
    this.mapId = this.mapId === 1 ? 2 : 1;
    this.setupMap();
  }

  spawnForIndex(index, count) {
    if (this.mode === "platformer") {
      const x = this.width * (0.15 + 0.7 * ((index + 0.5) / Math.max(count, 1)));
      return { x, y: 560 };
    }
    const angle = -Math.PI / 2 + (index / Math.max(count, 1)) * Math.PI * 2;
    const rad = MIN_DIM * 0.2;
    return {
      x: this.width / 2 + Math.cos(angle) * rad,
      y: this.height / 2 + Math.sin(angle) * rad,
    };
  }

  addPlayer(id, name, color) {
    const count = this.players.size;
    const spawn = this.spawnForIndex(count, Math.max(count + 1, 2));
    const player = {
      id,
      name: name || "Player",
      color: color || "#ff3b3b",
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      r: playerRadius(PLAYER_MASS),
      m: PLAYER_MASS,
      ix: 0,
      iy: 0,
      jump: false,
      jumpPrev: false,
      onGround: false,
      drainId: null,
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
      const spawn = this.spawnForIndex(i, Math.max(count, 2));
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

  setInput(id, ix, iy, jump, massUp, drainId) {
    const p = this.players.get(id);
    if (!p || !p.alive) return;
    p.ix = Math.max(-1, Math.min(1, ix || 0));
    p.iy = Math.max(-1, Math.min(1, iy || 0));
    p.jump = !!jump;
    p.massUp = !!massUp;
    const targetId = Number.isFinite(drainId) ? drainId : null;
    p.drainId = targetId !== p.id ? targetId : null;
  }

  startRound() {
    this.setupMap();
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
      p.jump = false;
      p.jumpPrev = false;
      p.onGround = false;
      p.m = PLAYER_MASS;
      p.r = playerRadius(p.m);
      p.massUp = false;
      p.drainId = null;
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
        if (this.players.size >= 2) {
          this.toggleMap();
          this.startRound();
        } else {
          this.match.state = "waiting";
        }
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
    const platformer = this.mode === "platformer";

    for (const p of alive) {
      p.r = playerRadius(p.m);
      if (p.massUp) p.m = Math.min(MAX_MASS, p.m + MASS_UP_RATE * dt);
    }
    this.stepDrain(dt);

    for (const p of alive) {
      const fric = motionFriction(p.m);
      if (platformer) {
        if (p.ix !== 0) p.vx += p.ix * (MOVE_ACCEL / p.m) * dt;
        if (p.jump && !p.jumpPrev && p.onGround) p.vy = -JUMP_SPEED;
        p.jumpPrev = p.jump;
        p.vy += GRAVITY * dt;
        if (p.vy > MAX_FALL) p.vy = MAX_FALL;
        p.vx *= fric;
      } else {
        if (p.ix !== 0 || p.iy !== 0) {
          const len = Math.hypot(p.ix, p.iy);
          p.vx += (p.ix / len) * (MOVE_FORCE / p.m) * dt;
          p.vy += (p.iy / len) * (MOVE_FORCE / p.m) * dt;
        }
        p.vy += GRAVITY * dt;
        if (p.vy > MAX_FALL) p.vy = MAX_FALL;
        p.vx *= fric;
        p.vy *= fric;
      }
    }

    for (const g of this.grays) {
      g.vy += GRAVITY * dt;
      if (g.vy > MAX_FALL) g.vy = MAX_FALL;
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

    if (platformer) {
      for (const p of alive) p.onGround = false;
      for (const p of alive) bounceWalls(p, this.width, this.height);
      for (const p of alive) {
        for (const rect of this.platforms) collidePlatform(p, rect);
      }
    } else {
      for (const p of alive) bounceWalls(p, this.width, this.height);
      for (const g of this.grays) bounceWalls(g, this.width, this.height);
    }

    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        collideBodies(alive[i], alive[j]);
      }
      if (!platformer) {
        for (const g of this.grays) collideBodies(alive[i], g);
      }
    }
    if (!platformer) {
      for (let i = 0; i < this.grays.length; i++) {
        for (let j = i + 1; j < this.grays.length; j++) {
          collideBodies(this.grays[i], this.grays[j]);
        }
      }
    }

    for (const p of alive) clampSpeed(p, SPEED_LIMIT);
    for (const g of this.grays) clampSpeed(g, SPEED_LIMIT);
  }

  stepDrain(dt) {
    for (const p of this.alivePlayers()) {
      if (p.drainId == null) continue;
      const v = this.players.get(p.drainId);
      if (!v || v.id === p.id || !v.alive) {
        p.drainId = null;
        continue;
      }
      const maxGain = 2 * v.m - p.m;
      if (maxGain <= 0) {
        p.drainId = null;
        continue;
      }
      const transfer = Math.min(DRAIN_RATE * dt, maxGain / 3, v.m - MIN_MASS);
      if (transfer <= 0) {
        p.drainId = null;
        continue;
      }
      p.m += transfer;
      v.m -= transfer;
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
        p.drainId = null;
      }
    }
  }

  snapshot() {
    return {
      mode: this.mode,
      mapId: this.mapId,
      players: Array.from(this.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        m: p.m,
        r: p.r,
        drainId: p.drainId,
        alive: p.alive,
      })),
      grays: this.grays.map((g) => ({ x: g.x, y: g.y })),
      platforms: this.platforms.map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h })),
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
    blackR: BLACK_R,
  };
}

module.exports = {
  World,
  worldInfo,
};
