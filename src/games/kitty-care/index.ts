import { meta } from "./meta";
export { meta };

import {
  chapterOf,
  furthestPlayable,
  loadSkips,
  loadStars,
  mountLevelGame,
  TOTAL_LEVELS,
  type GameApi,
  type PlayCtx,
  type PlayHandle
} from "../level99";
import { save } from "../../engine/save";
import guide from "./guide";
import { Arena, type TaskSpec } from "./arena";
import { catForTask, CHAPTERS, LEVELS, type KittyLevel } from "./levels";
import { finalStars } from "./cat";
import { styleSlotCount } from "./tasks";
import {
  ALBUM_PIECES,
  ALBUM_TOTAL,
  AlbumStore,
  HOME_SPOTS,
  SPOT_LABELS,
  claimDrop,
  shareWalletWithCollection,
  type AlbumPiece,
  type HomeSpot
} from "./album";
import { endlessClockText, endlessLine, endlessParams, endlessRound, endlessTimeout } from "./endless";
import { KTC_CSS } from "./styles";
import {
  Life,
  LIST_MIN_ROOM,
  openLevelOnMap,
  parseLevelParam,
  prefersReducedMotion,
  resolveInitialLevel,
  scrollIntoStage,
  type Loop,
  type TimerHost
} from "./runtime";

/** 相册用的星星钱包：先用平台 API，能连上收藏册就跟收藏册看同一份余额 */
let albumStore: AlbumStore | null = null;
/** 相册有没有真的接上平台收藏册（回复里要说清楚） */
export let albumSharesCollection = false;

function ensureAlbum(api: GameApi): AlbumStore {
  if (!albumStore) {
    albumStore = new AlbumStore({ getStars: () => api.getStars(), addStars: (n) => api.addStars(n) });
    // 收藏册合进来了就复用它那份余额；没合进来 / 加载失败静默降级
    void shareWalletWithCollection({ getStars: () => api.getStars(), addStars: (n) => api.addStars(n) })
      .then(({ shared }) => {
        albumSharesCollection = shared;
      })
      .catch(() => {
        albumSharesCollection = false;
      });
  }
  return albumStore;
}

const healedLevels = (): number => loadStars(meta.id).filter((n) => n > 0).length; // 只读进度：窗台摆件用

/** 小屋里现在摆着的家具（画背景用） */
function placedFurniture(store: AlbumStore): Array<{ spot: HomeSpot; emoji: string; name: string }> {
  const out: Array<{ spot: HomeSpot; emoji: string; name: string }> = [];
  for (const spot of HOME_SPOTS) {
    const piece = store.placedAt(spot);
    if (piece) out.push({ spot, emoji: piece.emoji, name: piece.name });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 闯关：一关就是一串任务，全款没有任何「照顾失败」的出口
// ---------------------------------------------------------------------------

function makePlayLevel(
  api: GameApi,
  /** 通关掉了一件收藏就喊一声，好让模式条上的相册计数当场跟上 */
  onAlbumChange: () => void = () => {}
): (stage: HTMLElement, ctx: PlayCtx) => PlayHandle {
  return function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
    const cfg: KittyLevel = LEVELS[ctx.level];
    const life = new Life();
    const store = ensureAlbum(api);
    const catCount = Math.max(1, Math.min(3, cfg.cats ?? 1));
    const arena = new Arena(stage, {
      life,
      sfx: (name) => ctx.sfx(name),
      catCount,
      moodStart: cfg.moodStart ?? 0,
      moodMax: cfg.moodMax ?? 0,
      theme: cfg.theme,
      furniture: placedFurniture(store),
      cured: healedLevels(),
      reduceMotion: prefersReducedMotion()
    });

    let taskIdx = 0;
    let ended = false;

    const specFor = (i: number): TaskSpec => ({
      task: cfg.tasks[i],
      target: catForTask(i, catCount),
      seed: ctx.level * 131 + i * 17 + 23,
      options: cfg.options,
      playTaps: cfg.playTaps,
      notes: cfg.notes,
      cureSteps: cfg.cureSteps ?? 2,
      styleSlots: styleSlotCount(cfg.styleSlots),
      washCols: 6,
      washRows: Math.min(7, 5 + Math.floor(cfg.washSpots / 6))
    });

    const step = (): void => {
      if (ended) return;
      arena.setTaskBar(cfg.tasks, taskIdx, catCount, (i) => catForTask(i, catCount));
      if (catCount > 1) arena.selected = catForTask(taskIdx, catCount);
      arena.startTask(specFor(taskIdx), () => {
        taskIdx++;
        if (taskIdx < cfg.tasks.length) {
          step();
          return;
        }
        ended = true;
        arena.setTaskBar(cfg.tasks, taskIdx, catCount, (i) => catForTask(i, catCount));
        const got = finalStars(arena.mistakes, arena.starCap());
        const gift = claimDrop(store, ctx.level, onAlbumChange);
        life.after(() => {
          if (!ended) return;
          ctx.win(
            got,
            arena.mistakes === 0
              ? `每一件都照顾得妥妥当当，小猫打起了呼噜！\n${gift}`
              : `今天的事情全部做完啦，小猫舒服地眯起了眼。\n${gift}`
          );
        }, 500);
      });
    };

    step();

    return {
      destroy() {
        ended = true;
        life.destroy();
        arena.destroy();
      }
    };
  };
}

// ---------------------------------------------------------------------------
// 无尽：照顾马拉松（超时只是这一轮不计分，没有失败结局）
// ---------------------------------------------------------------------------

export function mountEndless(
  host: HTMLElement,
  api: GameApi,
  onBack: () => void,
  timers?: TimerHost
): { destroy: () => void } {
  const life = timers ? new Life(timers) : new Life();
  const store = ensureAlbum(api);
  const wrap = document.createElement("div");
  const bar = document.createElement("div");
  bar.className = "ktc-tools";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "ktc-mini";
  back.textContent = "◀ 回选关";
  const chip = document.createElement("span");
  chip.className = "ktc-badge";
  bar.append(back, chip);
  const stageHost = document.createElement("div");
  wrap.append(bar, stageHost);
  host.appendChild(wrap);

  let round = 1;
  let done = 0;
  let best = save.getGameProgress(meta.id).endlessBest;
  let arena: Arena | null = null;
  let dead = false;
  let left = 0;
  /**
   * 这一轮的秒表。整个马拉松**同一时刻只许有一个**——
   * 早先每开一轮都挂一个新的、旧的又没人停，第 N 轮就有 N 个在减同一个 `left`，
   * 倒计时快 N 倍。所以换轮、超时、拆场三个出口都要先把它停掉。
   */
  let clock: Loop | null = null;

  const stopClock = (): void => {
    clock?.stop();
    clock = null;
  };

  life.on(back, "click", () => {
    api.play("tap");
    onBack();
  });

  const startRound = (): void => {
    if (dead) return;
    stopClock();
    arena?.destroy();
    stageHost.textContent = "";
    const cfg = endlessRound(round);
    const params = endlessParams(cfg);
    left = cfg.timeSec;
    chip.textContent = `♾️ 第 ${round} 轮 · 做好 ${done} 件 · 最好 ${best} 件`;
    arena = new Arena(stageHost, {
      life,
      sfx: (name) => api.play(name),
      catCount: cfg.cats,
      moodStart: 0,
      moodMax: 0,
      theme: 6 + (round % 4),
      furniture: placedFurniture(store), cured: healedLevels(),
      reduceMotion: prefersReducedMotion()
    });
    const target = (round - 1) % cfg.cats;
    arena.selected = target;
    const paint = (): void => {
      arena?.setBadges([
        { text: endlessClockText(left), state: "clock" },
        { text: `已经照顾好 ${done} 件事` },
        { text: `最好 ${best} 件` }
      ]);
    };
    paint();
    arena.startTask(
      {
        task: cfg.task,
        target,
        seed: round * 191 + 37,
        options: cfg.options,
        playTaps: params.playTaps,
        notes: params.notes,
        cureSteps: params.cureSteps,
        styleSlots: styleSlotCount(params.styleSlots),
        washCols: 6,
        washRows: Math.min(7, Math.floor(params.washCells / 2) + 2)
      },
      () => {
        done++;
        best = save.recordEndlessBest(meta.id, done);
        api.addStars(1);
        round++;
        stopClock();
        life.after(startRound, 500);
      }
    );
    clock = life.every(() => {
      if (dead) return;
      left--;
      if (left > 0) {
        paint();
        return;
      }
      // 超时：不是失败，这一轮不计分，直接换下一件事
      left = 0;
      stopClock();
      paint();
      const skip = endlessTimeout(cfg);
      round = skip.nextIndex;
      arena?.say(skip.note);
      best = save.recordEndlessBest(meta.id, done);
      life.after(startRound, 600);
    }, 1000);
  };

  startRound();

  return {
    destroy() {
      dead = true;
      stopClock();
      save.recordEndlessBest(meta.id, done);
      life.destroy();
      arena?.destroy();
      arena = null;
      wrap.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 小屋相册：24 件收藏 + 四个位置摆家具
// ---------------------------------------------------------------------------

function mountAlbum(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const life = new Life();
  const store = ensureAlbum(api);
  const wrap = document.createElement("div");
  wrap.className = "ktc-album";
  host.appendChild(wrap);
  /** 卡片那一格自己的滚动条；每次重画都换一块新的 grid，所以要跟着换 */
  let gridFit: { relayout: () => void; dispose: () => void } | null = null;

  const draw = (): void => {
    wrap.textContent = "";
    const head = document.createElement("div");
    head.className = "ktc-albumhead";
    const back = document.createElement("button");
    back.type = "button";
    back.className = "ktc-mini";
    back.textContent = "◀ 回选关";
    life.on(back, "click", () => {
      api.play("tap");
      onBack();
    });
    const count = document.createElement("span");
    count.className = "ktc-badge";
    count.textContent = `📷 ${store.count()}/${ALBUM_TOTAL} 件 · ⭐ ${store.stars()}`;
    head.append(back, count);
    wrap.appendChild(head);

    const room = document.createElement("div");
    room.className = "ktc-tools";
    for (const spot of HOME_SPOTS) {
      const piece = store.placedAt(spot);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ktc-mini";
      b.textContent = piece ? `${SPOT_LABELS[spot]}：${piece.emoji} ${piece.name}` : `${SPOT_LABELS[spot]}：空着`;
      life.on(b, "click", () => {
        if (piece) {
          store.clearSpot(spot);
          api.play("tap");
          draw();
        }
      });
      room.appendChild(b);
    }
    wrap.appendChild(room);

    const hint = document.createElement("div");
    hint.className = "ktc-msg";
    hint.textContent = "每通一关都会收到一件新收藏；想早点拿某一件，也可以用小星星换。";
    wrap.appendChild(hint);

    const grid = document.createElement("div");
    grid.className = "ktc-grid";
    for (const piece of ALBUM_PIECES) {
      grid.appendChild(card(piece));
    }
    wrap.appendChild(grid);
    // 24 件一共 2809px，舞台只给 530–730px，而这一层原先没有任何可滚祖先，
    // 后面 20–22 颗「⭐N 换回来」永远点不着（W5R2-C-03）。
    // 只钳这一格：上面的「◀ 回选关」、四个位置、说明行钉着不动，翻的只有卡片。
    // 矮横屏上卡片格自己连 44px 都挤不出来，那一档退一层让整块板子滚（W5R3-CF-01）
    gridFit?.dispose();
    gridFit = scrollIntoStage(grid, LIST_MIN_ROOM, wrap);
  };

  const card = (piece: AlbumPiece): HTMLElement => {
    const owned = store.has(piece.id);
    const box = document.createElement("div");
    box.className = `ktc-card${owned ? "" : " ktc-locked"}`;
    const thumb = document.createElement("div");
    thumb.className = "ktc-thumb";
    thumb.textContent = owned ? piece.emoji : "❔";
    const name = document.createElement("div");
    name.className = "ktc-cardname";
    name.textContent = owned ? piece.name : "还没收到";
    const note = document.createElement("div");
    note.className = "ktc-cardnote";
    note.textContent = owned ? piece.blurb : `${piece.kind === "photo" ? "照片" : "家具"} · ⭐ ${piece.cost} 可换`;
    box.append(thumb, name, note);
    const action = document.createElement("button");
    action.type = "button";
    action.className = "ktc-mini";
    if (!owned) {
      action.textContent = `⭐ ${piece.cost} 换回来`;
      life.on(action, "click", () => {
        const res = store.buy(piece.id);
        api.play(res.ok ? "coin" : "oops");
        if (!res.ok && res.reason === "poor") {
          note.textContent = `还差 ${piece.cost - res.stars} 颗小星星——多通几关也会自己送上门。`;
          return;
        }
        draw();
      });
      box.appendChild(action);
    } else if (piece.kind === "furniture" && piece.spot) {
      const spot = piece.spot;
      const here = store.placedAt(spot)?.id === piece.id;
      action.textContent = here ? `已经摆在${SPOT_LABELS[spot]}` : `摆到${SPOT_LABELS[spot]}`;
      life.on(action, "click", () => {
        if (here) store.clearSpot(spot);
        else store.place(piece.id, spot);
        api.play("tap");
        draw();
      });
      box.appendChild(action);
    }
    return box;
  };

  draw();

  return {
    destroy() {
      gridFit?.dispose();
      gridFit = null;
      life.destroy();
      wrap.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 挂载：模式条 + 188 关地图 + 直开第 N 关
// ---------------------------------------------------------------------------

/** 壳层给的 `initialLevel`（1 基），没有就看地址栏的 `?level=N` */
function wantedLevel(api: GameApi): unknown {
  const given = (api as { initialLevel?: unknown }).initialLevel;
  if (given !== undefined && given !== null) return given;
  const loc = (globalThis as { location?: { search?: string; hash?: string } }).location;
  if (!loc) return undefined;
  return parseLevelParam(loc.search ?? "") ?? parseLevelParam(loc.hash ?? "") ?? undefined;
}

/** 当前挂载着的那一局的「直开第 N 关」入口（没挂载就是 null） */
let opener: ((level1: number) => boolean) | null = null;

/**
 * 平台侧直开第 N 关（1 基）。`level99.ts` 只读、没开这个口子，
 * 所以实现是「替玩家在地图上点一下」；没挂载或关卡还锁着就返回 false。
 */
export function openCampaignLevel(level: number): boolean {
  return opener ? opener(level) : false;
}

export function mount(api: GameApi): { destroy: () => void } {
  const life = new Life();
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = KTC_CSS;
  const bar = document.createElement("div");
  bar.className = "ktc-tools";
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const store = ensureAlbum(api);
  const endlessBtn = document.createElement("button");
  endlessBtn.type = "button";
  endlessBtn.className = "ktc-mini ktc-primary";
  const albumBtn = document.createElement("button");
  albumBtn.type = "button";
  albumBtn.className = "ktc-mini";
  bar.append(endlessBtn, albumBtn);

  let mode: { destroy: () => void } | null = null;

  const refreshBar = (): void => {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 照顾马拉松 · 最好 ${best} 件` : "♾️ 照顾马拉松 · 点我开始！";
    albumBtn.textContent = `📷 小屋相册 ${store.count()}/${ALBUM_TOTAL}`;
  };

  /** 关卡正在跑没有：♾️ / 📷 两个入口靠它挡住，别把关卡层只藏不销毁（W5R2-C-06） */
  let inLevel = false;

  const closeMode = (): void => {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBar();
  };

  const openMode = (make: (host: HTMLElement) => { destroy: () => void }): void => {
    if (mode) return;
    // 关卡正在跑就不许再开一层。`bar.hidden` 只是让手指够不着，焦点残留、
    // 壳层补发的 click、自动化脚本照样能把它点响 —— 点响了关卡层就只被 hidden 藏起来，
    // 两条 requestAnimationFrame 与两套定时器一起跑到天荒地老（W5R2-C-06）。
    if (inLevel) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    mode = make(modeHost);
  };

  life.on(endlessBtn, "click", () => openMode((host) => mountEndless(host, api, closeMode)));
  life.on(albumBtn, "click", () => openMode((host) => mountAlbum(host, api, closeMode)));
  refreshBar();

  const runLevel = makePlayLevel(api, refreshBar);

  const game = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      // 真下到某一关里就把这两个入口收起来：360px 宽上它俩排不下、要折成两行，
      // 连同外边距占掉 104px。关内不需要这两个入口（回地图就有），
      // 而且关卡进行中点得着 ♾️ 的话，关卡层只被 hidden 藏起来、不销毁（W5R2-C-06）。
      // 先收再摆：fitIntoStage() 是在 playLevel 里量的，量早了这 104px 没人认领。
      playLevel: (stage, ctx) => {
        bar.hidden = true;
        inLevel = true;
        const handle = runLevel(stage, ctx);
        return {
          destroy: () => {
            inLevel = false;
            handle?.destroy?.();
            // 马拉松 / 相册开着的时候这一条本来就该收着，别替它放回来
            if (!mode) bar.hidden = false;
          }
        };
      },
      guide,
      mapHint: "看清楚它想要什么再动手，一次都不做岔就是 3 星～",
      grandMessage: "188 天的照顾全部完成，小屋里到处都是你们的照片！"
    }
  );

  const open = (level1: number): boolean => {
    const target = resolveInitialLevel(
      level1,
      furthestPlayable(loadStars(meta.id), loadSkips(meta.id), TOTAL_LEVELS),
      TOTAL_LEVELS
    );
    if (target === null) return false;
    if (mode) closeMode();
    try {
      return openLevelOnMap(levelHost, target, chapterOf(CHAPTERS, target));
    } catch (err) {
      console.warn("[一朵一星] kitty-care 直开关卡失败，停在地图上:", err);
      return false;
    }
  };
  opener = open;

  const wanted = wantedLevel(api);
  if (wanted !== undefined && wanted !== null) open(Number(wanted));

  return {
    destroy() {
      if (opener === open) opener = null;
      mode?.destroy();
      mode = null;
      life.destroy();
      game.destroy();
      root.remove();
    }
  };
}
