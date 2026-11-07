# 1.4 手感套件接入指南（`src/art/kit/feel.ts`）

> 工序 D 唯一入口：`import { feedback, Trauma, HitStop, stepFeel, applyCameraShake, popElement, squashStretch, ease } from "../../art/kit";`。
> 套件只归窗口 1 改，缺接口写需求单；签名见总纲 4.1，行为以 `src/art/kit/feel.test.ts` 为准。

## 1. 事件表（先填表再写码，贴进 `<id>-audit.md`）
| 事件 | 档 | 粒子 / 白闪 / 弹 落在哪 | `sound` 覆盖 |
| --- | --- | --- | --- |
| 拾取金币 / 点对一题 | small | 拾取点 `makeCollectBurst`、计分 `popElement` | `coin` |
| 命中 / 被击 / 重落地 / 消除一组 | medium | 命中点 burst、角色 `squashStretch` | 被击用 `oops` |
| BOSS 倒下 / 过关 / 大爆炸 | large | 星屑 + 全屏白闪 60ms | — |

脚步、普通点击、悬停、每帧持续的接触**不进表**（最多 `api.play("tap")`）。

## 2. 分档（数值只读 `FEEL_TIERS`，不许抄进游戏）
| 档 | trauma | 顿帧 | slow | 粒子 | 白闪 | pop | 建议音 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| small | 0.15 | 0 | — | 4 | 0 | 0.15 | tap |
| medium | 0.4 | 50ms | 0.06 | 10 | 0 | 0.25 | pop |
| large | 0.8 | 110ms | 0.12 | 28 | 60ms | 0.35 | win |

拿不准就往小一档。**一个事件只调一次** `feedback`：trauma 钳 1 不会爆，但连发会让顿帧一直续。`sound: null` = 这次不出声。

## 3. 循环里 `stepFeel`（已有帧计数顿帧的 fight-king / duo-vs-star 可只接 `Trauma`，reduced 口径须一致）
```ts
const trauma = new Trauma(), hitStop = new HitStop();
const reduced = prefersReducedMotion();                // engine/view25d，开局读一次
function frame(now: number) {
  const realMs = Math.min(50, now - last); last = now;
  const gameMs = stepFeel(realMs, { trauma, hitStop }); // 顿帧期间 ≈ realMs × slow；trauma 按真实时间衰减
  update(gameMs / 1000); draw(now / 1000);              // 粒子 / HUD 可继续用 realMs
}
const onHit = (x: number, y: number) => feedback("medium", { reduced, trauma, hitStop, play: api.play,
  burst: (n) => bursts.push(makeCollectBurst({ x, y, count: n, reduced })),
  flash: (ms) => (flashUntil = performance.now() + ms), pop: (a) => { popAmt = a; popT0 = performance.now(); } });
```

## 4. 画布 `applyCameraShake`
```ts
ctx.save();
applyCameraShake(ctx, trauma, now / 1000, { reduced }); // 放在 setTransform(dpr…) 之后；只 translate/rotate
drawWorld(); ctx.restore(); drawHud();                  // HUD 在 restore 之后画，不跟着抖
const { sx, sy } = squashStretch(Math.min(1, (performance.now() - popT0) / 180), popAmt); // 绕脚底缩放
```

画布已缩放成世界坐标的，`maxPx` / `center` 用世界单位传；不传 `center` 自动取画布中心并换算。删掉旧的 `translate((Math.random() - 0.5) * shake)`。

## 5. DOM `popElement`
`popElement(scoreEl, reduced)`：挂 `.feel-pop`（280ms，独立 `scale` 属性，不盖元素自己的 transform），`animationend` 或兜底定时摘类；reduced 只亮 240ms 的 `.feel-pop-flat`。inline 元素请给 `display:inline-block`。

## 6. reduced 怎么验（契约测试 ≥ 6 例，从这几条起步）
```ts
const io = { reduced: true, trauma: new Trauma(), hitStop: new HitStop(), burst: vi.fn(), flash: vi.fn(), play: vi.fn(), pop: vi.fn() };
feedback("large", io);
expect(io.trauma.value).toBe(0); expect(io.hitStop.active).toBe(false); expect(io.flash).not.toHaveBeenCalled();
expect(io.burst).toHaveBeenCalledWith(14); expect(io.play).toHaveBeenCalledTimes(1); expect(io.pop).toHaveBeenCalledWith(0);
const ctx = new FakeCtx2D(); applyCameraShake(ctx as never, io.trauma, 0.3, { reduced: true }); expect(ctx.ops).toEqual([]);
```

手测：系统开「减弱动态效果」→ 命中无抖无停、粒子减半并淡出、按钮只变亮不弹、音效照常；另留一处颜色 / 文案反馈。白闪每秒 ≤ 3 次。
