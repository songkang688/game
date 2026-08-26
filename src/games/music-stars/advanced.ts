/**
 * 音乐星星 · 第 100–188 关的四种玩法。
 *
 *   rhythm   节奏鼓点坡——不管音高，只跟长短音；
 *   interval 音程听辨馆——先后放两个音，答出往上/往下几格；
 *   duet     双声部合奏厅——一拍两个音，两颗星星**同时**按到；
 *   score    简谱视奏台——不放范奏，照着简谱直接弹。
 *
 * 1.2 改了三件要紧事：
 *  1. 节奏关真的判时间了：三档窗口（±60 / ±120 / ±200ms），
 *     基准是 `AudioContext.currentTime` 而不是 `Date.now()`，开局补一次输出延迟；
 *  2. 双声部关按 `pointerId` 走多点触控，两根手指同时落下才算一拍——
 *     1.1 只挂 `click`，触屏上根本按不出「同时」；
 *  3. 简谱补上八度点与时值线，谱面第一次真的能看出节奏。
 *
 * 失败文案一律只安抚，绝不说孩子不行。
 */
import type { PlayCtx, PlayHandle } from "../level99";
import {
  buildDuets,
  buildIntervals,
  buildRhythms,
  buildScoreValues,
  buildScores,
  type MusicLevel,
} from "./levels";
import { toScore } from "./logic";
import { glyphLine, rhythmValue, type NoteValue } from "./notation";
import { clampSpeed, FULL_SPEED, rateWithSpeed, scaleMs, speedHint } from "./practice";
import { ChordPad, sameChord } from "./touch";
import { midiToFreq, pentatonicIntervalPhrase } from "./tuning";
import {
  beatSchedule,
  GRADE_WORDS,
  judgeTap,
  OK_MS,
  type HitGrade,
} from "./timing";
import type { StarSynth } from "./synth";
import {
  createAudioBar,
  createBeatBar,
  createStarBoard,
  injectCss,
  renderScore,
  type BeatBarHandle,
  type StarBoardHandle,
  type StarBoardNote,
} from "./ui";

export interface AdvancedOptions {
  stage: HTMLElement;
  ctx: PlayCtx;
  cfg: MusicLevel;
  level: number;
  midis: readonly number[];
  notes: readonly StarBoardNote[];
  background: string;
  synth: StarSynth;
}

/** 节奏关里长音 / 短音的实际时长（毫秒），纯函数便于测试 */
export function beatMs(base: number, long: boolean): number {
  return Math.round(base * (long ? 1.6 : 0.6));
}

/** 节奏关两个鼓的音高（低沉的大鼓 / 清脆的小鼓），一样是现场合成 */
export const DRUM_FREQ: readonly number[] = [261.63, 174.61];

/** 每种新玩法的一句话说明 */
export function modeIntro(mode: MusicLevel["mode"]): string {
  switch (mode) {
    case "rhythm":
      return "只听长短，不看音高：短音点小鼓，长音点大鼓，跟着拍子敲～";
    case "interval":
      return "先后两个音，听出它是往上还是往下、差几格～";
    case "duet":
      return "一拍两个音，两颗星星要一起按下去才算数～";
    default:
      return "这一关没有范奏，照着简谱一个一个弹下去～";
  }
}

export function playAdvancedLevel(opts: AdvancedOptions): PlayHandle {
  const { stage, ctx, cfg, level, midis, notes, synth } = opts;
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let destroyed = false;
  let ended = false;
  let misses = 0;
  let roundIdx = 0;
  let inputPos = 0;
  let replaysLeft = cfg.replays;
  let listening = false;
  let speed = FULL_SPEED;

  const rhythms = cfg.mode === "rhythm" ? buildRhythms(level) : [];
  const intervals = cfg.mode === "interval" ? buildIntervals(level) : [];
  const duets = cfg.mode === "duet" ? buildDuets(level) : [];
  const scores = cfg.mode === "score" ? buildScores(level) : [];
  const scoreValues = cfg.mode === "score" ? buildScoreValues(level) : [];
  const totalRounds =
    cfg.mode === "rhythm" ? rhythms.length
      : cfg.mode === "interval" ? intervals.length
        : cfg.mode === "duet" ? duets.length
          : scores.length;

  function noteMs(): number {
    return scaleMs(cfg.noteMs, speed);
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
  wrap.className = "mst-wrap";
  wrap.style.background = opts.background;
  injectCss(wrap);
  const head = document.createElement("div");
  head.innerHTML = `
    <div class="mst-top">
      <div class="mst-badge mst-round"></div>
      <div class="mst-badge mst-kind"></div>
      <div class="mst-badge mst-miss"></div>
      <div class="mst-badge mst-badge-listen mst-listen" hidden>👂 听</div>
    </div>
    <div class="mst-msg"></div>
    <div class="mst-score" hidden></div>
    <div class="mst-beat"></div>
    <div class="mst-dots"></div>
  `;
  wrap.appendChild(head);
  stage.appendChild(wrap);

  const roundEl = wrap.querySelector(".mst-round") as HTMLElement;
  const kindEl = wrap.querySelector(".mst-kind") as HTMLElement;
  const missEl = wrap.querySelector(".mst-miss") as HTMLElement;
  const listenEl = wrap.querySelector(".mst-listen") as HTMLElement;
  const msgEl = wrap.querySelector(".mst-msg") as HTMLElement;
  const scoreEl = wrap.querySelector(".mst-score") as HTMLElement;
  const beatHost = wrap.querySelector(".mst-beat") as HTMLElement;
  const dotsEl = wrap.querySelector(".mst-dots") as HTMLElement;

  // --- 按键区：节奏关是两个鼓，音程关不需要键盘，其余是星星 ---
  const keysEl = document.createElement("div");
  keysEl.className = "mst-tools";
  wrap.appendChild(keysEl);

  const drumBtns: HTMLButtonElement[] = [];
  let board: StarBoardHandle | null = null;
  const pad = new ChordPad();
  const cleanups: Array<() => void> = [];

  if (cfg.mode === "rhythm") {
    [
      { label: "短音", face: "🥁", long: false },
      { label: "长音", face: "🪘", long: true },
    ].forEach((d, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mst-drum";
      btn.innerHTML = `<span class="mst-drum-face">${d.face}</span><span>${d.label}</span>`;
      btn.setAttribute("aria-label", d.label);
      const fn = (ev: Event): void => {
        (ev as PointerEvent).preventDefault?.();
        onDrum(i);
      };
      btn.addEventListener("pointerdown", fn);
      cleanups.push(() => btn.removeEventListener("pointerdown", fn));
      keysEl.appendChild(btn);
      drumBtns.push(btn);
    });
  } else if (cfg.mode !== "interval") {
    board = createStarBoard({
      midis: midis.slice(0, cfg.starCount),
      notes: notes.slice(0, cfg.starCount),
      // 双声部关同一拍要按两颗，键必须拉开，一根手指盖不住两个
      wideGap: cfg.mode === "duet",
      onDown: (i, pointerId) => onStarDown(i, pointerId),
      onUp: (_i, pointerId) => onStarUp(pointerId),
    });
    wrap.appendChild(board.el);
  }

  const choicesEl = document.createElement("div");
  choicesEl.className = "mst-choices";
  wrap.appendChild(choicesEl);

  const replayBtn = document.createElement("button");
  replayBtn.type = "button";
  replayBtn.className = "mst-btn";
  replayBtn.textContent = "🔁 再听一遍";
  const tools = document.createElement("div");
  tools.className = "mst-tools";
  tools.appendChild(replayBtn);
  wrap.appendChild(tools);

  const audioBar = createAudioBar({
    synth,
    speed,
    // 视奏章没有范奏，慢速也就无从谈起：那一章本来就是自己看谱定速度
    onSpeed: cfg.mode === "score" ? undefined : (next) => {
      speed = clampSpeed(next);
      msgEl.textContent = speed >= FULL_SPEED
        ? "回到全速啦，这一遍弹对就能拿满星。"
        : "慢速练习：范奏放慢一点，这一遍最多得一颗星。";
    },
  });
  wrap.appendChild(audioBar.el);

  let beatBar: BeatBarHandle | null = null;

  function tone(i: number, ms: number, voices = 1): void {
    const midi = midis[i];
    if (midi === undefined) return;
    synth.play(midiToFreq(midi), ms, voices);
  }

  function lightStar(i: number, ms: number, voices = 1): void {
    board?.light(i, ms);
    tone(i, ms, voices);
  }

  function setListening(on: boolean): void {
    listening = on;
    listenEl.hidden = !on;
    board?.setEnabled(!on);
    for (const b of drumBtns) b.disabled = on;
    for (const child of Array.from(choicesEl.children)) {
      const b = child as HTMLButtonElement;
      if (!b.classList.contains("mst-bad")) b.disabled = on;
    }
    replayBtn.disabled = on || cfg.mode === "score" || (cfg.replays >= 0 && replaysLeft <= 0);
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
    replayBtn.textContent = cfg.replays >= 0
      ? `🔁 再听一遍（剩 ${Math.max(0, replaysLeft)} 次）`
      : "🔁 再听一遍";
    replayBtn.hidden = cfg.mode === "score";
  }

  function renderDots(total: number, pattern?: readonly number[]): void {
    dotsEl.innerHTML = "";
    for (let i = 0; i < total; i++) {
      const dot = document.createElement("div");
      dot.className = `mst-dot${i < inputPos ? " mst-dot-on" : ""}${
        pattern && pattern[i] === 1 ? " mst-dot-long" : ""
      }`;
      dotsEl.appendChild(dot);
    }
  }

  function markDot(index: number, grade: HitGrade): void {
    const dot = dotsEl.children[index] as HTMLElement | undefined;
    dot?.classList.add(`mst-dot-${grade}`);
  }

  function finish(): void {
    ended = true;
    beatBar?.stop();
    const got = rateWithSpeed(misses, speed);
    const praise = misses === 0 ? "一次都没走音，耳朵真灵！" : "整关全部完成，越弹越有样子了！";
    settle(() => ctx.win(got, `${praise}${speed >= FULL_SPEED ? "" : ` ${speedHint(speed)}`}`), 600);
  }

  function onMiss(hint: string): void {
    misses++;
    ctx.sfx("oops");
    updateHud();
    if (misses > cfg.maxMiss) {
      ended = true;
      beatBar?.stop();
      settle(() => ctx.lose("这一关的耳朵体操有点累，歇一歇我们再来一遍！开慢速练习也很好用。"), 500);
      return;
    }
    msgEl.textContent = hint;
    if (cfg.mode === "rhythm" || cfg.mode === "duet") {
      inputPos = 0;
      pad.reset();
      later(playRound, 900);
    }
  }

  function nextRound(): void {
    roundIdx++;
    inputPos = 0;
    pad.reset();
    if (roundIdx >= totalRounds) {
      ctx.sfx("coin");
      msgEl.textContent = "全部完成，掌声送给你！🎉";
      finish();
      return;
    }
    startRound();
  }

  // -------------------------------------------------------------------------
  // 节奏鼓点坡：范奏 → 跟着节拍条真敲，三档窗口判时间
  // -------------------------------------------------------------------------

  /** 本句每一拍该敲的时刻（秒，音频时钟）；空表示还没排上 */
  let beatTimes: number[] = [];
  let beatTaken: boolean[] = [];
  let beatGrades: HitGrade[] = [];

  function rhythmDurations(pattern: readonly number[]): number[] {
    return pattern.map((long) => beatMs(noteMs(), long === 1));
  }

  function playRhythm(): void {
    const pattern = rhythms[roundIdx];
    setListening(true);
    beatBar?.destroy();
    beatBar = null;
    msgEl.textContent = "先听一遍节奏，注意长短～";
    renderDots(pattern.length, pattern);

    const durations = rhythmDurations(pattern);
    const gap = Math.round(noteMs() * 0.35);
    let at = 600;
    pattern.forEach((long, k) => {
      const dur = durations[k];
      later(() => {
        const btn = drumBtns[long === 1 ? 1 : 0];
        btn?.classList.add("mst-lit");
        synth.play(DRUM_FREQ[long === 1 ? 1 : 0], dur, 1);
        later(() => btn?.classList.remove("mst-lit"), dur);
        const dot = dotsEl.children[k] as HTMLElement | undefined;
        if (dot) {
          dot.classList.add("mst-dot-on");
          later(() => dot.classList.remove("mst-dot-on"), dur);
        }
      }, at);
      at += dur + gap;
    });
    later(() => startRhythmInput(pattern, durations, gap), at + 500);
  }

  /** 范奏放完，排出玩家该敲的那一串时刻，节拍条滚起来 */
  function startRhythmInput(
    pattern: readonly number[],
    durations: readonly number[],
    gap: number
  ): void {
    synth.unlock();
    const leadIn = 1.2;
    beatTimes = beatSchedule(synth.now() + leadIn, durations, gap);
    beatTaken = pattern.map(() => false);
    beatGrades = [];
    inputPos = 0;
    renderDots(pattern.length, pattern);
    setListening(false);
    msgEl.textContent = "轮到你敲啦！黄线走到方块上就敲一下～";

    beatBar?.destroy();
    beatBar = createBeatBar({
      beats: beatTimes,
      longs: pattern.map((v) => v === 1),
      now: () => synth.now(),
    });
    beatHost.innerHTML = "";
    beatHost.appendChild(beatBar.el);
    beatBar.start();

    // 最后一拍的窗口关上之后收尾
    const totalMs = (beatTimes[beatTimes.length - 1] - synth.now()) * 1000 + OK_MS + 200;
    later(() => endRhythmRound(pattern), Math.max(600, Math.round(totalMs)));
  }

  function endRhythmRound(pattern: readonly number[]): void {
    beatBar?.stop();
    const missed = beatTaken.filter((t) => !t).length;
    if (missed > 0) {
      for (let i = 0; i < beatTaken.length; i++) {
        if (!beatTaken[i]) {
          markDot(i, "miss");
          beatBar?.mark(i, "miss");
        }
      }
      onMiss(`漏了 ${missed} 下～黄线压到方块上再敲，慢速练习也可以先开着。`);
      return;
    }
    // 这一句判完就把拍点表收走，免得下一句开始前的空档里误判
    beatTimes = [];
    void pattern;
    ctx.sfx("coin");
    const perfect = beatGrades.filter((g) => g === "perfect").length;
    msgEl.textContent = perfect === beatGrades.length
      ? "每一下都刚刚好，节奏感真好！"
      : "整句都跟上了，节奏稳住了！";
    later(nextRound, 900);
  }

  function onDrum(kind: number): void {
    if (ended || listening) return;
    synth.unlock();
    const pattern = rhythms[roundIdx];
    const btn = drumBtns[kind];
    btn?.classList.add("mst-lit");
    synth.play(DRUM_FREQ[kind], beatMs(noteMs(), kind === 1), 1);
    later(() => btn?.classList.remove("mst-lit"), 200);
    // 还没排上拍点（上一句刚判完的空档）：让他随便敲两下出声，不判也不罚
    if (beatTimes.length === 0) return;

    // 判定基准是音频时钟，不是 Date.now()；开局量到的输出延迟先减掉
    const hit = judgeTap(beatTimes, synth.now(), beatTaken, synth.latencyMs);
    if (hit.index < 0) {
      onMiss("这一下没落在拍子上～看着黄线走到方块的那一刻再敲。");
      return;
    }
    if (pattern[hit.index] !== kind) {
      beatTaken[hit.index] = true;
      markDot(hit.index, "miss");
      beatBar?.mark(hit.index, "miss");
      onMiss("拍子对上了，长短敲反了～长音点大鼓，短音点小鼓。");
      return;
    }
    beatTaken[hit.index] = true;
    beatGrades.push(hit.grade);
    inputPos = beatTaken.filter(Boolean).length;
    markDot(hit.index, hit.grade);
    beatBar?.mark(hit.index, hit.grade);
    msgEl.textContent = `${GRADE_WORDS[hit.grade]}！`;
  }

  // -------------------------------------------------------------------------
  // 音程听辨馆
  // -------------------------------------------------------------------------

  function playInterval(): void {
    const q = intervals[roundIdx];
    setListening(true);
    msgEl.textContent = "认真听这两个音…";
    const dur = noteMs();
    later(() => tone(q.a, dur), 400);
    later(() => tone(q.b, dur), 400 + dur + 260);
    later(() => {
      setListening(false);
      msgEl.textContent = "第二个音和第一个音相比，是怎么走的？";
    }, 400 + dur * 2 + 400);
  }

  function renderIntervalChoices(): void {
    const q = intervals[roundIdx];
    choicesEl.innerHTML = "";
    q.choices.forEach((label, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mst-choice";
      btn.textContent = label;
      const fn = (): void => {
        if (ended || listening) return;
        synth.unlock();
        ctx.sfx("tap");
        if (i === q.correct) {
          ctx.sfx("coin");
          // 「几格」好懂，可同样的格数在五声音阶上可能是三度也可能是四度，
          // 所以答对之后把乐理上的真名亮出来，别让孩子记岔。
          msgEl.textContent = `对了！${pentatonicIntervalPhrase(q.a, q.b)}，耳朵真准。`;
          choicesEl.innerHTML = "";
          later(nextRound, 1200);
        } else {
          btn.classList.add("mst-bad");
          btn.disabled = true;
          onMiss("再听一遍，先听出是往上还是往下～");
        }
      };
      btn.addEventListener("click", fn);
      cleanups.push(() => btn.removeEventListener("click", fn));
      choicesEl.appendChild(btn);
    });
  }

  // -------------------------------------------------------------------------
  // 双声部合奏厅：两根手指同时落下才算一拍
  // -------------------------------------------------------------------------

  let chordTimer: ReturnType<typeof setTimeout> | null = null;

  function playDuet(): void {
    const chords = duets[roundIdx];
    setListening(true);
    pad.reset();
    msgEl.textContent = "每一拍有两个音，一起响～";
    renderDots(chords.length);
    const dur = noteMs();
    let at = 600;
    chords.forEach((chord) => {
      later(() => {
        // 同时两个音就把音量分两份，加起来仍在上限之内
        for (const n of chord) lightStar(n, dur, chord.length);
      }, at);
      at += dur + 320;
    });
    later(() => {
      setListening(false);
      inputPos = 0;
      pad.reset();
      renderDots(chords.length);
      msgEl.textContent = "轮到你啦！两颗星星一起按下去～";
    }, at + 200);
  }

  function onStarDown(i: number, pointerId: number): void {
    if (ended || listening) return;
    synth.unlock();
    if (cfg.mode !== "duet") {
      onScoreTap(i);
      return;
    }
    const chord = duets[roundIdx]?.[inputPos];
    if (!chord) return;
    pad.down(pointerId, i, nowMs());
    lightStar(i, Math.min(460, noteMs()), Math.max(1, pad.pointerCount));
    // 给另一根手指留一点点时间落下来，再一起判
    if (chordTimer) clearTimeout(chordTimer);
    chordTimer = setTimeout(() => {
      chordTimer = null;
      if (!destroyed && !ended) judgeChord();
    }, 200);
    timeouts.add(chordTimer);
  }

  function onStarUp(pointerId: number): void {
    if (cfg.mode !== "duet") return;
    pad.up(pointerId, nowMs());
  }

  function judgeChord(): void {
    const chords = duets[roundIdx];
    const chord = chords?.[inputPos];
    if (!chord) return;
    const got = pad.chord(nowMs());
    if (got.length === 0) return;
    if (got.some((k) => !chord.includes(k))) {
      pad.reset();
      onMiss("这一拍是另外两颗星星，再听一遍～");
      return;
    }
    if (!sameChord(got, chord)) {
      // 只按到一颗：不算失误，提醒他两根手指一起来。
      // 这里**不清和弦板**——第一根手指还按着的话，慢半拍落下的第二根仍然算数。
      msgEl.textContent = "对了一颗！两根手指一起按下去，两个音才会一起响～";
      return;
    }
    pad.reset();
    inputPos++;
    renderDots(chords.length);
    if (inputPos >= chords.length) {
      ctx.sfx("coin");
      board?.drawConstellation(chords.flat());
      msgEl.textContent = "两个声部同时对上了，好听！";
      later(nextRound, 900);
    } else {
      msgEl.textContent = "这一拍对了，下一拍～";
    }
  }

  // -------------------------------------------------------------------------
  // 简谱视奏台
  // -------------------------------------------------------------------------

  function scoreGlyphs(): ReturnType<typeof glyphLine> {
    const seq = scores[roundIdx] ?? [];
    const values: NoteValue[] = (scoreValues[roundIdx] ?? []).map((v) => rhythmValue(v === 1));
    return glyphLine(seq.map((n) => midis[n] ?? midis[0]), values);
  }

  function paintScore(): void {
    scoreEl.hidden = false;
    renderScore(scoreEl, scoreGlyphs(), inputPos);
    scoreEl.setAttribute("aria-label", `本句简谱：${toScore(scores[roundIdx] ?? [])}`);
  }

  function onScoreTap(i: number): void {
    const seq = scores[roundIdx];
    if (!seq) return;
    lightStar(i, Math.min(460, noteMs()));
    if (i === seq[inputPos]) {
      inputPos++;
      paintScore();
      renderDots(seq.length);
      if (inputPos >= seq.length) {
        ctx.sfx("coin");
        board?.drawConstellation(seq);
        msgEl.textContent = "整句谱子读下来了，真厉害！";
        later(nextRound, 900);
      }
      return;
    }
    onMiss("看看谱子上现在轮到哪个数字了～");
  }

  // -------------------------------------------------------------------------

  function nowMs(): number {
    return synth.now() * 1000;
  }

  function playRound(): void {
    if (cfg.mode === "rhythm") playRhythm();
    else if (cfg.mode === "interval") playInterval();
    else if (cfg.mode === "duet") playDuet();
  }

  function startRound(): void {
    inputPos = 0;
    pad.reset();
    updateHud();
    choicesEl.innerHTML = "";
    board?.clearConstellation();
    if (cfg.mode === "score") {
      paintScore();
      renderDots(scores[roundIdx].length);
      msgEl.textContent = "照着简谱弹：1 哆 2 来 3 咪 5 索 6 拉；数字下面有横线的是半拍，后面带「-」的是两拍";
      return;
    }
    if (cfg.mode === "interval") renderIntervalChoices();
    playRound();
  }

  const onReplay = (): void => {
    if (ended || listening || cfg.mode === "score") return;
    if (cfg.replays >= 0) {
      if (replaysLeft <= 0) return;
      replaysLeft--;
    }
    synth.unlock();
    ctx.sfx("tap");
    updateHud();
    inputPos = 0;
    pad.reset();
    playRound();
  };
  replayBtn.addEventListener("click", onReplay);

  msgEl.textContent = modeIntro(cfg.mode);
  updateHud();
  later(startRound, 700);

  return {
    destroy() {
      destroyed = true;
      ended = true;
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      if (chordTimer) clearTimeout(chordTimer);
      chordTimer = null;
      replayBtn.removeEventListener("click", onReplay);
      for (const off of cleanups) off();
      cleanups.length = 0;
      beatBar?.destroy();
      beatBar = null;
      audioBar.destroy();
      board?.destroy();
      board = null;
      pad.reset();
      wrap.remove();
    },
  };
}
