import { makeSequence } from "./logic";

export const meta = {
  id: "music-stars",
  title: "音乐星星",
  emoji: "🌟",
  category: "create" as const,
  color: "#ffe066",
  blurb: "小星星慢慢唱歌，看谁在发光，跟着点一遍！",
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

// 每一关的旋律长度，节奏非常慢
const ROUNDS = [2, 3, 4];
const NOTE_ON_MS = 750;
const NOTE_GAP_MS = 550;

const CSS = `
.ms-wrap{height:100%;min-height:420px;display:flex;flex-direction:column;align-items:center;gap:14px;
  padding:16px;box-sizing:border-box;background:linear-gradient(#1b2a5e,#3b4d8f);
  border-radius:20px;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  user-select:none;-webkit-user-select:none;touch-action:manipulation;}
.ms-title{font-size:20px;font-weight:700;color:#fff;background:#ffffff2b;border-radius:999px;padding:6px 18px;}
.ms-msg{min-height:30px;font-size:22px;font-weight:800;color:#ffe066;text-align:center;}
.ms-stars{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;align-items:flex-end;min-height:130px;}
.ms-star{width:88px;height:110px;border:none;cursor:pointer;background:transparent;padding:0;
  display:flex;flex-direction:column;align-items:center;gap:4px;font-family:inherit;transition:transform .15s;}
.ms-star:active{transform:scale(.92);}
.ms-star .ms-face{font-size:58px;line-height:1;filter:grayscale(.55) brightness(.75);transition:filter .15s,transform .15s;}
.ms-star .ms-name{font-size:20px;font-weight:800;color:#c5cff3;}
.ms-star.ms-lit .ms-face{filter:none;transform:scale(1.28);text-shadow:0 0 24px #fff59b;}
.ms-star.ms-lit .ms-name{color:#fff;}
.ms-star:nth-child(odd){margin-top:18px;}
.ms-replay{min-height:56px;padding:8px 26px;font-size:20px;font-weight:800;color:#1b2a5e;border:none;
  cursor:pointer;border-radius:999px;background:#ffe066;box-shadow:0 5px 0 #d9b800;font-family:inherit;
  transition:transform .12s,opacity .2s;}
.ms-replay:active{transform:translateY(3px);box-shadow:0 2px 0 #d9b800;}
.ms-replay:disabled{opacity:.4;}
`;

export function mount(api: GameApi): { destroy: () => void } {
  const { root, play, onWin } = api;
  const timers: number[] = [];
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
    <div class="ms-title"></div>
    <div class="ms-msg"></div>
    <div class="ms-stars"></div>
    <button type="button" class="ms-replay">🔁 再听一遍</button>
  `;
  root.append(style, wrap);

  const titleEl = wrap.querySelector(".ms-title") as HTMLElement;
  const msgEl = wrap.querySelector(".ms-msg") as HTMLElement;
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
  let phase: "watch" | "play" | "done" = "watch";

  function lightStar(i: number, ms: number) {
    const btn = starBtns[i];
    btn.classList.add("ms-lit");
    tone(NOTES[i].freq, ms);
    later(() => btn.classList.remove("ms-lit"), ms);
  }

  function updateTitle() {
    titleEl.textContent = `第 ${roundIdx + 1} / ${ROUNDS.length} 首小曲子`;
  }

  function playSequence() {
    phase = "watch";
    replayBtn.disabled = true;
    msgEl.textContent = "小星星在唱歌，仔细看仔细听～";
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
    seq = makeSequence(ROUNDS[roundIdx], NOTES.length);
    updateTitle();
    playSequence();
  }

  function onStarTap(i: number) {
    if (phase !== "play") return;
    lightStar(i, 500);
    if (i === seq[inputPos]) {
      inputPos++;
      if (inputPos >= seq.length) {
        phase = "watch";
        replayBtn.disabled = true;
        play("coin");
        msgEl.textContent = "弹对啦！真好听！🎵";
        later(() => {
          roundIdx++;
          if (roundIdx >= ROUNDS.length) {
            phase = "done";
            const stars: 1 | 2 | 3 = misses === 0 ? 3 : misses <= 2 ? 2 : 1;
            onWin(stars, "三首小曲子都弹出来啦，你是小小音乐家！");
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
