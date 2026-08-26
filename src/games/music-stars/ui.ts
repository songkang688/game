/**
 * 音乐星星 · 共用界面零件（1.2 新增）。
 *
 * 三件事被抽到这里，跟弹关、四种新玩法与自由弹奏沙盒共用：
 *
 *  1. **星星键盘**——按 `pointerdown` / `pointerup` 走多点触控，
 *     每根手指的 `pointerId` 独立记录；音越高星星摆得越靠上，
 *     按下发光并下沉 4px，发声与视觉在同一帧里做完；
 *  2. **声音设置条**——静音、音量（默认 0.35、上限 0.6）、三种音色、慢速练习倍率；
 *  3. **节拍条与星座连线**——`prefers-reduced-motion` 时节拍条改成逐格跳动、星座不做动画。
 *
 * CSS 类名一律 `mst-` 前缀，样式跟着组件走，不进 `src/styles.css`。
 */
import { prefersReducedMotion, keyLayout, KEY_MIN_GAP_PX, type KeyLayout } from "./runtime";
import { SPEEDS, speedLabel } from "./practice";
import { SCORE_MIN_FONT_PX, type ScoreGlyph } from "./notation";
import { TIMBRES, VOLUME_MAX, type StarSynth } from "./synth";
import { pitchOffsetPx } from "./tuning";
import { DUET_MIN_GAP_PX } from "./touch";

export const MST_CSS = `
.mst-wrap{min-height:420px;display:flex;flex-direction:column;align-items:center;gap:10px;
  padding:14px 10px;box-sizing:border-box;border-radius:16px;width:100%;
  font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  user-select:none;-webkit-user-select:none;touch-action:none;}
.mst-top{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.mst-badge{font-size:14px;font-weight:800;color:#fff;background:#ffffff2b;border-radius:999px;padding:5px 12px;}
.mst-badge-listen{background:#ffe066;color:#3b2a00;animation:mst-listen 1s ease-in-out infinite;}
@keyframes mst-listen{0%,100%{opacity:1}50%{opacity:.55}}
.mst-msg{min-height:26px;font-size:17px;font-weight:800;color:#ffe066;text-align:center;line-height:1.4;}
.mst-dots{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;min-height:16px;}
.mst-dot{width:14px;height:14px;border-radius:50%;background:#ffffff33;transition:background .2s,transform .2s;}
.mst-dot-on{background:#ffe066;transform:scale(1.25);}
.mst-dot-long{width:26px;border-radius:8px;}
.mst-dot-perfect{background:#8ce99a;}
.mst-dot-good{background:#ffe066;}
.mst-dot-ok{background:#ffa94d;}
.mst-dot-miss{background:#ffffff55;}

.mst-sky{position:relative;width:100%;max-width:360px;min-height:150px;}
.mst-lines{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0;
  transition:opacity .5s ease;}
.mst-lines-on{opacity:1;}
.mst-keys{position:relative;display:flex;justify-content:center;align-items:flex-end;
  min-height:150px;width:100%;}
.mst-star{border:none;background:transparent;padding:0;cursor:pointer;font-family:inherit;
  display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;
  transition:transform .12s ease,filter .12s ease;touch-action:none;}
.mst-face{font-size:44px;line-height:1;filter:grayscale(.55) brightness(.75);
  transition:filter .12s ease,transform .12s ease,text-shadow .12s ease;}
.mst-name{font-size:18px;font-weight:800;color:#c5cff3;}
.mst-star.mst-lit .mst-face{filter:none;transform:scale(1.2);text-shadow:0 0 22px #fff59b;}
.mst-star.mst-lit .mst-name{color:#fff;}
.mst-star.mst-down{transform:translateY(4px);}
.mst-star.mst-down .mst-face{filter:none;text-shadow:0 0 26px #fff59b;}
.mst-star.mst-hint .mst-face{filter:none;animation:mst-twinkle 1s infinite;}
.mst-star[disabled]{cursor:default;}
@keyframes mst-twinkle{0%,100%{transform:scale(1)}50%{transform:scale(1.16);text-shadow:0 0 20px #fff59b}}

.mst-bar{position:relative;width:100%;max-width:360px;height:56px;border-radius:14px;
  background:#00000033;overflow:hidden;}
.mst-bar-track{position:absolute;top:0;left:0;height:100%;will-change:transform;}
.mst-bar-tick{position:absolute;top:12px;height:32px;border-radius:8px;background:#ffffff55;}
.mst-bar-tick.mst-bar-long{background:#ffffff80;}
.mst-bar-tick.mst-bar-hit{background:#8ce99a;}
.mst-bar-tick.mst-bar-late{background:#ffa94d;}
.mst-bar-line{position:absolute;top:4px;bottom:4px;width:4px;border-radius:2px;background:#ffe066;
  box-shadow:0 0 12px #ffe06699;}

.mst-score{font-size:${SCORE_MIN_FONT_PX + 4}px;font-weight:900;color:#fff;background:#ffffff1f;
  border-radius:14px;padding:12px 14px;text-align:center;line-height:1;
  display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}
.mst-glyph{position:relative;display:inline-flex;flex-direction:column;align-items:center;
  min-width:${SCORE_MIN_FONT_PX}px;}
.mst-glyph-dots{font-size:13px;line-height:8px;height:10px;letter-spacing:2px;}
.mst-glyph-num{font-size:${SCORE_MIN_FONT_PX + 4}px;line-height:1.1;}
.mst-glyph-under{height:4px;width:70%;border-top:3px solid currentColor;}
.mst-glyph.mst-cur .mst-glyph-num{color:#ffe066;text-shadow:0 0 14px #ffe06699;}

.mst-tools{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;align-items:center;}
.mst-btn{min-height:44px;padding:8px 16px;font-size:16px;font-weight:800;color:#1b2a5e;border:none;
  cursor:pointer;border-radius:999px;background:#ffe066;box-shadow:0 4px 0 #d9b800;font-family:inherit;
  transition:transform .1s,opacity .2s;}
.mst-btn:active{transform:translateY(3px);box-shadow:0 1px 0 #d9b800;}
.mst-btn:disabled{opacity:.4;cursor:default;}
.mst-chip{min-height:38px;padding:6px 12px;font-size:14px;font-weight:800;border:none;cursor:pointer;
  border-radius:999px;background:#ffffff2b;color:#fff;font-family:inherit;}
.mst-chip.mst-chip-on{background:#fff;color:#1b2a5e;}
.mst-drum{min-width:120px;min-height:88px;border:none;border-radius:20px;cursor:pointer;font-family:inherit;
  font-size:18px;font-weight:900;color:#3b2a00;background:#ffe066;box-shadow:0 5px 0 #d9b800;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;touch-action:none;}
.mst-drum:active{transform:translateY(3px);box-shadow:0 2px 0 #d9b800;}
.mst-drum-face{font-size:32px;}
.mst-drum.mst-lit{background:#fff3bf;}
.mst-choices{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}
.mst-choice{min-width:108px;min-height:56px;border:none;border-radius:18px;cursor:pointer;font-family:inherit;
  font-size:18px;font-weight:900;color:#1b2a5e;background:#fff;box-shadow:0 4px 0 #ffffff5c;}
.mst-choice:active{transform:translateY(3px);box-shadow:0 1px 0 #ffffff5c;}
.mst-choice.mst-bad{opacity:.45;}
.mst-star:focus-visible,.mst-btn:focus-visible,.mst-chip:focus-visible,
.mst-drum:focus-visible,.mst-choice:focus-visible{outline:3px solid #fff;outline-offset:3px;}
@media (prefers-reduced-motion:reduce){
  .mst-lines{transition:none;}
  .mst-badge-listen{animation:none;}
  .mst-star.mst-hint .mst-face{animation:none;text-shadow:0 0 20px #fff59b;}
  .mst-bar-track{transition:none;}
}
`;

/** 把本款样式挂到宿主上（每次挂载一份，随宿主一起被移除） */
export function injectCss(host: HTMLElement): void {
  const style = document.createElement("style");
  style.textContent = MST_CSS;
  host.appendChild(style);
}

// ---------------------------------------------------------------------------
// 星星键盘
// ---------------------------------------------------------------------------

export interface StarBoardNote {
  name: string;
  color: string;
}

export interface StarBoardOptions {
  /** 每颗星星的 MIDI 音高，决定发声频率与纵坐标 */
  midis: readonly number[];
  notes: readonly StarBoardNote[];
  /** 双声部关把键拉开，一根手指盖不住两个 */
  wideGap?: boolean;
  /** 可用宽度（像素），不传就按 360px 的窄屏算 */
  width?: number;
  onDown: (index: number, pointerId: number) => void;
  onUp?: (index: number, pointerId: number) => void;
}

export interface StarBoardHandle {
  el: HTMLElement;
  buttons: HTMLButtonElement[];
  layout: KeyLayout;
  /** 范奏播放中要禁用输入，避免误判 */
  setEnabled(on: boolean): void;
  isEnabled(): boolean;
  /** 点亮某颗星星一段时间（范奏用） */
  light(index: number, ms: number): void;
  /** 提示某颗星星（终曲一闪一闪） */
  hint(index: number, on: boolean): void;
  clearHints(): void;
  /** 把答对的音连成星座 */
  drawConstellation(seq: readonly number[]): void;
  clearConstellation(): void;
  destroy(): void;
}

const SVG_NS = "http://www.w3.org/2000/svg";

export function createStarBoard(opts: StarBoardOptions): StarBoardHandle {
  const count = opts.midis.length;
  const minGap = opts.wideGap ? DUET_MIN_GAP_PX : KEY_MIN_GAP_PX;
  const layout = keyLayout(opts.width ?? 360, count, minGap);
  const lowMidi = Math.min(...opts.midis);
  const highMidi = Math.max(...opts.midis);
  const rise = count > 1 ? 60 : 0;

  const sky = document.createElement("div");
  sky.className = "mst-sky";

  const lines = document.createElementNS(SVG_NS, "svg");
  lines.setAttribute("class", "mst-lines");
  lines.setAttribute("viewBox", "0 0 100 100");
  lines.setAttribute("preserveAspectRatio", "none");
  sky.appendChild(lines as unknown as Node);

  const keys = document.createElement("div");
  keys.className = "mst-keys";
  keys.style.gap = `${layout.gap}px`;
  sky.appendChild(keys);

  let enabled = true;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const cleanups: Array<() => void> = [];

  const buttons: HTMLButtonElement[] = opts.midis.map((midi, i) => {
    const note = opts.notes[i] ?? { name: `${i + 1}`, color: "#fff" };
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mst-star";
    btn.style.width = `${layout.width}px`;
    btn.style.minHeight = `${layout.width}px`;
    // 音越高摆得越上：让孩子看得见「高低」
    btn.style.marginBottom = `${pitchOffsetPx(midi, lowMidi, highMidi, rise)}px`;
    btn.setAttribute("aria-label", note.name);
    btn.innerHTML = `<span class="mst-face">⭐</span><span class="mst-name">${note.name}</span>`;
    const nameEl = btn.querySelector(".mst-name") as HTMLElement | null;
    if (nameEl) nameEl.style.color = note.color;

    const down = (ev: Event): void => {
      const pe = ev as PointerEvent;
      pe.preventDefault?.();
      if (!enabled) return;
      // 发声与视觉同一帧：先落下去再回调，回调里立刻出声
      btn.classList.add("mst-down", "mst-lit");
      try {
        btn.setPointerCapture?.(pe.pointerId);
      } catch {
        // 不支持捕获也能玩，只是滑出按钮时抬起事件会丢
      }
      opts.onDown(i, pe.pointerId ?? 0);
    };
    const up = (ev: Event): void => {
      const pe = ev as PointerEvent;
      btn.classList.remove("mst-down");
      if (!btn.classList.contains("mst-lit-hold")) btn.classList.remove("mst-lit");
      opts.onUp?.(i, pe.pointerId ?? 0);
    };
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    cleanups.push(() => {
      btn.removeEventListener("pointerdown", down);
      btn.removeEventListener("pointerup", up);
      btn.removeEventListener("pointercancel", up);
    });

    keys.appendChild(btn);
    return btn;
  });

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  }

  return {
    el: sky,
    buttons,
    layout,
    setEnabled(on: boolean): void {
      enabled = on;
      for (const b of buttons) b.disabled = !on;
    },
    isEnabled(): boolean {
      return enabled;
    },
    light(index: number, ms: number): void {
      const btn = buttons[index];
      if (!btn) return;
      btn.classList.add("mst-lit", "mst-lit-hold");
      later(() => btn.classList.remove("mst-lit", "mst-lit-hold"), Math.max(80, ms));
    },
    hint(index: number, on: boolean): void {
      buttons[index]?.classList.toggle("mst-hint", on);
    },
    clearHints(): void {
      for (const b of buttons) b.classList.remove("mst-hint");
    },
    drawConstellation(seq: readonly number[]): void {
      while (lines.firstChild) lines.removeChild(lines.firstChild);
      if (seq.length < 2) return;
      const step = 100 / Math.max(1, count);
      const x = (i: number): number => step * (i + 0.5);
      const y = (i: number): number => {
        const midi = opts.midis[i] ?? lowMidi;
        const span = highMidi - lowMidi;
        const t = span > 0 ? (midi - lowMidi) / span : 0.5;
        return 82 - t * 52;
      };
      for (let k = 1; k < seq.length; k++) {
        const line = document.createElementNS(SVG_NS, "line");
        line.setAttribute("x1", `${x(seq[k - 1])}`);
        line.setAttribute("y1", `${y(seq[k - 1])}`);
        line.setAttribute("x2", `${x(seq[k])}`);
        line.setAttribute("y2", `${y(seq[k])}`);
        line.setAttribute("stroke", "#fff59b");
        line.setAttribute("stroke-width", "0.8");
        line.setAttribute("stroke-linecap", "round");
        lines.appendChild(line as unknown as Node);
      }
      lines.setAttribute("class", "mst-lines mst-lines-on");
    },
    clearConstellation(): void {
      while (lines.firstChild) lines.removeChild(lines.firstChild);
      lines.setAttribute("class", "mst-lines");
    },
    destroy(): void {
      for (const t of timers) clearTimeout(t);
      timers.clear();
      for (const off of cleanups) off();
      cleanups.length = 0;
      sky.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 声音设置条：静音 / 音量 / 音色 / 慢速练习
// ---------------------------------------------------------------------------

export interface AudioBarOptions {
  synth: StarSynth;
  /** 不给就不显示慢速练习（简谱视奏台不需要） */
  onSpeed?: (speed: number) => void;
  speed?: number;
  onChange?: () => void;
}

export interface AudioBarHandle {
  el: HTMLElement;
  refresh(): void;
  destroy(): void;
}

export function createAudioBar(opts: AudioBarOptions): AudioBarHandle {
  const { synth } = opts;
  const bar = document.createElement("div");
  bar.className = "mst-tools";
  const cleanups: Array<() => void> = [];

  function chip(label: string, onClick: () => void, title?: string): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mst-chip";
    btn.textContent = label;
    if (title) btn.setAttribute("aria-label", title);
    const fn = (): void => {
      synth.unlock();
      onClick();
    };
    btn.addEventListener("click", fn);
    cleanups.push(() => btn.removeEventListener("click", fn));
    bar.appendChild(btn);
    return btn;
  }

  const muteBtn = chip("🔊", () => {
    synth.toggleMuted();
    refresh();
    opts.onChange?.();
  }, "静音开关");

  const volBtn = chip("🔉 音量", () => {
    // 三档循环：轻 0.2 → 常 0.35 → 大 0.6（上限，不许再往上）
    const steps = [0.2, 0.35, VOLUME_MAX];
    const cur = steps.findIndex((s) => Math.abs(s - synth.volume) < 0.02);
    synth.setVolume(steps[(cur + 1) % steps.length]);
    refresh();
    opts.onChange?.();
  }, "音量大小");

  const timbreBtn = chip("🔔", () => {
    const i = TIMBRES.findIndex((t) => t.id === synth.timbre.id);
    synth.setTimbre(TIMBRES[(i + 1) % TIMBRES.length].id);
    refresh();
    opts.onChange?.();
  }, "换个音色");

  let speedBtn: HTMLButtonElement | null = null;
  if (opts.onSpeed) {
    speedBtn = chip(speedLabel(opts.speed ?? 1), () => {
      const cur = SPEEDS.indexOf(opts.speed ?? 1);
      const next = SPEEDS[(cur + 1) % SPEEDS.length];
      opts.speed = next;
      opts.onSpeed?.(next);
      refresh();
    }, "练习速度");
  }

  function refresh(): void {
    muteBtn.textContent = synth.muted ? "🔇 已静音" : "🔊 有声音";
    muteBtn.classList.toggle("mst-chip-on", synth.muted);
    const level = synth.volume >= VOLUME_MAX - 0.01 ? "大" : synth.volume <= 0.22 ? "轻" : "常";
    volBtn.textContent = `🔉 音量${level}`;
    timbreBtn.textContent = `🔔 ${synth.timbre.name}`;
    if (speedBtn) speedBtn.textContent = `⏱️ ${speedLabel(opts.speed ?? 1)}`;
  }

  refresh();

  return {
    el: bar,
    refresh,
    destroy(): void {
      for (const off of cleanups) off();
      cleanups.length = 0;
      bar.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 简谱区
// ---------------------------------------------------------------------------

/** 把一行字形渲染成简谱：数字 + 八度点 + 时值线 */
export function renderScore(host: HTMLElement, glyphs: readonly ScoreGlyph[], cursor: number): void {
  host.innerHTML = "";
  glyphs.forEach((g, i) => {
    const cell = document.createElement("div");
    cell.className = `mst-glyph${i === cursor ? " mst-cur" : ""}`;
    const above = document.createElement("div");
    above.className = "mst-glyph-dots";
    above.textContent = "·".repeat(g.dotsAbove);
    const num = document.createElement("div");
    num.className = "mst-glyph-num";
    num.textContent = g.dashes > 0 ? `${g.digit} -` : `${g.digit}`;
    const below = document.createElement("div");
    below.className = "mst-glyph-dots";
    below.textContent = "·".repeat(g.dotsBelow);
    cell.append(above, num, below);
    if (g.underlines > 0) {
      const line = document.createElement("div");
      line.className = "mst-glyph-under";
      cell.appendChild(line);
    }
    host.appendChild(cell);
  });
}

// ---------------------------------------------------------------------------
// 节拍条：横向滚动，判定线固定在中间
// ---------------------------------------------------------------------------

export interface BeatBarOptions {
  /** 每一拍的时刻（秒，音频时钟） */
  beats: readonly number[];
  /** 每一拍是不是长音 */
  longs: readonly boolean[];
  /** 现在几点（秒，音频时钟） */
  now: () => number;
  /** 一秒钟滚过多少像素 */
  pxPerSec?: number;
  width?: number;
}

export interface BeatBarHandle {
  el: HTMLElement;
  start(): void;
  stop(): void;
  /** 把某一拍标成已命中（档位决定颜色） */
  mark(index: number, grade: "perfect" | "good" | "ok" | "miss"): void;
  destroy(): void;
}

export function createBeatBar(opts: BeatBarOptions): BeatBarHandle {
  const width = opts.width ?? 360;
  const pxPerSec = opts.pxPerSec ?? 150;
  const reduced = prefersReducedMotion();

  const bar = document.createElement("div");
  bar.className = "mst-bar";
  const track = document.createElement("div");
  track.className = "mst-bar-track";
  bar.appendChild(track);
  const judge = document.createElement("div");
  judge.className = "mst-bar-line";
  judge.style.left = `${Math.round(width / 2)}px`;
  bar.appendChild(judge);

  const first = opts.beats[0] ?? 0;
  const ticks: HTMLElement[] = opts.beats.map((at, i) => {
    const tick = document.createElement("div");
    tick.className = `mst-bar-tick${opts.longs[i] ? " mst-bar-long" : ""}`;
    tick.style.left = `${Math.round((at - first) * pxPerSec)}px`;
    tick.style.width = `${opts.longs[i] ? 30 : 16}px`;
    track.appendChild(tick);
    return tick;
  });

  let raf = 0;
  let stopped = true;
  const half = Math.round(width / 2);

  function frame(): void {
    if (stopped) return;
    const t = opts.now() - first;
    track.style.transform = `translateX(${Math.round(half - t * pxPerSec)}px)`;
    raf = requestAnimationFrame(frame);
  }

  /** 减少动效：不滚动，只把「当前是第几拍」逐格跳过去 */
  let stepTimer: ReturnType<typeof setInterval> | null = null;
  function stepFrame(): void {
    const t = opts.now();
    let idx = 0;
    for (let i = 0; i < opts.beats.length; i++) if (opts.beats[i] <= t) idx = i;
    const at = opts.beats[idx] ?? first;
    track.style.transform = `translateX(${Math.round(half - (at - first) * pxPerSec)}px)`;
  }

  return {
    el: bar,
    start(): void {
      stopped = false;
      if (reduced) {
        stepFrame();
        stepTimer = setInterval(stepFrame, 120);
      } else {
        raf = requestAnimationFrame(frame);
      }
    },
    stop(): void {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (stepTimer) clearInterval(stepTimer);
      stepTimer = null;
    },
    mark(index: number, grade): void {
      const tick = ticks[index];
      if (!tick) return;
      tick.classList.add(grade === "miss" ? "mst-bar-late" : "mst-bar-hit");
    },
    destroy(): void {
      this.stop();
      bar.remove();
    },
  };
}
