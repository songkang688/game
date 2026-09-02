# 1.3 视觉升级 · vendored 前端审美 skills

本目录是 **1.3 视觉升级**（分支 `game-1.2-kk`）的美术方法论素材库，全部从公开仓库**复制文件**进来
（不带上游 git 历史）。执行子代理在动手画任何角色 / 金币 / 布局之前，先读这里对应的 `SKILL.md`。
说明与阅读时机见 [`docs/plan-1.3-skills.md`](../../../docs/plan-1.3-skills.md)，
审美红线见 [`docs/plan-1.3-visual-bible.md`](../../../docs/plan-1.3-visual-bible.md)。

## 来源与许可证

| 子目录 | 上游仓库 | 上游 commit | 许可证 |
| --- | --- | --- | --- |
| `frontend-design/` | [anthropics/skills](https://github.com/anthropics/skills) `skills/frontend-design` | `3b3fad96af16a10759d930941b4520ba0c40edae` | Apache-2.0（随目录附 `LICENSE.txt`） |
| `canvas-design/` | [anthropics/skills](https://github.com/anthropics/skills) `skills/canvas-design` | `3b3fad96af16a10759d930941b4520ba0c40edae` | Apache-2.0（随目录附 `LICENSE.txt`） |
| `algorithmic-art/` | [anthropics/skills](https://github.com/anthropics/skills) `skills/algorithmic-art` | `3b3fad96af16a10759d930941b4520ba0c40edae` | Apache-2.0（随目录附 `LICENSE.txt`） |
| `theme-factory/` | [anthropics/skills](https://github.com/anthropics/skills) `skills/theme-factory` | `3b3fad96af16a10759d930941b4520ba0c40edae` | Apache-2.0（随目录附 `LICENSE.txt`） |
| `character-sprite-maker/` | [Clad3815/character-sprite-maker](https://github.com/Clad3815/character-sprite-maker) | `0f5f2ae88bf5cd32d3a001e4121f2f773ae5f176` | Apache-2.0（随目录附 `LICENSE.txt`） |

## 复制时剔除了什么（为什么）

| 剔除 | 原因 |
| --- | --- |
| `canvas-design/canvas-fonts/`（约 5.5 MB 的 `.ttf` 字体） | 那是给 Python 海报渲染用的西文字体；本产品是离线中文 PWA，不需要，也不该把 5.5 MB 二进制塞进主仓。需要时去上游取。 |
| `theme-factory/theme-showcase.pdf`（124 KB） | 纯展示 PDF，`themes/*.md` 已含全部配色数据。 |
| `character-sprite-maker/scripts/__pycache__/` | Python 编译缓存，不该进版本库。 |

## 使用边界（必须遵守）

1. **只在「设计期」读**：这些 skill 是给写代码 / 画矢量的子代理看的方法论，
   **一个字节都不进 `dist/`**，不 import 进 `src/**`，不作为运行时依赖。离线 PWA 的运行时零外部依赖不变。
2. `character-sprite-maker` 里的 `$imagegen` 图像生成管线在本项目**不可用也不使用**
   （我们不提交位图素材）；只借它的**方法论**：动画清单（idle / walk / jump / hurt / win）、
   帧数规划、图集网格思维、镜像派生、逐帧质检清单。落地一律用 Canvas 2D 矢量函数实现。
3. 上游文档里出现的第三方游戏 / 角色名（例如示例文件名）**属于第三方文档原文**，保持原样不改；
   1.3 的商标扫描一律加 `--glob '!.cursor/skills/**'` 排除本目录，但**我们自己的代码与文案**照旧 0 容忍。
4. 依 Apache-2.0 保留每个目录内的 `LICENSE.txt`；若修改 vendored 文件（不建议），需在文件头注明改动。
