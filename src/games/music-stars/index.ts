import { makeSequence, TWINKLE_FINALE } from "./logic";

export const meta = {
  id: "music-stars",
  title: "音乐星星",
  emoji: "🌟",
  category: "create" as const,
  color: "#ffe066",
  blurb: "五首小曲子越弹越长，最后还有《一闪一闪亮晶晶》跟弹终曲！",
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

// 五声音阶 do re mi sol la，听起来怎么按都不难听
const NOTES = [
  { freq: 261.63, name: "哆", color: "#ff8787" },
  { freq: 293.66, name: "来", color: "#ffa94d" },
  { freq: 329.63, name: "咪", color: "#ffe066" },
  { freq: 392.0, name: "索", color: "#8ce99a" },
  { freq: 440.0, name: "拉", color: "#74c0fc" },
];

// 五首小曲子：乐句越来越长，但节奏依然很慢
const SONGS = [
  { name: "星星醒来", len: 3 },
  { name: "月光散步", len: 4 },
  { name: "银河秋千", len: 5 },
  { name: "流星滑梯", len: 6 },
  { name: "星空大合唱", len: 7 },
];
const NOTE_ON_MS = 750;
const NOTE_GAP_MS = 550;

const CSS = `
.ms-wrap{height:100%;min-height:440px;display:flex;flex-direction:column;align-items:center;gap:12px;
  padding:16px;box-sizing:border-box;background:linear-gradient(#1b2a5e,#3b4d8f);
  border-radius:20px;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  user-select:none;-webkit-user-select:none;touch-action:manipulation;}
.ms-top{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.ms-badge{font-size:15px;font-weight:800;color:#fff;background:#ffffff2b;border-radius:999px;padding:5px 14px;}
.ms-msg{min-height:30px;font-size:20px;font-weight:800;color:#ffe066;text-align:center;}
.ms-dots{display:flex;gap:8px;justify-content:center;min-height:18px;}
.ms-dot{width:14px;height:14px;border-radius:50%;background:#ffffff33;transition:background .2s,transform .2s;}
.ms-dot.ms-dot-on{background:#ffe066;transform:scale(1.25);}
.ms-stars{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;align-items:flex-end;min-height:130px;}
.ms-star{width:88px;height:110px;border:none;cursor:pointer;background:transparent;padding:0;
  display:flex;flex-direction:column;align-items:center;gap:4px;font-family:inherit;transition:transform .15s;}
.ms-star:active{transform:scale(.92);}
.ms-star .ms-face{font-size:58px;line-height:1;filter:grayscale(.55) brightness(.75);transition:filter .15s,transform .15s;}
.ms-star .ms-name{font-size:20px;font-weight:800;color:#c5cff3;}
.ms-star.ms-lit .ms-face{filter:none;transform:scale(1.28);text-shadow:0 0 24px #fff59b;}
.ms-star.ms-lit .ms-name{color:#fff;}
.ms-star.ms-hint .ms-face{filter:none;animation:ms-twinkle 1s infinite;}
@keyframes ms-twinkle{0%,100%{transform:scale(1)}50%{transform:scale(1.2);text-shadow:0 0 20px #fff59b}}
.ms-star:nth-child(odd){margin-top:18px;}
.ms-replay{min-height:56px;padding:8px 26px;font-size:20px;font-weight:800;color:#1b2a5e;border:none;
  cursor:pointer;border-radius:999px;background:#ffe066;box-shadow:0 5px 0 #d9b800;font-family:inherit;
  transition:transform .12s,opacity .2s;}
.ms-replay:active{transform:translateY(3px);box-shadow:0 2px 0 #d9b800;}
.ms-replay:disabled{opacity:.4;}
`;

export function mount(api: GameApi): { destroy: () => void } {
  const { root, play, addStars, onWin } = api;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (fn: () => void, ms: number) => {
    timers.push(setTimeout(fn, ms));
  };

  let audio: AudioContext | null = null;
  function tone(freq: number, ms: number) {
    try {
      if (!audio && typeof AudioContext !== "undefined") audio = new AudioContext();
      if (!audio) return;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = audio.currentTime;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.28, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      osc.connect(gain).connect(audio.destination);
      osc.start(t);
      osc.stop(t + ms / 1000 + 0.05);
    } catch {
      // 没有音频环境也不影响玩
    }
  }

  root.innerHTML = "";
  const style = document.createElement("style");
  style.textContent = CSS;
  const wrap = document.createElement("div");
  wrap.className = "ms-wrap";
  wrap.innerHTML = `
    <div class="ms-top">
      <div class="ms-badge ms-song"></div>
      <div class="ms-badge ms-len"></div>
    </div>
    <div class="ms-msg"></div>
    <div class="ms-dots"></div>
    <div class="ms-stars"></div>
    <button type="button" class="ms-replay">🔁 再听一遍</button>
  `;
  root.append(style, wrap);

  const songEl = wrap.querySelector(".ms-song") as HTMLElement;
  const lenEl = wrap.querySelector(".ms-len") as HTMLElement;
  const msgEl = wrap.querySelector(".ms-msg") as HTMLElement;
  const dotsEl = wrap.querySelector(".ms-dots") as HTMLElement;
  const starsEl = wrap.querySelector(".ms-stars") as HTMLElement;
  const replayBtn = wrap.querySelector(".ms-replay") as HTMLButtonElement;

  const starBtns: HTMLButtonElement[] = NOTES.map((note, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ms-star";
    btn.innerHTML = `<span class="ms-face">⭐</span><span class="ms-name">${note.name}</span>`;
    (btn.querySelector(".ms-name") as HTMLElement).style.color = note.color;
    btn.addEventListener("click", () => onStarTap(i));
    starsEl.appendChild(btn);
    return btn;
  });

  let roundIdx = 0;
  let seq: number[] = [];
  let inputPos = 0;
  let misses = 0;
  let phase: "watch" | "play" | "finale" | "done" = "watch";

  function lightStar(i: number, ms: number) {
    const btn = starBtns[i];
    btn.classList.add("ms-lit");
    tone(NOTES[i].freq, ms);
    later(() => btn.classList.remove("ms-lit"), ms);
  }

  function clearHints() {
    starBtns.forEach((b) => b.classList.remove("ms-hint"));
  }

  function updateHud() {
    if (phase === "finale") {
      songEl.textContent = "🎆 终曲·一闪一闪亮晶晶";
      lenEl.textContent = `♪ ${seq.length} 个音`;
    } else {
      songEl.textContent = `🎵 第${roundIdx + 1}/${SONGS.length}首·${SONGS[roundIdx].name}`;
      lenEl.textContent = `♪ ${SONGS[roundIdx].len} 个音`;
    }
  }

  function renderDots() {
    dotsEl.innerHTML = "";
    seq.forEach((_, i) => {
      const dot = document.createElement("div");
      dot.className = "ms-dot" + (i < inputPos ? " ms-dot-on" : "");
      dotsEl.appendChild(dot);
    });
  }

  function playSequence() {
    phase = "watch";
    replayBtn.disabled = true;
    msgEl.textContent = "小星星在唱歌，仔细看仔细听～";
    inputPos = 0;
    renderDots();
    seq.forEach((starIdx, k) => {
      later(() => lightStar(starIdx, NOTE_ON_MS), k * (NOTE_ON_MS + NOTE_GAP_MS) + 600);
    });
    const total = seq.length * (NOTE_ON_MS + NOTE_GAP_MS) + 700;
    later(() => {
      phase = "play";
      inputPos = 0;
      replayBtn.disabled = false;
      msgEl.textContent = "轮到你啦！按刚才的顺序点星星～";
    }, total);
  }

  function startRound() {
    // 限制相邻音跨度，长乐句也顺耳好记
    seq = makeSequence(SONGS[roundIdx].len, NOTES.length, Math.random, 2);
    updateHud();
    renderDots();
    playSequence();
  }

  function startFinale() {
    phase = "finale";
    seq = TWINKLE_FINALE.slice();
    inputPos = 0;
    updateHud();
    renderDots();
    replayBtn.disabled = true;
    msgEl.textContent = "🎆 终曲时间！跟着一闪一闪的星星弹《小星星》～";
    later(() => {
      starBtns[seq[0]].classList.add("ms-hint");
    }, 800);
  }

  function onStarTap(i: number) {
    if (phase === "finale") {
      if (i === seq[inputPos]) {
        clearHints();
        lightStar(i, 600);
        inputPos++;
        renderDots();
        if (inputPos >= seq.length) {
          phase = "done";
          play("coin");
          msgEl.textContent = "🎇 一闪一闪亮晶晶，弹完整首啦！";
          addStars(1);
          later(() => {
            const stars: 1 | 2 | 3 = misses === 0 ? 3 : misses <= 3 ? 2 : 1;
            onWin(stars, "五首小曲加终曲全部弹完，你是小小音乐家！");
          }, 1400);
        } else {
          starBtns[seq[inputPos]].classList.add("ms-hint");
        }
      } else {
        lightStar(i, 300);
        msgEl.textContent = "看看哪颗星星在一闪一闪，点它～";
      }
      return;
    }
    if (phase !== "play") return;
    lightStar(i, 500);
    if (i === seq[inputPos]) {
      inputPos++;
      renderDots();
      if (inputPos >= seq.length) {
        phase = "watch";
        replayBtn.disabled = true;
        play("coin");
        msgEl.textContent = "弹对啦！真好听！🎵";
        later(() => {
          roundIdx++;
          if (roundIdx >= SONGS.length) {
            startFinale();
          } else {
            startRound();
          }
        }, 1200);
      }
    } else {
      misses++;
      play("oops");
      msgEl.textContent = "没关系，我们再听一遍，慢慢来～";
      phase = "watch";
      later(() => playSequence(), 1000);
    }
  }

  replayBtn.addEventListener("click", () => {
    if (phase !== "play") return;
    play("tap");
    playSequence();
  });

  startRound();

  return {
    destroy() {
      timers.forEach(clearTimeout);
      if (audio) {
        audio.close().catch(() => {});
        audio = null;
      }
      root.innerHTML = "";
    },
  };
}
