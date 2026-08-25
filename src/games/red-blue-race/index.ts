/**
 * 红蓝赛跑 red-blue-race
 * 上下两条跑道:红方小仓鼠 vs 蓝方小企鹅。
 * 点自己那边的大按钮就往前冲一步,先碰到 🏁 的赢。
 * 单人模式里蓝方是节奏 AI。
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
  id: "red-blue-race",
  title: "红蓝赛跑",
  emoji: "🏁",
  category: "party" as const,
  color: "#51cf66",
  blurb: "点点点往前冲!红方蓝方谁先跑到终点小红旗?",
};

const GOAL = 100;
const STEP = 2.4;

const STYLE = `
.race-wrap{position:relative;width:100%;height:100%;min-height:480px;overflow:hidden;
  background:linear-gradient(#d3f9d8,#fff9db);font-family:"PingFang SC","Microsoft YaHei",sans-serif;
  user-select:none;-webkit-user-select:none;touch-action:manipulation;display:flex;flex-direction:column;}
.race-menu{position:absolute;inset:0;z-index:30;display:flex;flex-direction:column;gap:18px;
  align-items:center;justify-content:center;background:linear-gradient(#d3f9d8,#fff9db);}
.race-menu-title{font-size:30px;font-weight:900;color:#2b6a2f;}
.race-menu-sub{font-size:16px;font-weight:700;color:#5a8a5e;}
.race-mode{border:none;border-radius:24px;padding:18px 40px;font-size:22px;font-weight:900;color:#fff;
  cursor:pointer;box-shadow:0 6px 0 #0003;font-family:inherit;touch-action:manipulation;min-width:240px;}
.race-mode:active{transform:translateY(4px);box-shadow:0 2px 0 #0003;}
.race-mode-solo{background:#ff6b6b;}
.race-mode-duo{background:#845ef7;}
.race-track-area{flex:1;display:flex;flex-direction:column;justify-content:center;gap:16px;
  padding:16px 12px;position:relative;}
.race-track{position:relative;height:74px;border-radius:18px;background:#fff9;
  box-shadow:inset 0 2px 8px #0002;overflow:visible;}
.race-track::before{content:"";position:absolute;left:4%;right:10%;top:50%;height:4px;
  background:repeating-linear-gradient(90deg,#bbb 0 16px,transparent 16px 32px);}
.race-flag{position:absolute;right:2%;top:50%;transform:translateY(-58%);font-size:40px;}
.race-runner{position:absolute;left:2%;top:50%;transform:translate(0,-50%);font-size:46px;
  transition:left .1s linear;filter:drop-shadow(0 3px 2px #0003);will-change:left;}
.race-runner.race-hop{animation:raceHop .18s ease;}
@keyframes raceHop{0%,100%{margin-top:0}50%{margin-top:-14px}}
.race-runner .race-badge{position:absolute;top:-14px;left:50%;transform:translateX(-50%);
  font-size:14px;font-weight:900;border-radius:999px;padding:1px 8px;color:#fff;}
.race-badge-red{background:#fa5252;}
.race-badge-blue{background:#339af0;}
.race-count{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;
  font-size:110px;font-weight:900;color:#ff922b;text-shadow:0 5px 0 #fff;pointer-events:none;}
.race-btns{display:flex;height:40%;min-height:160px;}
.race-btn{flex:1;border:none;font-size:24px;font-weight:900;color:#fff;cursor:pointer;
  font-family:inherit;touch-action:manipulation;display:flex;flex-direction:column;gap:6px;
  align-items:center;justify-content:center;transition:filter .05s;}
.race-btn:active{filter:brightness(1.2);}
.race-btn:disabled{opacity:.85;}
.race-btn small{font-size:14px;font-weight:700;opacity:.9;}
.race-btn .race-big{font-size:42px;}
.race-btn-red{background:linear-gradient(#ff8787,#fa5252);border-radius:0 28px 0 0;}
.race-btn-blue{background:linear-gradient(#74c0fc,#339af0);border-radius:28px 0 0 0;}
.race-result{position:absolute;inset:0;z-index:40;display:flex;flex-direction:column;gap:12px;
  align-items:center;justify-content:center;background:#ffffffd9;animation:raceFade .3s ease;}
@keyframes raceFade{from{opacity:0}to{opacity:1}}
.race-result-big{font-size:60px;}
.race-result-text{font-size:28px;font-weight:900;color:#2b6a2f;}
`;

export function mount(api: GameApi): { destroy: () => void } {
  const { root, play, onWin, onLose } = api;
  let alive = true;
  let ended = false;
  let running = false;
  let solo = true;
  let redPos = 0;
  let bluePos = 0;
  let redCheered = false;
  let blueCheered = false;

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
  wrap.className = "race-wrap";
  wrap.innerHTML = `
    <style>${STYLE}</style>
    <div class="race-track-area">
      <div class="race-track">
        <span class="race-flag">🏁</span>
        <span class="race-runner race-runner-red">🐹<span class="race-badge race-badge-red">红</span></span>
      </div>
      <div class="race-track">
        <span class="race-flag">🏁</span>
        <span class="race-runner race-runner-blue">🐧<span class="race-badge race-badge-blue">蓝</span></span>
      </div>
      <div class="race-count" style="display:none"></div>
    </div>
    <div class="race-btns">
      <button class="race-btn race-btn-red" disabled>
        <span class="race-big">🐹</span>红方 冲呀!<small>点点点加速</small>
      </button>
      <button class="race-btn race-btn-blue" disabled>
        <span class="race-big">🐧</span>蓝方 冲呀!<small>点点点加速</small>
      </button>
    </div>
    <div class="race-menu">
      <div class="race-menu-title">🏁 红蓝赛跑</div>
      <div class="race-menu-sub">拼命点按钮,先到小红旗的赢!</div>
      <button class="race-mode race-mode-solo">🐹 单人挑战(我是红方)</button>
      <button class="race-mode race-mode-duo">🐹🆚🐧 双人对战</button>
    </div>`;
  root.appendChild(wrap);

  const q = <T extends Element>(sel: string): T => wrap.querySelector(sel) as T;
  const menu = q<HTMLElement>(".race-menu");
  const countEl = q<HTMLElement>(".race-count");
  const redRunner = q<HTMLElement>(".race-runner-red");
  const blueRunner = q<HTMLElement>(".race-runner-blue");
  const btnRed = q<HTMLButtonElement>(".race-btn-red");
  const btnBlue = q<HTMLButtonElement>(".race-btn-blue");
  const blueLabel = q<HTMLElement>(".race-btn-blue small");

  function render(): void {
    // 跑道从 2% 跑到 84%
    redRunner.style.left = `${2 + (redPos / GOAL) * 82}%`;
    blueRunner.style.left = `${2 + (bluePos / GOAL) * 82}%`;
  }

  function hop(runner: HTMLElement): void {
    runner.classList.remove("race-hop");
    void runner.offsetWidth;
    runner.classList.add("race-hop");
  }

  function advance(side: "red" | "blue", step: number): void {
    if (!running || ended) return;
    if (side === "red") {
      redPos = Math.min(GOAL, redPos + step);
      hop(redRunner);
      if (!redCheered && redPos >= GOAL / 2) {
        redCheered = true;
        play("jump");
      }
    } else {
      bluePos = Math.min(GOAL, bluePos + step);
      hop(blueRunner);
      if (!blueCheered && bluePos >= GOAL / 2) {
        blueCheered = true;
        play("jump");
      }
    }
    render();
    if (redPos >= GOAL) finish("red");
    else if (bluePos >= GOAL) finish("blue");
  }

  function finish(winner: "red" | "blue"): void {
    ended = true;
    running = false;
    btnRed.disabled = btnBlue.disabled = true;
    const result = document.createElement("div");
    result.className = "race-result";
    const emoji = winner === "red" ? "🐹🏆" : "🐧🏆";
    const name = winner === "red" ? "红方" : "蓝方";
    result.innerHTML = `
      <div class="race-result-big">${emoji}</div>
      <div class="race-result-text">${name}冲线啦!</div>`;
    wrap.appendChild(result);
    after(900, () => {
      if (solo) {
        if (winner === "red") onWin(3, "红方第一名,跑得真快!");
        else onLose("蓝方先到了一步,再比一次!");
      } else {
        onWin(2, `${name}赢了这场比赛!`);
      }
    });
  }

  let aiTimer = 0;
  function scheduleAi(): void {
    if (!alive || ended) return;
    aiTimer = after(250 + Math.random() * 200, () => {
      advance("blue", STEP * (0.85 + Math.random() * 0.3));
      scheduleAi();
    });
  }

  function startRound(): void {
    redPos = bluePos = 0;
    redCheered = blueCheered = false;
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
        countEl.textContent = "冲!";
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

  q<HTMLButtonElement>(".race-mode-solo").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    solo = true;
    blueLabel.textContent = "蓝方是小电脑";
    menu.style.display = "none";
    startRound();
  });
  q<HTMLButtonElement>(".race-mode-duo").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    solo = false;
    menu.style.display = "none";
    startRound();
  });

  btnRed.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (btnRed.disabled) return;
    play("tap");
    advance("red", STEP);
  });
  btnBlue.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (btnBlue.disabled) return;
    play("tap");
    advance("blue", STEP);
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
