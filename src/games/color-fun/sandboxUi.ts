/**
 * 涂色小屋 · 自由涂色沙盒的界面（1.2 新增）。
 *
 * 关卡外的一间画室：任选线稿、任选颜色、没有指令、没有对错，
 * 撤销重做随便按，画完可以存进画廊（最多 12 张）。
 *
 * **不产星、不写关卡进度、不影响任何解锁**——它连 `ctx.win` 都碰不到。
 */
import { PIGMENTS, PIGMENT_HEX } from "./mix";
import { PICTURES } from "./levels";
import { PaintHistory } from "./history";
import {
  browserStorage,
  isFull,
  loadWorks,
  removeWork,
  replaceWork,
  saveWork,
  type SandboxWork,
  type StorageLike,
} from "./sandbox";
import { CLF_CSS, makeSwatch, pictureSvgBody, thumbnailSvg } from "./ui";

export interface SandboxOptions {
  /** 音效走壳层，沙盒自己不产声音资源 */
  sfx?: (name: "tap" | "pop" | "coin" | "oops") => void;
  /** 关掉画室 */
  onClose?: () => void;
  /** 存档层，不给就用 localStorage；隐私模式下取不到也照样能画 */
  storage?: StorageLike | null;
}

export interface SandboxHandle {
  destroy: () => void;
}

/** 做无障碍屏蔽只用得上这三件事；接口窄一点，用例拿个桩就能验 */
export interface MuteTarget {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

/** 浮层盖住底下的东西以后，这两个属性一起上，键盘与读屏才真的绕开它 */
const MUTE_ATTRS: ReadonlyArray<[string, string]> = [
  ["inert", ""],
  ["aria-hidden", "true"],
];

/**
 * 把浮层背后的那些节点标成 `inert` + `aria-hidden`，返回一个原样还原的函数。
 *
 * 画室是 `position:absolute; z-index:9` 的一层纸，视觉上盖住了选关地图，
 * 但地图上十来个控件仍然 Tab 得到——键盘和读屏的孩子会一路走进看不见的地图，
 * 甚至误触「开始冒险」直接跳出画室（窗口5 第1轮 W5-A-05）。
 * 还原时按原值放回去，本来就写着这两个属性的节点不会被顺手擦掉。
 */
export function muteBehind(targets: readonly MuteTarget[]): () => void {
  const undo: Array<() => void> = [];
  for (const el of targets) {
    for (const [name, value] of MUTE_ATTRS) {
      const before = el.getAttribute(name);
      undo.push(() => (before === null ? el.removeAttribute(name) : el.setAttribute(name, before)));
      el.setAttribute(name, value);
    }
  }
  return () => {
    for (const fn of undo) fn();
  };
}

/** 这个键算不算「关上画室」（`Esc` 是老浏览器上 `Escape` 的旧名字） */
export function isSandboxDismissKey(key: string): boolean {
  return key === "Escape" || key === "Esc";
}

/**
 * 把存档里记的线稿下标收进 `PICTURES` 的范围，越界一律回到第一幅。
 *
 * `sandbox.ts` 只管这个下标是不是个 ≥0 的有限数，它不认识这里有几幅线稿；
 * 存档被改坏、或者从装过新版的机器退回旧版，都会留下一个指不到画的下标。
 * 拿它去 `PICTURES[i].regions` 就是 `undefined.regions`，整间画室当场崩掉
 * （窗口5 第1轮监督修复员 W5-F-01）。
 */
export function safePicIndex(i: number): number {
  return Number.isInteger(i) && i >= 0 && i < PICTURES.length ? i : 0;
}

/** 在 `host` 上盖一层自由涂色画室 */
export function openSandbox(host: HTMLElement, opts: SandboxOptions = {}): SandboxHandle {
  const doc = host.ownerDocument;
  const store = opts.storage === undefined ? browserStorage() : opts.storage;
  const sfx = opts.sfx ?? ((): void => {});
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let destroyed = false;

  const history = new PaintHistory();
  let picIndex = 0;
  let picked = "红色";
  /** 画廊满了以后正在等孩子挑「换掉哪一张」 */
  let replacing = false;
  let works: SandboxWork[] = loadWorks(store);

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed) fn();
    }, ms);
    timeouts.add(t);
  }

  const sheet = doc.createElement("div");
  sheet.className = "clf-sheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-label", "自由涂色画室");
  sheet.innerHTML = `
    <style>${CLF_CSS}</style>
    <div class="clf-sheet-head">
      <span class="clf-sheet-title">🎨 自由涂色</span>
      <button type="button" class="clf-tool clf-close">✖ 关上画室</button>
    </div>
    <div class="clf-picks"></div>
    <div class="clf-stage"><svg class="clf-canvas" viewBox="0 0 400 300" role="img" aria-label="自由涂色的线稿"></svg></div>
    <div class="clf-tools">
      <button type="button" class="clf-tool clf-undo">↩️ 撤销</button>
      <button type="button" class="clf-tool clf-redo">↪️ 重做</button>
      <button type="button" class="clf-tool clf-clear">🧽 清空</button>
      <button type="button" class="clf-tool clf-save">💾 存进画廊</button>
    </div>
    <div class="clf-palette"></div>
    <div class="clf-msg"></div>
    <div class="clf-sheet-title clf-gallery-title">🖼️ 我的画廊</div>
    <div class="clf-gallery"></div>
    <div class="clf-empty"></div>
  `;
  // 开画室之前记下焦点在谁身上，关上以后原样还给他（多半就是「🎨 自由涂色」那颗按钮）
  const opener = doc.activeElement as { focus?: () => void } | null;
  host.appendChild(sheet);
  // 画室盖住的那几层（模式条与选关地图）对键盘和读屏一并让位
  const restoreBehind = muteBehind(
    Array.from(host.children).filter((el) => el !== sheet) as unknown as MuteTarget[]
  );

  const picksEl = sheet.querySelector(".clf-picks") as HTMLElement;
  const svg = sheet.querySelector(".clf-canvas") as unknown as SVGSVGElement;
  const paletteEl = sheet.querySelector(".clf-palette") as HTMLElement;
  const msgEl = sheet.querySelector(".clf-msg") as HTMLElement;
  const galleryEl = sheet.querySelector(".clf-gallery") as HTMLElement;
  const emptyEl = sheet.querySelector(".clf-empty") as HTMLElement;
  const undoBtn = sheet.querySelector(".clf-undo") as HTMLButtonElement;
  const redoBtn = sheet.querySelector(".clf-redo") as HTMLButtonElement;
  const clearBtn = sheet.querySelector(".clf-clear") as HTMLButtonElement;
  const saveBtn = sheet.querySelector(".clf-save") as HTMLButtonElement;
  const closeBtn = sheet.querySelector(".clf-close") as HTMLButtonElement;

  function say(text: string): void {
    msgEl.textContent = text;
  }

  function paintAll(): void {
    const fills = history.replay();
    for (const r of PICTURES[picIndex].regions) {
      const el = svg.querySelector(`[data-id="${r.id}"]`);
      el?.setAttribute("fill", PIGMENT_HEX[fills[r.id]] ?? "#ffffff");
    }
  }

  function renderCanvas(): void {
    svg.innerHTML = pictureSvgBody(PICTURES[picIndex]);
    svg.querySelectorAll<SVGElement>(".clf-region").forEach((el) => {
      const id = el.getAttribute("data-id") ?? "";
      el.addEventListener("click", () => onRegion(id));
    });
    paintAll();
  }

  function renderTools(): void {
    undoBtn.disabled = !history.canUndo;
    redoBtn.disabled = !history.canRedo;
  }

  function onRegion(id: string): void {
    const before = history.replay()[id] ?? null;
    if (before === picked) return;
    history.push({ region: id, from: before, to: picked });
    sfx("pop");
    paintAll();
    renderTools();
    say(`涂上${picked}啦，想改随时按撤销～`);
  }

  function renderPicks(): void {
    picksEl.innerHTML = "";
    PICTURES.forEach((pic, i) => {
      const btn = doc.createElement("button");
      btn.type = "button";
      btn.className = `clf-pick${i === picIndex ? " clf-pick-on" : ""}`;
      btn.textContent = `${pic.emoji} ${pic.name}`;
      btn.setAttribute("aria-label", `换成${pic.name}的线稿`);
      btn.addEventListener("click", () => {
        if (i === picIndex) return;
        sfx("tap");
        picIndex = i;
        history.clear();
        renderPicks();
        renderCanvas();
        renderTools();
        say(`换成「${pic.name}」啦，随便涂～`);
      });
      picksEl.appendChild(btn);
    });
  }

  function renderPalette(): void {
    paletteEl.innerHTML = "";
    for (const p of PIGMENTS) {
      const btn = makeSwatch(doc, p.name);
      if (p.name === picked) btn.classList.add("clf-picked");
      btn.addEventListener("click", () => {
        sfx("tap");
        picked = p.name;
        renderPalette();
        say(`选好${p.name}啦～`);
      });
      paletteEl.appendChild(btn);
    }
  }

  function renderGallery(): void {
    galleryEl.innerHTML = "";
    works.forEach((work, i) => {
      const btn = doc.createElement("button");
      btn.type = "button";
      btn.className = `clf-work${replacing ? " clf-work-on" : ""}`;
      btn.innerHTML = thumbnailSvg(PICTURES[safePicIndex(work.pic)], work.fills);
      btn.setAttribute(
        "aria-label",
        replacing ? `把第 ${i + 1} 张换成现在这幅` : `打开第 ${i + 1} 张作品接着涂`
      );
      btn.addEventListener("click", () => onWork(i));
      galleryEl.appendChild(btn);
    });
    emptyEl.textContent = works.length
      ? `画廊里有 ${works.length}/12 张${isFull(works) ? "，满啦，再存要挑一张换掉" : ""}`
      : "画廊还是空的，画一幅存进来吧～";
  }

  function onWork(at: number): void {
    const work = works[at];
    if (!work) return;
    if (replacing) {
      works = replaceWork(store, at, currentWork()).works;
      replacing = false;
      sfx("coin");
      say(`第 ${at + 1} 张换成现在这幅啦～`);
      renderGallery();
      return;
    }
    // 打开旧作接着涂：整幅当作一笔铺上去，撤销一下就能回到空白
    sfx("tap");
    picIndex = safePicIndex(work.pic);
    history.clear();
    for (const [region, color] of Object.entries(work.fills)) {
      history.push({ region, from: null, to: color });
    }
    renderPicks();
    renderCanvas();
    renderTools();
    say(`打开第 ${at + 1} 张，接着画吧～`);
  }

  function currentWork(): SandboxWork {
    return { pic: picIndex, fills: history.replay(), at: Date.now() };
  }

  undoBtn.addEventListener("click", () => {
    if (!history.undo()) return;
    sfx("tap");
    paintAll();
    renderTools();
    say("退回一步啦～");
  });
  redoBtn.addEventListener("click", () => {
    if (!history.redo()) return;
    sfx("tap");
    paintAll();
    renderTools();
    say("又涂回来啦～");
  });
  clearBtn.addEventListener("click", () => {
    sfx("tap");
    history.clear();
    paintAll();
    renderTools();
    say("擦干净了，重新开始～");
  });
  saveBtn.addEventListener("click", () => {
    const fills = history.replay();
    if (Object.keys(fills).length === 0) {
      say("先涂上几笔再存吧～");
      return;
    }
    const res = saveWork(store, currentWork());
    works = res.works;
    if (res.saved) {
      sfx("coin");
      say(`存好啦！画廊里现在有 ${works.length}/12 张。`);
      replacing = false;
    } else {
      sfx("oops");
      replacing = true;
      say("画廊满 12 张啦～在下面挑一张，就用现在这幅把它换掉。");
    }
    renderGallery();
  });
  closeBtn.addEventListener("click", () => {
    sfx("tap");
    opts.onClose?.();
  });

  // Esc 关上画室：和平台其它弹窗一个习惯。焦点锁在画室里，按键一定从这儿冒上来
  sheet.addEventListener("keydown", (e) => {
    const ev = e as KeyboardEvent;
    if (!isSandboxDismissKey(ev.key)) return;
    ev.preventDefault();
    ev.stopPropagation();
    sfx("tap");
    opts.onClose?.();
  });

  // 长按一张作品可以删掉；短按是打开，两者不冲突
  galleryEl.addEventListener("contextmenu", (e) => {
    const btn = (e.target as HTMLElement | null)?.closest?.(".clf-work");
    if (!btn) return;
    e.preventDefault();
    const at = Array.prototype.indexOf.call(galleryEl.children, btn);
    if (at < 0) return;
    works = removeWork(store, at);
    replacing = false;
    sfx("tap");
    say(`第 ${at + 1} 张收起来啦～`);
    renderGallery();
  });

  renderPicks();
  renderCanvas();
  renderPalette();
  renderTools();
  renderGallery();
  say("随便涂，没有对错～涂错了按撤销就好。");
  // 第一站就落在「✖ 关上画室」，Tab 一路都在画室里转
  closeBtn.focus?.();

  return {
    destroy() {
      destroyed = true;
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      history.clear();
      sheet.remove();
      restoreBehind();
      opener?.focus?.();
    },
  };
}
