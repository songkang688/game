import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi } from "../level99";
import guide from "./guide";
import { CHAPTERS } from "./levels";
import { playClockLevel } from "./runner";

export function mount(api: GameApi): { destroy: () => void } {
  return mountLevelGame(api, {
    id: meta.id,
    chapters: CHAPTERS,
    guide,
    mapHint: "滴答滴答，一层一层爬上时钟小屋，顶楼还有时刻表和作息表要读～",
    grandMessage: "188 关全部通关，你是时间小管家！",
    playLevel: playClockLevel,
  });
}
