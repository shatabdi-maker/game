// ─── DOM refs ───────────────────────────────────────────────────
const gridElement      = document.getElementById("grid");
const coinsElement     = document.getElementById("coins");
const levelElement     = document.getElementById("level");
const timerElement     = document.getElementById("timer");
const messageElement   = document.getElementById("message");
const celebration      = document.getElementById("celebration");
const celebTitle       = document.getElementById("celebTitle");
const celebSub         = document.getElementById("celebSub");
const gameover         = document.getElementById("gameover");
const progressFill     = document.getElementById("progressFill");
const progressText     = document.getElementById("progressText");
const totalTimeDisplay = document.getElementById("totalTimeDisplay");
const countdownFill = document.getElementById("countdownFill");
const countdownSec  = document.getElementById("countdownSec");
const canvas           = document.getElementById("confettiCanvas");
const ctx              = canvas.getContext("2d");

const MAX_LEVEL = 25;

// ─── State (localStorage backed) ────────────────────────────────
let tiles        = [];
let selectedTile = null;
let coins        = parseInt(localStorage.getItem("pg_coins") ?? "50");
let level        = parseInt(localStorage.getItem("pg_level") ?? "1");
let timer        = 0;
let totalTime    = parseInt(localStorage.getItem("pg_totalTime") ?? "0");
let timerInterval;
let countdownInterval;
let countdownMax = 60;
let countdownLeft = 60;
let confettiAnim;
let particles    = [];

function saveProgress() {
  localStorage.setItem("pg_coins",     coins);
  localStorage.setItem("pg_level",     level);
  localStorage.setItem("pg_totalTime", totalTime);
}

// ─── Balloons ───────────────────────────────────────────────────
const BALLOON_COLORS = [
  "#ff4b6e","#ff9f43","#ffd700","#26de81","#45aaf2",
  "#a55eea","#ff6b9d","#00f0ff","#ff00c8","#7bed9f"
];

function launchBalloons(count = 18) {
  // Remove any existing balloons
  document.querySelectorAll(".balloon").forEach(b => b.remove());

  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const b = document.createElement("div");
      b.classList.add("balloon");
      const color = BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)];
      b.style.background = color;
      b.style.left = (Math.random() * 90 + 5) + "vw";
      b.style.setProperty("--sway", (Math.random() * 80 - 40) + "px");
      b.style.animationDuration = (3.5 + Math.random() * 2) + "s";
      b.style.animationDelay    = "0s";
      b.style.width  = (50 + Math.random() * 30) + "px";
      b.style.height = (65 + Math.random() * 30) + "px";
      document.body.appendChild(b);
      // Remove after animation
      setTimeout(() => b.remove(), 6000);
    }, i * 120);
  }
}

// ─── Confetti ───────────────────────────────────────────────────
function startConfetti() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  particles = [];
  for (let i = 0; i < 180; i++) {
    particles.push({
      x:     Math.random() * canvas.width,
      y:     Math.random() * canvas.height - canvas.height,
      size:  Math.random() * 7 + 2,
      speed: Math.random() * 3 + 2,
      color: `hsl(${Math.random() * 360},100%,60%)`
    });
  }
  cancelAnimationFrame(confettiAnim);
  animateConfetti();
}

function animateConfetti() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
    p.y += p.speed;
    if (p.y > canvas.height) p.y = -10;
  });
  confettiAnim = requestAnimationFrame(animateConfetti);
}

function stopConfetti() {
  cancelAnimationFrame(confettiAnim);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles = [];
}

// ─── Win check ──────────────────────────────────────────────────
function checkWin() {
  for (let i = 0; i < tiles.length - 1; i++) {
    if (tiles[i] !== i + 1) return;
  }
  if (tiles[tiles.length - 1] !== "") return;

  clearInterval(timerInterval);
  clearInterval(countdownInterval);
  totalTime += timer;

  // Coin reward: more coins for faster completion
  const reward = Math.max(5, 20 - Math.floor(timer / 10));
  coins += reward;
  saveProgress();

  if (level >= MAX_LEVEL) {
    // ── All levels complete ─────────────────────────────────────
    startConfetti();
    totalTimeDisplay.textContent = totalTime;
    gameover.classList.remove("hidden");
    updateUI();
    return;
  }

  // ── Normal level complete ────────────────────────────────────
  celebTitle.textContent = `✦ Level ${level} Complete!`;
  celebSub.textContent   = `+${reward} coins • Loading level ${level + 1}...`;
  celebration.classList.remove("hidden");
  startConfetti();
  launchBalloons(18);
  updateUI();

  level++;
  saveProgress();

  setTimeout(() => {
    stopConfetti();
    celebration.classList.add("hidden");
    initGame();
  }, 3000);
}

// ─── Shuffle (proper Fisher-Yates) ──────────────────────────────
function shuffle(array, times) {
  for (let t = 0; t < times; t++) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}

// ─── Init ────────────────────────────────────────────────────────
function initGame() {
  tiles = [];
  for (let i = 1; i <= 49; i++) tiles.push(i);
  tiles.push("");

  // More shuffles at higher levels
  shuffle(tiles, level * 8);

  selectedTile = null;
  timer = 0;

  // Countdown: starts at 80s for level 1, decreases by 2s per level (min 20s)
  countdownMax  = Math.max(20, 80 - (level - 1) * 2);
  countdownLeft = countdownMax;

  clearInterval(timerInterval);
  clearInterval(countdownInterval);

  timerInterval = setInterval(() => {
    timer++;
    timerElement.textContent = timer;
  }, 1000);

  countdownInterval = setInterval(() => {
    countdownLeft--;
    updateCountdown();
    if (countdownLeft <= 0) {
      // Auto shuffle board
      shuffle(tiles, 6);
      renderGrid();
      countdownLeft = countdownMax; // reset countdown
      messageElement.textContent = "⚡ Board shuffled!";
      setTimeout(() => { messageElement.textContent = ""; }, 1500);
      gridElement.classList.add("shuffle-flash");
      setTimeout(() => gridElement.classList.remove("shuffle-flash"), 500);
    }
  }, 1000);

  updateUI();
  renderGrid();
  messageElement.textContent = "";
}

// ─── Reset (play again from level 1) ────────────────────────────
function resetGame() {
  level     = 1;
  coins     = 50;
  totalTime = 0;
  saveProgress();
  clearInterval(countdownInterval);
  gameover.classList.add("hidden");
  stopConfetti();
  initGame();
}

// ─── Render ──────────────────────────────────────────────────────
function renderGrid() {
  gridElement.innerHTML = "";
  tiles.forEach((value, index) => {
    const tile = document.createElement("div");
    tile.classList.add("tile");
    if (value === "") {
      tile.classList.add("empty");
    } else {
      // Highlight tiles already in correct position
      if (value === index + 1) tile.classList.add("correct");
    }
    if (index === selectedTile) tile.classList.add("selected");
    tile.textContent = value;
    tile.onclick = () => selectTile(index);
    gridElement.appendChild(tile);
  });
}

// ─── Select / Swap ───────────────────────────────────────────────
function selectTile(index) {
  if (tiles[index] === "" && selectedTile === null) return; // don't select empty
  if (selectedTile === null) {
    selectedTile = index;
    renderGrid();
  } else {
    if (selectedTile === index) {
      selectedTile = null;
      renderGrid();
      return;
    }
    [tiles[selectedTile], tiles[index]] = [tiles[index], tiles[selectedTile]];
    selectedTile = null;
    renderGrid();
    checkWin();
  }
}

// ─── Spin powerup ────────────────────────────────────────────────
function spinGrid() {
  if (coins < 10) {
    messageElement.textContent = "⚠ Not enough coins!";
    setTimeout(() => messageElement.textContent = "", 2000);
    return;
  }
  coins -= 10;
  saveProgress();
  updateUI();

  gridElement.style.transition = "transform 0.5s ease";
  gridElement.style.transform  = "rotate(360deg)";
  setTimeout(() => {
    gridElement.style.transform = "rotate(0deg)";
    shuffle(tiles, 5);
    renderGrid();
  }, 500);
}

// ─── Countdown bar update ────────────────────────────────────────
function updateCountdown() {
  const pct = (countdownLeft / countdownMax) * 100;
  countdownFill.style.width = pct + "%";
  countdownSec.textContent  = countdownLeft;
  // Color: green → yellow → red
  if (pct > 50)       countdownFill.style.background = "var(--accent)";
  else if (pct > 25)  countdownFill.style.background = "var(--gold)";
  else                countdownFill.style.background = "var(--accent2)";
}

// ─── Update UI ───────────────────────────────────────────────────
function updateUI() {
  coinsElement.textContent = coins;
  levelElement.textContent = level;
  timerElement.textContent = timer;

  const pct = Math.round((level / MAX_LEVEL) * 100);
  progressFill.style.width = pct + "%";
  progressText.textContent = `${level} / ${MAX_LEVEL}`;
}

// ─── Start ───────────────────────────────────────────────────────
initGame();