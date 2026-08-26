/**
 * 萌猫小屋 · 小屋相册（1.2 新增的跨关卡长线养成）。
 *
 * 24 件收藏：12 张团团和室友的照片 + 12 件小屋家具。两条获得途径，**都不是抽卡**：
 *  1. 通关掉落：每通一关，从「还没拿到的」里面按关号取一件送给你——不会重复、不会落空；
 *  2. 星星解锁：想早点拿某一件，就花平台那份现成的小星星直接解锁。
 * 没有第二种货币、没有卡池、没有内购、没有广告。
 *
 * 存档自己开一个 key（`yiduo-yixing.kitty-care.album.v1`），
 * 与关卡进度 `yiduo-yixing.l99.kitty-care` 完全分开，两个 key 都走 `yiduo-yixing.` 前缀。
 */
import { mulberry32 } from "../level99";

/** 相册自己的存档 key（只增不改，老 key 一个都不碰） */
export const ALBUM_KEY = "yiduo-yixing.kitty-care.album.v1";

/** 家具能摆的四个位置 */
export const HOME_SPOTS = ["window", "corner", "wall", "floor"] as const;
export type HomeSpot = (typeof HOME_SPOTS)[number];

export const SPOT_LABELS: Record<HomeSpot, string> = {
  window: "窗台",
  corner: "角落",
  wall: "墙上",
  floor: "地板"
};

export type PieceKind = "photo" | "furniture";

export interface AlbumPiece {
  id: string;
  kind: PieceKind;
  name: string;
  emoji: string;
  /** 一句话说明（照片写当时发生了什么，家具写它有什么用） */
  blurb: string;
  /** 直接解锁要花多少小星星（通关掉落是白送的） */
  cost: number;
  /** 家具该摆在哪个位置；照片没有这一项 */
  spot?: HomeSpot;
}

/** 12 张照片：全是本作原创角色团团 / 糯糯 / 煤球的日常，一个商标都不沾 */
const PHOTOS: readonly AlbumPiece[] = [
  { id: "p-first-day", kind: "photo", name: "第一天", emoji: "📷", cost: 8, blurb: "团团刚来小屋，缩在纸箱口只露出一只耳朵。" },
  { id: "p-yarn", kind: "photo", name: "毛线球大战", emoji: "🧶", cost: 10, blurb: "一整团毛线被滚到桌子底下，它自己也钻不出来了。" },
  { id: "p-sunbath", kind: "photo", name: "晒太阳", emoji: "☀️", cost: 12, blurb: "窗台上摊成一张饼，尾巴尖还在一动一动。" },
  { id: "p-bubble", kind: "photo", name: "泡泡帽子", emoji: "🫧", cost: 14, blurb: "洗澡搓出来的泡泡正好堆成一顶帽子。" },
  { id: "p-nap", kind: "photo", name: "午觉时间", emoji: "😴", cost: 16, blurb: "四只爪子朝天，睡得一点防备都没有。" },
  { id: "p-two-cats", kind: "photo", name: "新室友", emoji: "🐾", cost: 18, blurb: "糯糯搬进来的第一晚，两只猫隔着一个枕头对视。" },
  { id: "p-birthday", kind: "photo", name: "生日帽", emoji: "🎂", cost: 20, blurb: "戴生日帽的三秒钟，剩下的时间都在跟帽子较劲。" },
  { id: "p-rainy", kind: "photo", name: "看雨", emoji: "🌧️", cost: 22, blurb: "趴在窗边盯着雨点，一盯就是一下午。" },
  { id: "p-box", kind: "photo", name: "纸箱专属座", emoji: "📦", cost: 24, blurb: "买的猫窝不睡，偏要挤在装猫窝的纸箱里。" },
  { id: "p-catnip", kind: "photo", name: "薄荷时间", emoji: "🌿", cost: 26, blurb: "闻到猫薄荷之后原地打了七个滚。" },
  { id: "p-trio", kind: "photo", name: "三只一排", emoji: "🐱", cost: 28, blurb: "团团、糯糯、煤球排成一排等开饭，队形整齐得离谱。" },
  { id: "p-starry", kind: "photo", name: "看星星", emoji: "🌟", cost: 30, blurb: "夜里陪你坐在窗台，一起看外面那颗最亮的星星。" }
];

/** 12 件家具：摆进小屋就能看见 */
const FURNITURE: readonly AlbumPiece[] = [
  { id: "f-cushion", kind: "furniture", name: "圆坐垫", emoji: "🟡", cost: 12, spot: "floor", blurb: "软乎乎的圆垫子，谁先到谁躺。" },
  { id: "f-bowl", kind: "furniture", name: "陶瓷饭碗", emoji: "🥣", cost: 14, spot: "floor", blurb: "碗沿宽，吃起来胡子不会沾到饭。" },
  { id: "f-fountain", kind: "furniture", name: "小水泉", emoji: "⛲", cost: 16, spot: "corner", blurb: "水一直在流，猫比谁都爱喝流动的水。" },
  { id: "f-scratch", kind: "furniture", name: "剑麻猫抓柱", emoji: "🪵", cost: 18, spot: "corner", blurb: "有它以后，沙发终于活下来了。" },
  { id: "f-basket", kind: "furniture", name: "藤编小篮", emoji: "🧺", cost: 20, spot: "floor", blurb: "冬天铺条毯子，就是一张床。" },
  { id: "f-perch", kind: "furniture", name: "窗台吊床", emoji: "🛖", cost: 22, spot: "window", blurb: "挂在玻璃上，晒太阳的头等座。" },
  { id: "f-plant", kind: "furniture", name: "猫草盆栽", emoji: "🪴", cost: 24, spot: "window", blurb: "专门种给猫啃的草，啃秃了会自己长回来。" },
  { id: "f-lamp", kind: "furniture", name: "暖光小灯", emoji: "🪔", cost: 26, spot: "corner", blurb: "夜里留一盏，谁醒了都不会撞到桌角。" },
  { id: "f-shelf", kind: "furniture", name: "跳台木架", emoji: "🪜", cost: 28, spot: "wall", blurb: "三级台阶通到最高处，站得越高越神气。" },
  { id: "f-frame", kind: "furniture", name: "照片墙", emoji: "🖼️", cost: 30, spot: "wall", blurb: "把相册里的照片挂上去，一整面墙都是它。" },
  { id: "f-curtain", kind: "furniture", name: "星星窗帘", emoji: "🌠", cost: 32, spot: "window", blurb: "拉上以后，光斑落在地板上像一地小星星。" },
  { id: "f-clock", kind: "furniture", name: "小猫挂钟", emoji: "🕰️", cost: 34, spot: "wall", blurb: "钟摆是一条会晃的尾巴，看时间的猫也跟着晃。" }
];

/** 全部 24 件，顺序固定：照片在前，家具在后 */
export const ALBUM_PIECES: readonly AlbumPiece[] = [...PHOTOS, ...FURNITURE];

/** 相册一共几件（1.2 规格：24） */
export const ALBUM_TOTAL = ALBUM_PIECES.length;

const BY_ID = new Map<string, AlbumPiece>(ALBUM_PIECES.map((p) => [p.id, p]));

export function pieceById(id: string): AlbumPiece | null {
  return BY_ID.get(id) ?? null;
}

// ---------------------------------------------------------------------------
// 存档数据
// ---------------------------------------------------------------------------

export interface AlbumData {
  /** 已经拿到的 id（按图鉴顺序去重） */
  unlocked: string[];
  /** 位置 → 摆在那儿的家具 id */
  placed: Partial<Record<HomeSpot, string>>;
}

export function emptyAlbum(): AlbumData {
  return { unlocked: [], placed: {} };
}

/** 坏数据一律降级：认不出的 id、摆错位置的家具、照片当家具摆，全部丢掉 */
export function sanitizeAlbum(raw: unknown): AlbumData {
  const data = emptyAlbum();
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return data;
  const obj = raw as Record<string, unknown>;
  const seen = new Set<string>();
  if (Array.isArray(obj.unlocked)) {
    for (const v of obj.unlocked as unknown[]) {
      if (typeof v !== "string" || !BY_ID.has(v) || seen.has(v)) continue;
      seen.add(v);
    }
  }
  data.unlocked = ALBUM_PIECES.filter((p) => seen.has(p.id)).map((p) => p.id);
  const placed = obj.placed;
  if (typeof placed === "object" && placed !== null && !Array.isArray(placed)) {
    for (const spot of HOME_SPOTS) {
      const id = (placed as Record<string, unknown>)[spot];
      if (typeof id !== "string") continue;
      const piece = BY_ID.get(id);
      if (!piece || piece.kind !== "furniture" || piece.spot !== spot) continue;
      if (!seen.has(id)) continue;
      data.placed[spot] = id;
    }
  }
  return data;
}

/** 写成稳定文本（同一份相册永远得到同一段文字） */
export function serializeAlbum(data: AlbumData): string {
  const unlocked = ALBUM_PIECES.filter((p) => data.unlocked.includes(p.id)).map((p) => p.id);
  const placed: Record<string, string> = {};
  for (const spot of HOME_SPOTS) {
    const id = data.placed[spot];
    if (typeof id === "string") placed[spot] = id;
  }
  return JSON.stringify({ v: 1, unlocked, placed });
}

export function parseAlbum(text: string | null | undefined): AlbumData {
  if (!text) return emptyAlbum();
  try {
    return sanitizeAlbum(JSON.parse(text) as unknown);
  } catch {
    return emptyAlbum();
  }
}

// ---------------------------------------------------------------------------
// 掉落与解锁（都不是抽卡）
// ---------------------------------------------------------------------------

/**
 * 通关掉落：**只从还没拿到的里面挑**，所以永远不会重复、也永远不会落空。
 * 挑哪一件由关号决定（同一关重复通关拿到的是同一件），24 件收齐后返回 null。
 */
export function nextDrop(unlocked: readonly string[], seed: number): AlbumPiece | null {
  const owned = new Set(unlocked);
  const locked = ALBUM_PIECES.filter((p) => !owned.has(p.id));
  if (locked.length === 0) return null;
  const rand = mulberry32(Math.floor(seed) * 97 + 13);
  return locked[Math.floor(rand() * locked.length) % locked.length];
}

/** 解锁一件要花多少小星星 */
export function unlockCost(piece: AlbumPiece): number {
  return Math.max(0, Math.round(piece.cost));
}

/** 星星钱包（平台那份现成的余额；单测塞个假的进来就行） */
export interface Wallet {
  getStars(): number;
  addStars(n: number): number;
}

export type BuyReason = "ok" | "unknown" | "owned" | "poor";

export interface BuyResult {
  ok: boolean;
  reason: BuyReason;
  /** 花掉的星星（没成交就是 0；除了星星不会消耗任何别的东西） */
  spent: number;
  stars: number;
}

// ---------------------------------------------------------------------------
// 相册仓库
// ---------------------------------------------------------------------------

export interface AlbumStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function memoryStorage(): AlbumStorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    }
  };
}

/** 隐私模式下 localStorage 会抛异常，探一次不行就退回内存（这一局照样能收集） */
function pickStorage(): AlbumStorageLike {
  try {
    const ls = (globalThis as { localStorage?: AlbumStorageLike }).localStorage;
    if (ls) {
      const probe = "yiduo-yixing.kitty-care.album.probe";
      ls.setItem(probe, "1");
      (ls as { removeItem?: (k: string) => void }).removeItem?.(probe);
      return ls;
    }
  } catch {
    // 落到内存
  }
  return memoryStorage();
}

export class AlbumStore {
  private data: AlbumData;

  constructor(
    private readonly wallet: Wallet,
    private readonly storage: AlbumStorageLike = pickStorage()
  ) {
    this.data = this.load();
  }

  private load(): AlbumData {
    try {
      return parseAlbum(this.storage.getItem(ALBUM_KEY));
    } catch {
      return emptyAlbum();
    }
  }

  private persist(): void {
    try {
      this.storage.setItem(ALBUM_KEY, serializeAlbum(this.data));
    } catch {
      // 存不进去也不影响这一局
    }
  }

  snapshot(): AlbumData {
    return { unlocked: [...this.data.unlocked], placed: { ...this.data.placed } };
  }

  has(id: string): boolean {
    return this.data.unlocked.includes(id);
  }

  count(): number {
    return this.data.unlocked.length;
  }

  stars(): number {
    try {
      return Math.max(0, Math.floor(this.wallet.getStars()));
    } catch {
      return 0;
    }
  }

  private add(id: string): void {
    if (this.data.unlocked.includes(id)) return;
    this.data.unlocked = ALBUM_PIECES.filter((p) => p.id === id || this.data.unlocked.includes(p.id)).map((p) => p.id);
  }

  /** 通关掉落：白送一件还没拿到的（全收齐了就返回 null） */
  dropForLevel(level: number): AlbumPiece | null {
    const piece = nextDrop(this.data.unlocked, level);
    if (!piece) return null;
    this.add(piece.id);
    this.persist();
    return piece;
  }

  /** 花星星解锁一件：除了小星星不消耗任何东西，星星不够就原样返回 */
  buy(id: string): BuyResult {
    const piece = pieceById(id);
    if (!piece) return { ok: false, reason: "unknown", spent: 0, stars: this.stars() };
    if (this.has(id)) return { ok: false, reason: "owned", spent: 0, stars: this.stars() };
    const cost = unlockCost(piece);
    if (this.stars() < cost) return { ok: false, reason: "poor", spent: 0, stars: this.stars() };
    if (cost > 0) this.wallet.addStars(-cost);
    this.add(id);
    this.persist();
    return { ok: true, reason: "ok", spent: cost, stars: this.stars() };
  }

  /** 把家具摆到它该在的位置（同一个位置只站一件；照片摆不上去） */
  place(id: string, spot: HomeSpot): boolean {
    const piece = pieceById(id);
    if (!piece || piece.kind !== "furniture" || piece.spot !== spot || !this.has(id)) return false;
    if (this.data.placed[spot] === id) return true;
    this.data.placed[spot] = id;
    this.persist();
    return true;
  }

  /** 收起某个位置的家具 */
  clearSpot(spot: HomeSpot): boolean {
    if (!this.data.placed[spot]) return false;
    delete this.data.placed[spot];
    this.persist();
    return true;
  }

  placedAt(spot: HomeSpot): AlbumPiece | null {
    const id = this.data.placed[spot];
    return id ? pieceById(id) : null;
  }
}

// ---------------------------------------------------------------------------
// 平台收藏册：有就复用，没有就降级
// ---------------------------------------------------------------------------

export interface SharedWallet {
  wallet: Wallet;
  /** 真的接上了平台收藏册的那份余额 */
  shared: boolean;
}

/**
 * 平台的收藏册（`src/engine/collection.ts`）是一本「人物 / 宠物 / 装备」的固定图鉴，
 * 装不下本款这 24 件小屋收藏，而它是只读的公共文件、不许改。
 * 于是这里只复用它**最该共用的那一样：星星余额**——
 * 动态 import 拿到 `collection.stars()`，相册看到的余额和收藏册看到的就是同一个数；
 * 模块没合进来或者加载失败，就安静退回调用方给的钱包，游戏照常玩。
 */
export async function shareWalletWithCollection(fallback: Wallet): Promise<SharedWallet> {
  try {
    const mod = (await import("../../engine/collection")) as {
      collection?: { stars?: () => number };
    };
    const store = mod.collection;
    if (store && typeof store.stars === "function") {
      return {
        shared: true,
        wallet: {
          getStars: () => {
            try {
              return store.stars?.() ?? fallback.getStars();
            } catch {
              return fallback.getStars();
            }
          },
          addStars: (n) => fallback.addStars(n)
        }
      };
    }
  } catch {
    // 收藏册还没合进来：本地实现照常工作
  }
  return { shared: false, wallet: fallback };
}
