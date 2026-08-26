import { meta } from "./meta";
export { meta };

// 冒险小王:横版探索闯关。
// 朵朵背着回旋镖和抓钩钻进遗迹走廊:小坑直接跳,宽裂口甩抓钩荡过去,
// 守卫用回旋镖敲晕,集齐日纹石 / 月纹石 / 星纹石三件神器才推得开尽头的首领之门。
// 三种玩法:188 关八大遗迹战役、无尽遗迹(一层比一层深)、计时速通(每章记录最好时间)。
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { save } from "../../engine/save";
import {
  ARTIFACT_EMOJI,
  ARTIFACT_NAMES,
  CHAPTERS,
  LEVELS,
  buildEndlessFloor,
  buildSpeedrunCourse,
  type AdvLevel,
} from "./levels";
import {
  SPEEDRUN_KEY,
  boomerangOffset,
  clamp,
  formatTime,
  isNewTimeRecord,
  levelStars,
  parseBestTimes,
  serializeBestTimes,
  timeAttackStars,
} from "./logic";
import {
  PIT_Y,
  PLAYER_H,
  VIEW_H,
  createRun,
  emptyInput,
  enemyY,
  stepRun,
  type RunInput,
  type RunState,
} from "./sim";

const CSS = `
.ak-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:manipulation;display:flex;flex-direction:column;gap:8px;}
.ak-canvas{width:100%;display:block;border-radius:16px;background:#f6f0ff;touch-action:none;}
.ak-pad{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;}
.ak-btn{border:none;border-radius:16px;min-width:56px;min-height:52px;padding:6px 12px;font-size:20px;
  font-weight:900;cursor:pointer;font-family:inherit;color:#6b4a2a;background:#fff3dd;
  box-shadow:0 4px 0 rgba(180,140,90,.45);}
.ak-btn:active{transform:translateY(2px);box-shadow:0 2px 0 rgba(180,140,90,.45);}
.ak-btn-hot{background:#ffd8ea;color:#a03a6a;box-shadow:0 4px 0 rgba(200,110,160,.45);}
.ak-btn-cool{background:#d9ecff;color:#2f5f9a;box-shadow:0 4px 0 rgba(90,140,200,.45);}
.ak-btn:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
.ak-tip{text-align:center;font-size:13px;font-weight:700;color:#7a6046;line-height:1.5;}
.ak-bar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:6px;}
.ak-open{border:none;border-radius:999px;padding:9px 16px;font-size:15px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#f0a35c,#d9803a);box-shadow:0 4px 0 #b1642a;}
.ak-open.ak-open-time{background:linear-gradient(180deg,#7fa8e8,#5a80c8);box-shadow:0 4px 0 #45619b;}
.ak-open:active{transform:translateY(2px);box-shadow:0 2px 0 #b1642a;}
.ak-open:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
.ak-mode{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;border-radius:18px;padding:10px;
  background:linear-gradient(180deg,#fff6e8,#f2ecff);display:flex;flex-direction:column;gap:8px;}
.ak-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.ak-back{border:none;border-radius:999px;padding:7px 13px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#7a5aa0;box-shadow:0 3px 0 rgba(120,90,160,.28);}
.ak-back:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,90,160,.28);}
.ak-chip{background:#fff;border-radius:999px;padding:5px 12px;font-size:14px;font-weight:800;color:#7a5230;
  box-shadow:0 2px 6px rgba(170,140,110,.25);}
.ak-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;}
.ak-card{border:none;border-radius:16px;padding:10px;text-align:left;cursor:pointer;font-family:inherit;
  background:#ffffffe8;box-shadow:0 3px 8px rgba(160,140,120,.25);}
.ak-card:active{transform:scale(.97);}
.ak-card:focus-visible{outline:3px solid #3c2a6b;outline-offset:2px;}
.ak-card-t{font-size:15px;font-weight:900;color:#6b4a2a;}
.ak-card-s{font-size:12px;font-weight:700;color:#8a7358;margin-top:3px;}
.ak-over{border-radius:16px;background:#fffdf8;padding:14px;text-align:center;display:flex;
  flex-direction:column;gap:10px;align-items:center;box-shadow:0 3px 10px rgba(160,140,120,.25);}
.ak-over-t{font-size:20px;font-weight:900;color:#a4632a;}
.ak-over-s{font-size:14px;font-weight:700;color:#7a6046;line-height:1.6;}
@media (min-width:560px){.ak-grid{grid-template-columns:repeat(4,1fr);}}
@media (prefers-reduced-motion:reduce){.ak-btn:active{transform:none;}}
`;

export interface ClearInfo {
  timeMs: number;
  artifacts: number;
  hurts: number;
  heartsLeft: number;
}

interface RunnerOpts {
  level: AdvLevel;
  /** 画面左上角的一行小标题 */
  banner: string;
  /** 顶栏要不要显示计时 */
  showTimer: boolean;
  sfx: (name: "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump") => void;
  onClear: (info: ClearInfo) => void;
  onFail: (reason: string) => void;
}

/**
 * 一段可玩的遗迹走廊:战役关、无尽层、速通赛道共用这一套引擎。
 * 返回 destroy,负责收掉 rAF、键盘监听与 DOM。
 */
function createRunner(host: HTMLElement, opts: RunnerOpts): { destroy: () => void } {
  const lv = opts.level;
  const chapterColor = CHAPTERS[clamp(lv.chapter, 0, CHAPTERS.length - 1)].color;

  const wrap = document.createElement("div");
  wrap.className = "ak-wrap";
  wrap.innerHTML = `<style>${CSS}</style>`;
  const canvas = document.createElement("canvas");
  canvas.className = "ak-canvas";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "遗迹走廊:朵朵在石台之间跑跳、荡抓钩、找神器");
  wrap.appendChild(canvas);

  const pad = document.createElement("div");
  pad.className = "ak-pad";
  wrap.appendChild(pad);

  const tip = document.createElement("div");
  tip.className = "ak-tip";
  tip.textContent = `${lv.hint} 键盘:A D 跑、W 跳、F 回旋镖、G 抓钩(方向键 + L / K 也一样),Esc 暂停。`;
  wrap.appendChild(tip);
  host.appendChild(wrap);

  const c2d = canvas.getContext("2d") as CanvasRenderingContext2D;

  // ---- 状态 ----
  let cssW = 320;
  let cssH = 280;
  let scale = 0.6;
  let camX = 0;

  // 玩法状态完全交给 sim.ts:单测里机器人跑的就是这一份状态机,
  // 这里只负责把按键喂进去、把返回的事件变成音效和提示。
  const run: RunState = createRun(lv);
  let paused = false;
  let finished = false;
  let doorFlash = 0;
  let message = "";
  let messageTimer = 0;
  let destroyed = false;
  let raf = 0;
  let last = 0;

  const held = { left: false, right: false, up: false, down: false };
  /** 这一帧刚按下的动作键,推进一帧后清空 */
  const pending = { jump: false, hook: false, throw: false };

  function say(text: string): void {
    message = text;
    messageTimer = 1.8;
  }

  function syncSize(): void {
    cssW = Math.max(240, Math.round(host.clientWidth || wrap.clientWidth || 320));
    cssH = clamp(Math.round(cssW * 0.9), 250, 430);
    scale = cssH / VIEW_H;
    const dpr = Math.min(2, (globalThis as { devicePixelRatio?: number }).devicePixelRatio || 1);
    const bw = Math.max(1, Math.round(cssW * dpr));
    const bh = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    canvas.style.height = `${cssH}px`;
    c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---- 每帧推进 ----
  function step(dt: number): void {
    if (paused || finished) {
      pending.jump = false;
      pending.hook = false;
      pending.throw = false;
      return;
    }
    messageTimer = Math.max(0, messageTimer - dt);
    doorFlash += dt;

    const input: RunInput = {
      ...emptyInput(),
      left: held.left,
      right: held.right,
      jump: pending.jump,
      hook: pending.hook,
      throw: pending.throw,
    };
    pending.jump = false;
    pending.hook = false;
    pending.throw = false;

    for (const ev of stepRun(lv, run, input, dt)) {
      switch (ev.kind) {
        case "jump":
          opts.sfx("jump");
          break;
        case "hookOn":
        case "land":
          opts.sfx("tap");
          break;
        case "hookOff":
        case "throw":
          opts.sfx("pop");
          break;
        case "noAnchor":
          opts.sfx("oops");
          say("这附近没有能挂的藤环,再往前走走～");
          break;
        case "enemyDown":
          opts.sfx("coin");
          say("回旋镖打中守卫啦!");
          break;
        case "artifact":
          opts.sfx("coin");
          say(
            ev.left <= 0
              ? "三件神器集齐!首领之门开啦,冲!"
              : `拿到${ARTIFACT_NAMES[ev.artifact]}!还差 ${ev.left} 件`
          );
          break;
        case "doorLocked":
          if (messageTimer <= 0) say(`门上还缺 ${ev.need} 颗石头,先去找齐神器～`);
          break;
        case "hurt":
          opts.sfx("oops");
          say(ev.text);
          break;
        case "fail":
          finished = true;
          opts.onFail(ev.text);
          break;
        case "clear":
          finished = true;
          opts.sfx("win");
          opts.onClear({
            timeMs: Math.round(run.elapsed * 1000),
            artifacts: run.got.size,
            hurts: run.hurts,
            heartsLeft: run.hearts,
          });
          break;
      }
    }
  }

  // ---- 画面 ----
  function worldX(x: number): number {
    return (x - camX) * scale;
  }

  function worldY(y: number): number {
    return y * scale;
  }

  function drawRoundRect(x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string): void {
    c2d.beginPath();
    c2d.roundRect(x, y, w, h, r);
    c2d.fillStyle = fill;
    c2d.fill();
    if (stroke) {
      c2d.strokeStyle = stroke;
      c2d.lineWidth = 2;
      c2d.stroke();
    }
  }

  function drawBackground(): void {
    const g = c2d.createLinearGradient(0, 0, 0, cssH);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(1, chapterColor);
    c2d.fillStyle = g;
    c2d.fillRect(0, 0, cssW, cssH);
    // 远景:随摄像机缓慢移动的石柱剪影,给横版一点纵深
    c2d.fillStyle = "rgba(140,120,170,.15)";
    const step2 = 260;
    const startX = Math.floor((camX * 0.4) / step2) * step2;
    for (let i = -1; i < 8; i++) {
      const wx = startX + i * step2;
      const sx = (wx - camX * 0.4) * scale;
      const ww = 70 * scale;
      const hh = 200 * scale;
      c2d.fillRect(sx, cssH - hh, ww, hh);
      c2d.beginPath();
      c2d.arc(sx + ww / 2, cssH - hh, ww / 2, Math.PI, 0);
      c2d.fill();
    }
  }

  function drawPlatforms(): void {
    for (const p of lv.platforms) {
      const x = worldX(p.x);
      const y = worldY(p.y);
      const w = p.w * scale;
      const h = (PIT_Y + 40 - p.y) * scale;
      if (x + w < -20 || x > cssW + 20) continue;
      drawRoundRect(x, y, w, h, 10 * scale, "#c9a27a");
      drawRoundRect(x, y, w, 12 * scale, 6 * scale, "#8fc47a");
      c2d.fillStyle = "rgba(255,255,255,.35)";
      for (let i = 0; i < Math.floor(p.w / 60); i++) {
        c2d.fillRect(x + (14 + i * 60) * scale, y + 26 * scale, 26 * scale, 4 * scale);
      }
    }
    for (const pit of lv.pits) {
      if (!pit.spiky) continue;
      const y = worldY(PIT_Y);
      c2d.fillStyle = "#8a6a9a";
      for (let x = pit.from + 16; x < pit.to - 8; x += 26) {
        const sx = worldX(x);
        if (sx < -20 || sx > cssW + 20) continue;
        c2d.beginPath();
        c2d.moveTo(sx, y);
        c2d.lineTo(sx + 11 * scale, y - 22 * scale);
        c2d.lineTo(sx + 22 * scale, y);
        c2d.closePath();
        c2d.fill();
      }
    }
  }

  function drawAnchors(): void {
    for (const a of lv.anchors) {
      const x = worldX(a.x);
      const y = worldY(a.y);
      if (x < -30 || x > cssW + 30) continue;
      c2d.strokeStyle = "#6fae5c";
      c2d.lineWidth = 3 * scale;
      c2d.beginPath();
      c2d.moveTo(x, 0);
      c2d.lineTo(x, y);
      c2d.stroke();
      c2d.strokeStyle = "#4f8c3f";
      c2d.lineWidth = 5 * scale;
      c2d.beginPath();
      c2d.arc(x, y, 13 * scale, 0, Math.PI * 2);
      c2d.stroke();
    }
  }

  function drawArtifacts(): void {
    for (const art of lv.artifacts) {
      if (run.got.has(art.kind)) continue;
      const x = worldX(art.x);
      const y = worldY(art.y) + Math.sin(doorFlash * 2 + art.kind) * 4;
      if (x < -30 || x > cssW + 30) continue;
      c2d.fillStyle = "rgba(255,240,180,.75)";
      c2d.beginPath();
      c2d.arc(x, y, 20 * scale, 0, Math.PI * 2);
      c2d.fill();
      c2d.font = `${Math.round(26 * scale)}px sans-serif`;
      c2d.textAlign = "center";
      c2d.textBaseline = "middle";
      c2d.fillText(ARTIFACT_EMOJI[art.kind], x, y);
    }
  }

  function drawEnemies(): void {
    for (const e of run.enemies) {
      if (!e.alive) continue;
      const ey = enemyY(e);
      const x = worldX(e.x);
      const y = worldY(ey);
      if (x < -40 || x > cssW + 40) continue;
      c2d.fillStyle = e.kind === "flyer" ? "#b9a6ea" : "#a08464";
      c2d.beginPath();
      c2d.ellipse(x, y - 20 * scale, 19 * scale, 19 * scale, 0, 0, Math.PI * 2);
      c2d.fill();
      c2d.fillStyle = "#3a3a4a";
      c2d.beginPath();
      c2d.arc(x - 6 * scale, y - 24 * scale, 3 * scale, 0, Math.PI * 2);
      c2d.arc(x + 6 * scale, y - 24 * scale, 3 * scale, 0, Math.PI * 2);
      c2d.fill();
      c2d.strokeStyle = "#3a3a4a";
      c2d.lineWidth = 2 * scale;
      c2d.beginPath();
      c2d.arc(x, y - 15 * scale, 6 * scale, 0.15 * Math.PI, 0.85 * Math.PI);
      c2d.stroke();
    }
  }

  function drawDoor(): void {
    const x = worldX(lv.door.x);
    const y = worldY(lv.door.y);
    if (x < -80 || x > cssW + 80) return;
    const w = 62 * scale;
    const h = 76 * scale;
    const open = run.got.size >= 3;
    drawRoundRect(x, y - h, w, h, 14 * scale, open ? "#ffe6a8" : "#9a8a7a", open ? "#e0a83a" : "#6f6357");
    for (let i = 0; i < 3; i++) {
      c2d.font = `${Math.round(15 * scale)}px sans-serif`;
      c2d.textAlign = "center";
      c2d.textBaseline = "middle";
      c2d.globalAlpha = run.got.has(i) ? 1 : 0.25;
      c2d.fillText(ARTIFACT_EMOJI[i], x + w / 2, y - h + (16 + i * 22) * scale);
      c2d.globalAlpha = 1;
    }
    if (open) {
      c2d.strokeStyle = `rgba(255,210,90,${0.5 + Math.sin(doorFlash * 5) * 0.4})`;
      c2d.lineWidth = 4 * scale;
      c2d.strokeRect(x - 3, y - h - 3, w + 6, h + 6);
    }
  }

  function drawPlayer(): void {
    if (run.invincible > 0 && Math.floor(run.invincible * 10) % 2 === 0) return;
    const facing = run.facing;
    const x = worldX(run.px);
    const y = worldY(run.py);
    const r = 17 * scale;
    if (run.hook) {
      const a = lv.anchors[run.hook.anchor];
      c2d.strokeStyle = "#7a5a3a";
      c2d.lineWidth = 3 * scale;
      c2d.beginPath();
      c2d.moveTo(worldX(a.x), worldY(a.y));
      c2d.lineTo(x, y - PLAYER_H * 0.6 * scale);
      c2d.stroke();
    }
    c2d.fillStyle = "rgba(90,80,110,.18)";
    c2d.beginPath();
    c2d.ellipse(x, y + 3 * scale, r, 5 * scale, 0, 0, Math.PI * 2);
    c2d.fill();
    // 朵朵:圆脑袋 + 小马尾 + 探险背包带
    c2d.fillStyle = "#ffb3c8";
    c2d.beginPath();
    c2d.roundRect(x - r, y - PLAYER_H * scale, r * 2, PLAYER_H * scale, 12 * scale);
    c2d.fill();
    c2d.fillStyle = "#f28fb0";
    c2d.beginPath();
    c2d.arc(x - facing * r, y - PLAYER_H * 0.74 * scale, 7 * scale, 0, Math.PI * 2);
    c2d.fill();
    c2d.fillStyle = "#3a3a4a";
    c2d.beginPath();
    c2d.arc(x - 5 * scale + facing * 2 * scale, y - PLAYER_H * 0.72 * scale, 3 * scale, 0, Math.PI * 2);
    c2d.arc(x + 6 * scale + facing * 2 * scale, y - PLAYER_H * 0.72 * scale, 3 * scale, 0, Math.PI * 2);
    c2d.fill();
    c2d.strokeStyle = "#3a3a4a";
    c2d.lineWidth = 2 * scale;
    c2d.beginPath();
    c2d.arc(x + facing * 1 * scale, y - PLAYER_H * 0.58 * scale, 5 * scale, 0.15 * Math.PI, 0.85 * Math.PI);
    c2d.stroke();
  }

  function drawBoomerang(): void {
    const boom = run.boom;
    if (!boom) return;
    const off = boomerangOffset(boom.t, boom.dir);
    const x = worldX(boom.ox + off.x);
    const y = worldY(boom.oy + off.y);
    c2d.save();
    c2d.translate(x, y);
    c2d.rotate(boom.t * 18);
    c2d.strokeStyle = "#8a5a30";
    c2d.lineWidth = 5 * scale;
    c2d.lineCap = "round";
    c2d.beginPath();
    c2d.moveTo(-10 * scale, 6 * scale);
    c2d.lineTo(0, -8 * scale);
    c2d.lineTo(10 * scale, 6 * scale);
    c2d.stroke();
    c2d.restore();
  }

  function drawHud(): void {
    c2d.textAlign = "left";
    c2d.textBaseline = "middle";
    c2d.font = `bold ${Math.max(12, Math.round(15 * scale))}px sans-serif`;
    c2d.fillStyle = "rgba(255,255,255,.85)";
    c2d.beginPath();
    c2d.roundRect(6, 6, cssW - 12, 30, 12);
    c2d.fill();
    c2d.fillStyle = "#7a5230";
    c2d.fillText(opts.banner, 14, 21);
    c2d.textAlign = "right";
    const artText = [0, 1, 2].map((k) => (run.got.has(k) ? ARTIFACT_EMOJI[k] : "▫")).join("");
    const heartText = "💗".repeat(Math.max(0, run.hearts));
    const timeText = opts.showTimer ? ` ⏱ ${run.elapsed.toFixed(1)}s` : "";
    c2d.fillText(`${artText} ${heartText}${timeText}`, cssW - 14, 21);
    if (messageTimer > 0 && message) {
      c2d.textAlign = "center";
      c2d.fillStyle = "rgba(60,40,80,.8)";
      c2d.beginPath();
      c2d.roundRect(cssW * 0.08, cssH - 46, cssW * 0.84, 30, 12);
      c2d.fill();
      c2d.fillStyle = "#fff";
      c2d.fillText(message, cssW / 2, cssH - 31);
    }
    if (paused) {
      c2d.fillStyle = "rgba(255,250,245,.9)";
      c2d.fillRect(0, 0, cssW, cssH);
      c2d.textAlign = "center";
      c2d.fillStyle = "#a4632a";
      c2d.font = `bold ${Math.round(22)}px sans-serif`;
      c2d.fillText("⏸ 休息一下", cssW / 2, cssH / 2 - 12);
      c2d.font = `bold ${Math.round(15)}px sans-serif`;
      c2d.fillText("再按一次 Esc 或点 ⏸ 继续", cssW / 2, cssH / 2 + 16);
    }
  }

  function draw(): void {
    const visW = cssW / scale;
    camX = clamp(run.px - visW / 2, 0, Math.max(0, lv.width - visW));
    drawBackground();
    drawPlatforms();
    drawAnchors();
    drawDoor();
    drawArtifacts();
    drawEnemies();
    drawBoomerang();
    drawPlayer();
    drawHud();
  }

  function frame(now: number): void {
    if (destroyed) return;
    const dt = Math.min(0.033, Math.max(0, (now - last) / 1000));
    last = now;
    syncSize();
    step(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  // ---- 输入 ----
  function togglePause(): void {
    if (finished) return;
    paused = !paused;
    opts.sfx("tap");
  }

  const KEY_LEFT = new Set(["a", "A", "ArrowLeft"]);
  const KEY_RIGHT = new Set(["d", "D", "ArrowRight"]);
  const KEY_UP = new Set(["w", "W", "ArrowUp"]);
  const KEY_DOWN = new Set(["s", "S", "ArrowDown"]);
  const KEY_BOOM = new Set(["f", "F", "l", "L"]);
  const KEY_HOOK = new Set(["g", "G", "k", "K"]);

  function onKeyDown(e: KeyboardEvent): void {
    if (destroyed) return;
    if (e.key === "Escape") {
      e.preventDefault();
      togglePause();
      return;
    }
    if (KEY_LEFT.has(e.key)) {
      held.left = true;
      e.preventDefault();
    } else if (KEY_RIGHT.has(e.key)) {
      held.right = true;
      e.preventDefault();
    } else if (KEY_UP.has(e.key)) {
      if (!held.up) pending.jump = true;
      held.up = true;
      e.preventDefault();
    } else if (KEY_DOWN.has(e.key)) {
      held.down = true;
      e.preventDefault();
    } else if (KEY_BOOM.has(e.key)) {
      if (!e.repeat) pending.throw = true;
      e.preventDefault();
    } else if (KEY_HOOK.has(e.key)) {
      if (!e.repeat) pending.hook = true;
      e.preventDefault();
    }
  }

  function onKeyUp(e: KeyboardEvent): void {
    if (KEY_LEFT.has(e.key)) held.left = false;
    else if (KEY_RIGHT.has(e.key)) held.right = false;
    else if (KEY_UP.has(e.key)) held.up = false;
    else if (KEY_DOWN.has(e.key)) held.down = false;
  }

  function padButton(label: string, aria: string, cls: string): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `ak-btn${cls ? ` ${cls}` : ""}`;
    b.textContent = label;
    b.setAttribute("aria-label", aria);
    pad.appendChild(b);
    return b;
  }

  function holdButton(btn: HTMLButtonElement, on: () => void, off: () => void): void {
    const down = (ev: Event): void => {
      ev.preventDefault();
      on();
    };
    const up = (): void => off();
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointerleave", up);
    btn.addEventListener("pointercancel", up);
  }

  const bLeft = padButton("◀", "向左跑", "");
  const bRight = padButton("▶", "向右跑", "");
  const bJump = padButton("⤴", "跳", "ak-btn-hot");
  const bBoom = padButton("🪃", "扔回旋镖", "ak-btn-hot");
  const bHook = padButton("🪝", "甩抓钩", "ak-btn-cool");
  const bPause = padButton("⏸", "暂停", "");
  holdButton(bLeft, () => (held.left = true), () => (held.left = false));
  holdButton(bRight, () => (held.right = true), () => (held.right = false));
  bJump.addEventListener("click", () => (pending.jump = true));
  bBoom.addEventListener("click", () => (pending.throw = true));
  bHook.addEventListener("click", () => (pending.hook = true));
  bPause.addEventListener("click", () => togglePause());

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  syncSize();
  last = performance.now();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      destroyed = true;
      finished = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 战役:188 关
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const runner = createRunner(stage, {
    level: LEVELS[ctx.level],
    banner: `${CHAPTERS[LEVELS[ctx.level].chapter].emoji} 第 ${ctx.level + 1} 关`,
    showTimer: false,
    sfx: ctx.sfx,
    onClear: (info) => ctx.win(levelStars(info.artifacts, info.hurts), clearLine(info)),
    onFail: () => ctx.lose("这条走廊先撤一步～下一趟贴着墙走、先清掉挡路的那只,血量就省下来了!"),
  });
  return { destroy: () => runner.destroy() };
}

/** 过关时的一句夸奖(纯函数,便于测试) */
export function clearLine(info: ClearInfo): string {
  if (info.hurts === 0) return "三件神器齐了,而且一次都没受伤,厉害!";
  if (info.hurts === 1) return "只磕了一下就推开了首领之门,越来越稳啦!";
  return `神器全收齐,推开了首领之门!这次受了 ${info.hurts} 次伤,下次更稳。`;
}

/** 无尽遗迹结束时的一句话 */
export function endlessLine(floor: number, best: number): string {
  if (floor > best) return `新纪录!你钻到了第 ${floor} 层遗迹!`;
  return `这次下到第 ${floor} 层,最深纪录是第 ${best} 层。血量剩一半就先绕开怪、找补给,再来一趟就能刷新它!`;
}

// ---------------------------------------------------------------------------
// 无尽遗迹
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "ak-mode";
  wrap.innerHTML = `<style>${CSS}</style>`;
  const head = document.createElement("div");
  head.className = "ak-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "ak-back";
  back.textContent = "◀ 回选关";
  const chip = document.createElement("span");
  chip.className = "ak-chip";
  head.append(back, chip);
  const stage = document.createElement("div");
  wrap.append(head, stage);
  host.appendChild(wrap);

  let floor = 1;
  let runner: { destroy: () => void } | null = null;
  let best = save.getGameProgress(meta.id).endlessBest;

  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });

  function refreshChip(): void {
    chip.textContent = `♾️ 无尽遗迹 · 第 ${floor} 层 · 最深纪录 第 ${best} 层`;
  }

  function showOver(title: string, sub: string): void {
    runner?.destroy();
    runner = null;
    stage.innerHTML = "";
    const box = document.createElement("div");
    box.className = "ak-over";
    box.innerHTML = `<div class="ak-over-t">${title}</div><div class="ak-over-s">${sub}</div>`;
    const again = document.createElement("button");
    again.type = "button";
    again.className = "ak-open";
    again.textContent = "🔁 从第 1 层再来";
    again.addEventListener("click", () => {
      api.play("tap");
      floor = 1;
      startFloor();
    });
    box.appendChild(again);
    stage.appendChild(box);
  }

  function startFloor(): void {
    runner?.destroy();
    stage.innerHTML = "";
    refreshChip();
    const level = buildEndlessFloor(floor);
    runner = createRunner(stage, {
      level,
      banner: `♾️ 第 ${floor} 层`,
      showTimer: true,
      sfx: (n) => api.play(n),
      onClear: () => {
        best = save.recordEndlessBest(meta.id, floor);
        api.addStars(1);
        floor++;
        startFloor();
      },
      onFail: () => {
        const reached = Math.max(0, floor - 1);
        best = save.recordEndlessBest(meta.id, reached);
        showOver("遗迹之旅结束", endlessLine(reached, best));
      },
    });
  }

  startFloor();

  return {
    destroy() {
      runner?.destroy();
      runner = null;
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 计时速通
// ---------------------------------------------------------------------------

function loadTimes(): number[] {
  try {
    return parseBestTimes(localStorage.getItem(SPEEDRUN_KEY), CHAPTERS.length);
  } catch {
    return parseBestTimes(null, CHAPTERS.length);
  }
}

function saveTimes(times: number[]): void {
  try {
    localStorage.setItem(SPEEDRUN_KEY, serializeBestTimes(times));
  } catch {
    // 存不进去也不影响这一局
  }
}

function mountSpeedrun(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "ak-mode";
  wrap.innerHTML = `<style>${CSS}</style>`;
  const head = document.createElement("div");
  head.className = "ak-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "ak-back";
  back.textContent = "◀ 回选关";
  const chip = document.createElement("span");
  chip.className = "ak-chip";
  chip.textContent = "⏱️ 计时速通 · 每章一条赛道,只比时间";
  head.append(back, chip);
  const stage = document.createElement("div");
  wrap.append(head, stage);
  host.appendChild(wrap);

  let times = loadTimes();
  let runner: { destroy: () => void } | null = null;

  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });

  function showPicker(): void {
    runner?.destroy();
    runner = null;
    stage.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "ak-grid";
    CHAPTERS.forEach((ch, ci) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "ak-card";
      card.style.background = ch.color;
      const best = times[ci];
      card.innerHTML = `<div class="ak-card-t">${ch.emoji} ${ch.name}</div>
        <div class="ak-card-s">${best > 0 ? `最好成绩 ${formatTime(best)}` : "还没跑过,来试试!"}</div>`;
      card.addEventListener("click", () => {
        api.play("tap");
        startCourse(ci);
      });
      grid.appendChild(card);
    });
    stage.appendChild(grid);
  }

  function startCourse(ci: number): void {
    runner?.destroy();
    stage.innerHTML = "";
    const level = buildSpeedrunCourse(ci);
    runner = createRunner(stage, {
      level,
      banner: `⏱️ ${CHAPTERS[ci].name} 速通`,
      showTimer: true,
      sfx: (n) => api.play(n),
      onClear: (info) => {
        const fresh = isNewTimeRecord(times[ci], info.timeMs);
        if (fresh) {
          times = times.slice();
          times[ci] = info.timeMs;
          saveTimes(times);
        }
        const stars = timeAttackStars(info.timeMs / 1000, level.parSec);
        api.addStars(stars);
        showResult(
          ci,
          fresh ? "🎉 新纪录!" : "冲过终点!",
          `用时 ${formatTime(info.timeMs)}(目标 ${level.parSec} 秒)· 本章最好成绩 ${formatTime(times[ci])}`
        );
      },
      onFail: () => showResult(ci, "这次没跑完", "路线你已经记住一大半了～下一趟在拐角提前减速,少撞一次就能跑完全程!"),
    });
  }

  function showResult(ci: number, title: string, sub: string): void {
    runner?.destroy();
    runner = null;
    stage.innerHTML = "";
    const box = document.createElement("div");
    box.className = "ak-over";
    box.innerHTML = `<div class="ak-over-t">${title}</div><div class="ak-over-s">${sub}</div>`;
    const again = document.createElement("button");
    again.type = "button";
    again.className = "ak-open ak-open-time";
    again.textContent = "🔁 再跑一次";
    again.addEventListener("click", () => {
      api.play("tap");
      startCourse(ci);
    });
    const list = document.createElement("button");
    list.type = "button";
    list.className = "ak-back";
    list.textContent = "🗺️ 换一条赛道";
    list.addEventListener("click", () => {
      api.play("tap");
      showPicker();
    });
    box.append(again, list);
    stage.appendChild(box);
  }

  showPicker();

  return {
    destroy() {
      runner?.destroy();
      runner = null;
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 挂载:模式条 + 188 关地图
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = CSS;
  const bar = document.createElement("div");
  bar.className = "ak-bar";
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const endlessBtn = document.createElement("button");
  endlessBtn.type = "button";
  endlessBtn.className = "ak-open";
  const timeBtn = document.createElement("button");
  timeBtn.type = "button";
  timeBtn.className = "ak-open ak-open-time";
  timeBtn.textContent = "⏱️ 计时速通";
  bar.append(endlessBtn, timeBtn);

  let mode: { destroy: () => void } | null = null;

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 无尽遗迹 · 最深 第 ${best} 层` : "♾️ 无尽遗迹 · 点我下探!";
  }

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBar();
  }

  function openMode(make: (host: HTMLElement, api: GameApi, back: () => void) => { destroy: () => void }): void {
    if (mode) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    mode = make(modeHost, api, closeMode);
  }

  endlessBtn.addEventListener("click", () => openMode(mountEndless));
  timeBtn.addEventListener("click", () => openMode(mountSpeedrun));
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: "小坑直接跳,宽裂口甩抓钩;集齐三件神器才推得开首领之门。",
      grandMessage: "188 关八大遗迹全部探完,你就是真正的冒险小王!",
      guideTitle: "冒险小王 · 探险手记",
    }
  );

  return {
    destroy() {
      mode?.destroy();
      mode = null;
      level.destroy();
      root.remove();
    },
  };
}
