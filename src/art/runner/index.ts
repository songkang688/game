/**
 * 1.3 第 1 步 C · 跑酷 / 跑道类伪 3D 观感套件的汇总出口。
 *
 * 用法(将来第 9 / 11 / 15 / 22 / 23 步的游戏这样接):
 *   import { drawSky, drawTrack, drawAtDepth, sortByDepth, makeSpeedLines, cameraNudge } from "../../art/runner";
 * 一帧的画序:drawSky → drawTrack → sortByDepth 后逐个 drawAtDepth → drawSpeedLines,
 * 镜头微动用 cameraNudge 的返回值在最外层 translate / rotate。
 * 透视数学全部来自 src/engine/view25d,本套件只做观感层。
 */
export * from "./track";
export * from "./sky";
export * from "./sprites";
export * from "./speedfx";
