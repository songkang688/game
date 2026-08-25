import {
  makeQuestionFrom,
  makeReviewQuestion,
  WORD_LEVELS,
  type WordCard,
  type WordQuestion,
} from "./logic";

export const meta = {
  id: "word-garden",
  title: "识字小花园",
  emoji: "🌸",
  category: "edu" as const,
  color: "#faa2c1",
  blurb: "三座主题花园 54 个汉字，答对种花，错题本帮你再练一遍！",
};

type SoundName = "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump";

export type GameApi = {
  root: HTMLElement;
  play: (name: SoundName) => void;
  addStars: (n: number) => number;
  getStars: () => number;
  onWin: (stars: 1 | 2 | 3, message?: string) => void;
  onLose: (message?: string) => void;
};

const FLOWERS_PER_GARDEN = 6;
const FLOWERS = ["🌷", "🌸", "🌻", "🌼", "🌺", "💐"];
const PRAISES = ["认对啦，真聪明！", "好棒呀！", "你认识的字真多！", "太厉害了！"];
const CHEERS = ["没关系，再看看图片提示～", "再想一想，你一定行！", "慢慢来，加油哦～"];

const CSS = `
.wg-wrap{height:100%;min-height:460px;display:flex;flex-direction:column;align-items:center;gap:10px;
  padding:14px;box-sizing:border-box;background:linear-gradient(#e3fafc 0 55%,#d3f9d8 55% 100%);
  border-radius:20px;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  user-select:none;-webkit-user-select:none;touch-action:manipulation;position:relative;}
.wg-top{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;align-items:center;}
.wg-badge{font-size:15px;font-weight:800;color:#0b7285;background:#ffffffcc;border-radius:999px;padding:5px 14px;}
.wg-badge.wg-note{color:#e8590c;}
.wg-badge.wg-streak{color:#ae3ec9;}
.wg-pic{font-size:64px;line-height:1.1;filter:drop-shadow(0 4px 4px #0002);}
.wg-hint{font-size:22px;font-weight:800;color:#495057;text-align:center;}
.wg-hint .wg-py{color:#e64980;font-size:28px;margin-left:8px;}
.wg-msg{min-height:26px;font-size:18px;font-weight:700;color:#e8590c;text-align:center;}
.wg-btns{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.wg-btn{min-width:88px;min-height:88px;font-size:48px;font-weight:800;color:#343a40;border:none;cursor:pointer;
  border-radius:26px;background:#fff;box-shadow:0 6px 0 #d0bfff;transition:transform .12s,opacity .2s;
  font-family:inherit;}
.wg-btn:active{transform:translateY(4px);box-shadow:0 2px 0 #d0bfff;}
.wg-btn.wg-right{background:#d3f9d8;box-shadow:0 6px 0 #69db7c;animation:wg-pop .45s;}
.wg-btn.wg-wrong{opacity:.4;animation:wg-shake .4s;}
@keyframes wg-pop{0%{transform:scale(1)}50%{transform:scale(1.18)}100%{transform:scale(1)}}
@keyframes wg-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.wg-garden{display:flex;gap:8px;font-size:36px;min-height:48px;align-items:flex-end;
  background:#96f2d7aa;border-radius:16px;padding:6px 16px;}
.wg-plot{width:42px;text-align:center;transition:transform .3s;position:relative;}
.wg-plot.wg-new{animation:wg-grow .6s;}
@keyframes wg-grow{0%{transform:scale(0)}70%{transform:scale(1.25)}100%{transform:scale(1)}}
.wg-fly{position:absolute;font-size:30px;animation:wg-flyby 1.6s ease-out forwards;pointer-events:none;z-index:5;}
@keyframes wg-flyby{0%{transform:translate(0,0) scale(.6);opacity:0}30%{opacity:1}
  100%{transform:translate(-30px,-90px) scale(1.2);opacity:0}}
.wg-overlay{position:absolute;inset:0;background:#fff5fade;display:flex;flex-direction:column;gap:14px;
  align-items:center;justify-content:center;border-radius:20px;z-index:10;text-align:center;padding:20px;box-sizing:border-box;}
.wg-ov-title{font-size:26px;font-weight:900;color:#0b7285;}
.wg-ov-sub{font-size:17px;font-weight:700;color:#868e96;line-height:1.6;}
.wg-ov-btn{min-height:60px;padding:0 34px;font-size:22px;font-weight:900;color:#fff;border:none;cursor:pointer;
  border-radius:999px;background:linear-gradient(135deg,#f783ac,#e64980);box-shadow:0 6px 0 #c2255c;font-family:inherit;}
.wg-ov-btn:active{transform:translateY(4px);box-shadow:0 2px 0 #c2255c;}
`;

export function mount(api: GameApi): { destroy: () => void } {
  const { root, play, addStars, onWin } = api;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (fn: () => void, ms: number) => {
    timers.push(setTimeout(fn, ms));
  };

  root.innerHTML = "";
  const style = document.createElement("style");
  style.textContent = CSS;
  const wrap = document.createElement("div");
  wrap.className = "wg-wrap";
  wrap.innerHTML = `
    <div class="wg-top">
      <div class="wg-badge wg-level"></div>
      <div class="wg-badge wg-flower"></div>
      <div class="wg-badge wg-streak"></div>
      <div class="wg-badge wg-note"></div>
    </div>
    <div class="wg-pic"></div>
    <div class="wg-hint"></div>
    <div class="wg-btns"></div>
    <div class="wg-msg">看看图片，找出正确的汉字吧～</div>
    <div class="wg-garden"></div>
  `;
  root.append(style, wrap);

  const levelEl = wrap.querySelector(".wg-level") as HTMLElement;
  const flowerEl = wrap.querySelector(".wg-flower") as HTMLElement;
  const streakEl = wrap.querySelector(".wg-streak") as HTMLElement;
  const noteEl = wrap.querySelector(".wg-note") as HTMLElement;
  const picEl = wrap.querySelector(".wg-pic") as HTMLElement;
  const hintEl = wrap.querySelector(".wg-hint") as HTMLElement;
  const btnsEl = wrap.querySelector(".wg-btns") as HTMLElement;
  const msgEl = wrap.querySelector(".wg-msg") as HTMLElement;
  const gardenEl = wrap.querySelector(".wg-garden") as HTMLElement;

  let levelIdx = 0;
  let planted = 0;
  let wrongTotal = 0;
  let streak = 0;
  let locked = false;
  let reviewMode = false;
  let question: WordQuestion;
  let used: string[] = [];
  /** 错题本：答错过的字卡（去重） */
  const notebook: WordCard[] = [];
  let reviewQueue: WordCard[] = [];

  function updateHud() {
    if (reviewMode) {
      levelEl.textContent = "📒 错题本再练";
      flowerEl.textContent = `还剩 ${reviewQueue.length + 1} 个字`;
    } else {
      const lv = WORD_LEVELS[levelIdx];
      levelEl.textContent = `${lv.emoji} 第${levelIdx + 1}座·${lv.name}`;
      flowerEl.textContent = `🌸 ${planted}/${FLOWERS_PER_GARDEN}`;
    }
    streakEl.textContent = `🔥 连对 ${streak}`;
    noteEl.textContent = `📒 错题 ${notebook.length}`;
  }

  function buildGarden() {
    gardenEl.innerHTML = "";
    for (let i = 0; i < FLOWERS_PER_GARDEN; i++) {
      const plot = document.createElement("div");
      plot.className = "wg-plot";
      plot.textContent = "🟫";
      gardenEl.appendChild(plot);
    }
  }

  function renderQuestion() {
    picEl.textContent = question.target.emoji;
    hintEl.innerHTML = `这是「${question.target.word}」<span class="wg-py">${question.target.pinyin}</span>`;
    btnsEl.innerHTML = "";
    question.choices.forEach((card, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wg-btn";
      btn.textContent = card.char;
      btn.addEventListener("click", () => onChoice(btn, i));
      btnsEl.appendChild(btn);
    });
    locked = false;
    updateHud();
  }

  function nextQuestion() {
    if (reviewMode) {
      const card = reviewQueue.shift();
      if (!card) {
        finishAll();
        return;
      }
      question = makeReviewQuestion(card);
    } else {
      question = makeQuestionFrom(WORD_LEVELS[levelIdx].cards, Math.random, used);
      used.push(question.target.char);
    }
    renderQuestion();
  }

  function showOverlay(title: string, sub: string, btnText: string, onNext: () => void) {
    const ov = document.createElement("div");
    ov.className = "wg-overlay";
    const t = document.createElement("div");
    t.className = "wg-ov-title";
    t.textContent = title;
    const s = document.createElement("div");
    s.className = "wg-ov-sub";
    s.textContent = sub;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "wg-ov-btn";
    b.textContent = btnText;
    b.addEventListener("click", () => {
      play("tap");
      ov.remove();
      onNext();
    });
    ov.append(t, s, b);
    wrap.appendChild(ov);
  }

  function finishAll() {
    play("coin");
    const stars: 1 | 2 | 3 = wrongTotal === 0 ? 3 : wrongTotal <= 4 ? 2 : 1;
    const msg =
      notebook.length > 0
        ? "错题本也全部练会啦，三座花园都开满花！"
        : "一次都没错，三座花园都开满花，你太棒啦！";
    onWin(stars, msg);
  }

  function gardenDone() {
    if (levelIdx < WORD_LEVELS.length - 1) {
      const next = WORD_LEVELS[levelIdx + 1];
      showOverlay(
        `🎉 ${WORD_LEVELS[levelIdx].name}开满花啦！`,
        `下一座是「${next.name}」，主题是${next.desc}，继续加油！`,
        `去${next.name} ${next.emoji}`,
        () => {
          levelIdx++;
          planted = 0;
          used = [];
          buildGarden();
          nextQuestion();
        }
      );
    } else if (notebook.length > 0) {
      showOverlay(
        "📒 打开错题本",
        `三座花园都种好啦！还有 ${notebook.length} 个字答错过，再练一遍就全学会咯～`,
        "开始再练",
        () => {
          reviewMode = true;
          reviewQueue = notebook.slice();
          nextQuestion();
        }
      );
    } else {
      finishAll();
    }
  }

  function flyButterfly() {
    const fly = document.createElement("div");
    fly.className = "wg-fly";
    fly.textContent = "🦋";
    fly.style.left = `${30 + Math.random() * 40}%`;
    fly.style.top = "55%";
    wrap.appendChild(fly);
    later(() => fly.remove(), 1700);
  }

  function onChoice(btn: HTMLButtonElement, index: number) {
    if (locked) return;
    play("tap");
    if (index === question.answerIndex) {
      locked = true;
      streak++;
      play("pop");
      btn.classList.add("wg-right");
      let praise = `${PRAISES[Math.floor(Math.random() * PRAISES.length)]}「${question.target.char}」就是${question.target.word}的${question.target.char}！`;
      if (streak > 0 && streak % 4 === 0) {
        addStars(1);
        flyButterfly();
        praise = `🦋 连对 ${streak} 题，蝴蝶送来一颗小星星！`;
      }
      msgEl.textContent = praise;

      if (reviewMode) {
        const idx = notebook.findIndex((c) => c.char === question.target.char);
        if (idx >= 0) notebook.splice(idx, 1);
        updateHud();
        later(() => {
          if (reviewQueue.length === 0) finishAll();
          else nextQuestion();
        }, 1100);
      } else {
        planted++;
        const plot = gardenEl.children[planted - 1] as HTMLElement;
        plot.textContent = FLOWERS[(planted - 1) % FLOWERS.length];
        plot.classList.add("wg-new");
        updateHud();
        later(() => {
          if (planted >= FLOWERS_PER_GARDEN) gardenDone();
          else nextQuestion();
        }, 1100);
      }
    } else {
      wrongTotal++;
      streak = 0;
      play("oops");
      btn.classList.add("wg-wrong");
      btn.disabled = true;
      msgEl.textContent = CHEERS[Math.floor(Math.random() * CHEERS.length)];
      if (!notebook.some((c) => c.char === question.target.char)) {
        notebook.push(question.target);
      }
      updateHud();
    }
  }

  buildGarden();
  updateHud();
  nextQuestion();

  return {
    destroy() {
      timers.forEach(clearTimeout);
      root.innerHTML = "";
    },
  };
}
