import { meta } from "./meta";
export { meta };

import { mountLevelGame, shuffled, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import {
  buildCureRound,
  buildStyleRound,
  CAT_CREW,
  catForTask,
  CHAPTERS,
  LEVELS,
  moodAfter,
  moodFace,
  roundSeed,
  styleGrade,
  styleItemScore,
  type CureRound,
  type KittyLevel,
  type KittyTask,
  type StyleItem,
  type StyleRound
} from "./levels";

/** 一只圆滚滚的小猫；毛色由 CAT_CREW 决定，同一套线稿换色就是新室友 */
function catSvg(crew: (typeof CAT_CREW)[number]): string {
  const { coat, line, ear, belly, paw } = crew;
  return `
<svg viewBox="0 0 220 210" class="kc-cat-svg" aria-label="圆滚滚的小猫${crew.name}">
  <path class="kc-tail" d="M180 152 q36 -4 32 -40 q-2 -18 -20 -18"
    stroke="${coat}" stroke-width="15" fill="none" stroke-linecap="round"/>
  <path d="M204 122 q4 -10 -4 -20" stroke="${line}" stroke-width="5"
    fill="none" stroke-linecap="round"/>
  <ellipse cx="108" cy="148" rx="64" ry="48" fill="${coat}"/>
  <path d="M52 132 q12 8 8 22" stroke="${line}" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M166 132 q-12 8 -8 22" stroke="${line}" stroke-width="6" fill="none" stroke-linecap="round"/>
  <ellipse cx="108" cy="160" rx="34" ry="26" fill="${belly}"/>
  <ellipse cx="84" cy="192" rx="15" ry="9" fill="${paw}"/>
  <ellipse cx="132" cy="192" rx="15" ry="9" fill="${paw}"/>
  <g class="kc-head">
    <path d="M60 54 L72 14 L96 44 Z" fill="${coat}"/>
    <path d="M68 47 L76 26 L88 41 Z" fill="${ear}"/>
    <path d="M160 54 L148 14 L124 44 Z" fill="${coat}"/>
    <path d="M152 47 L144 26 L132 41 Z" fill="${ear}"/>
    <circle cx="110" cy="74" r="52" fill="${coat}"/>
    <path d="M98 26 q2 10 0 15" stroke="${line}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M110 24 q2 11 0 17" stroke="${line}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M122 26 q2 10 0 15" stroke="${line}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <g class="kc-eyes-open">
      <circle cx="88" cy="72" r="7.5" fill="#3d2b1f"/>
      <circle cx="90.6" cy="69.4" r="2.6" fill="#fff"/>
      <circle cx="132" cy="72" r="7.5" fill="#3d2b1f"/>
      <circle cx="134.6" cy="69.4" r="2.6" fill="#fff"/>
    </g>
    <g class="kc-eyes-happy" style="display:none">
      <path d="M79 73 q9 -9 18 0" stroke="#3d2b1f" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      <path d="M123 73 q9 -9 18 0" stroke="#3d2b1f" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    </g>
    <ellipse cx="72" cy="88" rx="9" ry="5.5" fill="#ffb3c0" opacity="0.85"/>
    <ellipse cx="148" cy="88" rx="9" ry="5.5" fill="#ffb3c0" opacity="0.85"/>
    <path d="M105 84 q5 -4 10 0 l-5 6 z" fill="#e6707f"/>
    <path class="kc-mouth" d="M102 93 q4 5 8 0 q4 5 8 0"
      stroke="#3d2b1f" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <ellipse class="kc-mouth-open" cx="110" cy="96" rx="7" ry="8"
      fill="#b3564f" style="display:none"/>
    <g stroke="${line}" stroke-width="2.4" stroke-linecap="round" fill="none">
      <path d="M56 82 q-14 -3 -24 -8"/><path d="M57 92 q-14 1 -25 0"/>
      <path d="M164 82 q14 -3 24 -8"/><path d="M163 92 q14 1 25 0"/>
    </g>
    <g class="kc-acc kc-acc-bow" style="display:none">
      <path d="M132 18 l-14 9 l14 9 z" fill="#ff6b81"/>
      <path d="M160 18 l14 9 l-14 9 z" fill="#ff6b81"/>
      <circle cx="146" cy="27" r="6" fill="#ff8fa3"/>
    </g>
    <g class="kc-acc kc-acc-hat" style="display:none">
      <path d="M78 34 q32 -34 64 0 q-32 12 -64 0 z" fill="#ffd23f"/>
      <circle cx="110" cy="8" r="8" fill="#ff6b81"/>
      <rect x="74" y="30" width="72" height="10" rx="5" fill="#f4a259"/>
    </g>
    <g class="kc-acc kc-acc-tie" style="display:none">
      <path d="M96 118 l-16 10 l16 10 z" fill="#4dabf7"/>
      <path d="M124 118 l16 10 l-16 10 z" fill="#4dabf7"/>
      <circle cx="110" cy="128" r="7" fill="#74c0fc"/>
    </g>
    <g class="kc-acc kc-acc-scarf" style="display:none">
      <path d="M72 114 q38 22 76 0 l-3 15 q-35 18 -70 0 z" fill="#69db7c"/>
      <rect x="96" y="122" width="14" height="34" rx="6" fill="#51cf66"/>
      <rect x="96" y="150" width="14" height="8" rx="3" fill="#40c057"/>
    </g>
  </g>
</svg>`;
}

const FOODS = [
  { emoji: "🐟", name: "小鱼干" },
  { emoji: "🥛", name: "牛奶" },
  { emoji: "🍗", name: "鸡腿" },
  { emoji: "🍤", name: "虾虾" },
  { emoji: "🥩", name: "肉肉" },
  { emoji: "🧀", name: "奶酪" }
];

const TOYS = ["🧶", "🪶", "🐭", "🦋"];

const ACCS = [
  { emoji: "🎀", name: "蝴蝶结", cls: "kc-acc-bow" },
  { emoji: "🎩", name: "小帽子", cls: "kc-acc-hat" },
  { emoji: "👔", name: "领结", cls: "kc-acc-tie" },
  { emoji: "🧣", name: "围巾", cls: "kc-acc-scarf" }
];

const NOTES = ["🎵", "🎶", "🎼"];

const TASK_INFO: Record<KittyTask, { icon: string; name: string }> = {
  feed: { icon: "🍽️", name: "喂饭" },
  play: { icon: "🧶", name: "逗猫" },
  wash: { icon: "🫧", name: "洗澡" },
  sleep: { icon: "🌙", name: "哄睡" },
  dress: { icon: "🎀", name: "打扮" },
  cure: { icon: "🩺", name: "看病" },
  style: { icon: "👗", name: "搭配" }
};

const THEME_BG = [
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

const CSS = `
.kc-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; border-radius: 16px; padding: 12px; user-select: none; position: relative; min-height: 460px; }
.kc-top { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; margin-bottom: 6px; }
.kc-badge { background: #ffffffd9; border-radius: 14px; padding: 5px 10px; font-weight: 800; color: #8a5a1e; box-shadow: 0 2px 6px rgba(180,130,60,.2); font-size: 13px; }
.kc-badge.kc-done { background: #d9f5d0; color: #3f7a36; }
.kc-badge.kc-now { outline: 2px solid #f7a23b; }
.kc-mood { display: flex; align-items: center; gap: 6px; justify-content: center; margin: 2px auto 4px; max-width: 300px; }
.kc-moodbar { flex: 1; height: 12px; background: #ffffffcc; border-radius: 8px; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,.1); }
.kc-moodfill { height: 100%; width: 100%; border-radius: 8px; background: linear-gradient(90deg,#ffb3c9,#ff7fa8); transition: width .3s; }
.kc-moodface { font-size: 20px; line-height: 1; }
.kc-bubble { min-height: 34px; margin: 4px auto; background: #fff; border-radius: 18px; padding: 8px 18px; font-size: 20px; font-weight: 900; color: #6b4a20; width: fit-content; max-width: 92%; box-shadow: 0 3px 8px rgba(160,110,40,.18); text-align: center; line-height: 1.4; }
.kc-plan { margin: 0 auto 4px; background: #ffffffd9; border-radius: 14px; padding: 5px 12px; font-size: 14px; font-weight: 800; color: #3f7a68; width: fit-content; max-width: 94%; text-align: center; line-height: 1.5; }
.kc-cats { display: flex; gap: 6px; justify-content: center; align-items: flex-end; margin: 4px auto; max-width: 100%; }
.kc-cat { position: relative; flex: 1 1 0; min-width: 0; max-width: 300px; opacity: .55; transition: opacity .25s, transform .25s; }
.kc-cat.kc-cat-on { opacity: 1; transform: translateY(-2px); }
.kc-catname { text-align: center; font-size: 12px; font-weight: 900; color: #7a5320; background: #ffffffcc; border-radius: 999px; padding: 2px 8px; width: fit-content; margin: 0 auto 2px; }
.kc-cat.kc-cat-on .kc-catname { background: #ffd9a8; color: #8a4a10; }
.kc-cat-svg { width: 100%; display: block; }
.kc-cat-svg .kc-head { transform-origin: 110px 80px; }
.kc-happy .kc-head { animation: kcNod .55s ease; }
@keyframes kcNod { 0%,100% { transform: rotate(0); } 40% { transform: rotate(-6deg) scale(1.04); } }
.kc-spot { position: absolute; border: none; background: none; font-size: 30px; cursor: pointer; padding: 2px; filter: drop-shadow(0 2px 3px rgba(60,120,180,.4)); animation: kcFloat 1.6s ease infinite; }
@keyframes kcFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
.kc-toy { position: absolute; border: none; background: #ffffffd0; border-radius: 50%; width: 54px; height: 54px; font-size: 30px; cursor: pointer; box-shadow: 0 3px 8px rgba(160,110,40,.3); transition: left .35s, top .35s; }
.kc-toy:active { transform: scale(.88); }
.kc-outfit { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; min-height: 0; margin-top: 4px; }
.kc-chip { background: #ffffffd9; border-radius: 12px; padding: 3px 9px; font-size: 13px; font-weight: 800; color: #6b4a8a; box-shadow: 0 2px 5px rgba(150,120,190,.22); }
.kc-btns { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 8px; }
.kc-btn { min-width: 74px; min-height: 62px; border: none; border-radius: 18px; background: #fff; cursor: pointer; font-size: 30px; box-shadow: 0 4px 0 rgba(180,130,60,.3); font-family: inherit; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 6px 10px; }
.kc-btn small { font-size: 12px; font-weight: 800; color: #8a5a1e; }
.kc-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 rgba(180,130,60,.3); }
.kc-btn.kc-wrong { animation: kcShake .4s; opacity: .55; }
@keyframes kcShake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
.kc-msg { text-align: center; min-height: 22px; font-weight: 800; color: #a86a28; margin-top: 8px; font-size: 15px; }
.kc-night .kc-msg { color: #ffe9c0; }
.kc-night .kc-bubble { background: #fffdf3; }
@media (max-width: 420px) {
  .kc-bubble { font-size: 17px; padding: 7px 12px; }
  .kc-btn { min-width: 62px; min-height: 56px; font-size: 26px; padding: 5px 7px; }
  .kc-btn small { font-size: 11px; }
}
@media (prefers-reduced-motion: reduce) {
  .kc-spot, .kc-happy .kc-head, .kc-btn.kc-wrong { animation: none; }
}
`;

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: KittyLevel = LEVELS[ctx.level];
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  const intervals = new Set<ReturnType<typeof setInterval>>();
  const catCount = Math.max(1, Math.min(CAT_CREW.length, cfg.cats ?? 1));
  const moodMax = cfg.moodMax ?? 0;
  let destroyed = false;
  let ended = false;
  let taskIdx = 0;
  let mistakes = 0;
  let mood = cfg.moodStart ?? 0;
  let activeCat = 0;

  const wrap = document.createElement("div");
  wrap.className = `kc-wrap${cfg.theme === 5 ? " kc-night" : ""}`;
  wrap.style.background = THEME_BG[cfg.theme] ?? THEME_BG[0];
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="kc-top"></div>
    ${cfg.moodStart
      ? `<div class="kc-mood"><span>💗</span><div class="kc-moodbar"><div class="kc-moodfill"></div></div><span class="kc-moodface">😻</span></div>`
      : ""}
    <div class="kc-bubble"></div>
    <div class="kc-plan" style="display:none"></div>
    <div class="kc-cats">
      ${Array.from({ length: catCount }, (_, i) =>
        `<div class="kc-cat" data-cat="${i}">${catCount > 1 ? `<div class="kc-catname">${CAT_CREW[i].name}</div>` : ""}${catSvg(CAT_CREW[i])}</div>`
      ).join("")}
    </div>
    <div class="kc-outfit"></div>
    <div class="kc-btns"></div>
    <div class="kc-msg">${catCount > 1 ? "小猫们排好队等你照顾啦～" : "团团在等你照顾它～"}</div>
  `;
  stage.appendChild(wrap);

  const topEl = wrap.querySelector(".kc-top") as HTMLElement;
  const bubbleEl = wrap.querySelector(".kc-bubble") as HTMLElement;
  const planEl = wrap.querySelector(".kc-plan") as HTMLElement;
  const outfitEl = wrap.querySelector(".kc-outfit") as HTMLElement;
  const btnsEl = wrap.querySelector(".kc-btns") as HTMLElement;
  const msgEl = wrap.querySelector(".kc-msg") as HTMLElement;
  const moodFillEl = wrap.querySelector(".kc-moodfill") as HTMLElement | null;
  const moodFaceEl = wrap.querySelector(".kc-moodface") as HTMLElement | null;
  const catEls = Array.from(wrap.querySelectorAll<HTMLElement>(".kc-cat"));

  /** 当前这只猫的舞台盒子：泡泡、玩具都挂在它身上 */
  function boxEl(): HTMLElement {
    return catEls[activeCat] ?? catEls[0];
  }

  function catName(): string {
    return catCount > 1 ? CAT_CREW[activeCat].name : "团团";
  }

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed) fn();
    }, ms);
    timeouts.add(t);
  }

  function renderTop(): void {
    topEl.innerHTML = cfg.tasks
      .map((task, i) => {
        const info = TASK_INFO[task];
        const cls = i < taskIdx ? " kc-done" : i === taskIdx ? " kc-now" : "";
        const who = catCount > 1 ? `${CAT_CREW[catForTask(i, catCount)].name}·` : "";
        return `<span class="kc-badge${cls}">${i < taskIdx ? "✅" : info.icon} ${who}${info.name}</span>`;
      })
      .join("");
  }

  function renderMood(): void {
    if (!moodFillEl || !moodFaceEl || moodMax <= 0) return;
    moodFillEl.style.width = `${Math.max(0, Math.min(100, (mood / moodMax) * 100))}%`;
    moodFaceEl.textContent = moodFace(mood, moodMax);
  }

  function renderCats(): void {
    catEls.forEach((el, i) => el.classList.toggle("kc-cat-on", i === activeCat || catCount === 1));
  }

  function happyCat(): void {
    const box = boxEl();
    box.classList.add("kc-happy");
    const open = box.querySelector(".kc-eyes-open") as SVGElement | null;
    const happy = box.querySelector(".kc-eyes-happy") as SVGElement | null;
    if (open) open.style.display = "none";
    if (happy) happy.style.display = "";
    later(() => {
      box.classList.remove("kc-happy");
      if (open) open.style.display = "";
      if (happy) happy.style.display = "none";
    }, 800);
  }

  function mistake(gentle: string): void {
    mistakes++;
    ctx.sfx("oops");
    msgEl.textContent = gentle;
    if (moodMax > 0) {
      mood = moodAfter(mood, "miss", moodMax);
      renderMood();
      if (mood <= 0) {
        ended = true;
        later(() => ctx.lose(`${catName()}今天累啦～下一次先看它头顶冒的那个小图标，对着需求选，心情就一直是满的！`), 500);
        return;
      }
    }
    if (moodMax <= 0 && mistakes > 4) {
      ended = true;
      later(() => ctx.lose("这一轮先到这儿～照顾顺序按「先吃再玩后睡」来排，团团的心情掉得就慢多了！"), 500);
    }
  }

  function taskDone(): void {
    if (ended) return;
    happyCat();
    ctx.sfx("meow");
    if (moodMax > 0) {
      mood = moodAfter(mood, "done", moodMax);
      renderMood();
    }
    taskIdx++;
    renderTop();
    if (taskIdx >= cfg.tasks.length) {
      ended = true;
      const got = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
      later(() => ctx.win(got as 1 | 2 | 3, mistakes === 0
        ? "每件事都一次做对，小猫们幸福得打呼噜！"
        : "任务全部完成，小猫们舒服地眯起了眼！"), 800);
      return;
    }
    later(() => startTask(), 800);
  }

  /** 排一行选项按钮：文本 + 小字说明，点中 onPick 判定 */
  function renderOptions<T>(items: T[], face: (item: T) => { emoji: string; name: string }, onPick: (item: T, btn: HTMLButtonElement) => void): void {
    btnsEl.innerHTML = "";
    for (const item of items) {
      const f = face(item);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "kc-btn";
      btn.innerHTML = `${f.emoji}<small>${f.name}</small>`;
      btn.setAttribute("aria-label", f.name);
      btn.addEventListener("click", () => {
        if (ended) return;
        onPick(item, btn);
      });
      btnsEl.appendChild(btn);
    }
  }

  // ---- 各任务 ----

  function taskFeed(): void {
    const want = FOODS[Math.floor(Math.random() * FOODS.length)];
    bubbleEl.textContent = `💭 ${catName()}想吃 ${want.emoji}`;
    msgEl.textContent = "在下面找到它想吃的东西！";
    const n = Math.min(cfg.options, FOODS.length);
    const opts = shuffled(
      [want, ...shuffled(FOODS.filter((f) => f !== want), Math.random as () => number).slice(0, n - 1)],
      Math.random as () => number
    );
    renderOptions(opts, (f) => f, (f, btn) => {
      if (f === want) {
        const mouth = boxEl().querySelector(".kc-mouth-open") as SVGElement | null;
        if (mouth) {
          mouth.style.display = "";
          later(() => { mouth.style.display = "none"; }, 700);
        }
        ctx.sfx("coin");
        msgEl.textContent = `啊呜～${f.name}真好吃！`;
        btnsEl.innerHTML = "";
        taskDone();
      } else {
        btn.classList.add("kc-wrong");
        btn.disabled = true;
        mistake(`${catName()}摇摇头，再看看它想要什么～`);
      }
    });
  }

  function taskPlay(): void {
    const toy = TOYS[Math.floor(Math.random() * TOYS.length)];
    let taps = 0;
    bubbleEl.textContent = `💭 ${catName()}想玩 ${toy}`;
    msgEl.textContent = `快拍玩具逗它！还差 ${cfg.playTaps} 下`;
    btnsEl.innerHTML = "";
    const box = boxEl();
    const toyBtn = document.createElement("button");
    toyBtn.type = "button";
    toyBtn.className = "kc-toy";
    toyBtn.textContent = toy;
    toyBtn.setAttribute("aria-label", "拍一下玩具");
    const move = () => {
      toyBtn.style.left = `${6 + Math.random() * 66}%`;
      toyBtn.style.top = `${8 + Math.random() * 68}%`;
    };
    move();
    box.appendChild(toyBtn);
    const mover = setInterval(() => { if (!destroyed && !ended) move(); }, 1100);
    intervals.add(mover);
    toyBtn.addEventListener("click", () => {
      if (ended) return;
      taps++;
      ctx.sfx("pop");
      move();
      if (taps >= cfg.playTaps) {
        clearInterval(mover);
        toyBtn.remove();
        msgEl.textContent = "玩累啦，它开心极了！";
        taskDone();
      } else {
        msgEl.textContent = `真好玩！还差 ${cfg.playTaps - taps} 下`;
      }
    });
  }

  function taskWash(): void {
    bubbleEl.textContent = `💭 ${catName()}身上脏脏的`;
    msgEl.textContent = `把 ${cfg.washSpots} 个泡泡全都搓掉！`;
    btnsEl.innerHTML = "";
    const box = boxEl();
    let left = cfg.washSpots;
    for (let i = 0; i < cfg.washSpots; i++) {
      const spot = document.createElement("button");
      spot.type = "button";
      spot.className = "kc-spot";
      spot.textContent = "🫧";
      spot.setAttribute("aria-label", "搓掉一个泡泡");
      spot.style.left = `${12 + Math.random() * 62}%`;
      spot.style.top = `${24 + Math.random() * 52}%`;
      spot.style.animationDelay = `${Math.random()}s`;
      spot.addEventListener("click", () => {
        if (ended) return;
        ctx.sfx("pop");
        spot.remove();
        left--;
        msgEl.textContent = left > 0 ? `搓搓搓～还剩 ${left} 个泡泡` : "洗得香喷喷！";
        if (left <= 0) taskDone();
      });
      box.appendChild(spot);
    }
  }

  function taskSleep(): void {
    const seq: string[] = Array.from({ length: cfg.notes }, () => NOTES[Math.floor(Math.random() * NOTES.length)]);
    let step = 0;
    let showing = true;
    bubbleEl.textContent = `🌙 摇篮曲：${seq.join(" ")}`;
    msgEl.textContent = "记住音符的顺序，马上照着弹！";
    btnsEl.innerHTML = "";
    later(() => {
      if (ended) return;
      showing = false;
      bubbleEl.textContent = "🌙 轮到你弹啦";
      msgEl.textContent = "按刚才的顺序点音符！";
      renderOptions(NOTES, (n) => ({ emoji: n, name: "音符" }), (n) => {
        if (showing) return;
        if (n === seq[step]) {
          ctx.sfx("tap");
          step++;
          msgEl.textContent = `好听！${step}/${seq.length}`;
          if (step >= seq.length) {
            btnsEl.innerHTML = "";
            msgEl.textContent = `呼噜呼噜～${catName()}睡着啦`;
            taskDone();
          }
        } else {
          step = 0;
          mistake(`不是这个音，从头再弹：${seq.join(" ")}`);
          bubbleEl.textContent = `🌙 摇篮曲：${seq.join(" ")}`;
          later(() => { if (!ended) bubbleEl.textContent = "🌙 轮到你弹啦"; }, 1800);
        }
      });
    }, 2400);
  }

  function taskDress(): void {
    const want = ACCS[Math.floor(Math.random() * ACCS.length)];
    bubbleEl.textContent = `💭 ${catName()}想戴 ${want.emoji}`;
    msgEl.textContent = "帮它挑对打扮！";
    const n = Math.min(cfg.options, ACCS.length);
    const opts = shuffled(
      [want, ...shuffled(ACCS.filter((a) => a !== want), Math.random as () => number).slice(0, n - 1)],
      Math.random as () => number
    );
    renderOptions(opts, (a) => a, (a, btn) => {
      if (a === want) {
        const box = boxEl();
        box.querySelectorAll<SVGElement>(".kc-acc").forEach((el) => { el.style.display = "none"; });
        const acc = box.querySelector(`.${a.cls}`) as SVGElement | null;
        if (acc) acc.style.display = "";
        ctx.sfx("coin");
        msgEl.textContent = `${a.name}戴上啦，真好看！`;
        btnsEl.innerHTML = "";
        taskDone();
      } else {
        btn.classList.add("kc-wrong");
        btn.disabled = true;
        mistake(`${catName()}歪歪头，好像不是这件～`);
      }
    });
  }

  /** 1.1 新机制：生病与看病——照着护理单一步一步来 */
  function taskCure(): void {
    const round: CureRound = buildCureRound(
      roundSeed(ctx.level, taskIdx),
      cfg.cureSteps ?? 2,
      Math.min(cfg.options + 1, 6)
    );
    let step = 0;
    bubbleEl.textContent = `${round.symptom.emoji} ${catName()}${round.symptom.name}`;
    planEl.style.display = "";
    const renderPlan = (): void => {
      planEl.innerHTML = `护理单：${round.steps
        .map((s, i) => `<span style="opacity:${i < step ? ".45" : "1"}">${i + 1}.${s.answer.emoji}${s.answer.name}</span>`)
        .join(" → ")}`;
    };
    const renderStep = (): void => {
      renderPlan();
      const cur = round.steps[step];
      msgEl.textContent = `第 ${step + 1}/${round.steps.length} 步：该拿 ${cur.answer.name} 啦`;
      renderOptions(cur.options, (tool) => tool, (tool, btn) => {
        if (tool.name === cur.answer.name) {
          ctx.sfx("coin");
          step++;
          if (step >= round.steps.length) {
            btnsEl.innerHTML = "";
            planEl.style.display = "none";
            msgEl.textContent = `护理做完啦，${catName()}舒服多了！`;
            taskDone();
          } else {
            renderStep();
          }
        } else {
          btn.classList.add("kc-wrong");
          btn.disabled = true;
          mistake("这一步还用不上它，照着护理单的顺序来～");
        }
      });
    };
    renderStep();
  }

  /** 1.1 新机制：装扮搭配评分——按当天主题一件件挑，最后给一个搭配分 */
  function taskStyle(): void {
    const round: StyleRound = buildStyleRound(
      roundSeed(ctx.level, taskIdx),
      cfg.styleSlots ?? 2,
      Math.min(cfg.options + 1, 6)
    );
    const picks: StyleItem[] = [];
    let slot = 0;
    bubbleEl.textContent = `👗 今天的主题：${round.theme}`;
    outfitEl.innerHTML = "";
    const renderSlot = (): void => {
      const cur = round.slots[slot];
      msgEl.textContent = `挑一件${cur.slot}（${slot + 1}/${round.slots.length}），越贴主题分越高`;
      renderOptions(cur.options, (item) => item, (item) => {
        picks.push(item);
        ctx.sfx("tap");
        const chip = document.createElement("span");
        chip.className = "kc-chip";
        chip.textContent = `${item.emoji} ${item.name}`;
        outfitEl.appendChild(chip);
        slot++;
        if (slot < round.slots.length) {
          renderSlot();
          return;
        }
        btnsEl.innerHTML = "";
        const score = picks.reduce((s, it) => s + styleItemScore(it, round.theme), 0);
        const grade = styleGrade(score, round.maxScore);
        bubbleEl.textContent = `👗 搭配评分 ${score}/${round.maxScore} · ${grade.label}`;
        if (grade.stars >= 2) {
          ctx.sfx("coin");
          msgEl.textContent = grade.stars === 3
            ? `每一件都踩中${round.theme}，${catName()}上台啦！`
            : `这一套挺配${round.theme}的，可以出门咯！`;
          taskDone();
        } else {
          msgEl.textContent = `这套跟${round.theme}还差点意思，我们重搭一次～`;
          mistake(`没关系，看看主题再挑，${catName()}等着你！`);
          if (!ended) {
            later(() => {
              if (ended) return;
              picks.length = 0;
              slot = 0;
              outfitEl.innerHTML = "";
              bubbleEl.textContent = `👗 今天的主题：${round.theme}`;
              renderSlot();
            }, 900);
          }
        }
      });
    };
    renderSlot();
  }

  function startTask(): void {
    if (ended || destroyed) return;
    wrap.querySelectorAll(".kc-spot, .kc-toy").forEach((el) => el.remove());
    planEl.style.display = "none";
    outfitEl.innerHTML = "";
    activeCat = catForTask(taskIdx, catCount);
    renderCats();
    renderTop();
    const task = cfg.tasks[taskIdx];
    if (task === "feed") taskFeed();
    else if (task === "play") taskPlay();
    else if (task === "wash") taskWash();
    else if (task === "sleep") taskSleep();
    else if (task === "cure") taskCure();
    else if (task === "style") taskStyle();
    else taskDress();
  }

  renderTop();
  renderMood();
  renderCats();
  startTask();

  return {
    destroy() {
      destroyed = true;
      ended = true;
      intervals.forEach((t) => clearInterval(t));
      intervals.clear();
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      wrap.remove();
    },
  };
}

export function mount(api: GameApi): { destroy: () => void } {
  return mountLevelGame(api, {
    id: meta.id,
    chapters: CHAPTERS,
    playLevel,
    mapHint: "一次都不选错就是 3 星，小猫们最喜欢细心的你！",
    grandMessage: "188 天的照顾全部完成，小猫们已经离不开你啦！",
  });
}
