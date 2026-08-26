import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { CHAPTERS, HEAVY_FRUITS, LEVELS, THEME_SETS, type CatchLevel } from "./levels";

const W = 360;
const H = 460;
const MAX_MISS = 3;
/** 1.1 传送果道：传送带的高度与停留时长 */
const BELT_Y = 140;
const BELT_DWELL = 1.3;
/** 1.1 沉甸果坡：接住沉水果后篮子变慢的时长（秒）与倍率 */
const HEAVY_SLOW_S = 1.2;
const HEAVY_SLOW_FACTOR = 0.55;
/** 1.1 连击星光坡：攒满几连击多算一颗 */
const COMBO_EVERY = 5;

/** 冒烟脚本才需要逐帧状态镜像，正常游玩不写 DOM 属性 */
const SMOKE = typeof location !== "undefined" && /[?&]smoke=1/.test(location.search);

interface Falling {
  x: number;
  y: number;
  vy: number;
  phase: number;
  emoji: string;
  kind: "fruit" | "gold" | "bad" | "heavy";
  /** 还要在传送带上滑几秒（0 = 不上带 / 已滑完） */
  belt: number;
}

const CSS = `
.fc-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #FFF9E8, #FFEFEF); border-radius: 16px; padding: 12px; user-select: none; touch-action: none; position: relative; }
.fc-top { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 6px; flex-wrap: wrap; }
.fc-badge { background: #fff; border-radius: 14px; padding: 5px 10px; font-weight: 700; color: #D08A3E; box-shadow: 0 2px 6px rgba(220,170,100,.25); font-size: 14px; }
.fc-bar { height: 10px; background: #fff; border-radius: 8px; overflow: hidden; margin-bottom: 8px; box-shadow: inset 0 1px 3px rgba(0,0,0,.08); }
.fc-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #FFD26E, #FF9E5E); border-radius: 8px; transition: width .3s; }
.fc-canvas { width: 100%; border-radius: 16px; display: block; touch-action: none; }
.fc-ctrl { display: flex; justify-content: center; gap: 24px; margin-top: 10px; }
.fc-btn { width: 84px; height: 56px; border: none; border-radius: 18px; font-size: 26px; background: #FFD9A0; color: #8A5A20; cursor: pointer; box-shadow: 0 4px 0 #EBBB77; touch-action: none; }
.fc-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 #EBBB77; }
.fc-msg { text-align: center; min-height: 20px; color: #D08A3E; font-weight: 700; margin-top: 8px; font-size: 14px; }
`;

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: CatchLevel = LEVELS[ctx.level];
  const theme = THEME_SETS[cfg.theme];
  const basketCount = cfg.baskets ?? 1;
  const heavyChance = cfg.heavyChance ?? 0;
  const conveyor = cfg.conveyor ?? 0;
  let destroyed = false;
  let paused = false;
  let ended = false;
  let raf = 0;
  let lastTime = 0;
  let spawnTimer = 0.4;
  let caught = 0;
  let missed = 0;
  let dir = 0;
  let basketX = W / 2;
  /** 沉水果压慢篮子的剩余秒数 */
  let slowLeft = 0;
  /** 连击数（连续接住，接到坏东西或漏接清零） */
  let combo = 0;
  const items: Falling[] = [];

  const wrap = document.createElement("div");
  wrap.className = "fc-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="fc-top">
      <span class="fc-badge fc-score">🧺 0 / ${cfg.target}</span>
      ${cfg.combo ? `<span class="fc-badge fc-combo">🔥 0</span>` : ""}
      <span class="fc-badge fc-miss">💗💗💗</span>
    </div>
    <div class="fc-bar"><div class="fc-fill"></div></div>
    <canvas class="fc-canvas" width="${W}" height="${H}"></canvas>
    <div class="fc-ctrl">
      <button class="fc-btn fc-left" type="button">⬅️</button>
      <button class="fc-btn fc-right" type="button">➡️</button>
    </div>
    <div class="fc-msg"></div>
  `;
  stage.appendChild(wrap);

  const canvas = wrap.querySelector(".fc-canvas") as HTMLCanvasElement;
  canvas.style.background = theme.bg;
  const c2d = canvas.getContext("2d");
  const scoreEl = wrap.querySelector(".fc-score") as HTMLElement;
  const comboEl = wrap.querySelector(".fc-combo") as HTMLElement | null;
  const missEl = wrap.querySelector(".fc-miss") as HTMLElement;
  const fillEl = wrap.querySelector(".fc-fill") as HTMLElement;
  const msgEl = wrap.querySelector(".fc-msg") as HTMLElement;
  const leftBtn = wrap.querySelector(".fc-left") as HTMLButtonElement;
  const rightBtn = wrap.querySelector(".fc-right") as HTMLButtonElement;

  const tips: string[] = [];
  if (basketCount > 1) tips.push("左右两只篮子镜像动");
  if (heavyChance > 0) tips.push("沉水果顶两颗但会压慢篮子");
  if (conveyor !== 0) tips.push("水果会先在传送带上滑一段");
  if (cfg.combo) tips.push(`连续接住攒连击，满 ${COMBO_EVERY} 连多算一颗`);
  if (cfg.badChance > 0) tips.push(`别接 ${theme.bad}`);
  if (cfg.goldChance >= 0.1) tips.push(`${theme.gold} 一颗顶${cfg.theme === 5 ? "三" : "两"}颗`);
  if (cfg.wind > 0) tips.push("有风，水果会飘");
  msgEl.textContent = tips.length > 0 ? `小心：${tips.join("，")}！` : "接住水果装满篮子吧！";

  function basketXs(): number[] {
    return basketCount > 1 ? [basketX, W - basketX] : [basketX];
  }

  function updateTop(): void {
    scoreEl.textContent = `🧺 ${caught} / ${cfg.target}`;
    missEl.textContent = "💗".repeat(Math.max(0, MAX_MISS - missed)) + "🤍".repeat(Math.min(MAX_MISS, missed));
    fillEl.style.width = `${Math.min(100, (caught / cfg.target) * 100)}%`;
    if (comboEl) comboEl.textContent = `🔥 ${combo}`;
  }

  function spawnItem(): void {
    const r = Math.random();
    let kind: Falling["kind"] = "fruit";
    if (r < cfg.badChance) kind = "bad";
    else if (r < cfg.badChance + cfg.goldChance) kind = "gold";
    else if (r < cfg.badChance + cfg.goldChance + heavyChance) kind = "heavy";
    const baseVy = (90 + Math.random() * 60 + caught * 3) * cfg.speed;
    items.push({
      x: 30 + Math.random() * (W - 60),
      y: -20,
      vy: kind === "heavy" ? baseVy * 1.35 : baseVy,
      phase: Math.random() * Math.PI * 2,
      emoji: kind === "bad"
        ? theme.bad
        : kind === "gold"
          ? theme.gold
          : kind === "heavy"
            ? HEAVY_FRUITS[Math.floor(Math.random() * HEAVY_FRUITS.length)]
            : theme.fruits[Math.floor(Math.random() * theme.fruits.length)],
      kind,
      belt: conveyor !== 0 ? BELT_DWELL : 0,
    });
  }

  function draw(): void {
    if (!c2d) return;
    c2d.clearRect(0, 0, W, H);
    c2d.font = "26px serif";
    if (cfg.theme === 9) {
      c2d.fillText("🌠", 40, 50);
      c2d.fillText("⭐", 250, 90);
    } else if (cfg.theme >= 6) {
      c2d.fillText("☁️", 40, 50);
      c2d.fillText("🌤️", 250, 90);
    } else if (cfg.theme === 5) {
      c2d.fillText("🌙", 40, 50);
      c2d.fillText("⭐", 250, 90);
    } else if (cfg.theme === 4) {
      c2d.fillText("🌧️", 40, 50);
      c2d.fillText("☁️", 250, 90);
    } else if (cfg.theme === 3) {
      c2d.fillText("🍃", 40, 50);
      c2d.fillText("🌬️", 250, 90);
    } else {
      c2d.fillText("☁️", 40, 50);
      c2d.fillText("🌈", 250, 90);
    }
    if (conveyor !== 0) {
      // 半空的传送带：一条圆头轨道 + 方向箭头
      c2d.fillStyle = "rgba(140,120,160,.35)";
      c2d.beginPath();
      c2d.roundRect(16, BELT_Y + 8, W - 32, 8, 4);
      c2d.fill();
      c2d.font = "14px serif";
      c2d.fillStyle = "rgba(90,70,120,.75)";
      const arrow = conveyor > 0 ? "▶" : "◀";
      for (let x = 40; x < W - 30; x += 60) c2d.fillText(arrow, x, BELT_Y + 4);
    }
    c2d.font = "30px serif";
    c2d.textAlign = "center";
    for (const f of items) c2d.fillText(f.emoji, f.x, f.y);
    c2d.font = "44px serif";
    for (const bx of basketXs()) c2d.fillText("🧺", bx, H - 18);
    c2d.textAlign = "left";
    if (SMOKE) {
      canvas.dataset.items = JSON.stringify(items.map((f) => [Math.round(f.x), Math.round(f.y), f.kind]));
      canvas.dataset.basket = String(Math.round(basketX));
    }
  }

  function finish(won: boolean): void {
    if (ended) return;
    ended = true;
    paused = true;
    cancelAnimationFrame(raf);
    draw();
    if (won) {
      const got = missed === 0 ? 3 : missed === 1 ? 2 : 1;
      ctx.win(got as 1 | 2 | 3, missed === 0 ? "一颗爱心都没掉，接得太稳啦！" : `装满 ${cfg.target} 个，篮子沉甸甸！`);
    } else {
      ctx.lose(`刚才接到 ${caught} 个，篮子再往水果下面挪一挪！`);
    }
  }

  /** 接住一个好东西之后的连击结算 */
  function onGoodCatch(gain: number, note?: string): void {
    caught += gain;
    combo++;
    if (cfg.combo && combo > 0 && combo % COMBO_EVERY === 0) {
      caught += 1;
      ctx.sfx("coin");
      msgEl.textContent = `🔥 ${combo} 连击！多算一颗！`;
    } else if (note) {
      msgEl.textContent = note;
    }
    updateTop();
    if (caught >= cfg.target) finish(true);
  }

  function tick(now: number): void {
    if (destroyed || paused) return;
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
    lastTime = now;

    slowLeft = Math.max(0, slowLeft - dt);
    const slowFactor = slowLeft > 0 ? HEAVY_SLOW_FACTOR : 1;
    basketX += dir * 260 * slowFactor * dt;
    basketX = Math.max(28, Math.min(W - 28, basketX));

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnItem();
      spawnTimer = Math.max(0.45, cfg.spawnMs / 1000 - caught * 0.015);
    }

    for (let i = items.length - 1; i >= 0; i--) {
      const f = items[i];
      if (f.belt > 0 && f.y >= BELT_Y) {
        // 传送带：先横着滑一段再继续掉
        f.y = BELT_Y;
        f.x += conveyor * dt;
        f.belt -= dt;
        if (f.x < 14 || f.x > W - 14) {
          f.x = Math.max(14, Math.min(W - 14, f.x));
          f.belt = 0;
        }
      } else {
        f.y += f.vy * dt;
      }
      if (cfg.wind > 0) {
        f.x += Math.sin(f.y / 42 + f.phase) * cfg.wind * 90 * dt;
        f.x = Math.max(14, Math.min(W - 14, f.x));
      }
      const inBand = f.y >= H - 34 && f.y <= H - 6;
      const nearBasket = inBand && basketXs().some((bx) => Math.abs(f.x - bx) < 34);
      if (nearBasket) {
        items.splice(i, 1);
        if (f.kind === "bad") {
          missed++;
          combo = 0;
          ctx.sfx("oops");
          msgEl.textContent = `${theme.bad} 不能进篮子，快躲开它们！`;
          updateTop();
          if (missed >= MAX_MISS) { finish(false); return; }
        } else if (f.kind === "gold") {
          ctx.sfx("coin");
          onGoodCatch(cfg.theme === 5 ? 3 : 2, cfg.theme === 5 ? "✨ 萤火虫一只顶三个！" : "🌟 金果子一颗顶两颗！");
          if (ended) return;
        } else if (f.kind === "heavy") {
          ctx.sfx("coin");
          slowLeft = HEAVY_SLOW_S;
          onGoodCatch(2, "🍉 好沉呀！顶两颗，篮子慢一下下～");
          if (ended) return;
        } else {
          ctx.sfx("pop");
          onGoodCatch(1);
          if (ended) return;
        }
      } else if (f.y > H + 20) {
        items.splice(i, 1);
        if (f.kind === "fruit" || f.kind === "heavy") {
          missed++;
          combo = 0;
          ctx.sfx("oops");
          updateTop();
          if (missed >= MAX_MISS) { finish(false); return; }
        }
      }
    }

    draw();
    raf = requestAnimationFrame(tick);
  }

  function hold(btn: HTMLButtonElement, d: number): void {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      dir = d;
      ctx.sfx("tap");
    });
    const stop = () => { if (dir === d) dir = 0; };
    btn.addEventListener("pointerup", stop);
    btn.addEventListener("pointerleave", stop);
    btn.addEventListener("pointercancel", stop);
  }
  hold(leftBtn, -1);
  hold(rightBtn, 1);

  let dragging = false;
  function canvasX(e: PointerEvent): number {
    const rect = canvas.getBoundingClientRect();
    return ((e.clientX - rect.left) / rect.width) * W;
  }
  const onPointerDown = (e: PointerEvent) => {
    dragging = true;
    basketX = Math.max(28, Math.min(W - 28, canvasX(e)));
  };
  const onPointerMove = (e: PointerEvent) => {
    if (dragging) basketX = Math.max(28, Math.min(W - 28, canvasX(e)));
  };
  const onPointerUp = () => { dragging = false; };
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") { dir = -1; e.preventDefault(); }
    if (e.key === "ArrowRight") { dir = 1; e.preventDefault(); }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if ((e.key === "ArrowLeft" && dir === -1) || (e.key === "ArrowRight" && dir === 1)) dir = 0;
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  updateTop();
  draw();
  raf = requestAnimationFrame((t) => {
    lastTime = t;
    raf = requestAnimationFrame(tick);
  });

  return {
    destroy() {
      destroyed = true;
      paused = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      wrap.remove();
    },
  };
}

export function mount(api: GameApi): { destroy: () => void } {
  return mountLevelGame(api, {
    id: meta.id,
    chapters: CHAPTERS,
    playLevel,
    mapHint: "一颗爱心都不掉就是 3 星！",
    grandMessage: "188 场水果雨全部接住，果篮超级冠军！",
  });
}
