document.addEventListener("DOMContentLoaded", () => {

  /* ---------- SAFE STORAGE ---------- */

  function safeParse(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      if (!v) return fallback;
      return JSON.parse(v);
    } catch (e) {
      console.warn(`Corrupted storage for ${key}, resetting.`);
      localStorage.removeItem(key);
      return fallback;
    }
  }

  const SAVE_KEY = "scoundrel-save";
  const STATS_KEY = "scoundrel-stats";

  /* ---------- DIFFICULTY SETTINGS ---------- */

  const DIFFICULTY = {
    easy: {
      name: "Easy",
      startHealth: 22,
      monsters: 22,
      weapons: 11,
      potions: 11
    },
    normal: {
      name: "Normal",
      startHealth: 20,
      monsters: 26,
      weapons: 9,
      potions: 9
    },
    hard: {
      name: "Hard",
      startHealth: 16,
      monsters: 30,
      weapons: 7,
      potions: 7
    }
  };

  let currentDifficulty = "normal";

  /* ---------- LOG TEMPLATES ---------- */

  const LOG_TEMPLATES = {
    combat: {
      barehanded: [
        "You fought the beast (Strength {monster}) with your bare hands. It cost you {damage} health.",
        "Without a weapon, you were forced to grapple with the monster ({monster}). You took {damage} damage.",
        "The creature ({monster}) lunged. You defeated it, but bled for {damage} health.",
        "Flesh met claw. You overcame the monster ({monster}), but not without injury (-{damage} HP)."
      ],
      weapon: [
        "Your weapon ({wPower}) struck true, slaying the monster ({monster}). The impact jarred you for {damage} damage.",
        "With a swift strike of your blade ({wPower}), you ended the beast's ({monster}) life. You took {damage} damage in the clash.",
        "Steel met scale. Your weapon ({wPower}) prevailed against the monster ({monster}), mitigating the harm to {damage}.",
        "You parried and riposted with your weapon ({wPower}), defeating the foe ({monster}). You suffered {damage} damage."
      ]
    },
    equip: [
      "You equipped a weapon of power {power}. It feels balanced in your hand.",
      "A sturdy weapon (Power {power}) caught your eye. You discarded your old gear for it.",
      "You found a blade of quality {power}. Let's hope it stays sharp.",
      "Armed with a new weapon (Power {power}), you feel ready for what lies ahead."
    ],
    heal: [
      "You drank the potion and recovered {value} health.",
      "The bitter liquid knitted your wounds. +{value} HP.",
      "Refreshing vitality surged through you as you downed the potion. (+{value} HP)",
      "A moment of respite. The potion restored {value} health."
    ],
    run: [
      "You slipped away into the shadows. The room is left behind.",
      "Sensing danger, you avoided the room. The dungeon shifts around you.",
      "You chose discretion over valor and bypassed the room."
    ],
    weaponBlocked: [
      "Your weapon is bound by the blood of a weaker foe. Last kill: {lastSlain}.",
      "You cannot use this weapon; it refuses to strike a stronger beast than the last ({lastSlain}).",
      "The blade is dull to this mighty foe. You must face it alone. (Limit: {lastSlain})"
    ]
  };

  /* ---------- STATE ---------- */

  let deck = [];
  let room = [];
  let carry = null;
  let canRun = true;
  let usedPotion = false;
  let selectedMonster = null;
  let logLines = [];

  const player = {
    health: DIFFICULTY.normal.startHealth,
    weapon: null
  };

  const stats = safeParse(STATS_KEY, {
    bestScore: 0,
    games: 0,
    wins: 0,
    losses: 0
  });

  /* ---------- DOM ---------- */

  const roomEl = document.getElementById("room");
  const logEl = document.getElementById("log");
  const runStatusEl = document.getElementById("run-status");
  const resumeBtn = document.getElementById("resume");
  const fightHandsBtn = document.getElementById("fight-hands");
  const fightWeaponBtn = document.getElementById("fight-weapon");

  /* ---------- RESUME VALIDATION ---------- */

  const saved = safeParse(SAVE_KEY, null);
  if (saved && canResumeGame(saved)) {
    resumeBtn.classList.remove("hidden");
  } else {
    localStorage.removeItem(SAVE_KEY);
  }

  /* ---------- MENU ---------- */

  renderMenuStats();

  document.getElementById("start").onclick = newGame;
  document.getElementById("resume").onclick = resumeGame;
  document.getElementById("run").onclick = runRoom;
  document.getElementById("back-menu").onclick = () => show("menu");

  /* ---------- DIFFICULTY SELECTION ---------- */

  document.querySelectorAll(".difficulty-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".difficulty-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentDifficulty = btn.dataset.difficulty;
    };
  });

  /* ---------- GAME FLOW ---------- */

  function newGame() {
    const diff = DIFFICULTY[currentDifficulty];

    stats.games++;
    saveStats();

    buildDeck();
    shuffle(deck);

    player.health = diff.startHealth;
    player.weapon = null;
    carry = null;
    canRun = true;

    drawRoom();
    updateUI();
    show("game");
    saveGame();
  }

  function resumeGame() {
    const data = safeParse(SAVE_KEY, null);
    if (!data || !canResumeGame(data)) return;

    currentDifficulty = data.difficulty || "normal";
    Object.assign(player, data.player);
    deck = data.deck;
    room = data.room;
    carry = data.carry;
    canRun = data.canRun;

    updateUI();
    renderRoom();
    show("game");
  }

  /* ---------- DECK ---------- */

  function buildDeck() {
    const diff = DIFFICULTY[currentDifficulty];
    deck = [];
    for (let i = 0; i < diff.monsters; i++) deck.push(card("monster"));
    for (let i = 0; i < diff.weapons; i++) deck.push(card("weapon"));
    for (let i = 0; i < diff.potions; i++) deck.push(card("health"));
  }

  function card(type) {
    return { type, value: rand(2, 14), img: rand(1, 3) };
  }

  /* ---------- ROOM ---------- */

  function drawRoom() {
    usedPotion = false;
    selectedMonster = null;
    logLines = [];
    updateLog();

    room = [];
    if (carry) room.push(carry);
    while (room.length < 4 && deck.length) room.push(deck.shift());

    updateActionButtons();
    renderRoom();
  }

  function runRoom() {
    if (!canRun) return;
    if (deck.length === 0) return;

    deck = deck.concat(room);
    room = [];
    carry = null;
    canRun = false;

    addLog('run');
    updateLog();

    drawRoom();
    updateUI();
    saveGame();
  }

  /* ---------- PLAY ---------- */

  function playCard(i) {
    const c = room[i];

    if (c.type === "monster") {
      selectedMonster = selectedMonster === i ? null : i;
      updateActionButtons();
      renderRoom();
      return;
    }

    if (c.type === "weapon") equipWeapon(i);
    if (c.type === "health") drinkPotion(i);
  }

  /* ---------- COMBAT ---------- */

  function fight(monster, useWeapon) {
    let dmg = monster.value;

    if (useWeapon && player.weapon) {
      dmg = Math.max(0, monster.value - player.weapon.power);
      player.weapon.lastSlain = monster.value;
      addLog("combat.weapon", { monster: monster.value, wPower: player.weapon.power, damage: dmg });
    } else {
      addLog("combat.barehanded", { monster: monster.value, damage: dmg });
    }

    player.health -= dmg;
    updateLog();
  }

  /* ---------- CARDS ---------- */

  function equipWeapon(i) {
    player.weapon = { power: room[i].value, lastSlain: null };
    addLog("equip", { power: room[i].value });
    updateLog();
    room.splice(i, 1);
    afterPlay();
  }

  function drinkPotion(i) {
    if (!usedPotion) {
      const maxHealth = DIFFICULTY[currentDifficulty].startHealth;
      player.health = Math.min(maxHealth, player.health + room[i].value);
      addLog("heal", { value: room[i].value });
      usedPotion = true;
    } else {
      logLines.push("Extra potion discarded.");
    }
    updateLog();
    room.splice(i, 1);
    afterPlay();
  }

  /* ---------- ACTION BUTTONS ---------- */

  fightHandsBtn.onclick = () => {
    if (selectedMonster === null) return;
    fight(room[selectedMonster], false);
    room.splice(selectedMonster, 1);
    selectedMonster = null;
    afterPlay();
  };

  fightWeaponBtn.onclick = () => {
    if (selectedMonster === null) return;

    const m = room[selectedMonster];
    if (!canUseWeapon(m)) {
      addLog("weaponBlocked", { lastSlain: player.weapon.lastSlain });
      updateLog();
      return;
    }

    fight(m, true);
    room.splice(selectedMonster, 1);
    selectedMonster = null;
    afterPlay();
  };

  function updateActionButtons() {
    if (selectedMonster === null) {
      fightHandsBtn.classList.add("hidden");
      fightWeaponBtn.classList.add("hidden");
      return;
    }

    fightHandsBtn.classList.remove("hidden");

    if (player.weapon) {
      fightWeaponBtn.classList.remove("hidden");
      canUseWeapon(room[selectedMonster])
        ? fightWeaponBtn.classList.remove("disabled")
        : fightWeaponBtn.classList.add("disabled");
    } else {
      fightWeaponBtn.classList.add("hidden");
    }
  }

  /* ---------- FLOW ---------- */

  function afterPlay() {
    if (room.length === 1) {
      carry = room[0];
      canRun = true;
      drawRoom();
    } else {
      renderRoom();
    }

    updateUI();
    checkEnd();
    saveGame();
  }

  /* ---------- UI ---------- */

  function renderRoom() {
    roomEl.innerHTML = "";
    room.forEach((c, i) => {
      const el = document.createElement("div");
      el.className = `card ${c.type}`;
      el.style.setProperty("--bg", `url(icons/${c.type}${c.img}.webp)`);

      if (c.type === "monster" && selectedMonster === i) el.classList.add("selected");

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
    document.getElementById("deck").textContent = deck.length;
    document.getElementById("weapon").textContent =
      player.weapon
        ? `${player.weapon.power} (Effective Against Monsters ≤ ${player.weapon.lastSlain ?? "∞"})`
        : "-";
    runStatusEl.textContent = canRun ? "RUN AVAILABLE" : "RUN USED";
  }

  function updateLog() {
    logEl.innerHTML = logLines.join("<br>");
  }

  /* ---------- END ---------- */

  function checkEnd() {
    // Loss condition (immediate)
    if (player.health <= 0) {
      endGame(false);
      return;
    }

    // Win condition (strict tabletop parity)
    if (deck.length === 0 && room.length === 0) {
      endGame(true);
      return;
    }
  }


  function endGame(win) {
    localStorage.removeItem(SAVE_KEY);
    resumeBtn.classList.add("hidden");

    let score = win ? player.health :
      -deck.filter(c => c.type === "monster").reduce((s, m) => s + m.value, 0);

    win ? stats.wins++ : stats.losses++;
    stats.bestScore = Math.max(stats.bestScore, score);
    saveStats();

    document.getElementById("end-title").textContent = win ? "Victory" : "Game Over";
    document.getElementById("end-score").textContent = `Score: ${score}`;
    document.getElementById("end-stats").innerHTML =
      `Best: ${stats.bestScore}<br>Games: ${stats.games}<br>Wins: ${stats.wins} | Losses: ${stats.losses}`;

    show("end");
  }

  /* ---------- UTIL ---------- */

  function saveGame() {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ player, deck, room, carry, canRun, difficulty: currentDifficulty }));
  }

  function saveStats() {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }

  function renderMenuStats() {
    document.getElementById("menu-stats").innerHTML =
      `Best: ${stats.bestScore}<br>Games: ${stats.games}<br>Wins: ${stats.wins} | Losses: ${stats.losses}`;
  }

  function canResumeGame(data) {
    return data.player.health > 0 && (data.deck.length + data.room.length) > 3;
  }

  function canUseWeapon(monster) {
    if (!player.weapon) return false;
    const last = player.weapon.lastSlain;
    return last === null || monster.value <= last;
  }

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

  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function addLog(category, data = {}) {
    const keys = category.split(".");
    let templateList = LOG_TEMPLATES;
    for (const k of keys) templateList = templateList[k];

    if (!templateList || !Array.isArray(templateList)) return;

    let text = templateList[Math.floor(Math.random() * templateList.length)];

    Object.keys(data).forEach(key => {
      text = text.replace(new RegExp(`{${key}}`, "g"), data[key]);
    });

    logLines.push(text);
  }

});
