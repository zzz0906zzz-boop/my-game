(() => {
  const SAVE_KEY = "my_game_save_v1";

  const save = loadSave();

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
  const moveLeftBtn = document.getElementById("moveLeftBtn");
  const moveRightBtn = document.getElementById("moveRightBtn");
  const skillBtn = document.getElementById("skillBtn");
  const resultKills = document.getElementById("resultKills");
  const resultDistance = document.getElementById("resultDistance");
  const resultGems = document.getElementById("resultGems");
  const backToTitleBtn = document.getElementById("backToTitleBtn");

  const laneLeft = 16.6666;
  const laneCenter = 50;
  const laneRight = 83.3333;
  const lanePositions = [laneLeft, laneCenter, laneRight];

  let state = null;
  let rafId = null;
  let lastTime = 0;

  updateGemText();
  showScreen("title");

  startGameBtn.addEventListener("click", startGame);
  backToTitleBtn.addEventListener("click", backToTitle);
  moveLeftBtn.addEventListener("click", () => movePlayer(-1));
  moveRightBtn.addEventListener("click", () => movePlayer(1));
  skillBtn.addEventListener("click", useSkill);

  let touchStartX = null;
  gameArea.addEventListener("touchstart", (e) => {
    touchStartX = e.touches[0].clientX;
  });

  gameArea.addEventListener("touchend", (e) => {
    if (touchStartX === null || !state || !state.running) return;
    const endX = e.changedTouches[0].clientX;
    const diff = endX - touchStartX;
    if (diff > 30) movePlayer(1);
    if (diff < -30) movePlayer(-1);
    touchStartX = null;
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

  function startGame() {
    clearLayers();

    state = {
      running: true,
      lane: 1,
      hp: 100,
      maxHp: 100,
      skill: 0,
      kills: 0,
      distance: 0,
      bullets: [],
      enemies: [],
      fireTimer: 0,
      enemyTimer: 0,
      bossSpawned: false,
      bossDefeated: false,
      invincibleTimer: 0,
      battleTime: 0
    };

    setPlayerLane();
    updateHud();
    showScreen("battle");

    if (rafId) cancelAnimationFrame(rafId);
    lastTime = 0;
    rafId = requestAnimationFrame(loop);
  }

  function backToTitle() {
    showScreen("title");
  }

  function movePlayer(dir) {
    if (!state || !state.running) return;
    state.lane += dir;
    if (state.lane < 0) state.lane = 0;
    if (state.lane > 2) state.lane = 2;
    setPlayerLane();
  }

  function setPlayerLane() {
    player.classList.remove("lane-left-pos", "lane-center-pos", "lane-right-pos");
    if (!state) {
      player.classList.add("lane-center-pos");
      return;
    }
    if (state.lane === 0) player.classList.add("lane-left-pos");
    if (state.lane === 1) player.classList.add("lane-center-pos");
    if (state.lane === 2) player.classList.add("lane-right-pos");
  }

  function loop(ts) {
    if (!state || !state.running) return;

    if (!lastTime) lastTime = ts;
    const dt = Math.min((ts - lastTime) / 1000, 0.033);
    lastTime = ts;

    state.battleTime += dt;
    state.distance += dt * 120;
    state.skill = Math.min(100, state.skill + dt * 6);

    if (state.invincibleTimer > 0) {
      state.invincibleTimer -= dt;
    }

    handleAutoFire(dt);
    handleEnemySpawn(dt);
    updateBullets(dt);
    updateEnemies(dt);
    checkEnemyPlayerCollision();
    cleanupObjects();
    updateHud();

    if (state.hp <= 0) {
      finishGame(false);
      return;
    }

    if (state.bossSpawned && state.bossDefeated) {
      finishGame(true);
      return;
    }

    rafId = requestAnimationFrame(loop);
  }

  function handleAutoFire(dt) {
    state.fireTimer += dt;
    const interval = 0.24;
    if (state.fireTimer >= interval) {
      state.fireTimer = 0;
      spawnBullet(state.lane);
    }
  }

  function spawnBullet(laneIndex) {
    const bullet = {
      lane: laneIndex,
      y: 84,
      active: true,
      el: document.createElement("div")
    };

    bullet.el.className = "bullet";
    bullet.el.style.left = lanePositions[laneIndex] + "%";
    bullet.el.style.bottom = bullet.y + "px";
    bulletsLayer.appendChild(bullet.el);
    state.bullets.push(bullet);
  }

  function handleEnemySpawn(dt) {
    if (state.bossSpawned) return;

    if (state.distance >= 1000) {
      spawnBoss();
      return;
    }

    state.enemyTimer += dt;
    const interval = 0.65;
    if (state.enemyTimer >= interval) {
      state.enemyTimer = 0;
      spawnEnemy();
    }
  }

  function spawnEnemy() {
    const lane = Math.floor(Math.random() * 3);
    const enemy = {
      lane,
      y: -50,
      hp: 1,
      speed: 180 + Math.random() * 80,
      boss: false,
      active: true,
      el: document.createElement("div")
    };

    enemy.el.className = "enemy";
    enemy.el.textContent = "◆";
    enemy.el.style.left = lanePositions[lane] + "%";
    enemy.el.style.top = enemy.y + "px";
    enemiesLayer.appendChild(enemy.el);
    state.enemies.push(enemy);
  }

  function spawnBoss() {
    state.bossSpawned = true;

    const boss = {
      lane: 1,
      y: -90,
      hp: 30,
      speed: 70,
      boss: true,
      active: true,
      el: document.createElement("div")
    };

    boss.el.className = "enemy boss";
    boss.el.textContent = "☠";
    boss.el.style.left = lanePositions[1] + "%";
    boss.el.style.top = boss.y + "px";
    enemiesLayer.appendChild(boss.el);
    state.enemies.push(boss);
  }

  function updateBullets(dt) {
    for (const bullet of state.bullets) {
      if (!bullet.active) continue;

      bullet.y += dt * 520;
      bullet.el.style.bottom = bullet.y + "px";

      if (bullet.y > gameArea.clientHeight + 40) {
        bullet.active = false;
        continue;
      }

      for (const enemy of state.enemies) {
        if (!enemy.active) continue;
        if (bullet.lane !== enemy.lane) continue;

        const enemyBottom = gameArea.clientHeight - enemy.y - (enemy.boss ? 72 : 44);
        const hitLine = bullet.y + 24;

        if (hitLine >= enemyBottom && hitLine <= enemyBottom + (enemy.boss ? 72 : 44)) {
          bullet.active = false;
          enemy.hp -= 1;
          state.skill = Math.min(100, state.skill + 8);

          spawnEffect(enemy.lane, enemy.y + (enemy.boss ? 36 : 22), enemy.boss ? 90 : 70);

          if (enemy.hp <= 0) {
            enemy.active = false;
            state.kills += enemy.boss ? 10 : 1;
            state.skill = Math.min(100, state.skill + (enemy.boss ? 40 : 14));
            if (enemy.boss) state.bossDefeated = true;
          }
          break;
        }
      }
    }
  }

  function updateEnemies(dt) {
    for (const enemy of state.enemies) {
      if (!enemy.active) continue;

      enemy.y += dt * enemy.speed;
      enemy.el.style.top = enemy.y + "px";

      if (enemy.y > gameArea.clientHeight + 100) {
        enemy.active = false;
        if (enemy.boss) {
          state.hp = 0;
        }
      }
    }
  }

  function checkEnemyPlayerCollision() {
    if (state.invincibleTimer > 0) return;

    const playerTop = gameArea.clientHeight - 80;
    const playerBottom = gameArea.clientHeight - 26;
    const playerLane = state.lane;

    for (const enemy of state.enemies) {
      if (!enemy.active) continue;
      if (enemy.lane !== playerLane) continue;

      const enemyTop = enemy.y;
      const enemyBottom = enemy.y + (enemy.boss ? 72 : 44);

      if (enemyBottom >= playerTop && enemyTop <= playerBottom) {
        enemy.active = false;
        state.hp -= enemy.boss ? 40 : 18;
        state.invincibleTimer = 0.7;
        spawnEffect(playerLane, gameArea.clientHeight - 60, 90);
        break;
      }
    }
  }

  function useSkill() {
    if (!state || !state.running) return;
    if (state.skill < 100) return;

    state.skill = 0;

    for (const enemy of state.enemies) {
      if (!enemy.active) continue;
      enemy.hp -= enemy.boss ? 8 : 999;
      spawnEffect(enemy.lane, enemy.y + (enemy.boss ? 36 : 22), enemy.boss ? 110 : 80);
      if (enemy.hp <= 0) {
        enemy.active = false;
        state.kills += enemy.boss ? 10 : 1;
        if (enemy.boss) state.bossDefeated = true;
      }
    }
  }

  function spawnEffect(laneIndex, topPx, size) {
    const el = document.createElement("div");
    el.className = "effect";
    el.style.left = lanePositions[laneIndex] + "%";
    el.style.top = topPx + "px";
    el.style.width = size + "px";
    el.style.height = size + "px";
    el.style.marginLeft = -(size / 2) + "px";
    el.style.marginTop = -(size / 2) + "px";
    effectsLayer.appendChild(el);

    setTimeout(() => {
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
    hpBar.style.width = Math.max(0, (state.hp / state.maxHp) * 100) + "%";
    skillBar.style.width = Math.max(0, state.skill) + "%";
    killCount.textContent = state.kills;
    distanceCount.textContent = Math.floor(state.distance);
  }

  function finishGame(clear) {
    state.running = false;
    if (rafId) cancelAnimationFrame(rafId);

    const earned = clear ? 30 + state.kills : 10 + Math.floor(state.kills / 2);
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
})();
