/**
 * 红蓝赛跑 red-blue-race —— 红蓝运动会第三项
 * 三局两胜(BO3)!点自己那边的大按钮往前冲,先碰到 🏁 的赢一局。
 * 跑道上有小水坑,踩到会哧溜滑回去一截!
 * 单人模式蓝方是节奏 AI,有简单/普通两档。
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
  blurb: "红蓝运动会·赛跑!三局两胜,小心跑道上的水坑!",
};

const GOAL = 100;
const STEP = 2.4;

const STYLE = `
.race-wrap{position:relative;width:100%;height:100%;min-height:480px;overflow:hidden;
  background:linear-gradient(#d3f9d8,#fff9db);font-family:"PingFang SC","Microsoft YaHei",sans-serif;
  user-select:none;-webkit-user-select:none;touch-action:manipulation;display:flex;flex-direction:column;}
.race-menu{position:absolute;inset:0;z-index:30;display:flex;flex-direction:column;gap:14px;
  align-items:center;justify-content:center;background:linear-gradient(#d3f9d8,#fff9db);padding:16px;}
.race-menu-title{font-size:28px;font-weight:900;color:#2b6a2f;}
.race-menu-sub{font-size:15px;font-weight:700;color:#5a8a5e;text-align:center;line-height:1.6;}
.race-mode{border:none;border-radius:24px;padding:15px 36px;font-size:20px;font-weight:900;color:#fff;
  cursor:pointer;box-shadow:0 6px 0 #0003;font-family:inherit;touch-action:manipulation;min-width:250px;}
.race-mode:active{transform:translateY(4px);box-shadow:0 2px 0 #0003;}
.race-mode-easy{background:#51cf66;}
.race-mode-normal{background:#ff6b6b;}
.race-mode-duo{background:#845ef7;}
.race-hud{display:flex;align-items:center;justify-content:center;gap:10px;padding:10px 14px 0;}
.race-pill{background:#fffd;border-radius:999px;padding:7px 14px;font-size:16px;font-weight:900;
  color:#2b6a2f;box-shadow:0 3px 8px #0002;}
.race-track-area{flex:1;display:flex;flex-direction:column;justify-content:center;gap:16px;
  padding:16px 12px;position:relative;}
.race-track{position:relative;height:74px;border-radius:18px;background:#fff9;
  box-shadow:inset 0 2px 8px #0002;overflow:visible;}
.race-track::before{content:"";position:absolute;left:4%;right:10%;top:50%;height:4px;
  background:repeating-linear-gradient(90deg,#bbb 0 16px,transparent 16px 32px);}
.race-flag{position:absolute;right:2%;top:50%;transform:translateY(-58%);font-size:40px;}
.race-puddle{position:absolute;top:56%;font-size:26px;transform:translate(-50%,-50%);}
.race-runner{position:absolute;left:2%;top:50%;transform:translate(0,-50%);font-size:46px;
  transition:left .1s linear;filter:drop-shadow(0 3px 2px #0003);will-change:left;z-index:2;}
.race-runner.race-hop{animation:raceHop .18s ease;}
@keyframes raceHop{0%,100%{margin-top:0}50%{margin-top:-14px}}
.race-runner.race-slip{animation:raceSlip .5s ease;}
@keyframes raceSlip{0%{transform:translate(0,-50%) rotate(0)}30%{transform:translate(0,-50%) rotate(-30deg)}
  70%{transform:translate(0,-50%) rotate(20deg)}100%{transform:translate(0,-50%) rotate(0)}}
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
  align-items:center;justify-content:center;background:#ffffffd9;animation:raceFade .3s ease;text-align:center;}
@keyframes raceFade{from{opacity:0}to{opacity:1}}
.race-result-big{font-size:60px;}
.race-result-text{font-size:26px;font-weight:900;color:#2b6a2f;}
.race-result-sub{font-size:17px;font-weight:800;color:#5a8a5e;}
`;

type Side = "red" | "blue";
type Difficulty = "easy" | "normal";

interface Puddle {
  pos: number;
  el: HTMLElement;
  used: boolean;
}

export function mount(api: GameApi): { destroy: () => void } {
  const { root, play, onWin, onLose } = api;
  let alive = true;
  let matchOver = false;
  let running = false;
  let solo = true;
  let difficulty: Difficulty = "easy";
  let redPos = 0;
  let bluePos = 0;
  let redWins = 0;
  let blueWins = 0;
  let round = 1;
  let redPuddles: Puddle[] = [];
  let bluePuddles: Puddle[] = [];

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
    <div class="race-hud" style="display:none">
      <div class="race-pill race-round">第 1 局</div>
      <div class="race-pill race-score">🐹 0 : 0 🐧</div>
    </div>
    <div class="race-track-area">
      <div class="race-track race-track-red">
        <span class="race-flag">🏁</span>
        <span class="race-runner race-runner-red">🐹<span class="race-badge race-badge-red">红</span></span>
      </div>
      <div class="race-track race-track-blue">
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
      <div class="race-menu-sub">红蓝运动会第三项 · 三局两胜!<br>拼命点按钮往前冲,💧 水坑踩到会滑回去哦</div>
      <button class="race-mode race-mode-easy">🐹 单人 · 小电脑简单</button>
      <button class="race-mode race-mode-normal">🐹 单人 · 小电脑普通</button>
      <button class="race-mode race-mode-duo">🐹🆚🐧 双人对战</button>
    </div>`;
  root.appendChild(wrap);

  const q = <T extends Element>(sel: string): T => wrap.querySelector(sel) as T;
  const menu = q<HTMLElement>(".race-menu");
  const hud = q<HTMLElement>(".race-hud");
  const roundEl = q<HTMLElement>(".race-round");
  const scoreEl = q<HTMLElement>(".race-score");
  const countEl = q<HTMLElement>(".race-count");
  const redTrack = q<HTMLElement>(".race-track-red");
  const blueTrack = q<HTMLElement>(".race-track-blue");
  const redRunner = q<HTMLElement>(".race-runner-red");
  const blueRunner = q<HTMLElement>(".race-runner-blue");
  const btnRed = q<HTMLButtonElement>(".race-btn-red");
  const btnBlue = q<HTMLButtonElement>(".race-btn-blue");
  const blueLabel = q<HTMLElement>(".race-btn-blue small");

  function render(): void {
    redRunner.style.left = `${2 + (redPos / GOAL) * 82}%`;
    blueRunner.style.left = `${2 + (bluePos / GOAL) * 82}%`;
  }

  function renderHud(): void {
    roundEl.textContent = `第 ${round} 局`;
    scoreEl.textContent = `🐹 ${redWins} : ${blueWins} 🐧`;
  }

  function hop(runner: HTMLElement): void {
    runner.classList.remove("race-hop");
    void runner.offsetWidth;
    runner.classList.add("race-hop");
  }

  function slip(runner: HTMLElement): void {
    runner.classList.remove("race-slip");
    void runner.offsetWidth;
    runner.classList.add("race-slip");
  }

  function makePuddles(track: HTMLElement): Puddle[] {
    track.querySelectorAll(".race-puddle").forEach((p) => p.remove());
    const out: Puddle[] = [];
    const count = 2;
    for (let i = 0; i < count; i++) {
      const pos = 25 + i * 30 + Math.random() * 18;
      const el = document.createElement("span");
      el.className = "race-puddle";
      el.textContent = "💧";
      el.style.left = `${2 + (pos / GOAL) * 82 + 3}%`;
      track.appendChild(el);
      out.push({ pos, el, used: false });
    }
    return out;
  }

  function checkPuddle(side: Side): void {
    const puddles = side === "red" ? redPuddles : bluePuddles;
    const pos = side === "red" ? redPos : bluePos;
    const runner = side === "red" ? redRunner : blueRunner;
    for (const p of puddles) {
      if (!p.used && pos >= p.pos) {
        p.used = true;
        p.el.textContent = "💦";
        after(700, () => p.el.remove());
        play("oops");
        slip(runner);
        if (side === "red") redPos = Math.max(0, redPos - 7);
        else bluePos = Math.max(0, bluePos - 7);
        render();
      }
    }
  }

  function advance(side: Side, step: number): void {
    if (!running || matchOver) return;
    if (side === "red") {
      redPos = Math.min(GOAL, redPos + step);
      hop(redRunner);
    } else {
      bluePos = Math.min(GOAL, bluePos + step);
      hop(blueRunner);
    }
    checkPuddle(side);
    render();
    if (redPos >= GOAL) finishRound("red");
    else if (bluePos >= GOAL) finishRound("blue");
  }

  function finishRound(winner: Side): void {
    running = false;
    btnRed.disabled = btnBlue.disabled = true;
    if (winner === "red") redWins++;
    else blueWins++;
    renderHud();
    const matchWinner: Side | null = redWins >= 2 ? "red" : blueWins >= 2 ? "blue" : null;

    const result = document.createElement("div");
    result.className = "race-result";
    const name = winner === "red" ? "红方" : "蓝方";
    if (matchWinner) {
      matchOver = true;
      const mName = matchWinner === "red" ? "红方" : "蓝方";
      result.innerHTML = `
        <div class="race-result-big">${matchWinner === "red" ? "🐹👑" : "🐧👑"}</div>
        <div class="race-result-text">${mName}赢得赛跑比赛!</div>
        <div class="race-result-sub">大比分 ${redWins} : ${blueWins}</div>`;
      wrap.appendChild(result);
      play(matchWinner === "red" || !solo ? "win" : "oops");
      after(1100, () => {
        if (solo) {
          if (matchWinner === "red") onWin(difficulty === "normal" ? 3 : 2, `${redWins}:${blueWins} 赛跑冠军就是你!`);
          else onLose(`${redWins}:${blueWins} 惜败，甩甩腿再来一场!`);
        } else {
          onWin(2, `${mName}赢得赛跑比赛，一起庆祝!`);
        }
      });
    } else {
      result.innerHTML = `
        <div class="race-result-big">${winner === "red" ? "🐹🏆" : "🐧🏆"}</div>
        <div class="race-result-text">${name}拿下第 ${round} 局!</div>
        <div class="race-result-sub">大比分 ${redWins} : ${blueWins}，下一局马上开始</div>`;
      wrap.appendChild(result);
      play("pop");
      after(1400, () => {
        result.remove();
        round++;
        renderHud();
        startRound();
      });
    }
  }

  let aiTimer = 0;
  function scheduleAi(): void {
    if (!alive || matchOver) return;
    const base = difficulty === "easy" ? 300 : 245;
    const jitter = difficulty === "easy" ? 240 : 190;
    const mult = difficulty === "easy" ? 0.78 : 0.95;
    aiTimer = after(base + Math.random() * jitter, () => {
      advance("blue", STEP * (mult + Math.random() * 0.25));
      scheduleAi();
    });
  }

  function startRound(): void {
    redPos = bluePos = 0;
    redPuddles = makePuddles(redTrack);
    bluePuddles = makePuddles(blueTrack);
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

  function startMatch(): void {
    redWins = blueWins = 0;
    round = 1;
    matchOver = false;
    hud.style.display = "";
    renderHud();
    menu.style.display = "none";
    startRound();
  }

  q<HTMLButtonElement>(".race-mode-easy").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    solo = true;
    difficulty = "easy";
    blueLabel.textContent = "蓝方是小电脑(简单)";
    startMatch();
  });
  q<HTMLButtonElement>(".race-mode-normal").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    solo = true;
    difficulty = "normal";
    blueLabel.textContent = "蓝方是小电脑(普通)";
    startMatch();
  });
  q<HTMLButtonElement>(".race-mode-duo").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    solo = false;
    startMatch();
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
      matchOver = true;
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
