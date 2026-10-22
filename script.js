"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const $ = id => document.getElementById(id);

const ui = {
  start: $("startBtn"),
  training: $("trainingBtn"),
  overlayStart: $("overlayStart"),
  reset: $("resetBtn"),
  overlay: $("overlay"),
  homeScore: $("homeScore"),
  awayScore: $("awayScore"),
  clock: $("clock"),
  message: $("message"),
  state: $("gameState"),
  mode: $("modeLabel")
};

const W = canvas.width;
const H = canvas.height;
const field = { x: 45, y: 38, w: 910, h: 524 };
const keys = Object.create(null);
const mouse = { x: 800, y: 300 };

let running = false;
let training = false;
let elapsed = 0;
let homeScore = 0;
let awayScore = 0;
let charge = 0;
let charging = false;
let lastTime = 0;
let kickCooldown = 0;
let particles = [];
let shake = 0;
let messageTimer = 0;

const player = {
  x: 235, y: 300, r: 13,
  speed: 205, color: "#b9ff39",
  vx: 0, vy: 0
};

const ball = {
  x: 255, y: 300, r: 7,
  vx: 0, vy: 0,
  z: 0, vz: 0,
  owner: "home",
  lastTouch: "home"
};

const home = [
  player,
  { x: 165, y: 170, r: 12, speed: 155, color: "#5bc8ff" },
  { x: 165, y: 430, r: 12, speed: 155, color: "#5bc8ff" },
  { x: 350, y: 210, r: 12, speed: 160, color: "#5bc8ff" },
  { x: 350, y: 390, r: 12, speed: 160, color: "#5bc8ff" }
];

const away = [
  { x: 770, y: 300, r: 13, speed: 150, color: "#ff555e" },
  { x: 820, y: 175, r: 12, speed: 145, color: "#ff555e" },
  { x: 820, y: 425, r: 12, speed: 145, color: "#ff555e" },
  { x: 650, y: 215, r: 12, speed: 155, color: "#ff555e" },
  { x: 650, y: 385, r: 12, speed: 155, color: "#ff555e" }
];

const keepers = {
  home: { x: 77, y: 300, r: 15, color: "#f4f7ff" },
  away: { x: 923, y: 300, r: 15, color: "#ffd86b" }
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalize(x, y) {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

function announce(text) {
  ui.message.textContent = text;
  messageTimer = 3;
}

function updateScore() {
  ui.homeScore.textContent = homeScore;
  ui.awayScore.textContent = awayScore;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return String(m).padStart(2, "0") + ":" +
    String(s).padStart(2, "0");
}

function resetPositions() {
  player.x = 235;
  player.y = 300;
  player.vx = player.vy = 0;

  home[1].x = 165; home[1].y = 170;
  home[2].x = 165; home[2].y = 430;
  home[3].x = 350; home[3].y = 210;
  home[4].x = 350; home[4].y = 390;

  away[0].x = 770; away[0].y = 300;
  away[1].x = 820; away[1].y = 175;
  away[2].x = 820; away[2].y = 425;
  away[3].x = 650; away[3].y = 215;
  away[4].x = 650; away[4].y = 385;

  ball.x = player.x + 20;
  ball.y = player.y;
  ball.vx = ball.vy = ball.vz = ball.z = 0;
  ball.owner = "home";
  ball.lastTouch = "home";
}

function startMatch(isTraining = false) {
  training = isTraining;
  running = true;
  elapsed = 0;
  homeScore = 0;
  awayScore = 0;
  charge = 0;
  charging = false;
  particles = [];

  resetPositions();
  updateScore();

  ui.overlay.classList.add("hidden");
  ui.mode.textContent = training ? "Trening" : "Vanlig kamp";
  ui.state.textContent = training ? "TRENING PÅGÅR" : "KAMPEN PÅGÅR";
  announce(training ? "Trening startet! Øv på skudd." : "Kampen er i gang!");
  lastTime = performance.now();
}

function resetGame() {
  startMatch(training);
}

function scoreGoal(team) {
  if (team === "home") {
    homeScore++;
    announce("⚽ MÅL! BLUE FC scorer!");
  } else {
    awayScore++;
    announce("Mål til Red United!");
  }

  if (training) {
    homeScore = 0;
    awayScore = 0;
  }

  updateScore();
  shake = 12;
  makeParticles(ball.x, ball.y, 35);

  running = false;
  setTimeout(() => {
    if (training) {
      resetPositions();
      running = true;
      lastTime = performance.now();
      ui.state.textContent = "TRENING PÅGÅR";
    } else if (elapsed >= 180) {
      endMatch();
    } else {
      resetPositions();
      running = true;
      lastTime = performance.now();
      ui.state.textContent = "KAMPEN PÅGÅR";
    }
  }, 1100);
}

function endMatch() {
  running = false;
  ui.overlay.classList.remove("hidden");
  ui.overlay.querySelector("h2").textContent =
    homeScore > awayScore ? "YOU WIN!" :
    homeScore < awayScore ? "MATCH LOST" : "DRAW!";
  ui.overlay.querySelector("p").textContent =
    `Sluttresultat ${homeScore} - ${awayScore}`;
  ui.overlayStart.textContent = "SPILL IGJEN";
  ui.state.textContent = "KAMPEN ER FERDIG";
}

function makeParticles(x, y, count) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = 35 + Math.random() * 190;
    particles.push({
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: 0.4 + Math.random() * 0.8,
      maxLife: 1.2,
      size: 2 + Math.random() * 4
    });
  }
}

function kick(power, pass = false) {
  if (!running || kickCooldown > 0) return;

  const dir = normalize(mouse.x - player.x, mouse.y - player.y);
  const d = distance(player, ball);

  if (ball.owner !== "home" && d > 48) {
    announce("Kom nærmere ballen først!");
    return;
  }

  const force = pass ? 300 : 260 + power * 500;

  ball.x = player.x + dir.x * 23;
  ball.y = player.y + dir.y * 23;
  ball.vx = dir.x * force;
  ball.vy = dir.y * force;
  ball.vz = pass ? 35 : 100 + power * 120;
  ball.owner = null;
  ball.lastTouch = "home";

  kickCooldown = 0.3;
  makeParticles(ball.x, ball.y, pass ? 5 : 12);
  announce(pass ? "Pasning!" : `Skudd! Kraft: ${Math.round(power * 100)}%`);
}

function stealBall() {
  const d = distance(player, ball);
  if (d < 30 && Math.hypot(ball.vx, ball.vy) < 230) {
    ball.owner = "home";
    ball.vx = ball.vy = ball.vz = ball.z = 0;
  }
}

function moveToward(entity, target, speed, dt) {
  const dir = normalize(target.x - entity.x, target.y - entity.y);
  entity.x += dir.x * speed * dt;
  entity.y += dir.y * speed * dt;
  entity.x = clamp(entity.x, field.x + 12, field.x + field.w - 12);
  entity.y = clamp(entity.y, field.y + 12, field.y + field.h - 12);
}

function updatePlayer(dt) {
  let dx = 0, dy = 0;

  if (keys.KeyW || keys.ArrowUp) dy--;
  if (keys.KeyS || keys.ArrowDown) dy++;
  if (keys.KeyA || keys.ArrowLeft) dx--;
  if (keys.KeyD || keys.ArrowRight) dx++;

  const dir = normalize(dx, dy);
  const moving = dx !== 0 || dy !== 0;
  const sprint = keys.ShiftLeft || keys.ShiftRight;
  const speed = player.speed * (sprint ? 1.45 : 1);

  if (moving) {
    player.x += dir.x * speed * dt;
    player.y += dir.y * speed * dt;
  }

  player.x = clamp(player.x, field.x + 15, field.x + field.w - 15);
  player.y = clamp(player.y, field.y + 15, field.y + field.h - 15);

  if (ball.owner === "home") {
    ball.x = player.x + 18;
    ball.y = player.y + 3;
    ball.vx = ball.vy = ball.vz = ball.z = 0;
  } else {
    stealBall();
  }
}

function updateAI(dt) {
  for (let i = 1; i < home.length; i++) {
    const teammate = home[i];
    const target = ball.owner === "home"
      ? { x: 340 + i * 18, y: 100 + i * 85 }
      : ball;

    moveToward(teammate, target, teammate.speed * 0.35, dt);
  }

  away.forEach((enemy, i) => {
    const target = ball.owner === "away" && i !== 0
      ? { x: 690, y: 300 + (i - 2) * 40 }
      : ball;

    moveToward(enemy, target, enemy.speed, dt);

    if (distance(enemy, ball) < 23 && ball.owner !== "away") {
      ball.owner = "away";
      ball.lastTouch = "away";
      ball.vx = ball.vy = ball.vz = ball.z = 0;
    }

    if (ball.owner === "away" && i === 0 && distance(enemy, ball) < 30) {
      const dir = normalize(60 - ball.x, 300 - ball.y);
      ball.owner = null;
      ball.vx = dir.x * 300;
      ball.vy = dir.y * 300;
      ball.vz = 45;
    }
  });

  keepers.home.y += clamp(ball.y - keepers.home.y, -120 * dt, 120 * dt);
  keepers.away.y += clamp(ball.y - keepers.away.y, -120 * dt, 120 * dt);
  keepers.home.y = clamp(keepers.home.y, 245, 355);
  keepers.away.y = clamp(keepers.away.y, 245, 355);
}

function updateBall(dt) {
  if (ball.owner) return;

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.z += ball.vz * dt;

  ball.vz -= 300 * dt;

  if (ball.z < 0) {
    ball.z = 0;
    ball.vz *= -0.35;
    if (Math.abs(ball.vz) < 20) ball.vz = 0;
  }

  const drag = Math.pow(0.985, dt * 60);
  ball.vx *= drag;
  ball.vy *= drag;

  if (ball.x < field.x + 5 || ball.x > field.x + field.w - 5) {
    const inGoal = ball.y > 250 && ball.y < 350;

    if (inGoal && ball.x < field.x) {
      scoreGoal("away");
      return;
    }
    if (inGoal && ball.x > field.x + field.w) {
      scoreGoal("home");
      return;
    }

    ball.vx *= -0.65;
    ball.x = clamp(ball.x, field.x + 5, field.x + field.w - 5);
  }

  if (ball.y < field.y + 5 || ball.y > field.y + field.h - 5) {
    ball.vy *= -0.7;
    ball.y = clamp(ball.y, field.y + 5, field.y + field.h - 5);
  }

  for (const keeper of Object.values(keepers)) {
    if (distance(ball, keeper) < ball.r + keeper.r && ball.z < 25) {
      ball.vx *= -0.85;
      ball.vy += (ball.y - keeper.y) * 3;
      makeParticles(ball.x, ball.y, 6);
    }
  }

  if (Math.hypot(ball.vx, ball.vy) < 7 && ball.z === 0) {
    ball.vx = ball.vy = 0;
  }

  if (distance(player, ball) < 25 && ball.z < 18 &&
      Math.hypot(ball.vx, ball.vy) < 110) {
    ball.owner = "home";
  }
}

function updateParticles(dt) {
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.97;
    p.vy *= 0.97;
    p.life -= dt;
  }
}

function update(dt) {
  if (!running) return;

  elapsed += dt;
  kickCooldown = Math.max(0, kickCooldown - dt);
  messageTimer = Math.max(0, messageTimer - dt);

  if (!training && elapsed >= 180) {
    endMatch();
    return;
  }

  ui.clock.textContent = formatTime(elapsed);
  updatePlayer(dt);
  updateAI(dt);
  updateBall(dt);
  updateParticles(dt);

  if (charging) {
    charge = Math.min(1, charge + dt * 0.7);
  }
}

function drawField() {
  ctx.fillStyle = "#23763e";
  ctx.fillRect(0, 0, W, H);

  const stripeW = field.w / 10;
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 2 ? "#267b40" : "#2c8748";
    ctx.fillRect(field.x + i * stripeW, field.y, stripeW, field.h);
  }

  ctx.strokeStyle = "#d7f2dc";
  ctx.lineWidth = 3;
  ctx.strokeRect(field.x, field.y, field.w, field.h);

  ctx.beginPath();
  ctx.moveTo(W / 2, field.y);
  ctx.lineTo(W / 2, field.y + field.h);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 75, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#d7f2dc";
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeRect(field.x, 190, 125, 220);
  ctx.strokeRect(field.x, 240, 48, 120);
  ctx.strokeRect(field.x + field.w - 125, 190, 125, 220);
  ctx.strokeRect(field.x + field.w - 48, 240, 48, 120);

  ctx.strokeRect(field.x - 15, 250, 15, 100);
  ctx.strokeRect(field.x + field.w, 250, 15, 100);

  ctx.fillStyle = "#d7f2dc";
  ctx.beginPath();
  ctx.arc(field.x + 82, H / 2, 3, 0, Math.PI * 2);
  ctx.arc(field.x + field.w - 82, H / 2, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff22";
  ctx.fillRect(field.x, field.y, field.w, 5);
}

function drawPlayer(p, number, isHuman = false) {
  ctx.save();

  ctx.fillStyle = "#07150b55";
  ctx.beginPath();
  ctx.ellipse(p.x + 3, p.y + 7, p.r + 2, p.r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = isHuman ? "#ffffff" : "#ffffff88";
  ctx.lineWidth = isHuman ? 3 : 1.5;
  ctx.stroke();

  ctx.fillStyle = "#102018";
  ctx.font = "bold 10px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(number, p.x, p.y);

  if (isHuman) {
    ctx.strokeStyle = "#d4ff83";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawKeeper(k) {
  ctx.fillStyle = "#ffffff44";
  ctx.fillRect(k.x - 8, k.y - 25, 16, 50);

  ctx.fillStyle = k.color;
  ctx.beginPath();
  ctx.arc(k.x, k.y, k.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawBall() {
  const drawY = ball.y - ball.z;

  ctx.fillStyle = "#08120a55";
  ctx.beginPath();
  ctx.ellipse(ball.x, ball.y + 3, ball.r + ball.z * 0.05,
    ball.r * 0.65, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(ball.x, drawY, ball.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#1d2520";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#202820";
  ctx.beginPath();
  ctx.arc(ball.x - 2, drawY - 1, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawAim() {
  if (!running) return;

  const nearBall = distance(player, ball) < 45 || ball.owner === "home";
  if (!nearBall) return;

  const dir = normalize(mouse.x - player.x, mouse.y - player.y);
  const endX = player.x + dir.x * (70 + charge * 130);
  const endY = player.y + dir.y * (70 + charge * 130);

  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = charging ? "#ffed74" : "#ffffffbb";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.setLineDash([]);

  if (charging) {
    ctx.fillStyle = "#0b160dbb";
    ctx.fillRect(player.x - 24, player.y - 32, 48, 7);
    ctx.fillStyle = "#b9ff39";
    ctx.fillRect(player.x - 24, player.y - 32, 48 * charge, 7);
  }
  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = "#d7ff75";
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function draw() {
  ctx.save();

  if (shake > 0) {
    ctx.translate(
      (Math.random() - 0.5) * shake,
      (Math.random() - 0.5) * shake
    );
    shake *= 0.85;
  }

  drawField();
  drawKeeper(keepers.home);
  drawKeeper(keepers.away);

  home.slice(1).forEach((p, i) => drawPlayer(p, i + 2));
  away.forEach((p, i) => drawPlayer(p, i + 1));
  drawPlayer(player, 10, true);

  drawAim();
  drawBall();
  drawParticles();

  ctx.restore();
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000 || 0, 0.035);
  lastTime = now;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

window.addEventListener("keydown", event => {
  keys[event.code] = true;

  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
    event.preventDefault();
  }

  if (event.code === "Space" && !event.repeat) {
    charging = true;
    charge = 0;
  }

  if (event.code === "KeyE" && !event.repeat) {
    kick(0.35, true);
  }
});

window.addEventListener("keyup", event => {
  keys[event.code] = false;

  if (event.code === "Space" && charging) {
    charging = false;
    kick(charge);
    charge = 0;
  }
});

canvas.addEventListener("pointermove", event => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = (event.clientX - rect.left) * W / rect.width;
  mouse.y = (event.clientY - rect.top) * H / rect.height;
});

ui.start.addEventListener("click", () => startMatch(false));
ui.training.addEventListener("click", () => startMatch(true));
ui.overlayStart.addEventListener("click", () => startMatch(training));
ui.reset.addEventListener("click", resetGame);

requestAnimationFrame(now => {
  lastTime = now;
  requestAnimationFrame(loop);
})