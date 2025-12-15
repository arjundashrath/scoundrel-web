const MAX_HEALTH = 20;
const SAVE_KEY = "scoundrel-save";

/* Screens */
const menuScreen = document.getElementById("menu-screen");
const gameScreen = document.getElementById("game-screen");
const endScreen = document.getElementById("end-screen");

/* UI */
const healthEl = document.getElementById("health");
const weaponEl = document.getElementById("weapon");
const deckEl = document.getElementById("deck");
const tableEl = document.getElementById("table");
const messageEl = document.getElementById("message");

/* End */
const endTitle = document.getElementById("end-title");
const endText = document.getElementById("end-text");

/* Buttons */
const startBtn = document.getElementById("start-btn");
const resumeBtn = document.getElementById("resume-btn");
const restartBtn = document.getElementById("restart-btn");

/* State */
let player, deck, table;

/* ---------- INIT ---------- */

if (localStorage.getItem(SAVE_KEY)) {
  resumeBtn.classList.remove("hidden");
}

startBtn.onclick = () => newGame();
resumeBtn.onclick = () => loadGame();
restartBtn.onclick = () => newGame();

function show(screen) {
  [menuScreen, gameScreen, endScreen].forEach(s =>
    s.classList.remove("active")
  );
  screen.classList.add("active");
}

/* ---------- GAME SETUP ---------- */

function newGame() {
  player = { health: 20, weapon: 0 };
  deck = [];
  table = [];

  addCards("monster", 30);
  addCards("weapon", 10);
  addCards("health", 12);
  shuffle(deck);

  deal();
  save();
  show(gameScreen);
  updateUI();
}

function addCards(type, count) {
  for (let i = 0; i < count; i++)
    deck.push({ type, value: rand(2, 14) });
}

function shuffle(arr) {
  for (let i = 0; i < arr.length; i++) {
    const r = Math.floor(Math.random() * arr.length);
    [arr[i], arr[r]] = [arr[r], arr[i]];
  }
}

function deal() {
  table.length = 0;
  for (let i = 0; i < 4; i++)
    table.push(deck.pop());
}

/* ---------- PLAY ---------- */

function playCard(i) {
  const card = table[i];

  if (navigator.vibrate) navigator.vibrate(30);

  if (card.type === "monster") {
    const dmg = Math.max(0, card.value - player.weapon);
    player.health -= dmg;
    message(`Monster hits for ${dmg}`);
  }

  if (card.type === "weapon") {
    player.weapon = card.value;
    message(`Weapon set to ${card.value}`);
  }

  if (card.type === "health") {
    player.health = Math.min(MAX_HEALTH, player.health + card.value);
    message(`Healed ${card.value}`);
  }

  table[i] = deck.pop();
  save();
  updateUI();
  checkEnd();
}

/* ---------- UI ---------- */

function updateUI() {
  healthEl.textContent = player.health;
  weaponEl.textContent = player.weapon;
  deckEl.textContent = deck.length;

  tableEl.innerHTML = "";
  table.forEach((card, i) => {
    const el = document.createElement("div");
    el.className = `card ${card.type}`;
    el.innerHTML = `
      <div class="type">${card.type}</div>
      <div class="value">${card.value}</div>
    `;
    el.onclick = () => playCard(i);
    tableEl.appendChild(el);
  });
}

function message(text) {
  messageEl.textContent = text;
}

/* ---------- END ---------- */

function checkEnd() {
  if (player.health <= 0) {
    end("💀 Game Over", "You did not survive.");
  }

  if (deck.length === 0) {
    end("🎉 Victory", "You survived the entire deck!");
  }
}

function end(title, text) {
  localStorage.removeItem(SAVE_KEY);
  endTitle.textContent = title;
  endText.textContent = text;
  show(endScreen);
}

/* ---------- SAVE ---------- */

function save() {
  localStorage.setItem(
    SAVE_KEY,
    JSON.stringify({ player, deck, table })
  );
}

function loadGame() {
  const data = JSON.parse(localStorage.getItem(SAVE_KEY));
  if (!data) return;

  ({ player, deck, table } = data);
  show(gameScreen);
  updateUI();
}

/* ---------- UTILS ---------- */

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
