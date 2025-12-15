const MAX_HEALTH = { easy:24, normal:20, hard:18 };
const STATS_KEY = "scoundrel-stats";

let deck = [];
let room = [];
let carry = null;
let canRun = true;
let difficulty = "normal";

let stats = JSON.parse(localStorage.getItem(STATS_KEY)) || { bestScore: 0 };

let player = {
  health: 20,
  weapon: null,
  score: 0
};

const roomEl = document.getElementById("room");
const runStatusEl = document.getElementById("run-status");

document.getElementById("start").onclick = startGame;
document.getElementById("run").onclick = runRoom;

/* ---------- SETUP ---------- */

function startGame() {
  difficulty = document.getElementById("difficulty").value;
  buildDeck();
  shuffle(deck);

  player.health = MAX_HEALTH[difficulty];
  player.weapon = null;
  player.score = 0;

  carry = null;
  canRun = true;
  updateRunStatus();

  drawRoom();
  updateUI();
  show("game");
  maybeTutorial();
}

function buildDeck() {
  deck = [];
  const cfg = {
    easy:   { m:14, w:12, h:10 },
    normal: { m:18, w:8,  h:10 },
    hard:   { m:22, w:6,  h:8 }
  }[difficulty];

  add("monster", cfg.m);
  add("weapon", cfg.w);
  add("health", cfg.h);
}

function add(type, count) {
  for (let i = 0; i < count; i++) {
    deck.push({ type, value: rand(2,14) });
  }
}

/* ---------- ROOM ---------- */

function drawRoom() {
  room = [];
  if (carry) room.push(carry);
  while (room.length < 4 && deck.length) {
    room.push(deck.shift());
  }
  renderRoom();
}

function runRoom() {
  if (!canRun) return;
  deck.push(...room);
  room = [];
  carry = null;
  canRun = false;
  updateRunStatus();
  drawRoom();
}

/* ---------- PLAY ---------- */

function playCard(index) {
  const c = room[index];

  if (c.type === "monster") fightMonster(c);
  if (c.type === "weapon") equipWeapon(c);
  if (c.type === "health") heal(c);

  room.splice(index, 1);

  if (room.length === 1) {
    carry = room[0];
    canRun = true;
    updateRunStatus();
    drawRoom();
  } else {
    renderRoom();
  }

  updateUI();
  checkEnd();
}

function fightMonster(c) {
  let damage = c.value;

  if (player.weapon) {
    if (player.weapon.durability === null || c.value <= player.weapon.durability) {
      damage = Math.max(0, c.value - player.weapon.power);
      player.weapon.durability = c.value - 1;
    } else {
      player.weapon = null;
    }
  }

  player.health -= damage;
  player.score += Math.max(0, 10 - damage);
}

function equipWeapon(c) {
  player.weapon = { power: c.value, durability: null };
}

function heal(c) {
  player.health = Math.min(MAX_HEALTH[difficulty], player.health + c.value);
}

/* ---------- UI ---------- */

function renderRoom() {
  roomEl.innerHTML = "";
  room.forEach((c, i) => {
    const el = document.createElement("div");
    el.className = `card ${c.type}`;
    el.style.setProperty("--bg", `url(icons/${c.type}${rand(1,3)}.png)`);

    if (c.type === "monster" && player.weapon) {
      if (player.weapon.durability === null || c.value <= player.weapon.durability) {
        el.classList.add("usable");
      } else {
        el.classList.add("breaks");
      }
    }

    el.innerHTML = `
      <div class="card-type">${c.type.toUpperCase()}</div>
      <div class="card-value">${c.value}</div>
    `;

    el.onclick = () => playCard(i);
    roomEl.appendChild(el);
  });
}

function updateUI() {
  document.getElementById("health").textContent = player.health;
  document.getElementById("weapon").textContent =
    player.weapon ? `${player.weapon.power}/${player.weapon.durability ?? "∞"}` : "-";
  document.getElementById("deck").textContent = deck.length;
  document.getElementById("score").textContent = player.score;
}

/* ---------- RUN STATUS ---------- */

function updateRunStatus() {
  runStatusEl.textContent = canRun ? "RUN AVAILABLE" : "RUN USED";
  runStatusEl.className = canRun ? "run-available" : "run-used";
}

/* ---------- END ---------- */

function checkEnd() {
  if (player.health <= 0) finish("Game Over");
  if (deck.length === 0 && room.length === 0) finish("Victory");
}

function finish(text) {
  stats.bestScore = Math.max(stats.bestScore, player.score);
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));

  document.getElementById("end-title").textContent = text;
  document.getElementById("end-score").textContent = `Score: ${player.score}`;
  show("end");
}

/* ---------- TUTORIAL ---------- */

const tutorialSteps = [
  ["Goal", "Survive the dungeon by managing health and weapons."],
  ["Rooms", "Each room has 4 cards. You may run once per room."],
  ["Weapons", "Weapons weaken after each monster fought."],
  ["Win", "Clear the deck without dying."]
];

let tStep = 0;

function maybeTutorial() {
  if (localStorage["scoundrel-tutorial"]) return;
  showTutorial();
}

function showTutorial() {
  document.getElementById("tutorial").classList.remove("hidden");
  renderTutorial();
}

document.getElementById("tutorial-next").onclick = () => {
  tStep++;
  if (tStep >= tutorialSteps.length) {
    localStorage["scoundrel-tutorial"] = "1";
    document.getElementById("tutorial").classList.add("hidden");
  } else renderTutorial();
};

function renderTutorial() {
  document.getElementById("tutorial-title").textContent = tutorialSteps[tStep][0];
  document.getElementById("tutorial-text").textContent = tutorialSteps[tStep][1];
}

/* ---------- UTIL ---------- */

function show(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

function rand(a,b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}
