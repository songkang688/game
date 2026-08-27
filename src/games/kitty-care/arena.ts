/**
 * 萌猫小屋 · 舞台渲染（1.2 从 `index.ts` 拆出来的那一半「画」）。
 *
 * 这里只做三件事：把小屋和猫画出来、把手指的动作翻译成 `tasks.ts` 认识的参数、
 * 把算完的新状态画回去。**一条判定规则都不写在这里**——判定全在 `tasks.ts` 与 `cat.ts`。
 *
 * 闯关和无尽共用同一个舞台：无尽只是换一套参数、换一个计时条。
 */
import type { SoundName } from "../level99";
import { catSvg, HEARTS, setFace } from "./catArt";
import {
  catAfter,
  catLine,
  createCat,
  moodRatio,
  soothesLeft,
  starCap,
  type CatState
} from "./cat";
import { CAT_CREW, CURE_SAFETY_LINE, buildCureRound, buildStyleRound, moodFace, type KittyTask, type StyleItem } from "./levels";
import { SPOT_LABELS, type HomeSpot } from "./album";
import {
  ACCS,
  BEAT_WINDOW_MS,
  SNAP_RADIUS,
  WASH_TARGET,
  buildDress,
  buildFeed,
  buildPlay,
  buildSleep,
  buildWash,
  chaseHint,
  cureBack,
  cureHint,
  cureMessage,
  curePick,
  curePlan,
  cureStart,
  dressDrop,
  feedDrop,
  judgeStyleItem,
  nearestSnap,
  nextWashCell,
  playStep,
  scoreOutfit,
  scrub,
  sleepTap,
  washCellCenter,
  washCoverage,
  type SnapPoint,
  type TaskOutcome
} from "./tasks";
import { fitIntoStage, type Life, type Loop } from "./runtime";
import { kitty, type KittyState } from "../../art/kit/kittySvg";
import { sticker } from "../../art/kit/stickers";
import {
  MEOW_TEXT,
  PURR_TEXT,
  bubbleTailX,
  calicoVariantForSeed,
  confettiSpecs,
  furForSeed,
  heartBubbleSpecs,
  kittyStateFor,
  roomScene,
  splitStepText,
  stepCenterOffset,
  toolIconSvg
} from "./cureScene";

const TASK_INFO: Record<KittyTask, { icon: string; name: string }> = {
  feed: { icon: "🍽️", name: "喂饭" },
  play: { icon: "🪶", name: "逗猫" },
  wash: { icon: "🫧", name: "洗澡" },
  sleep: { icon: "🌙", name: "哄睡" },
  dress: { icon: "🎀", name: "打扮" },
  cure: { icon: "🩺", name: "看病" },
  style: { icon: "👗", name: "搭配" }
};

export const THEME_BG = [
  "linear-gradient(#ffe9f0,#fff6e4)",
  "linear-gradient(#d8f1ff,#e8fbf4)",
  "linear-gradient(#ffe9d0,#fff3e0)",
  "linear-gradient(#dfeaf8,#f0f4fb)",
  "linear-gradient(#f6e3fa,#ffeef6)",
  "linear-gradient(#4a5590,#8a7ab0)",
  "linear-gradient(#fff2dc,#ffe8f2)",
  "linear-gradient(#ffe2ef,#f6e6ff)",
  "linear-gradient(#e2f4ec,#f2fbf6)",
  "linear-gradient(#ece2ff,#fdeaf7)"
];

export interface ArenaOptions {
  life: Life;
  sfx: (name: SoundName) => void;
  catCount: number;
  moodStart: number;
  moodMax: number;
  theme: number;
  /** 已经摆进小屋的家具（相册解锁的那些） */
  furniture?: Array<{ spot: HomeSpot; emoji: string; name: string }>;
  /** 痊愈进度（已照顾好的天数，**只读**）：窗台摆件随它变多，纯装饰 */
  cured?: number;
  reduceMotion?: boolean;
}

export interface TaskSpec {
  task: KittyTask;
  /** 这一件事是给第几只猫做的 */
  target: number;
  seed: number;
  options: number;
  playTaps: number;
  notes: number;
  cureSteps: number;
  styleSlots: number;
  /** 洗澡网格（无尽会调大） */
  washCols?: number;
  washRows?: number;
}

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** 一个大按钮：上面一个 emoji，下面一行小字（小字同时当无障碍标签） */
function btn(cls: string, label: string, sub?: string): HTMLElement & { subEl?: HTMLElement } {
  const b = document.createElement("button") as HTMLElement & { subEl?: HTMLElement };
  b.className = cls;
  (b as HTMLButtonElement).type = "button";
  b.setAttribute("aria-label", sub ?? label);
  b.textContent = label;
  if (sub !== undefined) {
    const small = el("small", undefined, sub);
    b.appendChild(small);
    b.subEl = small;
  }
  return b;
}

/** 换掉按钮上的小字与无障碍标签 */
function relabel(button: HTMLElement & { subEl?: HTMLElement }, sub: string): void {
  button.setAttribute("aria-label", sub);
  if (button.subEl) button.subEl.textContent = sub;
}

/** 道具贴纸的边长（W8R1-03：喂饭/逗猫核心道具由裸 emoji 换成 kit 贴纸） */
export const PROP_PX = { food: 32, bowl: 42, toy: 30, chaser: 24, bubble: 24 } as const;

/**
 * emoji → 贴纸小节点（沿看病 `toolIconSvg` 的工序：空标签按钮 + 图标 span + 小字）。
 * 贴纸永远是纯装饰（aria-hidden），朗读内容由宿主自己的标签 / sr-only 原文负责，
 * 绝不给装饰件挂标签去和真按钮撞车；图集查不到就原样回退文本，绝不空一块。
 */
export function propIcon(emoji: string, px: number): HTMLElement {
  const span = el("span", "ktc-propicon");
  const svg = sticker(emoji, px);
  if (svg) {
    span.innerHTML = svg;
    span.setAttribute("aria-hidden", "true");
  } else {
    span.textContent = emoji;
  }
  return span;
}

function now(): number {
  const p = (globalThis as { performance?: { now?: () => number } }).performance;
  return typeof p?.now === "function" ? p.now() : Date.now();
}

/** 舞台：一间小屋、一到三只猫、一块任务区 */
export class Arena {
  readonly root: HTMLElement;
  readonly cats: CatState[];
  /** 本局一共做岔了几次（星级用） */
  mistakes = 0;
  /** 玩家现在选中的是第几只猫 */
  selected = 0;

  private readonly life: Life;
  private readonly sfx: (name: SoundName) => void;
  private readonly opts: ArenaOptions;
  private readonly topEl: HTMLElement;
  private readonly moodFill: HTMLElement | null = null;
  private readonly moodFaceEl: HTMLElement | null = null;
  private readonly bubbleEl: HTMLElement;
  private readonly planEl: HTMLElement;
  private readonly catsEl: HTMLElement;
  private readonly catEls: HTMLElement[] = [];
  private readonly playEl: HTMLElement;
  private readonly msgEl: HTMLElement;
  private readonly safetyEl: HTMLElement;
  private spec: TaskSpec | null = null;
  private onDone: (() => void) | null = null;
  private dead = false;
  /**
   * 当前这件事自己起的循环（现在只有哄睡的拍子灯）。
   * 换一件事、拆舞台都要先把它们停掉——`Life` 是整局共用的，
   * 光靠 `destroy()` 收，无尽里每跑一遍哄睡就会多留一个在那儿空转。
   */
  private readonly loops: Loop[] = [];
  /** 把小屋钳进舞台看得见的那一段；矮屏上够不着饭碗就是没接这根线 */
  private fit: { relayout: () => void; dispose: () => void } | null = null;

  constructor(host: HTMLElement, opts: ArenaOptions) {
    this.opts = opts;
    this.life = opts.life;
    this.sfx = opts.sfx;
    const count = Math.max(1, Math.min(CAT_CREW.length, Math.floor(opts.catCount)));
    this.cats = Array.from({ length: count }, (_, i) => createCat(CAT_CREW[i].name, opts.moodStart, opts.moodMax));

    this.root = el("div", `ktc-wrap${opts.theme === 5 ? " ktc-night" : ""}`);
    this.root.style.background = THEME_BG[opts.theme] ?? THEME_BG[0];

    const room = el("div", "ktc-room");
    // 小屋场景（1.3）：窗 + 阳光斜带 + 相框 + 猫爬架剪影 + 地毯 + 猫窝，
    // 窗台摆件随痊愈进度变多（进度只读）。整层不接指针，家具 emoji 叠在它上面。
    const scene = el("div", "ktc-scene");
    scene.innerHTML = roomScene(Math.max(0, Math.floor(opts.cured ?? 0)));
    room.appendChild(scene);
    for (const item of opts.furniture ?? []) {
      const spot = el("span", `ktc-room-spot ktc-room-${item.spot}`, item.emoji);
      spot.setAttribute("aria-label", `${SPOT_LABELS[item.spot]}的${item.name}`);
      room.appendChild(spot);
    }
    this.root.appendChild(room);

    this.topEl = el("div", "ktc-top");
    this.root.appendChild(this.topEl);

    if (opts.moodMax > 0) {
      const mood = el("div", "ktc-mood");
      mood.appendChild(el("span", undefined, "💗"));
      const bar = el("div", "ktc-moodbar");
      this.moodFill = el("div", "ktc-moodfill");
      bar.appendChild(this.moodFill);
      mood.appendChild(bar);
      this.moodFaceEl = el("span", "ktc-moodface", "😻");
      mood.appendChild(this.moodFaceEl);
      this.root.appendChild(mood);
    }

    this.bubbleEl = el("div", "ktc-bubble");
    this.planEl = el("div", "ktc-plan");
    this.planEl.hidden = true;
    this.catsEl = el("div", "ktc-cats");
    this.playEl = el("div", "ktc-play");
    this.msgEl = el("div", "ktc-msg", count > 1 ? "先点一只猫选中它，再照顾它～" : "团团在等你照顾它～");
    this.safetyEl = el("div", "ktc-safety", CURE_SAFETY_LINE);
    this.safetyEl.hidden = true;

    for (let i = 0; i < count; i++) {
      const cat = el("div", "ktc-cat");
      cat.setAttribute("data-cat", String(i));
      cat.setAttribute("data-face", "curious");
      cat.setAttribute("role", "button");
      cat.setAttribute("tabindex", "0");
      cat.setAttribute("aria-pressed", "false");
      cat.setAttribute("aria-label", `选中${CAT_CREW[i].name}`);
      if (count > 1) cat.appendChild(el("div", "ktc-catname", CAT_CREW[i].name));
      // 猫本身是一整块 SVG：表情靠外层的 data-face 切，代码不往 SVG 里查节点
      const art = el("div", "ktc-art");
      art.innerHTML = catSvg(CAT_CREW[i]);
      cat.appendChild(art);
      this.life.on(cat, "click", () => this.select(i));
      this.life.on(cat, "keydown", (e: Event) => {
        const key = (e as KeyboardEvent).key;
        if (key === "Enter" || key === " ") this.select(i);
      });
      this.catEls.push(cat);
      this.catsEl.appendChild(cat);
    }

    this.root.append(this.bubbleEl, this.planEl, this.catsEl, this.playEl, this.msgEl, this.safetyEl);
    host.appendChild(this.root);
    this.renderCats();
    this.renderMood();
    this.fit = fitIntoStage(this.root);
  }

  // -- 基础渲染 -------------------------------------------------------------

  setBadges(items: Array<{ text: string; state?: "done" | "now" | "clock" }>): void {
    this.topEl.textContent = "";
    for (const item of items) {
      const cls =
        item.state === "done" ? "ktc-badge ktc-done" : item.state === "now" ? "ktc-badge ktc-now" : item.state === "clock" ? "ktc-badge ktc-clock" : "ktc-badge";
      this.topEl.appendChild(el("span", cls, item.text));
    }
  }

  /** 任务清单条（闯关用）：做完的打勾，当前的高亮，多猫关标出这件事给谁做 */
  setTaskBar(tasks: readonly KittyTask[], current: number, catCount: number, targetOf: (i: number) => number): void {
    this.setBadges(
      tasks.map((task, i) => {
        const info = TASK_INFO[task];
        const who = catCount > 1 ? `${CAT_CREW[targetOf(i)].name}·` : "";
        return {
          text: `${i < current ? "✅" : info.icon} ${who}${info.name}`,
          state: i < current ? "done" : i === current ? "now" : undefined
        };
      })
    );
  }

  say(text: string): void {
    this.msgEl.textContent = text;
  }

  bubble(text: string): void {
    this.bubbleEl.textContent = text;
  }

  private renderMood(): void {
    if (!this.moodFill || !this.moodFaceEl) return;
    const cat = this.cats[this.selected] ?? this.cats[0];
    this.moodFill.style.width = `${Math.round(moodRatio(cat) * 100)}%`;
    this.moodFaceEl.textContent = moodFace(cat.mood, cat.moodMax || 1);
  }

  private renderCats(): void {
    this.catEls.forEach((node, i) => {
      const on = i === this.selected;
      node.classList.toggle("ktc-cat-on", on || this.cats.length === 1);
      node.setAttribute("aria-pressed", on ? "true" : "false");
      setFace(node, this.cats[i].face);
    });
  }

  /** 玩家点了某只猫：选中它（多猫关的目标锁定就靠这一下） */
  select(index: number): void {
    if (this.dead || index < 0 || index >= this.cats.length) return;
    this.selected = index;
    this.sfx("tap");
    this.cats[index] = catAfter(this.cats[index], "pet");
    if (this.cats[index].purring) this.sfx("meow");
    this.renderCats();
    this.renderMood();
    this.say(catLine(this.cats[index]));
    if (this.cats[index].hiding) this.renderSoothe();
    else if (this.spec && this.spec.target === index) this.renderTask();
  }

  private hearts(host: HTMLElement): void {
    if (this.opts.reduceMotion) return;
    for (let i = 0; i < 3; i++) {
      const heart = el("span", "ktc-heart", HEARTS[i % HEARTS.length]);
      heart.style.left = `${28 + i * 18}%`;
      heart.style.bottom = `${40 + i * 6}%`;
      host.appendChild(heart);
      this.life.after(() => heart.remove(), 1000 + i * 120);
    }
  }

  /** 目标猫（多猫关每件事都点名给谁做） */
  private targetCat(): number {
    return this.spec ? Math.max(0, Math.min(this.cats.length - 1, this.spec.target)) : 0;
  }

  /** 操作前的目标锁定检查：选错猫只摇头，不扣心情、不算失误 */
  private lockedOnTarget(): boolean {
    if (this.cats.length <= 1) return true;
    const target = this.targetCat();
    if (this.selected === target) return true;
    const node = this.catEls[this.selected];
    node?.classList.add("ktc-tilt");
    this.life.after(() => node?.classList.remove("ktc-tilt"), 620);
    this.say(`${this.cats[this.selected].name}摇摇头——这件事是${this.cats[target].name}的，先点它选中～`);
    return false;
  }

  /** 一次操作之后统一收口：算心情、算失误、判完成 */
  private settle(res: TaskOutcome<unknown>, host?: HTMLElement): void {
    if (res.note) this.say(res.note);
    const idx = this.targetCat();
    if (res.miss) {
      this.mistakes++;
      this.sfx("oops");
      this.cats[idx] = catAfter(this.cats[idx], "miss");
      const node = this.catEls[idx];
      node?.classList.add("ktc-tilt");
      this.life.after(() => node?.classList.remove("ktc-tilt"), 620);
      this.renderCats();
      this.renderMood();
      if (this.cats[idx].hiding) {
        this.renderSoothe();
        return;
      }
    } else if (res.acted) {
      this.sfx("pop");
    }
    if (res.done) {
      this.cats[idx] = catAfter(this.cats[idx], "done");
      this.renderCats();
      this.renderMood();
      this.sfx("win");
      this.hearts(host ?? this.catEls[idx] ?? this.root);
      const cb = this.onDone;
      this.spec = null;
      this.onDone = null;
      this.life.after(() => {
        if (!this.dead) cb?.();
      }, 750);
    }
  }

  /** 猫躲进纸箱：任务暂停，安抚三次它就自己出来（绝不判负、绝不重来） */
  private renderSoothe(): void {
    const idx = this.targetCat();
    const cat = this.cats[idx];
    this.playEl.textContent = "";
    this.planEl.hidden = true;
    this.bubble(`📦 ${cat.name}钻进纸箱了`);
    this.say(catLine(cat));
    const row = el("div", "ktc-btns");
    const soothe = btn("ktc-btn ktc-soft", "🤲", `轻轻摸摸它（还差 ${soothesLeft(cat)} 次）`);
    this.life.on(soothe, "click", () => {
      if (this.dead) return;
      this.sfx("meow");
      this.cats[idx] = catAfter(this.cats[idx], "soothe");
      this.renderCats();
      this.renderMood();
      const c = this.cats[idx];
      if (c.hiding) {
        relabel(soothe, `轻轻摸摸它（还差 ${soothesLeft(c)} 次）`);
        this.say(catLine(c));
        return;
      }
      this.say(`${c.name}探出头来啦，我们接着照顾它～`);
      this.renderTask();
    });
    row.appendChild(soothe);
    this.playEl.appendChild(row);
  }

  /** 本关最高能拿几星（躲过纸箱就降一档） */
  starCap(): 1 | 2 | 3 {
    return starCap(this.cats);
  }

  // -- 任务分派 -------------------------------------------------------------

  startTask(spec: TaskSpec, onDone: () => void): void {
    if (this.dead) return;
    this.spec = spec;
    this.onDone = onDone;
    this.safetyEl.hidden = spec.task !== "cure";
    this.planEl.hidden = true;
    if (this.cats.length > 1) {
      // 多猫关：系统点名给谁做，玩家自己点中它才动得了手
      this.say(`这件事是${this.cats[this.targetCat()].name}的，点它一下选中～`);
    }
    this.renderTask();
  }

  /** 停掉上一件事留下的循环（换任务、拆舞台都从这儿走） */
  private stopLoops(): void {
    for (const loop of this.loops) loop.stop();
    this.loops.length = 0;
  }

  /** 现在还挂着几个循环（测试用） */
  get liveLoops(): number {
    return this.loops.filter((l) => l.live).length;
  }

  private renderTask(): void {
    this.paintTask();
    // 每件事摆出来的东西不一样高，钳一次再交给手指
    this.refit();
  }

  /**
   * 重排版之后钳一次。`renderTask()` 走这条路，**点击回调里自己重画的那几条也必须走**——
   * 搭配任务挑完三件会翻出 5 行评分面板，看病每按一步也换一屏，这些都不经过 `renderTask()`。
   * 少钳这一次，长出来的那一截就落在舞台裁切线以下，交卷钮真手指再也够不着（W5R2-C-01 阻断）。
   *
   * `reveal` 为真时再把小屋滚到底：钳完只是「有得滚」，交卷钮仍在折线以下，
   * 孩子不会知道要往下滑；评分面板本来就是「看完就交卷」，滚到底正好把结论和出口一起摆到眼前。
   * 用的是最朴素的 `scrollTop` 赋值，不碰 `scrollIntoView`（那玩意儿连 `overflow:hidden` 都推得动，
   * 量出来的绿是假绿）。
   */
  private refit(reveal = false): void {
    this.fit?.relayout();
    if (!reveal) return;
    const root = this.root;
    if (root.scrollHeight - root.clientHeight > 1) root.scrollTop = root.scrollHeight;
  }

  private paintTask(): void {
    const spec = this.spec;
    if (!spec || this.dead) return;
    this.stopLoops();
    this.playEl.textContent = "";
    // 只有逗猫 / 打扮会摆场地；每次重画先摘掉，画到那两种任务时再挂回去
    this.root.classList.remove("ktc-hasfield");
    // 看病的对话气泡皮也一样：换任务先摘，画到看病再挂回去（纯视觉记号）
    this.root.classList.remove("ktc-caring");
    if (this.cats[this.targetCat()].hiding) {
      this.renderSoothe();
      return;
    }
    switch (spec.task) {
      case "feed":
        this.renderFeed(spec);
        break;
      case "play":
        this.renderPlay(spec);
        break;
      case "wash":
        this.renderWash(spec);
        break;
      case "sleep":
        this.renderSleep(spec);
        break;
      case "dress":
        this.renderDress(spec);
        break;
      case "cure":
        this.renderCure(spec);
        break;
      default:
        this.renderStyle(spec);
        break;
    }
  }

  // -- ① 喂饭：挑一样，拖（或点）进碗里 -------------------------------------

  private renderFeed(spec: TaskSpec): void {
    let state = buildFeed(spec.seed, spec.options);
    const name = this.cats[this.targetCat()].name;
    // 想吃气泡（W8R1-03）：想吃物可见层换贴纸，原 emoji 收进 sr-only（读屏念的
    // 和原来一字不差）；判定读的是闭包里的 name，零改动
    this.bubbleEl.textContent = `💭 ${name}想吃 `;
    this.bubbleEl.appendChild(el("span", "ktc-propsr", state.want.emoji));
    this.bubbleEl.appendChild(propIcon(state.want.emoji, PROP_PX.bubble));
    this.say("把它想吃的那一样拖进饭碗里～");
    const bowl = el("div", "ktc-target ktc-bowl");
    bowl.appendChild(propIcon("🥣", PROP_PX.bowl));
    bowl.setAttribute("aria-label", "饭碗");
    this.playEl.appendChild(bowl);

    const tray = el("div", "ktc-tray");
    let picked: string | null = null;
    for (const food of state.options) {
      const item = btn("ktc-drag", "", food.name);
      item.appendChild(propIcon(food.emoji, PROP_PX.food));
      this.life.on(item, "click", () => {
        if (this.dead || !this.lockedOnTarget()) return;
        picked = food.name;
        bowl.classList.add("ktc-target-hot");
        this.say(`拿起了${food.name}，再点一下饭碗放进去～`);
      });
      // 拖：按下就跟手，松手落在碗上就算放进碗里
      this.life.on(item, "pointerdown", () => {
        picked = food.name;
        item.classList.add("ktc-dragging");
      });
      this.life.on(item, "pointerup", () => item.classList.remove("ktc-dragging"));
      tray.appendChild(item);
    }
    this.playEl.appendChild(tray);

    const drop = (): void => {
      if (this.dead || picked === null || !this.lockedOnTarget()) return;
      const res = feedDrop(state, picked, true);
      state = res.state;
      picked = null;
      bowl.classList.remove("ktc-target-hot");
      if (res.done) {
        const cat = this.catEls[this.targetCat()];
        cat?.setAttribute("data-eat", "1");
        this.life.after(() => cat?.setAttribute("data-eat", "0"), 700);
      }
      this.settle(res, bowl);
    };
    this.life.on(bowl, "click", drop);
    this.life.on(bowl, "pointerup", drop);
  }

  // -- ② 逗猫：棒子要动，猫追上了才扑 ---------------------------------------

  private renderPlay(spec: TaskSpec): void {
    let state = buildPlay(spec.playTaps);
    const name = this.cats[this.targetCat()].name;
    // 想玩气泡：羽毛前缀换贴纸（W8R1-03）
    this.bubbleEl.textContent = "";
    this.bubbleEl.appendChild(propIcon("🪶", PROP_PX.bubble));
    this.bubbleEl.appendChild(el("span", undefined, ` ${name}想玩逗猫棒`));
    this.say(chaseHint(state));
    const field = el("div", "ktc-field");
    this.root.classList.add("ktc-hasfield");
    const toy = btn("ktc-toy", "", "逗猫棒");
    toy.appendChild(propIcon("🪶", PROP_PX.toy));
    const chaser = el("span", "ktc-chaser");
    chaser.appendChild(propIcon("🐾", PROP_PX.chaser));
    chaser.setAttribute("aria-hidden", "true");
    chaser.style.position = "absolute";
    field.append(toy, chaser);
    this.playEl.appendChild(field);

    const put = (): void => {
      toy.style.left = `${state.toy.x * 100}%`;
      toy.style.top = `${state.toy.y * 100}%`;
      chaser.style.left = `${state.cat.x * 100}%`;
      chaser.style.top = `${state.cat.y * 100}%`;
    };
    put();

    let target = { ...state.toy };
    const move = (e: Event): void => {
      const pe = e as PointerEvent;
      const rect = field.getBoundingClientRect?.();
      if (!rect || !rect.width || !rect.height) return;
      target = {
        x: Math.max(0, Math.min(1, (pe.clientX - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, (pe.clientY - rect.top) / rect.height))
      };
    };
    this.life.on(field, "pointermove", move);
    this.life.on(field, "pointerdown", move);
    // 没有指针设备时的等价操作：点一下棒子，它自己晃一圈
    this.life.on(toy, "click", () => {
      target = { x: state.cat.x + 0.18, y: state.cat.y - 0.12 };
    });

    let last = now();
    const tick = (): void => {
      if (this.dead || !this.spec) return;
      const t = now();
      const dt = t - last;
      last = t;
      const res = playStep(state, target, dt);
      state = res.state;
      put();
      if (res.acted) {
        this.settle(res, field);
        if (!res.done) {
          // 扑到之后棒子换个地方，继续逗
          target = { x: 1 - state.toy.x, y: Math.max(0.1, 1 - state.toy.y) };
        }
      } else if (!res.done) {
        this.say(chaseHint(state));
      }
      if (!res.done) this.life.frame(tick);
    };
    this.life.frame(tick);
  }

  // -- ③ 洗澡：画圈搓泡泡，覆盖率够就干净 -----------------------------------

  private renderWash(spec: TaskSpec): void {
    let state = buildWash(spec.washCols ?? 6, spec.washRows ?? 6);
    const name = this.cats[this.targetCat()].name;
    this.bubble(`🫧 ${name}身上有泡泡`);
    this.say(`用手指画圈搓，把 ${Math.round(WASH_TARGET * 100)}% 的泡泡都搓开～`);
    const wrap = el("div", "ktc-washwrap");
    const pad = el("div", "ktc-wash");
    const bar = el("div", "ktc-coverbar");
    const fill = el("div", "ktc-coverfill");
    bar.appendChild(fill);
    wrap.append(pad, bar);
    this.playEl.appendChild(wrap);

    const foams: HTMLElement[] = [];
    for (let i = 0; i < state.cells.length; i++) {
      const c = washCellCenter(state, i);
      const foam = el("div", "ktc-foam");
      foam.style.left = `${c.x * 100}%`;
      foam.style.top = `${c.y * 100}%`;
      foam.style.width = `${Math.floor(100 / state.cols)}%`;
      foam.style.height = `${Math.floor(100 / state.rows)}%`;
      pad.appendChild(foam);
      foams.push(foam);
    }

    let rubbing = false;
    const rub = (u: number, v: number): void => {
      if (this.dead || !this.lockedOnTarget()) return;
      const before = state.cells.slice();
      const res = scrub(state, u, v);
      state = res.state;
      state.cells.forEach((on, i) => {
        if (on && !before[i]) {
          foams[i].classList.add("ktc-pop");
          this.life.after(() => foams[i].remove(), 340);
        }
      });
      fill.style.width = `${Math.round(washCoverage(state) * 100)}%`;
      this.settle(res, pad);
    };
    const at = (e: Event): void => {
      const pe = e as PointerEvent;
      const rect = pad.getBoundingClientRect?.();
      if (!rect || !rect.width || !rect.height) return;
      rub((pe.clientX - rect.left) / rect.width, (pe.clientY - rect.top) / rect.height);
    };
    this.life.on(pad, "pointerdown", (e) => {
      rubbing = true;
      at(e);
    });
    this.life.on(pad, "pointermove", (e) => {
      if (rubbing) at(e);
    });
    this.life.on(pad, "pointerup", () => {
      rubbing = false;
    });
    this.life.on(pad, "pointerleave", () => {
      rubbing = false;
    });
    // 键盘 / 无指针环境：每点一下自动挑一个还没搓过的格子搓掉，一路能搓到干净
    let auto = 0;
    this.life.on(pad, "click", () => {
      const i = nextWashCell(state, auto);
      if (i < 0) return;
      auto = i + 1;
      const c = washCellCenter(state, i);
      rub(c.x, c.y);
    });
  }

  // -- ④ 哄睡：踩着节拍点音符 -----------------------------------------------

  private renderSleep(spec: TaskSpec): void {
    let state = buildSleep(spec.notes);
    const name = this.cats[this.targetCat()].name;
    this.bubble(`🌙 给${name}唱摇篮曲`);
    this.say("灯亮到哪一颗就点哪一下，踩着拍子它才睡得着～");
    const lights = el("div", "ktc-beats");
    const dots: HTMLElement[] = state.beats.map(() => {
      const dot = el("div", "ktc-beat", "🎵");
      lights.appendChild(dot);
      return dot;
    });
    const note = btn("ktc-note", "🎵", "跟着拍子点一下");
    this.playEl.append(lights, note);

    const started = now();
    this.loops.push(this.life.every(() => {
      if (this.dead) return;
      const t = now() - started;
      state.beats.forEach((b, i) => {
        dots[i].classList.toggle("ktc-beat-live", !state.hit[i] && Math.abs(b - t) <= BEAT_WINDOW_MS);
        dots[i].classList.toggle("ktc-beat-hit", state.hit[i]);
      });
    }, 80));

    this.life.on(note, "click", () => {
      if (this.dead || !this.lockedOnTarget()) return;
      const res = sleepTap(state, now() - started);
      state = res.state;
      state.hit.forEach((on, i) => dots[i].classList.toggle("ktc-beat-hit", on));
      if (res.done) {
        const cat = this.catEls[this.targetCat()];
        if (cat) setFace(cat, "sleepy");
      }
      this.settle(res, note);
    });
  }

  // -- ⑤ 打扮：拖到吸附点 ---------------------------------------------------

  private renderDress(spec: TaskSpec): void {
    let state = buildDress(spec.seed, spec.options);
    const name = this.cats[this.targetCat()].name;
    this.bubble(`💭 ${name}想戴 ${state.want.emoji}`);
    this.say("把配饰拖到猫身上的虚线圈里～");
    const field = el("div", "ktc-field");
    this.root.classList.add("ktc-hasfield");
    const spots: Array<{ id: string; node: HTMLElement }> = [
      { id: "head", node: el("div", "ktc-target ktc-spot-head", "⭕") },
      { id: "neck", node: el("div", "ktc-target ktc-spot-neck", "⭕") }
    ];
    for (const s of spots) {
      s.node.setAttribute("aria-label", s.id === "head" ? "头顶的吸附点" : "脖子的吸附点");
      field.appendChild(s.node);
    }
    this.playEl.appendChild(field);

    const tray = el("div", "ktc-tray");
    let picked: string | null = null;
    for (const acc of state.options) {
      const item = btn("ktc-drag", acc.emoji, acc.name);
      this.life.on(item, "click", () => {
        if (this.dead || !this.lockedOnTarget()) return;
        picked = acc.id;
        for (const s of spots) s.node.classList.add("ktc-target-hot");
        this.say(`拿起了${acc.name}，把它放到该待的圈里～`);
      });
      this.life.on(item, "pointerdown", () => {
        picked = acc.id;
        item.classList.add("ktc-dragging");
      });
      this.life.on(item, "pointerup", () => item.classList.remove("ktc-dragging"));
      tray.appendChild(item);
    }
    this.playEl.appendChild(tray);

    const release = (spotId: string | null): void => {
      if (this.dead || picked === null || !this.lockedOnTarget()) return;
      const res = dressDrop(state, picked, spotId);
      state = res.state;
      for (const s of spots) s.node.classList.remove("ktc-target-hot");
      if (res.done) {
        const acc = ACCS.find((a) => a.id === state.worn);
        const cat = this.catEls[this.targetCat()];
        if (acc && cat) cat.setAttribute("data-acc", acc.id);
      }
      picked = null;
      this.settle(res, field);
    };

    for (const s of spots) {
      this.life.on(s.node, "click", () => release(s.id));
      this.life.on(s.node, "pointerup", () => release(s.id));
    }
    // 松手在空地上：用吸附半径判一次，够不着就什么也不发生
    this.life.on(field, "pointerup", (e) => {
      const pe = e as PointerEvent;
      const rect = field.getBoundingClientRect?.();
      if (!rect || picked === null) return;
      const points: SnapPoint[] = spots.map((s) => {
        const r = s.node.getBoundingClientRect?.();
        return {
          id: s.id,
          label: s.id,
          x: (r?.left ?? 0) + (r?.width ?? 0) / 2,
          y: (r?.top ?? 0) + (r?.height ?? 0) / 2
        };
      });
      const hit = nearestSnap(points, pe.clientX, pe.clientY, SNAP_RADIUS);
      release(hit ? hit.id : null);
    });
  }

  // -- ⑥ 看病：先看一看，再动手，随时能退一步 -------------------------------

  private renderCure(spec: TaskSpec): void {
    const round = buildCureRound(spec.seed, spec.cureSteps, Math.min(spec.options + 1, 6));
    let state = cureStart(round);
    const name = this.cats[this.targetCat()].name;
    this.bubble(`${round.symptom.emoji} ${name}${round.symptom.name}`);
    this.planEl.hidden = false;
    this.safetyEl.hidden = false;
    // 对话气泡皮只在看病里穿（提示行文字本身一字不动）
    this.root.classList.add("ktc-caring");

    // -- 以下到 draw() 之前全是 1.3 的纯视觉层：判定、文案、热区一个都不碰 --

    // 护理角：三态立绘随 curePlan 进度切换；毛色与三花斑位跟关卡种子走，不闪变
    const fur = furForSeed(spec.seed);
    const variant = calicoVariantForSeed(spec.seed);
    const nook = el("div", "ktc-nook");
    const kittyEl = el("div", "ktc-kitty");
    const fxEl = el("div", "ktc-carefx");
    nook.append(kittyEl, fxEl);
    let shown: KittyState | null = null;
    const paintKitty = (): void => {
      const ks = kittyStateFor(state.step, state.done);
      if (ks === shown) return;
      shown = ks;
      kittyEl.innerHTML = kitty(ks, fur, 112, { variant, prefix: "ktc" });
      if (this.opts.reduceMotion) return;
      // 交叉淡入 260ms：摘了再挂让动画重跑（读一次 offsetWidth 触发重排，测试桩里没有就跳过）
      kittyEl.classList.remove("ktc-kitty-in");
      void (kittyEl as unknown as { offsetWidth?: number }).offsetWidth;
      kittyEl.classList.add("ktc-kitty-in");
    };

    // 选对 / 选错的视觉分支（互斥）：飞行道具图标 ↔「喵?」气泡
    const clearFx = (): void => {
      fxEl.textContent = "";
    };
    const flyIcon = (toolName: string): void => {
      clearFx();
      const flyer = el("span", "ktc-fly");
      if (this.opts.reduceMotion) flyer.classList.add("ktc-fly-still");
      flyer.innerHTML = toolIconSvg(toolName);
      fxEl.appendChild(flyer);
      this.life.after(() => flyer.remove(), 520);
    };
    const meow = (): void => {
      clearFx();
      const word = el("span", "ktc-meow", MEOW_TEXT);
      fxEl.appendChild(word);
      this.life.after(() => word.remove(), 900);
    };

    // 治愈仪式：打滚 + 咕噜气泡 + 爱心泡泡 5 颗 + 彩纸；reduced 只留静态痊愈立绘与印章
    const ritual = (): void => {
      clearFx();
      const purr = el("span", "ktc-purr", PURR_TEXT);
      fxEl.appendChild(purr);
      this.life.after(() => purr.remove(), 1100);
      if (this.opts.reduceMotion) return;
      kittyEl.classList.add("ktc-kitty-roll");
      this.life.after(() => kittyEl.classList.remove("ktc-kitty-roll"), 1050);
      for (const spot of heartBubbleSpecs()) {
        const heart = el("span", "ktc-heartbubble", "♥");
        heart.style.left = `${spot.leftPct}%`;
        heart.style.fontSize = `${spot.sizePx}px`;
        heart.style.animationDelay = `${spot.delayMs}ms`;
        fxEl.appendChild(heart);
        this.life.after(() => heart.remove(), 1050 + spot.delayMs);
      }
      for (const bit of confettiSpecs()) {
        const paper = el("span", "ktc-confetti");
        paper.style.left = `${bit.leftPct}%`;
        paper.style.background = bit.color;
        paper.style.animationDelay = `${bit.delayMs}ms`;
        paper.style.transform = `rotate(${bit.tiltDeg}deg)`;
        fxEl.appendChild(paper);
        this.life.after(() => paper.remove(), 1050 + bit.delayMs);
      }
    };

    // 步骤卡链：一步一张圆角小卡（todo 灰 / now 亮边呼吸 / done 绿 + 爪印章），
    // 卡间箭头描边化。卡上文字取自 curePlan 原文，一字不丢、不提前泄题。
    const paintPlan = (): void => {
      this.planEl.textContent = "";
      let nowCard: HTMLElement | null = null;
      curePlan(state).forEach((step, i) => {
        if (i > 0) this.planEl.appendChild(el("span", "ktc-step-arrow", "→"));
        const card = el("span", `ktc-step ktc-step-${step.state}`);
        const part = splitStepText(step.text);
        card.appendChild(el("span", "ktc-step-idx", String(i + 1)));
        if (part.icon) card.appendChild(el("span", "ktc-step-icon", part.icon));
        card.appendChild(el("span", "ktc-step-name", part.label));
        if (step.state === "done") card.appendChild(el("span", "ktc-stamp", "🐾"));
        if (step.state === "now") nowCard = card;
        this.planEl.appendChild(card);
      });
      // 360px 上卡链放不下会横滑：把当前步滚到中间（量不到宽度的环境安静跳过）
      const holder = this.planEl as unknown as { scrollLeft?: number; clientWidth?: number };
      const cur = nowCard as unknown as { offsetLeft?: number; offsetWidth?: number } | null;
      if (cur && typeof holder.clientWidth === "number" && holder.clientWidth > 0 && typeof cur.offsetLeft === "number") {
        holder.scrollLeft = stepCenterOffset(cur.offsetLeft, cur.offsetWidth ?? 0, holder.clientWidth);
      }
      // 对话气泡的小尾巴指向护理角的小猫（几何算不出来就落回居中）
      const st = this.msgEl.style as unknown as { setProperty?: (k: string, v: string) => void };
      if (typeof st.setProperty === "function") {
        st.setProperty("--ktc-tail-x", `${bubbleTailX(this.msgEl.getBoundingClientRect?.(), nook.getBoundingClientRect?.())}%`);
      }
    };

    // 刚刚那一下要说的话：护理台整块重画时把它带上，别让通用提示在同一 tick 里盖掉
    const draw = (note?: string, miss = false): void => {
      paintPlan();
      paintKitty();
      this.say(cureMessage(note, cureHint(state), miss));
      this.playEl.textContent = "";
      this.playEl.appendChild(nook);
      const row = el("div", "ktc-btns");
      const cur = round.steps[state.step];
      for (const tool of cur?.options ?? []) {
        const b = btn("ktc-btn ktc-tool", "", tool.name);
        const icon = el("span", "ktc-toolicon");
        icon.innerHTML = toolIconSvg(tool.name);
        b.appendChild(icon);
        this.life.on(b, "click", () => {
          if (this.dead || !this.lockedOnTarget()) return;
          const res = curePick(state, tool.name);
          state = res.state;
          // 纯视觉分支：选对图标飞向小猫用一下，选错只歪头「喵?」（settle 照旧管判定反馈）
          if (res.miss) meow();
          else if (res.acted) flyIcon(tool.name);
          this.settle(res, row);
          if (res.done) {
            // 痊愈：卡链全部盖章 + 三态切到 cured + 仪式；流程收尾仍由 settle 负责
            paintPlan();
            paintKitty();
            ritual();
            return;
          }
          // 心情掉光时 settle 已经把舞台换成安抚按钮了，别再画回护理台把它盖掉
          if (!this.cats[this.targetCat()].hiding) draw(res.note, res.miss);
        });
        row.appendChild(b);
      }
      this.playEl.appendChild(row);
      const back = el("button", "ktc-mini");
      (back as HTMLButtonElement).type = "button";
      back.textContent = "↩ 退一步";
      (back as HTMLButtonElement).disabled = state.step <= 0;
      this.life.on(back, "click", () => {
        if (this.dead) return;
        const res = cureBack(state);
        state = res.state;
        if (res.acted) this.sfx("tap");
        draw(res.note);
      });
      const tools = el("div", "ktc-tools");
      tools.appendChild(back);
      this.playEl.appendChild(tools);
      // 看病每按一步都换一屏，步骤行数不一样多
      this.refit();
    };
    draw();
  }

  // -- ⑦ 搭配：按规则表评分，逐条讲理由 -------------------------------------

  private renderStyle(spec: TaskSpec): void {
    const round = buildStyleRound(spec.seed, spec.styleSlots, Math.min(spec.options + 1, 6));
    const picks: StyleItem[] = [];
    let slot = 0;
    const name = this.cats[this.targetCat()].name;

    const drawSlot = (): void => {
      this.playEl.textContent = "";
      this.bubble(`👗 今天的主题：${round.theme}`);
      const cur = round.slots[slot];
      this.say(`挑一件${cur.slot}（${slot + 1}/${round.slots.length}）——想想哪个词最贴「${round.theme}」`);
      const row = el("div", "ktc-btns");
      for (const item of cur.options) {
        const tags = item.tags.length > 0 ? item.tags.join("·") : "百搭";
        // 1.3：槽位加圆角卡壳（内描边走 box-shadow，按钮几何与热区零改动）
        const b = btn("ktc-btn ktc-slotcard", item.emoji, `${item.name}\n${tags}`);
        this.life.on(b, "click", () => {
          if (this.dead || !this.lockedOnTarget()) return;
          picks.push(item);
          this.sfx("tap");
          slot++;
          if (slot < round.slots.length) drawSlot();
          else drawScore();
        });
        row.appendChild(b);
      }
      this.playEl.appendChild(row);
      // 每一件的候选数不一样多，这一排的行数会变
      this.refit();
    };

    const drawScore = (): void => {
      const score = scoreOutfit(picks, round.theme);
      this.playEl.textContent = "";
      this.bubble(`👗 ${round.theme} · ${score.label}`);
      // 1.3：计分牌木质化（只换皮，评分行文一字不差）
      const panel = el("div", "ktc-score ktc-wood");
      panel.appendChild(el("div", undefined, `评分规则：加分标签 +1，减分标签 −1，百搭 +1`));
      for (const line of score.lines) {
        const row = el("div", undefined, `${line.emoji} ${line.name}：${line.reason}（${line.delta >= 0 ? "+" : ""}${line.delta}）`);
        panel.appendChild(row);
      }
      panel.appendChild(el("div", undefined, `合计 ${score.total} / ${score.max} 分 · ${score.label}`));
      this.playEl.appendChild(panel);
      const tools = el("div", "ktc-tools");
      const again = el("button", "ktc-mini");
      (again as HTMLButtonElement).type = "button";
      again.textContent = "🔁 再搭一次";
      this.life.on(again, "click", () => {
        if (this.dead) return;
        picks.length = 0;
        slot = 0;
        this.sfx("tap");
        drawSlot();
      });
      const go = el("button", "ktc-mini ktc-primary");
      (go as HTMLButtonElement).type = "button";
      go.textContent = "✨ 就这套上台";
      this.life.on(go, "click", () => {
        if (this.dead) return;
        this.settle(
          {
            state: score,
            acted: true,
            miss: false,
            done: true,
            note: `${name}穿着这一套转了个圈，${score.label}！`
          },
          panel
        );
      });
      tools.append(again, go);
      this.playEl.appendChild(tools);
      // 面板一撑高就得重新钳，再把交卷钮送到眼前
      this.refit(true);
    };

    drawSlot();
  }

  /** 单件搭配的理由（给攻略与测试用的薄封装） */
  static explain = judgeStyleItem;

  destroy(): void {
    this.dead = true;
    this.stopLoops();
    this.fit?.dispose();
    this.fit = null;
    this.spec = null;
    this.onDone = null;
    this.root.remove();
  }
}
