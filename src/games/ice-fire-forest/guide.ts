/**
 * 冰冰火火森林 · 攻略入口。
 *
 * 这一款的攻略正文和关卡数据放在一起(`levels.ts` 的 `GUIDE`),index.ts 直接用的就是它。
 * 这里只做一层转发,让 `src/ui/guide.ts` 的 `src/games/<id>/guide.ts` 懒加载约定
 * 对每一款游戏都成立,免得同一份文字抄两遍、改一处漏一处。
 */
import { GUIDE } from "./levels";

export default GUIDE;
