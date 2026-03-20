(() => {
  const SAVE_KEY = "my_game_save_v4";

  const PLAYER_HALF = 27;
  const PLAYER_SIZE = 54;
  const PLAYER_BOTTOM = 26;
  const PLAYER_HP = 100;

  const BULLET_WIDTH = 12;
  const BULLET_HEIGHT = 24;
  const BULLET_SPEED = 430;

  const STAGE_DISTANCE = 2200;
  const DISTANCE_SPEED = 44;
  const SKILL_PASSIVE_GAIN = 4.5;
  const AUTO_FIRE_INTERVAL = 0.24;
  const ENEMY_SPAWN_INTERVAL = 0.78;
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
  const enemiesLayer = document.getElementById("enemiesLayer");
  const bulletsLayer = document.getElementById("bulletsLayer");
  const effectsLayer = document.getElementById("effectsLayer");
  const skillBtn = document.getElementById("skillBtn");
  const resultKills = document.getElementById("resultKills");
  const resultDistance = document.getElementById("resultDistance");
  const resultGems = document.getElementById("resultGems");
  const backToTitleBtn = document.getElementById("backToTitleBtn");

  let state = null;
  let rafId = null;
  let lastTime = 0;
  let mouseDown = false;

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
      e.preventDefault();
      setPlayerFromClientX(e.touches[0].clientX);
    },
    { passive: false }
  );

  gameArea.addEventListener(
    "touchmove",
    (e) => {
      if (!canMove()) return;
      e.preventDefault();
      setPlayerFromClientX(e.touches[0].clientX);
    },
    { passive: false }
  );

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

  function canMove() {
    return state && state.running && !state.clearPending;
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
      fireTimer: 0,
      enemyTimer: 0,
      bossSpawned: false,
      bossDefeated: false,
      invincibleTimer: 0
    };

    drawPlayer();
    updateHud();
    showScreen("battle");

    if (rafId) cancelAnimationFrame(rafId);
    lastTime = 0;
    rafId = requestAnimationFrame(loop);
  }

  function backToTitle() {
    if (rafId) cancelAnimationFrame(rafId);
    state = null;
    clearLayers();
    player.style.left = "50%";
    showScreen("title");
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
      checkEnemyPlayerCollision();
    } else {
      updateBullets(dt);
    }

    cleanupObjects();
    updateHud();

    if (state.hp <= 0) {
      finishGame(false);
      return;
    }

    rafId = requestAnimationFrame(loop);
  }

  function handleAutoFire(dt) {
    state.fireTimer += dt;
    if (state.fireTimer >= AUTO_FIRE_INTERVAL) {
      state.fireTimer = 0;
      spawnBullet();
    }
  }

  function spawnBullet() {
    const bullet = {
      x: state.playerX,
      y: state.areaHeight - PLAYER_BOTTOM - PLAYER_SIZE,
      width: BULLET_WIDTH,
      height: BULLET_HEIGHT,
      active: true,
      el: document.createElement("div")
    };

    bullet.el.className = "bullet";
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
    if (state.enemyTimer >= ENEMY_SPAWN_INTERVAL) {
      state.enemyTimer = 0;
      spawnEnemy();
    }
  }

  function spawnEnemy() {
    const width = 52;
    const height = 52;
    const x = rand(width / 2, state.areaWidth - width / 2);

    const enemy = {
      x,
      y: -height,
      width,
      height,
      hp: 1,
      speed: 120 + Math.random() * 45,
      drift: (Math.random() - 0.5) * 60,
      boss: false,
      active: true,
      el: document.createElement("div")
    };

    enemy.el.className = "enemy";
    enemy.el.textContent = "◆";
    enemy.el.style.left = `${enemy.x}px`;
    enemy.el.style.top = `${enemy.y}px`;
    enemiesLayer.appendChild(enemy.el);
    state.enemies.push(enemy);
  }

  function spawnBoss() {
    state.bossSpawned = true;

    const width = 92;
    const height = 92;

    const boss = {
      x: state.areaWidth / 2,
      y: -height,
      width,
      height,
      hp: 40,
      speed: 58,
      drift: 35,
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

      bullet.y -= dt * BULLET_SPEED;
      bullet.el.style.left = `${bullet.x}px`;
      bullet.el.style.top = `${bullet.y}px`;

      if (bullet.y < -bullet.height - 20) {
        bullet.active = false;
        continue;
      }

      for (const enemy of state.enemies) {
        if (!enemy.active) continue;

        if (isBulletHitEnemy(bullet, enemy)) {
          bullet.active = false;
          enemy.hp -= 1;
          state.skill = Math.min(100, state.skill + 7);
          spawnEffect(enemy.x, enemy.y + enemy.height / 2, enemy.boss ? 100 : 72);

          if (enemy.hp <= 0) {
            enemy.active = false;
            state.kills += enemy.boss ? 12 : 1;
            state.skill = Math.min(100, state.skill + (enemy.boss ? 28 : 12));

            if (enemy.boss) {
              handleBossDefeat();
            }
          }
          break;
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
        state.hp -= enemy.boss ? 34 : 14;
        state.invincibleTimer = 0.75;
        spawnEffect(state.playerX, state.areaHeight - 60, 90);
        break;
      }
    }
  }

  function useSkill() {
    if (!state || !state.running || state.clearPending) return;
    if (state.skill < 100) return;

    state.skill = 0;

    for (const enemy of state.enemies) {
      if (!enemy.active) continue;

      enemy.hp -= enemy.boss ? 12 : 999;
      spawnEffect(enemy.x, enemy.y + enemy.height / 2, enemy.boss ? 120 : 84);

      if (enemy.hp <= 0) {
        enemy.active = false;
        state.kills += enemy.boss ? 12 : 1;

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

  function spawnClearText() {
    const el = document.createElement("div");
    el.className = "clear-text";
    el.textContent = "CLEAR!";
    effectsLayer.appendChild(el);

    window.setTimeout(() => {
      el.remove();
    }, CLEAR_DELAY * 1000);
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
