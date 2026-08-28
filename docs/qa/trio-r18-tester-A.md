# 三人组第 18 轮 · 测试修复员 A 报告(壳层 + 闯关学习,主档 390×844 竖屏)

> 进场:`e58ccceb`(全量测试 **5 红**)。出场:全绿 **1196 文件 / 19498 通过**(含补派 N-97/N-99/N-100 后,高于 1193/19489 水位线)。
> 实测:puppeteer-core + Chrome,视口 390×844(触屏)/ 915×412 / 1024×768 / 360×640。
> 管理员密码 kangkang:1 小时档与永久档均实测通过;N-77 相册、N-39/N-63/N-89 均回归无回退。

## 修了什么(每条附实测数)

| # | 问题(修前) | 修法 | 修后 |
| --- | --- | --- | --- |
| R18-1 | 进场 5 红:combo-clash `.cc-info`、mahjong-bloom `.mj-goal` 在矮屏块被压到 14px + nowrap,违反 16px 正文红线 | 删窄屏字号覆盖(守门允许「要么不写」);`.mj-goal` 去 nowrap/ellipsis,`max-height:1.3em` 单行裁切保矮屏 | mobileText / window1-mobile-text 全绿 |
| R18-2 | **390×844 关内标题条 247px**:管理员开着时攻略/跳过/直达/剩余提示竖堆 4 行,舞台只剩 483px,拼音题需内滚 478→345 | level99 新增 `@media (max-width:480px)`:关内 `.l99-tools` 收单行横滚、`.l99-jump-note` 藏(title/aria 保留) | 标题条 **116px**,舞台 **614px**,题目零内滚;915×412 走原 500px 档不变(bar 100px,选项 bottom 336 进屏) |
| R18-3 | 初次进图 `scrollIntoView` 把进度条与「开始冒险」CTA 卷出视口,顶上剩半个被裁按钮 | 当前关整格在 `.l99-view` 可视区内时跳过滚动(量不出矩形照旧滚,N-39 字符串守门与聚焦不回退) | 第 1 关时 CTA 首屏可见;深关照旧居中滚 |
| R18-4 | sudoku-petal 第 1 关 `.sp-msg` 超出舞台底 **114px**(模式条 tip+按钮占 ~160px) | ≤420px 模式钮收单行横滚、tip 收起(group aria-label 保留完整口径);level99 ≤480px 舞台 `overflow-y:auto` 竖滚兜底 | 舞台 450→**561px**,crop=ok;915/1024 tip 照常显示 |
| R18-5 | memory-cards `.mmc-open/.mmc-toggle` 热区 35–36px(<44 红线,N-47 同类) | min-height:44px | 无 <40px 热区;crop=ok |
| R18-6 | 390 顶栏游戏名被挤到 43px(一个字):攻略钮全宽 + 星星胶囊 82px | ≤420px:顶栏攻略钮 font-size:0 + `::before "📖"`(aria/44 热区不变)、返回与星星胶囊收内边距、gap 6px | 标题文本 43→**67px**;l99 地图工具行攻略钮仍带字 |
| R18-7 | 收藏册全屏档(≤640px)head/foot 贴屏无安全区;`.card-blurb` 等孩子读的字 11–13px | head/foot 补 `env(safe-area-inset-*)`;正文 16px、小标签/按钮 ≥14px | 390/915 无横溢、无小热区;N-59 双栏不回退 |
| **N-99** | sudoku 915×412 盘底两排 **391~447 / 448~504** 线下,`.sp-wrap` overflow hidden 且 scrollH 446 > clientH 178,滚不到 | `max-height:500px` 档 `.sp-wrap` 改 `overflow-y:auto`(数字键/工具行的 sticky 本来就是给滚动准备的) | 滚到底 scrollTop 268,末格 **180~236 IN**,`.sp-pad` sticky **251~295 IN**;390 竖屏 wrap 仍 hidden、pad 611~657 不回退。侧键 40px 高是 N-70 档既定值,未动 |
| **N-100** | 多行 tab 六款 915 进场 center 滚 230/180/188,`.l99-continue` **-154(word-garden)/-104/-50/-52/-39**、root 直达 **-54** 出视口顶 | ① `mapEntryScrollCap` 纯函数:center 卷过「格子贴滚动盒底+8px」就钳回(scrollIntoView 字面量保留,N-39/N-63 守门全绿);② 进度+CTA+工具行包进 `.l99-mapbar`,`max-height:500px` 档 sticky 钉顶、工具行单行横滚(word-garden CTA↔当前关跨 396px > 276px 滚动盒,光钳位无解) | 六款 CTA top **72/72/126/124/145**、root 直达 **122~166**,当前关整格在屏;390 pinyin CTA 106~150、word-garden viewScroll 0,1024 match-stars CTA **162~206** 与 playbook 基线一致 |
| **N-97** | math-farm root×188 关选项 **394~440** 全在舞台裁切线(342)下:关内被地图档 276px 钳位截走 62px + root「直达这题」行 44px 插在题面上方 | ① l99 `max-height:500px` 档 `.l99-wrap:has(.l99-stage-wrap){max-height:none}`(地图档钳位原样);② quiz99 同档 `.qz-jump{order:9}` 排到答题区后(DOM 顺序/热区 44 不动) | 选项 **344~390 IN** 且可点(实测答对进第 2 题);390 L1 不回退 |
| R18-8 | (复证 N-97 时顺带)农场四层 absolute 定位祖先落在 `.l99-wrap`,天空把「🗺️ 选关/跳过」标题条**全视口整条盖住**,只能盲点 | FARM_CSS 契约禁写 l99 选择器 → farmLayer 运行时给舞台 `position:relative`,destroy 原样放回 | 915/390 标题条可见且 elementFromPoint 实点中 `.l99-back`;visual13 CSS 契约测试全绿 |

## N-100 扩面验收(r19 playbook 17 款口径,修 level99.ts 一处全愈)

915×412 进场 `.l99-continue` top(全部 ≥0)+ 当前关整格在 `.l99-view` 内(全部 in):
word-garden 72 / ice-fire-forest 72 / xiangqi 126 / landlord-cards 124 / bumper-cars 145 /
puzzle-tiles 120 / brick-break 122 / red-blue-tap 126 / lianliankan 126 / dot-maze 126(选「🚩 闯关」模式后) /
fishing-star 123 / poop-hero 126 / puff-bros 126 / red-blue-race 126 / red-blue-tug 126 / mine-garden 170。
root 态走 UI 密码门(kangkang→永久→打开,未种 storage):root×pinyin-train 直达 **122~166** /
root×fishing-star 直达 **173~217** / root×bowling-lane(带模式芯片行)CTA **177~221**、直达 **227~271**,全部 IN、当前关在屏。

## 测过的面(390×844 为主)

- **壳层**:首页滚到底(12860px 全程无横溢)、分类/玩法/设备筛选、搜索(中文+拼音首字母)、收藏心形、最近玩过、收藏册(N-77:人物/宠物/装备页签)、暂停面板、攻略抽屉、家长算术门(2 题/45 秒)、kangkang 1 小时+永久、管理员解锁全章节并直进第 172 关。
- **闯关学习款逐个进关**:pinyin-train(胜/负结算、下一关、回地图状态同步 🚩1/188 ⭐2/564)、math-farm、word-garden、music-stars、color-fun、shape-kingdom、clock-house、find-diff、memory-cards、sudoku-petal。
- **壳改动回归(非学习 l99 抽查)**:hop-pads / balloon-pop / merge-2048 / orb-arena 全部 bar=116、无 crop、无横溢、无小热区。

## 未修与说明

- 章节页签 11 个在竖屏换 6 行:window6.r3 守门**明确禁止** `.l99-tabs` 横滚(可发现性先例),不动;地图可滚、CTA 在首屏,可接受。N-100 的 `.l99-mapbar` 只在 `max-height:500px` 档 sticky,竖屏页签布局零变化。
- find-diff `.fdf-viewport` 内滚 19px:游戏自有放大视口 + 缩放滑杆,且舞台已可竖滚,不另修。
- 915 关内火车场景 44px 时「已挂 0/4 节」章挂在车厢上方:N-37 短横屏配方的既定取舍,不动。
- sudoku 915 侧键盘 `.sp-key` 40px 高:N-70「矮宽屏左右分座」档的既定值(r14 已合),非本轮引入,未动;390 竖屏键仍 ≥44。
- math-farm 915 root 档答错提示行 `.qz-msg`(选项下一行)在裁切线下,需在答题宿主里滚一下才见:宿主 fitIntoStage 可滚,且选项/题面已整体进屏,权衡后不再挤压题面字号。
- A 面结案回归(playbook「只写数字」项):N-60/61/62/90/91 由学习员实测口径结案,本轮未重测未加垫。
