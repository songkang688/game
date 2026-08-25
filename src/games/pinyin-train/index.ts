import { makeQuestionForStage, type PinyinQuestion } from "./logic";

export const meta = {
  id: "pinyin-train",
  title: "拼音小火车",
  emoji: "🚂",
  category: "edu" as const,
  color: "#74c0fc",
  blurb: "三站旅行：认字母、辨声调、看图选音节，错题还能再练一遍！",
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

const CARS_PER_STATION = 5;
const STATIONS = [
  { name: "字母站", emoji: "🍎", desc: "认一认声母和韵母" },
  { name: "双胞胎站", emoji: "🌈", desc: "分清长得像的字母和声调" },
  { name: "音节站", emoji: "⭐", desc: "看图片选出正确的拼音" },
];
const CAR_COLORS = ["#ff8787", "#ffd43b", "#69db7c", "#b197fc", "#ffa94d"];
const PRAISES = ["答对啦！呜呜——出发！", "真棒！又多了一节车厢！", "好厉害！火车更长啦！", "太棒了，继续开！"];
const CHEERS = ["没关系，再想一想～", "再看看，你一定可以！", "别着急，慢慢来～"];

const CSS = `
.pt-wrap{height:100%;min-height:460px;display:flex;flex-direction:column;align-items:center;gap:10px;
  padding:14px;box-sizing:border-box;background:linear-gradient(#d0ebff 0 60%,#e9d8a6 60% 100%);
  border-radius:20px;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  user-select:none;-webkit-user-select:none;touch-action:manipulation;position:relative;}
.pt-top{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.pt-badge{font-size:15px;font-weight:800;color:#1864ab;background:#ffffffcc;border-radius:999px;padding:5px 14px;}
.pt-badge.pt-note{color:#e8590c;}
.pt-track{width:100%;max-width:520px;display:flex;align-items:flex-end;gap:4px;min-height:84px;overflow:hidden;
  border-bottom:6px solid #86633a;padding-bottom:2px;}
.pt-engine{font-size:56px;line-height:1;position:relative;}
.pt-engine .pt-cab{position:absolute;top:2px;left:12px;font-size:20px;font-weight:900;color:#fff;
  background:#1971c2;border-radius:8px;padding:0 6px;min-width:18px;text-align:center;}
.pt-car{min-width:52px;height:40px;border-radius:10px 10px 6px 6px;display:flex;align-items:center;justify-content:center;
  font-size:20px;font-weight:900;color:#fff;box-shadow:0 3px 0 #0002;animation:pt-in .5s;padding:0 4px;box-sizing:border-box;}
@keyframes pt-in{0%{transform:translateX(40px) scale(.5);opacity:0}100%{transform:none;opacity:1}}
.pt-prompt{font-size:24px;font-weight:800;color:#343a40;text-align:center;}
.pt-msg{min-height:26px;font-size:18px;font-weight:700;color:#e8590c;text-align:center;}
.pt-btns{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.pt-btn{min-width:96px;min-height:84px;font-size:38px;font-weight:800;color:#1864ab;border:none;cursor:pointer;
  border-radius:26px;background:#fff;box-shadow:0 6px 0 #a5d8ff;transition:transform .12s,opacity .2s;
  font-family:inherit;padding:0 12px;}
.pt-btn:active{transform:translateY(4px);box-shadow:0 2px 0 #a5d8ff;}
.pt-btn.pt-right{background:#d3f9d8;box-shadow:0 6px 0 #69db7c;animation:pt-pop .45s;}
.pt-btn.pt-wrong{opacity:.4;animation:pt-shake .4s;}
@keyframes pt-pop{0%{transform:scale(1)}50%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes pt-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.pt-overlay{position:absolute;inset:0;background:#e7f5ffde;display:flex;flex-direction:column;gap:14px;
  align-items:center;justify-content:center;border-radius:20px;z-index:10;text-align:center;padding:20px;box-sizing:border-box;}
.pt-ov-title{font-size:26px;font-weight:900;color:#1864ab;}
.pt-ov-sub{font-size:17px;font-weight:700;color:#868e96;line-height:1.6;}
.pt-ov-btn{min-height:60px;padding:0 34px;font-size:22px;font-weight:900;color:#fff;border:none;cursor:pointer;
  border-radius:999px;background:linear-gradient(135deg,#4dabf7,#1971c2);box-shadow:0 6px 0 #1864ab;font-family:inherit;}
.pt-ov-btn:active{transform:translateY(4px);box-shadow:0 2px 0 #1864ab;}
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
  wrap.className = "pt-wrap";
  wrap.innerHTML = `
    <div class="pt-top">
      <div class="pt-badge pt-station"></div>
      <div class="pt-badge pt-cars"></div>
      <div class="pt-badge pt-streak"></div>
      <div class="pt-badge pt-note"></div>
    </div>
    <div class="pt-track">
      <div class="pt-engine">🚂<span class="pt-cab"></span></div>
    </div>
    <div class="pt-prompt"></div>
    <div class="pt-btns"></div>
    <div class="pt-msg">小火车要出发啦，答对题目帮它挂车厢！</div>
  `;
  root.append(style, wrap);

  const stationEl = wrap.querySelector(".pt-station") as HTMLElement;
  const carsEl = wrap.querySelector(".pt-cars") as HTMLElement;
  const streakEl = wrap.querySelector(".pt-streak") as HTMLElement;
  const noteEl = wrap.querySelector(".pt-note") as HTMLElement;
  const trackEl = wrap.querySelector(".pt-track") as HTMLElement;
  const cabEl = wrap.querySelector(".pt-cab") as HTMLElement;
  const promptEl = wrap.querySelector(".pt-prompt") as HTMLElement;
  const btnsEl = wrap.querySelector(".pt-btns") as HTMLElement;
  const msgEl = wrap.querySelector(".pt-msg") as HTMLElement;

  let stationIdx = 0;
  let cars = 0;
  let wrongTotal = 0;
  let streak = 0;
  let locked = false;
  let reviewMode = false;
  let question: PinyinQuestion;
  /** 错题本：答错过的题目，终点站前再练 */
  const notebook: PinyinQuestion[] = [];
  let reviewQueue: PinyinQuestion[] = [];

  function updateHud() {
    if (reviewMode) {
      stationEl.textContent = "📒 错题再练";
      carsEl.textContent = `还剩 ${reviewQueue.length + 1} 题`;
    } else {
      const st = STATIONS[stationIdx];
      stationEl.textContent = `${st.emoji} 第${stationIdx + 1}站·${st.name}`;
      carsEl.textContent = `🚃 ${cars}/${CARS_PER_STATION}`;
    }
    streakEl.textContent = `🔥 连对 ${streak}`;
    noteEl.textContent = `📒 错题 ${notebook.length}`;
  }

  function clearCars() {
    trackEl.querySelectorAll(".pt-car").forEach((c) => c.remove());
  }

  function renderQuestion() {
    promptEl.textContent = question.prompt;
    cabEl.textContent = question.display;
    cabEl.style.display = question.display ? "" : "none";
    btnsEl.innerHTML = "";
    question.choices.forEach((letter, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pt-btn";
      btn.textContent = letter;
      btn.addEventListener("click", () => onChoice(btn, i));
      btnsEl.appendChild(btn);
    });
    locked = false;
    updateHud();
  }

  function nextQuestion() {
    if (reviewMode) {
      const q = reviewQueue.shift();
      if (!q) {
        finishAll();
        return;
      }
      question = q;
    } else {
      question = makeQuestionForStage((stationIdx + 1) as 1 | 2 | 3);
    }
    renderQuestion();
  }

  function showOverlay(title: string, sub: string, btnText: string, onNext: () => void) {
    const ov = document.createElement("div");
    ov.className = "pt-overlay";
    const t = document.createElement("div");
    t.className = "pt-ov-title";
    t.textContent = title;
    const s = document.createElement("div");
    s.className = "pt-ov-sub";
    s.textContent = sub;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pt-ov-btn";
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
    play("jump");
    const stars: 1 | 2 | 3 = wrongTotal === 0 ? 3 : wrongTotal <= 4 ? 2 : 1;
    const msg =
      notebook.length > 0
        ? "错题也全部练会啦，拼音小火车顺利到达终点站！"
        : "一路零失误，拼音小火车满载到站，你真棒！";
    onWin(stars, msg);
  }

  function stationDone() {
    play("coin");
    if (stationIdx < STATIONS.length - 1) {
      const next = STATIONS[stationIdx + 1];
      showOverlay(
        `🎉 到达${STATIONS[stationIdx].name}！`,
        `下一站是「${next.name}」：${next.desc}，呜呜——出发！`,
        `开往${next.name} ${next.emoji}`,
        () => {
          stationIdx++;
          cars = 0;
          clearCars();
          nextQuestion();
        }
      );
    } else if (notebook.length > 0) {
      showOverlay(
        "📒 终点站前的复习车厢",
        `三站都到啦！还有 ${notebook.length} 道题答错过，再练一遍就能进终点站咯～`,
        "开始再练",
        () => {
          reviewMode = true;
          reviewQueue = notebook.slice();
          clearCars();
          nextQuestion();
        }
      );
    } else {
      finishAll();
    }
  }

  function onChoice(btn: HTMLButtonElement, index: number) {
    if (locked) return;
    play("tap");
    if (index === question.answerIndex) {
      locked = true;
      streak++;
      play("coin");
      btn.classList.add("pt-right");
      let praise = PRAISES[Math.floor(Math.random() * PRAISES.length)];
      if (streak > 0 && streak % 4 === 0) {
        addStars(1);
        praise = `🔥 连对 ${streak} 题，奖励一颗小星星！`;
      }
      msgEl.textContent = praise;

      const car = document.createElement("div");
      car.className = "pt-car";
      car.style.background = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
      car.textContent = question.choices[question.answerIndex];
      trackEl.appendChild(car);

      if (reviewMode) {
        const idx = notebook.indexOf(question);
        if (idx >= 0) notebook.splice(idx, 1);
        updateHud();
        later(() => {
          if (reviewQueue.length === 0) finishAll();
          else nextQuestion();
        }, 900);
      } else {
        cars++;
        updateHud();
        later(() => {
          if (cars >= CARS_PER_STATION) stationDone();
          else nextQuestion();
        }, 900);
      }
    } else {
      wrongTotal++;
      streak = 0;
      play("oops");
      btn.classList.add("pt-wrong");
      btn.disabled = true;
      msgEl.textContent = CHEERS[Math.floor(Math.random() * CHEERS.length)];
      if (!reviewMode && !notebook.includes(question)) {
        notebook.push(question);
      }
      updateHud();
    }
  }

  updateHud();
  nextQuestion();

  return {
    destroy() {
      timers.forEach(clearTimeout);
      root.innerHTML = "";
    },
  };
}
