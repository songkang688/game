/**
 * 萌猫小屋 · 样式（1.2 从 `index.ts` 抽出来）。
 *
 * 类名一律 `ktc-` 前缀，整份跟着游戏一起挂载，不往 `src/styles.css` 里塞东西。
 * 三条硬指标写在这里：拖拽物与吸附点热区 ≥ 48px、搓澡区 ≥ 240×240px、
 * 相册在 360px 上是两列且缩略图 ≥ 100px。`prefers-reduced-motion` 里
 * 呼吸、尾巴、飘心全部停下，只保留表情切换。
 */

/**
 * 逗猫 / 打扮场地的高度（px）。
 * 场地在场时猫收到 `FIELD_CAT_H`，两边加起来不许比原来的猫（约 300px）高，
 * 否则底下的提示行会被舞台裁掉。这条关系有用例钉着。
 */
export const FIELD_H = 148;
/** 场地在场时猫的画面高度（px） */
export const FIELD_CAT_H = 138;
/** 场地在场时，猫 + 场地一共占多高（用例用它跟原来的猫比） */
export const FIELD_STACK_PX = FIELD_H + 6 + FIELD_CAT_H;

export const KTC_CSS = `
.ktc-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;border-radius:16px;padding:10px;
  user-select:none;-webkit-user-select:none;position:relative;min-height:460px;touch-action:manipulation;}
/* 轻微的斜视角背景做伪纵深；交互层始终是正交 2D */
.ktc-room{position:absolute;inset:0;border-radius:16px;overflow:hidden;pointer-events:none;}
.ktc-room::before{content:"";position:absolute;left:-10%;right:-10%;bottom:0;height:42%;
  background:linear-gradient(#ffffff33,#00000012);transform:perspective(320px) rotateX(46deg);transform-origin:bottom;}
.ktc-room-spot{position:absolute;font-size:30px;line-height:1;filter:drop-shadow(0 3px 4px rgba(120,90,50,.25));}
.ktc-room-window{left:6%;top:8%;}
.ktc-room-wall{right:8%;top:10%;}
.ktc-room-corner{right:6%;bottom:26%;}
.ktc-room-floor{left:10%;bottom:12%;}

/* 顶部任务条：固定在舞台顶端，不压住猫 */
.ktc-top{position:relative;z-index:3;display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-bottom:6px;}
.ktc-badge{background:#ffffffd9;border-radius:14px;padding:5px 10px;font-weight:800;color:#8a5a1e;font-size:13px;
  box-shadow:0 2px 6px rgba(180,130,60,.2);white-space:nowrap;}
.ktc-badge.ktc-done{background:#d9f5d0;color:#3f7a36;}
.ktc-badge.ktc-now{outline:2px solid #f7a23b;}
.ktc-badge.ktc-clock{background:#eaf3ff;color:#3c5a8a;}
.ktc-mood{position:relative;z-index:3;display:flex;align-items:center;gap:6px;justify-content:center;
  margin:2px auto 4px;max-width:300px;}
.ktc-moodbar{flex:1;height:12px;background:#ffffffcc;border-radius:8px;overflow:hidden;
  box-shadow:inset 0 1px 3px rgba(0,0,0,.1);}
.ktc-moodfill{height:100%;width:100%;border-radius:8px;background:linear-gradient(90deg,#ffb3c9,#ff7fa8);transition:width .3s;}
.ktc-moodface{font-size:20px;line-height:1;}
.ktc-bubble{position:relative;z-index:3;min-height:34px;margin:4px auto;background:#fff;border-radius:18px;
  padding:8px 16px;font-size:19px;font-weight:900;color:#6b4a20;width:fit-content;max-width:94%;
  box-shadow:0 3px 8px rgba(160,110,40,.18);text-align:center;line-height:1.4;}
.ktc-plan{position:relative;z-index:3;margin:0 auto 4px;background:#ffffffd9;border-radius:14px;padding:5px 12px;
  font-size:14px;font-weight:800;color:#3f7a68;width:fit-content;max-width:94%;text-align:center;line-height:1.6;}
.ktc-plan span{white-space:nowrap;}

/* 猫的舞台：双猫关每只猫独占一列，点击区不重叠 */
.ktc-cats{position:relative;z-index:2;display:flex;gap:10px;justify-content:center;align-items:flex-end;margin:4px auto;}
.ktc-cat{position:relative;flex:1 1 0;min-width:0;max-width:300px;opacity:.6;cursor:pointer;
  border-radius:16px;padding:2px;transition:opacity .25s,transform .25s;}
.ktc-cat.ktc-cat-on{opacity:1;transform:translateY(-2px);background:#ffffff5c;outline:3px solid #f7a23b;}
.ktc-cat:focus-visible{outline:3px solid #3c2a6b;outline-offset:2px;}
.ktc-catname{text-align:center;font-size:13px;font-weight:900;color:#7a5320;background:#ffffffcc;
  border-radius:999px;padding:2px 10px;width:fit-content;margin:0 auto 2px;}
.ktc-cat.ktc-cat-on .ktc-catname{background:#ffd9a8;color:#8a4a10;}
.ktc-cat-svg{width:100%;display:block;}

/* 表情：默认一组睁眼；别的组按 data-face 亮 */
.ktc-eyes-happy,.ktc-eyes-sleepy,.ktc-ears-flat,.ktc-mouth-open,.ktc-box,.ktc-acc{display:none;}
.ktc-cat[data-face="happy"] .ktc-eyes-open{display:none;}
.ktc-cat[data-face="happy"] .ktc-eyes-happy{display:block;}
.ktc-cat[data-face="sleepy"] .ktc-eyes-open{display:none;}
.ktc-cat[data-face="sleepy"] .ktc-eyes-sleepy{display:block;}
.ktc-cat[data-face="pouty"] .ktc-ears-up{display:none;}
.ktc-cat[data-face="pouty"] .ktc-ears-flat{display:block;}
.ktc-cat[data-face="hiding"] .ktc-body,
.ktc-cat[data-face="hiding"] .ktc-head,
.ktc-cat[data-face="hiding"] .ktc-tail-wrap{display:none;}
.ktc-cat[data-face="hiding"] .ktc-box{display:block;}
.ktc-cat[data-eat="1"] .ktc-mouth-open{display:block;}
.ktc-cat[data-acc="bow"] .ktc-acc-bow,
.ktc-cat[data-acc="hat"] .ktc-acc-hat,
.ktc-cat[data-acc="tie"] .ktc-acc-tie,
.ktc-cat[data-acc="scarf"] .ktc-acc-scarf{display:block;}

/* 呼吸 + 尾巴：两个循环动画，reduced-motion 里全停 */
.ktc-body{transform-origin:108px 190px;animation:ktcBreath 3.1s ease-in-out infinite;}
.ktc-head{transform-origin:110px 96px;animation:ktcBreath 3.1s ease-in-out infinite;}
.ktc-tail-wrap{transform-origin:180px 152px;animation:ktcTail 2.4s ease-in-out infinite;}
@keyframes ktcBreath{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.022)}}
@keyframes ktcTail{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(9deg)}}
.ktc-cat.ktc-nod .ktc-head{animation:ktcNod .55s ease;}
@keyframes ktcNod{0%,100%{transform:rotate(0)}40%{transform:rotate(-7deg) scale(1.04)}}
.ktc-cat.ktc-tilt .ktc-head{animation:ktcTilt .6s ease;}
@keyframes ktcTilt{0%,100%{transform:rotate(0)}50%{transform:rotate(11deg)}}
.ktc-heart{position:absolute;font-size:22px;pointer-events:none;animation:ktcHeart 1s ease-out forwards;}
@keyframes ktcHeart{from{transform:translateY(0) scale(.6);opacity:1}to{transform:translateY(-56px) scale(1.15);opacity:0}}

/* 拖拽层：食物 / 配饰 / 逗猫棒，热区一律 ≥ 48px */
.ktc-tray{position:relative;z-index:3;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:8px;}
.ktc-drag{width:58px;height:58px;min-width:48px;min-height:48px;border:none;border-radius:16px;background:#fff;
  font-size:30px;cursor:grab;box-shadow:0 4px 0 rgba(180,130,60,.3);font-family:inherit;
  display:flex;flex-direction:column;align-items:center;justify-content:center;touch-action:none;}
.ktc-drag small{font-size:11px;font-weight:800;color:#8a5a1e;}
.ktc-drag.ktc-dragging{opacity:.35;}
.ktc-ghost{position:fixed;z-index:40;font-size:34px;pointer-events:none;transform:translate(-50%,-50%);}
.ktc-target{position:absolute;width:64px;height:64px;border-radius:50%;display:flex;align-items:center;
  justify-content:center;font-size:30px;background:#ffffffcc;box-shadow:0 3px 8px rgba(160,110,40,.28);
  outline:3px dashed #f7a23b66;}
.ktc-target.ktc-target-hot{outline:3px solid #f7a23b;transform:scale(1.08);}
/* 交互层：喂饭的碗与托盘、逗猫与打扮的场地都住这儿 */
.ktc-play{position:relative;z-index:3;}
/* 饭碗原先是 position:absolute;bottom:4px，贴的是整个 .ktc-wrap 的底：
   底下正好排着托盘（z-index:3）和提示行（z-index:3），碗自己没有 z-index，
   于是被这两层盖住——屏幕上一个碗都看不见，elementFromPoint 拿到的是 .ktc-drag / .ktc-msg。
   舞台越矮压得越紧：320×640 上拿起食物、提示行折成两行之后就彻底点不中了。
   碗本来就该在托盘正上方，改回正常流里居中一块，既看得见也点得中。 */
.ktc-bowl{position:relative;left:auto;bottom:auto;transform:none;margin:2px auto 6px;}
.ktc-toy{position:absolute;width:56px;height:56px;border-radius:50%;background:#ffffffd8;font-size:30px;
  border:none;box-shadow:0 3px 8px rgba(160,110,40,.3);touch-action:none;cursor:grab;
  display:flex;align-items:center;justify-content:center;transform:translate(-50%,-50%);}

/* 逗猫 / 打扮的场地。
   这一块原先一条样式都没有：高度塌成 0，pointermove 收不到真手指；
   里面那些 position:absolute 的孩子（棒子、爪印、两个吸附圈）于是拿 .ktc-wrap 当定位祖先，
   还因为没有 z-index 被 .ktc-cats（z-index:2）压在下面，elementFromPoint 一个都够不着。
   其余交互层（.ktc-tray / .ktc-btns / .ktc-washwrap / .ktc-beats）都写着 position:relative;z-index:3，
   这里补齐同一套，并给它真实高度当好定位祖先。 */
.ktc-field{position:relative;z-index:3;width:min(300px,92%);height:${FIELD_H}px;margin:6px auto 0;
  border-radius:20px;background:radial-gradient(circle at 50% 42%,#fff8ea,#ffe7c4);
  box-shadow:inset 0 2px 10px rgba(180,130,60,.22);touch-action:none;overflow:hidden;}
.ktc-chaser{position:absolute;font-size:22px;line-height:1;pointer-events:none;transform:translate(-50%,-50%);}
/* 两个吸附圈本来都没有偏移，会叠在同一个点上（「头顶」和「脖子」根本分不开） */
.ktc-spot-head{left:calc(50% - 32px);top:10px;}
.ktc-spot-neck{left:calc(50% - 32px);top:${FIELD_H - 74}px;}
/* 场地在场时把猫收一档，省出来的高度正好给场地，舞台底下的提示行不会被顶出去 */
.ktc-wrap.ktc-hasfield .ktc-cat-svg{height:${FIELD_CAT_H}px;width:auto;max-width:100%;margin:0 auto;}
/* 矮舞台上由 fitIntoStage() 逐档写 --ktc-cat-h；写在 .ktc-hasfield 后面，两条同权重时它说了算 */
.ktc-wrap.ktc-fit .ktc-cat-svg{height:var(--ktc-cat-h);width:auto;max-width:100%;margin:0 auto;}

/* 搓澡区：至少 240×240，画圈就能搓 */
.ktc-washwrap{position:relative;z-index:3;margin:6px auto 0;width:min(300px,92%);min-width:240px;}
.ktc-wash{position:relative;width:100%;aspect-ratio:1;min-height:240px;border-radius:20px;touch-action:none;
  background:radial-gradient(circle at 50% 45%,#e8f6ff,#cfeaff);box-shadow:inset 0 2px 10px rgba(80,130,180,.25);
  overflow:hidden;cursor:grab;}
.ktc-foam{position:absolute;border-radius:50%;background:#ffffffe0;box-shadow:0 1px 3px rgba(90,140,190,.3);
  transform:translate(-50%,-50%);}
.ktc-foam.ktc-pop{animation:ktcPop .32s ease-out forwards;}
@keyframes ktcPop{from{transform:translate(-50%,-50%) scale(1);opacity:.95}to{transform:translate(-50%,-50%) scale(1.7);opacity:0}}
.ktc-coverbar{height:10px;border-radius:6px;background:#ffffffcc;overflow:hidden;margin-top:6px;}
.ktc-coverfill{height:100%;width:0;background:linear-gradient(90deg,#8fd6ff,#4dabf7);transition:width .2s;}

/* 节奏灯 */
.ktc-beats{position:relative;z-index:3;display:flex;gap:8px;justify-content:center;margin:8px 0 4px;}
.ktc-beat{width:26px;height:26px;border-radius:50%;background:#ffffffb0;display:flex;align-items:center;
  justify-content:center;font-size:15px;}
.ktc-beat.ktc-beat-live{background:#ffe9a8;transform:scale(1.18);}
.ktc-beat.ktc-beat-hit{background:#c8f0c0;}
.ktc-note{min-width:120px;min-height:64px;border:none;border-radius:20px;background:#fff;font-size:32px;
  cursor:pointer;box-shadow:0 4px 0 rgba(180,130,60,.3);font-family:inherit;}
.ktc-note:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(180,130,60,.3);}

/* 选项按钮（看病 / 搭配 / 安抚） */
.ktc-btns{position:relative;z-index:3;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:8px;}
.ktc-btn{min-width:78px;min-height:62px;border:none;border-radius:18px;background:#fff;cursor:pointer;font-size:28px;
  box-shadow:0 4px 0 rgba(180,130,60,.3);font-family:inherit;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:2px;padding:6px 10px;}
.ktc-btn small{font-size:12px;font-weight:800;color:#8a5a1e;line-height:1.25;text-align:center;}
.ktc-btn:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(180,130,60,.3);}
.ktc-btn.ktc-soft{background:#fff6e6;}
.ktc-btn:focus-visible,.ktc-drag:focus-visible,.ktc-note:focus-visible{outline:3px solid #3c2a6b;outline-offset:2px;}
.ktc-mini{border:none;border-radius:999px;padding:8px 16px;min-height:44px;font-size:14px;font-weight:900;
  cursor:pointer;font-family:inherit;background:#ffffffe0;color:#7a5320;box-shadow:0 3px 0 rgba(180,130,60,.28);
  white-space:nowrap;}
.ktc-mini:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(180,130,60,.28);}
.ktc-mini.ktc-primary{background:linear-gradient(180deg,#ffb454,#f79c2a);color:#fff;box-shadow:0 3px 0 #d97f16;}
.ktc-tools{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 8px;}
.ktc-msg{position:relative;z-index:3;text-align:center;min-height:22px;font-weight:800;color:#a86a28;
  margin-top:8px;font-size:15px;line-height:1.5;}
.ktc-safety{position:relative;z-index:3;text-align:center;font-size:13px;font-weight:800;color:#3f7a68;
  background:#eafaf3;border-radius:12px;padding:6px 12px;margin:6px auto 0;width:fit-content;max-width:94%;}
.ktc-score{position:relative;z-index:3;margin:6px auto 0;background:#ffffffdd;border-radius:14px;padding:8px 12px;
  font-size:13px;font-weight:800;color:#6b4a8a;max-width:min(340px,94%);line-height:1.7;text-align:left;}
.ktc-score b{color:#3f7a36;}
.ktc-score i{font-style:normal;color:#b06a2c;}
.ktc-night .ktc-msg{color:#ffe9c0;}
.ktc-night .ktc-bubble{background:#fffdf3;}

/* 相册与小屋摆设：360px 上两列，缩略图 ≥ 100px */
.ktc-album{padding:8px;}
.ktc-albumhead{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:center;margin-bottom:8px;}
.ktc-grid{display:grid;grid-template-columns:repeat(2,minmax(100px,1fr));gap:10px;}
@media (min-width:520px){.ktc-grid{grid-template-columns:repeat(3,minmax(100px,1fr));}}
.ktc-card{background:#fff;border-radius:16px;padding:8px;box-shadow:0 3px 8px rgba(160,110,40,.18);
  display:flex;flex-direction:column;align-items:center;gap:4px;min-height:132px;text-align:center;}
.ktc-card .ktc-thumb{width:100%;min-height:100px;border-radius:12px;display:flex;align-items:center;
  justify-content:center;font-size:44px;background:linear-gradient(#fff4e2,#ffe9f1);}
.ktc-card.ktc-locked .ktc-thumb{filter:grayscale(1);opacity:.45;}
.ktc-cardname{font-size:13px;font-weight:900;color:#7a5320;}
.ktc-cardnote{font-size:12px;font-weight:700;color:#8a7a6a;line-height:1.4;}

@media (max-width:420px){
  .ktc-bubble{font-size:17px;padding:7px 12px;}
  .ktc-btn{min-width:70px;min-height:58px;font-size:26px;padding:5px 8px;}
  .ktc-btn small{font-size:11px;}
  .ktc-cats{gap:6px;}
}
@media (prefers-reduced-motion:reduce){
  .ktc-body,.ktc-head,.ktc-tail-wrap,.ktc-cat.ktc-nod .ktc-head,.ktc-cat.ktc-tilt .ktc-head,
  .ktc-heart,.ktc-foam.ktc-pop{animation:none;}
  .ktc-heart{display:none;}
  .ktc-cat,.ktc-moodfill,.ktc-coverfill,.ktc-target{transition:none;}
}
`;
