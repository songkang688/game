/**
 * 音乐星星 · 自由弹奏沙盒的界面（1.2 新增）。
 *
 * 一块不计分的地方：想弹什么弹什么，录三十秒放给自己听。
 * **不产星、不写关卡进度**——它连 `PlayCtx` 都拿不到，从结构上就影响不了成绩。
 */
import {
  ClipRecorder,
  SANDBOX_MAX_CLIPS,
  SANDBOX_MAX_MS,
  clipName,
  clipLength,
  dropClip,
  loadClips,
  pushClip,
  saveClips,
  scaleMidis,
  type ClipStorage,
  type SandboxClip,
  type ScaleKind,
} from "./sandbox";
import { clipWaveHeights } from "./starTheme";
import { DIATONIC_NOTES, PENTATONIC_NOTES, midiToFreq } from "./tuning";
import { createStarBoard, fitIntoStage, type StarBoardHandle } from "./ui";
import type { StarSynth } from "./synth";

export interface SandboxOptions {
  synth: StarSynth;
  storage?: ClipStorage | null;
  /** 现在几点（毫秒）；测试里可以塞一个假时钟 */
  now?: () => number;
  onClose?: () => void;
}

export interface SandboxHandle {
  el: HTMLElement;
  /**
   * 挂进文档之后叫一声：键盘的宽度得量真实容器才准，而 `createSandbox` 返回时
   * `el` 还是游离节点，`clientWidth` 一律是 0。同时把壳钳进舞台看得见的那一段。
   */
  relayout(): void;
  destroy(): void;
}

export function createSandbox(opts: SandboxOptions): SandboxHandle {
  const now = opts.now ?? ((): number => Date.now());
  const recorder = new ClipRecorder(SANDBOX_MAX_MS);
  let clips: SandboxClip[] = loadClips(opts.storage);
  let scale: ScaleKind = "penta";
  let board: StarBoardHandle | null = null;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const intervals = new Set<ReturnType<typeof setInterval>>();
  const cleanups: Array<() => void> = [];
  const pressedAt = new Map<number, number>();

  const wrap = document.createElement("div");
  wrap.className = "mst-wrap";
  wrap.style.background = "linear-gradient(#1f2a52,#3b4d8f)";
  wrap.innerHTML = `
    <div class="mst-top">
      <div class="mst-badge">🎹 自由弹奏</div>
      <div class="mst-badge mst-sb-state">想弹什么弹什么，这里不算成绩</div>
    </div>
    <div class="mst-msg mst-sb-msg">按住星星就出声，松开就停。</div>
    <div class="mst-sb-keys"></div>
    <div class="mst-tools mst-sb-tools"></div>
    <div class="mst-sb-clips"></div>
  `;

  const fit = fitIntoStage(wrap);

  const stateEl = wrap.querySelector(".mst-sb-state") as HTMLElement;
  const msgEl = wrap.querySelector(".mst-sb-msg") as HTMLElement;
  const keysHost = wrap.querySelector(".mst-sb-keys") as HTMLElement;
  const toolsEl = wrap.querySelector(".mst-sb-tools") as HTMLElement;
  const clipsEl = wrap.querySelector(".mst-sb-clips") as HTMLElement;

  function button(label: string, onClick: () => void, cls = "mst-chip"): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = cls;
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    cleanups.push(() => btn.removeEventListener("click", onClick));
    return btn;
  }

  function buildBoard(): void {
    board?.destroy();
    const midis = scaleMidis(scale);
    const notes = scale === "hepta" ? DIATONIC_NOTES : PENTATONIC_NOTES;
    board = createStarBoard({
      midis,
      notes,
      // 量真正装键盘的那个盒子：七声八键在手机上放不下，得让它知道到底差多少
      host: keysHost,
      onDown: (i, pointerId) => {
        opts.synth.unlock();
        opts.synth.play(midiToFreq(midis[i]), 600, 1);
        pressedAt.set(pointerId, now());
        recorder.noteOn(pointerId, i, now());
        if (recorder.expired(now())) finishRecording();
      },
      onUp: (_i, pointerId) => {
        pressedAt.delete(pointerId);
        recorder.noteOff(pointerId, now());
      },
    });
    keysHost.innerHTML = "";
    keysHost.appendChild(board.el);
  }

  const scaleBtn = button("🎼 五声音阶", () => {
    scale = scale === "penta" ? "hepta" : "penta";
    scaleBtn.textContent = scale === "penta" ? "🎼 五声音阶" : "🎼 七声音阶";
    buildBoard();
    fit.relayout();
  });

  const recBtn = button("⏺️ 录一段", () => {
    if (recorder.active) finishRecording();
    else startRecording();
  }, "mst-btn");

  function startRecording(): void {
    opts.synth.unlock();
    recorder.start(now());
    recBtn.textContent = "⏹️ 停止";
    msgEl.textContent = "录音中，最长 30 秒～";
    const tick = setInterval(() => {
      const left = Math.max(0, SANDBOX_MAX_MS - recorder.elapsed(now()));
      stateEl.textContent = `⏺️ 还能录 ${Math.ceil(left / 1000)} 秒`;
      if (recorder.expired(now())) finishRecording();
    }, 250);
    intervals.add(tick);
  }

  function finishRecording(): void {
    if (!recorder.active) return;
    const notes = recorder.stop(now());
    for (const t of intervals) clearInterval(t);
    intervals.clear();
    recBtn.textContent = "⏺️ 录一段";
    stateEl.textContent = "想弹什么弹什么，这里不算成绩";
    if (notes.length === 0) {
      msgEl.textContent = "这一段没弹到音，再来一次吧～";
      return;
    }
    const clip: SandboxClip = {
      id: `mst-${now()}-${Math.floor(Math.random() * 1000)}`,
      name: clipName(clips.length + 1, notes),
      scale,
      notes,
      ms: clipLength(notes),
    };
    const before = clips.length;
    clips = pushClip(clips, clip, SANDBOX_MAX_CLIPS);
    saveClips(clips, opts.storage);
    msgEl.textContent = before >= SANDBOX_MAX_CLIPS
      ? `存好啦！最多存 ${SANDBOX_MAX_CLIPS} 段，最早那段让位给了新的。`
      : "存好啦！点下面的名字就能听回放。";
    renderClips();
  }

  function playClip(clip: SandboxClip): void {
    opts.synth.unlock();
    const midis = scaleMidis(clip.scale);
    msgEl.textContent = "回放中～";
    for (const note of clip.notes) {
      const t = setTimeout(() => {
        timers.delete(t);
        const midi = midis[note.key];
        if (midi !== undefined) opts.synth.play(midiToFreq(midi), note.dur, 1);
      }, note.at);
      timers.add(t);
    }
    const done = setTimeout(() => {
      timers.delete(done);
      msgEl.textContent = "放完啦，再弹一段？";
    }, clip.ms + 400);
    timers.add(done);
  }

  function renderClips(): void {
    clipsEl.innerHTML = "";
    const head = document.createElement("div");
    head.className = "mst-msg";
    head.textContent = clips.length
      ? `我的小曲子（${clips.length}/${SANDBOX_MAX_CLIPS}）`
      : `还没有录音，最多可以存 ${SANDBOX_MAX_CLIPS} 段。`;
    clipsEl.appendChild(head);
    for (const clip of clips) {
      const row = document.createElement("div");
      // 1.3 视觉：片段做成音符胶带条——夜空色小条 + 波形微缩（从片段音符只读推导）。
      // 数据结构与两颗按钮的行为一字不动，胶带条只是壳。
      row.className = "mst-tools mst-clip";
      const wave = document.createElement("span");
      wave.className = "mst-clip-wave";
      for (const h of clipWaveHeights(clip.notes)) {
        const bar = document.createElement("span");
        bar.className = "mst-clip-bar";
        bar.style.height = `${h}px`;
        wave.appendChild(bar);
      }
      row.appendChild(wave);
      row.appendChild(button(`▶️ ${clip.name}`, () => playClip(clip), "mst-chip mst-clip-play"));
      row.appendChild(
        button("🗑️", () => {
          clips = dropClip(clips, clip.id);
          saveClips(clips, opts.storage);
          renderClips();
        })
      );
      clipsEl.appendChild(row);
    }
  }

  toolsEl.append(scaleBtn, recBtn);
  if (opts.onClose) toolsEl.appendChild(button("🗺️ 回去闯关", () => opts.onClose?.()));
  buildBoard();
  renderClips();

  return {
    el: wrap,
    relayout(): void {
      // 进文档之后键盘宿主才有真实宽度，按它重建一次；八键塞不下就带上横向滚动
      buildBoard();
      fit.relayout();
    },
    destroy(): void {
      for (const t of timers) clearTimeout(t);
      timers.clear();
      for (const t of intervals) clearInterval(t);
      intervals.clear();
      for (const off of cleanups) off();
      cleanups.length = 0;
      fit.dispose();
      board?.destroy();
      board = null;
      wrap.remove();
    },
  };
}
