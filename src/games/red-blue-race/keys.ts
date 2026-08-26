/**
 * 红蓝赛跑 · 1.2 两套键位(纯逻辑 + 一个可测的绑定器)。
 *
 * 全站双人键位约定:朵朵 `WASD` + `F` / `G`,星星 `方向键` + `L` / `K`。
 * 本款把「左右交替跑」落在两个横向键上,跳落在上方键上:
 *
 *  · 朵朵(红道):`A` 左脚 / `D` 右脚 / `W`、`F`、`G` 跳;
 *  · 星星(蓝道):`←` 左脚 / `→` 右脚 / `↑`、`L`、`K` 跳。
 *
 * 单人模式下两套键都开给同一个人(有人习惯方向键,有人习惯 A/D),
 * 空格也当跳;双人模式下各管各的,一个键不许串到对面那条道去。
 *
 * `bindRaceKeys` 把两套键位挂成**两个独立监听**,返回的卸载函数一次全卸干净
 * ——「`destroy` 时两套键位全卸」这条规格就靠它写断言。
 */

/** 哪条道:红=朵朵,蓝=星星 */
export type Racer = "red" | "blue";

/** 一次按键落到什么动作上 */
export type RaceAction = "left" | "right" | "jump";

export interface RaceKeyHit {
  racer: Racer;
  action: RaceAction;
}

/** 朵朵(红道)的键位 */
export const RED_KEYS: Readonly<Record<string, RaceAction>> = {
  a: "left",
  d: "right",
  w: "jump",
  f: "jump",
  g: "jump"
};

/** 星星(蓝道)的键位 */
export const BLUE_KEYS: Readonly<Record<string, RaceAction>> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "jump",
  l: "jump",
  k: "jump"
};

/** 单人时额外开的键:空格也是跳 */
export const SOLO_EXTRA_KEYS: Readonly<Record<string, RaceAction>> = { " ": "jump" };

/** 方向键之外的字母键一律按小写比对,免得开着大写锁就按不动 */
function normalize(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key;
}

/** 查一套键位表 */
function lookup(table: Readonly<Record<string, RaceAction>>, key: string): RaceAction | null {
  return table[normalize(key)] ?? null;
}

/**
 * 这个键落到谁身上、做什么。
 * `duo` 为 true 时两套键位各管一条道;为 false 时两套键位都归红道(单人)。
 */
export function resolveRaceKey(key: string, duo: boolean): RaceKeyHit | null {
  if (typeof key !== "string" || key === "") return null;
  const red = lookup(RED_KEYS, key);
  if (red) return { racer: "red", action: red };
  const blue = lookup(BLUE_KEYS, key);
  if (blue) return { racer: duo ? "blue" : "red", action: blue };
  if (!duo) {
    const extra = lookup(SOLO_EXTRA_KEYS, key);
    if (extra) return { racer: "red", action: extra };
  }
  return null;
}

/** 绑定器只认这一点点事件形状,测试拿普通对象就能驱动 */
export interface RaceKeyEvent {
  key: string;
  preventDefault?: () => void;
}

export interface KeyHost {
  addEventListener(type: "keydown", handler: (ev: RaceKeyEvent) => void): void;
  removeEventListener(type: "keydown", handler: (ev: RaceKeyEvent) => void): void;
}

/**
 * 把两套键位挂到 host 上(红一套、蓝一套,两个独立监听)。
 * 返回的函数把两个监听一起摘掉,重复调用也安全。
 */
export function bindRaceKeys(
  host: KeyHost,
  duo: boolean,
  onHit: (hit: RaceKeyHit, ev: RaceKeyEvent) => void
): () => void {
  const handlers: Array<(ev: RaceKeyEvent) => void> = [];

  const make = (own: Racer) => (ev: RaceKeyEvent) => {
    const hit = resolveRaceKey(ev?.key ?? "", duo);
    if (!hit || hit.racer !== own) return;
    ev.preventDefault?.();
    onHit(hit, ev);
  };

  // 红蓝各一套:单人时蓝那套解析出来也是红道,所以这个监听自然就不响
  handlers.push(make("red"), make("blue"));
  for (const h of handlers) host.addEventListener("keydown", h);

  let off = false;
  return () => {
    if (off) return;
    off = true;
    for (const h of handlers) host.removeEventListener("keydown", h);
    handlers.length = 0;
  };
}
