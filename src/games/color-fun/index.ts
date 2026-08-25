export const meta = {
  id: "color-fun",
  title: "涂色小屋",
  emoji: "🎨",
  category: "create" as const,
  color: "#ffd43b",
  blurb: "选喜欢的颜色，把小屋的线稿涂得漂漂亮亮！",
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

// 线稿的可涂色区域（fill 由代码控制，初始白色）
const REGIONS: Region[] = [
  { id: "grass", name: "草地", svg: `<rect x="0" y="230" width="400" height="70" rx="6"/>` },
  { id: "wall", name: "墙壁", svg: `<rect x="70" y="130" width="150" height="100"/>` },
  { id: "roof", name: "屋顶", svg: `<polygon points="60,132 230,132 145,60"/>` },
  { id: "door", name: "小门", svg: `<rect x="125" y="168" width="42" height="62" rx="6"/>` },
  { id: "window", name: "窗户", svg: `<circle cx="100" cy="160" r="17"/>` },
  { id: "sun", name: "太阳", svg: `<circle cx="330" cy="60" r="30"/>` },
  { id: "crown", name: "树冠", svg: `<circle cx="310" cy="165" r="42"/>` },
  { id: "trunk", name: "树干", svg: `<rect x="298" y="196" width="24" height="42" rx="5"/>` },
];

const PALETTE = [
  { name: "红色", value: "#ff6b6b" },
  { name: "橙色", value: "#ffa94d" },
  { name: "黄色", value: "#ffe066" },
  { name: "绿色", value: "#8ce99a" },
  { name: "天蓝", value: "#74c0fc" },
  { name: "紫色", value: "#b197fc" },
  { name: "粉色", value: "#faa2c1" },
  { name: "棕色", value: "#c08552" },
];

const CSS = `
.cf-wrap{height:100%;min-height:420px;display:flex;flex-direction:column;align-items:center;gap:12px;
  padding:16px;box-sizing:border-box;background:linear-gradient(#fff9db,#ffec99);
  border-radius:20px;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  user-select:none;-webkit-user-select:none;touch-action:manipulation;}
.cf-title{font-size:20px;font-weight:700;color:#e67700;background:#ffffffcc;border-radius:999px;padding:6px 18px;}
.cf-msg{min-height:26px;font-size:19px;font-weight:700;color:#e8590c;}
.cf-canvas{background:#fff;border-radius:16px;box-shadow:0 4px 0 #0001;max-width:100%;}
.cf-canvas .cf-region{cursor:pointer;stroke:#495057;stroke-width:3;stroke-linejoin:round;transition:fill .2s;}
.cf-palette{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}
.cf-swatch{width:56px;height:56px;border-radius:50%;border:4px solid #fff;cursor:pointer;
  box-shadow:0 3px 0 #0002;transition:transform .15s;padding:0;}
.cf-swatch:active{transform:scale(.92);}
.cf-swatch.cf-picked{transform:scale(1.2);border-color:#343a40;}
`;

export function mount(api: GameApi): { destroy: () => void } {
  const { root, play, onWin } = api;
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
    <div class="cf-title">先点一个颜色，再点小屋上想涂的地方～</div>
    <svg class="cf-canvas" viewBox="0 0 400 300" width="400" height="300" role="img" aria-label="待涂色的小屋线稿"></svg>
    <div class="cf-palette"></div>
    <div class="cf-msg"></div>
  `;
  root.append(style, wrap);

  const titleEl = wrap.querySelector(".cf-title") as HTMLElement;
  const svg = wrap.querySelector(".cf-canvas") as unknown as SVGSVGElement;
  const paletteEl = wrap.querySelector(".cf-palette") as HTMLElement;
  const msgEl = wrap.querySelector(".cf-msg") as HTMLElement;

  svg.innerHTML = REGIONS.map((r) =>
    r.svg.replace(/\/>$/, ` class="cf-region" data-id="${r.id}" fill="#ffffff"/>`)
  ).join("");

  let picked = PALETTE[0];
  const colored = new Set<string>();
  let finished = false;

  function updateTitle() {
    if (colored.size === 0) {
      titleEl.textContent = "先点一个颜色，再点小屋上想涂的地方～";
    } else {
      titleEl.textContent = `已经涂好 ${colored.size} / ${REGIONS.length} 块啦`;
    }
  }

  // 调色盘
  PALETTE.forEach((color, i) => {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "cf-swatch" + (i === 0 ? " cf-picked" : "");
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

  // 区域点击涂色
  svg.querySelectorAll<SVGElement>(".cf-region").forEach((el) => {
    el.addEventListener("click", () => {
      if (finished) return;
      const id = el.getAttribute("data-id") || "";
      const region = REGIONS.find((r) => r.id === id);
      el.setAttribute("fill", picked.value);
      play("pop");
      colored.add(id);
      msgEl.textContent = `${region ? region.name : "这里"}涂上${picked.name}，真好看！`;
      updateTitle();
      if (colored.size >= REGIONS.length) {
        finished = true;
        play("coin");
        msgEl.textContent = "哇！整幅画都涂好啦！";
        later(() => onWin(3, "小屋被你涂得五彩缤纷，真是小画家！"), 900);
      }
    });
  });

  updateTitle();

  return {
    destroy() {
      timers.forEach(clearTimeout);
      root.innerHTML = "";
    },
  };
}
