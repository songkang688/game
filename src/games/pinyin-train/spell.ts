/**
 * 拼读车厢：1.2 新增玩法（易混淆专项站专用）。
 *
 * 一个字摆在车头上，下面是三排车厢——声母、韵母、声调。
 * 把三节车厢拖进挂钩（靠近就吸上去，也可以直接点），挂好按「发车」。
 * 挂钩上会实时显示拼出来的样子，`ü` 碰上 j q x 掉两点、`iou` 省写成 `iu`
 * 这些书写规则孩子能自己看出来——规则本身全在 `pinyin.ts` 里，这里只负责手感。
 *
 * 答对小火车往前开一节并 `play("win")`；答错只让车厢晃一下，不打叉、不扣分表情。
 */
import { rateBelow, type PlayCtx, type PlayHandle } from "../level99";
import type { QuizTheme } from "../quiz99";
import { speak, speechReady, stopSpeaking, whenSpeechReady } from "../speech";
import type { SpellTask } from "./levels";
import { markTone, plainSyllable, spell } from "./pinyin";
import { TICKET_CSS, buildScene } from "./scene";

// ---------------------------------------------------------------------------
// 纯逻辑（不碰 DOM，单测直接调）
// ---------------------------------------------------------------------------

/** 三节车厢分别挂在哪一格 */
export type SlotKind = "initial" | "final" | "tone";
export const SLOT_ORDER: readonly SlotKind[] = ["initial", "final", "tone"];
export const SLOT_LABELS: Record<SlotKind, string> = {
  initial: "声母",
  final: "韵母",
  tone: "声调",
};

/** 手机上的下限：车厢热区 ≥48px，拼音字号 ≥20px，`ü` 的两点靠字号撑住 */
export const CHIP_MIN_PX = 48;
export const PINYIN_FONT_MIN = 20;
export const UMLAUT_FONT_MIN = 18;

/** 拖到离挂钩多近就吸上去（CSS 像素） */
export const SNAP_RADIUS = 64;

export interface Point {
  x: number;
  y: number;
}

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 矩形中心 */
export function rectCenter(r: RectLike): Point {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * 松手的位置离哪个挂钩最近（超出吸附半径返回 -1）。
 * 吸附靠的就是它：手指不用精确对准，够近就算挂上。
 */
export function nearestSlotIndex(p: Point, rects: readonly RectLike[], radius = SNAP_RADIUS): number {
  let best = -1;
  let bestDist = Number.POSITIVE_INFINITY;
  rects.forEach((r, i) => {
    const c = rectCenter(r);
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return bestDist <= radius ? best : -1;
}

/** 挂钩上现在挂着什么 */
export interface SpellPick {
  initial: string | null;
  final: string | null;
  tone: number | null;
}

export function emptyPick(): SpellPick {
  return { initial: null, final: null, tone: null };
}

/** 三节都挂齐了吗 */
export function pickComplete(p: SpellPick): boolean {
  return p.initial !== null && p.final !== null && p.tone !== null;
}

/**
 * 把挂钩上的车厢拼成音节（还差车厢就只拼出能拼的那一截，用于实时预览）。
 * 书写规则一概走 `pinyin.ts`，这里不重写。
 */
export function previewSyllable(p: SpellPick): string {
  if (p.initial === null && p.final === null) return "";
  if (p.final === null) return p.initial ?? "";
  if (p.initial === null) return p.tone === null ? p.final : markTone(p.final, p.tone);
  const plain = plainSyllable(p.initial, p.final);
  return p.tone === null ? plain : spell(p.initial, p.final, p.tone);
}

/** 这一挂对不对（三节没挂齐一律算没拼完，不算错） */
export function judgeSpell(p: SpellPick, task: SpellTask): boolean {
  if (!pickComplete(p)) return false;
  return spell(p.initial as string, p.final as string, p.tone as number) === task.target;
}

/** 答错时的一句话：只说往哪儿想，不说哪一节挂错了，更不说孩子笨 */
export function spellFeedback(p: SpellPick, task: SpellTask): string {
  if (!pickComplete(p)) return "三节车厢都挂上，小火车才好发车～";
  const built = spell(p.initial as string, p.final as string, p.tone as number);
  if (built.replace(/[\u0304\u0301\u030c\u0300]/g, "") === task.target && built !== task.target) {
    return "声母韵母都对啦，再听一遍声调试试～";
  }
  return "再读一遍这个字，换一节车厢试试～";
}

/** 挂错车厢类型时的提示（比如把韵母挂到声调那一格） */
export function wrongSlotLine(kind: SlotKind): string {
  return `这节车厢要挂在「${SLOT_LABELS[kind]}」那一格哦～`;
}

/** 拼读关评星：一次没错 3 星，错两次以内 2 星，其余 1 星 */
export function spellStars(wrong: number): 1 | 2 | 3 {
  return rateBelow(wrong, 0, 2);
}

/** 这一关允许错几次（题多就宽松一点，绝不让孩子一手滑就重来） */
export function spellMaxWrong(taskCount: number): number {
  return Math.max(3, taskCount);
}

/** 声调车厢上写什么（拿 a 当样子，调号看得最清楚） */
export function toneChipText(tone: number): string {
  return markTone("a", tone);
}

export const TONE_CHIP_NAMES = ["一声", "二声", "三声", "四声"];

/** 车头上的那句话（也是自动朗读的内容） */
export function spellAsk(task: SpellTask): string {
  return `请拼出「${task.word}」的音节`;
}

/** 方法提示：只讲怎么拼，不给任何一节车厢的答案 */
export const SPELL_HINT = "先读声母，再读韵母，最后戴上调号。";

// ---------------------------------------------------------------------------
// 玩法（DOM）
// ---------------------------------------------------------------------------

const CSS = `
.pyt-spell{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;border-radius:16px;padding:14px;
  display:flex;flex-direction:column;gap:10px;min-height:380px;user-select:none;-webkit-user-select:none;
  touch-action:manipulation;}
.pyt-top{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;}
.pyt-badge{background:#ffffffd9;border-radius:999px;padding:5px 12px;font-weight:800;font-size:14px;
  box-shadow:0 2px 6px rgba(120,120,160,.2);}
.pyt-loco{display:flex;align-items:center;justify-content:center;gap:10px;background:#fff;border-radius:18px;
  padding:10px 14px;box-shadow:0 3px 10px rgba(120,120,160,.15);transition:transform .35s ease;}
.pyt-loco-emoji{font-size:40px;line-height:1;}
.pyt-loco-word{font-size:40px;font-weight:900;line-height:1.1;}
.pyt-loco-go{transform:translateX(14px);}
.pyt-slots{display:flex;align-items:stretch;justify-content:center;gap:8px;flex-wrap:wrap;}
.pyt-slot{min-width:78px;min-height:${CHIP_MIN_PX + 12}px;border-radius:16px;background:#ffffffb8;
  border:3px dashed #b9b2d0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
  padding:6px 10px;cursor:pointer;font-family:inherit;}
.pyt-slot-tag{font-size:12px;font-weight:800;opacity:.75;}
.pyt-slot-val{font-size:${PINYIN_FONT_MIN + 6}px;font-weight:900;line-height:1.1;min-height:26px;}
.pyt-slot-on{border-style:solid;background:#fff;box-shadow:0 4px 0 rgba(120,120,160,.25);}
.pyt-slot-near{border-color:#ff8fc0;background:#fff0f6;}
.pyt-view{text-align:center;font-size:${PINYIN_FONT_MIN + 14}px;font-weight:900;min-height:42px;letter-spacing:1px;}
.pyt-say-row{display:flex;justify-content:center;position:sticky;top:4px;z-index:3;}
.pyt-say{border:none;border-radius:999px;background:#ffffffe6;cursor:pointer;font-family:inherit;font-weight:900;
  font-size:16px;padding:10px 24px;min-height:${CHIP_MIN_PX}px;box-shadow:0 3px 0 rgba(120,120,160,.3);}
.pyt-say:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,120,160,.3);}
.pyt-yard{display:flex;flex-direction:column;gap:6px;}
.pyt-row{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-items:center;}
.pyt-row-tag{font-size:12px;font-weight:800;opacity:.7;min-width:34px;text-align:right;}
.pyt-chip{border:none;border-radius:14px;padding:8px 14px;min-width:56px;min-height:${CHIP_MIN_PX}px;cursor:grab;
  font-family:inherit;font-size:${PINYIN_FONT_MIN + 2}px;font-weight:900;color:#4a4460;background:#fff;
  box-shadow:0 4px 0 rgba(120,120,160,.3);touch-action:none;line-height:1.15;}
.pyt-chip small{display:block;font-size:11px;font-weight:700;opacity:.7;}
.pyt-chip:active{cursor:grabbing;}
.pyt-chip-used{opacity:.35;box-shadow:none;cursor:default;}
.pyt-chip-drag{position:fixed;z-index:20;pointer-events:none;box-shadow:0 8px 16px rgba(80,60,120,.35);}
.pyt-bottom{display:flex;flex-direction:column;align-items:center;gap:8px;}
.pyt-go{border:none;border-radius:18px;padding:12px 30px;font-size:18px;font-weight:900;color:#fff;cursor:pointer;
  font-family:inherit;background:linear-gradient(180deg,#c84483,#ad3a72);box-shadow:0 5px 0 #8f2c5c;
  min-height:${CHIP_MIN_PX}px;}
.pyt-go:active{transform:translateY(3px);box-shadow:0 2px 0 #8f2c5c;}
.pyt-go[disabled]{opacity:.5;cursor:default;box-shadow:0 5px 0 #8f2c5c;}
.pyt-msg{min-height:24px;font-size:15px;font-weight:800;text-align:center;line-height:1.5;}
.pyt-hint{text-align:center;font-size:13px;font-weight:700;line-height:1.5;opacity:.85;}
.pyt-wobble{animation:pytWobble .38s;}
@keyframes pytWobble{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.pyt-chip:focus-visible,.pyt-go:focus-visible,.pyt-slot:focus-visible,.pyt-say:focus-visible{
  outline:3px solid #3c2a6b;outline-offset:3px;}
@media (max-width:420px){
  .pyt-loco-word{font-size:34px;}
  .pyt-chip{font-size:${PINYIN_FONT_MIN}px;min-width:52px;padding:8px 10px;}
  .pyt-slot{min-width:68px;}
  .pyt-view{font-size:${PINYIN_FONT_MIN + 8}px;}
}
@media (prefers-reduced-motion:reduce){
  .pyt-wobble{animation:none;}
  .pyt-loco{transition:none;}
}
`;

export interface SpellOptions {
  stage: HTMLElement;
  ctx: PlayCtx;
  tasks: SpellTask[];
  theme: QuizTheme;
}

interface ChipRef {
  el: HTMLElement;
  kind: SlotKind;
  value: string;
  tone: number;
}

export function runSpell(opts: SpellOptions): PlayHandle {
  const { stage, ctx, theme } = opts;
  const tasks = opts.tasks.length > 0 ? opts.tasks : [];
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  const maxWrong = spellMaxWrong(tasks.length);
  let destroyed = false;
  let ended = false;
  let index = 0;
  let wrong = 0;
  let pick: SpellPick = emptyPick();
  let chips: ChipRef[] = [];

  const doc = document;
  const wrap = doc.createElement("div");
  wrap.className = "pyt-spell";
  wrap.style.background = theme.bg;

  const styleEl = doc.createElement("style");
  // 车票皮肤排在本款样式之后：同特异度下车票的锯齿与类别色边条要压过白底
  styleEl.textContent = CSS + TICKET_CSS;
  wrap.appendChild(styleEl);

  const top = doc.createElement("div");
  top.className = "pyt-top";
  const progressEl = doc.createElement("span");
  progressEl.className = "pyt-badge";
  progressEl.style.color = theme.accent;
  const lifeEl = doc.createElement("span");
  lifeEl.className = "pyt-badge";
  lifeEl.style.color = "#b84708";
  top.append(progressEl, lifeEl);
  wrap.appendChild(top);

  const loco = doc.createElement("div");
  loco.className = "pyt-loco";
  const locoEmoji = doc.createElement("span");
  locoEmoji.className = "pyt-loco-emoji";
  const locoWord = doc.createElement("span");
  locoWord.className = "pyt-loco-word";
  locoWord.style.color = theme.accent;
  loco.append(locoEmoji, locoWord);
  wrap.appendChild(loco);

  // 火车舞台（纯视觉）：拼对一节挂一节，列车本身就是进度条
  const scene = buildScene({ target: tasks.length });
  wrap.appendChild(scene.el);

  const slotsEl = doc.createElement("div");
  slotsEl.className = "pyt-slots";
  const slotEls: HTMLElement[] = [];
  const slotValEls: HTMLElement[] = [];
  SLOT_ORDER.forEach((kind) => {
    const slot = doc.createElement("button");
    slot.type = "button";
    slot.className = "pyt-slot";
    slot.setAttribute("aria-label", `${SLOT_LABELS[kind]}车厢，还没挂上`);
    const tag = doc.createElement("span");
    tag.className = "pyt-slot-tag";
    tag.style.color = theme.accent;
    tag.textContent = SLOT_LABELS[kind];
    const val = doc.createElement("span");
    val.className = "pyt-slot-val";
    val.style.color = theme.accent;
    val.textContent = "　";
    slot.append(tag, val);
    slot.addEventListener("click", () => clearSlot(kind));
    slotsEl.appendChild(slot);
    slotEls.push(slot);
    slotValEls.push(val);
  });
  wrap.appendChild(slotsEl);

  const viewEl = doc.createElement("div");
  viewEl.className = "pyt-view";
  viewEl.style.color = theme.accent;
  viewEl.setAttribute("aria-live", "polite");
  wrap.appendChild(viewEl);

  const sayRow = doc.createElement("div");
  sayRow.className = "pyt-say-row";
  const sayBtn = doc.createElement("button");
  sayBtn.type = "button";
  // 站台广播喇叭皮肤（pyt-horn 只换背景，不动任何接线）
  sayBtn.className = "pyt-say pyt-horn";
  sayBtn.style.color = theme.accent;
  sayBtn.textContent = "📢 再听一遍";
  sayBtn.hidden = true;
  sayRow.appendChild(sayBtn);
  wrap.appendChild(sayRow);

  const yard = doc.createElement("div");
  yard.className = "pyt-yard";
  const rowEls: HTMLElement[] = [];
  SLOT_ORDER.forEach((kind) => {
    const row = doc.createElement("div");
    row.className = "pyt-row";
    const tag = doc.createElement("span");
    tag.className = "pyt-row-tag";
    tag.style.color = theme.accent;
    tag.textContent = SLOT_LABELS[kind];
    row.appendChild(tag);
    yard.appendChild(row);
    rowEls.push(row);
  });
  wrap.appendChild(yard);

  const bottom = doc.createElement("div");
  bottom.className = "pyt-bottom";
  const goBtn = doc.createElement("button");
  goBtn.type = "button";
  goBtn.className = "pyt-go";
  goBtn.textContent = "🚂 发车";
  const msgEl = doc.createElement("div");
  msgEl.className = "pyt-msg";
  msgEl.style.color = theme.accent;
  const hintEl = doc.createElement("div");
  hintEl.className = "pyt-hint";
  hintEl.style.color = theme.accent;
  hintEl.textContent = SPELL_HINT;
  bottom.append(goBtn, msgEl, hintEl);
  wrap.appendChild(bottom);

  stage.appendChild(wrap);

  // -------------------------------------------------------------------------
  // 朗读：出题自动读，「再听一遍」只在有中文语音包时露面
  // -------------------------------------------------------------------------
  sayBtn.addEventListener("click", () => {
    if (!ended && index < tasks.length) speak(spellAsk(tasks[index]));
  });
  let speechOn = speechReady();
  if (speechOn) sayBtn.hidden = false;
  const unwatchSpeech = whenSpeechReady(() => {
    sayBtn.hidden = false;
    if (!speechOn) {
      speechOn = true;
      if (!destroyed && !ended && index < tasks.length) speak(spellAsk(tasks[index]));
    }
  });

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed) fn();
    }, ms);
    timeouts.add(t);
  }

  function updateHud(): void {
    progressEl.textContent = `第 ${Math.min(index + 1, tasks.length)} / ${tasks.length} 节`;
    const left = Math.max(0, maxWrong + 1 - wrong);
    lifeEl.textContent = `💗 ${"❤".repeat(left)}${"🤍".repeat(Math.min(wrong, maxWrong + 1))}`;
  }

  function updateSlots(): void {
    SLOT_ORDER.forEach((kind, i) => {
      const filled =
        kind === "initial" ? pick.initial : kind === "final" ? pick.final : pick.tone === null ? null : toneChipText(pick.tone);
      slotValEls[i].textContent = filled ?? "　";
      slotEls[i].classList.toggle("pyt-slot-on", filled !== null);
      slotEls[i].setAttribute(
        "aria-label",
        filled === null ? `${SLOT_LABELS[kind]}车厢，还没挂上` : `${SLOT_LABELS[kind]}车厢，挂着 ${filled}，点一下取下来`
      );
    });
    const view = previewSyllable(pick);
    viewEl.textContent = view || "　";
    goBtn.disabled = !pickComplete(pick);
    for (const chip of chips) {
      const used =
        (chip.kind === "initial" && pick.initial === chip.value) ||
        (chip.kind === "final" && pick.final === chip.value) ||
        (chip.kind === "tone" && pick.tone === chip.tone);
      chip.el.classList.toggle("pyt-chip-used", used);
    }
  }

  function place(kind: SlotKind, value: string, tone: number): void {
    if (ended) return;
    ctx.sfx("tap");
    if (kind === "initial") pick.initial = value;
    else if (kind === "final") pick.final = value;
    else pick.tone = tone;
    msgEl.textContent = "";
    updateSlots();
  }

  function clearSlot(kind: SlotKind): void {
    if (ended) return;
    const has = kind === "initial" ? pick.initial !== null : kind === "final" ? pick.final !== null : pick.tone !== null;
    if (!has) return;
    ctx.sfx("tap");
    if (kind === "initial") pick.initial = null;
    else if (kind === "final") pick.final = null;
    else pick.tone = null;
    updateSlots();
  }

  // -------------------------------------------------------------------------
  // 拖拽（够近就吸上去；不想拖也可以直接点车厢）
  // -------------------------------------------------------------------------
  let dragging: ChipRef | null = null;
  let dragMoved = false;
  let startX = 0;
  let startY = 0;

  function slotRects(): RectLike[] {
    return slotEls.map((el) => {
      const r = el.getBoundingClientRect?.();
      return r ? { left: r.left, top: r.top, width: r.width, height: r.height } : { left: 0, top: 0, width: 0, height: 0 };
    });
  }

  function highlight(at: number): void {
    slotEls.forEach((el, i) => el.classList.toggle("pyt-slot-near", i === at));
  }

  function onPointerMove(e: PointerEvent): void {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!dragMoved && Math.hypot(dx, dy) < 6) return;
    dragMoved = true;
    dragging.el.classList.add("pyt-chip-drag");
    dragging.el.style.transform = `translate(${dx}px, ${dy}px)`;
    highlight(nearestSlotIndex({ x: e.clientX, y: e.clientY }, slotRects()));
  }

  function onPointerUp(e: PointerEvent): void {
    const chip = dragging;
    dragging = null;
    if (!chip) return;
    chip.el.classList.remove("pyt-chip-drag");
    chip.el.style.transform = "";
    highlight(-1);
    if (!dragMoved) {
      // 没怎么动就是「点一下」：直接挂到它自己那一格
      place(chip.kind, chip.value, chip.tone);
      return;
    }
    const at = nearestSlotIndex({ x: e.clientX, y: e.clientY }, slotRects());
    if (at < 0) return;
    const kind = SLOT_ORDER[at];
    if (kind !== chip.kind) {
      msgEl.textContent = wrongSlotLine(chip.kind);
      return;
    }
    place(chip.kind, chip.value, chip.tone);
  }

  doc.addEventListener("pointermove", onPointerMove);
  doc.addEventListener("pointerup", onPointerUp);
  doc.addEventListener("pointercancel", onPointerUp);

  function buildChips(task: SpellTask): void {
    chips = [];
    rowEls.forEach((row, i) => {
      // 只留下行首那个「声母 / 韵母 / 声调」标签，其余车厢每题重挂
      while (row.children.length > 1) row.children[row.children.length - 1].remove();
      const kind = SLOT_ORDER[i];
      const values: Array<{ text: string; sub?: string; value: string; tone: number }> =
        kind === "initial"
          ? task.initialChips.map((v) => ({ text: v, value: v, tone: 0 }))
          : kind === "final"
            ? task.finalChips.map((v) => ({ text: v, value: v, tone: 0 }))
            : task.toneChips.map((v) => ({ text: toneChipText(v), sub: TONE_CHIP_NAMES[v - 1], value: "", tone: v }));
      for (const v of values) {
        const btn = doc.createElement("button");
        btn.type = "button";
        // 车票三色助记：声母橙 / 韵母青 / 声调红——颜色即语法，题面与判定不动
        btn.className = `pyt-chip pyt-ticket pyt-tk-${kind}`;
        btn.textContent = v.text;
        if (v.sub) {
          const small = doc.createElement("small");
          small.textContent = v.sub;
          btn.appendChild(small);
        }
        btn.setAttribute("aria-label", `${SLOT_LABELS[kind]}车厢 ${v.sub ?? v.text}`);
        const ref: ChipRef = { el: btn, kind, value: v.value || v.text, tone: v.tone };
        btn.addEventListener("pointerdown", (e) => {
          if (ended) return;
          dragging = ref;
          dragMoved = false;
          startX = (e as PointerEvent).clientX;
          startY = (e as PointerEvent).clientY;
        });
        // 没有指针事件的环境（老浏览器 / 读屏）仍然点得动
        btn.addEventListener("click", () => {
          if (dragMoved) return;
          place(ref.kind, ref.value, ref.tone);
        });
        row.appendChild(btn);
        chips.push(ref);
      }
    });
  }

  function show(): void {
    const task = tasks[index];
    locoEmoji.textContent = task.emoji;
    locoWord.textContent = task.word;
    pick = emptyPick();
    buildChips(task);
    updateHud();
    updateSlots();
    msgEl.textContent = "";
    speak(spellAsk(task));
  }

  function wobble(): void {
    slotEls.forEach((el) => el.classList.add("pyt-wobble"));
    later(() => slotEls.forEach((el) => el.classList.remove("pyt-wobble")), 420);
  }

  function submit(): void {
    if (ended || index >= tasks.length) return;
    const task = tasks[index];
    if (!pickComplete(pick)) {
      msgEl.textContent = spellFeedback(pick, task);
      return;
    }
    if (judgeSpell(pick, task)) {
      ctx.sfx("win");
      // 纯视觉：一节写着这个音节的车厢滑入挂上；整列挂满就鸣笛发车
      scene.hook(task.target);
      if (index + 1 >= tasks.length) later(() => scene.depart(), 420);
      loco.classList.add("pyt-loco-go");
      msgEl.textContent = `拼对啦！${task.word} 读 ${task.target}`;
      speak(`${task.word}，${task.target}`);
      later(() => {
        loco.classList.remove("pyt-loco-go");
        index++;
        if (index >= tasks.length) {
          ended = true;
          const got = spellStars(wrong);
          later(() => ctx.win(got, wrong === 0 ? "整列车一次挂对，拼读真稳！" : "全部拼出来啦，到站！"), 300);
        } else {
          show();
        }
      }, 800);
      return;
    }
    wrong++;
    ctx.sfx("oops");
    updateHud();
    wobble();
    // 纯视觉：车厢轻晃不脱钩 + 站牌「再听一遍」
    scene.wobble();
    if (wrong > maxWrong) {
      ended = true;
      msgEl.textContent = "这几节车厢有点难挂～";
      later(() => ctx.lose("这几个音节有点绕，歇一口气我们再挂一次！"), 500);
      return;
    }
    msgEl.textContent = spellFeedback(pick, task);
  }

  goBtn.addEventListener("click", submit);

  if (tasks.length === 0) {
    // 题目没生成出来也不许白屏
    msgEl.textContent = "这一关的车厢还在路上，先回地图挑一关玩吧！";
    goBtn.disabled = true;
  } else {
    show();
  }

  return {
    destroy() {
      destroyed = true;
      ended = true;
      dragging = null;
      unwatchSpeech();
      stopSpeaking();
      doc.removeEventListener("pointermove", onPointerMove);
      doc.removeEventListener("pointerup", onPointerUp);
      doc.removeEventListener("pointercancel", onPointerUp);
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      scene.destroy();
      wrap.remove();
    },
  };
}
