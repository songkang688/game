# 三人组第 17 轮 · 测试修复员 A/B 任务清单（playbook）

> 依据：`trio-r17-learn-notes.md`。主干 `7d2bc1a3`。
> **禁止重做**：N-48/58/59；N-43/44/45；N-39（勿回滚 `showMap(true)`）；N-40 赛道内 sticky；N-41 牌宽；N-52/53 源码；N-16 `corridorFit`；**N-63 / C-6 / N-37 / N-68 / N-73**（r13/r14 A 已合）；N-87/N-88 未修则按 r16 口径，**不要改号**。
> **不覆盖** r14/r15/r16 文件。**本工位新伤从 N-89 起。** N-86 已占用。
> A = 壳+学习；B = 休闲对战。
> 水位：交卷前实测。

## 纪律

- 不改存档 key / `meta.id` / 题库 / seed / 胜负。
- 验收 915×412 `getBoundingClientRect`。禁 force。测试只增不减。
- 开/关、root 每档独立 context。

## 测试步骤

- `npm run build && npx vite preview --port 4173`；puppeteer-core + `/usr/local/bin/google-chrome`。

---

## 壳层（A）

N-63 ✅ 源码已合。若 915 仍卷只补回归。

---

## 闯关学习（A）

待 N-89 起条目（连环 / 时装 / 绿芽特殊关 / 沙盒 / 日历等，以笔记数字为准）。

N-77 小屋相册仍开则照 r15，≠ 时装关。

---

## 休闲对战（B）

N-87 / N-88 照 r16。N-86 照 r14 §八。N-75…N-85 照 r15。

待 N-89 起 B 条目。

---

## 完成定义

1. 新伤 N-89 起或书面降级。
2. `npm test` / `npm run build` 水位只增不减。
3. 每条 915 留数字。撞车取先合版。
