/**
 * 萌猫小屋 kitty-care
 * 三天成长计划:每天要把团团喂饱、哄睡、陪玩(逗猫小游戏)。
 * 每过一天解锁一件新装扮,三天全部照顾好,团团就长大啦!
 * 纯本地互动,无联网、无 UGC。
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
  blurb: "三天成长计划！喂饱、哄睡、陪玩，每天还能解锁新装扮！",
};

const CAT_SVG = `
<svg viewBox="0 0 220 210" class="kc-cat-svg" aria-label="圆滚滚的橘猫">
  <path class="kc-tail" d="M180 152 q36 -4 32 -40 q-2 -18 -20 -18"
    stroke="#f2a44a" stroke-width="15" fill="none" stroke-linecap="round"/>
  <path d="M204 122 q4 -10 -4 -20" stroke="#e08a2e" stroke-width="5"
    fill="none" stroke-linecap="round"/>
  <ellipse cx="108" cy="148" rx="64" ry="48" fill="#f7b357"/>
  <path d="M52 132 q12 8 8 22" stroke="#e08a2e" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M166 132 q-12 8 -8 22" stroke="#e08a2e" stroke-width="6" fill="none" stroke-linecap="round"/>
  <ellipse cx="108" cy="160" rx="34" ry="26" fill="#fff3dd"/>
  <ellipse cx="84" cy="192" rx="15" ry="9" fill="#f9c477"/>
  <ellipse cx="132" cy="192" rx="15" ry="9" fill="#f9c477"/>
  <g class="kc-head">
    <path d="M60 54 L72 14 L96 44 Z" fill="#f7b357"/>
    <path d="M68 47 L76 26 L88 41 Z" fill="#ffc9d4"/>
    <path d="M160 54 L148 14 L124 44 Z" fill="#f7b357"/>
    <path d="M152 47 L144 26 L132 41 Z" fill="#ffc9d4"/>
    <circle cx="110" cy="74" r="52" fill="#f7b357"/>
    <path d="M98 26 q2 10 0 15" stroke="#e08a2e" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M110 24 q2 11 0 17" stroke="#e08a2e" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M122 26 q2 10 0 15" stroke="#e08a2e" stroke-width="5" fill="none" stroke-linecap="round"/>
    <g class="kc-eyes-open">
      <circle cx="88" cy="72" r="7.5" fill="#3d2b1f"/>
      <circle cx="90.6" cy="69.4" r="2.6" fill="#fff"/>
      <circle cx="132" cy="72" r="7.5" fill="#3d2b1f"/>
      <circle cx="134.6" cy="69.4" r="2.6" fill="#fff"/>
    </g>
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
    <g stroke="#c98a3f" stroke-width="2.4" stroke-linecap="round" fill="none">
      <path d="M56 82 q-14 -3 -24 -8"/><path d="M57 92 q-14 1 -25 0"/>
      <path d="M164 82 q14 -3 24 -8"/><path d="M163 92 q14 1 25 0"/>
    </g>
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
    <g class="kc-acc kc-acc-scarf" style="display:none">
      <path d="M72 114 q38 22 76 0 l-3 15 q-35 18 -70 0 z" fill="#69db7c"/>
      <rect x="96" y="122" width="14" height="34" rx="6" fill="#51cf66"/>
      <rect x="96" y="150" width="14" height="8" rx="3" fill="#40c057"/>
    </g>
  </g>
</svg>`;

const STYLE = `
.kc-wrap{position:relative;width:100%;height:100%;min-height:520px;overflow:hidden;
  background:linear-gradient(#ffe9c7,#ffd9e8);font-family:"PingFang SC","Microsoft YaHei",sans-serif;
  user-select:none;-webkit-user-select:none;touch-action:manipulation;display:flex;flex-direction:column;}
.kc-wrap.kc-night{background:linear-gradient(#4a5590,#8a7ab0);}
.kc-top{display:flex;align-items:center;gap:10px;padding:12px 16px;}
.kc-title{font-size:19px;font-weight:900;color:#8a5a1e;}
.kc-day{margin-left:auto;font-size:16px;font-weight:800;color:#8a5a1e;
  background:#fff8;border-radius:999px;padding:6px 14px;}
.kc-needs{display:flex;gap:8px;padding:0 14px;}
.kc-need{flex:1;background:#fff8;border-radius:14px;padding:6px 8px;}
.kc-need-label{font-size:13px;font-weight:800;color:#b06a1f;margin-bottom:3px;text-align:center;}
.kc-need-bar{height:14px;border-radius:999px;background:#fff;box-shadow:inset 0 2px 5px #0002;overflow:hidden;}
.kc-need-fill{height:100%;width:0%;border-radius:999px;transition:width .35s ease;}
.kc-fill-food{background:linear-gradient(90deg,#ffc078,#ff922b);}
.kc-fill-sleep{background:linear-gradient(90deg,#b197fc,#845ef7);}
.kc-fill-play{background:linear-gradient(90deg,#8ce99a,#40c057);}
.kc-need.kc-full .kc-need-label{color:#2b8a3e;}
.kc-stage{position:relative;flex:1;display:flex;align-items:center;justify-content:center;}
.kc-cat{position:relative;width:min(66vw,300px);cursor:pointer;transition:transform .4s;}
.kc-cat:active{transform:scale(.97);}
.kc-cat-svg{width:100%;height:auto;display:block;}
.kc-cat.kc-bounce{animation:kcBounce .6s ease;}
.kc-cat.kc-wiggle{animation:kcWiggle .7s ease;}
@keyframes kcBounce{0%{transform:scale(1)}30%{transform:scale(1.08,.92)}60%{transform:scale(.95,1.05)}100%{transform:scale(1)}}
@keyframes kcWiggle{0%,100%{transform:rotate(0)}25%{transform:rotate(-5deg)}75%{transform:rotate(5deg)}}
.kc-bubble{position:absolute;top:-6px;left:50%;transform:translateX(-50%);
  background:#fff;border-radius:16px;padding:8px 16px;font-size:16px;font-weight:800;color:#b06a1f;
  box-shadow:0 4px 10px #0002;opacity:0;transition:opacity .2s;white-space:nowrap;pointer-events:none;z-index:8;}
.kc-bubble.kc-show{opacity:1;}
.kc-heart{position:absolute;font-size:24px;pointer-events:none;animation:kcHeart 1s ease forwards;z-index:6;}
@keyframes kcHeart{0%{opacity:1;transform:translateY(0) scale(.6)}100%{opacity:0;transform:translateY(-70px) scale(1.3)}}
.kc-fish{position:absolute;font-size:34px;pointer-events:none;transition:all .55s cubic-bezier(.4,-0.2,.6,1.2);z-index:5;}
.kc-zzz{position:absolute;font-size:28px;pointer-events:none;animation:kcZzz 1.4s ease forwards;z-index:6;}
@keyframes kcZzz{0%{opacity:0;transform:translate(0,0) scale(.6)}30%{opacity:1}
  100%{opacity:0;transform:translate(26px,-80px) scale(1.2)}}
.kc-yarn{position:absolute;font-size:46px;cursor:pointer;z-index:10;transition:left .25s,top .25s;
  filter:drop-shadow(0 3px 3px #0003);animation:kcYarnIn .3s ease;}
@keyframes kcYarnIn{from{transform:scale(0)}to{transform:scale(1)}}
.kc-minihud{position:absolute;top:8px;left:50%;transform:translateX(-50%);z-index:11;
  background:#fffd;border-radius:999px;padding:8px 18px;font-size:16px;font-weight:900;color:#8a5a1e;
  box-shadow:0 3px 8px #0002;pointer-events:none;}
.kc-btns{display:flex;gap:8px;padding:12px 14px calc(16px + env(safe-area-inset-bottom));}
.kc-btn{flex:1;border:none;border-radius:18px;padding:13px 4px;font-size:15px;font-weight:900;
  color:#fff;cursor:pointer;box-shadow:0 5px 0 #0003;transition:transform .1s,box-shadow .1s;
  font-family:inherit;touch-action:manipulation;}
.kc-btn:active{transform:translateY(4px);box-shadow:0 1px 0 #0003;}
.kc-btn:disabled{opacity:.55;}
.kc-btn-fish{background:#4dabf7;}
.kc-btn-sleep{background:#845ef7;}
.kc-btn-ball{background:#51cf66;}
.kc-btn-dress{background:#ff8787;}
.kc-daydone{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  background:#fff9e6ee;z-index:20;gap:12px;animation:kcFade .4s ease;text-align:center;padding:16px;}
@keyframes kcFade{from{opacity:0}to{opacity:1}}
.kc-daydone-big{font-size:52px;}
.kc-daydone-text{font-size:24px;font-weight:900;color:#e8590c;}
.kc-daydone-sub{font-size:17px;font-weight:800;color:#b06a1f;line-height:1.6;}
.kc-daydone-btn{border:none;border-radius:20px;padding:14px 40px;font-size:20px;font-weight:900;color:#fff;
  background:#ff922b;cursor:pointer;box-shadow:0 5px 0 #c9701c;font-family:inherit;}
.kc-daydone-btn:active{transform:translateY(3px);box-shadow:0 2px 0 #c9701c;}
`;

const PAT_WORDS = ["喵~ 好舒服", "呼噜呼噜~", "再摸摸嘛", "喵呜~ 最喜欢你啦"];
const FEED_WORDS = ["鱼干真好吃!", "啊呜~ 咔嚓咔嚓", "喵!还想吃~"];
const SLEEP_WORDS = ["呼~ 好困呀", "眼皮打架了~", "呼噜…呼噜…"];
const YARN_WORDS = ["接住了!", "扑~ 抓到你咯", "毛线球别跑!"];
const OUTFITS = [
  { cls: "", name: "清爽素颜" },
  { cls: "kc-acc-bow", name: "粉色蝴蝶结" },
  { cls: "kc-acc-hat", name: "小黄帽" },
  { cls: "kc-acc-tie", name: "蓝色领结" },
  { cls: "kc-acc-scarf", name: "绿围巾" },
];

const TOTAL_DAYS = 3;
const NEED_MAX = 100;

export function mount(api: GameApi): { destroy: () => void } {
  const { root, play, onWin } = api;
  let alive = true;
  let ended = false;
  let busy = false;
  let day = 1;
  let food = 0;
  let sleep = 0;
  let fun = 0;
  let dressIndex = 0;
  let unlockedOutfits = 2; // 素颜 + 蝴蝶结
  let yarnTaps = 0;
  let miniActive = false;

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
      <div class="kc-title">🐱 萌猫小屋 · 三天成长计划</div>
      <div class="kc-day">☀️ 第 1 / ${TOTAL_DAYS} 天</div>
    </div>
    <div class="kc-needs">
      <div class="kc-need kc-need-food">
        <div class="kc-need-label">🍖 吃饱</div>
        <div class="kc-need-bar"><div class="kc-need-fill kc-fill-food"></div></div>
      </div>
      <div class="kc-need kc-need-sleep">
        <div class="kc-need-label">😴 睡饱</div>
        <div class="kc-need-bar"><div class="kc-need-fill kc-fill-sleep"></div></div>
      </div>
      <div class="kc-need kc-need-play">
        <div class="kc-need-label">🧶 玩够</div>
        <div class="kc-need-bar"><div class="kc-need-fill kc-fill-play"></div></div>
      </div>
    </div>
    <div class="kc-stage">
      <div class="kc-cat" role="button" aria-label="摸摸小猫">
        <div class="kc-bubble">点我摸摸头~</div>
        ${CAT_SVG}
      </div>
    </div>
    <div class="kc-btns">
      <button class="kc-btn kc-btn-fish">🐟 喂鱼干</button>
      <button class="kc-btn kc-btn-sleep">🌙 哄睡觉</button>
      <button class="kc-btn kc-btn-ball">🧶 逗猫玩</button>
      <button class="kc-btn kc-btn-dress">🎀 换装</button>
    </div>`;
  root.appendChild(wrap);

  const q = <T extends Element>(sel: string): T => wrap.querySelector(sel) as T;
  const cat = q<HTMLElement>(".kc-cat");
  const stage = q<HTMLElement>(".kc-stage");
  const bubble = q<HTMLElement>(".kc-bubble");
  const dayEl = q<HTMLElement>(".kc-day");
  const foodFill = q<HTMLElement>(".kc-fill-food");
  const sleepFill = q<HTMLElement>(".kc-fill-sleep");
  const playFill = q<HTMLElement>(".kc-fill-play");
  const foodBox = q<HTMLElement>(".kc-need-food");
  const sleepBox = q<HTMLElement>(".kc-need-sleep");
  const playBox = q<HTMLElement>(".kc-need-play");
  const eyesOpen = q<SVGGElement>(".kc-eyes-open");
  const eyesHappy = q<SVGGElement>(".kc-eyes-happy");
  const mouth = q<SVGPathElement>(".kc-mouth");
  const mouthOpen = q<SVGEllipseElement>(".kc-mouth-open");
  const btnFish = q<HTMLButtonElement>(".kc-btn-fish");
  const btnSleep = q<HTMLButtonElement>(".kc-btn-sleep");
  const btnBall = q<HTMLButtonElement>(".kc-btn-ball");
  const btnDress = q<HTMLButtonElement>(".kc-btn-dress");

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
    void cat.offsetWidth;
    cat.classList.add(cls);
  }

  function renderNeeds(): void {
    foodFill.style.width = `${food}%`;
    sleepFill.style.width = `${sleep}%`;
    playFill.style.width = `${fun}%`;
    foodBox.classList.toggle("kc-full", food >= NEED_MAX);
    sleepBox.classList.toggle("kc-full", sleep >= NEED_MAX);
    playBox.classList.toggle("kc-full", fun >= NEED_MAX);
    dayEl.textContent = `☀️ 第 ${day} / ${TOTAL_DAYS} 天`;
    // 小猫一天天长大
    cat.style.width = `min(${62 + day * 4}vw, ${280 + day * 14}px)`;
  }

  function lock(ms: number): void {
    busy = true;
    btnFish.disabled = btnSleep.disabled = btnBall.disabled = btnDress.disabled = true;
    after(ms, () => {
      busy = false;
      if (!ended && !miniActive) {
        btnFish.disabled = btnSleep.disabled = btnBall.disabled = btnDress.disabled = false;
      }
    });
  }

  function checkDay(): void {
    if (ended) return;
    if (food >= NEED_MAX && sleep >= NEED_MAX && fun >= NEED_MAX) {
      if (day >= TOTAL_DAYS) {
        ended = true;
        squint(9999);
        hearts(8);
        play("win");
        after(800, () => {
          const done = document.createElement("div");
          done.className = "kc-daydone";
          done.innerHTML = `
            <div class="kc-daydone-big">🐱🎓</div>
            <div class="kc-daydone-text">团团长大啦!</div>
            <div class="kc-daydone-sub">三天都照顾得妥妥帖帖<br>衣柜里还有 ${unlockedOutfits - 1} 件漂亮装扮!</div>`;
          wrap.appendChild(done);
          after(900, () => onWin(3, "三天成长计划完成，你是最棒的小铲屎官!"));
        });
      } else {
        ended = false;
        busy = true;
        btnFish.disabled = btnSleep.disabled = btnBall.disabled = btnDress.disabled = true;
        play("coin");
        const newOutfit = OUTFITS[Math.min(unlockedOutfits, OUTFITS.length - 1)];
        const done = document.createElement("div");
        done.className = "kc-daydone";
        done.innerHTML = `
          <div class="kc-daydone-big">🌙✨</div>
          <div class="kc-daydone-text">第 ${day} 天照顾好啦!</div>
          <div class="kc-daydone-sub">团团睡了个香香的觉<br>🎁 解锁新装扮:「${newOutfit.name}」!</div>
          <button class="kc-daydone-btn">开始第 ${day + 1} 天 ☀️</button>`;
        wrap.appendChild(done);
        (done.querySelector(".kc-daydone-btn") as HTMLButtonElement).addEventListener("click", () => {
          play("jump");
          done.remove();
          unlockedOutfits = Math.min(unlockedOutfits + 1, OUTFITS.length);
          day++;
          food = 0; sleep = 0; fun = 0;
          busy = false;
          btnFish.disabled = btnSleep.disabled = btnBall.disabled = btnDress.disabled = false;
          renderNeeds();
          say(`第 ${day} 天开始，今天也要元气满满!`);
        });
      }
    }
  }

  function addNeed(kind: "food" | "sleep" | "fun", n: number): void {
    if (ended) return;
    if (kind === "food") food = Math.min(NEED_MAX, food + n);
    else if (kind === "sleep") sleep = Math.min(NEED_MAX, sleep + n);
    else fun = Math.min(NEED_MAX, fun + n);
    renderNeeds();
    checkDay();
  }

  // 摸头:三种心情都加一点点
  cat.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (ended || miniActive) return;
    play("meow");
    squint(900);
    animateCat("kc-bounce");
    hearts(2);
    say(PAT_WORDS[Math.floor(Math.random() * PAT_WORDS.length)]);
    food = Math.min(NEED_MAX, food + 3);
    sleep = Math.min(NEED_MAX, sleep + 3);
    fun = Math.min(NEED_MAX, fun + 3);
    renderNeeds();
    checkDay();
  });

  // 喂鱼干
  btnFish.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (ended || busy || miniActive) return;
    if (food >= NEED_MAX) { say("喵~ 已经吃得饱饱的啦"); return; }
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
      addNeed("food", 34);
    });
  });

  // 哄睡觉
  btnSleep.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (ended || busy || miniActive) return;
    if (sleep >= NEED_MAX) { say("喵~ 睡饱啦，精神满满!"); return; }
    lock(1300);
    play("meow");
    wrap.classList.add("kc-night");
    squint(1300);
    for (let i = 0; i < 3; i++) {
      after(200 + i * 320, () => {
        const z = document.createElement("span");
        z.className = "kc-zzz";
        z.textContent = "💤";
        z.style.left = `${52 + i * 5}%`;
        z.style.top = `${26 - i * 3}%`;
        stage.appendChild(z);
        after(1400, () => z.remove());
      });
    }
    say(SLEEP_WORDS[Math.floor(Math.random() * SLEEP_WORDS.length)]);
    after(1200, () => {
      wrap.classList.remove("kc-night");
      addNeed("sleep", 34);
    });
  });

  // 逗猫小游戏:毛线球乱跳,点中 5 次
  btnBall.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (ended || busy || miniActive) return;
    if (fun >= NEED_MAX) { say("喵~ 今天玩够啦，好开心!"); return; }
    miniActive = true;
    yarnTaps = 0;
    btnFish.disabled = btnSleep.disabled = btnBall.disabled = btnDress.disabled = true;
    play("jump");

    const hud = document.createElement("div");
    hud.className = "kc-minihud";
    hud.textContent = "🧶 点中毛线球 0 / 5";
    stage.appendChild(hud);

    const yarn = document.createElement("span");
    yarn.className = "kc-yarn";
    yarn.textContent = "🧶";
    stage.appendChild(yarn);

    const moveYarn = (): void => {
      yarn.style.left = `${10 + Math.random() * 70}%`;
      yarn.style.top = `${18 + Math.random() * 55}%`;
    };
    moveYarn();

    const endMini = (): void => {
      miniActive = false;
      yarn.remove();
      hud.remove();
      if (!ended) {
        btnFish.disabled = btnSleep.disabled = btnBall.disabled = btnDress.disabled = false;
      }
      hearts(3);
      say("玩得好开心，喵!");
      addNeed("fun", 50);
    };

    yarn.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      yarnTaps++;
      play("pop");
      animateCat("kc-wiggle");
      hud.textContent = `🧶 点中毛线球 ${yarnTaps} / 5`;
      say(YARN_WORDS[Math.floor(Math.random() * YARN_WORDS.length)]);
      if (yarnTaps >= 5) {
        play("coin");
        endMini();
      } else {
        moveYarn();
      }
    });
  });

  // 换装(逐天解锁)
  btnDress.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (ended || busy || miniActive) return;
    lock(600);
    play("tap");
    dressIndex = (dressIndex + 1) % unlockedOutfits;
    OUTFITS.forEach((o, i) => {
      if (!o.cls) return;
      const g = wrap.querySelector(`.${o.cls}`) as SVGGElement | null;
      if (g) g.style.display = i === dressIndex ? "" : "none";
    });
    animateCat("kc-wiggle");
    squint(600);
    const locked = OUTFITS.length - unlockedOutfits;
    say(`${OUTFITS[dressIndex].name}!${locked > 0 ? `(还有 ${locked} 件待解锁)` : ""}`);
    fun = Math.min(NEED_MAX, fun + 4);
    renderNeeds();
    checkDay();
  });

  renderNeeds();
  after(600, () => say("你好呀,我是团团!今天请多关照~"));

  return {
    destroy() {
      alive = false;
      ended = true;
      timers.forEach((id) => {
        clearTimeout(id);
        clearInterval(id);
      });
      timers.clear();
      wrap.remove();
    },
  };
}
