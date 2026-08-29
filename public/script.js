/* ============================================================================
   ZOMBS: OUTBREAK
   Top-down survival base-builder. Gather by day, defend by night.
   Single-file vanilla JS + Canvas2D. No build step required.
   ============================================================================ */

(() => {
"use strict";

/* ============================== CONFIG ============================== */
const CONFIG = {
  WORLD_SIZE: 3600,
  DAY_MS: 100000,
  NIGHT_MS: 52000,
  AUTOSAVE_MS: 20000,
  SAVE_KEY: "zombsOutbreak_save_v1",
  BASE_RADIUS: 260,          // safe-ish zone around spawn where nodes are sparse
  PLAYER_RADIUS: 16,
  PLACE_RANGE: 140,
  GRID: 36,
};

/* ============================== UTIL ============================== */
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
const lerp = (a, b, t) => a + (b - a) * t;
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ============================== DATA: WEAPONS ============================== */
// order = hotbar order. type: 'melee' | 'ranged'
const WEAPONS = {
  fists:   { name:"Fists",    icon:"👊", type:"melee",  damage:5,  range:44, arc:1.1, cooldown:420, cost:0, order:1,
             harvest:{ tree:{wood:1,leaf:1}, rock:{stone:1}, ore:{metal:1} } },
  hatchet: { name:"Hatchet",  icon:"🪓", type:"melee",  damage:14, range:50, arc:1.0, cooldown:480, cost:0, order:2,
             harvest:{ tree:{wood:3,leaf:2}, rock:{stone:2}, ore:{metal:1} } },
  pickaxe: { name:"Pickaxe",  icon:"⛏",  type:"melee",  damage:10, range:50, arc:1.0, cooldown:460, cost:20, order:3,
             harvest:{ tree:{wood:1,leaf:1}, rock:{stone:9}, ore:{metal:7} } },
  // Starter ranged weapon. Tap = quick weak shot, hold to charge for more damage. Uses arrows (ammo).
  bow:     { name:"Bow",      icon:"🏹", type:"bow", cost:0, order:4, ammoCost:1, bulletSpeed:780,
             minDmg:5, midDmgMin:10, midDmgMax:15, maxDmg:20, minChargeMs:180, maxChargeMs:750 },
  pistol:  { name:"Pistol",   icon:"🔫", type:"ranged", damage:11, cooldown:290, bulletSpeed:640, spread:0.05, ammoCost:1, cost:50,  order:5 },
  smg:     { name:"SMG",      icon:"💥", type:"ranged", damage:6,  cooldown:95,  bulletSpeed:680, spread:0.13, ammoCost:1, cost:110, order:6 },
  shotgun: { name:"Shotgun",  icon:"✹",  type:"ranged", damage:9,  pellets:6, cooldown:680, bulletSpeed:600, spread:0.38, ammoCost:3, cost:160, order:7 },
  rifle:   { name:"Rifle",    icon:"🎯", type:"ranged", damage:20, cooldown:240, bulletSpeed:760, spread:0.04, ammoCost:2, cost:250, order:8 },
  sniper:  { name:"Sniper",   icon:"🔭", type:"ranged", damage:65, cooldown:1150,bulletSpeed:1100,spread:0.008,ammoCost:4, cost:380, order:9 },
  rocket:  { name:"Rocket",   icon:"🚀", type:"ranged", damage:75, splash:85, cooldown:1450, bulletSpeed:480, spread:0.02, ammoCost:8, cost:600, order:10 },
};
const WEAPON_ORDER = Object.keys(WEAPONS).sort((a,b)=>WEAPONS[a].order-WEAPONS[b].order);

/* ============================== DATA: ENEMIES ============================== */
const ENEMY_TYPES = {
  zombie:  { name:"Zombie",   hp:20,  speed:52,  damage:9,  gold:10, radius:14, color:"#5fae3d", minWave:1 },
  runner:  { name:"Runner",   hp:10,  speed:108, damage:6,  gold:20, radius:11, color:"#e0c93f", minWave:2 },
  brute:   { name:"Brute",    hp:150, speed:34,  damage:24, gold:20, radius:21, color:"#8a5a3d", minWave:3 },
  spitter: { name:"Spitter",  hp:38,  speed:46,  damage:8,  gold:20, radius:13, color:"#9b5fd6", minWave:4,
             ranged:true, projSpeed:340, atkRange:230, atkCooldown:1700 },
  boomer:  { name:"Boomer",   hp:22,  speed:58,  damage:2,  gold:20, radius:15, color:"#e2574c", minWave:3,
             explode:true, explodeDamage:38, explodeRadius:80 },
  boss:    { name:"Zomb King",hp:1900,speed:26,  damage:46, gold:350,radius:42, color:"#7a1015", minWave:5, boss:true },
};

/* ============================== DATA: BUILDINGS ============================== */
const BUILDING_TYPES = {
  woodWall:  { name:"Wood Wall",  icon:"▦", hp:90,  cost:{wood:6},             size:34, color:"#8d6e4a", upgradeTo:"stoneWall" },
  stoneWall: { name:"Stone Wall", icon:"▦", hp:220, cost:{stone:10},           size:34, color:"#9aa0a6", upgradeTo:"metalWall" },
  metalWall: { name:"Metal Wall", icon:"▦", hp:480, cost:{metal:12},           size:34, color:"#6f8493" },
  spike:     { name:"Spike Trap", icon:"✳",  hp:65,  cost:{wood:5,stone:3},    size:28, color:"#b1443b", damage:16, trap:true },
  turret:    { name:"Auto Turret",icon:"⛭",  hp:160, cost:{metal:20,gold:16},  size:32, color:"#e0a831", turret:true, range:270, damage:13, cooldown:520, bulletSpeed:700 },
  mortar:    { name:"Mortar",     icon:"◉",  hp:220, cost:{metal:40,gold:50},  size:36, color:"#7a5a3a", turret:true, range:360, damage:48, splash:65, cooldown:1650, bulletSpeed:420 },
  campfire:  { name:"Campfire",   icon:"🔥", hp:60,  cost:{wood:10,stone:6},   size:26, color:"#e0763a", heal:true, healRange:120, healAmount:4, healInterval:1000 },
};
const BUILDING_ORDER = ["woodWall","stoneWall","metalWall","spike","turret","mortar","campfire"];

/* ============================== DATA: SURVIVOR UPGRADES ============================== */
const UPGRADES = {
  health: { name:"Max Health", icon:"❤", base:25, growth:1.4,  max:8, effect:"+20 max HP", per:20 },
  speed:  { name:"Move Speed", icon:"👟", base:30, growth:1.42, max:6, effect:"+6% speed",  per:0.06 },
  armor:  { name:"Armor",      icon:"🛡", base:35, growth:1.42, max:6, effect:"-5% dmg taken", per:0.05 },
  harvest:{ name:"Harvesting", icon:"💪", base:28, growth:1.4,  max:5, effect:"+15% harvest",per:0.15 },
};

/* ============================== GLOBAL STATE ============================== */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const mmCanvas = document.getElementById("minimapCanvas");
const mmCtx = mmCanvas.getContext("2d");

// Player idle sprite sheet: 4 cols x 2 rows, 32x32 frames.
// Row 0 = facing left (blink cycle), Row 1 = facing right (blink cycle).
const SPR = { fw:32, fh:32, cols:4, rows:2 };
const playerImg = new Image(); playerImg.src = "assets/player_idle.png";
// Bow charge sprite sheet: 4 cols x 2 rows, 16x16 frames (draw stages 0..3).
// Row 0 = facing right, Row 1 = facing left.
const BOWSPR = { fw:16, fh:16, cols:4, rows:2 };
const bowImg = new Image(); bowImg.src = "assets/bow_charge.png";

let W = window.innerWidth, H = window.innerHeight;
function resize() {
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W; canvas.height = H;
  mmCanvas.width = mmCanvas.clientWidth; mmCanvas.height = mmCanvas.clientHeight;
}
window.addEventListener("resize", resize);

const keys = {};
const mouse = { x: 0, y: 0, down: false, worldX: 0, worldY: 0 };

const G = {
  running: false,
  paused: false,
  seed: 1,
  rngFn: Math.random,
  time: 0,
  day: 1,
  phase: "day",          // 'day' | 'night'
  phaseTimer: CONFIG.DAY_MS,
  phaseTotal: CONFIG.DAY_MS,
  wave: 0,
  waveEnemiesLeftToSpawn: 0,
  waveSpawnTimer: 0,
  waveActive: false,
  camera: { x: 0, y: 0 },
  mode: "play",           // 'play' | 'build'
  buildSelection: null,
  player: null,
  buildings: [],
  enemies: [],
  bullets: [],
  particles: [],
  floaters: [],
  nodes: [],
  kills: 0,
  lastAutosave: 0,
  gameOver: false,
};

/* ============================== PLAYER FACTORY ============================== */
function newPlayer() {
  return {
    x: CONFIG.WORLD_SIZE/2, y: CONFIG.WORLD_SIZE/2,
    hp: 100, maxHp: 100,
    baseSpeed: 190,
    facing: 0,
    moving: false,
    wood: 25, stone: 12, metal: 8, leaf: 10, gold: 0, ammo: 12,
    weapons: ["fists","hatchet","bow"],
    currentWeapon: "bow",
    lastAttack: 0,
    charging: false, chargeStart: 0,
    upgrades: { health:0, speed:0, armor:0, harvest:0 },
    alive: true,
  };
}
function playerSpeed(p){ return p.baseSpeed * (1 + p.upgrades.speed*UPGRADES.speed.per); }
function playerMaxHp(p){ return 100 + p.upgrades.health*UPGRADES.health.per; }
function playerArmor(p){ return p.upgrades.armor*UPGRADES.armor.per; }
function playerHarvestMult(p){ return 1 + p.upgrades.harvest*UPGRADES.harvest.per; }

/* ============================== WORLD GEN ============================== */
function generateWorld(seed) {
  const rng = mulberry32(seed);
  const nodes = [];
  const size = CONFIG.WORLD_SIZE;
  const cx = size/2, cy = size/2;
  function place(type, count, hp) {
    let placed = 0, tries = 0;
    while (placed < count && tries < count*20) {
      tries++;
      const x = rng()*size, y = rng()*size;
      if (dist(x,y,cx,cy) < CONFIG.BASE_RADIUS) continue;
      nodes.push({ id: nodes.length, type, x, y, hp, maxHp: hp, radius: type==="tree"?17:15, respawnAt:0 });
      placed++;
    }
  }
  place("tree", 100, 60);
  place("rock", 65, 70);
  place("ore", 38, 80);
  return nodes;
}

/* ============================== NEW GAME / LOAD ============================== */
function newGame() {
  G.seed = Math.floor(Math.random()*1e9);
  G.nodes = generateWorld(G.seed);
  G.player = newPlayer();
  G.buildings = [];
  G.enemies = []; G.bullets = []; G.particles = []; G.floaters = [];
  G.day = 1; G.phase = "day"; G.phaseTimer = CONFIG.DAY_MS; G.phaseTotal = CONFIG.DAY_MS;
  G.wave = 0; G.waveActive = false; G.waveEnemiesLeftToSpawn = 0;
  G.kills = 0; G.gameOver = false; G.mode = "play"; G.buildSelection = null;
  G.running = true; G.paused = false;
  showScreen(null);
  buildHotbar(); buildBuildMenu(); buildUpgradeTabs();
  updateUI();
  toast("Welcome, survivor. Gather resources before nightfall.");
}

function serialize() {
  const p = G.player;
  return {
    version: 1, saved: Date.now(), seed: G.seed,
    day: G.day, phase: G.phase, phaseTimer: G.phaseTimer, phaseTotal: G.phaseTotal,
    wave: G.wave, kills: G.kills,
    player: {
      x:p.x, y:p.y, hp:p.hp, upgrades:p.upgrades,
      wood:p.wood, stone:p.stone, metal:p.metal, leaf:p.leaf, gold:p.gold, ammo:p.ammo,
      weapons:p.weapons, currentWeapon:p.currentWeapon,
    },
    buildings: G.buildings.map(b => ({ type:b.type, x:b.x, y:b.y, hp:b.hp })),
  };
}
function loadFromData(data) {
  if (!data || data.version !== 1) { toast("Invalid or incompatible save file.", true); return false; }
  G.seed = data.seed || 1;
  G.nodes = generateWorld(G.seed);
  G.day = data.day || 1;
  G.phase = data.phase || "day";
  G.phaseTimer = data.phaseTimer ?? CONFIG.DAY_MS;
  G.phaseTotal = data.phaseTotal ?? CONFIG.DAY_MS;
  G.wave = data.wave || 0;
  G.kills = data.kills || 0;
  G.waveActive = false; G.waveEnemiesLeftToSpawn = 0;
  const p = newPlayer();
  Object.assign(p, data.player);
  if (p.leaf === undefined) p.leaf = 10;
  p.weapons = (p.weapons||["fists","hatchet","bow"]).map(k => k==="axe" ? "hatchet" : k);
  if (p.currentWeapon === "axe") p.currentWeapon = "hatchet";
  if (!WEAPONS[p.currentWeapon]) p.currentWeapon = p.weapons[0] || "fists";
  p.charging = false;
  p.maxHp = playerMaxHp(p);
  p.hp = clamp(data.player.hp, 1, p.maxHp);
  G.player = p;
  G.buildings = (data.buildings||[]).map(b => ({ ...b, maxHp: BUILDING_TYPES[b.type].hp, cooldownT:0, healT:0 }));
  G.enemies = []; G.bullets = []; G.particles = []; G.floaters = [];
  G.gameOver = false; G.mode = "play"; G.buildSelection = null;
  G.running = true; G.paused = false;
  showScreen(null);
  buildHotbar(); buildBuildMenu(); buildUpgradeTabs();
  updateUI();
  toast(`Save loaded — Day ${G.day}, Wave ${G.wave}.`);
  return true;
}
function saveToLocalStorage() {
  try { localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(serialize())); }
  catch(e){ /* storage unavailable — ignore */ }
}
function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(CONFIG.SAVE_KEY);
    if (!raw) return false;
    return loadFromData(JSON.parse(raw));
  } catch(e){ return false; }
}
function saveToFile() {
  const data = serialize();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `zombs-outbreak-day${G.day}-wave${G.wave}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  saveToLocalStorage();
  toast("Save file downloaded.");
}
function loadFromFileObj(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try { loadFromData(JSON.parse(reader.result)); }
    catch(e){ toast("Could not read that save file.", true); }
  };
  reader.readAsText(file);
}

/* ============================== INPUT ============================== */
window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
  if (!G.running || G.gameOver) return;
  const k = e.key.toLowerCase();
  if (k === "b") { toggleBuildMenu(); }
  else if (k === "u") { toggleUpgradeMenu(); }
  else if (k === "escape") { togglePause(); }
  else if (k === "e") { interact(); }
  else if (/^[1-9]$/.test(k)) { selectHotbarIndex(parseInt(k,10)-1); }
});
window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });
canvas.addEventListener("mousemove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener("mousedown", (e) => {
  if (e.button === 0) {
    mouse.down = true;
    if (G.mode !== "build" && G.player && G.player.currentWeapon === "bow" && G.running && !G.paused) {
      G.player.charging = true; G.player.chargeStart = G.time;
    }
  }
  if (e.button === 2 && G.mode === "build") { G.mode = "play"; G.buildSelection = null; buildHotbar(); }
});
window.addEventListener("mouseup", (e) => { if (e.button === 0) { releaseBow(); mouse.down = false; } });
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

function selectHotbarIndex(i) {
  const list = G.mode === "build" ? BUILDING_ORDER : G.player.weapons.slice().sort((a,b)=>WEAPONS[a].order-WEAPONS[b].order);
  if (G.mode === "build") {
    if (i < BUILDING_ORDER.length) { G.buildSelection = BUILDING_ORDER[i]; buildHotbar(); }
  } else {
    if (i < list.length) { G.player.currentWeapon = list[i]; buildHotbar(); }
  }
}

/* ============================== COMBAT HELPERS ============================== */
function damagePlayer(amount) {
  const p = G.player;
  const dmg = amount * (1 - playerArmor(p));
  p.hp -= dmg;
  spawnFloater(p.x, p.y-20, `-${Math.ceil(dmg)}`, "#ff6b6b");
  if (p.hp <= 0) { p.hp = 0; endGame(); }
}
function damageEnemy(en, amount, srcX, srcY) {
  en.hp -= amount;
  spawnFloater(en.x, en.y-16, `${Math.ceil(amount)}`, "#ffe082");
  spawnParticles(en.x, en.y, en.color, 4);
  if (en.hp <= 0 && !en.dead) {
    en.dead = true;
    G.player.gold += en.gold;
    G.kills++;
    spawnFloater(en.x, en.y-30, `+${en.gold}g`, "#ffd54f");
    if (en.explode) explodeAt(en.x, en.y, en.explodeDamage, en.explodeRadius);
  }
}
function damageBuilding(b, amount) {
  b.hp -= amount;
  spawnParticles(b.x, b.y, "#cfd8dc", 3);
  if (b.hp <= 0) { b.dead = true; spawnParticles(b.x, b.y, "#888", 10); }
}
function explodeAt(x, y, dmg, radius) {
  spawnParticles(x, y, "#ff8a65", 16);
  if (dist(x,y,G.player.x,G.player.y) < radius) damagePlayer(dmg * (1 - dist(x,y,G.player.x,G.player.y)/radius));
  for (const b of G.buildings) if (!b.dead && dist(x,y,b.x,b.y) < radius) damageBuilding(b, dmg*0.7);
  for (const en of G.enemies) if (!en.dead && dist(x,y,en.x,en.y) < radius) damageEnemy(en, dmg*0.5);
}

/* ============================== PARTICLES / FLOATERS ============================== */
function spawnParticles(x, y, color, n) {
  for (let i=0;i<n;i++) {
    G.particles.push({ x, y, vx: rand(-90,90), vy: rand(-90,90), life: rand(0.25,0.55), maxLife: 0.55, color });
  }
}
function spawnFloater(x, y, text, color) {
  G.floaters.push({ x, y, text, color, life: 0.9, vy: -30 });
}

/* ============================== BULLETS ============================== */
function fireBullet({x,y,angle,speed,damage,faction,splash,color,owner}) {
  G.bullets.push({
    x, y, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed,
    damage, faction, splash: splash||0, color: color||(faction==="player"?"#ffe082":"#c96b4a"),
    life: 1.6, owner,
  });
}

/* ============================== HARVEST / INTERACT ============================== */
function nearestNode(range) {
  let best=null, bd=Infinity;
  for (const n of G.nodes) {
    if (n.hp<=0) continue;
    const d = dist(G.player.x,G.player.y,n.x,n.y);
    if (d < range+n.radius && d < bd) { bd=d; best=n; }
  }
  return best;
}
function harvestNode(node) {
  const w = WEAPONS[G.player.currentWeapon];
  const table = (w.harvest && w.harvest[node.type]) || {};
  const mult = playerHarvestMult(G.player);
  const key = node.type==="tree"?"wood":node.type==="rock"?"stone":"metal";
  const rate = table[key] || 1;
  const gained = Math.min(Math.round(rate*mult), node.hp);
  if (gained <= 0) return;
  node.hp -= gained;
  G.player[key] += gained;
  let msg = `+${gained} ${key}`;
  if (node.type === "tree" && table.leaf) {
    const leafGained = Math.max(1, Math.round(table.leaf*mult));
    G.player.leaf += leafGained;
    msg += `  +${leafGained} leaf`;
  }
  spawnFloater(node.x, node.y-14, msg, "#c5e1a5");
  spawnParticles(node.x, node.y, node.type==="tree"?"#7cb342":node.type==="rock"?"#b0bec5":"#90a4ae", 5);
  if (node.hp <= 0) node.respawnAt = G.time + rand(30000, 55000);
}
function interact() {
  const node = nearestNode(60);
  if (node) { harvestNode(node); return; }
  // nearest building in range
  let best=null, bd=Infinity;
  for (const b of G.buildings) {
    if (b.dead) continue;
    const d = dist(G.player.x,G.player.y,b.x,b.y);
    if (d<70 && d<bd) { bd=d; best=b; }
  }
  if (!best) return;
  if (best.hp < best.maxHp) { repairBuilding(best); return; }
  const def = BUILDING_TYPES[best.type];
  if (def.upgradeTo) { upgradeBuilding(best); return; }
  toast("Already fully upgraded.");
}
function upgradeBuilding(b) {
  const def = BUILDING_TYPES[b.type];
  const next = BUILDING_TYPES[def.upgradeTo];
  if (!canAfford(next.cost)) { toast("Not enough resources to upgrade.", true); return; }
  pay(next.cost);
  b.type = def.upgradeTo; b.maxHp = next.hp; b.hp = next.hp;
  spawnFloater(b.x, b.y-24, "upgraded!", "#ffd54f");
  spawnParticles(b.x, b.y, "#ffd54f", 10);
}
function repairBuilding(b) {
  const def = BUILDING_TYPES[b.type];
  const missingFrac = 1 - b.hp/b.maxHp;
  const cost = {};
  for (const k in def.cost) cost[k] = Math.max(1, Math.ceil(def.cost[k]*0.4*missingFrac));
  if (!canAfford(cost)) { toast("Not enough resources to repair.", true); return; }
  pay(cost);
  b.hp = Math.min(b.maxHp, b.hp + b.maxHp*0.35);
  spawnFloater(b.x, b.y-20, "repaired", "#aed581");
}

/* ============================== BUILDING PLACEMENT ============================== */
function canAfford(cost) {
  const p = G.player;
  for (const k in cost) if ((p[k]||0) < cost[k]) return false;
  return true;
}
function pay(cost) { for (const k in cost) G.player[k] -= cost[k]; }
function snapToGrid(x,y){ const g=CONFIG.GRID; return [Math.round(x/g)*g, Math.round(y/g)*g]; }
function tryPlaceBuilding() {
  if (!G.buildSelection) return;
  const def = BUILDING_TYPES[G.buildSelection];
  const [gx,gy] = snapToGrid(mouse.worldX, mouse.worldY);
  if (dist(G.player.x,G.player.y,gx,gy) > CONFIG.PLACE_RANGE) { toast("Too far away.", true); return; }
  for (const b of G.buildings) if (!b.dead && dist(b.x,b.y,gx,gy) < def.size*0.9) { toast("Something is already there.", true); return; }
  for (const n of G.nodes) if (n.hp>0 && dist(n.x,n.y,gx,gy) < def.size*0.8) { toast("Blocked by a resource node.", true); return; }
  if (!canAfford(def.cost)) { toast("Not enough resources.", true); return; }
  pay(def.cost);
  G.buildings.push({ type:G.buildSelection, x:gx, y:gy, hp:def.hp, maxHp:def.hp, cooldownT:0, healT:0 });
  spawnParticles(gx,gy,"#aed581",8);
}

/* ============================== ENEMY AI ============================== */
function spawnEnemyAt(type, x, y, waveScale) {
  const def = ENEMY_TYPES[type];
  const hp = Math.round(def.hp * (1 + waveScale*0.09));
  G.enemies.push({
    type, x, y, hp, maxHp: hp, speed: def.speed, damage: Math.round(def.damage*(1+waveScale*0.05)),
    gold: def.gold, radius: def.radius, color: def.color,
    ranged: def.ranged, projSpeed: def.projSpeed, atkRange: def.atkRange, atkCooldown: def.atkCooldown,
    explode: def.explode, explodeDamage: def.explodeDamage, explodeRadius: def.explodeRadius,
    boss: def.boss,
    lastAttack: 0, dead: false,
  });
}
function pickWaveComposition(wave) {
  const pool = Object.keys(ENEMY_TYPES).filter(k => k!=="boss" && ENEMY_TYPES[k].minWave <= wave);
  const count = Math.min(6 + Math.floor(wave*2.4), 60);
  const list = [];
  for (let i=0;i<count;i++) list.push(pool[randInt(0,pool.length-1)]);
  if (wave>0 && wave%5===0) list.push("boss");
  return list;
}
function startNight() {
  G.phase = "night"; G.phaseTimer = CONFIG.NIGHT_MS; G.phaseTotal = CONFIG.NIGHT_MS;
  G.wave++;
  const comp = pickWaveComposition(G.wave);
  G.waveQueue = comp;
  G.waveEnemiesLeftToSpawn = comp.length;
  G.waveSpawnTimer = 0;
  G.waveActive = true;
  toast(`Night falls — Wave ${G.wave} incoming (${comp.length} enemies)`, false, true);
}
function startDay() {
  G.phase = "day"; G.phaseTimer = CONFIG.DAY_MS; G.phaseTotal = CONFIG.DAY_MS; G.day++;
  G.waveActive = false;
  const heal = G.player.maxHp*0.25;
  G.player.hp = Math.min(playerMaxHp(G.player), G.player.hp+heal);
  toast(`Dawn breaks. Day ${G.day} — gather and rebuild.`);
  saveToLocalStorage();
}
function spawnPointFarFromBase() {
  const angle = rand(0, Math.PI*2);
  const r = CONFIG.WORLD_SIZE*0.62;
  const cx = CONFIG.WORLD_SIZE/2, cy = CONFIG.WORLD_SIZE/2;
  return [cx+Math.cos(angle)*r, cy+Math.sin(angle)*r];
}
function updateWaveSpawning(dt) {
  if (!G.waveActive || G.waveEnemiesLeftToSpawn<=0) return;
  G.waveSpawnTimer -= dt*1000;
  if (G.waveSpawnTimer<=0) {
    const type = G.waveQueue[G.waveQueue.length-G.waveEnemiesLeftToSpawn];
    const [x,y] = spawnPointFarFromBase();
    spawnEnemyAt(type, x, y, G.wave);
    G.waveEnemiesLeftToSpawn--;
    G.waveSpawnTimer = type==="boss" ? 0 : rand(500,1400);
  }
}
function nearestTargetFor(en) {
  let best = { x:G.player.x, y:G.player.y, radius: CONFIG.PLAYER_RADIUS, isPlayer:true };
  let bd = dist(en.x,en.y,G.player.x,G.player.y);
  for (const b of G.buildings) {
    if (b.dead) continue;
    const d = dist(en.x,en.y,b.x,b.y);
    if (d < bd) { bd = d; best = { x:b.x, y:b.y, radius: BUILDING_TYPES[b.type].size/2, building:b }; }
  }
  return best;
}
function updateEnemies(dt) {
  for (const en of G.enemies) {
    if (en.dead) continue;
    const target = nearestTargetFor(en);
    const d = dist(en.x,en.y,target.x,target.y);
    const atkRange = en.ranged ? en.atkRange : (en.radius+target.radius+6);
    if (d > atkRange) {
      const a = angleTo(en.x,en.y,target.x,target.y);
      en.x += Math.cos(a)*en.speed*dt;
      en.y += Math.sin(a)*en.speed*dt;
    } else {
      en.lastAttack -= dt*1000;
      if (en.lastAttack <= 0) {
        en.lastAttack = en.ranged ? en.atkCooldown : 900;
        if (en.ranged) {
          const a = angleTo(en.x,en.y,target.x,target.y);
          fireBullet({ x:en.x, y:en.y, angle:a, speed:en.projSpeed, damage:en.damage, faction:"enemy", color:"#b085e0" });
        } else if (target.isPlayer) {
          damagePlayer(en.damage);
        } else if (target.building) {
          damageBuilding(target.building, en.damage*1.4);
        }
      }
    }
    // gentle separation from other enemies
    for (const other of G.enemies) {
      if (other===en || other.dead) continue;
      const dd = dist(en.x,en.y,other.x,other.y);
      const minD = en.radius+other.radius;
      if (dd>0 && dd<minD) {
        const a = angleTo(other.x,other.y,en.x,en.y);
        en.x += Math.cos(a)*(minD-dd)*0.5*dt*6;
        en.y += Math.sin(a)*(minD-dd)*0.5*dt*6;
      }
    }
    // spike traps
    for (const b of G.buildings) {
      if (b.dead || !BUILDING_TYPES[b.type].trap) continue;
      if (dist(en.x,en.y,b.x,b.y) < en.radius+BUILDING_TYPES[b.type].size/2) {
        en.hp -= BUILDING_TYPES[b.type].damage*dt*2;
        if (en.hp<=0 && !en.dead) damageEnemy(en, 0);
      }
    }
    en.x = clamp(en.x, 0, CONFIG.WORLD_SIZE); en.y = clamp(en.y, 0, CONFIG.WORLD_SIZE);
  }
  G.enemies = G.enemies.filter(en => !en.dead);
}

/* ============================== TURRETS / CAMPFIRES ============================== */
function updateBuildings(dt) {
  for (const b of G.buildings) {
    if (b.dead) continue;
    const def = BUILDING_TYPES[b.type];
    if (def.turret) {
      b.cooldownT -= dt*1000;
      if (b.cooldownT<=0) {
        let target=null, bd=def.range;
        for (const en of G.enemies) {
          if (en.dead) continue;
          const d = dist(b.x,b.y,en.x,en.y);
          if (d<bd) { bd=d; target=en; }
        }
        if (target) {
          const a = angleTo(b.x,b.y,target.x,target.y);
          fireBullet({ x:b.x, y:b.y, angle:a, speed:def.bulletSpeed, damage:def.damage, faction:"player", splash:def.splash||0, color:"#ffd54f" });
          b.cooldownT = def.cooldown;
        }
      }
    }
    if (def.heal) {
      b.healT -= dt*1000;
      if (b.healT<=0 && dist(b.x,b.y,G.player.x,G.player.y) < def.healRange) {
        G.player.hp = Math.min(playerMaxHp(G.player), G.player.hp+def.healAmount);
        b.healT = def.healInterval;
      } else if (b.healT<=0) b.healT = 200;
    }
  }
  G.buildings = G.buildings.filter(b => !b.dead);
}

/* ============================== PLAYER WEAPON FIRE ============================== */
function tryPlayerAttack(dt) {
  const p = G.player;
  const w = WEAPONS[p.currentWeapon];
  if (w.type === "bow") return; // handled by charge/release (see canvas mousedown/mouseup)
  if (!mouse.down || G.mode==="build") return;
  p.lastAttack -= dt*1000;
  if (p.lastAttack > 0) return;
  if (w.type==="melee") {
    p.lastAttack = w.cooldown;
    const a = angleTo(p.x,p.y,mouse.worldX,mouse.worldY);
    let hitSomething=false;
    for (const en of G.enemies) {
      if (en.dead) continue;
      const d = dist(p.x,p.y,en.x,en.y);
      if (d < w.range+en.radius) {
        const ea = angleTo(p.x,p.y,en.x,en.y);
        let diff = Math.abs(a-ea); if (diff>Math.PI) diff = 2*Math.PI-diff;
        if (diff < w.arc) { damageEnemy(en, w.damage, p.x, p.y); hitSomething=true; }
      }
    }
    const node = nearestNode(w.range);
    if (node) { harvestNode(node); hitSomething=true; }
    if (!hitSomething) spawnParticles(p.x+Math.cos(a)*30, p.y+Math.sin(a)*30, "#dddddd", 3);
  } else {
    if (p.ammo < w.ammoCost) { if (p.lastAttack<=0){ toast("Out of ammo — craft more in Upgrades.", true); p.lastAttack=400;} return; }
    p.lastAttack = w.cooldown;
    p.ammo -= w.ammoCost;
    const baseA = angleTo(p.x,p.y,mouse.worldX,mouse.worldY);
    const pellets = w.pellets||1;
    for (let i=0;i<pellets;i++) {
      const a = baseA + rand(-w.spread,w.spread);
      fireBullet({ x:p.x, y:p.y, angle:a, speed:w.bulletSpeed, damage:w.damage, faction:"player", splash:w.splash||0 });
    }
  }
}

/* ============================== BOW CHARGE / RELEASE ============================== */
function releaseBow() {
  const p = G.player;
  if (!p.charging) return;
  const held = G.time - p.chargeStart;
  p.charging = false;
  if (G.mode === "build" || p.currentWeapon !== "bow" || !G.running || G.paused) return;
  const w = WEAPONS.bow;
  if (p.ammo < w.ammoCost) { toast("Out of arrows — craft more in Upgrades.", true); return; }
  let dmg;
  if (held < w.minChargeMs) dmg = w.minDmg;
  else if (held < w.maxChargeMs) dmg = lerp(w.midDmgMin, w.midDmgMax, (held-w.minChargeMs)/(w.maxChargeMs-w.minChargeMs));
  else dmg = w.maxDmg;
  p.ammo -= w.ammoCost;
  const a = angleTo(p.x, p.y, mouse.worldX, mouse.worldY);
  fireBullet({ x:p.x, y:p.y, angle:a, speed:w.bulletSpeed, damage:dmg, faction:"player", color:"#e8d9a0" });
  spawnParticles(p.x, p.y, "#e8d9a0", 3);
}
function bowChargeFraction() {
  const p = G.player;
  if (!p.charging || p.currentWeapon !== "bow") return 0;
  return clamp((G.time - p.chargeStart) / WEAPONS.bow.maxChargeMs, 0, 1);
}

/* ============================== BULLET UPDATE ============================== */
function updateBullets(dt) {
  for (const b of G.bullets) {
    b.x += b.vx*dt; b.y += b.vy*dt; b.life -= dt;
    if (b.life<=0) { b.dead=true; continue; }
    if (b.faction==="player") {
      for (const en of G.enemies) {
        if (en.dead) continue;
        if (dist(b.x,b.y,en.x,en.y) < en.radius+4) {
          if (b.splash>0) explodeAt(b.x,b.y,b.damage,b.splash); else damageEnemy(en, b.damage);
          b.dead=true; break;
        }
      }
    } else {
      if (dist(b.x,b.y,G.player.x,G.player.y) < CONFIG.PLAYER_RADIUS+4) { damagePlayer(b.damage); b.dead=true; }
      for (const bd of G.buildings) {
        if (bd.dead) continue;
        if (dist(b.x,b.y,bd.x,bd.y) < BUILDING_TYPES[bd.type].size/2+4) { damageBuilding(bd,b.damage); b.dead=true; break; }
      }
    }
    if (b.x<0||b.x>CONFIG.WORLD_SIZE||b.y<0||b.y>CONFIG.WORLD_SIZE) b.dead=true;
  }
  G.bullets = G.bullets.filter(b => !b.dead);
}

/* ============================== PLAYER MOVEMENT ============================== */
function updatePlayer(dt) {
  const p = G.player;
  let dx=0, dy=0;
  if (keys["w"]||keys["arrowup"]) dy-=1;
  if (keys["s"]||keys["arrowdown"]) dy+=1;
  if (keys["a"]||keys["arrowleft"]) dx-=1;
  if (keys["d"]||keys["arrowright"]) dx+=1;
  p.moving = !!(dx||dy);
  if (dx||dy) {
    const len = Math.hypot(dx,dy); dx/=len; dy/=len;
    const spd = playerSpeed(p);
    let nx = p.x+dx*spd*dt, ny = p.y+dy*spd*dt;
    // collide with solid buildings
    for (const b of G.buildings) {
      if (b.dead) continue;
      const s = BUILDING_TYPES[b.type].size/2 + CONFIG.PLAYER_RADIUS;
      if (dist(nx,ny,b.x,b.y) < s) {
        const a = angleTo(b.x,b.y,nx,ny);
        nx = b.x+Math.cos(a)*s; ny = b.y+Math.sin(a)*s;
      }
    }
    p.x = clamp(nx,0,CONFIG.WORLD_SIZE); p.y = clamp(ny,0,CONFIG.WORLD_SIZE);
  }
  p.facing = angleTo(p.x,p.y,mouse.worldX,mouse.worldY);
}

/* ============================== NODE RESPAWN ============================== */
function updateNodes() {
  for (const n of G.nodes) if (n.hp<=0 && G.time >= n.respawnAt) n.hp = n.maxHp;
}

/* ============================== CAMERA ============================== */
function updateCamera() {
  G.camera.x = G.player.x; G.camera.y = G.player.y;
  mouse.worldX = mouse.x - W/2 + G.camera.x;
  mouse.worldY = mouse.y - H/2 + G.camera.y;
}

/* ============================== PARTICLES/FLOATERS UPDATE ============================== */
function updateFx(dt) {
  for (const pt of G.particles) { pt.x+=pt.vx*dt; pt.y+=pt.vy*dt; pt.vx*=0.9; pt.vy*=0.9; pt.life-=dt; }
  G.particles = G.particles.filter(p=>p.life>0);
  for (const f of G.floaters) { f.y += f.vy*dt; f.life-=dt; }
  G.floaters = G.floaters.filter(f=>f.life>0);
}

/* ============================== MAIN UPDATE ============================== */
function update(dt) {
  if (!G.running || G.paused || G.gameOver) return;
  G.time += dt*1000;
  G.phaseTimer -= dt*1000;
  if (G.phase==="day" && G.phaseTimer<=0) startNight();
  else if (G.phase==="night" && G.phaseTimer<=0) startDay();

  updatePlayer(dt);
  tryPlayerAttack(dt);
  updateWaveSpawning(dt);
  updateEnemies(dt);
  updateBuildings(dt);
  updateBullets(dt);
  updateNodes();
  updateCamera();
  updateFx(dt);

  G.lastAutosave += dt*1000;
  if (G.lastAutosave > CONFIG.AUTOSAVE_MS) { G.lastAutosave=0; saveToLocalStorage(); }

  updateUI();
}

/* ============================== RENDER ============================== */
function worldToScreen(x,y){ return [x - G.camera.x + W/2, y - G.camera.y + H/2]; }

function render() {
  ctx.clearRect(0,0,W,H);
  // background
  const nightAmt = G.phase==="night" ? clamp(1-G.phaseTimer/G.phaseTotal>0.85?0: 1,0,1) : 0;
  ctx.fillStyle = G.phase==="night" ? "#0a0d16" : "#0d130c";
  ctx.fillRect(0,0,W,H);

  ctx.save();
  ctx.translate(-G.camera.x+W/2, -G.camera.y+H/2);

  // grid
  ctx.strokeStyle = G.phase==="night" ? "rgba(90,110,150,0.06)" : "rgba(139,195,74,0.06)";
  ctx.lineWidth = 1;
  const g = 90, startX = Math.floor((G.camera.x-W/2)/g)*g, startY = Math.floor((G.camera.y-H/2)/g)*g;
  for (let x=startX; x<G.camera.x+W/2+g; x+=g) { ctx.beginPath(); ctx.moveTo(x,G.camera.y-H/2-g); ctx.lineTo(x,G.camera.y+H/2+g); ctx.stroke(); }
  for (let y=startY; y<G.camera.y+H/2+g; y+=g) { ctx.beginPath(); ctx.moveTo(G.camera.x-W/2-g,y); ctx.lineTo(G.camera.x+W/2+g,y); ctx.stroke(); }

  // world bounds
  ctx.strokeStyle = "rgba(255,60,60,.5)"; ctx.lineWidth=4;
  ctx.strokeRect(0,0,CONFIG.WORLD_SIZE,CONFIG.WORLD_SIZE);

  // base marker
  ctx.beginPath(); ctx.arc(CONFIG.WORLD_SIZE/2,CONFIG.WORLD_SIZE/2, CONFIG.BASE_RADIUS, 0, 7);
  ctx.strokeStyle = "rgba(139,195,74,.12)"; ctx.lineWidth=2; ctx.stroke();

  // resource nodes
  for (const n of G.nodes) {
    if (n.hp<=0) continue;
    ctx.beginPath();
    if (n.type==="tree") { ctx.fillStyle="#4a7a2c"; ctx.arc(n.x,n.y,n.radius,0,7); ctx.fill();
      ctx.fillStyle="#6b4a2c"; ctx.fillRect(n.x-3,n.y+n.radius-4,6,8); }
    else if (n.type==="rock") { ctx.fillStyle="#8d97a0"; ctx.arc(n.x,n.y,n.radius,0,7); ctx.fill(); }
    else { ctx.fillStyle="#6f89a3"; ctx.arc(n.x,n.y,n.radius,0,7); ctx.fill();
      ctx.fillStyle="#cfe0ee"; ctx.beginPath(); ctx.arc(n.x-3,n.y-3,3,0,7); ctx.fill(); }
    // health sliver
    if (n.hp<n.maxHp) {
      ctx.fillStyle="rgba(0,0,0,.5)"; ctx.fillRect(n.x-14,n.y-n.radius-10,28,4);
      ctx.fillStyle="#8bc34a"; ctx.fillRect(n.x-14,n.y-n.radius-10,28*(n.hp/n.maxHp),4);
    }
  }

  // buildings
  for (const b of G.buildings) {
    const def = BUILDING_TYPES[b.type];
    ctx.save(); ctx.translate(b.x,b.y);
    ctx.fillStyle = def.color;
    if (def.trap) { ctx.beginPath(); ctx.moveTo(0,-def.size/2); ctx.lineTo(def.size/2,def.size/2); ctx.lineTo(-def.size/2,def.size/2); ctx.closePath(); ctx.fill(); }
    else { ctx.fillRect(-def.size/2,-def.size/2,def.size,def.size); }
    if (def.turret) { ctx.strokeStyle="rgba(224,168,49,.15)"; ctx.beginPath(); ctx.arc(0,0,def.range,0,7); ctx.stroke(); }
    ctx.restore();
    if (b.hp<b.maxHp) {
      ctx.fillStyle="rgba(0,0,0,.5)"; ctx.fillRect(b.x-def.size/2,b.y-def.size/2-10,def.size,4);
      ctx.fillStyle="#8bc34a"; ctx.fillRect(b.x-def.size/2,b.y-def.size/2-10,def.size*(b.hp/b.maxHp),4);
    }
  }

  // enemies
  for (const en of G.enemies) {
    ctx.save(); ctx.translate(en.x,en.y);
    ctx.fillStyle = en.color;
    ctx.beginPath(); ctx.arc(0,0,en.radius,0,7); ctx.fill();
    if (en.boss) { ctx.strokeStyle="#ffca28"; ctx.lineWidth=3; ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle="rgba(0,0,0,.5)"; ctx.fillRect(en.x-en.radius,en.y-en.radius-9,en.radius*2,4);
    ctx.fillStyle="#e5453f"; ctx.fillRect(en.x-en.radius,en.y-en.radius-9,en.radius*2*(en.hp/en.maxHp),4);
  }

  // bullets
  for (const b of G.bullets) { ctx.fillStyle=b.color; ctx.beginPath(); ctx.arc(b.x,b.y,b.splash?5:3,0,7); ctx.fill(); }

  // particles
  for (const p of G.particles) { ctx.globalAlpha=clamp(p.life/p.maxLife,0,1); ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,3,0,7); ctx.fill(); ctx.globalAlpha=1; }

  // player
  if (G.player) renderPlayer();

  // build ghost
  if (G.mode==="build" && G.buildSelection) {
    const def = BUILDING_TYPES[G.buildSelection];
    const [gx,gy] = snapToGrid(mouse.worldX, mouse.worldY);
    const ok = dist(G.player.x,G.player.y,gx,gy)<=CONFIG.PLACE_RANGE && canAfford(def.cost);
    ctx.globalAlpha=0.55;
    ctx.fillStyle = ok?"#8bc34a":"#e5453f";
    ctx.fillRect(gx-def.size/2,gy-def.size/2,def.size,def.size);
    ctx.globalAlpha=1;
    ctx.strokeStyle="rgba(255,255,255,.4)"; ctx.beginPath(); ctx.arc(G.player.x,G.player.y,CONFIG.PLACE_RANGE,0,7); ctx.stroke();
  }

  ctx.restore();

  // floating text (screen space, offset by camera translate already reverted)
  ctx.save();
  ctx.translate(-G.camera.x+W/2, -G.camera.y+H/2);
  ctx.font="bold 13px 'Chakra Petch', sans-serif"; ctx.textAlign="center";
  for (const f of G.floaters) { ctx.globalAlpha=clamp(f.life/0.9,0,1); ctx.fillStyle=f.color; ctx.fillText(f.text,f.x,f.y); }
  ctx.globalAlpha=1;
  ctx.restore();

  // night vignette
  if (G.phase==="night") {
    const grad = ctx.createRadialGradient(W/2,H/2,H*0.25,W/2,H/2,H*0.75);
    grad.addColorStop(0,"rgba(10,13,22,0)"); grad.addColorStop(1,"rgba(5,6,12,.55)");
    ctx.fillStyle=grad; ctx.fillRect(0,0,W,H);
  }

  renderMinimap();
}

function renderPlayer() {
  const p = G.player;
  const facingLeft = Math.cos(p.facing) < 0;

  // Idle blink cycle: always animating gently through the 4 frames.
  const blinkFrame = Math.floor(G.time / 170) % SPR.cols;
  const row = facingLeft ? 0 : 1; // player sheet: row0=left, row1=right

  // Hover bob only kicks in while actually moving.
  const bob = p.moving ? Math.sin(G.time/110) * 5 : 0;
  const scale = 1.5;
  const dw = SPR.fw*scale, dh = SPR.fh*scale;

  ctx.save();
  // soft shadow, sinks a bit when hovering higher
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(p.x, p.y+dh*0.36, dw*0.30, dw*0.12, 0, 0, 7);
  ctx.fill();
  ctx.globalAlpha = 1;

  if (playerImg.complete && playerImg.naturalWidth > 0) {
    ctx.drawImage(
      playerImg,
      blinkFrame*SPR.fw, row*SPR.fh, SPR.fw, SPR.fh,
      p.x-dw/2, p.y-dh/2+bob, dw, dh
    );
  } else {
    ctx.fillStyle = "#3f7a2b";
    ctx.beginPath(); ctx.arc(p.x, p.y+bob, CONFIG.PLAYER_RADIUS, 0, 7); ctx.fill();
  }

  // Bow: shown attached to the player whenever it's the equipped weapon,
  // animating through its draw frames as the shot charges.
  if (p.currentWeapon === "bow") {
    const frac = bowChargeFraction();
    const frame = clamp(Math.round(frac*(BOWSPR.cols-1)), 0, BOWSPR.cols-1);
    const brow = facingLeft ? 1 : 0; // bow sheet: row0=right, row1=left
    const bscale = 1.7;
    const bw = BOWSPR.fw*bscale, bh = BOWSPR.fh*bscale;
    const handX = p.x + (facingLeft ? -dw*0.30 : dw*0.30);
    const handY = p.y + bob - dh*0.02;
    if (bowImg.complete && bowImg.naturalWidth > 0) {
      ctx.drawImage(bowImg, frame*BOWSPR.fw, brow*BOWSPR.fh, BOWSPR.fw, BOWSPR.fh, handX-bw/2, handY-bh/2, bw, bh);
    }
    if (p.charging) {
      const barW = 34;
      ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(p.x-barW/2, p.y-dh/2+bob-14, barW, 5);
      const tierColor = frac>=1 ? "#ff6b4a" : frac > (WEAPONS.bow.minChargeMs/WEAPONS.bow.maxChargeMs) ? "#ffd54f" : "#cfd8dc";
      ctx.fillStyle = tierColor; ctx.fillRect(p.x-barW/2, p.y-dh/2+bob-14, barW*frac, 5);
    }
  }

  ctx.restore();
}

function renderMinimap() {
  const w = mmCanvas.width, h = mmCanvas.height;
  mmCtx.clearRect(0,0,w,h);
  const scale = w/CONFIG.WORLD_SIZE;
  mmCtx.fillStyle="rgba(139,195,74,.08)";
  mmCtx.fillRect(0,0,w,h);
  for (const b of G.buildings) { mmCtx.fillStyle="#e0a831"; mmCtx.fillRect(b.x*scale-1,b.y*scale-1,2,2); }
  for (const en of G.enemies) { mmCtx.fillStyle="#e5453f"; mmCtx.fillRect(en.x*scale-1,en.y*scale-1,2,2); }
  if (G.player) { mmCtx.fillStyle="#8bc34a"; mmCtx.beginPath(); mmCtx.arc(G.player.x*scale,G.player.y*scale,3,0,7); mmCtx.fill(); }
}

/* ============================== GAME OVER / PAUSE ============================== */
function endGame() {
  G.gameOver = true; G.running=false;
  try { localStorage.removeItem(CONFIG.SAVE_KEY); } catch(e){}
  document.getElementById("gameOverStats").textContent =
    `You survived ${G.day} days and reached wave ${G.wave}, with ${G.kills} kills.`;
  showScreen("gameOverScreen");
}
function togglePause() {
  if (!G.running || G.gameOver) return;
  G.paused = !G.paused;
  showScreen(G.paused ? "pauseScreen" : null);
}

/* ============================== UI: SCREENS ============================== */
const screens = ["startScreen","gameOverScreen","pauseScreen"];
function showScreen(id) {
  for (const s of screens) document.getElementById(s).classList.toggle("hidden", s!==id);
  const hideHud = id==="startScreen" || id==="gameOverScreen";
  document.getElementById("hud").classList.toggle("hidden", hideHud);
}

/* ============================== UI: HOTBAR ============================== */
function buildHotbar() {
  const bar = document.getElementById("hotbar");
  bar.innerHTML = "";
  if (G.mode==="build") {
    BUILDING_ORDER.forEach((key,i) => {
      const def = BUILDING_TYPES[key];
      const el = document.createElement("div");
      el.className = "hotbar-slot building" + (G.buildSelection===key?" active":"");
      el.innerHTML = `<span class="num">${i+1}</span><span class="ic">${def.icon}</span><span class="nm">${def.name}</span>`;
      el.onclick = () => { G.buildSelection = key; buildHotbar(); };
      bar.appendChild(el);
    });
  } else {
    const list = G.player.weapons.slice().sort((a,b)=>WEAPONS[a].order-WEAPONS[b].order);
    list.forEach((key,i) => {
      const def = WEAPONS[key];
      const el = document.createElement("div");
      el.className = "hotbar-slot" + (G.player.currentWeapon===key?" active":"");
      el.innerHTML = `<span class="num">${i+1}</span><span class="ic">${def.icon}</span><span class="nm">${def.name}</span>`;
      el.onclick = () => { G.player.currentWeapon = key; buildHotbar(); };
      bar.appendChild(el);
    });
  }
}
function toggleBuildMenu() {
  const panel = document.getElementById("buildMenu");
  const willOpen = panel.classList.contains("hidden");
  document.getElementById("upgradeMenu").classList.add("hidden");
  panel.classList.toggle("hidden", !willOpen);
  G.mode = willOpen ? "build" : "play";
  if (willOpen && !G.buildSelection) G.buildSelection = BUILDING_ORDER[0];
  buildHotbar();
}
function buildBuildMenu() {
  const list = document.getElementById("buildList");
  list.innerHTML = "";
  const note = document.createElement("div");
  note.className = "si-cost";
  note.style.marginBottom = "4px";
  note.textContent = "Tip: stand next to a building and press E to repair it, or upgrade wood → stone → metal walls.";
  list.appendChild(note);
  BUILDING_ORDER.forEach(key => {
    const def = BUILDING_TYPES[key];
    const row = document.createElement("div");
    row.className = "shop-item";
    const costStr = Object.entries(def.cost).map(([k,v])=>`${v} ${k}`).join(", ");
    row.innerHTML = `<div class="si-info"><div class="si-name">${def.icon} ${def.name}</div><div class="si-cost">${costStr} · ${def.hp} HP</div></div>
      <button class="si-btn">SELECT</button>`;
    row.querySelector("button").onclick = () => { G.buildSelection = key; buildHotbar(); toast(`Selected ${def.name}. Left-click to place.`); };
    list.appendChild(row);
  });
}

/* ============================== UI: UPGRADE MENU ============================== */
function upgradeCost(key) {
  const u = UPGRADES[key]; const lvl = G.player.upgrades[key];
  return Math.round(u.base * Math.pow(u.growth, lvl));
}
function buildUpgradeTabs() {
  renderStatsTab(); renderWeaponsTab(); renderCraftTab();
}
function renderStatsTab() {
  const el = document.getElementById("tabStats"); el.innerHTML="";
  for (const key in UPGRADES) {
    const u = UPGRADES[key], lvl = G.player.upgrades[key], maxed = lvl>=u.max;
    const cost = upgradeCost(key);
    const row = document.createElement("div"); row.className="shop-item"+(maxed?" disabled":"");
    row.innerHTML = `<div class="si-info"><div class="si-name">${u.icon} ${u.name} (Lv ${lvl}/${u.max})</div><div class="si-cost">${maxed?"MAXED":cost+" gold · "+u.effect}</div></div>
      <button class="si-btn" ${maxed?"disabled":""}>BUY</button>`;
    if (!maxed) row.querySelector("button").onclick = () => {
      if (G.player.gold<cost) { toast("Not enough gold.", true); return; }
      G.player.gold -= cost; G.player.upgrades[key]++;
      G.player.maxHp = playerMaxHp(G.player);
      renderStatsTab(); updateUI(); toast(`${u.name} upgraded!`);
    };
    el.appendChild(row);
  }
}
function renderWeaponsTab() {
  const el = document.getElementById("tabWeapons"); el.innerHTML="";
  WEAPON_ORDER.forEach(key => {
    const w = WEAPONS[key]; const owned = G.player.weapons.includes(key);
    const row = document.createElement("div"); row.className="shop-item"+(owned?" disabled":"");
    row.innerHTML = `<div class="si-info"><div class="si-name">${w.icon} ${w.name}</div><div class="si-cost">${owned?"OWNED":w.cost+" gold"}</div></div>
      <button class="si-btn" ${owned?"disabled":""}>${owned?"OWNED":"UNLOCK"}</button>`;
    if (!owned) row.querySelector("button").onclick = () => {
      if (G.player.gold<w.cost) { toast("Not enough gold.", true); return; }
      G.player.gold -= w.cost; G.player.weapons.push(key); G.player.currentWeapon = key;
      renderWeaponsTab(); buildHotbar(); updateUI(); toast(`${w.name} unlocked!`);
    };
    el.appendChild(row);
  });
}
function renderCraftTab() {
  const el = document.getElementById("tabCraft"); el.innerHTML="";
  const note = document.createElement("div");
  note.className = "si-cost"; note.style.marginBottom = "4px";
  note.textContent = "Arrows are fletched from wood, metal, and leaf.";
  el.appendChild(note);
  const recipes = [ {amt:10,wood:6,metal:6,leaf:6}, {amt:25,wood:14,metal:14,leaf:14}, {amt:60,wood:30,metal:30,leaf:30} ];
  recipes.forEach(r => {
    const cost = {wood:r.wood, metal:r.metal, leaf:r.leaf};
    const row = document.createElement("div"); row.className="shop-item";
    row.innerHTML = `<div class="si-info"><div class="si-name">🏹 Craft ${r.amt} Arrows</div><div class="si-cost">${r.wood} wood, ${r.metal} metal, ${r.leaf} leaf</div></div>
      <button class="si-btn">CRAFT</button>`;
    row.querySelector("button").onclick = () => {
      if (!canAfford(cost)) { toast("Not enough resources.", true); return; }
      pay(cost); G.player.ammo += r.amt; updateUI(); toast(`Crafted ${r.amt} arrows.`);
    };
    el.appendChild(row);
  });
}
function toggleUpgradeMenu() {
  const panel = document.getElementById("upgradeMenu");
  const willOpen = panel.classList.contains("hidden");
  document.getElementById("buildMenu").classList.add("hidden");
  if (G.mode==="build") { G.mode="play"; buildHotbar(); }
  panel.classList.toggle("hidden", !willOpen);
  if (willOpen) { renderStatsTab(); renderWeaponsTab(); renderCraftTab(); }
}
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
    tab.classList.add("active");
    ["stats","weapons","craft"].forEach(name => {
      document.getElementById("tab"+name[0].toUpperCase()+name.slice(1)).classList.toggle("hidden", name!==tab.dataset.tab);
    });
  });
});

/* ============================== UI: HUD REFRESH ============================== */
function updateUI() {
  if (!G.player) return;
  const p = G.player;
  const maxHp = playerMaxHp(p);
  document.getElementById("healthFill").style.width = clamp(p.hp/maxHp*100,0,100)+"%";
  document.getElementById("healthText").textContent = `${Math.ceil(p.hp)}/${Math.ceil(maxHp)}`;
  document.getElementById("resWood").textContent = p.wood;
  document.getElementById("resLeaf").textContent = p.leaf;
  document.getElementById("resStone").textContent = p.stone;
  document.getElementById("resMetal").textContent = p.metal;
  document.getElementById("resGold").textContent = p.gold;
  document.getElementById("resAmmo").textContent = p.ammo;

  const label = document.getElementById("phaseLabel");
  label.textContent = (G.phase==="day"?`☀ DAY ${G.day}`:`🌙 NIGHT — WAVE ${G.wave}`);
  label.className = "phase-label " + G.phase;
  document.getElementById("phaseFill").style.width = clamp(100-(G.phaseTimer/G.phaseTotal*100),0,100)+"%";
  document.getElementById("phaseFill").style.background = G.phase==="night" ? "#7986cb" : "#ffb300";
  document.getElementById("waveLabel").textContent =
    G.phase==="night" ? `${G.enemies.length + G.waveEnemiesLeftToSpawn} hostiles remaining` : `Next wave at nightfall`;
}

/* ============================== TOAST ============================== */
let toastTimer=null;
function toast(msg, warn, big) {
  const el = document.getElementById("toast");
  el.textContent = msg; el.className = "toast show"+(warn?" warn":"");
  el.style.fontSize = big ? "16px" : "13px";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>el.classList.remove("show"), big?3200:2000);
}

/* ============================== BOOTSTRAP / MENUS ============================== */
function init() {
  resize();
  document.getElementById("btnNewGame").onclick = newGame;
  document.getElementById("btnRestart").onclick = newGame;
  document.getElementById("btnContinue").onclick = () => loadFromLocalStorage();
  document.getElementById("btnResume").onclick = togglePause;
  document.getElementById("btnQuit").onclick = () => { saveToLocalStorage(); G.running=false; showScreen("startScreen"); refreshContinueButton(); };
  document.getElementById("btnPause").onclick = togglePause;
  document.getElementById("btnUpgrades").onclick = toggleUpgradeMenu;
  document.getElementById("btnSaveFile").onclick = saveToFile;
  document.getElementById("btnSaveFile2").onclick = saveToFile;
  document.getElementById("loadFileInput").addEventListener("change", e => { if (e.target.files[0]) loadFromFileObj(e.target.files[0]); });
  document.getElementById("loadFileInput2").addEventListener("change", e => { if (e.target.files[0]) loadFromFileObj(e.target.files[0]); });

  canvas.addEventListener("mousedown", (e) => {
    if (e.button===0 && G.mode==="build" && G.running && !G.paused) tryPlaceBuilding();
  });

  window.addEventListener("beforeunload", () => { if (G.running) saveToLocalStorage(); });

  refreshContinueButton();
  showScreen("startScreen");
  requestAnimationFrame(loop);
}
function refreshContinueButton() {
  const btn = document.getElementById("btnContinue");
  try { btn.disabled = !localStorage.getItem(CONFIG.SAVE_KEY); }
  catch(e){ btn.disabled = true; }
}

let lastT = performance.now();
function loop(t) {
  let dt = (t-lastT)/1000; lastT=t;
  dt = Math.min(dt, 0.05);
  update(dt);
  if (G.running || G.gameOver) render();
  requestAnimationFrame(loop);
}

init();

})();
