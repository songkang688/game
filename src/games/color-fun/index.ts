export const meta = {
  id: "color-fun",
  title: "涂色小屋",
  emoji: "🎨",
  category: "create" as const,
  color: "#ffd43b",
  blurb: "三幅线稿连着涂，还能用调色锅把红黄蓝变出新颜色！",
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

type Region = { id: string; name: string; svg: string };
type Picture = { name: string; emoji: string; regions: Region[] };

// 三幅线稿，每幅的可涂色区域（fill 由代码控制，初始白色）
const PICTURES: Picture[] = [
  {
    name: "温馨小屋",
    emoji: "🏠",
    regions: [
      { id: "grass", name: "草地", svg: `<rect x="0" y="230" width="400" height="70" rx="6"/>` },
      { id: "wall", name: "墙壁", svg: `<rect x="70" y="130" width="150" height="100"/>` },
      { id: "roof", name: "屋顶", svg: `<polygon points="60,132 230,132 145,60"/>` },
      { id: "door", name: "小门", svg: `<rect x="125" y="168" width="42" height="62" rx="6"/>` },
      { id: "window", name: "窗户", svg: `<circle cx="100" cy="160" r="17"/>` },
      { id: "sun", name: "太阳", svg: `<circle cx="330" cy="60" r="30"/>` },
      { id: "crown", name: "树冠", svg: `<circle cx="310" cy="165" r="42"/>` },
      { id: "trunk", name: "树干", svg: `<rect x="298" y="196" width="24" height="42" rx="5"/>` },
    ],
  },
  {
    name: "快乐农场",
    emoji: "🚜",
    regions: [
      { id: "field", name: "田野", svg: `<rect x="0" y="225" width="400" height="75" rx="6"/>` },
      { id: "barn", name: "谷仓", svg: `<rect x="60" y="122" width="120" height="103"/>` },
      { id: "barnroof", name: "仓顶", svg: `<polygon points="48,124 192,124 120,58"/>` },
      { id: "barndoor", name: "仓门", svg: `<rect x="98" y="160" width="44" height="65" rx="8"/>` },
      { id: "sun2", name: "太阳", svg: `<circle cx="342" cy="55" r="28"/>` },
      { id: "cloud", name: "云朵", svg: `<ellipse cx="245" cy="70" rx="42" ry="20"/>` },
      { id: "pond", name: "池塘", svg: `<ellipse cx="300" cy="255" rx="62" ry="24"/>` },
      { id: "flower", name: "花朵", svg: `<circle cx="42" cy="196" r="17"/>` },
    ],
  },
  {
    name: "海底世界",
    emoji: "🐠",
    regions: [
      { id: "fishbody", name: "鱼身", svg: `<ellipse cx="150" cy="145" rx="56" ry="36"/>` },
      { id: "fishtail", name: "鱼尾", svg: `<polygon points="205,145 252,113 252,177"/>` },
      {
        id: "starfish",
        name: "海星",
        svg: `<polygon points="60,212 68,233 91,233 73,247 80,270 60,256 40,270 47,247 29,233 52,233"/>`,
      },
      { id: "seaweed", name: "水草", svg: `<rect x="322" y="178" width="18" height="92" rx="9"/>` },
      { id: "bubble1", name: "小泡泡", svg: `<circle cx="262" cy="78" r="17"/>` },
      { id: "bubble2", name: "大泡泡", svg: `<circle cx="60" cy="70" r="24"/>` },
      { id: "shell", name: "贝壳", svg: `<path d="M120,262 a30,30 0 0 1 60,0 z"/>` },
      { id: "crab", name: "小螃蟹", svg: `<ellipse cx="332" cy="118" rx="30" ry="20"/>` },
    ],
  },
];

type Paint = { name: string; value: string };

/** 三原色（可倒进调色锅） */
const PRIMARY: Paint[] = [
  { name: "红色", value: "#ff6b6b" },
  { name: "黄色", value: "#ffe066" },
  { name: "蓝色", value: "#74c0fc" },
];
/** 开局就有的其它颜色 */
const EXTRA: Paint[] = [
  { name: "粉色", value: "#faa2c1" },
  { name: "棕色", value: "#c08552" },
];
/** 调色配方：红+黄=橙 等 */
const MIX_TABLE: Record<string, Paint> = {
  "红色+黄色": { name: "橙色", value: "#ffa94d" },
  "黄色+蓝色": { name: "绿色", value: "#8ce99a" },
  "红色+蓝色": { name: "紫色", value: "#b197fc" },
  "红色+红色": { name: "深红", value: "#e03131" },
  "黄色+黄色": { name: "金黄", value: "#fab005" },
  "蓝色+蓝色": { name: "深蓝", value: "#4263eb" },
};

function mixKey(a: Paint, b: Paint): string {
  return [a.name, b.name].sort().join("+");
}

const CSS = `
.cf-wrap{height:100%;min-height:460px;display:flex;flex-direction:column;align-items:center;gap:10px;
  padding:14px;box-sizing:border-box;background:linear-gradient(#fff9db,#ffec99);
  border-radius:20px;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  user-select:none;-webkit-user-select:none;touch-action:manipulation;position:relative;}
.cf-top{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.cf-badge{font-size:15px;font-weight:800;color:#e67700;background:#ffffffcc;border-radius:999px;padding:5px 14px;}
.cf-msg{min-height:24px;font-size:17px;font-weight:700;color:#e8590c;text-align:center;}
.cf-canvas{background:#fff;border-radius:16px;box-shadow:0 4px 0 #0001;max-width:100%;height:auto;}
.cf-canvas .cf-region{cursor:pointer;stroke:#495057;stroke-width:3;stroke-linejoin:round;transition:fill .2s;}
.cf-palette{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.cf-swatch{width:50px;height:50px;border-radius:50%;border:4px solid #fff;cursor:pointer;
  box-shadow:0 3px 0 #0002;transition:transform .15s;padding:0;}
.cf-swatch:active{transform:scale(.92);}
.cf-swatch.cf-picked{transform:scale(1.18);border-color:#343a40;}
.cf-swatch.cf-unlock{animation:cf-unlock .6s;}
@keyframes cf-unlock{0%{transform:scale(0)}70%{transform:scale(1.3)}100%{transform:scale(1)}}
.cf-mixer{display:flex;gap:8px;align-items:center;background:#ffffffcc;border-radius:16px;padding:6px 12px;flex-wrap:wrap;justify-content:center;}
.cf-mix-label{font-size:15px;font-weight:800;color:#e67700;}
.cf-mix-slot{width:38px;height:38px;border-radius:50%;border:3px dashed #ced4da;background:#fff;
  display:flex;align-items:center;justify-content:center;font-size:18px;}
.cf-mix-primary{width:38px;height:38px;border-radius:50%;border:3px solid #fff;cursor:pointer;
  box-shadow:0 2px 0 #0002;padding:0;}
.cf-mix-primary:active{transform:scale(.9);}
.cf-overlay{position:absolute;inset:0;background:#fff9dbde;display:flex;flex-direction:column;gap:14px;
  align-items:center;justify-content:center;border-radius:20px;z-index:10;text-align:center;padding:20px;box-sizing:border-box;}
.cf-ov-title{font-size:26px;font-weight:900;color:#e67700;}
.cf-ov-sub{font-size:17px;font-weight:700;color:#868e96;line-height:1.6;}
.cf-ov-btn{min-height:60px;padding:0 34px;font-size:22px;font-weight:900;color:#fff;border:none;cursor:pointer;
  border-radius:999px;background:linear-gradient(135deg,#ffa94d,#e8590c);box-shadow:0 6px 0 #d9480f;font-family:inherit;}
.cf-ov-btn:active{transform:translateY(4px);box-shadow:0 2px 0 #d9480f;}
`;

export function mount(api: GameApi): { destroy: () => void } {
  const { root, play, addStars, onWin } = api;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (fn: () => void, ms: number) => {
    timers.push(setTimeout(fn, ms));
  };

  root.innerHTML = "";
  const style = document.createElement("style");
  style.textContent = CSS;
  const wrap = document.createElement("div");
  wrap.className = "cf-wrap";
  wrap.innerHTML = `
    <div class="cf-top">
      <div class="cf-badge cf-pic"></div>
      <div class="cf-badge cf-progress"></div>
      <div class="cf-badge cf-colors"></div>
    </div>
    <svg class="cf-canvas" viewBox="0 0 400 300" width="400" height="300" role="img" aria-label="待涂色的线稿"></svg>
    <div class="cf-mixer">
      <span class="cf-mix-label">🥣 调色锅：</span>
      <span class="cf-mix-slot cf-slot-a">?</span>
      <span class="cf-mix-label">+</span>
      <span class="cf-mix-slot cf-slot-b">?</span>
      <span class="cf-mix-label">→ 倒入两种原色试试</span>
      <span class="cf-mix-primaries"></span>
    </div>
    <div class="cf-palette"></div>
    <div class="cf-msg">先点一个颜色，再点画上想涂的地方～</div>
  `;
  root.append(style, wrap);

  const picEl = wrap.querySelector(".cf-pic") as HTMLElement;
  const progressEl = wrap.querySelector(".cf-progress") as HTMLElement;
  const colorsEl = wrap.querySelector(".cf-colors") as HTMLElement;
  const svg = wrap.querySelector(".cf-canvas") as unknown as SVGSVGElement;
  const slotA = wrap.querySelector(".cf-slot-a") as HTMLElement;
  const slotB = wrap.querySelector(".cf-slot-b") as HTMLElement;
  const mixLabel = wrap.querySelectorAll(".cf-mix-label")[2] as HTMLElement;
  const primariesEl = wrap.querySelector(".cf-mix-primaries") as HTMLElement;
  const paletteEl = wrap.querySelector(".cf-palette") as HTMLElement;
  const msgEl = wrap.querySelector(".cf-msg") as HTMLElement;

  let picIdx = 0;
  let picked: Paint = PRIMARY[0];
  let colored = new Set<string>();
  let finished = false;
  let mixedCount = 0;
  const unlocked: Paint[] = [...PRIMARY, ...EXTRA];
  let mixA: Paint | null = null;

  function updateHud() {
    const pic = PICTURES[picIdx];
    picEl.textContent = `${pic.emoji} 第${picIdx + 1}幅·${pic.name}`;
    progressEl.textContent = `🖌️ 涂好 ${colored.size}/${pic.regions.length}`;
    colorsEl.textContent = `🎨 颜色 ${unlocked.length}`;
  }

  function renderPalette() {
    paletteEl.innerHTML = "";
    unlocked.forEach((color) => {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "cf-swatch" + (color === picked ? " cf-picked" : "");
      swatch.style.background = color.value;
      swatch.title = color.name;
      swatch.setAttribute("aria-label", color.name);
      swatch.addEventListener("click", () => {
        play("tap");
        picked = color;
        paletteEl.querySelectorAll(".cf-swatch").forEach((s) => s.classList.remove("cf-picked"));
        swatch.classList.add("cf-picked");
        msgEl.textContent = `选好${color.name}啦，去涂吧！`;
      });
      paletteEl.appendChild(swatch);
    });
  }

  function renderMixer() {
    primariesEl.innerHTML = "";
    PRIMARY.forEach((p) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cf-mix-primary";
      btn.style.background = p.value;
      btn.title = `倒入${p.name}`;
      btn.setAttribute("aria-label", `倒入${p.name}`);
      btn.addEventListener("click", () => onPour(p));
      primariesEl.appendChild(btn);
    });
  }

  function onPour(p: Paint) {
    play("tap");
    if (!mixA) {
      mixA = p;
      slotA.style.background = p.value;
      slotA.textContent = "";
      mixLabel.textContent = "→ 再倒一种原色";
      return;
    }
    const key = mixKey(mixA, p);
    slotB.style.background = p.value;
    slotB.textContent = "";
    const result = MIX_TABLE[key];
    later(() => {
      if (result) {
        const exists = unlocked.some((c) => c.name === result.name);
        if (!exists) {
          unlocked.push(result);
          mixedCount++;
          play("coin");
          msgEl.textContent = `🥣 ${key.replace("+", " 加 ")}变出了${result.name}！新颜色进调色盘啦！`;
          if (mixedCount === 1) {
            addStars(1);
            msgEl.textContent += " 第一次调色成功，奖励一颗小星星！";
          }
          picked = result;
          renderPalette();
          const last = paletteEl.lastElementChild as HTMLElement;
          if (last) last.classList.add("cf-unlock");
        } else {
          play("pop");
          picked = result;
          renderPalette();
          msgEl.textContent = `又调出一锅${result.name}，接着涂吧～`;
        }
      } else {
        play("oops");
        msgEl.textContent = "这两种颜色调不出新颜色，换个搭配试试～";
      }
      mixA = null;
      slotA.style.background = "#fff";
      slotA.textContent = "?";
      slotB.style.background = "#fff";
      slotB.textContent = "?";
      mixLabel.textContent = "→ 倒入两种原色试试";
      updateHud();
    }, 350);
  }

  function renderPicture() {
    const pic = PICTURES[picIdx];
    colored = new Set();
    finished = false;
    svg.innerHTML = pic.regions
      .map((r) => r.svg.replace(/\/>$/, ` class="cf-region" data-id="${r.id}" fill="#ffffff"/>`))
      .join("");
    svg.querySelectorAll<SVGElement>(".cf-region").forEach((el) => {
      el.addEventListener("click", () => {
        if (finished) return;
        const id = el.getAttribute("data-id") || "";
        const region = pic.regions.find((r) => r.id === id);
        el.setAttribute("fill", picked.value);
        play("pop");
        colored.add(id);
        msgEl.textContent = `${region ? region.name : "这里"}涂上${picked.name}，真好看！`;
        updateHud();
        if (colored.size >= pic.regions.length) {
          finished = true;
          play("coin");
          later(() => pictureDone(), 700);
        }
      });
    });
    updateHud();
  }

  function showOverlay(title: string, sub: string, btnText: string, onNext: () => void) {
    const ov = document.createElement("div");
    ov.className = "cf-overlay";
    const t = document.createElement("div");
    t.className = "cf-ov-title";
    t.textContent = title;
    const s = document.createElement("div");
    s.className = "cf-ov-sub";
    s.textContent = sub;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cf-ov-btn";
    b.textContent = btnText;
    b.addEventListener("click", () => {
      play("tap");
      ov.remove();
      onNext();
    });
    ov.append(t, s, b);
    wrap.appendChild(ov);
  }

  function pictureDone() {
    if (picIdx < PICTURES.length - 1) {
      const next = PICTURES[picIdx + 1];
      showOverlay(
        `🎉 ${PICTURES[picIdx].name}涂好啦！`,
        `下一幅是「${next.name}」，试试用调色锅变出新颜色再涂哦～`,
        `画下一幅 ${next.emoji}`,
        () => {
          picIdx++;
          renderPicture();
          msgEl.textContent = "新的线稿来啦，先选颜色再涂～";
        }
      );
    } else {
      const msg =
        mixedCount >= 2
          ? "三幅画全部涂完，还调出了好多新颜色，真是小画家！"
          : "三幅画全部涂得五彩缤纷，真是小画家！";
      onWin(3, msg);
    }
  }

  renderMixer();
  renderPalette();
  renderPicture();

  return {
    destroy() {
      timers.forEach(clearTimeout);
      root.innerHTML = "";
    },
  };
}
