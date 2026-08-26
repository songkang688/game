/**
 * 1.1 第 4 步 B 的手动冒烟替身:用真浏览器(375×667 竖屏)把
 * 海底大胃王 / 水果切切乐 的第 100、145、188 关一路玩到真实胜负。
 *
 * 覆盖验收清单里的四条:
 *   1. 每款实玩第 100 / 145 / 188 关到真实胜负(存档里真的多了星星才算赢);
 *   2. Boss / 果王关必须能打赢也能打输,两种结局各验一次;
 *   3. 375×667 窄屏 HUD 不溢出(按真实字体量出来的宽度和左右安全线比);
 *   4. destroy 无泄漏:进游戏 → 玩一关 → 退出 → 再进,
 *      rAF / setInterval / 事件监听全部清干净。
 *
 * 跑法(playwright 是临时工具,没有进 package.json):
 *   npm i -D playwright --no-save && npx playwright install chromium --with-deps
 *   npx vite --port 5173
 *   node scripts/smoke188-b.mjs            # 也可以 SMOKE_ONLY=fruit-slice 只跑一款
 *
 * 它连着 dev server 跑:直接 import 游戏模块的 mount(),自己造一个
 * GameAPI 桩,这样 onWin / onLose / addStars 都能被记下来,
 * 判定胜负不靠猜画面,靠存档和回调。
 */
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:5173";
const ONLY = process.env.SMOKE_ONLY ?? "";
const VIEWPORT = { width: 375, height: 667 };

const results = [];
function log(ok, what, extra = "") {
  results.push({ ok, what });
  console.log(`${ok ? "  ok  " : " FAIL "} ${what}${extra ? ` — ${extra}` : ""}`);
}

const GAMES = {
  "ocean-munch": {
    title: "海底大胃王",
    progressKey: "yiduo-yixing.ocean-munch.campaign.v2",
    extraKeys: ["yiduo-yixing.ocean-munch.dex.v1"],
    levels: [99, 144, 187],
    bossLevel: 187,
  },
  "fruit-slice": {
    title: "水果切切乐",
    progressKey: "yiduo-yixing.fruit-slice.campaign.v2",
    extraKeys: [],
    levels: [99, 144, 187],
    bossLevel: 187,
  },
};

/* ------------------------------------------------------------------ *
 * 页面内的通用驾驶台:挂载游戏 + 按坐标点过菜单 + 记录回调
 * ------------------------------------------------------------------ */

const HARNESS = `
window.__smoke = (() => {
  const state = { api: null, handle: null, calls: [], rafBefore: 0, listeners: [] };

  // 数一数没被清掉的 rAF / setInterval / 事件监听
  const realRaf = window.requestAnimationFrame;
  const realCancel = window.cancelAnimationFrame;
  const realSetInterval = window.setInterval;
  const realClearInterval = window.clearInterval;
  const liveRaf = new Set();
  const liveInterval = new Set();
  window.requestAnimationFrame = (cb) => {
    const id = realRaf((t) => { liveRaf.delete(id); cb(t); });
    liveRaf.add(id);
    return id;
  };
  window.cancelAnimationFrame = (id) => { liveRaf.delete(id); return realCancel(id); };
  window.setInterval = (...a) => { const id = realSetInterval(...a); liveInterval.add(id); return id; };
  window.clearInterval = (id) => { liveInterval.delete(id); return realClearInterval(id); };

  // 记事件监听的挂/摘,退出后不该有残留
  const targets = new Map();
  const wrap = (proto, label) => {
    const add = proto.addEventListener;
    const rm = proto.removeEventListener;
    proto.addEventListener = function (type, fn, opts) {
      const key = label + ':' + type;
      targets.set(key, (targets.get(key) ?? 0) + 1);
      return add.call(this, type, fn, opts);
    };
    proto.removeEventListener = function (type, fn, opts) {
      const key = label + ':' + type;
      targets.set(key, (targets.get(key) ?? 0) - 1);
      return rm.call(this, type, fn, opts);
    };
  };
  wrap(HTMLCanvasElement.prototype, 'canvas');
  wrap(Window.prototype, 'window');

  // ---- 画面识别:把每次 fill()/stroke() 的世界包围盒记下来 ----
  // 海底大胃王里每种生物的颜色是写死的,认色就能认出种类,
  // 自动玩家于是能像人一样"看着屏幕"挑小鱼吃、绕开大鱼。
  const P = CanvasRenderingContext2D.prototype;
  const raw = {
    beginPath: P.beginPath, fill: P.fill, stroke: P.stroke, fillRect: P.fillRect,
    moveTo: P.moveTo, lineTo: P.lineTo, arc: P.arc, ellipse: P.ellipse,
    quadraticCurveTo: P.quadraticCurveTo, bezierCurveTo: P.bezierCurveTo, rect: P.rect,
  };
  let box = null;
  let scale = 1;
  let cur = [];
  let frames = [];
  let texts = [];
  function ext(m, x, y) {
    const px = m.a * x + m.c * y + m.e;
    const py = m.b * x + m.d * y + m.f;
    if (box === null) box = [px, py, px, py];
    else {
      if (px < box[0]) box[0] = px;
      if (py < box[1]) box[1] = py;
      if (px > box[2]) box[2] = px;
      if (py > box[3]) box[3] = py;
    }
    scale = Math.hypot(m.a, m.b) || 1;
  }
  function commit(color) {
    if (box === null) return;
    const s = scale;
    const rx = (box[2] - box[0]) / 2 / s;
    const ry = (box[3] - box[1]) / 2 / s;
    if (rx < 1 || rx > 400) return;
    cur.push({ x: (box[0] + box[2]) / 2 / s, y: (box[1] + box[3]) / 2 / s, rx, ry, c: color });
  }
  P.beginPath = function () { box = null; return raw.beginPath.call(this); };
  P.moveTo = function (x, y) { ext(this.getTransform(), x, y); return raw.moveTo.call(this, x, y); };
  P.lineTo = function (x, y) { ext(this.getTransform(), x, y); return raw.lineTo.call(this, x, y); };
  P.quadraticCurveTo = function (a, b, x, y) {
    const m = this.getTransform(); ext(m, a, b); ext(m, x, y);
    return raw.quadraticCurveTo.call(this, a, b, x, y);
  };
  P.bezierCurveTo = function (a, b, c, d, x, y) {
    const m = this.getTransform(); ext(m, a, b); ext(m, c, d); ext(m, x, y);
    return raw.bezierCurveTo.call(this, a, b, c, d, x, y);
  };
  P.rect = function (x, y, ww, hh) {
    const m = this.getTransform(); ext(m, x, y); ext(m, x + ww, y + hh);
    return raw.rect.call(this, x, y, ww, hh);
  };
  P.arc = function (x, y, r, ...a) {
    const m = this.getTransform(); ext(m, x - r, y - r); ext(m, x + r, y + r);
    return raw.arc.call(this, x, y, r, ...a);
  };
  P.ellipse = function (x, y, rx, ry, ...a) {
    const m = this.getTransform(); ext(m, x - rx, y - ry); ext(m, x + rx, y + ry);
    return raw.ellipse.call(this, x, y, rx, ry, ...a);
  };
  P.fill = function (...a) { commit(String(this.fillStyle)); return raw.fill.apply(this, a); };
  P.stroke = function (...a) { commit('~' + String(this.strokeStyle)); return raw.stroke.apply(this, a); };
  P.fillRect = function (x, y, ww, hh) {
    // 两款游戏每帧都先铺一层比画布还大的底色,拿它当"新一帧"的分界线
    if (x <= -19 && ww > 300) {
      frames.push({ t: performance.now(), shapes: cur });
      if (frames.length > 12) frames.shift();
      cur = [];
    }
    return raw.fillRect.call(this, x, y, ww, hh);
  };
  const rawFillText = P.fillText;
  P.fillText = function (s, ...a) {
    texts.push(String(s));
    if (texts.length > 160) texts.shift();
    return rawFillText.call(this, s, ...a);
  };

  // 海底大胃王的固定配色表(和 index.ts 里的字面量一一对应)
  const SEA = {
    me: '#ff9eb5',
    buddy: '#7fe0c8',
    food: ['#a8e6c9', '#ffe0a3', '#ffc4d6', '#c4e5ff'],
    big: ['#b8a9f5', '#8fc8e8', '#f5b8c9'],
    bad: ['#ffd6a8', '#c46ae8', '#d8b8f0', '#e5c4f2', '#9a7ab8'],
    haze: '#a05ac9',
    // 顺路能捡的好东西:🐬 招来共生小鱼,🛡 帮你挡一下
    perk: ['rgba(190, 245, 232, 0.55)', 'rgba(190, 225, 255, 0.5)'],
    eelHot: '~#ffe14a',
    eelCold: '~#6aa87a',
  };
  const KNOWN = new Set([SEA.me, SEA.buddy, ...SEA.food, ...SEA.big, ...SEA.bad]);

  /** 同色的碎块(鱼尾、钳子)并进最大的那块,一条鱼只留一个圆 */
  function cluster(list) {
    const out = [];
    for (const s of list.slice().sort((a, b) => b.rx - a.rx)) {
      // 鱼尾巴是和身体同色的另一块,离身体中心约 1.15r,并进来;
      // 阈值再大就会把两条挨着的同色鱼吞成一条,反而看漏危险
      if (out.some((o) => o.c === s.c && Math.hypot(o.x - s.x, o.y - s.y) < o.r * 1.35 + 3)) continue;
      out.push({ x: s.x, y: s.y, r: s.rx, c: s.c });
    }
    return out;
  }

  function findMe(shapes) {
    let me = null;
    for (const s of shapes) {
      // 玩家那条粉鱼:身体椭圆固定是 r × 0.72r,靠长宽比和珊瑚装饰区分开
      if (s.c !== SEA.me || s.ry <= 0 || s.rx / s.ry < 1.2 || s.rx / s.ry > 1.7) continue;
      if (me === null || s.rx > me.r) me = { x: s.x, y: s.y, r: s.rx };
    }
    return me;
  }

  function findBoss(shapes) {
    // 大王没有统一配色,就按"够大 + 不是已知配色 + 不是描边"反着认
    let boss = null;
    for (const s of shapes) {
      if (s.c.charCodeAt(0) === 126 || KNOWN.has(s.c) || s.c.charCodeAt(0) !== 35) continue;
      if (s.rx < 30 || s.rx > 150 || s.ry < 8) continue;
      if (boss === null || s.rx > boss.r) boss = { x: s.x, y: s.y, r: s.rx };
    }
    return boss;
  }

  function movers(shapes) {
    return cluster(
      shapes.filter((s) => SEA.food.includes(s.c) || SEA.big.includes(s.c) || SEA.bad.includes(s.c)),
    );
  }

  /**
   * 给这一帧的每条鱼配上速度:和 ~120ms 前那帧对号入座。同色的鱼可能有好几条,
   * 认错了速度就会指反方向,所以要求"互相都是对方最近的一个"、体型也对得上,
   * 再把明显离谱的速度丢掉——宁可当它不动,也别把它算到反方向去。
   */
  function withSpeed(now, old, dt) {
    for (const n of now) {
      n.vx = 0;
      n.vy = 0;
    }
    if (dt <= 0) return now;
    const fit = (a, b) =>
      a.c === b.c && Math.abs(a.r - b.r) < Math.max(3, a.r * 0.14)
        ? Math.hypot(a.x - b.x, a.y - b.y)
        : Infinity;
    for (const n of now) {
      let hit = null;
      let bestD = 90;
      for (const o of old) {
        const d = fit(n, o);
        if (d < bestD) { bestD = d; hit = o; }
      }
      if (!hit) continue;
      // 反过来再认一次,认不回同一条就当没看清
      let back = null;
      let backD = 90;
      for (const m of now) {
        const d = fit(hit, m);
        if (d < backD) { backD = d; back = m; }
      }
      if (back !== n) continue;
      const vx = (n.x - hit.x) / dt;
      const vy = (n.y - hit.y) / dt;
      if (Math.hypot(vx, vy) > 260) continue;
      n.vx = vx;
      n.vy = vy;
    }
    return now;
  }

  let lastMe = null;
  const eelTrack = [];
  function seaWorld() {
    if (frames.length === 0) return { me: null, fish: [], boss: null, eels: [], haze: [] };
    const curFrame = frames[frames.length - 1];
    // 挑一帧 ~120ms 前的做参照,太近了速度全是抖动
    let ref = frames[0];
    for (const f of frames) if (curFrame.t - f.t >= 110) ref = f;
    const dt = (curFrame.t - ref.t) / 1000;
    const fish = withSpeed(movers(curFrame.shapes), movers(ref.shapes), dt);
    // 掉血后有两秒无敌,这两秒里小鱼会一闪一闪,好些帧根本没画出来
    const me = findMe(curFrame.shapes) ?? (lastMe && curFrame.t - lastMe.t < 700 ? lastMe : null);
    if (me) lastMe = { x: me.x, y: me.y, r: me.r, t: curFrame.t };
    // 电电草是一整条从海底连到海面的竖线,通电时变亮黄。
    // 它按固定节拍亮 1.2 秒、灭 2.2 秒,所以记下它上一次亮起的时刻,
    // 就能推算出接下来哪几拍能安心从旁边过。
    const eels = [];
    for (const s of curFrame.shapes) {
      if (s.c !== SEA.eelHot && s.c !== SEA.eelCold) continue;
      if (s.ry < 100 || s.rx > 40) continue;
      const hot = s.c === SEA.eelHot;
      let seen = eelTrack.find((e) => Math.abs(e.x - s.x) < 22);
      if (!seen) {
        seen = { x: s.x, hot, hotAt: null };
        eelTrack.push(seen);
      }
      // 只认亲眼看见的那次"由灭转亮",半路撞见的一次亮不知道烧到第几秒了
      if (hot && !seen.hot) seen.hotAt = curFrame.t;
      seen.hot = hot;
      seen.x = s.x;
      eels.push({ x: s.x, hot, hotAt: seen.hotAt, now: curFrame.t });
    }
    const haze = curFrame.shapes
      .filter((s) => s.c === SEA.haze && s.rx > 6)
      .map((s) => ({ x: s.x, y: s.y, r: s.rx, vx: 0, vy: 0, c: SEA.haze }));
    const perks = curFrame.shapes
      .filter((s) => SEA.perk.includes(s.c))
      .map((s) => ({ x: s.x, y: s.y, r: s.rx }));
    return { me, fish, boss: findBoss(curFrame.shapes), eels, haze, perks };
  }

  /**
   * 一帧一个落点。挑法和人盯着屏幕玩差不多:先在整块屏幕上找"待着安全"
   * 的位置,再在安全的前提下往吃得下的小鱼那边靠;安全和嘴馋打起来,
   * 永远是安全赢。大王只在体型达标之后才出场,所以看见大王就能贴上去咬。
   */
  function seaAim(w, h) {
    const wd = seaWorld();
    if (!wd.me) return null;
    const me = wd.me;
    const R = me.r;
    // 吃得下:canEat 是 R >= r*1.08,留一点余量免得擦边算成撞车
    const food = wd.fish.filter((f) => f.r > 2 && R >= f.r * 1.12 && !SEA.bad.includes(f.c));
    // 躲得起:isDanger 是 r >= R*1.12,同样留余量;水母海胆刺豚毒藻一律绕。
    // 掉血后那两秒无敌不去占便宜——横冲直撞换来的是无敌一停就再挨一下。
    const peril = wd.fish.filter((f) => f.r >= R * 1.06 || SEA.bad.includes(f.c)).concat(wd.haze);

    /** 电电草 t 秒后亮不亮:亮 1.2 秒灭 2.2 秒,亮之前提早半秒就当它亮了 */
    function eelLive(e, t) {
      if (e.hotAt === null) return true;
      const phase = (((e.now + t * 1000 - e.hotAt) % 3400) + 3400) % 3400;
      return phase < 1500 || phase > 2900;
    }

    /** t 秒之后,站在 (px,py) 离最近的麻烦还剩多少空隙;负数就是要挨撞 */
    function gapAt(px, py, t) {
      let worst = 999;
      for (const d of peril) {
        // 真正撞上是 dist < 0.78×(R+r),这里按 0.86 留一点手抖的余量
        const g = Math.hypot(px - (d.x + d.vx * t), py - (d.y + d.vy * t)) - (d.r + R) * 0.86 - 6;
        if (g < worst) worst = g;
      }
      // 电电草看得比鱼近一点:0.3 秒足够横着挪出它的范围,
      // 要求整秒都不通电就等于把整片海都划成禁区了(深关能有五棵)
      for (const e of wd.eels) {
        if (!eelLive(e, Math.min(t, 0.3))) continue;
        const g = Math.abs(px - e.x) - (R + 16);
        if (g < worst) worst = g;
      }
      return worst;
    }
    /** 在这儿站一会儿安不安全(小鱼到了落点是会停下来等的) */
    function stayRoom(px, py) {
      let worst = 999;
      for (const t of [0, 0.22, 0.48, 0.75]) {
        const g = gapAt(px, py, t);
        if (g < worst) worst = g;
      }
      return worst;
    }
    /**
     * 游过去这一路安不安全。小鱼跟指针是指数逼近(每帧追上 11.7% 的差距),
     * 所以前半程走得飞快;取样太稀会从两条鱼中间"跳"过去看不见,这里按
     * 路程长短加密到最多十几个点。
     */
    function tripRoom(px, py) {
      const span = Math.hypot(px - me.x, py - me.y);
      const steps = Math.max(4, Math.min(14, Math.round(span / 22)));
      let worst = 999;
      for (let s = 1; s <= steps; s++) {
        const k = s / steps;
        const t = k * 0.34;
        const f = 1 - Math.pow(0.883, k * 20);
        const g = gapAt(me.x + (px - me.x) * f, me.y + (py - me.y) * f, t);
        if (g < worst) worst = g;
      }
      return worst;
    }

    // 先挑出"敢去吃"的那几口:小鱼自己周围也得是干净的。
    // 长大是 r += max(1, 吃掉的半径×0.16) —— 挑贴着上限那条吃,一口顶
    // 小鱼三四口,而横穿一次屏幕才 0.3 秒,所以宁可跑远也要挑大的。
    const bait = [];
    for (const f of food) {
      const fx = f.x + f.vx * 0.28;
      const fy = f.y + f.vy * 0.28;
      if (fx < -20 || fx > w + 20 || fy < -20 || fy > h + 20) continue;
      if (gapAt(fx, fy, 0.28) < -16) continue;
      bait.push({ x: fx, y: fy, r: f.r, gain: Math.max(1, f.r * 0.16) });
    }
    // 🐬 和 🛡 顺路一定要捡:一个多个帮手,一个白挡一下
    for (const p of wd.perks) {
      if (gapAt(p.x, p.y, 0.2) < -16) continue;
      bait.push({ x: p.x, y: p.y, r: p.r, gain: 3.5 });
    }
    // 一次只盯一个目标,按"每秒能长多少"挑:近的小鱼和远的大鱼谁划算就吃谁
    let target = null;
    let bestRate = 0;
    for (const b of bait) {
      const rate = b.gain / (Math.hypot(b.x - me.x, b.y - me.y) / 500 + 0.25);
      if (rate > bestRate) { bestRate = rate; target = b; }
    }

    const pad = R + 6;
    const spots = [];
    // 整屏网格:困住的时候要能看见远处的活路。鱼越长越大,能站的空当越小,
    // 网格太稀就会从缝旁边漏过去,所以宁可多撒一些点。
    for (let gx = 0; gx < 17; gx++) {
      for (let gy = 0; gy < 29; gy++) {
        spots.push([pad + ((w - pad * 2) * gx) / 16, pad + ((h - pad * 2) * gy) / 28]);
      }
    }
    // 身边再撒几圈细的:小步微调比大步横跳稳
    for (let a = 0; a < 24; a++) {
      const ang = (Math.PI * 2 * a) / 24;
      for (const dist of [20, 40, 66, 96]) {
        spots.push([
          Math.max(pad, Math.min(w - pad, me.x + Math.cos(ang) * dist)),
          Math.max(pad, Math.min(h - pad, me.y + Math.sin(ang) * dist)),
        ]);
      }
    }

    /** 站在这儿离"想去的地方"还差多少 */
    function wantCost(px, py) {
      if (wd.boss) return Math.hypot(px - wd.boss.x, py - wd.boss.y);
      if (!target) {
        // 没得吃就回画面中段候着,小鱼都是横着穿过来的
        return Math.abs(py - h * 0.5) * 0.5 + Math.abs(px - w * 0.5) * 0.25;
      }
      return Math.max(0, Math.hypot(px - target.x, py - target.y) - target.r - R * 0.6);
    }

    // 安全和嘴馋不放在一个秤上称:先划出"待着不会挨打"的地方,
    // 只在这些地方里比谁离饭近。实在无处可去了才挑一个最不糟的方向逃。
    let best = null;
    let escape = null;
    let safeCount = 0;
    for (const [px, py] of spots) {
      const room = Math.min(stayRoom(px, py), tripRoom(px, py));
      // 一条活路都找不到的时候(海里挤成一团),安全压倒一切,
      // 但还是让饭香在同样安全的几个方向之间做个决断
      if (escape === null || room * 45 - wantCost(px, py) * 0.25 > escape.rank) {
        escape = { x: px, y: py, room, cost: 0, rank: room * 45 - wantCost(px, py) * 0.25 };
      }
      if (room < 6) continue;
      safeCount++;
      const cost = wantCost(px, py) - Math.min(room, 45) * 1.6;
      if (best === null || cost < best.cost) best = { cost, x: px, y: py, room };
    }
    best = best ?? escape;
    if (best) best.safeCount = safeCount;
    // 顺手报一下"此刻站的地方"离最近的麻烦还有多远,方便排查挨打的原因
    if (best) {
      best.now = gapAt(me.x, me.y, 0);
      let near = '';
      let nd = 1e9;
      for (const d of peril) {
        const g = Math.hypot(me.x - d.x, me.y - d.y) - (d.r + R) * 0.86 - 6;
        if (g < nd) { nd = g; near = d.c + ':' + Math.round(d.r); }
      }
      for (const e of wd.eels) {
        const g = Math.abs(me.x - e.x) - (R + 16);
        if (eelLive(e, 0) && g < nd) { nd = g; near = 'eel'; }
      }
      best.near = near;
    }
    return best;
  }

  return {
    seaWorld,
    seaAim,
    /** 画面上出没出现过某句话(用来认结算面板 / 失败面板) */
    saw(needle) { return texts.some((t) => t.includes(needle)); },
    forget() { texts = []; },
    /** 最近一次画出来的爱心行,数一数还剩几条命 */
    hud() { return texts.filter((t) => t.includes('💗') || t.includes('🤍')).slice(-1)[0] ?? ''; },
    async mount(gameId, w, h) {
      const host = document.createElement('div');
      host.id = 'smoke-host';
      host.style.cssText = 'position:fixed;left:0;top:0;width:' + w + 'px;height:' + h + 'px;overflow:hidden;';
      document.body.style.margin = '0';
      document.body.appendChild(host);
      const mod = await import('/src/games/' + gameId + '/index.ts');
      state.calls = [];
      state.api = {
        root: host,
        play: (n) => state.calls.push(['play', n]),
        addStars: (n) => { state.calls.push(['addStars', n]); return n; },
        getStars: () => 0,
        onWin: (s, m) => state.calls.push(['onWin', s, m]),
        onLose: (m) => state.calls.push(['onLose', m]),
      };
      state.handle = mod.mount(state.api);
      return true;
    },
    destroy() {
      state.handle?.destroy();
      state.handle = null;
      document.getElementById('smoke-host')?.remove();
    },
    leaks() {
      const leftovers = [...targets.entries()].filter(([, n]) => n !== 0);
      return { raf: liveRaf.size, interval: liveInterval.size, listeners: leftovers };
    },
    calls() { return state.calls.slice(); },
    canvasRect() {
      const cv = document.querySelector('#smoke-host canvas');
      const r = cv.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    },
    /** 画布上有没有画到边界外(逐帧比不了,退而求其次:量文字宽度) */
    measure(font, text) {
      const c = document.createElement('canvas').getContext('2d');
      c.font = font;
      return c.measureText(text).width;
    },
  };
})();
`;

/**
 * 冒烟用的空白页:只有 <body>,好让 mount() 出来的画布独占屏幕。
 * /src/** 的模块请求照样打到 dev server,拿到的是真实源码。
 */
const BLANK = `${BASE}/__smoke_blank`;
async function routeBlank(page) {
  await page.route(BLANK + "*", (route) =>
    route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: "<!doctype html><html><head><meta charset='utf-8'></head><body style='margin:0'></body></html>",
    }),
  );
}

async function openBlank(page) {
  await page.goto(`${BLANK}?t=${Date.now()}`, { waitUntil: "load" });
  await page.evaluate(HARNESS);
}

/** 在画布上点一下(真事件,走 pointerdown/up) */
async function tap(page, x, y) {
  const r = await page.evaluate(() => window.__smoke.canvasRect());
  await page.mouse.move(r.left + x, r.top + y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(90);
}

/** 从 (x1,y1) 划到 (x2,y2),中间分 steps 步,模拟一刀 */
async function swipe(page, x1, y1, x2, y2, steps = 10) {
  const r = await page.evaluate(() => window.__smoke.canvasRect());
  await page.mouse.move(r.left + x1, r.top + y1);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(r.left + x1 + ((x2 - x1) * i) / steps, r.top + y1 + ((y2 - y1) * i) / steps);
  }
  await page.mouse.up();
}

/* ------------------------------------------------------------------ *
 * 菜单坐标:和 index.ts 里的排版算式一一对应
 * ------------------------------------------------------------------ */

/** 章节卡片中心(两栏布局,和 drawThemes 一致) */
function themeCardCenter(chapterIdx, chapterCount, w, h) {
  const cols = w > h * 1.15 ? 3 : 2;
  const rows = Math.ceil(chapterCount / cols);
  const pad = 10;
  const x0 = Math.max(10, w * 0.06);
  const y0 = 70;
  const cw = (w - x0 * 2 - pad * (cols - 1)) / cols;
  const ch = Math.min(96, (h - y0 - 16 - pad * (rows - 1)) / rows);
  const col = chapterIdx % cols;
  const row = Math.floor(chapterIdx / cols);
  return { x: x0 + col * (cw + pad) + cw / 2, y: y0 + row * (ch + pad) + ch / 2 };
}

/** 关卡节点中心(蛇形排布,和 drawMap 一致) */
function mapNodeCenter(i, count, cols, w, h) {
  const rows = Math.ceil(count / cols);
  const mx0 = w * 0.12;
  const mx1 = w * 0.88;
  const my0 = 96;
  const my1 = h - 62;
  const row = Math.floor(i / cols);
  const colRaw = i % cols;
  const col = row % 2 === 0 ? colRaw : cols - 1 - colRaw;
  return {
    x: mx0 + ((mx1 - mx0) * col) / (cols - 1),
    y: my0 + (rows === 1 ? 0 : ((my1 - my0) * row) / (rows - 1)),
  };
}

/* ------------------------------------------------------------------ *
 * 两款游戏各自的自动玩家
 * ------------------------------------------------------------------ */

/**
 * 水果切切乐:每隔一会儿横着划一刀。刀路故意画在屏幕中段
 * (水果抛物线顶点附近),既能连刀,也不至于老去蹭底下的炸弹。
 */
async function playFruitSlice(page, { sloppy }) {
  const rows = sloppy ? [0.82, 0.9] : [0.42, 0.5, 0.36, 0.46];
  for (let k = 0; k < (sloppy ? 40 : 150); k++) {
    const y = VIEWPORT.height * rows[k % rows.length];
    const leftToRight = k % 2 === 0;
    await swipe(
      page,
      leftToRight ? 16 : VIEWPORT.width - 16,
      y - 26,
      leftToRight ? VIEWPORT.width - 16 : 16,
      y + 26,
      sloppy ? 5 : 12,
    );
    const done = await page.evaluate(() =>
      window.__smoke.calls().some((c) => c[0] === "addStars" || c[0] === "onWin" || c[0] === "onLose"),
    );
    if (done) return;
  }
}

/**
 * 海底大胃王:指针就是小鱼的目标点。自动玩家每帧从画面里认出
 * 自己、能吃的鱼、吃不动的鱼和大王,再挑一个落点指过去 —— 和人
 * 盯着屏幕玩是同一套判断,只是反应慢一点。
 */
async function playOceanMunch(page, { sloppy }) {
  const r = await page.evaluate(() => window.__smoke.canvasRect());
  const steps = sloppy ? 70 : 1400;
  for (let k = 0; k < steps; k++) {
    if (sloppy) {
      // 手生的玩法:缩在左上角不动,专等大鱼和障碍自己撞上来
      await page.mouse.move(r.left + 24, r.top + 24);
      await page.waitForTimeout(120);
    } else {
      const aim = await page.evaluate(
        ([w, h]) => window.__smoke.seaAim(w, h),
        [VIEWPORT.width, VIEWPORT.height],
      );
      if (aim) await page.mouse.move(r.left + aim.x, r.top + aim.y);
      await page.waitForTimeout(24);
    }
    if (k % 8 === 0) {
      const done = await page.evaluate(() =>
        window.__smoke.calls().some((c) => c[0] === "addStars" || c[0] === "onWin" || c[0] === "onLose"),
      );
      if (done) return;
    }
  }
}

/* ------------------------------------------------------------------ *
 * 单关流程
 * ------------------------------------------------------------------ */

async function seed(page, cfg, level) {
  await page.evaluate(
    ([key, extra, n]) => {
      localStorage.clear();
      const stars = Array.from({ length: 188 }, (_, i) => (i < n ? 3 : 0));
      localStorage.setItem(key, JSON.stringify(stars));
      for (const k of extra) localStorage.removeItem(k);
    },
    [cfg.progressKey, cfg.extraKeys, level],
  );
}

/** 菜单 → 章节 → 关卡 → intro → play */
async function enterLevel(page, gameId, level, layout) {
  const { w, h } = VIEWPORT.width && { w: VIEWPORT.width, h: VIEWPORT.height };
  if (gameId === "fruit-slice") {
    // 主菜单第一张卡就是经典战役
    const cardH = Math.min(88, (h * 0.66) / 3 - 12);
    await tap(page, w / 2, h * 0.26 + cardH / 2);
  }
  const chapter = layout.chapterOf(level);
  const c = themeCardCenter(chapter, layout.chapterCount, w, h);
  await tap(page, c.x, c.y);
  const size = layout.sizeOf(chapter);
  const n = mapNodeCenter(level - layout.startOf(chapter), size, layout.cols(size), w, h);
  await tap(page, n.x, n.y);
  // intro 面板点一下开始
  await tap(page, w / 2, h / 2);
  await page.waitForTimeout(200);
}

async function runLevel(page, gameId, cfg, level, { sloppy = false } = {}, layout) {
  await openBlank(page);
  await seed(page, cfg, level);
  await page.evaluate(
    ([id, w, h]) => window.__smoke.mount(id, w, h),
    [gameId, VIEWPORT.width, VIEWPORT.height],
  );
  await page.waitForTimeout(300);
  await enterLevel(page, gameId, level, layout);

  if (gameId === "fruit-slice") await playFruitSlice(page, { sloppy });
  else await playOceanMunch(page, { sloppy });

  const out = await page.evaluate(
    ([key, lv]) => {
      const stars = JSON.parse(localStorage.getItem(key) ?? "[]");
      return { stars: stars[lv] ?? 0, calls: window.__smoke.calls() };
    },
    [cfg.progressKey, level],
  );
  return out;
}

/* ------------------------------------------------------------------ *
 * HUD 溢出检查:按真实字体量宽度
 * ------------------------------------------------------------------ */

async function checkHud(page, gameId, cfg) {
  const bad = await page.evaluate(
    async ([id, w]) => {
      const logic = await import("/src/games/" + id + "/logic.ts");
      const m = document.createElement("canvas").getContext("2d");
      const over = [];
      const heartsW = (() => {
        m.font = "16px sans-serif";
        return m.measureText("💗💗💗").width;
      })();
      const count = id === "fruit-slice" ? logic.ROUNDS.length : logic.LEVELS.length;
      for (let i = 0; i < count; i++) {
        const ci = logic.themeIndexOf(i);
        const rel = i - logic.themeStart(ci) + 1;
        const size = logic.themeSize(ci);
        m.font = "bold 16px sans-serif";
        let text;
        if (id === "fruit-slice") {
          const r = logic.ROUNDS[i];
          text = `第${ci + 1}章 ${rel}/${size} · 🍑 0/${r.target} · ⏱${r.time}s`;
        } else {
          const l = logic.LEVELS[i];
          text = `第${ci + 1}章 ${rel}/${size} · 🐟 14/${l.targetR}`;
        }
        const pillW = Math.min(w - 90, m.measureText(text).width + 28);
        // 左侧药丸从 x=10 起,右侧爱心右缘留 12px
        if (10 + pillW > w - 12 - heartsW) {
          over.push(`第 ${i + 1} 关 药丸 ${Math.round(pillW)} + 爱心 ${Math.round(heartsW)}`);
        }
      }
      return over;
    },
    [gameId, VIEWPORT.width],
  );
  log(bad.length === 0, `${cfg.title} 375×667 HUD 药丸与爱心不打架`, bad.slice(0, 3).join(" | "));
}

/** 地图页 30 关一章的最后一行不会被切到屏幕外 */
async function checkMapFits(page, gameId, cfg) {
  const bad = await page.evaluate(
    async ([id, w, h]) => {
      const logic = await import("/src/games/" + id + "/logic.ts");
      const sizes = logic.THEME_SIZES;
      const out = [];
      for (let ci = 0; ci < sizes.length; ci++) {
        const count = sizes[ci];
        const cols = id === "fruit-slice" ? (count > 16 ? 5 : 4) : 4;
        const rows = Math.ceil(count / cols);
        const mx0 = w * 0.12;
        const mx1 = w * 0.88;
        const my0 = 96;
        const my1 = h - 62;
        const nr = Math.max(
          id === "fruit-slice" ? 13 : 16,
          Math.min(28, (mx1 - mx0) / cols / 2.4, (my1 - my0) / rows / 2.6),
        );
        const lastY = my0 + (rows === 1 ? 0 : my1 - my0);
        // 压轴关的圈会放大 1.22~1.25 倍,星星画在 y + r*1.45
        const bottom = lastY + nr * 1.25 * 1.45 + 6;
        if (bottom > h) out.push(`第 ${ci + 1} 章 底部 ${Math.round(bottom)} > ${h}`);
        if (mx0 - nr < 0 || mx1 + nr > w) out.push(`第 ${ci + 1} 章 左右溢出`);
      }
      return out;
    },
    [gameId, VIEWPORT.width, VIEWPORT.height],
  );
  log(bad.length === 0, `${cfg.title} 375×667 关卡地图不出血`, bad.slice(0, 3).join(" | "));
}

/* ------------------------------------------------------------------ *
 * destroy 泄漏检查
 * ------------------------------------------------------------------ */

async function checkDestroy(page, gameId, cfg, layout) {
  await openBlank(page);
  await seed(page, cfg, 99);
  // 进游戏 → 玩一小会儿 → 退出 → 再进 → 再退
  for (let round = 0; round < 2; round++) {
    await page.evaluate(
      ([id, w, h]) => window.__smoke.mount(id, w, h),
      [gameId, VIEWPORT.width, VIEWPORT.height],
    );
    await page.waitForTimeout(250);
    await enterLevel(page, gameId, 99, layout);
    if (gameId === "fruit-slice") {
      for (let i = 0; i < 6; i++) await swipe(page, 20, 300, 355, 340, 8);
    } else {
      const r = await page.evaluate(() => window.__smoke.canvasRect());
      for (let i = 0; i < 20; i++) {
        await page.mouse.move(r.left + 60 + i * 12, r.top + 200 + (i % 5) * 40);
      }
    }
    await page.evaluate(() => window.__smoke.destroy());
    await page.waitForTimeout(400);
  }
  const leaks = await page.evaluate(() => window.__smoke.leaks());
  log(
    leaks.raf === 0 && leaks.interval === 0 && leaks.listeners.length === 0,
    `${cfg.title} destroy 无泄漏(rAF/setInterval/监听全清)`,
    `rAF ${leaks.raf} · interval ${leaks.interval} · 监听 ${JSON.stringify(leaks.listeners)}`,
  );
  const gone = await page.evaluate(() => !document.querySelector("#smoke-host canvas"));
  log(gone, `${cfg.title} destroy 之后画布已摘除`);
}

/* ------------------------------------------------------------------ *
 * 主流程
 * ------------------------------------------------------------------ */

async function layoutFor(page, gameId) {
  const info = await page.evaluate(async (id) => {
    const logic = await import("/src/games/" + id + "/logic.ts");
    return { sizes: logic.THEME_SIZES, total: id === "fruit-slice" ? logic.ROUNDS.length : logic.LEVELS.length };
  }, gameId);
  const starts = [];
  let s = 0;
  for (const n of info.sizes) {
    starts.push(s);
    s += n;
  }
  return {
    chapterCount: info.sizes.length,
    total: info.total,
    sizeOf: (ci) => info.sizes[ci],
    startOf: (ci) => starts[ci],
    chapterOf: (idx) => info.sizes.findIndex((_, ci) => idx < starts[ci] + info.sizes[ci]),
    cols: (size) => (gameId === "fruit-slice" ? (size > 16 ? 5 : 4) : 4),
  };
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => log(false, `页面报错:${e.message}`));
  await routeBlank(page);

  for (const [gameId, cfg] of Object.entries(GAMES)) {
    if (ONLY && ONLY !== gameId) continue;
    console.log(`\n=== ${cfg.title} (${gameId}) ===`);

    // 先把布局算式对齐
    await openBlank(page);
    const layout = await layoutFor(page, gameId);
    log(layout.total === 188, `${cfg.title} 战役总数 188`, String(layout.total));

    await checkHud(page, gameId, cfg);
    await checkMapFits(page, gameId, cfg);

    // 实玩第 100 / 145 / 188 关
    for (const level of cfg.levels) {
      const out = await runLevel(page, gameId, cfg, level, {}, layout);
      const won = out.stars > 0;
      log(won, `${cfg.title} 第 ${level + 1} 关实玩通关`, `星级 ${out.stars}`);
      if (level === cfg.bossLevel) {
        const finale = out.calls.find((c) => c[0] === "onWin");
        log(!!finale, `${cfg.title} 第 188 关触发全通关庆祝`, finale ? String(finale[2]).slice(0, 40) : "");
      }
      if (won) {
        await page.screenshot({ path: `/tmp/smoke-${gameId}-${level + 1}.png` });
      }
    }

    // Boss 关也要能打输
    const lost = await runLevel(page, gameId, cfg, cfg.bossLevel, { sloppy: true }, layout);
    log(lost.stars === 0, `${cfg.title} 第 ${cfg.bossLevel + 1} 关(Boss)手生时会真的失败`, `星级 ${lost.stars}`);

    await checkDestroy(page, gameId, cfg, layout);
  }

  await browser.close();
  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} 项通过`);
  if (bad.length > 0) {
    for (const b of bad) console.log(` FAIL ${b.what}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
