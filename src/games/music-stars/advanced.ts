/**
 * 音乐星星 1.1 新玩法（第 100–188 关）。
 *
 * 前 99 关一直是「听一句、跟弹一句」，这里四种玩法都换了考点：
 *   rhythm   节奏鼓点坡——不管音高，只跟长短音（两个鼓点键）；
 *   interval 音程听辨馆——先后放两个音，答出往上/往下几格；
 *   duet     双声部合奏厅——一拍两个音，两颗星星都要按到；
 *   score    简谱视奏台——不放范奏，照着简谱直接弹。
 * 失败文案一律只安抚，绝不说孩子不行。
 */
import { rateBelow, type PlayCtx, type PlayHandle } from "../level99";
import { buildDuets, buildIntervals, buildRhythms, buildScores, type MusicLevel } from "./levels";
import { intervalLabel, toScore } from "./logic";

export interface AdvancedNote {
  freq: number;
  name: string;
  color: string;
}

export interface AdvancedOptions {
  stage: HTMLElement;
  ctx: PlayCtx;
  cfg: MusicLevel;
  level: number;
  notes: AdvancedNote[];
  background: string;
}

/** 节奏关里长音 / 短音的实际时长（毫秒），纯函数便于测试 */
export function beatMs(base: number, long: boolean): number {
  return Math.round(base * (long ? 1.6 : 0.6));
}

/** 每种新玩法的一句话说明 */
export function modeIntro(mode: MusicLevel["mode"]): string {
  switch (mode) {
    case "rhythm":
      return "只听长短，不看音高：短音点小鼓，长音点大鼓～";
    case "interval":
      return "先后两个音，听出它是往上还是往下、差几格～";
    case "duet":
      return "一拍两个音，两颗星星都要按到才算数～";
    default:
      return "这一关没有范奏，照着简谱一个一个弹下去～";
  }
}

const CSS = `
.ma-wrap{min-height:420px;display:flex;flex-direction:column;align-items:center;gap:12px;padding:16px;
  box-sizing:border-box;border-radius:16px;user-select:none;-webkit-user-select:none;touch-action:manipulation;
  font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;}
.ma-top{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.ma-badge{font-size:14px;font-weight:800;color:#fff;background:#ffffff2b;border-radius:999px;padding:5px 12px;}
.ma-msg{min-height:28px;font-size:17px;font-weight:800;color:#ffe066;text-align:center;line-height:1.4;}
.ma-score{font-size:26px;font-weight:900;color:#fff;letter-spacing:8px;background:#ffffff1f;border-radius:14px;
  padding:10px 16px;text-align:center;line-height:1.5;}
.ma-score .ma-cur{color:#ffe066;text-shadow:0 0 16px #ffe06699;}
.ma-dots{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;min-height:18px;}
.ma-dot{width:14px;height:14px;border-radius:50%;background:#ffffff33;transition:background .2s,transform .2s;}
.ma-dot.ma-on{background:#ffe066;transform:scale(1.25);}
.ma-dot.ma-long{width:26px;border-radius:8px;}
.ma-keys{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;align-items:flex-end;min-height:126px;}
.ma-star{width:78px;height:104px;border:none;cursor:pointer;background:transparent;padding:0;font-family:inherit;
  display:flex;flex-direction:column;align-items:center;gap:4px;transition:transform .15s;}
.ma-star:active{transform:scale(.92);}
.ma-star .ma-face{font-size:50px;line-height:1;filter:grayscale(.55) brightness(.75);transition:filter .15s,transform .15s;}
.ma-star .ma-name{font-size:18px;font-weight:800;color:#c5cff3;}
.ma-star.ma-lit .ma-face{filter:none;transform:scale(1.26);text-shadow:0 0 24px #fff59b;}
.ma-star.ma-lit .ma-name{color:#fff;}
.ma-drum{min-width:132px;min-height:96px;border:none;border-radius:20px;cursor:pointer;font-family:inherit;
  font-size:19px;font-weight:900;color:#3b2a00;background:#ffe066;box-shadow:0 6px 0 #d9b800;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;}
.ma-drum:active{transform:translateY(3px);box-shadow:0 3px 0 #d9b800;}
.ma-drum .ma-drum-face{font-size:34px;}
.ma-drum.ma-lit{background:#fff3bf;transform:scale(1.06);}
.ma-choices{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}
.ma-choice{min-width:112px;min-height:64px;border:none;border-radius:18px;cursor:pointer;font-family:inherit;
  font-size:19px;font-weight:900;color:#1b2a5e;background:#fff;box-shadow:0 5px 0 #ffffff5c;}
.ma-choice:active{transform:translateY(3px);box-shadow:0 2px 0 #ffffff5c;}
.ma-choice.ma-bad{opacity:.45;}
.ma-replay{min-height:52px;padding:8px 24px;font-size:18px;font-weight:800;color:#1b2a5e;border:none;cursor:pointer;
  border-radius:999px;background:#ffe066;box-shadow:0 5px 0 #d9b800;font-family:inherit;}
.ma-replay:active{transform:translateY(3px);box-shadow:0 2px 0 #d9b800;}
.ma-replay:disabled{opacity:.4;}
.ma-star:focus-visible,.ma-drum:focus-visible,.ma-choice:focus-visible,.ma-replay:focus-visible{
  outline:3px solid #fff;outline-offset:3px;}
@media (max-width:420px){
  .ma-star{width:64px;height:92px;}
  .ma-star .ma-face{font-size:40px;}
  .ma-drum{min-width:108px;min-height:84px;font-size:17px;}
  .ma-score{font-size:22px;letter-spacing:6px;}
}
`;

export function playAdvancedLevel(opts: AdvancedOptions): PlayHandle {
  const { stage, ctx, cfg, level, notes } = opts;
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let destroyed = false;
  let ended = false;
  let misses = 0;
  let roundIdx = 0;
  let inputPos = 0;
  let replaysLeft = cfg.replays;
  let listening = false;

  const rhythms = cfg.mode === "rhythm" ? buildRhythms(level) : [];
  const intervals = cfg.mode === "interval" ? buildIntervals(level) : [];
  const duets = cfg.mode === "duet" ? buildDuets(level) : [];
  const scores = cfg.mode === "score" ? buildScores(level) : [];
  const totalRounds =
    cfg.mode === "rhythm" ? rhythms.length
      : cfg.mode === "interval" ? intervals.length
        : cfg.mode === "duet" ? duets.length
          : scores.length;

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
      gain.gain.exponentialRampToValueAtTime(0.24, t + 0.03);
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

  function settle(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed) fn();
    }, ms);
    timeouts.add(t);
  }

  const wrap = document.createElement("div");
  wrap.className = "ma-wrap";
  wrap.style.background = opts.background;
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="ma-top">
      <div class="ma-badge ma-round"></div>
      <div class="ma-badge ma-kind"></div>
      <div class="ma-badge ma-miss"></div>
    </div>
    <div class="ma-msg"></div>
    <div class="ma-score" hidden></div>
    <div class="ma-dots"></div>
    <div class="ma-keys"></div>
    <div class="ma-choices"></div>
    <button type="button" class="ma-replay">🔁 再听一遍</button>
  `;
  stage.appendChild(wrap);

  const roundEl = wrap.querySelector(".ma-round") as HTMLElement;
  const kindEl = wrap.querySelector(".ma-kind") as HTMLElement;
  const missEl = wrap.querySelector(".ma-miss") as HTMLElement;
  const msgEl = wrap.querySelector(".ma-msg") as HTMLElement;
  const scoreEl = wrap.querySelector(".ma-score") as HTMLElement;
  const dotsEl = wrap.querySelector(".ma-dots") as HTMLElement;
  const keysEl = wrap.querySelector(".ma-keys") as HTMLElement;
  const choicesEl = wrap.querySelector(".ma-choices") as HTMLElement;
  const replayBtn = wrap.querySelector(".ma-replay") as HTMLButtonElement;

  // --- 按键区：节奏关是两个鼓，其余是星星 ---
  const starBtns: HTMLButtonElement[] = [];
  const drumBtns: HTMLButtonElement[] = [];
  if (cfg.mode === "rhythm") {
    [
      { label: "短音", face: "🥁", long: false },
      { label: "长音", face: "🪘", long: true },
    ].forEach((d, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ma-drum";
      btn.innerHTML = `<span class="ma-drum-face">${d.face}</span><span>${d.label}</span>`;
      btn.setAttribute("aria-label", d.label);
      btn.addEventListener("click", () => onDrum(i));
      keysEl.appendChild(btn);
      drumBtns.push(btn);
    });
  } else if (cfg.mode !== "interval") {
    notes.slice(0, cfg.starCount).forEach((note, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ma-star";
      btn.innerHTML = `<span class="ma-face">⭐</span><span class="ma-name">${note.name}</span>`;
      (btn.querySelector(".ma-name") as HTMLElement).style.color = note.color;
      btn.setAttribute("aria-label", `${note.name}`);
      btn.addEventListener("click", () => onStar(i));
      keysEl.appendChild(btn);
      starBtns.push(btn);
    });
  }

  function lightStar(i: number, ms: number): void {
    const btn = starBtns[i];
    const note = notes[i];
    if (note) tone(note.freq, ms);
    if (!btn) return;
    btn.classList.add("ma-lit");
    later(() => btn.classList.remove("ma-lit"), ms);
  }

  function updateHud(): void {
    roundEl.textContent = `🎵 第 ${Math.min(roundIdx + 1, totalRounds)}/${totalRounds} ${
      cfg.mode === "interval" ? "题" : "句"
    }`;
    kindEl.textContent =
      cfg.mode === "rhythm" ? "🥁 节奏跟打"
        : cfg.mode === "interval" ? "🎧 音程听辨"
          : cfg.mode === "duet" ? "🎻 双声部"
            : "🎼 简谱视奏";
    missEl.textContent = `💗 剩 ${Math.max(0, cfg.maxMiss - misses + 1)} 次机会`;
    if (cfg.replays >= 0) replayBtn.textContent = `🔁 再听一遍（剩 ${Math.max(0, replaysLeft)} 次）`;
    replayBtn.hidden = cfg.mode === "score";
  }

  function renderDots(total: number, pattern?: number[]): void {
    dotsEl.innerHTML = "";
    for (let i = 0; i < total; i++) {
      const dot = document.createElement("div");
      dot.className = `ma-dot${i < inputPos ? " ma-on" : ""}${pattern && pattern[i] === 1 ? " ma-long" : ""}`;
      dotsEl.appendChild(dot);
    }
  }

  function finish(): void {
    ended = true;
    const got = rateBelow(misses, 0, 2);
    settle(
      () => ctx.win(got, misses === 0 ? "一次都没走音，耳朵真灵！" : "整关全部完成，越弹越有样子了！"),
      600
    );
  }

  function onMiss(hint: string): void {
    misses++;
    ctx.sfx("oops");
    updateHud();
    if (misses > cfg.maxMiss) {
      ended = true;
      settle(() => ctx.lose("这一关的耳朵体操有点累，歇一歇我们再来一遍！"), 500);
      return;
    }
    msgEl.textContent = hint;
    if (cfg.mode === "rhythm" || cfg.mode === "duet") {
      inputPos = 0;
      later(playRound, 900);
    }
  }

  function nextRound(): void {
    roundIdx++;
    inputPos = 0;
    if (roundIdx >= totalRounds) {
      ctx.sfx("coin");
      msgEl.textContent = "全部完成，掌声送给你！🎉";
      finish();
      return;
    }
    startRound();
  }

  // --- 节奏鼓点坡 ---
  function playRhythm(): void {
    const pattern = rhythms[roundIdx];
    listening = true;
    replayBtn.disabled = true;
    msgEl.textContent = "先听一遍节奏，注意长短～";
    renderDots(pattern.length, pattern);
    let at = 600;
    pattern.forEach((long, k) => {
      const dur = beatMs(cfg.noteMs, long === 1);
      later(() => {
        const btn = drumBtns[long === 1 ? 1 : 0];
        btn?.classList.add("ma-lit");
        tone(long === 1 ? 174.61 : 261.63, dur);
        later(() => btn?.classList.remove("ma-lit"), dur);
        const dot = dotsEl.children[k];
        if (dot instanceof HTMLElement) {
          dot.classList.add("ma-on");
          later(() => dot.classList.remove("ma-on"), dur);
        }
      }, at);
      at += dur + 220;
    });
    later(() => {
      listening = false;
      replayBtn.disabled = cfg.replays >= 0 && replaysLeft <= 0;
      inputPos = 0;
      renderDots(pattern.length, pattern);
      msgEl.textContent = "轮到你敲啦！短音点小鼓，长音点大鼓～";
    }, at + 200);
  }

  function onDrum(kind: number): void {
    if (ended || listening) return;
    const pattern = rhythms[roundIdx];
    const want = pattern[inputPos];
    const btn = drumBtns[kind];
    btn?.classList.add("ma-lit");
    tone(kind === 1 ? 174.61 : 261.63, beatMs(cfg.noteMs, kind === 1));
    later(() => btn?.classList.remove("ma-lit"), 220);
    if (kind === want) {
      inputPos++;
      renderDots(pattern.length, pattern);
      if (inputPos >= pattern.length) {
        ctx.sfx("coin");
        msgEl.textContent = "节奏一模一样，稳！";
        later(nextRound, 900);
      }
      return;
    }
    onMiss("长短有点不一样，我们再听一遍～");
  }

  // --- 音程听辨馆 ---
  function playInterval(): void {
    const q = intervals[roundIdx];
    listening = true;
    replayBtn.disabled = true;
    msgEl.textContent = "认真听这两个音…";
    later(() => tone(notes[q.a].freq, cfg.noteMs), 400);
    later(() => tone(notes[q.b].freq, cfg.noteMs), 400 + cfg.noteMs + 260);
    later(() => {
      listening = false;
      replayBtn.disabled = cfg.replays >= 0 && replaysLeft <= 0;
      msgEl.textContent = "第二个音和第一个音相比，是怎么走的？";
    }, 400 + cfg.noteMs * 2 + 400);
  }

  function renderIntervalChoices(): void {
    const q = intervals[roundIdx];
    choicesEl.innerHTML = "";
    q.choices.forEach((label, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ma-choice";
      btn.textContent = label;
      btn.addEventListener("click", () => {
        if (ended || listening) return;
        ctx.sfx("tap");
        if (i === q.correct) {
          ctx.sfx("coin");
          msgEl.textContent = `就是「${intervalLabel(q.a, q.b)}」，耳朵真准！`;
          choicesEl.innerHTML = "";
          later(nextRound, 900);
        } else {
          btn.classList.add("ma-bad");
          btn.disabled = true;
          onMiss("再听一遍，先听出是往上还是往下～");
        }
      });
      choicesEl.appendChild(btn);
    });
  }

  // --- 双声部合奏厅 ---
  let chordDone: number[] = [];
  function playDuet(): void {
    const chords = duets[roundIdx];
    listening = true;
    replayBtn.disabled = true;
    msgEl.textContent = "每一拍有两个音，一起响～";
    renderDots(chords.length);
    let at = 600;
    chords.forEach((chord) => {
      later(() => {
        for (const n of chord) lightStar(n, cfg.noteMs);
      }, at);
      at += cfg.noteMs + 320;
    });
    later(() => {
      listening = false;
      replayBtn.disabled = cfg.replays >= 0 && replaysLeft <= 0;
      inputPos = 0;
      chordDone = [];
      renderDots(chords.length);
      msgEl.textContent = "轮到你啦！每一拍把两颗星星都点到～";
    }, at + 200);
  }

  function onStar(i: number): void {
    if (ended || listening) return;
    if (cfg.mode === "duet") {
      const chord = duets[roundIdx][inputPos];
      if (!chord) return;
      if (!chord.includes(i)) {
        lightStar(i, 240);
        onMiss("这一拍是另外两颗星星，再听一遍～");
        return;
      }
      if (chordDone.includes(i)) {
        msgEl.textContent = "这颗已经按过啦，还差另一颗～";
        return;
      }
      lightStar(i, Math.min(460, cfg.noteMs));
      chordDone.push(i);
      if (chordDone.length < chord.length) {
        msgEl.textContent = "对了一颗，另一颗也按上～";
        return;
      }
      chordDone = [];
      inputPos++;
      renderDots(duets[roundIdx].length);
      if (inputPos >= duets[roundIdx].length) {
        ctx.sfx("coin");
        msgEl.textContent = "两个声部都对上了，好听！";
        later(nextRound, 900);
      }
      return;
    }
    // 简谱视奏台
    const seq = scores[roundIdx];
    lightStar(i, Math.min(460, cfg.noteMs));
    if (i === seq[inputPos]) {
      inputPos++;
      renderScore();
      renderDots(seq.length);
      if (inputPos >= seq.length) {
        ctx.sfx("coin");
        msgEl.textContent = "整句谱子读下来了，真厉害！";
        later(nextRound, 900);
      }
      return;
    }
    onMiss("看看谱子上现在该弹哪个数字～");
  }

  // --- 简谱视奏台 ---
  function renderScore(): void {
    const seq = scores[roundIdx];
    scoreEl.hidden = false;
    const digits = toScore(seq).split(" ");
    scoreEl.innerHTML = digits
      .map((d, i) => (i === inputPos ? `<span class="ma-cur">${d}</span>` : d))
      .join(" ");
  }

  function playRound(): void {
    if (cfg.mode === "rhythm") playRhythm();
    else if (cfg.mode === "interval") playInterval();
    else if (cfg.mode === "duet") playDuet();
  }

  function startRound(): void {
    inputPos = 0;
    chordDone = [];
    updateHud();
    choicesEl.innerHTML = "";
    if (cfg.mode === "score") {
      scoreEl.hidden = false;
      renderScore();
      renderDots(scores[roundIdx].length);
      msgEl.textContent = "照着简谱弹：1 哆 2 来 3 咪 5 索 6 拉";
      return;
    }
    if (cfg.mode === "interval") renderIntervalChoices();
    playRound();
  }

  replayBtn.addEventListener("click", () => {
    if (ended || listening || cfg.mode === "score") return;
    if (cfg.replays >= 0) {
      if (replaysLeft <= 0) return;
      replaysLeft--;
    }
    ctx.sfx("tap");
    updateHud();
    inputPos = 0;
    chordDone = [];
    playRound();
  });

  msgEl.textContent = modeIntro(cfg.mode);
  updateHud();
  later(startRound, 700);

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
    },
  };
}
