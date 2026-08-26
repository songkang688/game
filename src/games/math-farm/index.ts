import { meta } from "./meta";
export { meta };

import guide from "./guide";
import { mountLevelGame, type GameApi } from "../level99";
import { CHAPTERS } from "./levels";
import { playFarmLevel } from "./runner";

export function mount(api: GameApi): { destroy: () => void } {
  return mountLevelGame(api, {
    id: meta.id,
    chapters: CHAPTERS,
    guide,
    mapHint: "从牧场数数出发，一路算到括号谷仓～",
    grandMessage: "188 关全部通关，你是真正的算数小能手！",
    playLevel: playFarmLevel,
  });
}
