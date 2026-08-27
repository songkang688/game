/**
 * 画布类游戏共用的 DOM 桩转口。
 *
 * `rainbow-run` 自己没带 domStub（它原有的单测只测纯逻辑模块），
 * 而 `ocean-munch/domStub.ts` 那一份本来就与玩法无关：canvas + window 监听 +
 * rAF + localStorage + `location.search` + `matchMedia`，正好是纯画布游戏要的全套。
 * 这里只做转口，不复制一份，免得两处规则漂移。
 */
export * from "../games/ocean-munch/domStub";
