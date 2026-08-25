/**
 * 萌猫小屋 kitty-care
 * 一只圆滚滚的原创橘猫:摸头会眯眼喵喵叫、喂鱼干、逗毛线球、换装。
 * 心情条满格就通关。纯本地互动,无联网、无 UGC。
 */

type SoundName = "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump";

interface GameApi {
  root: HTMLElement;
  play: (n: SoundName) => void;
  addStars: (n: number) => number;
  getStars: () => number;
  onWin: (stars: 1 | 2 | 3, message?: string) => void;
  onLose: (message?: string) => void;
}

export const meta = {
  id: "kitty-care",
  title: "萌猫小屋",
  emoji: "🐱",
  category: "casual" as const,
  color: "#f7a23b",
  blurb: "摸摸头、喂鱼干、逗毛线球,把圆滚滚的橘猫哄开心吧!",
};

const CAT_SVG = `
<svg viewBox="0 0 220 210" class="kc-cat-svg" aria-label="圆滚滚的橘猫">
  <!-- 尾巴 -->
  <path class="kc-tail" d="M180 152 q36 -4 32 -40 q-2 -18 -20 -18"
    stroke="#f2a44a" stroke-width="15" fill="none" stroke-linecap="round"/>
  <path d="M204 122 q4 -10 -4 -20" stroke="#e08a2e" stroke-width="5"
    fill="none" stroke-linecap="round"/>
  <!-- 身体 -->
  <ellipse cx="108" cy="148" rx="64" ry="48" fill="#f7b357"/>
  <path d="M52 132 q12 8 8 22" stroke="#e08a2e" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M166 132 q-12 8 -8 22" stroke="#e08a2e" stroke-width="6" fill="none" stroke-linecap="round"/>
  <ellipse cx="108" cy="160" rx="34" ry="26" fill="#fff3dd"/>
  <!-- 小脚爪 -->
  <ellipse cx="84" cy="192" rx="15" ry="9" fill="#f9c477"/>
  <ellipse cx="132" cy="192" rx="15" ry="9" fill="#f9c477"/>
  <!-- 头(整体可点) -->
  <g class="kc-head">
    <path d="M60 54 L72 14 L96 44 Z" fill="#f7b357"/>
    <path d="M68 47 L76 26 L88 41 Z" fill="#ffc9d4"/>
    <path d="M160 54 L148 14 L124 44 Z" fill="#f7b357"/>
    <path d="M152 47 L144 26 L132 41 Z" fill="#ffc9d4"/>
    <circle cx="110" cy="74" r="52" fill="#f7b357"/>
    <path d="M98 26 q2 10 0 15" stroke="#e08a2e" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M110 24 q2 11 0 17" stroke="#e08a2e" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M122 26 q2 10 0 15" stroke="#e08a2e" stroke-width="5" fill="none" stroke-linecap="round"/>
    <!-- 睁开的眼睛 -->
    <g class="kc-eyes-open">
      <circle cx="88" cy="72" r="7.5" fill="#3d2b1f"/>
      <circle cx="90.6" cy="69.4" r="2.6" fill="#fff"/>
      <circle cx="132" cy="72" r="7.5" fill="#3d2b1f"/>
      <circle cx="134.6" cy="69.4" r="2.6" fill="#fff"/>
    </g>
    <!-- 眯眯眼(开心) -->
    <g class="kc-eyes-happy" style="display:none">
      <path d="M79 73 q9 -9 18 0" stroke="#3d2b1f" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      <path d="M123 73 q9 -9 18 0" stroke="#3d2b1f" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    </g>
    <ellipse cx="72" cy="88" rx="9" ry="5.5" fill="#ffb3c0" opacity="0.85"/>
    <ellipse cx="148" cy="88" rx="9" ry="5.5" fill="#ffb3c0" opacity="0.85"/>
    <path d="M105 84 q5 -4 10 0 l-5 6 z" fill="#e6707f"/>
    <path class="kc-mouth" d="M102 93 q4 5 8 0 q4 5 8 0"
      stroke="#3d2b1f" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <ellipse class="kc-mouth-open" cx="110" cy="96" rx="7" ry="8"
      fill="#b3564f" style="display:none"/>
    <!-- 胡须 -->
    <g stroke="#c98a3f" stroke-width="2.4" stroke-linecap="round" fill="none">
      <path d="M56 82 q-14 -3 -24 -8"/><path d="M57 92 q-14 1 -25 0"/>
      <path d="M164 82 q14 -3 24 -8"/><path d="M163 92 q14 1 25 0"/>
    </g>
    <!-- 换装配饰 -->
    <g class="kc-acc kc-acc-bow" style="display:none">
      <path d="M132 18 l-14 9 l14 9 z" fill="#ff6b81"/>
      <path d="M160 18 l14 9 l-14 9 z" fill="#ff6b81"/>
      <circle cx="146" cy="27" r="6" fill="#ff8fa3"/>
    </g>
    <g class="kc-acc kc-acc-hat" style="display:none">
      <path d="M78 34 q32 -34 64 0 q-32 12 -64 0 z" fill="#ffd23f"/>
      <circle cx="110" cy="8" r="8" fill="#ff6b81"/>
      <rect x="74" y="30" width="72" height="10" rx="5" fill="#f4a259"/>
    </g>
    <g class="kc-acc kc-acc-tie" style="display:none">
      <path d="M96 118 l-16 10 l16 10 z" fill="#4dabf7"/>
      <path d="M124 118 l16 10 l-16 10 z" fill="#4dabf7"/>
      <circle cx="110" cy="128" r="7" fill="#74c0fc"/>
    </g>
  </g>
</svg>`;

const STYLE = `
.kc-wrap{position:relative;width:100%;height:100%;min-height:480px;overflow:hidden;
  background:linear-gradient(#ffe9c7,#ffd9e8);font-family:"PingFang SC","Microsoft YaHei",sans-serif;
  user-select:none;-webkit-user-select:none;touch-action:manipulation;display:flex;flex-direction:column;}
.kc-top{display:flex;align-items:center;gap:10px;padding:12px 16px;}
.kc-title{font-size:20px;font-weight:900;color:#8a5a1e;}
.kc-stars{margin-left:auto;font-size:16px;font-weight:800;color:#8a5a1e;
  background:#fff8;border-radius:999px;padding:6px 14px;}
.kc-moodbox{padding:0 16px;}
.kc-moodlabel{font-size:14px;font-weight:800;color:#b06a1f;margin-bottom:4px;}
.kc-moodbar{height:22px;border-radius:999px;background:#fff;box-shadow:inset 0 2px 6px #0002;overflow:hidden;}
.kc-moodfill{height:100%;width:0%;border-radius:999px;
  background:linear-gradient(90deg,#ffb3c0,#ff6b81);transition:width .35s ease;}
.kc-stage{position:relative;flex:1;display:flex;align-items:center;justify-content:center;}
.kc-cat{position:relative;width:min(70vw,320px);cursor:pointer;transition:transform .15s;}
.kc-cat:active{transform:scale(.97);}
.kc-cat-svg{width:100%;height:auto;display:block;}
.kc-cat.kc-bounce{animation:kcBounce .6s ease;}
.kc-cat.kc-wiggle{animation:kcWiggle .7s ease;}
@keyframes kcBounce{0%{transform:scale(1)}30%{transform:scale(1.08,.92)}60%{transform:scale(.95,1.05)}100%{transform:scale(1)}}
@keyframes kcWiggle{0%,100%{transform:rotate(0)}25%{transform:rotate(-5deg)}75%{transform:rotate(5deg)}}
.kc-bubble{position:absolute;top:-6px;left:50%;transform:translateX(-50%);
  background:#fff;border-radius:16px;padding:8px 16px;font-size:16px;font-weight:800;color:#b06a1f;
  box-shadow:0 4px 10px #0002;opacity:0;transition:opacity .2s;white-space:nowrap;pointer-events:none;}
.kc-bubble.kc-show{opacity:1;}
.kc-heart{position:absolute;font-size:24px;pointer-events:none;animation:kcHeart 1s ease forwards;}
@keyframes kcHeart{0%{opacity:1;transform:translateY(0) scale(.6)}100%{opacity:0;transform:translateY(-70px) scale(1.3)}}
.kc-fish{position:absolute;font-size:34px;pointer-events:none;transition:all .55s cubic-bezier(.4,-0.2,.6,1.2);z-index:5;}
.kc-ball{position:absolute;font-size:38px;pointer-events:none;z-index:5;animation:kcBall 1.1s ease forwards;}
@keyframes kcBall{0%{transform:translate(0,0) rotate(0)}40%{transform:translate(-60px,-90px) rotate(-180deg)}
  70%{transform:translate(-120px,-20px) rotate(-320deg)}100%{transform:translate(-190px,-60px) rotate(-540deg);opacity:0}}
.kc-btns{display:flex;gap:10px;padding:14px 16px calc(18px + env(safe-area-inset-bottom));}
.kc-btn{flex:1;border:none;border-radius:20px;padding:14px 6px;font-size:17px;font-weight:900;
  color:#fff;cursor:pointer;box-shadow:0 5px 0 #0003;transition:transform .1s,box-shadow .1s;
  font-family:inherit;touch-action:manipulation;}
.kc-btn:active{transform:translateY(4px);box-shadow:0 1px 0 #0003;}
.kc-btn:disabled{opacity:.55;}
.kc-btn-fish{background:#4dabf7;}
.kc-btn-ball{background:#9775fa;}
.kc-btn-dress{background:#ff8787;}
.kc-win{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  background:#fff9e6ee;z-index:20;gap:12px;animation:kcFade .4s ease;}
@keyframes kcFade{from{opacity:0}to{opacity:1}}
.kc-win-big{font-size:52px;}
.kc-win-text{font-size:26px;font-weight:900;color:#e8590c;}
`;

const PAT_WORDS = ["喵~ 好舒服", "呼噜呼噜~", "再摸摸嘛", "喵呜~ 最喜欢你啦"];
const FEED_WORDS = ["鱼干真好吃!", "啊呜~ 咔嚓咔嚓", "喵!还想吃~"];
const BALL_WORDS = ["毛线球最好玩啦!", "喵!接住了~", "扑~ 抓到你咯"];
const DRESS_NAMES = ["摘掉啦,清爽~", "粉色蝴蝶结,好看!", "小黄帽,神气!", "蓝色领结,帅气!"];

export function mount(api: GameApi): { destroy: () => void } {
  const { root, play, getStars, onWin } = api;
  let alive = true;
  let ended = false;
  let mood = 0;
  let busy = false;
  let dressIndex = 0;

  const timers = new Set<number>();
  const after = (ms: number, fn: () => void): number => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      if (alive) fn();
    }, ms);
    timers.add(id);
    return id;
  };

  const wrap = document.createElement("div");
  wrap.className = "kc-wrap";
  wrap.innerHTML = `
    <style>${STYLE}</style>
    <div class="kc-top">
      <div class="kc-title">🐱 萌猫小屋</div>
      <div class="kc-stars">⭐ ${getStars()}</div>
    </div>
    <div class="kc-moodbox">
      <div class="kc-moodlabel">💗 小猫心情</div>
      <div class="kc-moodbar"><div class="kc-moodfill"></div></div>
    </div>
    <div class="kc-stage">
      <div class="kc-cat" role="button" aria-label="摸摸小猫">
        <div class="kc-bubble">点我摸摸头~</div>
        ${CAT_SVG}
      </div>
    </div>
    <div class="kc-btns">
      <button class="kc-btn kc-btn-fish">🐟 喂鱼干</button>
      <button class="kc-btn kc-btn-ball">🧶 逗毛线球</button>
      <button class="kc-btn kc-btn-dress">🎀 换装</button>
    </div>`;
  root.appendChild(wrap);

  const q = <T extends Element>(sel: string): T => wrap.querySelector(sel) as T;
  const cat = q<HTMLElement>(".kc-cat");
  const stage = q<HTMLElement>(".kc-stage");
  const bubble = q<HTMLElement>(".kc-bubble");
  const moodFill = q<HTMLElement>(".kc-moodfill");
  const eyesOpen = q<SVGGElement>(".kc-eyes-open");
  const eyesHappy = q<SVGGElement>(".kc-eyes-happy");
  const mouth = q<SVGPathElement>(".kc-mouth");
  const mouthOpen = q<SVGEllipseElement>(".kc-mouth-open");
  const btnFish = q<HTMLButtonElement>(".kc-btn-fish");
  const btnBall = q<HTMLButtonElement>(".kc-btn-ball");
  const btnDress = q<HTMLButtonElement>(".kc-btn-dress");
  const accs = [
    null,
    q<SVGGElement>(".kc-acc-bow"),
    q<SVGGElement>(".kc-acc-hat"),
    q<SVGGElement>(".kc-acc-tie"),
  ];

  function say(text: string): void {
    bubble.textContent = text;
    bubble.classList.add("kc-show");
    after(1300, () => bubble.classList.remove("kc-show"));
  }

  function squint(ms: number): void {
    eyesOpen.style.display = "none";
    eyesHappy.style.display = "";
    after(ms, () => {
      eyesOpen.style.display = "";
      eyesHappy.style.display = "none";
    });
  }

  function hearts(count: number): void {
    for (let i = 0; i < count; i++) {
      const h = document.createElement("span");
      h.className = "kc-heart";
      h.textContent = ["💗", "💛", "✨"][i % 3];
      h.style.left = `${38 + Math.random() * 24}%`;
      h.style.top = `${20 + Math.random() * 25}%`;
      stage.appendChild(h);
      after(1000, () => h.remove());
    }
  }

  function animateCat(cls: "kc-bounce" | "kc-wiggle"): void {
    cat.classList.remove("kc-bounce", "kc-wiggle");
    // 强制重排以便动画可重复触发
    void cat.offsetWidth;
    cat.classList.add(cls);
  }

  function addMood(n: number): void {
    if (ended) return;
    mood = Math.min(100, mood + n);
    moodFill.style.width = `${mood}%`;
    if (mood >= 100) {
      ended = true;
      squint(9999);
      hearts(6);
      after(700, () => {
        const win = document.createElement("div");
        win.className = "kc-win";
        win.innerHTML = `
          <div class="kc-win-big">🐱💗</div>
          <div class="kc-win-text">小猫咪超级开心!</div>`;
        wrap.appendChild(win);
        onWin(3, "你把小猫照顾得真好!");
      });
    }
  }

  function lock(ms: number): void {
    busy = true;
    btnFish.disabled = btnBall.disabled = btnDress.disabled = true;
    after(ms, () => {
      busy = false;
      if (!ended) {
        btnFish.disabled = btnBall.disabled = btnDress.disabled = false;
      }
    });
  }

  // 摸头
  cat.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (ended) return;
    play("meow");
    squint(900);
    animateCat("kc-bounce");
    hearts(2);
    say(PAT_WORDS[Math.floor(Math.random() * PAT_WORDS.length)]);
    addMood(8);
  });

  // 喂鱼干
  btnFish.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (ended || busy) return;
    lock(800);
    play("coin");
    const fish = document.createElement("span");
    fish.className = "kc-fish";
    fish.textContent = "🐟";
    fish.style.left = "12%";
    fish.style.bottom = "6%";
    stage.appendChild(fish);
    after(30, () => {
      fish.style.left = "48%";
      fish.style.bottom = "48%";
      fish.style.transform = "scale(.4) rotate(140deg)";
      fish.style.opacity = "0";
    });
    mouth.style.display = "none";
    mouthOpen.style.display = "";
    after(650, () => {
      fish.remove();
      mouth.style.display = "";
      mouthOpen.style.display = "none";
      animateCat("kc-bounce");
      squint(700);
      say(FEED_WORDS[Math.floor(Math.random() * FEED_WORDS.length)]);
      addMood(14);
    });
  });

  // 逗毛线球
  btnBall.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (ended || busy) return;
    lock(1100);
    play("jump");
    const ball = document.createElement("span");
    ball.className = "kc-ball";
    ball.textContent = "🧶";
    ball.style.right = "10%";
    ball.style.bottom = "10%";
    stage.appendChild(ball);
    animateCat("kc-wiggle");
    after(1050, () => {
      ball.remove();
      hearts(2);
      say(BALL_WORDS[Math.floor(Math.random() * BALL_WORDS.length)]);
      addMood(12);
    });
  });

  // 换装
  btnDress.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (ended || busy) return;
    lock(600);
    play("tap");
    dressIndex = (dressIndex + 1) % accs.length;
    accs.forEach((g, i) => {
      if (g) g.style.display = i === dressIndex ? "" : "none";
    });
    animateCat("kc-wiggle");
    squint(600);
    say(DRESS_NAMES[dressIndex]);
    addMood(6);
  });

  after(600, () => say("你好呀,我是团团!"));

  return {
    destroy() {
      alive = false;
      timers.forEach((id) => {
        clearTimeout(id);
        clearInterval(id);
      });
      timers.clear();
      wrap.remove();
    },
  };
}
