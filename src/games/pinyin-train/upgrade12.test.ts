/**
 * 拼音小火车 · 1.2 升级用例。
 *
 * 1.0 / 1.1 的三份用例（`logic.test.ts` / `levels.test.ts` / `levels188.test.ts`）
 * 一条都没删，这里只往上加：八类题型的生成与判分、易混淆六组的覆盖、
 * 拼读车厢（可解性 / 吸附 / 手感 / 朗读降级 / destroy 归零）、错题回顾、
 * 直开第 N 关，以及 360px 的字号与热区下限。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isAnswerLeak } from "../../ui/guide";
import { chapterOf, chapterStart, type PlayCtx, type StorageLike } from "../level99";
import type { QuizOptions } from "../quiz99";
import guide from "./guide";
import { meta } from "./meta";
import {
  CONFUSE_GROUPS,
  TONE_DRILL_CARDS,
  confuseGroupById,
  type ConfuseGroup,
} from "./logic";
import {
  CHAPTERS,
  CONFUSE_CHAPTER,
  buildPickAll,
  buildQuestions,
  buildReviewQuestions,
  buildSpell,
  confuseGroupOf,
  isPickAllLevel,
  isSpellLevel,
  questionCount,
  splitConfuse,
  type PinyinKind,
  type PinyinQ,
} from "./levels";
import {
  markTone,
  readTone,
  removeToneMarks,
  spell,
  toneMarkPlacedRight,
  toneTargetIndex,
} from "./pinyin";
import {
  CHIP_MIN_PX,
  PINYIN_FONT_MIN,
  SNAP_RADIUS,
  SLOT_LABELS,
  SLOT_ORDER,
  TONE_CHIP_NAMES,
  UMLAUT_FONT_MIN,
  emptyPick,
  judgeSpell,
  nearestSlotIndex,
  pickComplete,
  previewSyllable,
  rectCenter,
  runSpell,
  spellAsk,
  spellFeedback,
  spellMaxWrong,
  spellStars,
  toneChipText,
  wrongSlotLine,
  type SpellPick,
} from "./spell";
import {
  CHRONIC_AT,
  REVIEW_DONE_LINE,
  REVIEW_MAX,
  REVIEW_TRIED_LINE,
  WRONG_KEY,
  loadWrongBook,
  migrateWrongBook,
  recordWrongKinds,
  reviewIntro,
  reviewPlan,
  runQuizWithReview,
  topWrongKinds,
} from "./review";
import { openLevelOnMap, parseLevelParam, resolveInitialLevel, type MapNodeLike } from "./runtime";
import { StubEl, findAll, findByLabel, findOne, installDom, installSpeech, totalListeners } from "./domStub";

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

const CH6_START = chapterStart(CHAPTERS, CONFUSE_CHAPTER);
const CH6_LEVELS = Array.from({ length: CHAPTERS[CONFUSE_CHAPTER].size }, (_, i) => CH6_START + i);
const ALL_LEVELS = Array.from({ length: 188 }, (_, i) => i);
const QUIZ_LEVELS = ALL_LEVELS.filter((lv) => !isPickAllLevel(lv) && !isSpellLevel(lv));

const THEME = { bg: "#fff", accent: "#c2255c" };

interface CtxProbe {
  ctx: PlayCtx;
  sfx: string[];
  wins: Array<{ stars: number; msg?: string }>;
  loses: string[];
}

function makeCtx(level = 100): CtxProbe {
  const probe: CtxProbe = { ctx: null as unknown as PlayCtx, sfx: [], wins: [], loses: [] };
  probe.ctx = {
    level,
    chapter: CHAPTERS[chapterOf(CHAPTERS, level)],
    chapterIndex: chapterOf(CHAPTERS, level),
    indexInChapter: 0,
    win: (stars, msg) => probe.wins.push({ stars, msg }),
    lose: (msg) => probe.loses.push(msg ?? ""),
    sfx: (name) => probe.sfx.push(name),
    bonusStars: () => {},
  };
  return probe;
}

function memStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

/** 这个音节在这一组里算哪一个成员（zhǎo 的声母是 zh 不是 z，靠最长匹配分开） */
function memberOf(group: ConfuseGroup, syllable: string): string | null {
  return splitConfuse(group, syllable)?.member ?? null;
}

// ---------------------------------------------------------------------------
// 一、八类题型
// ---------------------------------------------------------------------------

describe("拼音小火车 1.2 · 八类题型补齐", () => {
  it("规格点名的八类题型在 188 关里一类都不少", () => {
    const kinds = new Set<PinyinKind>();
    for (const lv of QUIZ_LEVELS) for (const q of buildQuestions(lv)) kinds.add(q.kind);
    for (const k of ["initial", "vowel", "tonemark", "whole", "syllable", "odd", "confuse"]) {
      expect(kinds.has(k as PinyinKind)).toBe(true);
    }
    // 第八类「拼读组合」是拖车厢玩法，不走三选一
    expect(ALL_LEVELS.filter(isSpellLevel).length).toBeGreaterThanOrEqual(4);
  });

  it("标声调题：选字母也好、选写法也好，答案都能用标调规则复算", () => {
    let letterQ = 0;
    let writtenQ = 0;
    for (const lv of QUIZ_LEVELS) {
      for (const q of buildQuestions(lv)) {
        if (q.kind !== "tonemark") continue;
        const m = q.ask.match(/「(.+?)」读第([一二三四])声/);
        expect(m).not.toBeNull();
        const tone = ["一", "二", "三", "四"].indexOf(m![2]) + 1;
        const cards = TONE_DRILL_CARDS.filter((c) => c.word === m![1] && c.tone === tone);
        expect(cards.length).toBeGreaterThan(0);
        const card = cards[0];
        if (q.ask.includes("哪个字母")) {
          letterQ++;
          expect(q.answer).toBe(card.plain[toneTargetIndex(card.plain)]);
          for (const c of q.choices) expect(card.plain).toContain(c);
        } else {
          writtenQ++;
          expect(q.answer).toBe(markTone(card.plain, card.tone));
          expect(toneMarkPlacedRight(q.answer)).toBe(true);
          expect(removeToneMarks(q.answer)).toBe(card.plain);
          // 干扰项要么调号戴错地方，要么调值不对，不许有第二个正确写法
          for (const c of q.choices) {
            if (c === q.answer) continue;
            expect(toneMarkPlacedRight(c) && readTone(c) === card.tone).toBe(false);
          }
        }
      }
    }
    expect(letterQ).toBeGreaterThan(0);
    expect(writtenQ).toBeGreaterThan(0);
  });

  it("易混淆题：整音节卷与挖空卷的答案都对得上题库", () => {
    let whole = 0;
    let blank = 0;
    for (const lv of CH6_LEVELS) {
      if (isPickAllLevel(lv) || isSpellLevel(lv)) continue;
      const group = confuseGroupOf(lv);
      for (const q of buildQuestions(lv)) {
        if (q.kind !== "confuse") continue;
        const feature = q.ask.match(/「(.+?)」的(声母|韵母)是哪个？/);
        if (feature) {
          blank++;
          expect(feature[2]).toBe(group.kind === "initial" ? "声母" : "韵母");
          const item = group.items.find((x) => x.char === feature[1]);
          expect(item).toBeDefined();
          expect(q.answer).toBe(memberOf(group, item!.pinyin));
          expect(new Set(q.choices).size).toBe(3);
        } else {
          whole++;
          const m = q.ask.match(/「(.+?)」读哪个？/);
          expect(m).not.toBeNull();
          const item = group.items.find((x) => x.char === m![1]);
          expect(item).toBeDefined();
          expect(q.answer).toBe(item!.pinyin);
          // 对手读音一定在选项里，考的就是这一对
          expect(q.choices).toContain(item!.rival);
        }
      }
    }
    expect(whole).toBeGreaterThan(0);
    expect(blank).toBeGreaterThan(0);
  });

  it("找出读音不同的一个：三个里恰好一个不一样，答案就是它", () => {
    let seen = 0;
    for (const lv of CH6_LEVELS) {
      if (isPickAllLevel(lv) || isSpellLevel(lv)) continue;
      const group = confuseGroupOf(lv);
      for (const q of buildQuestions(lv)) {
        if (q.kind !== "odd") continue;
        seen++;
        expect(q.choices).toHaveLength(3);
        expect(new Set(q.choices).size).toBe(3);
        const members = q.choices.map((c) => memberOf(group, c));
        for (const m of members) expect(m).not.toBeNull();
        const oddMember = memberOf(group, q.answer);
        expect(members.filter((m) => m === oddMember)).toHaveLength(1);
        expect(new Set(members).size).toBe(2);
        expect(q.ask).toContain(group.kind === "initial" ? "声母" : "韵母");
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("题干一律不把答案写出来（188 关逐题扫）", () => {
    for (const lv of QUIZ_LEVELS) {
      for (const q of buildQuestions(lv)) {
        expect(q.ask.includes(q.answer)).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 二、易混淆专项章
// ---------------------------------------------------------------------------

describe("拼音小火车 1.2 · 易混淆专项站", () => {
  it("专项章排在 1.0 六站之后，六组齐全且每组都有自己的判别方法", () => {
    expect(CHAPTERS[CONFUSE_CHAPTER].name).toBe("易混淆专项站");
    expect(CONFUSE_GROUPS.map((g) => g.id)).toEqual(["b-d-p-q", "n-l", "f-h", "an-ang", "in-ing", "z-zh"]);
    for (const g of CONFUSE_GROUPS) {
      expect(g.items.length).toBeGreaterThanOrEqual(6);
      expect(g.tip.length).toBeGreaterThanOrEqual(8);
      expect(isAnswerLeak(g.tip)).toBe(false);
      for (const m of g.members) expect((g.pools[m] ?? []).length).toBeGreaterThanOrEqual(5);
      // 每个成员的音节池互不串门，否则「挑出声母是 X 的」就有第二种答案
      for (const m of g.members) {
        for (const s of g.pools[m]) expect(memberOf(g, s)).toBe(m);
      }
      // 对手读音必须真的只差组内那一个特征
      for (const item of g.items) {
        const mine = memberOf(g, item.pinyin);
        const his = memberOf(g, item.rival);
        expect(mine).not.toBeNull();
        expect(his).not.toBeNull();
        expect(his).not.toBe(mine);
        expect(readTone(item.rival)).toBe(readTone(item.pinyin));
      }
    }
    expect(confuseGroupById("z-zh").id).toBe("z-zh");
    expect(confuseGroupById("查无此组").id).toBe(CONFUSE_GROUPS[0].id);
  });

  it("六组每组都练够 6 题（专项章按组分关，一关只练一组）", () => {
    const tally = new Map<string, number>();
    for (const lv of CH6_LEVELS) {
      if (isPickAllLevel(lv) || isSpellLevel(lv)) continue;
      const group = confuseGroupOf(lv);
      const qs = buildQuestions(lv);
      expect(qs.length).toBe(questionCount(lv));
      for (const q of qs) {
        expect(["confuse", "odd"]).toContain(q.kind);
        tally.set(group.id, (tally.get(group.id) ?? 0) + 1);
      }
    }
    for (const g of CONFUSE_GROUPS) {
      expect(`${g.id}:${tally.get(g.id) ?? 0}`).toBe(`${g.id}:${tally.get(g.id) ?? 0}`);
      expect(tally.get(g.id) ?? 0).toBeGreaterThanOrEqual(6);
    }
  });

  it("专项章的挑拣车厢按组出，四关都在，判据唯一", () => {
    const picks = CH6_LEVELS.filter(isPickAllLevel);
    expect(picks.length).toBeGreaterThanOrEqual(3);
    for (const lv of picks) {
      const task = buildPickAll(lv);
      const group = confuseGroupOf(lv);
      expect(task.rule).toBe("confuse");
      expect(task.hint).toBe(group.tip);
      expect(isAnswerLeak(task.title)).toBe(false);
      const m = task.title.match(/挑出(声母|韵母)是 (\S+) 的/);
      expect(m).not.toBeNull();
      expect(group.members).toContain(m![2]);
      for (const c of task.correct) expect(memberOf(group, c)).toBe(m![2]);
      for (const c of task.chips.filter((x) => !task.correct.includes(x))) {
        expect(memberOf(group, c)).not.toBe(m![2]);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 三、拼读车厢（纯逻辑）
// ---------------------------------------------------------------------------

describe("拼音小火车 1.2 · 拼读车厢的题目", () => {
  it("拼读关只落在专项章里，且和挑拣车厢井水不犯河水", () => {
    const spells = ALL_LEVELS.filter(isSpellLevel);
    expect(spells).toEqual([100, 104, 108, 112]);
    for (const lv of spells) {
      expect(chapterOf(CHAPTERS, lv)).toBe(CONFUSE_CHAPTER);
      expect(isPickAllLevel(lv)).toBe(false);
    }
    for (let lv = 0; lv < 99; lv++) expect(isSpellLevel(lv)).toBe(false);
  });

  it("每一节车厢都可解：正确三节拼出目标音节，干扰车厢拼不出同一个音", () => {
    for (const lv of ALL_LEVELS.filter(isSpellLevel)) {
      const tasks = buildSpell(lv);
      expect(tasks.length).toBeGreaterThanOrEqual(3);
      for (const task of tasks) {
        expect(spell(task.initial, task.final, task.tone)).toBe(task.target);
        expect(task.initialChips).toContain(task.initial);
        expect(task.finalChips).toContain(task.final);
        expect(task.toneChips).toEqual([1, 2, 3, 4]);
        expect(new Set(task.initialChips).size).toBe(task.initialChips.length);
        expect(new Set(task.finalChips).size).toBe(task.finalChips.length);
        // 唯一解：换任何一节车厢都拼不出同一个音节
        for (const ini of task.initialChips) {
          if (ini === task.initial) continue;
          expect(spell(ini, task.final, task.tone)).not.toBe(task.target);
        }
        for (const fin of task.finalChips) {
          if (fin === task.final) continue;
          expect(spell(task.initial, fin, task.tone)).not.toBe(task.target);
        }
        for (const tone of task.toneChips) {
          if (tone === task.tone) continue;
          expect(spell(task.initial, task.final, tone)).not.toBe(task.target);
        }
        expect(toneMarkPlacedRight(task.target)).toBe(true);
      }
    }
  });

  it("专项章的车厢挑本组的字，重玩不换题", () => {
    for (const lv of ALL_LEVELS.filter(isSpellLevel)) {
      expect(JSON.stringify(buildSpell(lv))).toBe(JSON.stringify(buildSpell(lv)));
    }
    // 100 关练的是 b d p q 那一组，车厢上的字就该是那一组的
    const group = confuseGroupOf(100);
    expect(group.id).toBe("b-d-p-q");
    for (const task of buildSpell(100)) {
      expect(group.members).toContain(task.initial);
    }
  });

  it("吸附：够近就挂上，太远就送回车库", () => {
    const rects = [
      { left: 0, top: 0, width: 80, height: 60 },
      { left: 100, top: 0, width: 80, height: 60 },
      { left: 200, top: 0, width: 80, height: 60 },
    ];
    expect(rectCenter(rects[0])).toEqual({ x: 40, y: 30 });
    expect(nearestSlotIndex({ x: 42, y: 32 }, rects)).toBe(0);
    expect(nearestSlotIndex({ x: 140, y: 30 }, rects)).toBe(1);
    expect(nearestSlotIndex({ x: 240, y: 30 }, rects)).toBe(2);
    // 差一点点也吸得上（这就是「吸附」的意义）
    expect(nearestSlotIndex({ x: 140, y: 30 + SNAP_RADIUS - 1 }, rects)).toBe(1);
    // 太远就不吸
    expect(nearestSlotIndex({ x: 140, y: 30 + SNAP_RADIUS + 40 }, rects)).toBe(-1);
    expect(nearestSlotIndex({ x: 0, y: 0 }, [])).toBe(-1);
  });

  it("挂钩预览与判分：三节挂齐才判，判错只提方法不批评", () => {
    const task = buildSpell(100)[0];
    const pick: SpellPick = emptyPick();
    expect(pickComplete(pick)).toBe(false);
    expect(judgeSpell(pick, task)).toBe(false);
    expect(previewSyllable(pick)).toBe("");
    pick.initial = task.initial;
    expect(previewSyllable(pick)).toBe(task.initial);
    pick.final = task.final;
    expect(previewSyllable(pick)).toBe(removeToneMarks(task.target));
    pick.tone = task.tone;
    expect(previewSyllable(pick)).toBe(task.target);
    expect(pickComplete(pick)).toBe(true);
    expect(judgeSpell(pick, task)).toBe(true);
    // ü 的两点在预览里就该按规则掉/留
    expect(previewSyllable({ initial: "j", final: "üe", tone: 2 })).toBe("jué");
    expect(previewSyllable({ initial: "l", final: "üe", tone: 4 })).toBe("lüè");
    for (const line of [
      spellFeedback(emptyPick(), task),
      spellFeedback({ initial: task.initial, final: task.final, tone: (task.tone % 4) + 1 }, task),
      wrongSlotLine("final"),
    ]) {
      expect(line.length).toBeGreaterThan(0);
      expect(line).not.toMatch(/错|笨|差劲|不行|慢/);
    }
    expect(spellStars(0)).toBe(3);
    expect(spellStars(2)).toBe(2);
    expect(spellStars(5)).toBe(1);
    expect(spellMaxWrong(4)).toBeGreaterThanOrEqual(3);
    expect(toneChipText(3)).toBe("ǎ");
    expect(TONE_CHIP_NAMES).toHaveLength(4);
    expect(SLOT_ORDER.map((k) => SLOT_LABELS[k])).toEqual(["声母", "韵母", "声调"]);
  });
});

// ---------------------------------------------------------------------------
// 四、拼读车厢（跑起来）
// ---------------------------------------------------------------------------

describe("拼音小火车 1.2 · 拼读车厢跑起来", () => {
  let dom = installDom();

  beforeEach(() => {
    dom = installDom();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    dom.restore();
  });

  function mountSpell(level = 100): {
    stage: StubEl;
    probe: CtxProbe;
    handle: { destroy?: () => void };
    tasks: ReturnType<typeof buildSpell>;
  } {
    const stage = new StubEl("div");
    const probe = makeCtx(level);
    const tasks = buildSpell(level);
    const handle = runSpell({
      stage: stage as unknown as HTMLElement,
      ctx: probe.ctx,
      tasks,
      theme: THEME,
    });
    return { stage, probe, handle, tasks };
  }

  function solve(stage: StubEl, task: { initial: string; final: string; tone: number }): void {
    findByLabel(stage, `声母车厢 ${task.initial}`)?.fire("click");
    findByLabel(stage, `韵母车厢 ${task.final}`)?.fire("click");
    findByLabel(stage, `声调车厢 ${TONE_CHIP_NAMES[task.tone - 1]}`)?.fire("click");
    findOne(stage, "pyt-go")?.fire("click");
  }

  it("没有中文语音包时朗读按钮藏着，照样点得动、拼得出、过得了关", () => {
    const { stage, probe, tasks } = mountSpell(100);
    const say = findOne(stage, "pyt-say");
    expect(say).not.toBeNull();
    expect(say!.hidden).toBe(true);

    for (const task of tasks) {
      solve(stage, task);
      vi.advanceTimersByTime(1200);
    }
    expect(probe.wins).toHaveLength(1);
    expect(probe.wins[0].stars).toBe(3);
    expect(probe.loses).toHaveLength(0);
    // 答对要放一声 win（小火车往前开）
    expect(probe.sfx.filter((s) => s === "win")).toHaveLength(tasks.length);
  });

  it("有中文语音包时按钮露面，出题自动读，「再听一遍」能重读", () => {
    const speech = installSpeech(["en-US", "zh-CN"]);
    try {
      const { stage, tasks } = mountSpell(100);
      const say = findOne(stage, "pyt-say");
      expect(say!.hidden).toBe(false);
      expect(speech.spoken.at(-1)).toBe(spellAsk(tasks[0]));
      const before = speech.spoken.length;
      say!.fire("click");
      expect(speech.spoken.length).toBe(before + 1);
      expect(speech.spoken.at(-1)).toBe(spellAsk(tasks[0]));
    } finally {
      speech.restore();
    }
  });

  it("拖到挂钩附近就吸上去；拖错格子只给一句温柔提示，不算错", () => {
    const { stage, probe, tasks } = mountSpell(100);
    const slots = findAll(stage, "pyt-slot");
    expect(slots).toHaveLength(3);
    slots[0].rect = { left: 0, top: 0, width: 80, height: 60 };
    slots[1].rect = { left: 100, top: 0, width: 80, height: 60 };
    slots[2].rect = { left: 200, top: 0, width: 80, height: 60 };

    const chip = findByLabel(stage, `声母车厢 ${tasks[0].initial}`) as StubEl;
    // 拖到「声母」挂钩边上：没对准也吸得上
    chip.fire("pointerdown", { clientX: 0, clientY: 300 });
    dom.doc.fire("pointermove", { clientX: 30, clientY: 60 });
    dom.doc.fire("pointerup", { clientX: 30, clientY: 60 });
    expect(findAll(stage, "pyt-slot-on")).toHaveLength(1);
    expect(slots[0].classList.contains("pyt-slot-on")).toBe(true);

    // 把韵母车厢拖到「声调」那一格：只提示，不判错
    const wrongDrop = findByLabel(stage, `韵母车厢 ${tasks[0].final}`) as StubEl;
    wrongDrop.fire("pointerdown", { clientX: 0, clientY: 300 });
    dom.doc.fire("pointermove", { clientX: 230, clientY: 20 });
    dom.doc.fire("pointerup", { clientX: 230, clientY: 20 });
    expect(findOne(stage, "pyt-msg")?.textContent).toBe(wrongSlotLine("final"));
    expect(slots[1].classList.contains("pyt-slot-on")).toBe(false);
    expect(probe.loses).toHaveLength(0);
    expect(probe.sfx).not.toContain("oops");

    // 点一下挂钩就把车厢取下来
    slots[0].fire("click");
    expect(slots[0].classList.contains("pyt-slot-on")).toBe(false);
  });

  it("答错只晃一下车厢、扣一颗心，错到上限也只说「再来一次」", () => {
    const { stage, probe, tasks } = mountSpell(100);
    const wrongIni = tasks[0].initialChips.find((x) => x !== tasks[0].initial) as string;
    const max = spellMaxWrong(tasks.length);
    for (let i = 0; i <= max; i++) {
      findByLabel(stage, `声母车厢 ${wrongIni}`)?.fire("click");
      findByLabel(stage, `韵母车厢 ${tasks[0].final}`)?.fire("click");
      findByLabel(stage, `声调车厢 ${TONE_CHIP_NAMES[tasks[0].tone - 1]}`)?.fire("click");
      findOne(stage, "pyt-go")?.fire("click");
    }
    vi.advanceTimersByTime(1000);
    expect(probe.loses).toHaveLength(1);
    expect(probe.loses[0]).not.toMatch(/笨|差劲|不行|慢/);
    expect(probe.wins).toHaveLength(0);
  });

  it("destroy 之后监听、定时器、DOM 一个都不剩，再调一次也不炸", () => {
    const { stage, handle, tasks } = mountSpell(100);
    solve(stage, tasks[0]);
    expect(stage.children.length).toBe(1);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    expect(totalListeners(dom.doc)).toBeGreaterThan(0);

    handle.destroy?.();
    expect(stage.children.length).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(totalListeners(dom.doc)).toBe(0);
    expect(() => handle.destroy?.()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 五、错题回顾
// ---------------------------------------------------------------------------

describe("拼音小火车 1.2 · 错题回顾", () => {
  let dom = installDom();

  beforeEach(() => {
    dom = installDom();
  });

  afterEach(() => {
    dom.restore();
  });

  interface Harness {
    stage: StubEl;
    probe: CtxProbe;
    calls: QuizOptions[];
    destroys: number;
    handle: { destroy?: () => void };
  }

  function run(level: number, storage: StorageLike | null): Harness {
    const stage = new StubEl("div");
    const probe = makeCtx(level);
    const h: Harness = { stage, probe, calls: [], destroys: 0, handle: {} };
    h.handle = runQuizWithReview(
      {
        stage: stage as unknown as HTMLElement,
        ctx: probe.ctx,
        questions: buildQuestions(level),
        theme: THEME,
        level,
      },
      {
        storage,
        runner: (o) => {
          h.calls.push(o);
          return {
            destroy: () => {
              h.destroys++;
            },
          };
        },
      }
    );
    return h;
  }

  it("全对就不加练，一关到底", () => {
    const store = memStorage();
    const h = run(105, store);
    const inner = h.calls[0].ctx;
    for (let i = 0; i < h.calls[0].questions.length; i++) inner.sfx("coin");
    inner.win(3, "全部一次答对，太了不起啦！");
    expect(h.calls).toHaveLength(1);
    expect(h.probe.wins).toEqual([{ stars: 3, msg: "全部一次答对，太了不起啦！" }]);
    expect(store.map.size).toBe(0);
  });

  it("错过的题型会用同类新题加练，成绩按正题那一轮算", () => {
    const store = memStorage();
    const h = run(105, store);
    const first = h.calls[0];
    const kinds = first.questions.map((q) => (q as PinyinQ).kind);
    const inner = first.ctx;
    // 第一题先错一次再答对，第二题直接错
    inner.sfx("oops");
    inner.sfx("coin");
    inner.sfx("oops");
    inner.sfx("coin");
    for (let i = 2; i < first.questions.length; i++) inner.sfx("coin");
    inner.win(2, "8 道题全部完成！");

    expect(h.calls).toHaveLength(2);
    expect(h.destroys).toBe(1);
    const review = h.calls[1];
    expect(review.questions.length).toBeGreaterThanOrEqual(1);
    expect(review.questions.length).toBeLessThanOrEqual(REVIEW_MAX);
    for (const q of review.questions) expect([kinds[0], kinds[1]]).toContain((q as PinyinQ).kind);
    // 回顾题是「新题」，不是把原题再摆一遍
    const asked = new Set(first.questions.map((q) => `${q.ask}|${q.promptHTML}`));
    expect(review.questions.some((q) => !asked.has(`${q.ask}|${q.promptHTML}`))).toBe(true);
    // 屏幕上要有一条说明「不影响成绩」的横幅
    const banner = findOne(h.stage, "pyt-review");
    expect(banner).not.toBeNull();
    expect(findAll(banner as StubEl, "").length + 1).toBeGreaterThan(0);
    expect(reviewIntro(review.questions.length)).toContain("不影响");

    // 回顾轮答完（不管赢没赢）都按正题的 2 星过关，绝不判负
    review.ctx.win(3, "回顾满分");
    expect(h.probe.wins).toEqual([{ stars: 2, msg: `8 道题全部完成！ ${REVIEW_DONE_LINE}` }]);
    expect(h.probe.loses).toHaveLength(0);
  });

  it("回顾轮就算没做完也只鼓励，照样过关", () => {
    const h = run(105, memStorage());
    const inner = h.calls[0].ctx;
    inner.sfx("oops");
    inner.sfx("coin");
    inner.win(2, "完成");
    h.calls[1].ctx.lose("这一关的题目有点调皮");
    expect(h.probe.loses).toHaveLength(0);
    expect(h.probe.wins).toEqual([{ stars: 2, msg: `完成 ${REVIEW_TRIED_LINE}` }]);
  });

  it("正题就失败时不加练，但错题照记", () => {
    const store = memStorage();
    const h = run(105, store);
    const inner = h.calls[0].ctx;
    inner.sfx("oops");
    inner.lose("这一关的题目有点调皮");
    expect(h.calls).toHaveLength(1);
    expect(h.probe.loses).toHaveLength(1);
    expect(Object.values(loadWrongBook(store)).reduce((a, b) => a + b, 0)).toBe(1);
  });

  it("错题类型存本地，key 走 yiduo-yixing. 前缀，坏数据当空本子", () => {
    expect(WRONG_KEY.startsWith("yiduo-yixing.")).toBe(true);
    const store = memStorage();
    recordWrongKinds(["tone", "tone", "confuse"], store);
    expect([...store.map.keys()]).toEqual([WRONG_KEY]);
    expect(loadWrongBook(store)).toEqual({ tone: 2, confuse: 1 });
    recordWrongKinds(["confuse"], store);
    expect(loadWrongBook(store).confuse).toBe(2);
    recordWrongKinds(["tone"], store);
    expect(topWrongKinds(loadWrongBook(store), 1)).toEqual(["tone"]);
    // 没错题就不写存档，全对的那一关不该留下痕迹
    const clean = memStorage();
    recordWrongKinds([], clean);
    expect(clean.map.size).toBe(0);

    store.map.set(WRONG_KEY, "{坏掉的 json");
    expect(loadWrongBook(store)).toEqual({});
    expect(migrateWrongBook(null)).toEqual({});
    expect(migrateWrongBook([1, 2])).toEqual({});
    expect(migrateWrongBook({ a: -3, b: "x", c: 2.4 })).toEqual({ c: 2 });
    // 存档不可用时照样能玩，只是不记账
    expect(loadWrongBook(null)).toEqual({});
    expect(() => recordWrongKinds(["tone"], null)).not.toThrow();
  });

  it("回顾计划：本关错得多的排前面，老毛病多练一道，最多四道", () => {
    expect(reviewPlan([])).toEqual([]);
    expect(reviewPlan(["tone", "confuse", "tone"])).toEqual(["tone", "confuse"]);
    // 老毛病（历史错过 ≥3 次）多来一道
    expect(reviewPlan(["confuse"], { confuse: CHRONIC_AT })).toEqual(["confuse", "confuse"]);
    expect(reviewPlan(["confuse"], { confuse: CHRONIC_AT - 1 })).toEqual(["confuse"]);
    const many = reviewPlan(["a", "b", "c", "d", "e"] as PinyinKind[], {});
    expect(many).toHaveLength(REVIEW_MAX);
  });

  it("回顾题按题型生成，换一关就换题", () => {
    const a = buildReviewQuestions(105, ["confuse", "odd"]);
    expect(a.map((q) => q.kind)).toEqual(["confuse", "odd"]);
    expect(JSON.stringify(buildReviewQuestions(105, ["confuse", "odd"]))).toBe(JSON.stringify(a));
    expect(JSON.stringify(buildReviewQuestions(107, ["confuse", "odd"]))).not.toBe(JSON.stringify(a));
    for (const q of a) {
      expect(q.choices).toHaveLength(3);
      expect(new Set(q.choices).size).toBe(3);
      expect(q.choices[q.correct]).toBe(q.answer);
    }
    expect(buildReviewQuestions(105, [])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 六、平台接线与红线
// ---------------------------------------------------------------------------

describe("拼音小火车 1.2 · 平台接线与红线", () => {
  it("meta 与事实对齐：11 章 188 关、只闯关、手游端游通吃", () => {
    expect(meta.levels).toBe(188);
    expect(meta.modes).toEqual(["campaign"]);
    expect(meta.platform).toBe("both");
    expect(CHAPTERS).toHaveLength(11);
    expect(meta.blurb).toContain("188");
    expect(meta.blurb).not.toMatch(/[A-Za-z]/);
  });

  it("?level=N 与壳层的 initialLevel 都能直开第 N 关，越界会夹回来", () => {
    expect(parseLevelParam("?level=12")).toBe(12);
    expect(parseLevelParam("#level=7&x=1")).toBe(7);
    expect(parseLevelParam("?a=1")).toBeNull();
    expect(parseLevelParam("")).toBeNull();
    // 1 基进、0 基出
    expect(resolveInitialLevel(12, 187)).toBe(11);
    expect(resolveInitialLevel("12", 187)).toBe(11);
    // 还没解锁的关退回当前能玩到的最远一关
    expect(resolveInitialLevel(120, 5)).toBe(5);
    // 越界夹回来
    expect(resolveInitialLevel(9999, 187)).toBe(187);
    expect(resolveInitialLevel(-3, 187)).toBe(0);
    expect(resolveInitialLevel(undefined, 10)).toBeNull();
    expect(resolveInitialLevel("哪一关", 10)).toBeNull();
  });

  it("直开靠点地图上的按钮（公共框架没开口子，也不许改它）", () => {
    const clicks: string[] = [];
    const node = (label: string, locked = false): MapNodeLike => ({
      classList: { contains: (c: string) => locked && c.endsWith("-lock") },
      getAttribute: () => label,
      click: () => clicks.push(label),
    });
    const tabs = [node("tab0"), node("tab1"), node("tab2")];
    const nodes = [node("第 100 关，还没通关"), node("第 101 关，还没解锁", true)];
    const host = {
      querySelectorAll: (sel: string) => (sel.includes("tab") ? tabs : nodes),
    };
    expect(openLevelOnMap(host, 99, 1)).toBe(true);
    expect(clicks).toEqual(["tab1", "第 100 关，还没通关"]);
    // 关卡锁着就不点，安静停在地图上
    expect(openLevelOnMap(host, 100, 1)).toBe(false);
    // 章节锁着也不点
    const lockedHost = { querySelectorAll: () => [node("tab0", true)] };
    expect(openLevelOnMap(lockedHost, 0, 0)).toBe(false);
    // 章号越界不炸
    expect(openLevelOnMap(host, 0, 99)).toBe(false);
  });

  it("攻略盖住 11 章、区间首尾相接、一条都不泄题", () => {
    expect(guide.gameId).toBe(meta.id);
    expect(guide.entries).toHaveLength(CHAPTERS.length);
    let cursor = 1;
    guide.entries.forEach((entry, ci) => {
      expect(entry.from).toBe(cursor);
      expect(entry.to).toBe(cursor + CHAPTERS[ci].size - 1);
      cursor = entry.to + 1;
      expect(entry.tips.length).toBeGreaterThanOrEqual(3);
      for (const tip of entry.tips) expect(isAnswerLeak(tip)).toBe(false);
    });
    expect(cursor - 1).toBe(188);
    for (const tip of guide.general) expect(isAnswerLeak(tip)).toBe(false);
  });

  it("面向孩子的文案没有商标，也没有一句丧气话", () => {
    const BRANDS = [
      "愤怒的小鸟", "植物大战僵尸", "水果忍者", "地铁跑酷", "森林冰火人", "屁王兄弟", "拳皇", "街霸",
      "超级玛丽", "马里奥", "割绳子", "俄罗斯方块", "Tetris", "贪吃蛇大作战", "球球大作战", "我的世界",
      "Minecraft", "三国杀", "大富翁", "斗地主", "Pac-Man", "吃豆人", "宝可梦", "皮卡丘", "奥特曼",
      "喜羊羊", "蛋仔", "原神", "王者荣耀",
    ];
    const text = [
      meta.title, meta.blurb,
      ...CHAPTERS.map((c) => `${c.name}${c.desc}`),
      ...guide.general,
      ...guide.entries.flatMap((e) => [e.title, ...e.tips]),
      ...CONFUSE_GROUPS.map((g) => g.tip),
      ...ALL_LEVELS.filter(isPickAllLevel).flatMap((lv) => [buildPickAll(lv).title, buildPickAll(lv).hint]),
    ].join("\n");
    for (const brand of BRANDS) expect(text).not.toContain(brand);
    expect(text).not.toMatch(/笨|蠢|差劲|失败者/);
  });

  it("360px 手机下限：热区 ≥44px、拼音字号 ≥20px、ü 的两点靠 ≥18px 撑住", () => {
    expect(CHIP_MIN_PX).toBeGreaterThanOrEqual(44);
    expect(PINYIN_FONT_MIN).toBeGreaterThanOrEqual(20);
    expect(UMLAUT_FONT_MIN).toBeGreaterThanOrEqual(18);
    expect(PINYIN_FONT_MIN).toBeGreaterThanOrEqual(UMLAUT_FONT_MIN);

    const dom = installDom();
    try {
      const stage = new StubEl("div");
      runSpell({
        stage: stage as unknown as HTMLElement,
        ctx: makeCtx(100).ctx,
        tasks: buildSpell(100),
        theme: THEME,
      }).destroy?.();
      // destroy 之后 DOM 拆干净了，样式表在挂载时就写进去过
    } finally {
      dom.restore();
    }

    const dom2 = installDom();
    try {
      const stage = new StubEl("div");
      runSpell({
        stage: stage as unknown as HTMLElement,
        ctx: makeCtx(100).ctx,
        tasks: buildSpell(100),
        theme: THEME,
      });
      const css = findAll(stage, "")
        .concat(stage.children)
        .flatMap((el) => el.children)
        .filter((el) => el.tagName === "style")
        .map((el) => el.textContent)
        .join("\n");
      expect(css).toContain(`min-height:${CHIP_MIN_PX}px`);
      expect(css).toContain("prefers-reduced-motion");
      expect(css).toContain("max-width:420px");
      expect(css).toContain(`font-size:${PINYIN_FONT_MIN}px`);
    } finally {
      dom2.restore();
    }
  });
});
