import { mountLevelGame, rateBelow, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { buildMelodies, CHAPTERS, LEVELS, type MusicLevel } from "./levels";

export const meta = {
  id: "music-stars",
  title: "音乐星星",
  emoji: "🌟",
  category: "create" as const,
  color: "#ffe066",
  blurb: "六大音乐会 99 关！星星越加越多、回声森林凭记忆弹，还有小星星终曲！",
};

// 五声音阶 do re mi sol la，听起来怎么按都不难听
const NOTES = [
  { freq: 261.63, name: "哆", color: "#ff8787" },
  { freq: 293.66, name: "来", color: "#ffa94d" },
  { freq: 329.63, name: "咪", color: "#ffe066" },
  { freq: 392.0, name: "索", color: "#8ce99a" },
  { freq: 440.0, name: "拉", color: "#74c0fc" },
];

const THEME_BG = [
  "linear-gradient(#27408b,#3b5bad)",
  "linear-gradient(#4a2a6b,#6b3fa0)",
  "linear-gradient(#1b2a5e,#3b4d8f)",
  "linear-gradient(#1e4636,#2d6a4f)",
  "linear-gradient(#5c3900,#8a5a00)",
  "linear-gradient(#3d1e5f,#7b2d8b)",
];

const CSS = `
.ms-wrap{min-height:420px;display:flex;flex-direction:column;align-items:center;gap:12px;
  padding:16px;box-sizing:border-box;border-radius:16px;
  font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  user-select:none;-webkit-user-select:none;touch-action:manipulation;}
.ms-top{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.ms-badge{font-size:14px;font-weight:800;color:#fff;background:#ffffff2b;border-radius:999px;padding:5px 12px;}
.ms-msg{min-height:28px;font-size:18px;font-weight:800;color:#ffe066;text-align:center;}
.ms-dots{display:flex;gap:8px;justify-content:center;min-height:18px;}
.ms-dot{width:14px;height:14px;border-radius:50%;background:#ffffff33;transition:background .2s,transform .2s;}
.ms-dot.ms-dot-on{background:#ffe066;transform:scale(1.25);}
.ms-stars{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;align-items:flex-end;min-height:126px;}
.ms-star{width:80px;height:106px;border:none;cursor:pointer;background:transparent;padding:0;
  display:flex;flex-direction:column;align-items:center;gap:4px;font-family:inherit;transition:transform .15s;}
.ms-star:active{transform:scale(.92);}
.ms-star .ms-face{font-size:52px;line-height:1;filter:grayscale(.55) brightness(.75);transition:filter .15s,transform .15s;}
.ms-star .ms-name{font-size:19px;font-weight:800;color:#c5cff3;}
.ms-star.ms-lit .ms-face{filter:none;transform:scale(1.28);text-shadow:0 0 24px #fff59b;}
.ms-star.ms-lit .ms-name{color:#fff;}
.ms-star.ms-hint .ms-face{filter:none;animation:ms-twinkle 1s infinite;}
@keyframes ms-twinkle{0%,100%{transform:scale(1)}50%{transform:scale(1.2);text-shadow:0 0 20px #fff59b}}
.ms-star:nth-child(odd){margin-top:16px;}
.ms-replay{min-height:52px;padding:8px 24px;font-size:18px;font-weight:800;color:#1b2a5e;border:none;
  cursor:pointer;border-radius:999px;background:#ffe066;box-shadow:0 5px 0 #d9b800;font-family:inherit;
  transition:transform .12s,opacity .2s;}
.ms-replay:active{transform:translateY(3px);box-shadow:0 2px 0 #d9b800;}
.ms-replay:disabled{opacity:.4;}
`;

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: MusicLevel = LEVELS[ctx.level];
  const melodies = buildMelodies(ctx.level);
  const noteGap = Math.round(cfg.noteMs * 0.7);
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let destroyed = false;
  let ended = false;
  let roundIdx = 0;
  let seq: number[] = melodies[0];
  let inputPos = 0;
  let misses = 0;
  let replaysLeft = cfg.replays;
  let phase: "watch" | "play" | "finale" = "watch";

  let audio: AudioContext | null = null;
  function tone(freq: number, ms: number): void {
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

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed && !ended) fn();
    }, ms);
    timeouts.add(t);
  }

  const wrap = document.createElement("div");
  wrap.className = "ms-wrap";
  wrap.style.background = THEME_BG[cfg.theme];
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="ms-top">
      <div class="ms-badge ms-song"></div>
      <div class="ms-badge ms-len">♪ ${cfg.seqLen} 个音</div>
      <div class="ms-badge ms-miss">💗 剩 ${cfg.maxMiss - misses + 1} 次机会</div>
    </div>
    <div class="ms-msg"></div>
    <div class="ms-dots"></div>
    <div class="ms-stars"></div>
    <button type="button" class="ms-replay">🔁 再听一遍</button>
  `;
  stage.appendChild(wrap);

  const songEl = wrap.querySelector(".ms-song") as HTMLElement;
  const lenEl = wrap.querySelector(".ms-len") as HTMLElement;
  const missEl = wrap.querySelector(".ms-miss") as HTMLElement;
  const msgEl = wrap.querySelector(".ms-msg") as HTMLElement;
  const dotsEl = wrap.querySelector(".ms-dots") as HTMLElement;
  const starsEl = wrap.querySelector(".ms-stars") as HTMLElement;
  const replayBtn = wrap.querySelector(".ms-replay") as HTMLButtonElement;

  const starBtns: HTMLButtonElement[] = NOTES.slice(0, cfg.starCount).map((note, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ms-star";
    btn.innerHTML = `<span class="ms-face">⭐</span><span class="ms-name">${note.name}</span>`;
    (btn.querySelector(".ms-name") as HTMLElement).style.color = note.color;
    btn.addEventListener("click", () => onStarTap(i));
    starsEl.appendChild(btn);
    return btn;
  });

  function lightStar(i: number, ms: number): void {
    const btn = starBtns[i];
    if (!btn) return;
    btn.classList.add("ms-lit");
    tone(NOTES[i].freq, ms);
    later(() => btn.classList.remove("ms-lit"), ms);
  }

  function isFinaleRound(): boolean {
    return cfg.finale && roundIdx === melodies.length - 1;
  }

  function updateHud(): void {
    songEl.textContent = isFinaleRound()
      ? "🎆 终曲·一闪一闪亮晶晶"
      : `🎵 第 ${roundIdx + 1}/${melodies.length} 句`;
    lenEl.textContent = `♪ ${seq.length} 个音`;
    missEl.textContent = `💗 剩 ${Math.max(0, cfg.maxMiss - misses + 1)} 次机会`;
    if (cfg.replays >= 0 && !isFinaleRound()) {
      replayBtn.textContent = `🔁 再听一遍（剩 ${replaysLeft} 次）`;
    }
  }

  function renderDots(): void {
    dotsEl.innerHTML = "";
    seq.forEach((_, i) => {
      const dot = document.createElement("div");
      dot.className = "ms-dot" + (i < inputPos ? " ms-dot-on" : "");
      dotsEl.appendChild(dot);
    });
  }

  function playSequence(): void {
    phase = "watch";
    replayBtn.disabled = true;
    msgEl.textContent = cfg.replays >= 0 ? "重听次数有限，用心记住旋律～" : "小星星在唱歌，仔细看仔细听～";
    inputPos = 0;
    renderDots();
    seq.forEach((starIdx, k) => {
      later(() => lightStar(starIdx, cfg.noteMs), k * (cfg.noteMs + noteGap) + 600);
    });
    later(() => {
      phase = "play";
      replayBtn.disabled = cfg.replays >= 0 && replaysLeft <= 0;
      msgEl.textContent = "轮到你啦！按刚才的顺序点星星～";
    }, seq.length * (cfg.noteMs + noteGap) + 700);
  }

  function startFinale(): void {
    phase = "finale";
    inputPos = 0;
    updateHud();
    renderDots();
    replayBtn.disabled = true;
    msgEl.textContent = "🎆 终曲！跟着一闪一闪的星星弹《小星星》～";
    later(() => starBtns[seq[0]]?.classList.add("ms-hint"), 700);
  }

  function startRound(): void {
    seq = melodies[roundIdx];
    inputPos = 0;
    updateHud();
    renderDots();
    if (isFinaleRound()) startFinale();
    else playSequence();
  }

  function clearHints(): void {
    starBtns.forEach((b) => b.classList.remove("ms-hint"));
  }

  function finish(): void {
    ended = true;
    const got = rateBelow(misses, 0, 2);
    ctx.win(got, misses === 0 ? "一个音都没弹错，太好听啦！" : "整关旋律全部弹完，真好听！");
  }

  function onMiss(): void {
    misses++;
    ctx.sfx("oops");
    updateHud();
    if (misses > cfg.maxMiss) {
      ended = true;
      ctx.lose("旋律有点长，我们休息一下耳朵再来～");
      return;
    }
    msgEl.textContent = "没关系，我们再听一遍，慢慢来～";
    phase = "watch";
    later(() => playSequence(), 900);
  }

  function onStarTap(i: number): void {
    if (ended) return;
    if (phase === "finale") {
      if (i === seq[inputPos]) {
        clearHints();
        lightStar(i, 550);
        inputPos++;
        renderDots();
        if (inputPos >= seq.length) {
          ctx.sfx("coin");
          msgEl.textContent = "🎇 一闪一闪亮晶晶，弹完整首啦！";
          later(() => finish(), 900);
        } else {
          starBtns[seq[inputPos]]?.classList.add("ms-hint");
        }
      } else {
        lightStar(i, 260);
        msgEl.textContent = "看看哪颗星星在一闪一闪，点它～";
      }
      return;
    }
    if (phase !== "play") return;
    lightStar(i, Math.min(500, cfg.noteMs));
    if (i === seq[inputPos]) {
      inputPos++;
      renderDots();
      if (inputPos >= seq.length) {
        phase = "watch";
        replayBtn.disabled = true;
        ctx.sfx("coin");
        msgEl.textContent = "弹对啦！真好听！🎵";
        later(() => {
          roundIdx++;
          if (roundIdx >= melodies.length) finish();
          else startRound();
        }, 1000);
      }
    } else {
      onMiss();
    }
  }

  replayBtn.addEventListener("click", () => {
    if (phase !== "play" || ended) return;
    if (cfg.replays >= 0) {
      if (replaysLeft <= 0) return;
      replaysLeft--;
    }
    ctx.sfx("tap");
    updateHud();
    playSequence();
  });

  updateHud();
  startRound();

  return {
    destroy() {
      destroyed = true;
      ended = true;
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      if (audio) {
        audio.close().catch(() => {});
        audio = null;
      }
      wrap.remove();
    }
  };
}

export function mount(api: GameApi): { destroy: () => void } {
  return mountLevelGame(api, {
    id: meta.id,
    chapters: CHAPTERS,
    mapHint: "每一关都是一段新旋律，弹给星星听～",
    grandMessage: "99 关全部弹完，你是闪闪发光的小小音乐家！",
    playLevel,
  });
}
