/**
 * 红蓝拔河 red-blue-tug —— 红蓝运动会第一项
 * 三局两胜(BO3)!双人各按一边,或单人挑战蓝方 AI(简单/普通)。
 * 场上会随机冒出加油星,点到它自己队伍就猛拉一大截!
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
  blurb: "红蓝运动会·拔河!三局两胜,抢加油星猛拉一把!",
};

const STYLE = `
.tug-wrap{position:relative;width:100%;height:100%;min-height:480px;overflow:hidden;
  background:linear-gradient(#d0f4ff,#fff6d6);font-family:"PingFang SC","Microsoft YaHei",sans-serif;
  user-select:none;-webkit-user-select:none;touch-action:manipulation;display:flex;flex-direction:column;}
.tug-menu{position:absolute;inset:0;z-index:30;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:14px;background:linear-gradient(#d0f4ff,#fff6d6);padding:16px;}
.tug-menu-title{font-size:28px;font-weight:900;color:#5c4a1e;}
.tug-menu-sub{font-size:15px;font-weight:700;color:#8a7a4a;text-align:center;line-height:1.6;}
.tug-mode{border:none;border-radius:24px;padding:15px 36px;font-size:20px;font-weight:900;color:#fff;
  cursor:pointer;box-shadow:0 6px 0 #0003;font-family:inherit;touch-action:manipulation;min-width:250px;}
.tug-mode:active{transform:translateY(4px);box-shadow:0 2px 0 #0003;}
.tug-mode-easy{background:#51cf66;}
.tug-mode-normal{background:#ff6b6b;}
.tug-mode-duo{background:#845ef7;}
.tug-hud{display:flex;align-items:center;justify-content:center;gap:10px;padding:10px 14px 0;}
.tug-pill{background:#fffd;border-radius:999px;padding:7px 14px;font-size:16px;font-weight:900;
  color:#5c4a1e;box-shadow:0 3px 8px #0002;}
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
.tug-star{position:absolute;z-index:15;font-size:44px;cursor:pointer;
  animation:tugStar .5s ease infinite alternate;filter:drop-shadow(0 0 10px #ffd43b);}
@keyframes tugStar{from{transform:scale(1)}to{transform:scale(1.2)}}
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
  align-items:center;justify-content:center;background:#ffffffd9;animation:tugFade .3s ease;text-align:center;}
@keyframes tugFade{from{opacity:0}to{opacity:1}}
.tug-result-big{font-size:60px;}
.tug-result-text{font-size:26px;font-weight:900;color:#5c4a1e;}
.tug-result-sub{font-size:17px;font-weight:800;color:#8a7a4a;}
`;

type Side = "red" | "blue";
type Difficulty = "easy" | "normal";

export function mount(api: GameApi): { destroy: () => void } {
  const { root, play, onWin, onLose } = api;
  let alive = true;
  let matchOver = false;
  let running = false;
  let solo = true;
  let difficulty: Difficulty = "easy";
  let pos = 0;
  let redWins = 0;
  let blueWins = 0;
  let round = 1;

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
    <div class="tug-hud" style="display:none">
      <div class="tug-pill tug-round">第 1 回合</div>
      <div class="tug-pill tug-score">🐹 0 : 0 🐧</div>
    </div>
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
      <div class="tug-menu-sub">红蓝运动会第一项 · 三局两胜!<br>把 🎀 拉过自己那条线,场上的 ⭐ 点到就猛拉一把!</div>
      <button class="tug-mode tug-mode-easy">🐹 单人 · 小电脑简单</button>
      <button class="tug-mode tug-mode-normal">🐹 单人 · 小电脑普通</button>
      <button class="tug-mode tug-mode-duo">🐹🆚🐧 双人对战</button>
    </div>`;
  root.appendChild(wrap);

  const q = <T extends Element>(sel: string): T => wrap.querySelector(sel) as T;
  const scene = q<HTMLElement>(".tug-scene");
  const ropeRow = q<HTMLElement>(".tug-rope-row");
  const countEl = q<HTMLElement>(".tug-count");
  const menu = q<HTMLElement>(".tug-menu");
  const hud = q<HTMLElement>(".tug-hud");
  const roundEl = q<HTMLElement>(".tug-round");
  const scoreEl = q<HTMLElement>(".tug-score");
  const btnRed = q<HTMLButtonElement>(".tug-btn-red");
  const btnBlue = q<HTMLButtonElement>(".tug-btn-blue");
  const blueLabel = q<HTMLElement>(".tug-btn-blue small");

  function render(): void {
    ropeRow.style.transform = `translateX(${pos * 28}%)`;
  }

  function renderHud(): void {
    roundEl.textContent = `第 ${round} 回合`;
    scoreEl.textContent = `🐹 ${redWins} : ${blueWins} 🐧`;
  }

  function shake(): void {
    scene.classList.remove("tug-shake");
    void scene.offsetWidth;
    scene.classList.add("tug-shake");
  }

  function pull(side: Side, strength: number): void {
    if (!running || matchOver) return;
    pos += side === "red" ? -strength : strength;
    pos = Math.max(-1, Math.min(1, pos));
    render();
    shake();
    if (pos <= -1) finishRound("red");
    else if (pos >= 1) finishRound("blue");
  }

  // 加油星
  let starEl: HTMLElement | null = null;
  let starTimer = 0;
  function clearStar(): void {
    if (starEl) { starEl.remove(); starEl = null; }
  }
  function scheduleStar(): void {
    if (!alive || matchOver) return;
    starTimer = after(2600 + Math.random() * 1800, () => {
      if (running && !starEl) {
        const side: Side = Math.random() < 0.5 ? "red" : "blue";
        const star = document.createElement("div");
        star.className = "tug-star";
        star.textContent = "⭐";
        star.style.left = side === "red" ? `${8 + Math.random() * 22}%` : `${68 + Math.random() * 22}%`;
        star.style.top = `${10 + Math.random() * 26}%`;
        star.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          clearStar();
          play("coin");
          pull(side, 0.16);
        });
        scene.appendChild(star);
        starEl = star;
        after(2000, () => { if (starEl === star) clearStar(); });
      }
      scheduleStar();
    });
  }

  let aiTimer = 0;
  function scheduleAi(): void {
    if (!alive || matchOver) return;
    const base = difficulty === "easy" ? 320 : 240;
    const jitter = difficulty === "easy" ? 300 : 240;
    const power = difficulty === "easy" ? 0.03 : 0.045;
    aiTimer = after(base + Math.random() * jitter, () => {
      pull("blue", power + Math.random() * 0.015);
      scheduleAi();
    });
  }

  function finishRound(winner: Side): void {
    running = false;
    btnRed.disabled = btnBlue.disabled = true;
    clearStar();
    if (winner === "red") redWins++;
    else blueWins++;
    renderHud();
    const matchWinner: Side | null = redWins >= 2 ? "red" : blueWins >= 2 ? "blue" : null;

    const result = document.createElement("div");
    result.className = "tug-result";
    const emoji = winner === "red" ? "🐹🏆" : "🐧🏆";
    const name = winner === "red" ? "红队" : "蓝队";
    if (matchWinner) {
      matchOver = true;
      const mEmoji = matchWinner === "red" ? "🐹👑" : "🐧👑";
      const mName = matchWinner === "red" ? "红队" : "蓝队";
      result.innerHTML = `
        <div class="tug-result-big">${mEmoji}</div>
        <div class="tug-result-text">${mName}赢得拔河比赛!</div>
        <div class="tug-result-sub">大比分 ${redWins} : ${blueWins}</div>`;
      wrap.appendChild(result);
      play(matchWinner === "red" || !solo ? "win" : "oops");
      after(1100, () => {
        if (solo) {
          if (matchWinner === "red") onWin(difficulty === "normal" ? 3 : 2, `${redWins}:${blueWins} 拿下拔河冠军!`);
          else onLose(`${redWins}:${blueWins} 惜败，再挑战一次!`);
        } else {
          onWin(2, `${mName}赢得拔河比赛，击掌庆祝!`);
        }
      });
    } else {
      result.innerHTML = `
        <div class="tug-result-big">${emoji}</div>
        <div class="tug-result-text">${name}拿下第 ${round} 回合!</div>
        <div class="tug-result-sub">大比分 ${redWins} : ${blueWins}，下一回合马上开始</div>`;
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

  function startMatch(): void {
    redWins = blueWins = 0;
    round = 1;
    matchOver = false;
    hud.style.display = "";
    renderHud();
    menu.style.display = "none";
    scheduleStar();
    startRound();
  }

  q<HTMLButtonElement>(".tug-mode-easy").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    solo = true;
    difficulty = "easy";
    blueLabel.textContent = "蓝队是小电脑(简单)";
    startMatch();
  });
  q<HTMLButtonElement>(".tug-mode-normal").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    solo = true;
    difficulty = "normal";
    blueLabel.textContent = "蓝队是小电脑(普通)";
    startMatch();
  });
  q<HTMLButtonElement>(".tug-mode-duo").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    solo = false;
    startMatch();
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
      matchOver = true;
      clearTimeout(aiTimer);
      clearTimeout(starTimer);
      timers.forEach((id) => {
        clearTimeout(id);
        clearInterval(id);
      });
      timers.clear();
      wrap.remove();
    },
  };
}
