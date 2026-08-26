// 冒险小王 · 1.2 探索层。
//
// 战役那 188 关是横版走廊(levels.ts + sim.ts),这一层是另一件事:
// 俯视视角的「地图房间」——推箱子、开石门、拨颜色开关、踩跷跷板、撞出隐藏墙、走传送门,
// 顺手把每章的贴纸收进图鉴。无尽古堡就是把这些房间模板随机拼起来一间间走。
//
// 这个文件不碰 DOM、不碰画布,只有纯函数与纯状态,index.ts 与单测共用同一份规则。

// ---------------------------------------------------------------------------
// 地图字符
// ---------------------------------------------------------------------------

/** 墙 */
export const C_WALL = "#";
/** 地板 */
export const C_FLOOR = ".";
/** 起点(解析完就变地板) */
export const C_START = "@";
/** 出口 */
export const C_EXIT = "E";
/** 钥匙 */
export const C_KEY = "K";
/** 钥匙门:有钥匙就能推开 */
export const C_DOOR = "D";
/** 木箱:可以推 */
export const C_BOX = "B";
/** 压板:把木箱推上去就压住了 */
export const C_PLATE = "P";
/** 压板石门:压板被压住才让路 */
export const C_PGATE = "Q";
/** 颜色开关:拨一下亮起来 */
export const C_SWITCH = "S";
/** 颜色门:开关亮着才让路 */
export const C_CGATE = "G";
/** 跷跷板左端 */
export const C_SEESAW_L = "<";
/** 跷跷板右端 */
export const C_SEESAW_R = ">";
/** 隐藏墙:看起来是墙,撞一下露出秘密房 */
export const C_HIDDEN = "H";
/** 传送门(一间房里成对出现) */
export const C_PORTAL = "O";
/** 贴纸收集品 */
export const C_STICKER = "*";

/** 六种解谜物件的名字,给攻略与提示条用 */
export const PUZZLE_KINDS = [
  { key: "door", emoji: "🔑", name: "钥匙门", tip: "先捡钥匙,再推门。" },
  { key: "plate", emoji: "📦", name: "推箱压板", tip: "把木箱推到压板上,石门就让路。" },
  { key: "switch", emoji: "🎨", name: "颜色开关", tip: "拨亮开关,同色的门才开。" },
  { key: "seesaw", emoji: "🪵", name: "跷跷板", tip: "压低的一端才踩得上去。" },
  { key: "hidden", emoji: "🧱", name: "隐藏墙", tip: "撞一撞看着可疑的墙,后面常有秘密房。" },
  { key: "portal", emoji: "🌀", name: "传送门", tip: "两个漩涡是一对,踩一个就到另一个。" },
] as const;

export type PuzzleKind = (typeof PUZZLE_KINDS)[number]["key"];

export type Dir = "up" | "down" | "left" | "right";

export const DIR_DELTA: Record<Dir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

// ---------------------------------------------------------------------------
// 六种解谜物件的判定(每种一个纯函数)
// ---------------------------------------------------------------------------

/** 钥匙门:手上至少有一把钥匙才推得开 */
export function canOpenKeyDoor(keys: number): boolean {
  return Number.isFinite(keys) && keys >= 1;
}

/** 木箱能不能被推到 (tx,ty):目标格必须是空地板类,且没有别的箱子 */
export function canPushBox(cell: string, occupied: boolean): boolean {
  if (occupied) return false;
  return cell === C_FLOOR || cell === C_PLATE || cell === C_STICKER || cell === C_KEY;
}

/** 压板:任意一个木箱压在上面就算压住 */
export function platePressed(plates: readonly Pos[], boxes: readonly Pos[]): boolean {
  if (plates.length === 0) return false;
  return plates.some((p) => boxes.some((b) => b.x === p.x && b.y === p.y));
}

/** 颜色开关:拨一下换一次亮灭 */
export function toggleSwitch(on: boolean): boolean {
  return !on;
}

/** 颜色门:开关亮着才让路 */
export function colorGateOpen(switchOn: boolean): boolean {
  return switchOn;
}

/**
 * 跷跷板:哪边重哪边沉。
 * 返回 -1 = 左端沉下去、1 = 右端沉下去、0 = 两端齐平。
 * 沉下去的那端才踩得上去(齐平时两端都能踩)。
 */
export function seesawTilt(leftWeight: number, rightWeight: number): -1 | 0 | 1 {
  const l = Number.isFinite(leftWeight) ? leftWeight : 0;
  const r = Number.isFinite(rightWeight) ? rightWeight : 0;
  if (l > r) return -1;
  if (r > l) return 1;
  return 0;
}

/** 跷跷板的某一端现在能不能踩 */
export function seesawWalkable(side: "left" | "right", tilt: -1 | 0 | 1): boolean {
  if (tilt === 0) return true;
  return side === "left" ? tilt === -1 : tilt === 1;
}

/** 隐藏墙:撞过就永久露出来 */
export function revealHidden(revealed: ReadonlySet<string>, x: number, y: number): Set<string> {
  const next = new Set(revealed);
  next.add(`${x},${y}`);
  return next;
}

/** 传送门配对:踩到第 i 个漩涡就去第 i^1 个;数量不成对时留在原地 */
export function portalPartner(portals: readonly Pos[], index: number): Pos | null {
  if (portals.length < 2 || index < 0 || index >= portals.length) return null;
  const pairBase = index - (index % 2);
  const other = index % 2 === 0 ? pairBase + 1 : pairBase;
  return portals[other] ?? null;
}

// ---------------------------------------------------------------------------
// 房间状态
// ---------------------------------------------------------------------------

export interface Pos {
  x: number;
  y: number;
}

export interface RoomTemplate {
  id: string;
  name: string;
  emoji: string;
  /** 这一间主打哪种物件(提示条用) */
  focus: PuzzleKind;
  /** 地图,每行等宽 */
  rows: readonly string[];
}

export interface RoomState {
  templateId: string;
  w: number;
  h: number;
  /** 静态层(开过的门、揭开的隐藏墙会就地改写),长度 w*h */
  cells: string[];
  player: Pos;
  keys: number;
  boxes: Pos[];
  plates: Pos[];
  portals: Pos[];
  stickers: Pos[];
  switchOn: boolean;
  /** 已探索留痕,长度 w*h */
  explored: boolean[];
  /** 本房间撞开的秘密房数量 */
  secrets: number;
  /** 本房间已拿到的贴纸数量 */
  picked: number;
  cleared: boolean;
  moves: number;
}

export function idx(state: { w: number }, x: number, y: number): number {
  return y * state.w + x;
}

export function inside(state: { w: number; h: number }, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < state.w && y < state.h;
}

export function cellAt(state: RoomState, x: number, y: number): string {
  if (!inside(state, x, y)) return C_WALL;
  return state.cells[idx(state, x, y)];
}

function setCell(state: RoomState, x: number, y: number, ch: string): void {
  if (inside(state, x, y)) state.cells[idx(state, x, y)] = ch;
}

/** 房间里有没有木箱站在 (x,y) */
export function boxAt(state: RoomState, x: number, y: number): number {
  return state.boxes.findIndex((b) => b.x === x && b.y === y);
}

/** 压板现在被压住了吗 */
export function isPlateDown(state: RoomState): boolean {
  return platePressed(state.plates, state.boxes);
}

/** 跷跷板当前的倾斜:箱子压哪端哪端沉,没箱子就齐平 */
export function seesawOf(state: RoomState): -1 | 0 | 1 {
  let l = 0;
  let r = 0;
  for (const b of state.boxes) {
    const c = cellAt(state, b.x, b.y);
    if (c === C_SEESAW_L) l++;
    else if (c === C_SEESAW_R) r++;
  }
  return seesawTilt(l, r);
}

/** 把模板解析成一间可玩的房间(纯函数,同一模板每次解析结果一致) */
export function parseRoom(tpl: RoomTemplate): RoomState {
  const h = tpl.rows.length;
  const w = h > 0 ? tpl.rows[0].length : 0;
  const cells = new Array<string>(w * h).fill(C_WALL);
  const state: RoomState = {
    templateId: tpl.id,
    w,
    h,
    cells,
    player: { x: 1, y: 1 },
    keys: 0,
    boxes: [],
    plates: [],
    portals: [],
    stickers: [],
    switchOn: false,
    explored: new Array<boolean>(w * h).fill(false),
    secrets: 0,
    picked: 0,
    cleared: false,
    moves: 0,
  };
  for (let y = 0; y < h; y++) {
    const row = tpl.rows[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x] ?? C_WALL;
      let store = ch;
      if (ch === C_START) {
        state.player = { x, y };
        store = C_FLOOR;
      } else if (ch === C_BOX) {
        state.boxes.push({ x, y });
        store = C_FLOOR;
      } else if (ch === C_PLATE) {
        state.plates.push({ x, y });
      } else if (ch === C_PORTAL) {
        state.portals.push({ x, y });
      } else if (ch === C_STICKER) {
        state.stickers.push({ x, y });
      }
      cells[y * w + x] = store;
    }
  }
  markExplored(state);
  return state;
}

/** 深拷贝一间房(纯函数式推进用) */
export function cloneRoom(state: RoomState): RoomState {
  return {
    ...state,
    cells: state.cells.slice(),
    player: { ...state.player },
    boxes: state.boxes.map((b) => ({ ...b })),
    plates: state.plates.map((p) => ({ ...p })),
    portals: state.portals.map((p) => ({ ...p })),
    stickers: state.stickers.map((p) => ({ ...p })),
    explored: state.explored.slice(),
  };
}

/** 把人所在格与四邻标成「已探索」(小地图靠它留痕) */
export function markExplored(state: RoomState): void {
  const { x, y } = state.player;
  const spots: Pos[] = [{ x, y }, { x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }];
  for (const s of spots) {
    if (inside(state, s.x, s.y)) state.explored[idx(state, s.x, s.y)] = true;
  }
}

/** 已探索比例(0..1),小地图角标用 */
export function exploredRatio(state: RoomState): number {
  let total = 0;
  let seen = 0;
  for (let i = 0; i < state.cells.length; i++) {
    if (state.cells[i] === C_WALL) continue;
    total++;
    if (state.explored[i]) seen++;
  }
  return total === 0 ? 0 : seen / total;
}

/**
 * 小地图:每格一个字符。
 * `·` 没去过、`░` 去过的地板、`▣` 人在这儿、`▪` 墙、`▤` 出口。
 */
export function miniMapRows(state: RoomState): string[] {
  const rows: string[] = [];
  for (let y = 0; y < state.h; y++) {
    let line = "";
    for (let x = 0; x < state.w; x++) {
      const c = state.cells[idx(state, x, y)];
      if (state.player.x === x && state.player.y === y) line += "▣";
      else if (c === C_WALL || c === C_HIDDEN) line += "▪";
      else if (!state.explored[idx(state, x, y)]) line += "·";
      else if (c === C_EXIT) line += "▤";
      else line += "░";
    }
    rows.push(line);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// 走一步
// ---------------------------------------------------------------------------

export type MoveEvent =
  | { kind: "walk" }
  | { kind: "bump" }
  | { kind: "unlock" }
  | { kind: "locked"; text: string }
  | { kind: "key" }
  | { kind: "push" }
  | { kind: "plate" }
  | { kind: "switch"; on: boolean }
  | { kind: "secret" }
  | { kind: "portal" }
  | { kind: "sticker"; index: number }
  | { kind: "clear" };

/** 一格现在能不能站人(不考虑箱子) */
export function walkable(state: RoomState, x: number, y: number): boolean {
  const c = cellAt(state, x, y);
  if (c === C_WALL || c === C_HIDDEN || c === C_DOOR) return false;
  if (c === C_PGATE) return isPlateDown(state);
  if (c === C_CGATE) return colorGateOpen(state.switchOn);
  if (c === C_SEESAW_L) return seesawWalkable("left", seesawOf(state));
  if (c === C_SEESAW_R) return seesawWalkable("right", seesawOf(state));
  return true;
}

/**
 * 走一步:返回新状态与这一步发生的事。
 * 输入状态不会被改动(拷贝后再改),方便单测一步一步比对。
 */
export function stepMove(state: RoomState, dir: Dir): { state: RoomState; events: MoveEvent[] } {
  const next = cloneRoom(state);
  const events: MoveEvent[] = [];
  if (next.cleared) return { state: next, events };

  const d = DIR_DELTA[dir];
  const tx = next.player.x + d.dx;
  const ty = next.player.y + d.dy;
  const target = cellAt(next, tx, ty);

  // 隐藏墙:撞一下就露出秘密房,人这一步先不动
  if (target === C_HIDDEN) {
    setCell(next, tx, ty, C_FLOOR);
    next.secrets++;
    events.push({ kind: "secret" });
    return { state: next, events };
  }

  // 钥匙门:有钥匙就开,人这一步先不动
  if (target === C_DOOR) {
    if (canOpenKeyDoor(next.keys)) {
      next.keys--;
      setCell(next, tx, ty, C_FLOOR);
      events.push({ kind: "unlock" });
    } else {
      events.push({ kind: "locked", text: "这扇门锁着,先去找一把钥匙～" });
    }
    return { state: next, events };
  }

  // 木箱:先看推不推得动
  const bi = boxAt(next, tx, ty);
  if (bi >= 0) {
    const bx = tx + d.dx;
    const by = ty + d.dy;
    const beyond = cellAt(next, bx, by);
    const occupied = boxAt(next, bx, by) >= 0;
    // 跷跷板端点也能放箱子——但只能放到现在沉着的那一端
    const ontoSeesaw =
      (beyond === C_SEESAW_L || beyond === C_SEESAW_R) && !occupied && walkable(next, bx, by);
    if (!canPushBox(beyond, occupied) && !ontoSeesaw) {
      events.push({ kind: "bump" });
      return { state: next, events };
    }
    next.boxes[bi] = { x: bx, y: by };
    next.player = { x: tx, y: ty };
    next.moves++;
    events.push({ kind: "push" });
    if (isPlateDown(next)) events.push({ kind: "plate" });
    markExplored(next);
    return { state: next, events };
  }

  if (!walkable(next, tx, ty)) {
    if (target === C_PGATE) events.push({ kind: "locked", text: "石门纹丝不动,把木箱推到压板上试试～" });
    else if (target === C_CGATE) events.push({ kind: "locked", text: "这道彩门还暗着,先去拨亮开关～" });
    else if (target === C_SEESAW_L || target === C_SEESAW_R) {
      events.push({ kind: "locked", text: "这一端翘起来了,压住另一端才踩得上去～" });
    } else events.push({ kind: "bump" });
    return { state: next, events };
  }

  next.player = { x: tx, y: ty };
  next.moves++;
  events.push({ kind: "walk" });

  const here = cellAt(next, tx, ty);
  if (here === C_KEY) {
    next.keys++;
    setCell(next, tx, ty, C_FLOOR);
    events.push({ kind: "key" });
  } else if (here === C_SWITCH) {
    next.switchOn = toggleSwitch(next.switchOn);
    events.push({ kind: "switch", on: next.switchOn });
  } else if (here === C_STICKER) {
    const si = next.stickers.findIndex((s) => s.x === tx && s.y === ty);
    setCell(next, tx, ty, C_FLOOR);
    next.picked++;
    events.push({ kind: "sticker", index: si });
  } else if (here === C_PORTAL) {
    const pi = next.portals.findIndex((p) => p.x === tx && p.y === ty);
    const dest = portalPartner(next.portals, pi);
    if (dest) {
      next.player = { x: dest.x, y: dest.y };
      events.push({ kind: "portal" });
    }
  } else if (here === C_EXIT) {
    next.cleared = true;
    events.push({ kind: "clear" });
  }

  markExplored(next);
  return { state: next, events };
}

// ---------------------------------------------------------------------------
// 不卡死:房间求解器 + 一键复位
// ---------------------------------------------------------------------------

function reachableFrom(
  state: RoomState,
  start: Pos,
  pass: (x: number, y: number) => boolean,
  usePortals = true
): boolean[] {
  const seen = new Array<boolean>(state.w * state.h).fill(false);
  if (!inside(state, start.x, start.y)) return seen;
  const queue: Pos[] = [start];
  seen[idx(state, start.x, start.y)] = true;
  while (queue.length > 0) {
    const cur = queue.shift() as Pos;
    if (usePortals && cellAt(state, cur.x, cur.y) === C_PORTAL) {
      const pi = state.portals.findIndex((p) => p.x === cur.x && p.y === cur.y);
      const dest = portalPartner(state.portals, pi);
      if (dest && !seen[idx(state, dest.x, dest.y)]) {
        seen[idx(state, dest.x, dest.y)] = true;
        queue.push(dest);
      }
    }
    for (const d of Object.values(DIR_DELTA)) {
      const nx = cur.x + d.dx;
      const ny = cur.y + d.dy;
      if (!inside(state, nx, ny) || seen[idx(state, nx, ny)]) continue;
      if (!pass(nx, ny)) continue;
      seen[idx(state, nx, ny)] = true;
      queue.push({ x: nx, y: ny });
    }
  }
  return seen;
}

/**
 * 单个木箱能被推到哪些格子(小型推箱子搜索:状态 = 箱子位置 + 人的位置)。
 * 房间只有 11×7,状态空间几千个,直接 BFS 就够。
 */
export function boxPushTargets(state: RoomState, boxIndex: number, open: (x: number, y: number) => boolean): Pos[] {
  const box = state.boxes[boxIndex];
  if (!box) return [];
  const others = state.boxes.filter((_, i) => i !== boxIndex);
  const blocked = (x: number, y: number, bx: number, by: number): boolean => {
    if (!open(x, y)) return true;
    if (x === bx && y === by) return true;
    return others.some((o) => o.x === x && o.y === y);
  };
  const key = (bx: number, by: number, px: number, py: number): string => `${bx},${by},${px},${py}`;
  const seen = new Set<string>([key(box.x, box.y, state.player.x, state.player.y)]);
  const spots = new Map<string, Pos>([[`${box.x},${box.y}`, { x: box.x, y: box.y }]]);
  const queue: Array<{ bx: number; by: number; px: number; py: number }> = [
    { bx: box.x, by: box.y, px: state.player.x, py: state.player.y },
  ];
  while (queue.length > 0) {
    const cur = queue.shift() as { bx: number; by: number; px: number; py: number };
    for (const d of Object.values(DIR_DELTA)) {
      const nx = cur.px + d.dx;
      const ny = cur.py + d.dy;
      if (!inside(state, nx, ny)) continue;
      if (nx === cur.bx && ny === cur.by) {
        // 推箱子
        const bx = cur.bx + d.dx;
        const by = cur.by + d.dy;
        if (!inside(state, bx, by)) continue;
        if (blocked(bx, by, -1, -1)) continue;
        const k = key(bx, by, nx, ny);
        if (seen.has(k)) continue;
        seen.add(k);
        spots.set(`${bx},${by}`, { x: bx, y: by });
        queue.push({ bx, by, px: nx, py: ny });
      } else {
        if (blocked(nx, ny, cur.bx, cur.by)) continue;
        const k = key(cur.bx, cur.by, nx, ny);
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push({ bx: cur.bx, by: cur.by, px: nx, py: ny });
      }
    }
  }
  return Array.from(spots.values());
}

/**
 * 这间房从当前状态还走得通吗(不动点求解):
 * 反复算「现在能到哪儿」→ 能捡的钥匙开掉能开的门、能碰到的开关拨亮、
 * 能推上压板的箱子压上去 → 再算一遍,直到没有新进展。
 * 跷跷板与隐藏墙一律当墙(保守估计),所以它们只会通往彩蛋区,永远不挡出口。
 */
export function solveRoom(input: RoomState): boolean {
  const state = cloneRoom(input);
  if (state.cleared) return true;
  let plateDown = isPlateDown(state);
  let switchOn = state.switchOn;
  let keys = state.keys;
  const takenKeys = new Set<string>();
  for (let guard = 0; guard < 64; guard++) {
    const pass = (x: number, y: number): boolean => {
      const c = cellAt(state, x, y);
      if (c === C_WALL || c === C_HIDDEN || c === C_DOOR) return false;
      if (c === C_SEESAW_L || c === C_SEESAW_R) return false;
      if (c === C_PGATE) return plateDown;
      if (c === C_CGATE) return switchOn;
      return true;
    };
    const seen = reachableFrom(state, state.player, pass);
    if (seen.some((v, i) => v && state.cells[i] === C_EXIT)) return true;

    let changed = false;

    // 捡到手边的钥匙
    for (let i = 0; i < state.cells.length; i++) {
      if (!seen[i] || state.cells[i] !== C_KEY) continue;
      const k = String(i);
      if (takenKeys.has(k)) continue;
      takenKeys.add(k);
      keys++;
      changed = true;
    }

    // 拨亮碰得到的开关
    if (!switchOn && seen.some((v, i) => v && state.cells[i] === C_SWITCH)) {
      switchOn = true;
      changed = true;
    }

    // 有钥匙就开一扇挨着的门
    if (keys > 0) {
      for (let y = 0; y < state.h && keys > 0; y++) {
        for (let x = 0; x < state.w && keys > 0; x++) {
          if (cellAt(state, x, y) !== C_DOOR) continue;
          const touching = Object.values(DIR_DELTA).some((d) => {
            const nx = x + d.dx;
            const ny = y + d.dy;
            return inside(state, nx, ny) && seen[idx(state, nx, ny)];
          });
          if (!touching) continue;
          setCell(state, x, y, C_FLOOR);
          keys--;
          changed = true;
        }
      }
    }

    // 把够得到的箱子推上压板
    if (!plateDown && state.plates.length > 0) {
      for (let bi = 0; bi < state.boxes.length && !plateDown; bi++) {
        const b = state.boxes[bi];
        if (!seen.some((v, i) => v && Object.values(DIR_DELTA).some((d) => i === idx(state, b.x + d.dx, b.y + d.dy)))) {
          continue;
        }
        const targets = boxPushTargets(state, bi, pass);
        const hit = targets.find((t) => state.plates.some((p) => p.x === t.x && p.y === t.y));
        if (hit) {
          state.boxes[bi] = hit;
          plateDown = true;
          changed = true;
        }
      }
    }

    if (!changed) return false;
  }
  return false;
}

/** 这一局是不是走进死胡同了(箱子推死角之类):求解器说走不通就是死局 */
export function roomStuck(state: RoomState): boolean {
  return !state.cleared && !solveRoom(state);
}

/**
 * 一键复位本房间:回到模板的初始摆法。
 * 只重置房间自己,冒险的分数、贴纸图鉴、秘密数都在 run 层,不受影响——复位不扣星。
 */
export function resetRoom(tpl: RoomTemplate): RoomState {
  return parseRoom(tpl);
}

// ---------------------------------------------------------------------------
// 贴纸图鉴
// ---------------------------------------------------------------------------

/** 图鉴存档 key(沿用 yiduo-yixing. 前缀,和老的星级 / 速通存档并存,不改它们) */
export const ALBUM_KEY = "yiduo-yixing.adventure-king.album.v1";

/** 每章一套四张贴纸,全是本作原创的小场景 */
export const STICKER_SETS: ReadonlyArray<{ chapter: string; emoji: string; items: readonly string[] }> = [
  { chapter: "苔藓回廊", emoji: "🌿", items: ["苔藓小灯", "石阶蘑菇", "藤环秋千", "露水铃铛"] },
  { chapter: "石纹回声", emoji: "🪨", items: ["回声贝壳", "刻纹石板", "落石小铃", "石缝小花"] },
  { chapter: "沙砾长廊", emoji: "🏜️", items: ["沙漏摆件", "旅人水壶", "风纹瓦片", "驼铃小串"] },
  { chapter: "冰晶阶梯", emoji: "❄️", items: ["冰花窗格", "雪松枝条", "霜纹提灯", "冰糖小锤"] },
  { chapter: "星尘穹顶", emoji: "✨", items: ["星尘沙漏", "夜光罗盘", "流星纸鹤", "银河书签"] },
  { chapter: "藤影暗室", emoji: "🍃", items: ["藤影书页", "夜花标本", "青苔画笔", "垂枝风铃"] },
  { chapter: "熔纹地宫", emoji: "🔥", items: ["暖石护符", "陶土小炉", "火纹瓷片", "赤金小铲"] },
  { chapter: "云顶王座", emoji: "👑", items: ["云顶羽笔", "王座软垫", "朵朵的旗", "星星的哨"] },
];

/** 一张贴纸的 id:`章-序号` */
export function stickerId(chapter: number, item: number): string {
  return `${chapter}-${item}`;
}

/** 图鉴一共多少张 */
export function albumTotal(): number {
  return STICKER_SETS.reduce((n, s) => n + s.items.length, 0);
}

/** 把图鉴整理成「升序去重的合法 id 列表」;坏数据一律丢掉,绝不抛 */
export function normalizeAlbum(parsed: unknown): string[] {
  if (!Array.isArray(parsed)) return [];
  const valid = new Set<string>();
  STICKER_SETS.forEach((s, ci) => s.items.forEach((_, ii) => valid.add(stickerId(ci, ii))));
  const out = new Set<string>();
  for (const v of parsed as unknown[]) {
    if (typeof v === "string" && valid.has(v)) out.add(v);
  }
  return Array.from(out).sort();
}

export function parseAlbum(raw: string | null): string[] {
  if (!raw) return [];
  try {
    return normalizeAlbum(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function serializeAlbum(album: readonly string[]): string {
  return JSON.stringify(normalizeAlbum(album.slice()));
}

/** 某一章集齐了吗 */
export function albumChapterDone(album: readonly string[], chapter: number): boolean {
  const set = STICKER_SETS[chapter];
  if (!set) return false;
  return set.items.every((_, ii) => album.includes(stickerId(chapter, ii)));
}

/** 集齐的章数(每集齐一章送一颗小星星) */
export function albumBonusStars(album: readonly string[]): number {
  let n = 0;
  for (let ci = 0; ci < STICKER_SETS.length; ci++) if (albumChapterDone(album, ci)) n++;
  return n;
}

/** 下一张该收的贴纸(按顺序发,保证一章一章集齐) */
export function nextSticker(album: readonly string[]): { chapter: number; item: number } | null {
  for (let ci = 0; ci < STICKER_SETS.length; ci++) {
    for (let ii = 0; ii < STICKER_SETS[ci].items.length; ii++) {
      if (!album.includes(stickerId(ci, ii))) return { chapter: ci, item: ii };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 无尽古堡:房间模板库 + 随机拼接
// ---------------------------------------------------------------------------

/** 房间模板库(12 间,每间主打一种物件;越靠后越绕) */
export const ROOM_TEMPLATES: readonly RoomTemplate[] = [
  {
    id: "hall",
    name: "石门厅",
    emoji: "🔑",
    focus: "door",
    rows: ["###########", "#@..#....E#", "#...#.###.#", "#.K.D.....#", "#...#.###.#", "#..*#.....#", "###########"],
  },
  {
    id: "plateyard",
    name: "压板小院",
    emoji: "📦",
    focus: "plate",
    rows: ["###########", "#@...#...*#", "#..B.#.##.#", "#....Q....#", "#..P.#.##.#", "#....#...E#", "###########"],
  },
  {
    id: "paintroom",
    name: "调色暗间",
    emoji: "🎨",
    focus: "switch",
    rows: ["###########", "#@..#....E#", "#...#..#..#", "#...G..#..#", "#...#..#..#", "#.S.#.....#", "###########"],
  },
  {
    id: "swirl",
    name: "漩涡走廊",
    emoji: "🌀",
    focus: "portal",
    rows: ["###########", "#@..#######", "#...#....O#", "#.O.#..####", "#...#....*#", "#####....E#", "###########"],
  },
  {
    id: "seesawloft",
    name: "跷跷板阁楼",
    emoji: "🪵",
    focus: "seesaw",
    rows: ["###########", "#@...#...*#", "#.B..#.##.#", "#.<>*#.##.#", "#.####.##.#", "#........E#", "###########"],
  },
  {
    id: "mossnook",
    name: "苔痕夹角",
    emoji: "🧱",
    focus: "hidden",
    rows: ["###########", "#@....H..*#", "#.###.#####", "#...#.....#", "#.#.#.###.#", "#.#.....#E#", "###########"],
  },
  {
    id: "twinlock",
    name: "双锁长厅",
    emoji: "🔑",
    focus: "door",
    rows: ["###########", "#@..#.K.#E#", "#...#...#.#", "#.K.D...D.#", "#...#...#.#", "#..*#...#.#", "###########"],
  },
  {
    id: "pushline",
    name: "推箱长道",
    emoji: "📦",
    focus: "plate",
    rows: ["###########", "#@.......*#", "#.#######.#", "#..B...P#.#", "#.#####.#.#", "#....Q.E#.#", "###########"],
  },
  {
    id: "lampgrid",
    name: "灯格迷厅",
    emoji: "🎨",
    focus: "switch",
    rows: ["###########", "#@.#....#*#", "#..#.##...#", "#S.#.#..#.#", "#..G.#.##.#", "#..#...#.E#", "###########"],
  },
  {
    id: "deepswirl",
    name: "深处漩涡",
    emoji: "🌀",
    focus: "portal",
    rows: ["###########", "#@..#*..###", "#.O.#..#..#", "#...#..#O.#", "#...#..#..#", "#......#.E#", "###########"],
  },
  {
    id: "hiddenvault",
    name: "隐墙库房",
    emoji: "🧱",
    focus: "hidden",
    rows: ["###########", "#@.......*#", "#.#H###.#.#", "#.#*#...#.#", "#.###...#.#", "#.......#E#", "###########"],
  },
  {
    id: "kingsgate",
    name: "王座前庭",
    emoji: "👑",
    focus: "door",
    rows: ["###########", "#@..#..#.*#", "#.K.#..#..#", "#...D.....#", "#..B#..#..#", "#..P#Q*#.E#", "###########"],
  },
];

export function templateById(id: string): RoomTemplate | null {
  return ROOM_TEMPLATES.find((t) => t.id === id) ?? null;
}

/** 每间房都必须长方形、有起点也有出口 */
export function templateWellFormed(tpl: RoomTemplate): boolean {
  if (tpl.rows.length < 3) return false;
  const w = tpl.rows[0].length;
  if (w < 3) return false;
  if (!tpl.rows.every((r) => r.length === w)) return false;
  const flat = tpl.rows.join("");
  return flat.includes(C_START) && flat.includes(C_EXIT);
}

/**
 * 第 n 间房(1 基)能抽到的模板池:头几间只出简单的,越往里越花。
 * 池子最少 3 间,保证随机得起来。
 */
export function templatePoolFor(room: number): RoomTemplate[] {
  const n = Math.max(1, Math.round(room));
  const size = Math.min(ROOM_TEMPLATES.length, 3 + Math.floor((n - 1) / 2));
  return ROOM_TEMPLATES.slice(0, size);
}

/** 小巧的确定性随机(和 level99 的 mulberry32 同款,写在这里免得跨文件传函数) */
function rng(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface CastleRoom {
  /** 第几间(1 基) */
  room: number;
  template: RoomTemplate;
  state: RoomState;
}

/**
 * 拼一间古堡房间:按 seed 从模板池里挑一间,解析出来再当场校验。
 * 校验没过(理论上不会发生)就退回第一张模板,保证永远给得出一间走得通的房。
 */
export function buildCastleRoom(seed: number, room: number): CastleRoom {
  const pool = templatePoolFor(room);
  const rand = rng(seed * 7919 + room * 104729);
  const tpl = pool[Math.floor(rand() * pool.length) % pool.length] ?? ROOM_TEMPLATES[0];
  const state = parseRoom(tpl);
  if (!solveRoom(state)) {
    const safe = ROOM_TEMPLATES[0];
    return { room, template: safe, state: parseRoom(safe) };
  }
  return { room, template: tpl, state };
}

// ---------------------------------------------------------------------------
// 清理袋:监听 / 定时器 / rAF 登记在这里,destroy 一次全收
// ---------------------------------------------------------------------------

/**
 * 挂载层用它登记「要收掉的东西」。
 * 只做登记与回收,不认识 DOM,所以单测能直接数「还剩几件没收」。
 */
export class Disposer {
  private jobs: Array<() => void> = [];
  private done = false;

  add(fn: () => void): void {
    if (this.done) {
      fn();
      return;
    }
    this.jobs.push(fn);
  }

  /** 还剩几件没收(destroy 后必须是 0) */
  get size(): number {
    return this.jobs.length;
  }

  get disposed(): boolean {
    return this.done;
  }

  dispose(): void {
    this.done = true;
    while (this.jobs.length > 0) {
      const fn = this.jobs.pop();
      try {
        fn?.();
      } catch (err) {
        console.warn("[一朵一星] 冒险小王 探索层清理出错:", err);
      }
    }
  }
}

/** 无尽古堡第 n 间的名字 */
export function castleRoomTitle(room: number, tpl: RoomTemplate): string {
  return `第 ${Math.max(1, Math.round(room))} 间 · ${tpl.emoji} ${tpl.name}`;
}

/** 走完 n 间之后的一句话(只鼓励) */
export function castleLine(rooms: number, best: number): string {
  if (rooms <= 0) return "古堡的第一间房就够绕的,回头再来一趟,你会认得路的!";
  if (rooms > best) return `新纪录!你在古堡里连走了 ${rooms} 间房!`;
  return `这趟走了 ${rooms} 间房,最好纪录是 ${best} 间。卡住就按「复位本间」,一次不扣星。`;
}
