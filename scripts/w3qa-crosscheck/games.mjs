/** 19 款各自的进入方式 / 操作方案 / 输法。 */
import { clickSel, clickText, sleep, tap, drag, holdKey, holdPad, pads, canvasBox, stageBox, settle, hotSpots, blindEnter } from "./lib.mjs";

/** 看图找目标后点上去（瞄准型玩法） */
export function aimPlan({ n = 4, cells = 26, skipBottom = 0.25, gap = 110 } = {}) {
  return async (page, i, box) => {
    const spots = await hotSpots(page, { cells, top: 10, skipBottom });
    if (!spots.length) {
      if (box) await tap(page, box.x + box.w * (0.3 + 0.4 * ((i % 3) / 2)), box.y + box.h * 0.45);
      return;
    }
    for (const s of spots.slice(0, n)) {
      await tap(page, s.x, s.y);
      await sleep(gap);
    }
  };
}

const K_P1 = ["w", "a", "s", "d", "f", "g"];
const K_P2 = ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight", "l", "k"];

/** 键盘 + 触屏方向键 + 画布点击的通用打法 */
export function mixPlan(opts = {}) {
  const keys = opts.keys ?? [...K_P1, ...K_P2];
  const hold = opts.hold ?? 130;
  const usePads = opts.pads !== false;
  const useTap = opts.tap !== false;
  let padList = null;
  return async (page, i, box) => {
    if (keys.length) await holdKey(page, keys[i % keys.length], hold);
    if (usePads) {
      if (i % 10 === 0 || !padList) padList = await pads(page);
      if (padList.length) await holdPad(page, padList[(i * 3) % padList.length], 140);
    }
    if (useTap && box) {
      const gx = box.x + box.w * (0.15 + 0.7 * (((i * 5) % 7) / 6));
      const gy = box.y + box.h * (0.2 + 0.6 * (((i * 3) % 5) / 4));
      await tap(page, gx, gy);
    }
  };
}

/** 只按住射击 / 动作键，配合左右走位（坦克 / 炸弹人这类） */
export function shooterPlan({ fire = "f", move = ["d", "w", "a", "s"], fireMs = 420 } = {}) {
  return async (page, i, box) => {
    await page.keyboard.down(move[i % move.length]).catch(() => {});
    await holdKey(page, fire, fireMs);
    await page.keyboard.up(move[i % move.length]).catch(() => {});
    if (box) await tap(page, box.x + box.w * (0.2 + 0.6 * ((i % 5) / 4)), box.y + box.h * 0.5);
  };
}

/** 画布网格点击（塔防 / 点击类） */
export function gridTapPlan({ cols = 6, rows = 5, extra } = {}) {
  return async (page, i, box) => {
    if (!box) return;
    const c = i % cols;
    const r = Math.floor(i / cols) % rows;
    await tap(page, box.x + (box.w * (c + 0.5)) / cols, box.y + (box.h * (r + 0.5)) / rows);
    if (extra) await extra(page, i, box);
  };
}

/**
 * 塔防：先点塔卡，再往草地格子上点。
 * 卡片在画布左上一排，格子铺在画布中段。
 */
export function towerPlan({ cardY = 0.067, cardX = [0.04, 0.1, 0.16, 0.22], gy0 = 0.30, gy1 = 0.78, cols = 8, rows = 6 } = {}) {
  return async (page, i, box) => {
    if (!box) return;
    const k = i % cardX.length;
    await tap(page, box.x + box.w * cardX[k], box.y + box.h * cardY);
    await sleep(90);
    for (let t = 0; t < 3; t++) {
      const c = (i * 3 + t) % cols;
      const r = Math.floor((i * 3 + t) / cols) % rows;
      await tap(
        page,
        box.x + box.w * (0.04 + 0.92 * ((c + 0.5) / cols)),
        box.y + box.h * (gy0 + (gy1 - gy0) * ((r + 0.5) / rows))
      );
      await sleep(90);
    }
  };
}

/** 划绳 / 切割类：横竖斜各来一刀，再补几下轻点 */
export function slicePlan() {
  return async (page, i, box) => {
    if (!box) return;
    const rows = [0.25, 0.35, 0.45, 0.55, 0.65];
    const y = box.y + box.h * rows[i % rows.length];
    await drag(page, box.x + box.w * 0.05, y, box.x + box.w * 0.95, y + box.h * 0.05, 14, 20);
    await sleep(120);
    await drag(page, box.x + box.w * 0.5, box.y + box.h * 0.15, box.x + box.w * (0.2 + 0.6 * ((i % 3) / 2)), box.y + box.h * 0.8, 14, 20);
    await sleep(120);
    await tap(page, box.x + box.w * (0.3 + 0.4 * ((i % 4) / 3)), box.y + box.h * 0.4);
  };
}

/** 弹弓类：从画布左下往左下方拖，扫角度与力度 */
export function slingPlan({ ax = 0.22, ay = 0.62 } = {}) {
  return async (page, i, box) => {
    if (!box) return;
    const sx = box.x + box.w * ax;
    const sy = box.y + box.h * ay;
    const ang = -0.15 - 0.6 * ((i % 7) / 6);
    const pow = 40 + 34 * ((i % 5) / 4);
    await drag(page, sx, sy, sx - Math.cos(ang) * pow, sy - Math.sin(ang) * pow, 10, 110);
    await sleep(1600);
  };
}

const l99Enter = async (page) =>
  (await clickSel(page, ".l99-continue")) || (await clickSel(page, ".l99-node:not(.l99-node-lock)"));

/** 通用：在 l99 地图上进指定关（0 基 level 必须已解锁） */
export async function l99GotoLevel(page, level) {
  return page.evaluate((lv) => {
    const tabs = [...document.querySelectorAll(".l99-tab")].filter((t) => !t.disabled);
    // 章节页签逐个翻，找到 data 里编号匹配的格子
    const findNode = () =>
      [...document.querySelectorAll(".l99-node")].find(
        (n) => (n.querySelector(".l99-node-num")?.textContent || "").trim() === String(lv + 1)
      );
    let n = findNode();
    if (n && !n.classList.contains("l99-node-lock")) {
      n.click();
      return true;
    }
    for (const t of tabs) {
      t.click();
      n = findNode();
      if (n && !n.classList.contains("l99-node-lock")) {
        n.click();
        return true;
      }
    }
    return false;
  }, level);
}

/** l99 星级存档：解锁到第 n 关 */
export const l99Seed = (id, upto) => ({
  [`yiduo-yixing.l99.${id}`]: JSON.stringify(
    Array.from({ length: 188 }, (_, i) => (i < upto ? 3 : 0))
  )
});

/** 各款自有战役存档：把前 cleared 关标成通关，好让「继续第 N 关」正好落在要验的那一关 */
export function seedFor(id, cleared) {
  const arr = Array.from({ length: 188 }, (_, i) => (i < cleared ? 3 : 0));
  if (id === "sling-birds") {
    const stars = {};
    for (let i = 1; i <= cleared; i++) stars[String(i)] = 3;
    return { "yiduo-yixing.sling-birds.v2": JSON.stringify({ stars, resume: null, chapter: 0 }) };
  }
  if (id === "candy-swing") {
    const v = JSON.stringify({ stars: arr });
    return { "yiduo-yixing.candy-swing.campaign.v2": v, "yiduo.candy-swing.campaign.v2": v };
  }
  if (id === "garden-guard" || id === "sprout-defense") {
    return { [`yiduo-yixing.${id}.campaign.v2`]: JSON.stringify(arr) };
  }
  return l99Seed(id, cleared);
}

export const GAMES = {
  "duo-rush": {
    campaign: false,
    modes: [
      { name: "无尽竞速(人机·新手)", enter: async (p) => { await clickText(p, /无尽竞速/); await clickText(p, /电脑 · 新手/); await clickText(p, /准备好，开跑/); }, plan: mixPlan({ keys: ["d", "w", "f", "a", "g"] }) },
      { name: "双人同屏", enter: async (p) => { await clickText(p, /道具竞速/); await clickText(p, /两个人一起玩/); await clickText(p, /准备好，开跑/); }, plan: mixPlan() },
      { name: "无尽对战", enter: async (p) => { await clickText(p, /无尽对战/); await clickText(p, /电脑 · 新手/); await clickText(p, /准备好，开跑/); }, plan: mixPlan({ keys: ["d", "f", "w"] }) },
      { name: "抢金币赛", enter: async (p) => { await clickText(p, /抢金币赛/); await clickText(p, /电脑 · 新手/); await clickText(p, /准备好，开跑/); }, plan: mixPlan({ keys: ["d", "w", "f"] }) }
    ]
  },
  "duo-arena": {
    campaign: false,
    modes: [
      { name: "单人挑战(菜鸟)", enter: async (p) => { await clickText(p, /单人挑战/); await clickText(p, /菜鸟/); await clickText(p, /开擂/); }, plan: mixPlan() },
      { name: "双人同屏", enter: async (p) => { await clickText(p, /双人同屏/); await clickText(p, /开擂/); }, plan: mixPlan() },
      { name: "无尽守擂", enter: async (p) => { await clickText(p, /无尽守擂/); await clickText(p, /开擂/); }, plan: mixPlan() }
    ]
  },
  "duo-vs-star": {
    campaign: true,
    enterCampaign: async (p) => { await clickText(p, /闯关 188 关/); await sleep(400); await l99Enter(p); },
    plan: mixPlan(),
    modes: [
      { name: "人机混战", enter: async (p) => { await clickText(p, /人机混战/); await sleep(600); await clickText(p, /开(始|打)|出发|确定|开战/); }, plan: mixPlan() },
      { name: "双人对战", enter: async (p) => { await clickText(p, /双人对战/); await sleep(600); await clickText(p, /开(始|打)|出发|确定|开战/); }, plan: mixPlan() },
      { name: "无尽车轮战", enter: async (p) => { await clickText(p, /无尽车轮战/); await sleep(600); await clickText(p, /开(始|打)|出发|确定|开战/); }, plan: mixPlan() },
      { name: "合作特训", enter: async (p) => { await clickText(p, /合作特训/); await sleep(600); await clickText(p, /开(始|打)|出发|确定|开战/); }, plan: mixPlan() }
    ]
  },
  "sling-birds": {
    campaign: true,
    enterCampaign: async (p) => { await clickSel(p, ".slb-tab:not([disabled])", -1); await clickSel(p, ".slb-cell:not(.slb-lock)", -1); },
    plan: slingPlan(),
    modes: [{ name: "无尽打靶塔", enter: async (p) => { await clickSel(p, ".slb-endless"); }, plan: slingPlan() }]
  },
  "candy-swing": {
    campaign: true,
    enterCampaign: async (p) => { await clickSel(p, ".cs-ch:not([disabled])", -1); await clickSel(p, ".cs-lv:not(.locked)", -1); },
    fp: true,
    plan: slicePlan(),
    modes: [{ name: "无尽甜甜塔", enter: async (p) => { await clickText(p, /无尽甜甜塔/); }, plan: slicePlan() }]
  },
  "gold-hook": {
    campaign: true,
    enterCampaign: async (p) => { await clickText(p, /闯关矿洞/); await sleep(500); await l99Enter(p); },
    plan: mixPlan({ keys: [" ", "f"], pads: false }),
    modes: [{ name: "无尽矿井", enter: async (p) => { await clickText(p, /无尽矿井/); }, plan: mixPlan({ keys: [" ", "f"], pads: false }) }]
  },
  "garden-guard": {
    campaign: true,
    canvasMenu: 3,
    fp: true,
    enterCampaign: async (p) => { await canvasEnter(p, 3); },
    plan: towerPlan(),
    modes: [{ name: "无尽 · 守到底", enter: async (p) => { await canvasEnter(p, 1, 1); }, plan: towerPlan() }]
  },
  "sprout-defense": {
    campaign: true,
    canvasMenu: 3,
    fp: true,
    enterCampaign: async (p) => { await canvasEnter(p, 4); },
    plan: towerPlan({ cardY: 0.052, cardX: [0.064, 0.19, 0.31], gy0: 0.2, gy1: 0.55, cols: 8, rows: 4 }),
    modes: [
      {
        name: "无尽保卫",
        enter: async (p) => { await canvasEnter(p, 1, 1); },
        plan: towerPlan({ cardY: 0.052, cardX: [0.064, 0.19, 0.31], gy0: 0.2, gy1: 0.55, cols: 8, rows: 4 })
      }
    ]
  },
  "monster-crisis": {
    campaign: true,
    enterCampaign: l99Enter,
    plan: mixPlan(),
    modes: [
      { name: "无尽守家", enter: async (p) => { await clickText(p, /无尽守家/); }, plan: mixPlan() },
      { name: "双人合作", enter: async (p) => { await clickText(p, /双人合作/); }, plan: mixPlan() },
      { name: "各守一半(对战)", enter: async (p) => { await clickText(p, /各守一半/); }, plan: mixPlan() }
    ]
  },
  "shoot-range": {
    campaign: true,
    enterCampaign: l99Enter,
    plan: aimPlan(),
    modes: [
      { name: "无尽靶场", enter: async (p) => { await clickText(p, /打不完的靶场/); }, plan: aimPlan() },
      { name: "双人比一比", enter: async (p) => { await clickText(p, /双人同屏 · 比一比/); }, plan: mixPlan() },
      { name: "双人一起打", enter: async (p) => { await clickText(p, /双人同屏 · 一起打/); }, plan: mixPlan() }
    ]
  },
  "sky-squad": {
    campaign: true,
    enterCampaign: l99Enter,
    plan: mixPlan(),
    modes: [
      { name: "云海远征(无尽)", enter: async (p) => { await clickText(p, /云海远征/); }, plan: mixPlan() },
      { name: "双人合作", enter: async (p) => { await clickText(p, /双人合作/); }, plan: mixPlan() },
      { name: "双人同屏", enter: async (p) => { await clickText(p, /双人同屏/); }, plan: mixPlan() }
    ]
  },
  "tank-battle": {
    campaign: true,
    enterCampaign: l99Enter,
    plan: shooterPlan(),
    modes: [
      { name: "无尽守老巢", enter: async (p) => { await clickText(p, /无尽守老巢/); }, plan: shooterPlan() },
      { name: "单人闯关拉星星(合作)", enter: async (p) => { await clickText(p, /单人闯关/); await sleep(400); await l99Enter(p); }, plan: shooterPlan() },
      { name: "双人对战", enter: async (p) => { await clickText(p, /双人对战/); }, plan: shooterPlan() }
    ]
  },
  "bomb-buddies": {
    campaign: true,
    enterCampaign: l99Enter,
    plan: mixPlan({ keys: ["d", "f", "s", "a", "w", "f"], hold: 200 }),
    modes: [
      { name: "泡泡塔(无尽)", enter: async (p) => { await clickText(p, /泡泡塔/); }, plan: mixPlan({ keys: ["d", "f", "s", "a", "w"], hold: 200 }) },
      { name: "双人对战", enter: async (p) => { await clickText(p, /双人对战/); }, plan: mixPlan({ hold: 200 }) },
      { name: "人机对战·普通", enter: async (p) => { await clickText(p, /人机对战/); }, plan: mixPlan({ keys: ["d", "f", "s", "a", "w"], hold: 200 }) },
      { name: "双人合作", enter: async (p) => { await clickText(p, /双人合作/); }, plan: mixPlan({ hold: 200 }) }
    ]
  },
  "snow-fight": {
    campaign: true,
    enterCampaign: l99Enter,
    plan: snowPlan(),
    modes: [
      { name: "无尽雪季", enter: async (p) => { await clickText(p, /无尽雪季/); }, plan: snowPlan() },
      { name: "双人对战", enter: async (p) => { await clickText(p, /双人对战/); }, plan: snowPlan() }
    ]
  },
  "bumper-cars": {
    campaign: true,
    enterCampaign: l99Enter,
    plan: mixPlan({ keys: ["d", "w", "a", "s", "f"], hold: 220 }),
    modes: [
      { name: "无尽车海", enter: async (p) => { await clickText(p, /无尽车海/); }, plan: mixPlan({ keys: ["d", "w", "a", "s", "f"], hold: 220 }) },
      { name: "人机·熟练车手", enter: async (p) => { await clickText(p, /人机对战/); }, plan: mixPlan({ keys: ["d", "w", "a", "s", "f"], hold: 220 }) },
      { name: "双人对战", enter: async (p) => { await clickText(p, /双人对战/); }, plan: mixPlan({ hold: 220 }) }
    ]
  },
  "bowling-lane": {
    campaign: true,
    enterCampaign: l99Enter,
    plan: mixPlan({ keys: ["f", " "], pads: false, tap: true }),
    modes: [
      { name: "无尽格", enter: async (p) => { await clickText(p, /无尽格/); }, plan: mixPlan({ keys: ["f", " "], pads: false }) },
      { name: "人机·熟练球手", enter: async (p) => { await clickText(p, /人机对战/); }, plan: mixPlan({ keys: ["f", " "], pads: false }) },
      { name: "双人对战", enter: async (p) => { await clickText(p, /双人对战/); }, plan: mixPlan({ keys: ["f", " ", "l"], pads: false }) }
    ]
  },
  "ice-fire-forest": {
    campaign: true,
    enterCampaign: l99Enter,
    plan: forestPlan(),
    modes: [
      { name: "双人同屏(关内两套键位)", enter: async (p) => { await l99Enter(p); }, plan: forestPlan() },
      {
        name: "一个人玩(Tab 换角色)",
        enter: async (p) => { await l99Enter(p); await sleep(600); await p.keyboard.press("Tab"); },
        plan: mixPlan({ keys: ["w", "a", "d", "f", "g"], hold: 200 })
      }
    ]
  },
  "puff-bros": {
    campaign: true,
    enterCampaign: async (p) => { await clickText(p, /闯关:一个人|闯关：一个人/); await sleep(400); await l99Enter(p); },
    plan: puffPlan(),
    modes: [
      { name: "噗噗不停(无尽)", enter: async (p) => { await clickText(p, /噗噗不停/); }, plan: mixPlan({ hold: 180 }) },
      { name: "上升气流", enter: async (p) => { await clickText(p, /上升气流/); }, plan: mixPlan({ hold: 180 }) },
      { name: "双人对战", enter: async (p) => { await clickText(p, /双人对战/); }, plan: mixPlan({ hold: 180 }) },
      { name: "人机三档", enter: async (p) => { await clickText(p, /人机三档/); }, plan: mixPlan({ hold: 180 }) }
    ]
  },
  "prince-princess": {
    campaign: true,
    enterCampaign: l99Enter,
    plan: mixPlan({ keys: ["d", "w", "f", "a", "s", " "], hold: 190 }),
    modes: [
      { name: "无尽城堡塔", enter: async (p) => { await clickText(p, /无尽城堡塔/); }, plan: mixPlan({ keys: ["d", "w", "f", "a", " "], hold: 190 }) },
      { name: "两人一起(双人合作)", enter: async (p) => { await clickText(p, /两人一起/); await sleep(400); await l99Enter(p); }, plan: mixPlan({ hold: 190 }) },
      { name: "一个人玩(Tab 换人)", enter: async (p) => { await clickText(p, /一个人玩/); await sleep(400); await l99Enter(p); }, plan: mixPlan({ keys: ["d", "w", "f", "a", " "], hold: 190 }) }
    ]
  }
};

/** 全画布菜单：连点 n 层直到进关（skipFirst 用来挑第二张卡片，比如无尽） */
export async function canvasEnter(page, n = 3, pick = 0) {
  for (let i = 0; i < n; i++) {
    const e = await blindEnter(page);
    if (!e.ok) return false;
    await sleep(700);
  }
  return true;
}

/** 全 canvas 的塔防：进第 1 关靠盲点主题图 */
async function gridEnter(page) {
  const box = (await canvasBox(page)) ?? (await stageBox(page));
  if (!box) return false;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const s = await settle(page);
      if (s && s.verdict !== "unknown") return true;
      await tap(page, box.x + (box.w * (c + 0.5)) / 3, box.y + (box.h * (r + 0.5)) / 3);
      await sleep(420);
    }
  }
  return true;
}

/**
 * 打雪仗：HUD 上的角度读得到，先把准星压到 40~55°，
 * 再按住 F 扫一遍蓄力时长（松手那一下就是力度）。
 */
function snowPlan() {
  return async (page, i) => {
    const ang = await page.evaluate(() => {
      const t = document.querySelector(".game-stage")?.textContent ?? "";
      const m = t.match(/(\d+)\s*°/);
      return m ? Number(m[1]) : null;
    });
    if (ang !== null && ang > 55) {
      for (let k = 0; k < Math.min(8, Math.ceil((ang - 45) / 4)); k++) await holdKey(page, "s", 70);
    } else if (ang !== null && ang < 30) {
      for (let k = 0; k < 4; k++) await holdKey(page, "w", 70);
    }
    // 先蹲下搓雪，再按住 F 蓄力，蓄力时长逐档扫（松手那一下就是力度）
    await holdKey(page, "g", 1000);
    await sleep(200);
    await holdKey(page, "f", 300 + 150 * (i % 10));
    await sleep(1400);
  };
}

/** 冰火森林：两个小人各自往右上角的门挪，偶尔换方向蹭出岔路 */
function forestPlan() {
  const p1 = ["w", "w", "d", "w", "a", "s"];
  const p2 = ["ArrowUp", "ArrowUp", "ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown"];
  return async (page, i) => {
    await holdKey(page, p1[(i * 2) % p1.length], 150);
    await holdKey(page, p2[(i * 3 + 1) % p2.length], 150);
    if (i % 7 === 3) {
      await holdKey(page, "f", 120);
      await holdKey(page, "l", 120);
    }
  };
}

/** 噗噗兄弟：贴着咕噜怪吹泡泡（F）再噗破（G），两个人都动 */
function puffPlan() {
  return async (page, i) => {
    await holdKey(page, ["d", "d", "a", "w"][i % 4], 170);
    await holdKey(page, "f", 110);
    await holdKey(page, "g", 110);
    await holdKey(page, ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowRight"][i % 4], 170);
    await holdKey(page, "l", 110);
    await holdKey(page, "k", 110);
  };
}

export { gridEnter, snowPlan, forestPlan, puffPlan, l99Enter };
