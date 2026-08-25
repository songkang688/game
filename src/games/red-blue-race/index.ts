import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { AVATAR_URLS } from "../../ui/avatars";
import { CHAPTERS, LEVELS, TRACK_LEN, type Obstacle, type RaceLevel } from "./levels";

export const meta = {
  id: "red-blue-race",
  title: "红蓝赛跑",
  emoji: "🏁",
  category: "party" as const,
  color: "#51cf66",
  blurb: "99 关六大赛道！水坑要跳、栏架要跨、上坡要拼，冲线夺冠！",
};

const OB_EMOJI: Record<Obstacle["type"], string> = {
  puddle: "💧",
  hurdle: "🚧",
  hill: "⛰️",
  star: "⭐",
};

const CSS = `
.rbr-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #E8F8E0, #FFF7E0); border-radius: 16px; padding: 12px; user-select: none; touch-action: manipulation; position: relative; }
.rbr-top { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 6px; }
.rbr-badge { display: inline-flex; align-items: center; gap: 6px; background: #fff; border-radius: 999px; padding: 4px 12px 4px 4px; font-weight: 700; color: #4E8A3E; box-shadow: 0 2px 6px rgba(110,170,90,.25); font-size: 14px; }
.rbr-badge.rbr-badge-right { padding: 4px 4px 4px 12px; }
.rbr-ava { width: 28px; height: 28px; border-radius: 50%; border: 2px solid #fff; object-fit: cover; box-shadow: 0 1px 4px rgba(90,130,80,.3); }
.rbr-runner-img { width: 40px; height: 40px; border-radius: 50%; border: 3px solid #fff; object-fit: cover; box-shadow: 0 3px 8px rgba(90,110,80,.35); background: #fff; display: block; }
.rbr-runner.rbr-me .rbr-runner-img { border-color: #FFB3B3; }
.rbr-runner.rbr-airun .rbr-runner-img { border-color: #A9C6FF; }
.rbr-lane { position: relative; height: 56px; border-radius: 14px; margin-bottom: 8px; overflow: hidden; }
.rbr-lane-red { background: linear-gradient(180deg, #FFE4E4, #FFD4D4); }
.rbr-lane-blue { background: linear-gradient(180deg, #E0EEFF, #D0E4FF); }
.rbr-finish { position: absolute; right: 4px; top: 0; bottom: 0; display: flex; align-items: center; font-size: 22px; }
.rbr-runner { position: absolute; top: 50%; transform: translateY(-50%); font-size: 30px; transition: left .12s linear; }
.rbr-runner.rbr-jump { animation: rbrJump .45s ease; }
@keyframes rbrJump { 0%,100% { transform: translateY(-50%); } 50% { transform: translateY(-110%); } }
.rbr-ob { position: absolute; top: 4px; font-size: 17px; opacity: .9; }
.rbr-hill { position: absolute; top: 0; bottom: 0; background: rgba(160,130,80,.18); border-radius: 8px; }
.rbr-ctrl { display: flex; justify-content: center; gap: 16px; margin-top: 6px; }
.rbr-run { flex: 1; max-width: 200px; height: 68px; border: none; border-radius: 20px; font-size: 24px; font-weight: 900; color: #fff; background: linear-gradient(180deg, #FF8A8A, #E85555); cursor: pointer; box-shadow: 0 5px 0 #C23B3B; font-family: inherit; touch-action: manipulation; }
.rbr-run:active { transform: translateY(3px); box-shadow: 0 2px 0 #C23B3B; }
.rbr-jump-btn { width: 110px; height: 68px; border: none; border-radius: 20px; font-size: 20px; font-weight: 900; color: #fff; background: linear-gradient(180deg, #7FBFFF, #4D97E8); cursor: pointer; box-shadow: 0 5px 0 #3576BF; font-family: inherit; touch-action: manipulation; }
.rbr-jump-btn:active { transform: translateY(3px); box-shadow: 0 2px 0 #3576BF; }
.rbr-msg { text-align: center; min-height: 20px; color: #4E8A3E; font-weight: 700; margin-top: 8px; font-size: 14px; }
`;

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: RaceLevel = LEVELS[ctx.level];
  let destroyed = false;
  let ended = false;
  let raf = 0;
  let lastTime = 0;
  let me = 0;
  let ai = 0;
  let stunnedUntil = 0;
  let jumping = false;
  const clearedObs = new Set<Obstacle>();
  const aiPaused = new Set<Obstacle>();
  let aiPauseUntil = 0;

  const wrap = document.createElement("div");
  wrap.className = "rbr-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="rbr-top">
      <span class="rbr-badge"><img class="rbr-ava" src="${AVATAR_URLS.duoduo}" alt="朵朵" />🔴 朵朵 · 你的赛道</span>
      <span class="rbr-badge rbr-badge-right rbr-ai">🔵 星星 · 小电脑<img class="rbr-ava" src="${AVATAR_URLS.xingxing}" alt="星星" /></span>
    </div>
    <div class="rbr-lane rbr-lane-red">
      <div class="rbr-finish">🏁</div>
      <div class="rbr-runner rbr-me" style="left:0%"><img class="rbr-runner-img" src="${AVATAR_URLS.duoduo}" alt="朵朵在奔跑" /></div>
    </div>
    <div class="rbr-lane rbr-lane-blue">
      <div class="rbr-finish">🏁</div>
      <div class="rbr-runner rbr-airun" style="left:0%"><img class="rbr-runner-img" src="${AVATAR_URLS.xingxing}" alt="星星在奔跑" /></div>
    </div>
    <div class="rbr-ctrl">
      <button class="rbr-run" type="button">跑！跑！跑！</button>
      <button class="rbr-jump-btn" type="button">🦘 跳！</button>
    </div>
    <div class="rbr-msg">狂点「跑」，遇到 💧🚧 提前按「跳」！</div>
  `;
  stage.appendChild(wrap);

  const redLane = wrap.querySelector(".rbr-lane-red") as HTMLElement;
  const meEl = wrap.querySelector(".rbr-me") as HTMLElement;
  const aiEl = wrap.querySelector(".rbr-airun") as HTMLElement;
  const msgEl = wrap.querySelector(".rbr-msg") as HTMLElement;
  const runBtn = wrap.querySelector(".rbr-run") as HTMLButtonElement;
  const jumpBtn = wrap.querySelector(".rbr-jump-btn") as HTMLButtonElement;

  // 画机关
  for (const ob of cfg.obstacles) {
    if (ob.type === "hill") {
      const zone = document.createElement("div");
      zone.className = "rbr-hill";
      zone.style.left = `${ob.pos}%`;
      zone.style.width = `${ob.len}%`;
      redLane.appendChild(zone);
    }
    const mark = document.createElement("div");
    mark.className = "rbr-ob";
    mark.style.left = `${ob.pos}%`;
    mark.textContent = OB_EMOJI[ob.type];
    redLane.appendChild(mark);
  }

  function inZone(pos: number, ob: Obstacle): boolean {
    return pos >= ob.pos && pos <= ob.pos + ob.len;
  }

  function render(): void {
    meEl.style.left = `${Math.min(92, me * 0.92)}%`;
    aiEl.style.left = `${Math.min(92, ai * 0.92)}%`;
  }

  function finish(won: boolean): void {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    if (won) {
      const got = ai <= 70 ? 3 : ai <= 88 ? 2 : 1;
      setTimeout(() => { if (!destroyed) ctx.win(got as 1 | 2 | 3, `你先冲线！小电脑才跑到 ${Math.round(ai)} 米！`); }, 350);
    } else {
      setTimeout(() => { if (!destroyed) ctx.lose("小电脑先到啦，手指再快一点、跳得再准一点！"); }, 350);
    }
  }

  function onRun(): void {
    if (ended) return;
    const now = performance.now();
    if (now < stunnedUntil) return;
    let step = cfg.tapStep;
    for (const ob of cfg.obstacles) {
      if (ob.type === "hill" && inZone(me, ob)) step *= 0.5;
    }
    const before = me;
    me = Math.min(TRACK_LEN, me + step);
    // 撞机关检查
    for (const ob of cfg.obstacles) {
      if (clearedObs.has(ob)) continue;
      if (ob.type === "star" && before < ob.pos && me >= ob.pos) {
        clearedObs.add(ob);
        me = Math.min(TRACK_LEN, me + 8);
        ctx.sfx("coin");
        msgEl.textContent = "⭐ 踩到星星，咻——冲刺！";
      } else if ((ob.type === "puddle" || ob.type === "hurdle") && !jumping && before < ob.pos && me >= ob.pos) {
        clearedObs.add(ob);
        if (ob.type === "puddle") {
          me = Math.max(0, ob.pos - 2);
          stunnedUntil = performance.now() + 800;
          ctx.sfx("oops");
          msgEl.textContent = "💧 踩进水坑打滑啦！下次提前按「跳」！";
        } else {
          me = Math.max(0, ob.pos - 4);
          stunnedUntil = performance.now() + 600;
          ctx.sfx("oops");
          msgEl.textContent = "🚧 撞上栏架弹回来啦！提前按「跳」！";
        }
      }
    }
    ctx.sfx("tap");
    render();
    if (me >= TRACK_LEN) finish(true);
  }

  function onJump(): void {
    if (ended) return;
    const now = performance.now();
    if (now < stunnedUntil || jumping) return;
    jumping = true;
    meEl.classList.add("rbr-jump");
    ctx.sfx("jump");
    // 前方 8 米内有水坑/栏架就跃过去
    const target = cfg.obstacles.find(
      (ob) => (ob.type === "puddle" || ob.type === "hurdle") && !clearedObs.has(ob) && ob.pos >= me && ob.pos <= me + 8
    );
    if (target) {
      clearedObs.add(target);
      me = Math.min(TRACK_LEN, target.pos + target.len + 1);
      msgEl.textContent = "跳得漂亮！";
    } else {
      me = Math.min(TRACK_LEN, me + 1.5);
    }
    render();
    setTimeout(() => {
      jumping = false;
      meEl.classList.remove("rbr-jump");
    }, 450);
    if (me >= TRACK_LEN) finish(true);
  }

  function tick(now: number): void {
    if (destroyed || ended) return;
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
    lastTime = now;
    if (now >= aiPauseUntil) {
      let speed = cfg.aiSpeed;
      for (const ob of cfg.obstacles) {
        if (ob.type === "hill" && inZone(ai, ob)) speed *= 0.7;
      }
      const before = ai;
      ai = Math.min(TRACK_LEN, ai + speed * dt);
      // 小电脑遇到水坑/栏架会停顿一下（它也会犯难）
      for (const ob of cfg.obstacles) {
        if ((ob.type === "puddle" || ob.type === "hurdle") && !aiPaused.has(ob) && before < ob.pos && ai >= ob.pos) {
          aiPaused.add(ob);
          aiPauseUntil = now + 550;
        }
      }
    }
    render();
    if (ai >= TRACK_LEN) {
      finish(false);
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  runBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    onRun();
  });
  jumpBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    onJump();
  });
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "d") { onRun(); e.preventDefault(); }
    if (e.key === " " || e.key === "ArrowUp") { onJump(); e.preventDefault(); }
  };
  window.addEventListener("keydown", onKeyDown);

  render();
  raf = requestAnimationFrame((t) => {
    lastTime = t;
    raf = requestAnimationFrame(tick);
  });

  return {
    destroy() {
      destroyed = true;
      ended = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      wrap.remove();
    },
  };
}

export function mount(api: GameApi): { destroy: () => void } {
  return mountLevelGame(api, {
    id: meta.id,
    chapters: CHAPTERS,
    playLevel,
    mapHint: "赢得越多、甩开小电脑越远，星星越多！",
    grandMessage: "99 场比赛全部夺冠，你就是赛跑总冠军！",
  });
}
