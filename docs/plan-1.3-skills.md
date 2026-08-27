# 一朵一星 1.3 · vendored 前端审美 skills 说明

> skills 实体在 **`.cursor/skills/1.3-visual/`**（已随本档提交进仓库，不是链接）。
> 来源 commit、许可证、复制时剔除项见 [`.cursor/skills/1.3-visual/README.md`](../.cursor/skills/1.3-visual/README.md)。
> 主管文档：[`plan-1.3-supervisor.md`](./plan-1.3-supervisor.md) · 视觉宪法：[`plan-1.3-visual-bible.md`](./plan-1.3-visual-bible.md)

## 一、总原则

1. skills 是**设计期方法论**，给执行子代理动笔前读的；一个字节都不进 `dist/`、不 import 进 `src/**`、
   不引入任何运行时依赖——离线 PWA 底线不动。
2. 只借**方法**（构图、色板组织、动画清单、质检思维），产出一律是自己写的 Canvas 2D 矢量代码与 CSS。
3. vendored 文档保持上游原文（含英文与上游示例文件名）；1.3 商标扫描排除 `.cursor/skills/**`（宪法第八节）。

## 二、每个 skill 干什么、谁在什么时候读

| skill（路径） | 来源 / 许可证 | 它教什么 | 谁读、何时读 |
| --- | --- | --- | --- |
| `frontend-design/` | anthropics/skills · Apache-2.0 | 拒绝「模板默认脸」：以产品的主题世界（本作 = 粉彩花园与星空）推导版式、字号刻度、留白与个性；hero / 层次 / 对比的决策方法 | **所有档全员**动笔前通读一遍；第 1 步 B（布局动效）与第 27–29 步验收员精读 |
| `canvas-design/` | anthropics/skills · Apache-2.0 | Canvas 上做「设计品质」画面的工作流：构图、网格、层次、反复自检渲染效果（其字体与 Python 渲染流程不用） | 第 1 步 A（素材包）、第 1 步 C（跑道套件）动笔前；第 2–26 步凡重画游戏主画面的执行者 |
| `algorithmic-art/` | anthropics/skills · Apache-2.0 | 程序化视觉：粒子系统、流场、噪声、seed 可复现；`templates/generator_template.js` 是 rAF 动画骨架 | 第 1 步 A 的 `fx.ts`（粒子）与第 1 步 C 的 `sky.ts` / `speedfx.ts`；后续步做背景氛围（云、萤火、星雨）时 |
| `theme-factory/` | anthropics/skills · Apache-2.0 | 成套主题色板的组织方法（`themes/*.md` 十套现成结构：主色 / 辅色 / 强调 / 中性阶）；我们**只借结构**，色值按宪法粉彩方向自定 | 第 1 步 A 定 `palette.ts`、第 1 步 B 定 `styles.css` 色阶时；第 2–26 步给单款游戏定专属配色时 |
| `character-sprite-maker/` | Clad3815/character-sprite-maker · Apache-2.0 | 角色资产的**工程化流水线思维**：动画清单（idle / walk / run / jump / attack / hurt / win）、每动画帧数规划、图集网格、镜像派生左右朝向、逐帧质检、打包契约（`references/input-schema.md` 的字段设计值得抄思路） | 第 1 步 A 设计 `chars.ts` 的姿态 / 相位 API 前**必读**；第 2–26 步给某款游戏做独占角色（BOSS、双人 A/B 角）前必读 |

## 三、`character-sprite-maker` 的特别说明

- 上游管线依赖 `$imagegen` 图像生成器产出位图 spritesheet；本项目**不用这条路**（不提交位图、无图像生成环境）。
- 我们借它的是：①「一个角色 = 一张动画清单 + 每段帧数」的资产台账思维（落地为 `chars.ts` 的
  `pose` / `t` 相位参数与常量表）；② 镜像派生（`derive_mirror_animation.py` 的思路 → `facing` 翻转但配饰方向要对）；
  ③ 逐帧质检清单（→ 素材契约测试的断言来源）；④ 版权处理原则（"style X" 只转译为原创方向，绝不复刻）。
- `scripts/*.py` 与 `agents/openai.yaml` 保留仅作方法参考，**不在本项目执行**；
  上游示例文件名含第三方游戏名，属上游原文，扫描已排除（宪法第八节）。

## 四、执行者使用清单（写进每份 step 提示词的「必读文件」段）

```
动笔前：
[ ] docs/plan-1.3-visual-bible.md 通读
[ ] frontend-design/SKILL.md 通读
[ ] 按本表对号：画角色 → character-sprite-maker；画主画面 → canvas-design；
    做粒子/背景 → algorithmic-art；定色板 → theme-factory
动笔后：
[ ] 产出只有 TypeScript/CSS,无位图、无新依赖
[ ] 回复里写明参考了哪几个 skill 的哪个方法
```

## 五、许可证义务

五个 skill 均为 **Apache License 2.0**：每个目录内已保留上游 `LICENSE.txt`；
本仓库自身是 MIT，两者兼容（Apache-2.0 材料保留其许可证文本与出处即可）。
若日后修改 vendored 文件（不建议），须在被改文件头部注明改动说明（Apache-2.0 §4(b)）。
上游出处与 commit 固定记录在 [`.cursor/skills/1.3-visual/README.md`](../.cursor/skills/1.3-visual/README.md)。
