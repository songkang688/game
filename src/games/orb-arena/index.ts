import { meta } from "./meta";
export { meta };

// 圆圆大作战:俯视竞技场。188 关战役 + 本地混战 + 缩圈无尽 + 同屏双人。
// 所有「其他玩家」都是本机 AI,全程离线,不开任何网络连接。
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { save } from "../../engine/save";
import { prefersReducedMotion } from "../../engine/view25d";
import { aiSteer, AI_TIER_LABELS, type AiTier } from "./ai";
import { CHAPTERS, endlessConfig, goalLine, levelConfig, starsFor, type OrbLevel } from "./levels";
import {
  EAT_RATIO,
  MAX_CELLS,
  MIN_MASS,
  PELLET_MASS,
  VIRUS_MASS,
  canEat,
  canMerge,
  clampToMap,
  decayMass,
  dist,
  eatVirus,
  ejectSpore,
  feedVirus,
  isSpent,
  leaderboard,
  massToRadius,
  massToSpeed,
  mergeCells,
  rankOf,
  runLine,
  shrinkZone,
  splitCell,
  totalMass,
  zoneDrain,
  type Cell,
  type Pellet,
  type Spore,
  type Vec,
  type Virus,
  type Zone
} from "./logic";

/** 本作原创的圆圆名字,只用自家角色和拟声词 */
const BOT_NAMES = ["糯糯", "云云", "墩墩", "闪闪", "绿绿豆", "啾啾", "团团", "圆圆 3 号", "圆圆 7 号", "泡泡", "咕咕"];
const BOT_COLORS = ["#F6B8D0", "#B8D8F6", "#CDEFC0", "#F8DFA8", "#D9C6F5", "#A9E5DE", "#F5C2A8", "#C9D6F7", "#EEC9E8", "#BFE7B0", "#F2D6B8"];

const CSS = `
.oa-wrap{font-family:"PingFang SC","Microsoft YaHei",sans-serif;background:linear-gradient(180deg,#F3EEFF,#FBF6FF);
  border-radius:16px;padding:10px;user-select:none;position:relative;}
.oa-top{display:flex;gap:6px;flex-wrap:wrap;justify-content:space-between;margin-bottom:6px;}
.oa-badge{background:#fff;border-radius:14px;padding:5px 10px;font-weight:800;font-size:14px;color:#6b53a8;
  box-shadow:0 2px 6px rgba(150,130,200,.25);}
.oa-canvas{width:100%;border-radius:14px;display:block;background:#F7F3FF;touch-action:none;}
.oa-panes{display:flex;flex-direction:column;gap:6px;}
.oa-pad{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:8px;}
.oa-btn{min-width:88px;min-height:46px;border:none;border-radius:14px;font-family:inherit;font-size:15px;
  font-weight:900;cursor:pointer;background:#DCCEF7;color:#4b3a75;box-shadow:0 3px 0 #B9A5E3;padding:0 14px;}
.oa-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #B9A5E3;}
.oa-btn.oa-star{background:#CFE3FA;color:#2f4a75;box-shadow:0 3px 0 #A6C4E8;}
.oa-btn:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
.oa-board{position:absolute;top:44px;right:14px;background:#ffffffdb;border-radius:12px;padding:6px 9px;
  font-size:13px;font-weight:800;color:#5b4a86;line-height:1.5;max-width:44%;}
.oa-board summary{cursor:pointer;font-size:13px;}
.oa-me{color:#a8347a;}
.oa-msg{text-align:center;min-height:20px;color:#6b53a8;font-weight:800;margin-top:6px;font-size:14px;
  overflow-wrap:anywhere;}
.oa-modebar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 10px;}
.oa-open{border:none;border-radius:999px;padding:9px 18px;font-size:15px;font-weight:900;color:#fff;cursor:pointer;
  font-family:inherit;background:linear-gradient(180deg,#9b7ede,#7b5cc4);box-shadow:0 4px 0 #62479f;}
.oa-open:active{transform:translateY(2px);box-shadow:0 2px 0 #62479f;}
.oa-mode{max-width:720px;margin:0 auto;font-family:"PingFang SC","Microsoft YaHei",sans-serif;}
.oa-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:10px;}
.oa-back{border:none;border-radius:999px;padding:7px 13px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffd9;color:#7b5cc4;box-shadow:0 3px 0 rgba(120,90,180,.3);}
.oa-over{text-align:center;padding:24px 16px;background:#fff;border-radius:18px;box-shadow:0 4px 14px rgba(150,130,200,.25);}
.oa-over-t{font-size:21px;font-weight:900;color:#6b53a8;margin-bottom:8px;}
.oa-over-s{font-size:15px;font-weight:700;color:#7a67ab;line-height:1.6;margin-bottom:14px;overflow-wrap:anywhere;}
@media (max-width:360px){
  .oa-badge{font-size:13px;padding:4px 8px;}
  .oa-board{font-size:12px;max-width:52%;}
  .oa-btn{min-width:72px;font-size:14px;}
}
`;

interface Owner {
  id: string;
  name: string;
  color: string;
  /** 人类玩家:朵朵用 WASD+F/G,星星用方向键 +L/K */
  human?: "duo" | "star";
  tier?: AiTier;
  /** 队友(第 8 章):不能吃掉他最后一颗圆 */
  ally?: boolean;
}

export interface RunResult {
  won: boolean;
  mass: number;
  rank: number;
  usedSec: number;
  reason: "target" | "time" | "spent" | "ally";
}

interface RunOpts {
  cfg: OrbLevel;
  owners: Owner[];
  banner?: string;
  sfx: (n: "tap" | "win" | "oops" | "coin" | "pop") => void;
  onDone: (r: RunResult) => void;
  /** 双人同屏时给两块画面 */
  split?: boolean;
}

function createRun(stage: HTMLElement, opts: RunOpts): { destroy: () => void } {
  const cfg = opts.cfg;
  const owners = opts.owners;
  const humans = owners.filter((o) => o.human);
  const names: Record<string, string> = {};
  for (const o of owners) names[o.id] = o.name;
  const soft = prefersReducedMotion();

  let destroyed = false;
  let ended = false;
  let raf = 0;
  let last = 0;
  let elapsed = 0;
  let seq = 0;
  let paused = false;

  const cells: Cell[] = [];
  const pellets: Pellet[] = [];
  const viruses: Virus[] = [];
  const spores: Spore[] = [];
  let zone: Zone | null =
    cfg.shrink > 0
      ? { cx: cfg.mapW / 2, cy: cfg.mapH / 2, radius: Math.min(cfg.mapW, cfg.mapH) * 0.52 }
      : null;

  const rand = (): number => Math.random();
  const nextId = (p: string): string => `${p}${++seq}`;

  owners.forEach((o, i) => {
    const ang = (Math.PI * 2 * i) / owners.length;
    cells.push({
      id: nextId("c"),
      owner: o.id,
      mass: 30,
      x: cfg.mapW / 2 + Math.cos(ang) * cfg.mapW * 0.3,
      y: cfg.mapH / 2 + Math.sin(ang) * cfg.mapH * 0.3,
      vx: 0,
      vy: 0,
      bornAt: 0
    });
  });
  for (let i = 0; i < cfg.pellets; i++) {
    pellets.push({ id: nextId("p"), x: rand() * cfg.mapW, y: rand() * cfg.mapH });
  }
  for (let i = 0; i < cfg.viruses; i++) {
    viruses.push({ id: nextId("v"), x: rand() * cfg.mapW, y: rand() * cfg.mapH, mass: VIRUS_MASS, fed: 0 });
  }

  // ---- DOM ----
  const wrap = document.createElement("div");
  wrap.className = "oa-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="oa-top">
      <span class="oa-badge oa-mass">⚪ 质量 30</span>
      <span class="oa-badge oa-goal">${goalLine(cfg)}</span>
      ${cfg.timeSec > 0 ? `<span class="oa-badge oa-time">⏱️ ${cfg.timeSec}</span>` : ""}
      ${opts.banner ? `<span class="oa-badge">${opts.banner}</span>` : ""}
    </div>
    <div class="oa-panes"></div>
    <details class="oa-board" open><summary>🏅 排行榜</summary><div class="oa-board-rows"></div></details>
    <div class="oa-pad"></div>
    <div class="oa-msg"></div>
  `;
  stage.appendChild(wrap);

  const panes = wrap.querySelector(".oa-panes") as HTMLElement;
  const massEl = wrap.querySelector(".oa-mass") as HTMLElement;
  const timeEl = wrap.querySelector(".oa-time") as HTMLElement | null;
  const boardEl = wrap.querySelector(".oa-board-rows") as HTMLElement;
  const padEl = wrap.querySelector(".oa-pad") as HTMLElement;
  const msgEl = wrap.querySelector(".oa-msg") as HTMLElement;
  msgEl.textContent = "吃彩豆长大,别贴着比你大的圆圆走。";

  const canvases: HTMLCanvasElement[] = [];
  const paneW = 640;
  const paneH = humans.length > 1 ? 200 : 360;
  for (let i = 0; i < Math.max(1, humans.length); i++) {
    const c = document.createElement("canvas");
    c.className = "oa-canvas";
    c.width = paneW;
    c.height = paneH;
    c.setAttribute("aria-label", `${humans[i]?.name ?? "圆圆"} 的竞技场画面`);
    panes.appendChild(c);
    canvases.push(c);
  }

  /** 每个人类玩家的准星(世界坐标) */
  const aims = new Map<string, Vec>();
  for (const h of humans) aims.set(h.id, { x: cfg.mapW / 2, y: cfg.mapH / 2 });
  /** 键盘方向 */
  const keyDir = new Map<string, Vec>();
  for (const h of humans) keyDir.set(h.id, { x: 0, y: 0 });

  function ownCells(id: string): Cell[] {
    return cells.filter((c) => c.owner === id);
  }

  function doSplit(ownerId: string): void {
    const mine = ownCells(ownerId);
    if (mine.length === 0) return;
    const aim = aims.get(ownerId) ?? { x: cfg.mapW / 2, y: cfg.mapH / 2 };
    const biggest = mine.reduce((a, b) => (a.mass >= b.mass ? a : b));
    const out = splitCell(biggest, aim, mine.length, elapsed, nextId("s"));
    if (out.length < 2) return;
    const idx = cells.indexOf(biggest);
    cells.splice(idx, 1, out[0], out[1]);
    opts.sfx("pop");
  }

  function doSpit(ownerId: string): void {
    const mine = ownCells(ownerId);
    if (mine.length === 0) return;
    const aim = aims.get(ownerId) ?? { x: cfg.mapW / 2, y: cfg.mapH / 2 };
    let any = false;
    for (const c of mine) {
      const out = ejectSpore(c, aim, nextId("sp"));
      if (!out) continue;
      c.mass = out.cell.mass;
      spores.push(out.spore);
      any = true;
    }
    if (any) opts.sfx("tap");
  }

  // ---- 触屏 / 键盘 ----
  canvases.forEach((canvas, i) => {
    const owner = humans[i] ?? humans[0];
    if (!owner) return;
    const onPointer = (e: PointerEvent): void => {
      const rect = canvas.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width;
      const py = ((e.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;
      const cam = cameraFor(owner.id, canvas);
      aims.set(owner.id, { x: cam.x + (px - canvas.width / 2) / cam.zoom, y: cam.y + (py - canvas.height / 2) / cam.zoom });
      keyDir.set(owner.id, { x: 0, y: 0 });
      e.preventDefault();
    };
    canvas.addEventListener("pointerdown", onPointer);
    canvas.addEventListener("pointermove", (e) => {
      if (e.buttons > 0 || e.pointerType === "touch") onPointer(e);
    });
  });

  for (const h of humans) {
    const row = document.createElement("div");
    row.style.display = "contents";
    const sp = document.createElement("button");
    sp.type = "button";
    sp.className = `oa-btn${h.human === "star" ? " oa-star" : ""}`;
    sp.textContent = `${h.name} ✂️ 分身`;
    sp.addEventListener("click", () => doSplit(h.id));
    const ej = document.createElement("button");
    ej.type = "button";
    ej.className = `oa-btn${h.human === "star" ? " oa-star" : ""}`;
    ej.textContent = `${h.name} 💧 吐孢子`;
    ej.addEventListener("click", () => doSpit(h.id));
    padEl.append(row, sp, ej);
  }

  const DUO_KEYS: Record<string, Vec> = { w: { x: 0, y: -1 }, s: { x: 0, y: 1 }, a: { x: -1, y: 0 }, d: { x: 1, y: 0 } };
  const STAR_KEYS: Record<string, Vec> = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 }
  };

  function applyKey(ownerId: string, v: Vec, down: boolean): void {
    const cur = keyDir.get(ownerId) ?? { x: 0, y: 0 };
    const next = down
      ? { x: v.x !== 0 ? v.x : cur.x, y: v.y !== 0 ? v.y : cur.y }
      : { x: v.x !== 0 ? 0 : cur.x, y: v.y !== 0 ? 0 : cur.y };
    keyDir.set(ownerId, next);
  }

  const duo = humans.find((h) => h.human === "duo");
  const star = humans.find((h) => h.human === "star");

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      paused = !paused;
      msgEl.textContent = paused ? "⏸️ 暂停中,再按 Esc 继续。" : "继续!";
      // 这一下归自己了:不拦住,游戏壳还会再弹一次统一暂停面板,
      // 之后的 Esc 只关面板,场上却一直停着
      e.preventDefault();
      return;
    }
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (duo) {
      if (DUO_KEYS[k]) {
        applyKey(duo.id, DUO_KEYS[k], true);
        e.preventDefault();
      }
      if (k === "f") doSplit(duo.id);
      if (k === "g") doSpit(duo.id);
    }
    const target = star ?? duo;
    if (target && STAR_KEYS[e.key]) {
      applyKey(target.id, STAR_KEYS[e.key], true);
      e.preventDefault();
    }
    if (star) {
      if (k === "l") doSplit(star.id);
      if (k === "k") doSpit(star.id);
    }
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (duo && DUO_KEYS[k]) applyKey(duo.id, DUO_KEYS[k], false);
    const target = star ?? duo;
    if (target && STAR_KEYS[e.key]) applyKey(target.id, STAR_KEYS[e.key], false);
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  interface Camera {
    x: number;
    y: number;
    zoom: number;
  }

  function cameraFor(ownerId: string, canvas: HTMLCanvasElement): Camera {
    const mine = ownCells(ownerId);
    if (mine.length === 0) return { x: cfg.mapW / 2, y: cfg.mapH / 2, zoom: canvas.width / cfg.mapW };
    const big = mine.reduce((a, b) => (a.mass >= b.mass ? a : b));
    const span = Math.max(360, massToRadius(totalMass(cells, ownerId)) * (cfg.fog ? 9 : 14));
    return { x: big.x, y: big.y, zoom: Math.min(1.6, canvas.width / span) };
  }

  function update(dt: number): void {
    elapsed += dt;

    // 人类:键盘方向优先,没按键就朝准星走
    for (const h of humans) {
      const dir = keyDir.get(h.id) ?? { x: 0, y: 0 };
      const mine = ownCells(h.id);
      if (mine.length === 0) continue;
      if (dir.x !== 0 || dir.y !== 0) {
        const big = mine.reduce((a, b) => (a.mass >= b.mass ? a : b));
        aims.set(h.id, { x: big.x + dir.x * 300, y: big.y + dir.y * 300 });
      }
    }

    // AI:每个 owner 用最大的那颗做决策
    for (const o of owners) {
      if (o.human) continue;
      const mine = ownCells(o.id);
      if (mine.length === 0) continue;
      const big = mine.reduce((a, b) => (a.mass >= b.mass ? a : b));
      const move = aiSteer(
        { self: big, pellets, others: cells.filter((c) => c.owner !== o.id), viruses, mapW: cfg.mapW, mapH: cfg.mapH },
        o.tier ?? "normal",
        rand
      );
      aims.set(o.id, move.aim);
      if (move.split) {
        const out = splitCell(big, move.aim, mine.length, elapsed, nextId("s"));
        if (out.length === 2) cells.splice(cells.indexOf(big), 1, out[0], out[1]);
      }
      if (move.spit) {
        const out = ejectSpore(big, move.aim, nextId("sp"));
        if (out) {
          big.mass = out.cell.mass;
          spores.push(out.spore);
        }
      }
    }

    // 移动
    for (const c of cells) {
      const aim = aims.get(c.owner) ?? { x: c.x, y: c.y };
      const dx = aim.x - c.x;
      const dy = aim.y - c.y;
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        const sp = massToSpeed(c.mass);
        c.x += (dx / len) * sp * dt;
        c.y += (dy / len) * sp * dt;
      }
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vx *= Math.max(0, 1 - 4 * dt);
      c.vy *= Math.max(0, 1 - 4 * dt);
      c.mass = decayMass(c.mass, dt);
      if (zone) c.mass = zoneDrain(c, zone, dt);
      const clamped = clampToMap(c, cfg.mapW, cfg.mapH);
      c.x = clamped.x;
      c.y = clamped.y;
    }
    if (zone) zone = shrinkZone(zone, dt, cfg.shrink);

    // 吃彩豆
    for (const c of cells) {
      const r = massToRadius(c.mass);
      for (let i = 0; i < pellets.length; i++) {
        if (dist(c, pellets[i]) < r + 4) {
          c.mass += PELLET_MASS;
          pellets[i] = { id: nextId("p"), x: rand() * cfg.mapW, y: rand() * cfg.mapH };
          if (humans.some((h) => h.id === c.owner)) opts.sfx("coin");
        }
      }
    }

    // 孢子
    for (let i = spores.length - 1; i >= 0; i--) {
      const s = spores[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= Math.max(0, 1 - 3.4 * dt);
      s.vy *= Math.max(0, 1 - 3.4 * dt);
      let gone = false;
      for (const v of viruses) {
        if (dist(s, v) < massToRadius(v.mass)) {
          const fed = feedVirus(v, s, nextId("v"));
          v.x = fed.virus.x;
          v.y = fed.virus.y;
          v.mass = fed.virus.mass;
          v.fed = fed.virus.fed;
          if (fed.spawned) viruses.push(fed.spawned);
          gone = true;
          break;
        }
      }
      if (!gone) {
        for (const c of cells) {
          if (dist(s, c) < massToRadius(c.mass) && c.owner !== s.owner) {
            c.mass += s.mass;
            gone = true;
            break;
          }
        }
      }
      if (gone) spores.splice(i, 1);
    }

    // 刺球
    for (const c of [...cells]) {
      for (let i = viruses.length - 1; i >= 0; i--) {
        const v = viruses[i];
        if (dist(c, v) > massToRadius(c.mass)) continue;
        const res = eatVirus(c, v, ownCells(c.owner).length, elapsed);
        if (res.popped || res.cells[0].mass !== c.mass) {
          viruses.splice(i, 1);
          cells.splice(cells.indexOf(c), 1, ...res.cells);
          if (res.popped) opts.sfx("pop");
          viruses.push({ id: nextId("v"), x: rand() * cfg.mapW, y: rand() * cfg.mapH, mass: VIRUS_MASS, fed: 0 });
        }
        break;
      }
    }

    // 合并与吞噬
    for (let i = cells.length - 1; i >= 0; i--) {
      for (let j = cells.length - 1; j >= 0; j--) {
        if (i === j || i >= cells.length || j >= cells.length) continue;
        const a = cells[i];
        const b = cells[j];
        if (!a || !b) continue;
        if (a.owner === b.owner) {
          if (canMerge(a, elapsed) && canMerge(b, elapsed) && dist(a, b) < massToRadius(a.mass)) {
            cells.splice(i, 1, mergeCells(a, b));
            cells.splice(j, 1);
          }
          continue;
        }
        if (canEat(a, b, elapsed)) {
          const victim = owners.find((o) => o.id === b.owner);
          const eater = owners.find((o) => o.id === a.owner);
          if (victim?.ally && eater?.human && ownCells(b.owner).length <= 1) {
            finish(false, "ally");
            return;
          }
          a.mass += b.mass;
          cells.splice(j, 1);
          if (humans.some((h) => h.id === a.owner)) opts.sfx("pop");
        }
      }
    }

    // 掉到下限就先去休息
    for (let i = cells.length - 1; i >= 0; i--) {
      if (isSpent(cells[i].mass)) cells.splice(i, 1);
    }

    for (const h of humans) {
      if (ownCells(h.id).length === 0) {
        finish(false, "spent");
        return;
      }
      if (totalMass(cells, h.id) >= cfg.targetMass) {
        finish(true, "target");
        return;
      }
    }
    if (cfg.timeSec > 0 && elapsed >= cfg.timeSec) {
      const me = humans[0];
      const mass = me ? totalMass(cells, me.id) : 0;
      finish(mass >= cfg.targetMass, "time");
    }
  }

  function drawPane(canvas: HTMLCanvasElement, ownerId: string): void {
    const g = canvas.getContext("2d");
    if (!g) return;
    const cam = cameraFor(ownerId, canvas);
    const w = canvas.width;
    const h = canvas.height;
    g.clearRect(0, 0, w, h);
    g.fillStyle = "#F7F3FF";
    g.fillRect(0, 0, w, h);

    const toX = (x: number): number => w / 2 + (x - cam.x) * cam.zoom;
    const toY = (y: number): number => h / 2 + (y - cam.y) * cam.zoom;

    // 网格
    g.strokeStyle = "#E7DEFA";
    g.lineWidth = 1;
    const step = 100 * cam.zoom;
    if (step > 6) {
      for (let x = ((-cam.x * cam.zoom + w / 2) % step + step) % step; x < w; x += step) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, h);
        g.stroke();
      }
      for (let y = ((-cam.y * cam.zoom + h / 2) % step + step) % step; y < h; y += step) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
      }
    }

    // 安全区
    if (zone) {
      g.strokeStyle = "#9BD5DE";
      g.lineWidth = 3;
      g.beginPath();
      g.arc(toX(zone.cx), toY(zone.cy), zone.radius * cam.zoom, 0, Math.PI * 2);
      g.stroke();
    }

    // 彩豆
    for (const p of pellets) {
      const x = toX(p.x);
      const y = toY(p.y);
      if (x < -8 || y < -8 || x > w + 8 || y > h + 8) continue;
      g.fillStyle = "#F7C6DE";
      g.beginPath();
      g.arc(x, y, Math.max(2, 4 * cam.zoom), 0, Math.PI * 2);
      g.fill();
    }

    // 孢子
    g.fillStyle = "#CDEFC0";
    for (const s of spores) {
      g.beginPath();
      g.arc(toX(s.x), toY(s.y), Math.max(2, massToRadius(s.mass) * cam.zoom), 0, Math.PI * 2);
      g.fill();
    }

    // 刺球
    for (const v of viruses) {
      const x = toX(v.x);
      const y = toY(v.y);
      const r = massToRadius(v.mass) * cam.zoom;
      g.fillStyle = "#BFE3B4";
      g.beginPath();
      for (let i = 0; i < 18; i++) {
        const ang = (Math.PI * 2 * i) / 18;
        const rr = i % 2 === 0 ? r : r * (soft ? 0.82 : 0.76);
        const px = x + Math.cos(ang) * rr;
        const py = y + Math.sin(ang) * rr;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.fill();
    }

    // 圆圆
    const sorted = [...cells].sort((a, b) => a.mass - b.mass);
    for (const c of sorted) {
      const o = owners.find((ow) => ow.id === c.owner);
      const x = toX(c.x);
      const y = toY(c.y);
      const r = Math.max(3, massToRadius(c.mass) * cam.zoom);
      g.fillStyle = o?.color ?? "#D9C6F5";
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#ffffff88";
      g.beginPath();
      g.arc(x - r * 0.3, y - r * 0.32, r * 0.28, 0, Math.PI * 2);
      g.fill();
      if (r > 14 && o) {
        g.fillStyle = "#4b3a75";
        g.font = "600 12px system-ui, sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(o.name, x, y);
      }
    }
  }

  function renderHud(): void {
    const me = humans[0];
    if (me) {
      massEl.textContent = `⚪ 质量 ${Math.round(totalMass(cells, me.id))} / ${cfg.targetMass}`;
      if (timeEl) timeEl.textContent = `⏱️ ${Math.max(0, Math.ceil(cfg.timeSec - elapsed))}`;
      const rows = leaderboard(cells, names, 10);
      const myRank = rankOf(cells, names, me.id);
      boardEl.innerHTML =
        rows
          .map(
            (r, i) =>
              `<div class="${r.id === me.id ? "oa-me" : ""}">${i + 1}. ${r.name} ${Math.round(r.mass)}</div>`
          )
          .join("") + (myRank > 10 ? `<div class="oa-me">第 ${myRank} 名 · 质量 ${Math.round(totalMass(cells, me.id))}</div>` : "");
    }
  }

  function finish(won: boolean, reason: RunResult["reason"]): void {
    if (ended) return;
    ended = true;
    const me = humans[0];
    const mass = me ? totalMass(cells, me.id) : 0;
    const rank = me ? Math.max(1, rankOf(cells, names, me.id)) : 1;
    opts.sfx(won ? "win" : "oops");
    const result: RunResult = { won, mass, rank, usedSec: elapsed, reason };
    setTimeout(() => {
      if (!destroyed) opts.onDone(result);
    }, 320);
  }

  function frame(ts: number): void {
    if (destroyed) return;
    const dt = last === 0 ? 1 / 60 : Math.min(0.05, (ts - last) / 1000);
    last = ts;
    if (!ended && !paused) update(dt);
    canvases.forEach((c, i) => drawPane(c, humans[i]?.id ?? humans[0]?.id ?? owners[0].id));
    renderHud();
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      destroyed = true;
      ended = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      wrap.remove();
    }
  };
}

function makeBots(n: number, tier: AiTier, ally: boolean): Owner[] {
  const out: Owner[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: `bot${i}`,
      name: BOT_NAMES[i % BOT_NAMES.length],
      color: BOT_COLORS[i % BOT_COLORS.length],
      tier,
      ally: ally && i === 0
    });
  }
  return out;
}

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg = levelConfig(ctx.level);
  const owners: Owner[] = [
    { id: "me", name: "朵朵", color: "#F5A9C8", human: "duo" },
    ...makeBots(cfg.bots, cfg.botTier, cfg.ally)
  ];
  const run = createRun(stage, {
    cfg,
    owners,
    sfx: ctx.sfx,
    onDone: (r) => {
      if (r.won) ctx.win(starsFor(r.mass, cfg.targetMass, r.usedSec, cfg.timeSec), runLine(true, r.rank, r.mass));
      else if (r.reason === "ally") ctx.lose("队友的最后一颗圆要留住呀,下一次绕开它！");
      else ctx.lose(runLine(false, r.rank, r.mass));
    }
  });
  return { destroy: () => run.destroy() };
}

// ---------------------------------------------------------------------------
// 混战 / 无尽 / 双人同屏
// ---------------------------------------------------------------------------

type ExtraMode = "versus" | "endless" | "duo";

const MODE_TITLE: Record<ExtraMode, string> = {
  versus: "🤝 圆圆混战",
  endless: "♾️ 缩圈无尽",
  duo: "👫 双人同屏"
};

function mountExtra(host: HTMLElement, api: GameApi, mode: ExtraMode, onBack: () => void): { destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "oa-mode";
  wrap.innerHTML = `<style>${CSS}</style>`;
  const head = document.createElement("div");
  head.className = "oa-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "oa-back";
  back.textContent = "◀ 回选关";
  const chip = document.createElement("span");
  chip.className = "oa-badge";
  chip.textContent = MODE_TITLE[mode];
  head.append(back, chip);
  const stage = document.createElement("div");
  wrap.append(head, stage);
  host.appendChild(wrap);

  let run: { destroy: () => void } | null = null;
  let wave = 1;
  let total = 0;
  let best = save.getGameProgress(meta.id).endlessBest;

  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });

  function showOver(title: string, sub: string, again: string): void {
    run?.destroy();
    run = null;
    stage.innerHTML = "";
    const box = document.createElement("div");
    box.className = "oa-over";
    box.innerHTML = `<div class="oa-over-t">${title}</div><div class="oa-over-s">${sub}</div>`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "oa-open";
    btn.textContent = again;
    btn.addEventListener("click", () => {
      api.play("tap");
      wave = 1;
      total = 0;
      start();
    });
    box.appendChild(btn);
    stage.appendChild(box);
  }

  function start(): void {
    run?.destroy();
    stage.innerHTML = "";
    if (mode === "endless") {
      const cfg = endlessConfig(wave);
      chip.textContent = `♾️ 第 ${wave} 波 · 累计 ${Math.round(total)} · 最好 ${best}`;
      run = createRun(stage, {
        cfg,
        owners: [{ id: "me", name: "朵朵", color: "#F5A9C8", human: "duo" }, ...makeBots(cfg.bots, cfg.botTier, false)],
        banner: `${AI_TIER_LABELS[cfg.botTier]}对手`,
        sfx: (n) => api.play(n),
        onDone: (r) => {
          total += r.mass;
          best = save.recordEndlessBest(meta.id, Math.round(total));
          if (r.won) {
            api.addStars(1);
            wave++;
            start();
          } else {
            showOver("圆圆先去休息啦", `一共长到 ${Math.round(total)} 质量,最好成绩 ${best}。下一次早点往圈里挪！`, "🔁 再来一局");
          }
        }
      });
      return;
    }
    if (mode === "versus") {
      const cfg = { ...endlessConfig(3), shrink: 0, timeSec: 100, targetMass: 320, mapW: 1800, mapH: 1800 };
      run = createRun(stage, {
        cfg,
        owners: [{ id: "me", name: "朵朵", color: "#F5A9C8", human: "duo" }, ...makeBots(7, "pro", false)],
        banner: "🤝 限时混战",
        sfx: (n) => api.play(n),
        onDone: (r) => {
          if (r.won) api.addStars(2);
          showOver(
            r.won ? "混战赢下来啦！" : "这一局到此为止",
            `${runLine(r.won, r.rank, r.mass)} 用时 ${Math.round(r.usedSec)} 秒。`,
            "🔁 再打一场"
          );
        }
      });
      return;
    }
    const cfg = { ...endlessConfig(2), shrink: 0, timeSec: 90, targetMass: 260, mapW: 1600, mapH: 1600 };
    run = createRun(stage, {
      cfg,
      owners: [
        { id: "me", name: "朵朵", color: "#F5A9C8", human: "duo" },
        { id: "star", name: "星星", color: "#A9C8F5", human: "star" },
        ...makeBots(3, "normal", false)
      ],
      banner: "👫 朵朵 WASD+F/G · 星星 方向键+L/K",
      split: true,
      sfx: (n) => api.play(n),
      onDone: () => {
        showOver("这一局结束啦", "两个人一起玩,谁的圆圆更大都算赢一半。再来一局吧！", "🔁 再来一局");
      }
    });
  }

  start();

  return {
    destroy() {
      run?.destroy();
      run = null;
      wrap.remove();
    }
  };
}

export function mount(api: GameApi): { destroy: () => void } {
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = CSS;
  const bar = document.createElement("div");
  bar.className = "oa-modebar";
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  let mode: { destroy: () => void } | null = null;

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
  }

  (["versus", "endless", "duo"] as ExtraMode[]).forEach((m) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "oa-open";
    btn.textContent = MODE_TITLE[m];
    btn.addEventListener("click", () => {
      if (mode) return;
      api.play("tap");
      levelHost.hidden = true;
      bar.hidden = true;
      modeHost.hidden = false;
      mode = mountExtra(modeHost, api, m, closeMode);
    });
    bar.appendChild(btn);
  });

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: "越大越慢:追不上就先回头把彩豆捡干净。",
      grandMessage: "188 关全部拿下,圆圆杯冠军就是你！",
      guideTitle: "圆圆大作战 · 竞技场笔记"
    }
  );

  return {
    destroy() {
      mode?.destroy();
      mode = null;
      level.destroy();
      root.remove();
    }
  };
}

/** 给测试用:一局能不能算数,靠这几个常量钉住 */
export const ARENA_CONSTS = { MAX_CELLS, MIN_MASS, EAT_RATIO };
