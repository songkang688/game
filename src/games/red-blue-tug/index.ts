/**
 * 红蓝拔河 red-blue-tug
 * 左右两个超大按钮拼手速:双人各按一边,或单人挑战蓝方 AI。
 * 把中间的蝴蝶结拉过自己一侧的线就赢啦。
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
  id: "red-blue-tug",
  title: "红蓝拔河",
  emoji: "🪢",
  category: "party" as const,
  color: "#ff6b6b",
  blurb: "红队蓝队拼手速!把绳子上的蝴蝶结拉到自己这边就赢!",
};

const STYLE = `
.tug-wrap{position:relative;width:100%;height:100%;min-height:480px;overflow:hidden;
  background:linear-gradient(#d0f4ff,#fff6d6);font-family:"PingFang SC","Microsoft YaHei",sans-serif;
  user-select:none;-webkit-user-select:none;touch-action:manipulation;display:flex;flex-direction:column;}
.tug-menu{position:absolute;inset:0;z-index:30;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:18px;background:linear-gradient(#d0f4ff,#fff6d6);}
.tug-menu-title{font-size:30px;font-weight:900;color:#5c4a1e;}
.tug-menu-sub{font-size:16px;font-weight:700;color:#8a7a4a;}
.tug-mode{border:none;border-radius:24px;padding:18px 40px;font-size:22px;font-weight:900;color:#fff;
  cursor:pointer;box-shadow:0 6px 0 #0003;font-family:inherit;touch-action:manipulation;min-width:240px;}
.tug-mode:active{transform:translateY(4px);box-shadow:0 2px 0 #0003;}
.tug-mode-solo{background:#ff6b6b;}
.tug-mode-duo{background:#845ef7;}
.tug-scene{position:relative;flex:1;min-height:200px;}
.tug-line{position:absolute;top:12%;bottom:34%;width:6px;border-radius:3px;opacity:.75;}
.tug-line-red{left:22%;background:#ff6b6b;}
.tug-line-blue{right:22%;background:#4dabf7;}
.tug-rope-row{position:absolute;left:0;right:0;top:46%;height:70px;
  transition:transform .12s ease-out;will-change:transform;}
.tug-rope{position:absolute;left:-30%;right:-30%;top:30px;height:12px;border-radius:6px;
  background:repeating-linear-gradient(90deg,#c98a3f 0 18px,#a76a28 18px 36px);}
.tug-knot{position:absolute;left:50%;top:-4px;transform:translateX(-50%);font-size:44px;
  filter:drop-shadow(0 3px 3px #0003);}
.tug-team{position:absolute;top:-6px;font-size:44px;letter-spacing:-14px;}
.tug-team-red{right:56%;}
.tug-team-blue{left:56%;transform:scaleX(-1);}
.tug-shake .tug-rope-row{animation:tugShake .18s;}
@keyframes tugShake{0%,100%{margin-top:0}50%{margin-top:-5px}}
.tug-count{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;
  font-size:110px;font-weight:900;color:#ff922b;text-shadow:0 5px 0 #fff;pointer-events:none;}
.tug-btns{display:flex;height:42%;min-height:170px;}
.tug-btn{flex:1;border:none;font-size:26px;font-weight:900;color:#fff;cursor:pointer;
  font-family:inherit;touch-action:manipulation;display:flex;flex-direction:column;gap:6px;
  align-items:center;justify-content:center;transition:filter .05s;}
.tug-btn:active{filter:brightness(1.2);}
.tug-btn:disabled{opacity:.85;}
.tug-btn small{font-size:15px;font-weight:700;opacity:.9;}
.tug-btn-red{background:linear-gradient(#ff8787,#fa5252);border-radius:0 28px 0 0;}
.tug-btn-blue{background:linear-gradient(#74c0fc,#339af0);border-radius:28px 0 0 0;}
.tug-btn .tug-big{font-size:44px;}
.tug-result{position:absolute;inset:0;z-index:40;display:flex;flex-direction:column;gap:12px;
  align-items:center;justify-content:center;background:#ffffffd9;animation:tugFade .3s ease;}
@keyframes tugFade{from{opacity:0}to{opacity:1}}
.tug-result-big{font-size:60px;}
.tug-result-text{font-size:28px;font-weight:900;color:#5c4a1e;}
`;

export function mount(api: GameApi): { destroy: () => void } {
  const { root, play, onWin, onLose } = api;
  let alive = true;
  let ended = false;
  let running = false;
  let solo = true;
  // pos ∈ [-1, 1],负数偏向红方(左),正数偏向蓝方(右)
  let pos = 0;

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
  wrap.className = "tug-wrap";
  wrap.innerHTML = `
    <style>${STYLE}</style>
    <div class="tug-scene">
      <div class="tug-line tug-line-red"></div>
      <div class="tug-line tug-line-blue"></div>
      <div class="tug-rope-row">
        <div class="tug-rope"></div>
        <div class="tug-team tug-team-red">🐹🐹🐹</div>
        <div class="tug-team tug-team-blue">🐧🐧🐧</div>
        <div class="tug-knot">🎀</div>
      </div>
      <div class="tug-count" style="display:none"></div>
    </div>
    <div class="tug-btns">
      <button class="tug-btn tug-btn-red" disabled>
        <span class="tug-big">🐹</span>红队 加油!<small>拼命点这里</small>
      </button>
      <button class="tug-btn tug-btn-blue" disabled>
        <span class="tug-big">🐧</span>蓝队 加油!<small>拼命点这里</small>
      </button>
    </div>
    <div class="tug-menu">
      <div class="tug-menu-title">🪢 红蓝拔河</div>
      <div class="tug-menu-sub">把 🎀 拉过自己那条线就赢!</div>
      <button class="tug-mode tug-mode-solo">🐹 单人挑战(我是红队)</button>
      <button class="tug-mode tug-mode-duo">🐹🆚🐧 双人对战</button>
    </div>`;
  root.appendChild(wrap);

  const q = <T extends Element>(sel: string): T => wrap.querySelector(sel) as T;
  const scene = q<HTMLElement>(".tug-scene");
  const ropeRow = q<HTMLElement>(".tug-rope-row");
  const countEl = q<HTMLElement>(".tug-count");
  const menu = q<HTMLElement>(".tug-menu");
  const btnRed = q<HTMLButtonElement>(".tug-btn-red");
  const btnBlue = q<HTMLButtonElement>(".tug-btn-blue");
  const blueLabel = q<HTMLElement>(".tug-btn-blue small");

  function render(): void {
    // 绳子整体平移,±1 对应 ±28% 屏宽
    ropeRow.style.transform = `translateX(${pos * 28}%)`;
  }

  function shake(): void {
    scene.classList.remove("tug-shake");
    void scene.offsetWidth;
    scene.classList.add("tug-shake");
  }

  function pull(side: "red" | "blue", strength: number): void {
    if (!running || ended) return;
    pos += side === "red" ? -strength : strength;
    pos = Math.max(-1, Math.min(1, pos));
    render();
    shake();
    if (pos <= -1) finish("red");
    else if (pos >= 1) finish("blue");
  }

  function finish(winner: "red" | "blue"): void {
    ended = true;
    running = false;
    btnRed.disabled = btnBlue.disabled = true;
    const result = document.createElement("div");
    result.className = "tug-result";
    const emoji = winner === "red" ? "🐹🏆" : "🐧🏆";
    const name = winner === "red" ? "红队" : "蓝队";
    result.innerHTML = `
      <div class="tug-result-big">${emoji}</div>
      <div class="tug-result-text">${name}获胜!</div>`;
    wrap.appendChild(result);
    after(900, () => {
      if (solo) {
        if (winner === "red") onWin(3, "太厉害了,红队大胜!");
        else onLose("蓝队赢了这局,再挑战一次!");
      } else {
        onWin(2, `${name}获胜,击掌庆祝!`);
      }
    });
  }

  let aiTimer = 0;
  function scheduleAi(): void {
    if (!alive || ended) return;
    aiTimer = after(240 + Math.random() * 260, () => {
      pull("blue", 0.04 + Math.random() * 0.02);
      scheduleAi();
    });
  }

  function startRound(): void {
    pos = 0;
    render();
    countEl.style.display = "";
    let n = 3;
    const tick = (): void => {
      if (n > 0) {
        countEl.textContent = String(n);
        play("pop");
        n--;
        after(700, tick);
      } else {
        countEl.textContent = "开始!";
        play("jump");
        after(500, () => {
          countEl.style.display = "none";
          running = true;
          btnRed.disabled = false;
          btnBlue.disabled = solo;
          if (solo) scheduleAi();
        });
      }
    };
    tick();
  }

  q<HTMLButtonElement>(".tug-mode-solo").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    solo = true;
    blueLabel.textContent = "蓝队是小电脑";
    menu.style.display = "none";
    startRound();
  });
  q<HTMLButtonElement>(".tug-mode-duo").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    solo = false;
    menu.style.display = "none";
    startRound();
  });

  btnRed.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (btnRed.disabled) return;
    play("tap");
    pull("red", 0.055);
  });
  btnBlue.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (btnBlue.disabled) return;
    play("tap");
    pull("blue", 0.055);
  });

  render();

  return {
    destroy() {
      alive = false;
      clearTimeout(aiTimer);
      timers.forEach((id) => {
        clearTimeout(id);
        clearInterval(id);
      });
      timers.clear();
      wrap.remove();
    },
  };
}
