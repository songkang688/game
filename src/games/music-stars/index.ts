import { meta } from "./meta";
export { meta };

import {
  chapterOf,
  furthestPlayable,
  loadSkips,
  loadStars,
  mountLevelGame,
  type GameApi,
  type PlayCtx,
  type PlayHandle,
} from "../level99";
import { playAdvancedLevel } from "./advanced";
import guide from "./guide";
import { buildMelodies, CHAPTERS, LEVELS, type MusicLevel } from "./levels";
import { clampSpeed, FULL_SPEED, rateWithSpeed, scaleMs, speedHint } from "./practice";
import { openLevelOnMap, parseLevelParam, resolveInitialLevel } from "./runtime";
import { createSandbox, type SandboxHandle } from "./sandboxUi";
import { StarSynth } from "./synth";
import { midiToFreq, PENTATONIC_MIDI, PENTATONIC_NOTES } from "./tuning";
import { createAudioBar, createStarBoard, injectCss } from "./ui";

/**
 * 五声音阶 do re mi sol la。
 * 1.2 起频率不再手打：按十二平均律从 MIDI 号现算（见 `tuning.ts`）。
 */
const NOTE_MIDIS = PENTATONIC_MIDI;

const THEME_BG = [
  "linear-gradient(#27408b,#3b5bad)",
  "linear-gradient(#4a2a6b,#6b3fa0)",
  "linear-gradient(#1b2a5e,#3b4d8f)",
  "linear-gradient(#1e4636,#2d6a4f)",
  "linear-gradient(#5c3900,#8a5a00)",
  "linear-gradient(#3d1e5f,#7b2d8b)",
  "linear-gradient(#6b2737,#a4404f)",
  "linear-gradient(#0b3d3a,#177a6e)",
  "linear-gradient(#432b6b,#6d4aa8)",
  "linear-gradient(#1f3567,#3b5bad)",
];

/** 一个挂载周期内共用一台合成器：换关不重建上下文，也不留下没关的上下文 */
function playLevel(stage: HTMLElement, ctx: PlayCtx, synth: StarSynth): PlayHandle {
  const cfg: MusicLevel = LEVELS[ctx.level];
  if (cfg.mode) {
    return playAdvancedLevel({
      stage,
      ctx,
      cfg,
      level: ctx.level,
      midis: NOTE_MIDIS,
      notes: PENTATONIC_NOTES,
      background: THEME_BG[cfg.theme],
      synth,
    });
  }

  const melodies = buildMelodies(ctx.level);
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let destroyed = false;
  let ended = false;
  let roundIdx = 0;
  let seq: number[] = melodies[0];
  let inputPos = 0;
  let misses = 0;
  let replaysLeft = cfg.replays;
  let speed = FULL_SPEED;
  let phase: "watch" | "play" | "finale" = "watch";

  /** 当前倍率下一个音有多长 / 音符之间空多久 */
  function noteMs(): number {
    return scaleMs(cfg.noteMs, speed);
  }
  function gapMs(): number {
    return Math.round(noteMs() * 0.7);
  }

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed && !ended) fn();
    }, ms);
    timeouts.add(t);
  }

  const wrap = document.createElement("div");
  wrap.className = "mst-wrap";
  wrap.style.background = THEME_BG[cfg.theme];
  injectCss(wrap);
  const head = document.createElement("div");
  head.innerHTML = `
    <div class="mst-top">
      <div class="mst-badge mst-song"></div>
      <div class="mst-badge mst-len">♪ ${cfg.seqLen} 个音</div>
      <div class="mst-badge mst-miss"></div>
      <div class="mst-badge mst-badge-listen mst-listen" hidden>👂 听</div>
    </div>
    <div class="mst-msg"></div>
    <div class="mst-dots"></div>
  `;
  wrap.appendChild(head);
  stage.appendChild(wrap);

  const songEl = wrap.querySelector(".mst-song") as HTMLElement;
  const lenEl = wrap.querySelector(".mst-len") as HTMLElement;
  const missEl = wrap.querySelector(".mst-miss") as HTMLElement;
  const listenEl = wrap.querySelector(".mst-listen") as HTMLElement;
  const msgEl = wrap.querySelector(".mst-msg") as HTMLElement;
  const dotsEl = wrap.querySelector(".mst-dots") as HTMLElement;

  const board = createStarBoard({
    midis: NOTE_MIDIS.slice(0, cfg.starCount),
    notes: PENTATONIC_NOTES.slice(0, cfg.starCount),
    onDown: (i) => onStarDown(i),
  });
  wrap.appendChild(board.el);

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
    onSpeed: (next) => {
      speed = clampSpeed(next);
      msgEl.textContent = speed >= FULL_SPEED
        ? "回到全速啦，这一遍弹对就能拿满星。"
        : "慢速练习：星星唱得慢一点，这一遍最多得一颗星。";
    },
  });
  wrap.appendChild(audioBar.el);

  function tone(i: number, ms: number): void {
    const midi = NOTE_MIDIS[i];
    if (midi === undefined) return;
    synth.play(midiToFreq(midi), ms, 1);
  }

  function lightStar(i: number, ms: number): void {
    board.light(i, ms);
    tone(i, ms);
  }

  function isFinaleRound(): boolean {
    return cfg.finale && roundIdx === melodies.length - 1;
  }

  function setListening(on: boolean): void {
    listenEl.hidden = !on;
    board.setEnabled(!on);
    replayBtn.disabled = on || (cfg.replays >= 0 && replaysLeft <= 0);
  }

  function updateHud(): void {
    songEl.textContent = isFinaleRound()
      ? "🎆 终曲·一闪一闪亮晶晶"
      : `🎵 第 ${roundIdx + 1}/${melodies.length} 句`;
    lenEl.textContent = `♪ ${seq.length} 个音`;
    missEl.textContent = `💗 剩 ${Math.max(0, cfg.maxMiss - misses + 1)} 次机会`;
    replayBtn.textContent = cfg.replays >= 0 && !isFinaleRound()
      ? `🔁 再听一遍（剩 ${Math.max(0, replaysLeft)} 次）`
      : "🔁 再听一遍";
  }

  function renderDots(): void {
    dotsEl.innerHTML = "";
    seq.forEach((_, i) => {
      const dot = document.createElement("div");
      dot.className = "mst-dot" + (i < inputPos ? " mst-dot-on" : "");
      dotsEl.appendChild(dot);
    });
  }

  function playSequence(): void {
    phase = "watch";
    setListening(true);
    board.clearConstellation();
    msgEl.textContent = cfg.replays >= 0
      ? "重听次数有限，先记旋律的走向：往上爬还是往下走～"
      : "把旋律切成两三小段来记，比整句一起记牢得多～";
    inputPos = 0;
    renderDots();
    const step = noteMs() + gapMs();
    seq.forEach((starIdx, k) => {
      later(() => lightStar(starIdx, noteMs()), k * step + 600);
    });
    later(() => {
      phase = "play";
      setListening(false);
      msgEl.textContent = "轮到你啦！按刚才的顺序点星星～";
    }, seq.length * step + 700);
  }

  function startFinale(): void {
    phase = "finale";
    inputPos = 0;
    updateHud();
    renderDots();
    setListening(false);
    replayBtn.disabled = true;
    msgEl.textContent = "🎆 终曲！跟着一闪一闪的星星弹《小星星》～";
    later(() => board.hint(seq[0], true), 700);
  }

  function startRound(): void {
    seq = melodies[roundIdx];
    inputPos = 0;
    updateHud();
    renderDots();
    board.clearConstellation();
    if (isFinaleRound()) startFinale();
    else playSequence();
  }

  function finish(): void {
    ended = true;
    const got = rateWithSpeed(misses, speed);
    const praise = misses === 0 ? "一个音都没弹错，听辨和记忆都很准！" : "整关旋律全部弹完，节奏稳住了！";
    ctx.win(got, `${praise}${speed >= FULL_SPEED ? "" : ` ${speedHint(speed)}`}`);
  }

  function onMiss(): void {
    misses++;
    ctx.sfx("oops");
    updateHud();
    if (misses > cfg.maxMiss) {
      ended = true;
      ctx.lose("这段旋律先放一放～下次试试慢速练习，或者边听边用手比高低，身体记住了手就找得到位置！");
      return;
    }
    msgEl.textContent = "再听一遍～这次把它切成两小段来记～";
    phase = "watch";
    later(() => playSequence(), 900);
  }

  function onStarDown(i: number): void {
    if (ended) return;
    synth.unlock();
    if (phase === "finale") {
      if (i === seq[inputPos]) {
        board.clearHints();
        lightStar(i, 550);
        inputPos++;
        renderDots();
        if (inputPos >= seq.length) {
          ctx.sfx("coin");
          board.drawConstellation(seq);
          msgEl.textContent = "🎇 一闪一闪亮晶晶，弹完整首啦！";
          later(() => finish(), 900);
        } else {
          board.hint(seq[inputPos], true);
        }
      } else {
        lightStar(i, 260);
        msgEl.textContent = "看看哪颗星星在一闪一闪，点它～";
      }
      return;
    }
    if (phase !== "play") return;
    lightStar(i, Math.min(500, noteMs()));
    if (i === seq[inputPos]) {
      inputPos++;
      renderDots();
      if (inputPos >= seq.length) {
        phase = "watch";
        // 结算这一小会儿不吃输入，但不是范奏，所以不亮「听」
        board.setEnabled(false);
        replayBtn.disabled = true;
        ctx.sfx("coin");
        board.drawConstellation(seq);
        msgEl.textContent = "整句都对上了！🎵";
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

  const onReplay = (): void => {
    if (phase !== "play" || ended) return;
    if (cfg.replays >= 0) {
      if (replaysLeft <= 0) return;
      replaysLeft--;
    }
    synth.unlock();
    ctx.sfx("tap");
    updateHud();
    playSequence();
  };
  replayBtn.addEventListener("click", onReplay);

  updateHud();
  startRound();

  return {
    destroy() {
      destroyed = true;
      ended = true;
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      replayBtn.removeEventListener("click", onReplay);
      audioBar.destroy();
      board.destroy();
      wrap.remove();
    },
  };
}

/** 壳层给的 `initialLevel`（1 基），没有就看地址栏的 `?level=N` */
function wantedLevel(api: GameApi): unknown {
  const given = (api as { initialLevel?: unknown }).initialLevel;
  if (given !== undefined && given !== null) return given;
  const loc = (globalThis as { location?: { search?: string; hash?: string } }).location;
  if (!loc) return undefined;
  return parseLevelParam(loc.search ?? "") ?? parseLevelParam(loc.hash ?? "") ?? undefined;
}

export function mount(api: GameApi): { destroy: () => void } {
  const root = document.createElement("div");
  api.root.appendChild(root);
  injectCss(root);

  const synth = new StarSynth();

  // 自由弹奏沙盒：地图之外的一个入口，不产星、不写关卡进度
  const sandboxHost = document.createElement("div");
  const sandboxBar = document.createElement("div");
  sandboxBar.className = "mst-tools";
  sandboxBar.style.margin = "0 0 8px";
  const sandboxBtn = document.createElement("button");
  sandboxBtn.type = "button";
  sandboxBtn.className = "mst-chip";
  sandboxBtn.textContent = "🎹 自由弹奏（不计分）";
  sandboxBar.appendChild(sandboxBtn);
  root.append(sandboxBar, sandboxHost);

  const gameHost = document.createElement("div");
  root.appendChild(gameHost);

  let sandbox: SandboxHandle | null = null;
  function closeSandbox(): void {
    sandbox?.destroy();
    sandbox = null;
    gameHost.hidden = false;
    sandboxBtn.textContent = "🎹 自由弹奏（不计分）";
  }
  const onSandbox = (): void => {
    api.play("tap");
    synth.unlock();
    if (sandbox) {
      closeSandbox();
      return;
    }
    sandbox = createSandbox({ synth, onClose: () => closeSandbox() });
    sandboxHost.appendChild(sandbox.el);
    gameHost.hidden = true;
    sandboxBtn.textContent = "🗺️ 回去闯关";
  };
  sandboxBtn.addEventListener("click", onSandbox);

  // 首次交互解锁 AudioContext：没有这一下，自动播放策略会让整段范奏静音
  const unlock = (): void => synth.unlock();
  const onVisible = (): void => {
    const doc = (globalThis as { document?: { hidden?: boolean } }).document;
    if (doc?.hidden) synth.suspend();
    else synth.unlock();
  };
  root.addEventListener("pointerdown", unlock);
  root.addEventListener("keydown", unlock);
  (globalThis as { document?: { addEventListener?: typeof document.addEventListener } }).document
    ?.addEventListener?.("visibilitychange", onVisible);

  const handle = mountLevelGame(
    { ...api, root: gameHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      guide,
      mapHint: "先记旋律的走向,再补具体的音,分段记最牢；跟不上就先开慢速练习～",
      grandMessage: "188 关全部弹完，你的听辨和视奏都练出来了！",
      playLevel: (stage, ctx) => playLevel(stage, ctx, synth),
    }
  );

  // 直开第 N 关：level99 没有开放 initialLevel，这里照着地图替玩家点一下
  const want = resolveInitialLevel(
    wantedLevel(api),
    furthestPlayable(loadStars(meta.id), loadSkips(meta.id))
  );
  if (want !== null) {
    try {
      openLevelOnMap(gameHost, want, chapterOf(CHAPTERS, want));
    } catch {
      // 点不开就安静停在地图上
    }
  }

  return {
    destroy() {
      sandboxBtn.removeEventListener("click", onSandbox);
      root.removeEventListener("pointerdown", unlock);
      root.removeEventListener("keydown", unlock);
      (globalThis as { document?: { removeEventListener?: typeof document.removeEventListener } }).document
        ?.removeEventListener?.("visibilitychange", onVisible);
      closeSandbox();
      handle.destroy();
      synth.destroy();
      root.remove();
    },
  };
}
