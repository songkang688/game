/**
 * N-86 勇者小路大厅：915×412 上第二行 `.bvp-mode` 切底。
 * 只服务选玩法屏（`.bvp-lobby`）。无尽战斗三钮仍走 `.bvp-endless-fight`（N-32），本文件零触碰。
 */

/** 大厅四张模式卡（闯关/无尽/对战/备战） */
export const BVP_MODE_CSS = `
.bvp-modes{display:grid;grid-template-columns:1fr;gap:10px;}
@media(min-width:560px){.bvp-modes{grid-template-columns:1fr 1fr;}}
.bvp-mode{border:none;border-radius:18px;padding:15px;text-align:left;cursor:pointer;font-family:inherit;
  display:flex;gap:12px;align-items:flex-start;box-shadow:0 4px 12px rgba(140,120,190,.18);color:var(--bvp-ink);}
.bvp-mode:active{transform:translateY(2px);}
.bvp-mode-em{font-size:34px;line-height:1;flex:0 0 auto;}
.bvp-mode-t{font-size:17px;font-weight:900;display:block;margin-bottom:3px;}
.bvp-mode-d{font-size:13px;font-weight:700;color:var(--bvp-soft);line-height:1.55;display:block;}
`;

/** 矮横屏：介绍卡收高、模式卡 min-height 44、描述单行。不改战斗/胜负。 */
export const BVP_LOBBY_SHORT_CSS = `
@media (max-height:500px){
  .bvp-lobby .bvp-card{padding:8px 10px;margin-bottom:6px;}
  .bvp-lobby .bvp-h{margin:0 0 4px;font-size:16px;}
  .bvp-lobby .bvp-sub{max-height:1.4em;overflow:hidden;}
  .bvp-lobby .bvp-hero-line{gap:6px;margin-top:4px !important;}
  .bvp-lobby .bvp-chip{padding:4px 8px;}
  .bvp-lobby .bvp-modes{gap:6px;}
  .bvp-lobby .bvp-mode{padding:8px 10px;gap:8px;align-items:center;min-height:44px;min-width:0;}
  .bvp-lobby .bvp-mode-em{font-size:22px;}
  /* r18:nowrap 描述的 min-content 会把 1fr 轨撑到 960px、右列溢出 1104;
     网格项 + 文字列都放开 min-width,描述才真正省略而不是把卡推出屏 */
  .bvp-lobby .bvp-row-main{min-width:0;flex:1 1 auto;overflow:hidden;}
  .bvp-lobby .bvp-mode-t{font-size:15px;margin-bottom:0;}
  .bvp-lobby .bvp-mode-d{max-height:1.35em;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}
}
@media (max-height:840px) and (min-height:501px){
  .bvp-lobby .bvp-mode{min-height:44px;padding:10px 12px;}
}
`;

export const BVP_LOBBY_CSS = `${BVP_MODE_CSS}${BVP_LOBBY_SHORT_CSS}`;

/**
 * 两行网格下，第二行底边。修前实测 header 底约 211、卡高 116、gap 10 → 453。
 * 修后卡高按 44 热区 + 单行字估算。
 */
export function lobbySecondRowBottom(headerBottom: number, cardH: number, gap: number): number {
  return headerBottom + cardH + gap + cardH;
}
