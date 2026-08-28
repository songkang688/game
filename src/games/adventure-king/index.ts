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
  ROPE_MAX,
  SPEEDRUN_KEY,
  boomerangOffset,
  clamp,
  formatTime,
  isNewTimeRecord,
  levelStars,
  parseBestTimes,
  pickAnchor,
  serializeBestTimes,
  timeAttackStars,
} from "./logic";
import {
  AK_CARD,
  AK_PALETTE,
  AK_TIMING,
  VisualFx,
  anchorGlow,
  artifactSpinPhase,
  boomTrailSegments,
  castleBoxSvg,
  castleGlyphSvg,
  castleHeroSvg,
  drawAnchorSprite,
  drawArtifactGem,
  drawArtifactSprite,
  drawBoomerangSprite,
  drawEnemySprite,
  drawFlagProgress,
  drawHudCard,
  drawPlayerSprite,
  drawRope,
  drawStunFx,
  drawTrail,
  hatDegraded,
  invincibleStyle,
  landSquash,
  playerPose,
  runLean,
  scarfAngle,
  shadeHex,
  shadowGroundY,
  swingLean,
} from "./visual";
import { albumCells, albumSummary, caseGlyph } from "./albumView";
import { drawHangingRoots, drawTerrainProfile, terrainBands } from "../../art/kit/terrain";
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
import {
  ALBUM_KEY,
  C_CGATE,
  C_DOOR,
  C_EXIT,
  C_HIDDEN,
  C_KEY,
  C_PGATE,
  C_PLATE,
  C_PORTAL,
  C_SEESAW_L,
  C_SEESAW_R,
  C_STICKER,
  C_SWITCH,
  C_WALL,
  Disposer,
  PUZZLE_KINDS,
  STICKER_SETS,
  albumBonusStars,
  buildCastleRoom,
  castleLine,
  castleRoomTitle,
  cellAt,
  colorGateOpen,
  exploredRatio,
  isPlateDown,
  miniMapRows,
  nextSticker,
  parseAlbum,
  resetRoom,
  roomStuck,
  seesawOf,
  seesawWalkable,
  serializeAlbum,
  stepMove,
  stickerId,
  type CastleRoom,
  type Dir,
  type RoomState,
} from "./explore";
import { bodyFontUpliftCss, touchUpliftCss } from "../../art/kit/uiTouch";
import { corridorRoomPx } from "./corridorFit";

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
.ak-bar[hidden]{display:none;}
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
.ak-chip{background:rgba(255,255,255,.72);border:1.5px solid rgba(122,82,48,.28);border-radius:12px;
  padding:5px 12px;font-size:14px;font-weight:800;color:#7a5230;box-shadow:0 2px 6px rgba(170,140,110,.18);}
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
/* N-16(trio-r7):矮横屏走廊切双栏 —— 画布在左、键排 + 提示行在右(同 dot-maze 的 N-27 配方)。
   画布上方壳层头部就占 ~112px,键排再垫底只剩 104px 余量,被 160px 显示下限顶住必裁;
   挪到右栏后画布可用高 ~206px、键排 ⏸ 六键全程在线。键排收紧一档(热区仍 ≥44px),
   提示行的键盘段(.ak-tip-keys)在触屏矮横屏里藏掉,字号守 W6R1-10 的 14px 底线 */
@media (max-height:500px){
  .ak-wrap{display:grid;grid-template-columns:minmax(0,1fr) minmax(150px,210px);
    grid-template-rows:auto 1fr;align-items:start;column-gap:10px;}
  .ak-canvas{grid-column:1;grid-row:1/span 2;}
  .ak-pad{grid-column:2;grid-row:1;align-content:flex-start;}
  .ak-tip{grid-column:2;grid-row:2;}
  .ak-btn{min-height:44px;min-width:48px;font-size:18px;padding:4px 10px;}
  .ak-tip-keys{display:none;}
}
@media (prefers-reduced-motion:reduce){.ak-btn:active{transform:none;}}

/* 1.2 探索层:无尽古堡的俯视房间(advk- 前缀,和上面的横版走廊分开) */
.advk-room{display:grid;gap:2px;background:#e9dfcf;border-radius:14px;padding:6px;margin:0 auto;
  max-width:420px;width:100%;}
.advk-cell{aspect-ratio:1;border-radius:5px;display:flex;align-items:center;justify-content:center;
  font-size:15px;line-height:1;background:#fffaf0;}
.advk-cell svg{width:88%;height:88%;display:block;}
.advk-wall{background:#8d7a62;}
.advk-dim{background:#f3ece0;color:#b8a88c;}
.advk-seen{background:#fff4e0;}
.advk-hot{background:#ffe6c9;}
.advk-me{background:#ffd9ec;outline:2px solid #e07aae;}
.advk-pad2{display:grid;grid-template-columns:repeat(3,56px);gap:6px;justify-content:center;margin-top:8px;}
.advk-pad2 button{border:none;border-radius:14px;min-height:52px;font-size:20px;font-weight:900;
  cursor:pointer;font-family:inherit;color:#6b4a2a;background:#fff3dd;box-shadow:0 4px 0 rgba(180,140,90,.45);}
.advk-pad2 button:active{transform:translateY(2px);box-shadow:0 2px 0 rgba(180,140,90,.45);}
.advk-pad2 button:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
.advk-pad2 .advk-slot{visibility:hidden;}
.advk-hud{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;font-size:14px;font-weight:800;
  color:#6b4a2a;line-height:1.5;}
.advk-hud span{background:rgba(255,255,255,.72);border:1.5px solid rgba(122,82,48,.28);border-radius:12px;
  padding:4px 10px;box-shadow:0 2px 5px rgba(170,140,110,.18);}
.advk-tools{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.advk-tool{border:none;border-radius:999px;padding:8px 14px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#7a5230;box-shadow:0 3px 0 rgba(170,140,110,.3);}
.advk-tool:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(170,140,110,.3);}
.advk-tool:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
.advk-mini{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.15;
  letter-spacing:1px;color:#7a6046;background:#fffaf0cc;border-radius:12px;padding:8px;text-align:center;
  white-space:pre;overflow-x:auto;}
.advk-say{text-align:center;font-size:14px;font-weight:800;color:#7a6046;min-height:20px;line-height:1.5;}
.advk-album{display:flex;flex-direction:column;gap:6px;align-items:stretch;font-size:13px;font-weight:700;
  color:#7a6046;}
.advk-album b{color:#a4632a;}
.advk-album-head{display:flex;gap:8px;justify-content:center;align-items:center;flex-wrap:wrap;}
/* 博物馆展柜:2 列起排,宽屏 4 列;每格展台 + 玻璃反光斜线,未收集是剪影问号 */
.advk-museum{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;width:100%;}
.advk-case{position:relative;overflow:hidden;border-radius:12px;border:1.5px solid rgba(122,82,48,.28);
  background:linear-gradient(180deg,#fffdf6,#f3ead9);padding:10px 8px 8px;text-align:center;}
.advk-case::after{content:"";position:absolute;left:-45%;top:-70%;width:65%;height:240%;
  transform:rotate(24deg);pointer-events:none;
  background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.45),rgba(255,255,255,0));}
.advk-case-item{font-size:24px;line-height:1.2;}
.advk-case-name{font-size:12px;font-weight:800;color:#7a6046;margin-top:2px;min-height:15px;}
.advk-case-stand{margin:6px auto 0;width:62%;height:8px;border-radius:3px 3px 6px 6px;
  background:linear-gradient(180deg,#eddfc6,#c9b394);box-shadow:0 2px 0 rgba(122,82,48,.22);}
.advk-case-lock{background:linear-gradient(180deg,#f2eee5,#e6dfd1);}
.advk-case-lock .advk-case-item{filter:grayscale(1);opacity:.55;}
.advk-case-lock .advk-case-name{color:#a99e8c;}
.advk-mid,.advk-left,.advk-side{display:flex;flex-direction:column;gap:8px;min-width:0;}
@media (min-width:560px){.advk-museum{grid-template-columns:repeat(4,1fr);}}
@media (max-width:400px){.advk-cell{font-size:13px;}.advk-mini{font-size:11px;}}
/* N-30(trio-r7):矮横屏把古堡收成双栏 —— 棋盘在左、说话行/工具钮/方向盘/陈列在右,
   房间格按可视余量钳宽(11×7 房间,高≈宽×7/11),D-pad 与四个工具钮不滚可点 */
@media (max-height:500px){
  .advk-mid{flex-direction:row;align-items:flex-start;justify-content:center;gap:12px;}
  .advk-left{flex:0 1 auto;}
  .advk-side{flex:0 0 auto;display:grid;grid-template-columns:auto minmax(180px,240px);
    column-gap:10px;row-gap:6px;align-items:start;}
  .advk-side .advk-pad2{grid-column:1;grid-row:1/span 3;grid-template-columns:repeat(3,48px);margin-top:0;}
  .advk-side .advk-pad2 button{min-height:44px;}
  .advk-side .advk-say{grid-column:2;grid-row:1;text-align:left;}
  .advk-side .advk-tools{grid-column:2;grid-row:2;justify-content:flex-start;}
  .advk-side .advk-tool{padding:6px 10px;font-size:13px;}
  .advk-side .advk-album{grid-column:2;grid-row:3;}
  .advk-room{max-width:clamp(220px,calc((100dvh - 214px)*11/7),420px);}
}
@media (prefers-reduced-motion:reduce){.advk-pad2 button:active{transform:none;}}
${touchUpliftCss([".ak-open"])}
${bodyFontUpliftCss([".ak-tip"])}
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
  // 键盘段单独一个 span:矮横屏右栏只有 ~200px 宽,长键盘说明会把栏撑到折叠线下,藏掉
  const tipTouch = document.createElement("span");
  tipTouch.textContent = lv.hint;
  const tipKeys = document.createElement("span");
  tipKeys.className = "ak-tip-keys";
  tipKeys.textContent = " 键盘:A D 跑、W 跳、F 回旋镖、G 抓钩(方向键 + L / K 也一样),Esc 暂停。";
  tip.append(tipTouch, tipKeys);
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

  // ---- 纯视觉状态(残影 / 晕圈 / 落地回弹的记账,destroy 时 reset 归零) ----
  const reducedMotion =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fx = new VisualFx();
  let nowMs = 0;
  /** 上一帧每只守卫还活着吗:翻成 false 的那一帧在原地放「晕圈 + 星星」 */
  const enemyWasAlive = run.enemies.map((e) => e.alive);

  const held = { left: false, right: false, up: false, down: false };
  /** 这一帧刚按下的动作键,推进一帧后清空 */
  const pending = { jump: false, hook: false, throw: false };

  function say(text: string): void {
    message = text;
    messageTimer = 1.8;
  }

  // N-16(trio-r7):915×412 一族矮横屏里 430px 画布独吞视口,键排 + 提示行全线下。
  // mount / resize 时量一次 `.game-stage` 可视余量,syncSize 里给 cssH 封顶;
  // scale = cssH / VIEW_H 跟着缩,等于拉远镜头,世界坐标与跑跳判定零触碰。
  let roomCap: number | null = null;

  /** 一个盒子的下沿(测试桩的 rect 可能没有 bottom,用 top+height 兜底) */
  const rectBottom = (r: { top: number; bottom?: number; height: number }): number =>
    Number.isFinite(r.bottom) ? (r.bottom as number) : r.top + r.height;

  /** 往上找平台舞台(.game-stage,定高会裁内容)的下沿;量不到返回 NaN */
  function stageClipBottom(): number {
    let node: HTMLElement | null = wrap.parentElement ?? null;
    for (let i = 0; node && i < 10; i++) {
      if (typeof node.className === "string" && node.className.includes("game-stage")) {
        if (typeof node.getBoundingClientRect !== "function") break;
        const r = node.getBoundingClientRect();
        const inner =
          typeof node.clientHeight === "number" && node.clientHeight > 0
            ? (node.clientTop || 0) + node.clientHeight
            : r.height;
        if (Number.isFinite(r.top) && Number.isFinite(inner) && inner > 0) return r.top + inner;
        break;
      }
      node = node.parentElement ?? null;
    }
    return Number.NaN;
  }

  function measureRoom(): void {
    if (destroyed) return;
    if (typeof canvas.getBoundingClientRect !== "function" || typeof wrap.getBoundingClientRect !== "function")
      return;
    const clip = stageClipBottom();
    if (!Number.isFinite(clip)) return;
    const canvasRect = canvas.getBoundingClientRect();
    if (!Number.isFinite(canvasRect.top)) return;
    // 矮横屏走廊是双栏(grid):键排 + 提示行在画布右边,不占画布下方余量;
    // 竖屏 flex 纵排才把「wrap 下沿 − 画布下沿」记成家当(高度不随画布显示高变,量一次就是稳的)
    const sideBySide =
      typeof getComputedStyle === "function" && getComputedStyle(wrap).display === "grid";
    const below = sideBySide
      ? 0
      : Math.max(0, rectBottom(wrap.getBoundingClientRect()) - rectBottom(canvasRect));
    roomCap = corridorRoomPx(clip, canvasRect.top, below);
  }

  function syncSize(): void {
    // 双栏档画布只占左栏,量画布自己的显示宽,免得逻辑宽 ≠ 显示宽把画面拉扁
    cssW = Math.max(240, Math.round(canvas.clientWidth || host.clientWidth || wrap.clientWidth || 320));
    cssH = clamp(Math.round(cssW * 0.9), 250, 430);
    if (roomCap !== null && roomCap < cssH) cssH = roomCap;
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
          opts.sfx("tap");
          break;
        case "land":
          opts.sfx("tap");
          fx.markLand(nowMs);
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

    // 守卫这一帧被回旋镖敲晕了:在它消失的位置放一圈「晕圈 + 星星绕头」(纯视觉)
    run.enemies.forEach((e, i) => {
      if (enemyWasAlive[i] && !e.alive) fx.spawnStun(e.x, enemyY(e));
      enemyWasAlive[i] = e.alive;
    });
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
    // 最远景:圆头远山,视差最慢,给走廊一层「洞外的山」
    c2d.fillStyle = "rgba(185,175,164,.18)";
    const hillStep = 340;
    const hillStart = Math.floor((camX * 0.18) / hillStep) * hillStep;
    for (let i = -1; i < 6; i++) {
      const wx = hillStart + i * hillStep;
      const sx = (wx - camX * 0.18) * scale;
      const hw = 220 * scale;
      const hh = (110 + (i % 2 === 0 ? 40 : 0)) * scale;
      c2d.beginPath();
      c2d.ellipse(sx + hw / 2, cssH, hw / 2, hh, 0, Math.PI, 0);
      c2d.fill();
    }
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

  /** 中景灌木:比石柱快、比平台慢的一层圆头灌木,位置确定式,不闪不抖 */
  function drawMidBushes(): void {
    const step3 = 170;
    const startX = Math.floor((camX * 0.7) / step3) * step3;
    for (let i = -1; i < 10; i++) {
      const wx = startX + i * step3;
      const sx = (wx - camX * 0.7) * scale;
      if (sx < -60 || sx > cssW + 60) continue;
      const r = (16 + ((i % 3) + 3) * 4) * scale;
      const by = cssH + 4 * scale;
      c2d.fillStyle = "rgba(159,217,139,.32)";
      c2d.beginPath();
      c2d.arc(sx, by, r, Math.PI, 0);
      c2d.arc(sx + r * 0.9, by, r * 0.7, Math.PI, 0);
      c2d.fill();
      c2d.fillStyle = "rgba(120,180,105,.25)";
      c2d.beginPath();
      c2d.arc(sx + r * 0.4, by, r * 0.5, Math.PI, 0);
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
      // 草顶 + 土身 + 石底三段剖面(共享套件),小平台再挂几缕悬根须
      drawTerrainProfile(c2d, x, y, w, h, 10 * scale, {
        grass: AK_PALETTE.akGrass,
        grassDark: shadeHex(AK_PALETTE.akGrass, -0.22),
        soil: AK_PALETTE.akSoil,
        soilLine: shadeHex(AK_PALETTE.akSoil, -0.18),
        stone: AK_PALETTE.akStone,
      }, { scale, strata: 2 });
      if (p.w <= 170) {
        const bands = terrainBands(h);
        drawHangingRoots(
          c2d,
          x + w * 0.08,
          y + bands.grassH + 2 * scale,
          w * 0.84,
          26 * scale,
          shadeHex(AK_PALETTE.akSoil, -0.28),
          scale
        );
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
    // 此刻甩钩能挂上哪个锚点:只读 pickAnchor 做提示,不写任何状态
    const hookable = run.hook
      ? -1
      : pickAnchor(lv.anchors, run.px, run.py - PLAYER_H * 0.6, ROPE_MAX, run.facing);
    lv.anchors.forEach((a, i) => {
      const x = worldX(a.x);
      const y = worldY(a.y);
      if (x < -30 || x > cssW + 30) return;
      drawAnchorSprite(c2d, x, y, scale, i === hookable ? anchorGlow(nowMs, reducedMotion) : null);
    });
  }

  function drawArtifacts(): void {
    for (const art of lv.artifacts) {
      if (run.got.has(art.kind)) continue;
      const bob = reducedMotion ? 0 : Math.sin(doorFlash * 2 + art.kind) * 4;
      const x = worldX(art.x);
      const y = worldY(art.y) + bob;
      if (x < -30 || x > cssW + 30) continue;
      // 光柱落回脚下的台面(找不到台面就不画柱,只画金环)
      const gy = shadowGroundY(lv.platforms, art.x, art.y);
      drawArtifactSprite(
        c2d,
        x,
        y,
        scale,
        art.kind,
        artifactSpinPhase(nowMs, reducedMotion),
        gy === null ? null : worldY(gy)
      );
    }
  }

  function drawEnemies(): void {
    for (const e of run.enemies) {
      if (!e.alive) continue;
      const ey = enemyY(e);
      const x = worldX(e.x);
      const y = worldY(ey);
      if (x < -40 || x > cssW + 40) continue;
      drawEnemySprite(c2d, x, y, scale, e.kind, e.dir, reducedMotion ? 0 : nowMs);
    }
  }

  function drawDoor(): void {
    const x = worldX(lv.door.x);
    const y = worldY(lv.door.y);
    if (x < -80 || x > cssW + 80) return;
    const w = 62 * scale;
    const h = 76 * scale;
    const open = run.got.size >= 3;
    // 石拱门框(比门体大一圈)+ 门槛石,让首领之门更像「遗迹尽头」
    drawRoundRect(x - 6 * scale, y - h - 6 * scale, w + 12 * scale, h + 8 * scale, 16 * scale,
      AK_PALETTE.akStone, shadeHex(AK_PALETTE.akStone, -0.25));
    drawRoundRect(x, y - h, w, h, 14 * scale, open ? "#ffe6a8" : "#9a8a7a", open ? "#e0a83a" : "#6f6357");
    // 左上一道门板高光,和全场光源一致
    c2d.fillStyle = "rgba(255,255,255,.22)";
    c2d.beginPath();
    c2d.roundRect(x + 3 * scale, y - h + 3 * scale, w * 0.32, h - 8 * scale, 8 * scale);
    c2d.fill();
    // 门上的收集清单:三枚迷你纹石(拿到实色、没拿到 25% 透明),不再 emoji 直出
    for (let i = 0; i < 3; i++) {
      c2d.globalAlpha = run.got.has(i) ? 1 : 0.25;
      drawArtifactGem(c2d, x + w / 2, y - h + (16 + i * 22) * scale, 8 * scale, i);
      c2d.globalAlpha = 1;
    }
    if (open) {
      const pulse = reducedMotion ? 0.7 : 0.5 + Math.sin(doorFlash * 5) * 0.4;
      c2d.strokeStyle = `rgba(255,210,90,${pulse.toFixed(3)})`;
      c2d.lineWidth = 4 * scale;
      c2d.strokeRect(x - 3, y - h - 3, w + 6, h + 6);
    }
  }

  function drawPlayer(): void {
    // 无敌不再整帧消失:每一帧都画,交给 invincibleStyle 的半透明 + 白描边呼吸
    const x = worldX(run.px);
    const y = worldY(run.py);
    const r = 17 * scale;
    // ① 落影:留在地面投影点(荡绳飞在空中时影子还贴着下方台面)
    const gy = shadowGroundY(lv.platforms, run.px, run.py);
    if (gy !== null) {
      c2d.fillStyle = AK_PALETTE.akShadow;
      c2d.beginPath();
      c2d.ellipse(worldX(run.px), worldY(gy) + 3 * scale, r * 0.8, r * 0.2, 0, 0, Math.PI * 2);
      c2d.fill();
    }
    // 钩绳:画在主角手位(胸口)起点,棕底 + 1px 亮芯
    if (run.hook) {
      const a = lv.anchors[run.hook.anchor];
      drawRope(c2d, worldX(a.x), worldY(a.y), x, y - PLAYER_H * 0.6 * scale, scale);
    }
    // 姿态:跑 / 跳 / 荡 / 落地四选一;荡绳倾角只读 run.hook.angle 做映射
    const pose = playerPose(
      { onGround: run.onGround, hasHook: !!run.hook, sinceLandMs: fx.sinceLand(nowMs) },
      reducedMotion
    );
    const lean =
      pose === "swing" && run.hook
        ? swingLean(run.hook.angle)
        : pose === "run"
          ? runLean(run.vx, run.facing)
          : 0;
    drawPlayerSprite(c2d, {
      x,
      y,
      scale,
      facing: run.facing,
      pose,
      lean,
      scarf: scarfAngle(pose, run.vx, run.hook ? run.hook.angle : 0, reducedMotion),
      squash: landSquash(fx.sinceLand(nowMs), reducedMotion),
      inv: invincibleStyle(run.invincible, reducedMotion),
      flutterMs: reducedMotion ? 0 : nowMs,
      hatBlock: hatDegraded(27 * scale),
      playerH: PLAYER_H,
    });
  }

  function drawBoomerang(): void {
    const boom = run.boom;
    if (!boom) {
      fx.clearTrail();
      return;
    }
    const off = boomerangOffset(boom.t, boom.dir);
    const wx = boom.ox + off.x;
    const wy = boom.oy + off.y;
    fx.pushTrail(wx, wy);
    // 弧线残影:常态 3 段渐隐,reduced 1 段
    drawTrail(
      c2d,
      fx.trail.map((p) => ({ x: worldX(p.x), y: worldY(p.y) })),
      boomTrailSegments(reducedMotion),
      scale
    );
    drawBoomerangSprite(c2d, worldX(wx), worldY(wy), scale, boom.t * 18, !reducedMotion);
  }

  /** 粒子层:守卫被敲晕的「晕圈 + 星星绕头」 */
  function drawParticles(): void {
    for (const s of fx.stuns) {
      const x = worldX(s.x);
      if (x < -50 || x > cssW + 50) continue;
      drawStunFx(c2d, x, worldY(s.y), scale, s.ageMs / AK_TIMING.stunFadeMs, reducedMotion);
    }
  }

  function drawHud(): void {
    // 顶栏与 renderHud(古堡 DOM)同一套卡片规格:圆角 12、白 72% 底、1.5px 描边
    c2d.textAlign = "left";
    c2d.textBaseline = "middle";
    c2d.font = `bold ${Math.max(AK_CARD.fontMin, Math.round(15 * scale))}px sans-serif`;
    drawHudCard(c2d, 6, 6, cssW - 12, 40);
    c2d.fillStyle = "#7a5230";
    c2d.fillText(opts.banner, 14, 20);
    c2d.textAlign = "right";
    const artText = [0, 1, 2].map((k) => (run.got.has(k) ? ARTIFACT_EMOJI[k] : "▫")).join("");
    const heartText = "💗".repeat(Math.max(0, run.hearts));
    const timeText = opts.showTimer ? ` ⏱ ${run.elapsed.toFixed(1)}s` : "";
    c2d.fillText(`${artText} ${heartText}${timeText}`, cssW - 14, 20);
    // 关卡进度小旗路径:走到首领之门算 100%,只读 run.px
    drawFlagProgress(c2d, 16, 37, cssW - 44, run.px / Math.max(1, lv.door.x));
    if (messageTimer > 0 && message) {
      c2d.textAlign = "center";
      c2d.fillStyle = "rgba(60,40,80,.8)";
      c2d.beginPath();
      c2d.roundRect(cssW * 0.08, cssH - 46, cssW * 0.84, 30, AK_CARD.radius);
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
    // 图层序(visual.ts 的 AK_LAYER_ORDER,从底到顶):
    // 背景渐变 + 远山 → 中景灌木 → 平台剖面 → 锚点 / 门 / 文物 →
    // 敌人 → 回旋镖 + 残影 → 主角 + 钩绳 → 粒子 → HUD
    drawBackground();
    drawMidBushes();
    drawPlatforms();
    drawAnchors();
    drawDoor();
    drawArtifacts();
    drawEnemies();
    drawBoomerang();
    drawPlayer();
    drawParticles();
    drawHud();
  }

  function frame(now: number): void {
    if (destroyed) return;
    const dt = Math.min(0.033, Math.max(0, (now - last) / 1000));
    last = now;
    nowMs = now;
    syncSize();
    step(dt);
    fx.step(dt * 1000);
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

  // 走廊这条路原来是手写三行 remove,和探索层的 Disposer 各走各的;
  // 现在两条路都从同一个口袋出,少一个「新加了监听忘了摘」的口子。
  const bag = new Disposer();
  window.addEventListener("keydown", onKeyDown);
  bag.add(() => window.removeEventListener("keydown", onKeyDown));
  window.addEventListener("keyup", onKeyUp);
  bag.add(() => window.removeEventListener("keyup", onKeyUp));
  bag.add(() => cancelAnimationFrame(raf));
  bag.add(() => wrap.remove());

  measureRoom();
  syncSize();
  // 挂载那一刻可能还没排好版;抽空补量一次(不用 rAF,免得测试桩的帧队列被挤)
  const fitTimer = setTimeout(measureRoom, 0);
  bag.add(() => clearTimeout(fitTimer));
  window.addEventListener("resize", measureRoom);
  bag.add(() => window.removeEventListener("resize", measureRoom));
  last = performance.now();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      destroyed = true;
      finished = true;
      fx.reset();
      bag.dispose();
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
    onFail: () => ctx.lose("这条走廊先撤一步～下一趟贴着墙走、先清掉挡路的那只,💗 就省下来了!"),
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
  return `这次下到第 ${floor} 层,最深纪录是第 ${best} 层。💗 剩一半就先绕开怪、找补给,再来一趟就能刷新它!`;
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
// 无尽古堡:俯视房间探索(1.2 新增)
// ---------------------------------------------------------------------------

function loadAlbum(): string[] {
  try {
    return parseAlbum(localStorage.getItem(ALBUM_KEY));
  } catch {
    return [];
  }
}

function saveAlbum(album: readonly string[]): void {
  try {
    localStorage.setItem(ALBUM_KEY, serializeAlbum(album));
  } catch {
    // 存不进去也不影响这一局
  }
}

/**
 * 一格该画成什么样(纯展示,规则都在 explore.ts)。
 * W6R1-01 修复:主角与箱子换参数化 SVG(castleHeroSvg / castleBoxSvg);
 * 第 2 轮 C 档清偿:机关小图标(门/钥匙/锁/压板/链闸/开关/彩门/跷跷板/
 * 传送/贴纸)全部换同族参数化 SVG(castleGlyphSvg),emoji 退场。
 */
function cellGlyph(state: RoomState, x: number, y: number): { html: string; cls: string } {
  const c = cellAt(state, x, y);
  if (state.player.x === x && state.player.y === y) return { html: castleHeroSvg(), cls: "advk-me" };
  if (state.boxes.some((b) => b.x === x && b.y === y)) return { html: castleBoxSvg(), cls: "advk-hot" };
  switch (c) {
    case C_WALL:
    case C_HIDDEN:
      return { html: "", cls: "advk-wall" };
    case C_EXIT:
      return { html: castleGlyphSvg("exit"), cls: "advk-hot" };
    case C_KEY:
      return { html: castleGlyphSvg("key"), cls: "advk-hot" };
    case C_DOOR:
      return { html: castleGlyphSvg("lock"), cls: "advk-hot" };
    case C_PLATE:
      return { html: castleGlyphSvg("plate"), cls: "advk-seen" };
    case C_PGATE:
      return isPlateDown(state) ? { html: "", cls: "advk-seen" } : { html: castleGlyphSvg("pgate"), cls: "advk-hot" };
    case C_SWITCH:
      return { html: castleGlyphSvg(state.switchOn ? "lamp-on" : "lamp-off"), cls: "advk-hot" };
    case C_CGATE:
      return colorGateOpen(state.switchOn)
        ? { html: "", cls: "advk-seen" }
        : { html: castleGlyphSvg("cgate"), cls: "advk-hot" };
    case C_SEESAW_L:
      return { html: castleGlyphSvg(seesawWalkable("left", seesawOf(state)) ? "plank" : "wedge"), cls: "advk-seen" };
    case C_SEESAW_R:
      return { html: castleGlyphSvg(seesawWalkable("right", seesawOf(state)) ? "plank" : "wedge"), cls: "advk-seen" };
    case C_PORTAL:
      return { html: castleGlyphSvg("portal"), cls: "advk-hot" };
    case C_STICKER:
      return { html: castleGlyphSvg("sticker"), cls: "advk-hot" };
    default:
      return { html: "", cls: state.explored[y * state.w + x] ? "advk-seen" : "advk-dim" };
  }
}

function mountCastle(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const bag = new Disposer();
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

  const hud = document.createElement("div");
  hud.className = "advk-hud";
  const board = document.createElement("div");
  board.className = "advk-room";
  board.setAttribute("role", "img");
  const say = document.createElement("div");
  say.className = "advk-say";
  const tools = document.createElement("div");
  tools.className = "advk-tools";
  const mini = document.createElement("div");
  mini.className = "advk-mini";
  mini.hidden = true;
  const album = document.createElement("div");
  album.className = "advk-album";
  const pad = document.createElement("div");
  pad.className = "advk-pad2";
  // N-30:竖屏仍是 board→mini→say→tools→pad→album 的原顺序;
  // 矮横屏由 .advk-mid 切成「左棋盘 / 右控件」双栏(见 CSS 的 max-height:500px 档)
  const mid = document.createElement("div");
  mid.className = "advk-mid";
  const left = document.createElement("div");
  left.className = "advk-left";
  const side = document.createElement("div");
  side.className = "advk-side";
  left.append(board, mini);
  side.append(say, tools, pad, album);
  mid.append(left, side);
  wrap.append(head, hud, mid);
  host.appendChild(wrap);

  let rooms = 0;
  let secrets = 0;
  let best = save.getGameProgress(meta.id).endlessBest;
  let stickers = loadAlbum();
  // 一趟古堡认一个种子:房间是顺着这个种子一间间挑下来的,
  // 挑的时候会避开上一间,所以整趟不会出现「下一间还是刚才那间」。
  const runSeed = Math.floor(Math.random() * 100000) + 1;
  let current: CastleRoom = buildCastleRoom(runSeed, 1);
  let state: RoomState = current.state;
  let over = false;
  let miniOpen = false;
  let albumOpen = false;

  function speakLine(text: string): void {
    say.textContent = text;
  }

  /** 贴纸图鉴 → 博物馆展柜:汇总行 + 展开按钮 + 展柜网格(2 列起排,宽屏 4 列) */
  function renderAlbum(): void {
    const done = albumBonusStars(stickers);
    const total = STICKER_SETS.reduce((n, s) => n + s.items.length, 0);
    album.innerHTML = "";
    const head = document.createElement("div");
    head.className = "advk-album-head";
    const sum = document.createElement("span");
    sum.innerHTML = albumSummary(stickers.length, total, done).replace(
      /(\d+\/\d+)|(\d+ 章)/g,
      "<b>$&</b>"
    );
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "advk-tool";
    toggle.textContent = albumOpen ? "🏛️ 收起陈列" : "🏛️ 打开陈列";
    toggle.setAttribute("aria-expanded", albumOpen ? "true" : "false");
    toggle.addEventListener("click", () => {
      api.play("tap");
      albumOpen = !albumOpen;
      renderAlbum();
    });
    head.append(sum, toggle);
    album.appendChild(head);
    if (!albumOpen) return;
    const grid = document.createElement("div");
    grid.className = "advk-museum";
    grid.setAttribute("role", "img");
    grid.setAttribute("aria-label", `贴纸博物馆:已收集 ${stickers.length} 张,共 ${total} 张`);
    for (const cell of albumCells(stickers)) {
      const g = caseGlyph(cell);
      const box = document.createElement("div");
      box.className = `advk-case${g.cls ? ` ${g.cls}` : ""}`;
      box.title = g.aria;
      const item = document.createElement("div");
      item.className = "advk-case-item";
      item.textContent = g.text;
      const name = document.createElement("div");
      name.className = "advk-case-name";
      name.textContent = g.label;
      const stand = document.createElement("div");
      stand.className = "advk-case-stand";
      box.append(item, name, stand);
      grid.appendChild(box);
    }
    album.appendChild(grid);
  }

  function renderHud(): void {
    const focus = PUZZLE_KINDS.find((p) => p.key === current.template.focus);
    chip.textContent = `🏰 ${castleRoomTitle(current.room, current.template)} · 最好纪录 ${best} 间`;
    hud.innerHTML =
      `<span>🔑 钥匙 ${state.keys}</span>` +
      `<span>🕯️ 秘密 ${secrets + state.secrets}</span>` +
      `<span>🗺️ 已探索 ${Math.round(exploredRatio(state) * 100)}%</span>` +
      `<span>${focus ? `${focus.emoji} ${focus.tip}` : "🚪 找到出口就进下一间"}</span>`;
  }

  function renderBoard(): void {
    board.style.gridTemplateColumns = `repeat(${state.w},1fr)`;
    board.setAttribute("aria-label", `${current.template.name}:朵朵在房间里找出口,已探索 ${Math.round(exploredRatio(state) * 100)}%`);
    board.innerHTML = "";
    for (let y = 0; y < state.h; y++) {
      for (let x = 0; x < state.w; x++) {
        const g = cellGlyph(state, x, y);
        const cell = document.createElement("div");
        cell.className = `advk-cell ${g.cls}`;
        cell.innerHTML = g.html;
        board.appendChild(cell);
      }
    }
    if (miniOpen) mini.textContent = miniMapRows(state).join("\n");
    renderHud();
  }

  function nextRoom(): void {
    rooms++;
    best = save.recordEndlessBest(meta.id, rooms);
    api.addStars(1);
    current = buildCastleRoom(runSeed, rooms + 1);
    state = current.state;
    speakLine(`第 ${rooms} 间走通啦!下一间是${current.template.emoji} ${current.template.name}。`);
    renderBoard();
    renderAlbum();
  }

  function collectSticker(): void {
    const nxt = nextSticker(stickers);
    if (!nxt) return;
    const id = stickerId(nxt.chapter, nxt.item);
    const beforeChapters = albumBonusStars(stickers);
    stickers = [...stickers, id];
    saveAlbum(stickers);
    const set = STICKER_SETS[nxt.chapter];
    speakLine(`收到贴纸「${set.items[nxt.item]}」(${set.emoji} ${set.chapter})!`);
    if (albumBonusStars(stickers) > beforeChapters) {
      api.addStars(1);
      speakLine(`「${set.emoji} ${set.chapter}」一章的贴纸集齐啦,额外送你一颗小星星!`);
    }
    renderAlbum();
  }

  function move(dir: Dir): void {
    if (over || state.cleared) return;
    const res = stepMove(state, dir);
    state = res.state;
    let cleared = false;
    for (const ev of res.events) {
      switch (ev.kind) {
        case "walk":
        case "push":
          break;
        case "bump":
          break;
        case "key":
          api.play("coin");
          speakLine("捡到一把钥匙!");
          break;
        case "unlock":
          api.play("tap");
          speakLine("门开了,进去看看～");
          break;
        case "locked":
          api.play("oops");
          speakLine(ev.text);
          break;
        case "plate":
          api.play("tap");
          speakLine("压板被木箱压住了,石门让开一条路!");
          break;
        case "switch":
          api.play("tap");
          speakLine(ev.on ? "开关亮了,同色的彩门开了!" : "开关灭了,彩门又合上了。");
          break;
        case "secret":
          api.play("meow");
          speakLine("这面墙是假的!里面藏着一间秘密房 +1");
          break;
        case "portal":
          api.play("pop");
          speakLine("咻——被漩涡送到对面啦!");
          break;
        case "sticker":
          api.play("coin");
          collectSticker();
          break;
        case "clear":
          cleared = true;
          break;
      }
    }
    if (cleared) {
      secrets += state.secrets;
      api.play("win");
      nextRoom();
      return;
    }
    renderBoard();
    if (roomStuck(state)) {
      speakLine("这间房好像绕不出去了,按「🔄 复位本间」重新摆一次吧,一颗星都不扣。");
    }
  }

  function doReset(): void {
    api.play("tap");
    secrets += state.secrets;
    state = resetRoom(current.template);
    speakLine("本间已复位,箱子回到原位,分数一点没少。");
    renderBoard();
  }

  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });

  const KEY_DIRS: Record<string, Dir> = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    w: "up",
    s: "down",
    a: "left",
    d: "right",
    W: "up",
    S: "down",
    A: "left",
    D: "right",
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      e.preventDefault();
      onBack();
      return;
    }
    const dir = KEY_DIRS[e.key];
    if (!dir) return;
    e.preventDefault();
    move(dir);
  };
  window.addEventListener("keydown", onKey);
  bag.add(() => window.removeEventListener("keydown", onKey));

  const padSpec: Array<{ label: string; dir?: Dir }> = [
    { label: "" },
    { label: "⬆️", dir: "up" },
    { label: "" },
    { label: "⬅️", dir: "left" },
    { label: "" },
    { label: "➡️", dir: "right" },
    { label: "" },
    { label: "⬇️", dir: "down" },
    { label: "" },
  ];
  for (const spec of padSpec) {
    const btn = document.createElement("button");
    btn.type = "button";
    if (!spec.dir) {
      btn.className = "advk-slot";
      btn.disabled = true;
      btn.textContent = "·";
    } else {
      btn.textContent = spec.label;
      btn.setAttribute("aria-label", `向${spec.dir === "up" ? "上" : spec.dir === "down" ? "下" : spec.dir === "left" ? "左" : "右"}走一步`);
      btn.addEventListener("click", () => move(spec.dir as Dir));
    }
    pad.appendChild(btn);
  }

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "advk-tool";
  resetBtn.textContent = "🔄 复位本间";
  resetBtn.title = "箱子推死角了就按这里,不扣星";
  resetBtn.addEventListener("click", doReset);
  const miniBtn = document.createElement("button");
  miniBtn.type = "button";
  miniBtn.className = "advk-tool";
  miniBtn.textContent = "🗺️ 小地图";
  miniBtn.setAttribute("aria-expanded", "false");
  miniBtn.addEventListener("click", () => {
    api.play("tap");
    miniOpen = !miniOpen;
    mini.hidden = !miniOpen;
    miniBtn.setAttribute("aria-expanded", miniOpen ? "true" : "false");
    renderBoard();
  });
  const quitBtn = document.createElement("button");
  quitBtn.type = "button";
  quitBtn.className = "advk-tool";
  quitBtn.textContent = "🏁 结束这趟";
  quitBtn.addEventListener("click", () => {
    api.play("tap");
    over = true;
    best = save.recordEndlessBest(meta.id, rooms);
    speakLine(castleLine(rooms, best));
  });
  tools.append(resetBtn, miniBtn, quitBtn);

  speakLine("方向键 / WASD 走一步,手机点下面的方向盘。找到 🚪 就进下一间。");
  renderBoard();
  renderAlbum();

  return {
    destroy() {
      bag.dispose();
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
  const castleBtn = document.createElement("button");
  castleBtn.type = "button";
  castleBtn.className = "ak-open";
  castleBtn.textContent = "🏰 无尽古堡 · 推箱找钥匙";
  bar.append(endlessBtn, castleBtn, timeBtn);

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
  castleBtn.addEventListener("click", () => openMode(mountCastle));
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
