const SAVE_KEY = "scoundrel-save";
const STATS_KEY = "scoundrel-stats";
const TUTORIAL_KEY = "scoundrel-tutorial-shown";

/* Difficulty */
const DIFFICULTY = {
  easy:   { maxHealth:24, monsters:26, weapons:14, health:12, bias:"low" },
  normal: { maxHealth:20, monsters:30, weapons:10, health:12, bias:"normal" },
  hard:   { maxHealth:18, monsters:34, weapons:8,  health:10, bias:"high" }
};

/* Screens */
const menu = document.getElementById("menu");
const game = document.getElementById("game");
const end = document.getElementById("end");
const tutorial = document.getElementById("tutorial");

/* UI */
const healthEl = document.getElementById("health");
const weaponEl = document.getElementById("weapon");
const deckEl = document.getElementById("deck");
const scoreEl = document.getElementById("score");
const tableEl = document.getElementById("table");
const messageEl = document.getElementById("message");
const statsEl = document.getElementById("stats");
const runStatsEl = document.getElementById("run-stats");

/* Controls */
const diffSelect = document.getElementById("difficulty");
const startBtn = document.getElementById("start");
const resumeBtn = document.getElementById("resume");
const restartBtn = document.getElementById("restart");

/* End */
const endTitle = document.getElementById("end-title");
const endText = document.getElementById("end-text");

/* State */
let cfg, player, deck, table, lastWeaponUse, run;

/* Persistent stats */
let meta = JSON.parse(localStorage.getItem(STATS_KEY)) || {
  runs:0, wins:0, losses:0, bestScore:0, bestClear:0
};

renderStats();

/* Init */
if (localStorage.getItem(SAVE_KEY)) resumeBtn.classList.remove("hidden");

startBtn.onclick = () => newGame(diffSelect.value);
resumeBtn.onclick = loadGame;
restartBtn.onclick = () => newGame(diffSelect.value);

tutorial.onclick = () => {
  tutorial.classList.add("hidden");
  localStorage.setItem(TUTORIAL_KEY, "1");
};

function show(s) {
  [menu, game, end].forEach(x => x.classList.remove("active"));
  s.classList.add("active");
}

/* ---------- Game ---------- */

function newGame(diff) {
  cfg = DIFFICULTY[diff];
  player = { health: cfg.maxHealth, weapon: 0 };
  lastWeaponUse = null;

  run = { monsters:0, damage:0, healed:0, weaponsBroken:0, cardsCleared:0, score:0 };

  deck = [];
  table = [];

  add("monster", cfg.monsters);
  add("weapon", cfg.weapons);
  add("health", cfg.health);
  shuffle(deck);

  deal();
  save();
  show(game);
  updateUI();

  if (!localStorage.getItem(TUTORIAL_KEY)) {
    tutorial.classList.remove("hidden");
  }
}

/* Deck */

function add(type, count) {
  for (let i = 0; i < count; i++) {
    let value = rand(2,14);
    if (cfg.bias === "low") value = rand(2,10);
    if (cfg.bias === "high") value = rand(6,14);
    deck.push({ type, value });
  }
}

function shuffle(a) {
  for (let i = 0; i < a.length; i++) {
    const r = Math.floor(Math.random() * a.length);
    [a[i], a[r]] = [a[r], a[i]];
  }
}

function deal() {
  table.length = 0;
  for (let i = 0; i < 4; i++) table.push(deck.pop());
}

/* Play */

function play(i) {
  const c = table[i];

  if (c.type === "monster") {
    let dmg;

    if (player.weapon > 0) {
      if (lastWeaponUse === null || c.value <= lastWeaponUse) {
        dmg = Math.max(0, c.value - player.weapon);
        lastWeaponUse = c.value;
      } else {
        dmg = c.value;
        player.weapon = 0;
        lastWeaponUse = null;
        run.weaponsBroken++;
      }
    } else {
      dmg = c.value;
    }

    player.health -= dmg;
    run.damage += dmg;
    run.monsters++;
  }

  if (c.type === "weapon") {
    player.weapon = c.value;
    lastWeaponUse = null;
  }

  if (c.type === "health") {
    const before = player.health;
    player.health = Math.min(cfg.maxHealth, player.health + c.value);
    run.healed += player.health - before;
  }

  run.cardsCleared++;
  table[i] = deck.pop();
  updateScore();
  save();
  updateUI();
  checkEnd();
}

/* UI */

function updateUI() {
  healthEl.textContent = player.health;
  weaponEl.textContent = player.weapon || "-";
  deckEl.textContent = deck.length;
  scoreEl.textContent = run.score;

  tableEl.innerHTML = "";
  table.forEach((c, i) => {
    const el = document.createElement("div");
    el.className = `card ${c.type}`;

    let hint = "";

    if (c.type === "monster") {
      let dmg = c.value;

      if (player.weapon > 0) {
        if (lastWeaponUse === null || c.value <= lastWeaponUse) {
          dmg = Math.max(0, c.value - player.weapon);
          el.classList.add("usable");
          hint = `🗡 ${dmg} dmg`;
        } else {
          el.classList.add("breaks");
          hint = `💥 ${c.value} dmg`;
        }
      } else {
        hint = `🩸 ${c.value} dmg`;
      }
    }

    el.innerHTML = `
      <div class="type">${c.type}</div>
      <div class="value">${c.value}</div>
      ${hint ? `<div class="hint">${hint}</div>` : ""}
    `;
    el.onclick = () => play(i);
    tableEl.appendChild(el);
  });
}

/* Score */

function updateScore() {
  run.score =
    run.monsters * 10 +
    run.cardsCleared * 2 -
    run.damage +
    run.healed;
}

/* End */

function checkEnd() {
  if (player.health <= 0) finish(false);
  if (deck.length === 0) finish(true);
}

function finish(win) {
  meta.runs++;
  win ? meta.wins++ : meta.losses++;
  meta.bestScore = Math.max(meta.bestScore, run.score);
  meta.bestClear = Math.max(meta.bestClear, run.cardsCleared);
  localStorage.setItem(STATS_KEY, JSON.stringify(meta));
  localStorage.removeItem(SAVE_KEY);

  endTitle.textContent = win ? "🎉 Victory" : "💀 Game Over";
  endText.textContent = `Score: ${run.score}`;

  runStatsEl.innerHTML = `
    Monsters: ${run.monsters}<br>
    Damage Taken: ${run.damage}<br>
    Healing: ${run.healed}<br>
    Weapons Broken: ${run.weaponsBroken}
  `;

  renderStats();
  show(end);
}

/* Save */

function save() {
  localStorage.setItem(SAVE_KEY,
    JSON.stringify({ player, deck, table, lastWeaponUse, run, cfg })
  );
}

function loadGame() {
  const d = JSON.parse(localStorage.getItem(SAVE_KEY));
  ({ player, deck, table, lastWeaponUse, run, cfg } = d);
  show(game);
  updateUI();
}

/* Stats */

function renderStats() {
  statsEl.innerHTML = `
    Runs: ${meta.runs}<br>
    Wins: ${meta.wins}<br>
    Best Score: ${meta.bestScore}<br>
    Best Clear: ${meta.bestClear}
  `;
}

/* Util */

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
