(() => {
  const SAVE_KEY = "my_game_save_v5";

  const PLAYER_HALF = 27;
  const PLAYER_SIZE = 54;
  const PLAYER_BOTTOM = 26;
  const PLAYER_HP = 100;

  const STAGE_DISTANCE = 2400;
  const DISTANCE_SPEED = 48;
  const SKILL_PASSIVE_GAIN = 4.5;
  const BASE_FIRE_INTERVAL = 0.24;
  const BASE_BULLET_SPEED = 430;
  const BASE_ENEMY_SPAWN_INTERVAL = 0.78;
  const CLEAR_DELAY = 1.6;

  const titleScreen = document.getElementById("titleScreen");
  const battleScreen = document.getElementById("battleScreen");
  const resultScreen = document.getElementById("resultScreen");

  const gemCount = document.getElementById("gemCount");
  const startGameBtn = document.getElementById("startGameBtn");
  const hpBar = document.getElementById("hpBar");
  const skillBar = document.getElementById("skillBar");
  const killCount = document.getElementById("killCount");
  const distanceCount = document.getElementById("distanceCount");
  const gameArea = document.getElementById("gameArea");
  const player = document.getElementById("player");
  const pickupsLayer = document.getElementById("pickupsLayer");
  const enemiesLayer = document.getElementById("enemiesLayer");
  const bulletsLayer = document.getElementById("bulletsLayer");
  const effectsLayer = document.getElementById("effectsLayer");
  const bossHud = document.getElementById("bossHud");
  const bossHpBar = document.getElementById("bossHpBar");
  const warningText = document.getElementById("warningText");
  const damageFlash = document.getElementById("damageFlash");
  const skillFlash = document.getElementById("skillFlash");
  const skillBtn = document.getElementById("skillBtn");
  const resultKills = document.getElementById("resultKills");
  const resultDistance = document.getElementById("resultDistance");
  const resultGems = document.getElementById("resultGems");
  const backToTitleBtn = document.getElementById("backToTitleBtn");

  const lvFireRate = document.getElementById("lvFireRate");
  const lvBulletSize = document.getElementById("lvBulletSize");
  const lvBulletSpeed = document.getElementById("lvBulletSpeed");
  const lvPierce = document.getElementById("lvPierce");
  const lvSkillGain = document.getElementById("lvSkillGain");

  let state = null;
  let rafId = null;
  let lastTime = 0;
  let mouseDown = false;
  let touchActive = false;
  let nextEnemyId = 1;

  const UPGRADE_LABELS = {
    fireRate: "連射アップ",
    bulletSize: "弾サイズアップ",
    bulletSpeed: "弾速アップ",
    pierce: "貫通アップ",
    skillGain: "必殺効率アップ"
  };

  const save = loadSave();

  updateGemText();
  showScreen("title");
  player.style.left = "50%";

  startGameBtn.addEventListener("click", startGame);
  backToTitleBtn.addEventListener("click", backToTitle);
  skillBtn.addEventListener("click", useSkill);

  gameArea.addEventListener(
    "touchstart",
    (e) => {
      if (!canMove()) return;
      touchActive = true;
      e.preventDefault();
      setPlayerFromClientX(e.touches[0].clientX);
    },
    { passive: false }
  );

  window.addEventListener(
    "touchmove",
    (e) => {
      if (!touchActive) return;
      if (!canMove()) return;
      e.preventDefault();
      setPlayerFromClientX(e.touches[0].clientX);
    },
    { passive: false }
  );

  window.addEventListener("touchend", () => {
    touchActive = false;
  });

  gameArea.addEventListener("mousedown", (e) => {
    if (!canMove()) return;
    mouseDown = true;
    setPlayerFromClientX(e.clientX);
  });

  window.addEventListener("mousemove", (e) => {
    if (!mouseDown) return;
    if (!canMove()) return;
    setPlayerFromClientX(e.clientX);
  });

  window.addEventListener("mouseup", () => {
    mouseDown = false;
  });

  window.addEventListener("resize", () => {
    if (!state) return;
    refreshAreaSize();
    state.playerX = clamp(state.playerX, PLAYER_HALF, state.areaWidth - PLAYER_HALF);
    drawPlayer();
  });

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return { gems: 0 };
      const parsed = JSON.parse(raw);
      return { gems: Number(parsed.gems) || 0 };
    } catch {
      return { gems: 0 };
    }
  }

  function saveData() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  }

  function updateGemText() {
    gemCount.textContent = save.gems;
  }

  function showScreen(name) {
    titleScreen.classList.remove("active");
    battleScreen.classList.remove("active");
    resultScreen.classList.remove("active");

    if (name === "title") titleScreen.classList.add("active");
    if (name === "battle") battleScreen.classList.add("active");
    if (name === "result") resultScreen.classList.add("active");
  }

  function baseUpgrades() {
    return {
      fireRate: 1,
      bulletSize: 1,
      bulletSpeed: 1,
      pierce: 1,
      skillGain: 1
    };
  }

  function updateUpgradeHud() {
    if (!state) return;
    lvFireRate.textContent = state.upgrades.fireRate;
    lvBulletSize.textContent = state.upgrades.bulletSize;
    lvBulletSpeed.textContent = state.upgrades.bulletSpeed;
    lvPierce.textContent = state.upgrades.pierce;
    lvSkillGain.textContent = state.upgrades.skillGain;
  }

  function startGame() {
    clearLayers();

    state = {
      running: true,
      clearPending: false,
      playerX: gameArea.clientWidth / 2,
      areaWidth: gameArea.clientWidth,
      areaHeight: gameArea.clientHeight,
      hp: PLAYER_HP,
      maxHp: PLAYER_HP,
      skill: 0,
      kills: 0,
      distance: 0,
      bullets: [],
      enemies: [],
      pickups: [],
      fireTimer: 0,
      enemyTimer: 0,
      bossSpawned: false,
      bossDefeated: false,
      invincibleTimer: 0,
      upgrades: baseUpgrades()
    };

    drawPlayer();
    updateHud();
    updateUpgradeHud();
    hideBossHud();
    showScreen("battle");

    if (rafId) cancelAnimationFrame(rafId);
    lastTime = 0;
    rafId = requestAnimationFrame(loop);
  }

  function backToTitle() {
    if (rafId) cancelAnimationFrame(rafId);
    state = null;
    clearLayers();
    hideBossHud();
    player.style.left = "50%";
    showScreen("title");
  }

  function canMove() {
    return state && state.running && !state.clearPending;
  }

  function refreshAreaSize() {
    if (!state) return;
    state.areaWidth = gameArea.clientWidth;
    state.areaHeight = gameArea.clientHeight;
  }

  function setPlayerFromClientX(clientX) {
    const rect = gameArea.getBoundingClientRect();
    let x = clientX - rect.left;
    x = clamp(x, PLAYER_HALF, rect.width - PLAYER_HALF);
    state.playerX = x;
    drawPlayer();
  }

  function drawPlayer() {
    if (!state) return;
    player.style.left = `${state.playerX}px`;
  }

  function loop(ts) {
    if (!state || !state.running) return;

    if (!lastTime) lastTime = ts;
    const dt = Math.min((ts - lastTime) / 1000, 0.033);
    lastTime = ts;

    refreshAreaSize();

    if (state.invincibleTimer > 0) {
      state.invincibleTimer -= dt;
    }

    if (!state.clearPending) {
      state.distance = Math.min(STAGE_DISTANCE, state.distance + dt * DISTANCE_SPEED);
      state.skill = Math.min(100, state.skill + dt * SKILL_PASSIVE_GAIN);
      handleAutoFire(dt);
      handleEnemySpawn(dt);
      updateBullets(dt);
      updateEnemies(dt);
      updatePickups(dt);
      checkEnemyPlayerCollision();
      checkPickupPlayerCollision();
    } else {
      updateBullets(dt);
      updatePickups(dt);
    }

    cleanupObjects();
    updateHud();
    updateBossHud();

    if (state.hp <= 0) {
      finishGame(false);
      return;
    }

    rafId = requestAnimationFrame(loop);
  }

  function fireInterval() {
    return Math.max(0.08, BASE_FIRE_INTERVAL - (state.upgrades.fireRate - 1) * 0.016);
  }

  function bulletSpeed() {
    return BASE_BULLET_SPEED + (state.upgrades.bulletSpeed - 1) * 38;
  }

  function bulletWidth() {
    return 12 + (state.upgrades.bulletSize - 1) * 2;
  }

  function bulletHeight() {
    return 24 + (state.upgrades.bulletSize - 1) * 3;
  }

  function skillGainMultiplier() {
    return 1 + (state.upgrades.skillGain - 1) * 0.16;
  }

  function addSkill(amount) {
    state.skill = Math.min(100, state.skill + amount * skillGainMultiplier());
  }

  function handleAutoFire(dt) {
    state.fireTimer += dt;
    const interval = fireInterval();

    while (state.fireTimer >= interval) {
      state.fireTimer -= interval;
      spawnBullet();
    }
  }

  function spawnBullet() {
    const bullet = {
      x: state.playerX,
      y: state.areaHeight - PLAYER_BOTTOM - PLAYER_SIZE,
      width: bulletWidth(),
      height: bulletHeight(),
      speed: bulletSpeed(),
      active: true,
      pierceRemaining: state.upgrades.pierce,
      hitIds: new Set(),
      el: document.createElement("div")
    };

    bullet.el.className = "bullet";
    bullet.el.style.width = `${bullet.width}px`;
    bullet.el.style.height = `${bullet.height}px`;
    bullet.el.style.left = `${bullet.x}px`;
    bullet.el.style.top = `${bullet.y}px`;
    bulletsLayer.appendChild(bullet.el);
    state.bullets.push(bullet);
  }

  function handleEnemySpawn(dt) {
    if (state.bossSpawned) return;

    if (state.distance >= STAGE_DISTANCE) {
      spawnBoss();
      return;
    }

    state.enemyTimer += dt;
    if (state.enemyTimer >= BASE_ENEMY_SPAWN_INTERVAL) {
      state.enemyTimer = 0;
      spawnEnemy();
    }
  }

  function spawnEnemy() {
    const roll = Math.random();

    let type = "normal";
    let width = 52;
    let height = 52;
    let hp = 1;
    let speed = 122 + Math.random() * 38;
    let drift = (Math.random() - 0.5) * 18;
    let text = "◆";

    if (roll >= 0.5 && roll < 0.82) {
      type = "drift";
      speed = 112 + Math.random() * 32;
      drift = (Math.random() - 0.5) * 110;
      text = "✦";
    } else if (roll >= 0.82) {
      type = "tank";
      width = 62;
      height = 62;
      hp = 4;
      speed = 88 + Math.random() * 24;
      drift = (Math.random() - 0.5) * 38;
      text = "⬣";
    }

    const x = rand(width / 2, state.areaWidth - width / 2);

    const enemy = {
      id: nextEnemyId++,
      type,
      x,
      y: -height,
      width,
      height,
      maxHp: hp,
      hp,
      speed,
      drift,
      boss: false,
      active: true,
      el: document.createElement("div")
    };

    enemy.el.className = `enemy ${type}`;
    enemy.el.textContent = text;
    enemy.el.style.left = `${enemy.x}px`;
    enemy.el.style.top = `${enemy.y}px`;
    enemiesLayer.appendChild(enemy.el);
    state.enemies.push(enemy);
  }

  function spawnBoss() {
    state.bossSpawned = true;
    showWarning();

    const width = 92;
    const height = 92;

    const boss = {
      id: nextEnemyId++,
      type: "boss",
      x: state.areaWidth / 2,
      y: -height,
      width,
      height,
      maxHp: 55,
      hp: 55,
      speed: 60,
      drift: 80,
      boss: true,
      active: true,
      el: document.createElement("div")
    };

    boss.el.className = "enemy boss";
    boss.el.textContent = "☠";
    boss.el.style.left = `${boss.x}px`;
    boss.el.style.top = `${boss.y}px`;
    enemiesLayer.appendChild(boss.el);
    state.enemies.push(boss);
  }

  function updateBullets(dt) {
    for (const bullet of state.bullets) {
      if (!bullet.active) continue;

      bullet.y -= dt * bullet.speed;
      bullet.el.style.left = `${bullet.x}px`;
      bullet.el.style.top = `${bullet.y}px`;

      if (bullet.y < -bullet.height - 20) {
        bullet.active = false;
        continue;
      }

      for (const enemy of state.enemies) {
        if (!enemy.active) continue;
        if (bullet.hitIds.has(enemy.id)) continue;

        if (isBulletHitEnemy(bullet, enemy)) {
          bullet.hitIds.add(enemy.id);
          enemy.hp -= 1;
          addSkill(7);
          spawnEffect(enemy.x, enemy.y + enemy.height / 2, enemy.boss ? 110 : 74);

          if (enemy.hp <= 0) {
            enemy.active = false;
            state.kills += enemy.boss ? 14 : 1;

            if (!enemy.boss) {
              maybeDropUpgrade(enemy);
            }

            if (enemy.boss) {
              handleBossDefeat();
            }
          }

          bullet.pierceRemaining -= 1;
          if (bullet.pierceRemaining <= 0) {
            bullet.active = false;
            break;
          }
        }
      }
    }
  }

  function isBulletHitEnemy(bullet, enemy) {
    const bulletLeft = bullet.x - bullet.width / 2;
    const bulletRight = bullet.x + bullet.width / 2;
    const bulletTop = bullet.y;
    const bulletBottom = bullet.y + bullet.height;

    const enemyLeft = enemy.x - enemy.width / 2;
    const enemyRight = enemy.x + enemy.width / 2;
    const enemyTop = enemy.y;
    const enemyBottom = enemy.y + enemy.height;

    return (
      bulletRight >= enemyLeft &&
      bulletLeft <= enemyRight &&
      bulletBottom >= enemyTop &&
      bulletTop <= enemyBottom
    );
  }

  function updateEnemies(dt) {
    for (const enemy of state.enemies) {
      if (!enemy.active) continue;

      enemy.y += dt * enemy.speed;
      enemy.x += dt * enemy.drift;

      if (enemy.x < enemy.width / 2) {
        enemy.x = enemy.width / 2;
        enemy.drift *= -1;
      }

      if (enemy.x > state.areaWidth - enemy.width / 2) {
        enemy.x = state.areaWidth - enemy.width / 2;
        enemy.drift *= -1;
      }

      enemy.el.style.left = `${enemy.x}px`;
      enemy.el.style.top = `${enemy.y}px`;

      if (enemy.y > state.areaHeight + enemy.height + 20) {
        enemy.active = false;
        if (enemy.boss) {
          state.hp = 0;
        }
      }
    }
  }

  function maybeDropUpgrade(enemy) {
    const available = Object.keys(state.upgrades).filter((key) => state.upgrades[key] < 10);
    if (available.length === 0) return;

    const dropChance = enemy.type === "tank" ? 0.75 : 0.4;
    if (Math.random() > dropChance) return;

    const key = available[Math.floor(Math.random() * available.length)];

    const pickup = {
      x: enemy.x,
      y: enemy.y + enemy.height / 2,
      speed: 120,
      type: key,
      active: true,
      el: document.createElement("div")
    };

    pickup.el.className = "pickup";
    pickup.el.textContent = "↑";
    pickup.el.style.left = `${pickup.x}px`;
    pickup.el.style.top = `${pickup.y}px`;
    pickupsLayer.appendChild(pickup.el);
    state.pickups.push(pickup);
  }

  function updatePickups(dt) {
    for (const pickup of state.pickups) {
      if (!pickup.active) continue;

      pickup.y += dt * pickup.speed;
      pickup.el.style.left = `${pickup.x}px`;
      pickup.el.style.top = `${pickup.y}px`;

      if (pickup.y > state.areaHeight + 30) {
        pickup.active = false;
      }
    }
  }

  function checkPickupPlayerCollision() {
    const playerLeft = state.playerX - PLAYER_HALF;
    const playerRight = state.playerX + PLAYER_HALF;
    const playerTop = state.areaHeight - PLAYER_BOTTOM - PLAYER_SIZE;
    const playerBottom = state.areaHeight - PLAYER_BOTTOM;

    for (const pickup of state.pickups) {
      if (!pickup.active) continue;

      const size = 30;
      const left = pickup.x - size / 2;
      const right = pickup.x + size / 2;
      const top = pickup.y;
      const bottom = pickup.y + size;

      const hit =
        right >= playerLeft &&
        left <= playerRight &&
        bottom >= playerTop &&
        top <= playerBottom;

      if (hit) {
        pickup.active = false;
        applyUpgrade(pickup.type, pickup.x, pickup.y);
      }
    }
  }

  function applyUpgrade(key, x, y) {
    if (state.upgrades[key] >= 10) {
      spawnFloatText("MAX", x, y);
      return;
    }

    state.upgrades[key] += 1;
    updateUpgradeHud();
    spawnFloatText(`${UPGRADE_LABELS[key]} Lv${state.upgrades[key]}`, x, y);
  }

  function checkEnemyPlayerCollision() {
    if (state.invincibleTimer > 0) return;

    const playerLeft = state.playerX - PLAYER_HALF;
    const playerRight = state.playerX + PLAYER_HALF;
    const playerTop = state.areaHeight - PLAYER_BOTTOM - PLAYER_SIZE;
    const playerBottom = state.areaHeight - PLAYER_BOTTOM;

    for (const enemy of state.enemies) {
      if (!enemy.active) continue;

      const enemyLeft = enemy.x - enemy.width / 2;
      const enemyRight = enemy.x + enemy.width / 2;
      const enemyTop = enemy.y;
      const enemyBottom = enemy.y + enemy.height;

      const hit =
        enemyRight >= playerLeft &&
        enemyLeft <= playerRight &&
        enemyBottom >= playerTop &&
        enemyTop <= playerBottom;

      if (hit) {
        enemy.active = false;
        state.hp -= enemy.boss ? 34 : enemy.type === "tank" ? 20 : 14;
        state.invincibleTimer = 0.75;
        flashDamage();
        spawnEffect(state.playerX, state.areaHeight - 60, 90);
        break;
      }
    }
  }

  function useSkill() {
    if (!state || !state.running || state.clearPending) return;
    if (state.skill < 100) return;

    state.skill = 0;
    flashSkill();

    for (const enemy of state.enemies) {
      if (!enemy.active) continue;

      enemy.hp -= enemy.boss ? 16 : 999;
      spawnEffect(enemy.x, enemy.y + enemy.height / 2, enemy.boss ? 130 : 88);

      if (enemy.hp <= 0) {
        enemy.active = false;
        state.kills += enemy.boss ? 14 : 1;

        if (!enemy.boss) {
          maybeDropUpgrade(enemy);
        }

        if (enemy.boss) {
          handleBossDefeat();
        }
      }
    }
  }

  function handleBossDefeat() {
    if (state.bossDefeated) return;

    state.bossDefeated = true;
    state.clearPending = true;

    for (const enemy of state.enemies) {
      if (!enemy.boss) {
        enemy.active = false;
      }
    }

    spawnClearText();

    window.setTimeout(() => {
      if (state && state.running) {
        finishGame(true);
      }
    }, CLEAR_DELAY * 1000);
  }

  function showWarning() {
    warningText.classList.remove("show");
    void warningText.offsetWidth;
    warningText.classList.add("show");
  }

  function showBossHud() {
    bossHud.classList.add("show");
  }

  function hideBossHud() {
    bossHud.classList.remove("show");
  }

  function updateBossHud() {
    const boss = state ? state.enemies.find((enemy) => enemy.boss && enemy.active) : null;

    if (!boss) {
      hideBossHud();
      return;
    }

    showBossHud();
    bossHpBar.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
  }

  function flashDamage() {
    damageFlash.classList.remove("show");
    void damageFlash.offsetWidth;
    damageFlash.classList.add("show");
  }

  function flashSkill() {
    skillFlash.classList.remove("show");
    void skillFlash.offsetWidth;
    skillFlash.classList.add("show");
  }

  function spawnClearText() {
    const el = document.createElement("div");
    el.className = "clear-text";
    el.textContent = "CLEAR!";
    effectsLayer.appendChild(el);

    window.setTimeout(() => {
      el.remove();
    }, CLEAR_DELAY * 1000);
  }

  function spawnFloatText(text, x, y) {
    const el = document.createElement("div");
    el.className = "float-text";
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    effectsLayer.appendChild(el);

    const start = performance.now();
    function anim(now) {
      const t = (now - start) / 700;
      if (t >= 1) {
        el.remove();
        return;
      }
      el.style.transform = `translateX(-50%) translateY(${-28 * t}px)`;
      el.style.opacity = `${1 - t}`;
      requestAnimationFrame(anim);
    }
    requestAnimationFrame(anim);
  }

  function spawnEffect(x, y, size) {
    const el = document.createElement("div");
    el.className = "effect";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.marginLeft = `${-(size / 2)}px`;
    el.style.marginTop = `${-(size / 2)}px`;
    effectsLayer.appendChild(el);

    window.setTimeout(() => {
      el.remove();
    }, 180);
  }

  function cleanupObjects() {
    state.bullets = state.bullets.filter((bullet) => {
      if (!bullet.active) {
        bullet.el.remove();
        return false;
      }
      return true;
    });

    state.enemies = state.enemies.filter((enemy) => {
      if (!enemy.active) {
        enemy.el.remove();
        return false;
      }
      return true;
    });

    state.pickups = state.pickups.filter((pickup) => {
      if (!pickup.active) {
        pickup.el.remove();
        return false;
      }
      return true;
    });
  }

  function updateHud() {
    if (!state) return;
    hpBar.style.width = `${Math.max(0, (state.hp / state.maxHp) * 100)}%`;
    skillBar.style.width = `${Math.max(0, state.skill)}%`;
    killCount.textContent = state.kills;
    distanceCount.textContent = Math.floor(state.distance);
  }

  function finishGame(clear) {
    if (!state) return;

    state.running = false;
    if (rafId) cancelAnimationFrame(rafId);

    const earned = clear ? 40 + state.kills : 12 + Math.floor(state.kills / 2);
    save.gems += earned;
    saveData();
    updateGemText();

    resultKills.textContent = state.kills;
    resultDistance.textContent = Math.floor(state.distance);
    resultGems.textContent = earned;

    showScreen("result");
  }

  function clearLayers() {
    pickupsLayer.innerHTML = "";
    enemiesLayer.innerHTML = "";
    bulletsLayer.innerHTML = "";
    effectsLayer.innerHTML = "";
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }
})();
