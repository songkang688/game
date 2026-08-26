/**
 * 涂色小屋 · 1.2 追加的六幅线稿（小船 / 蝴蝶 / 城堡 / 火箭 / 大树 / 小猫）。
 *
 * 全部手写内联 SVG，只用 rect / circle / ellipse / polygon 这几种能算得准的形状，
 * 不引任何图片文件、不外链任何素材。造型全部原创，画的是朵朵和星星身边的东西。
 *
 * 画法上守两条老规矩（1.1 的用例会逐条查）：
 *  1. 每一块都要留出「露在外面点得到」的地方，不能被后画的形状整块盖住；
 *  2. `lx` / `ly` 是编号与图例符号落笔的点，必须落在自己形状里，也不能被后画的盖住。
 *
 * 区域数从 9 到 18 递增，后段章节挑块数多的那几幅用。
 */
import type { Picture } from "./levels";

/** 顺手画一颗五角星（`cx`/`cy` 中心，`r` 外接半径） */
function star(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.42;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(" ")}"/>`;
}

/** 小船（9 块）——最简单的一幅，给前段的关用 */
const BOAT: Picture = {
  name: "远航小船",
  emoji: "⛵",
  regions: [
    { id: "btsky", name: "天空", svg: `<rect x="0" y="0" width="400" height="150" rx="6"/>`, lx: 200, ly: 30 },
    { id: "btsea", name: "海面", svg: `<rect x="0" y="150" width="400" height="150" rx="6"/>`, lx: 40, ly: 280 },
    { id: "btsun", name: "太阳", svg: `<circle cx="340" cy="48" r="26"/>`, lx: 340, ly: 54 },
    { id: "btcloud", name: "云朵", svg: `<ellipse cx="96" cy="52" rx="44" ry="18"/>`, lx: 96, ly: 58 },
    { id: "bthull", name: "船身", svg: `<polygon points="110,214 290,214 258,262 142,262"/>`, lx: 200, ly: 240 },
    { id: "btmast", name: "桅杆", svg: `<rect x="196" y="96" width="10" height="118"/>`, lx: 201, ly: 180 },
    { id: "btsailbig", name: "大帆", svg: `<polygon points="196,104 196,200 118,200"/>`, lx: 160, ly: 185 },
    { id: "btsailsmall", name: "小帆", svg: `<polygon points="206,120 206,200 272,200"/>`, lx: 232, ly: 188 },
    { id: "btflag", name: "旗子", svg: `<polygon points="206,96 250,106 206,116"/>`, lx: 218, ly: 106 },
  ],
};

/** 蝴蝶（11 块）——左右对称，讲互补配色时特别好看 */
const BUTTERFLY: Picture = {
  name: "花间蝴蝶",
  emoji: "🦋",
  regions: [
    { id: "bfsky", name: "背景", svg: `<rect x="0" y="0" width="400" height="300" rx="6"/>`, lx: 30, ly: 285 },
    { id: "bfwinglu", name: "左上翅", svg: `<ellipse cx="140" cy="110" rx="62" ry="54"/>`, lx: 110, ly: 80 },
    { id: "bfwingru", name: "右上翅", svg: `<ellipse cx="260" cy="110" rx="62" ry="54"/>`, lx: 290, ly: 80 },
    { id: "bfwingld", name: "左下翅", svg: `<ellipse cx="152" cy="200" rx="48" ry="44"/>`, lx: 138, ly: 206 },
    { id: "bfwingrd", name: "右下翅", svg: `<ellipse cx="248" cy="200" rx="48" ry="44"/>`, lx: 262, ly: 206 },
    { id: "bfbody", name: "身体", svg: `<rect x="192" y="86" width="16" height="136" rx="8"/>`, lx: 200, ly: 160 },
    { id: "bfhead", name: "小脑袋", svg: `<circle cx="200" cy="76" r="17"/>`, lx: 200, ly: 80 },
    { id: "bfantl", name: "左触角", svg: `<polygon points="192,64 168,34 176,30 199,60"/>`, lx: 184, ly: 47 },
    { id: "bfantr", name: "右触角", svg: `<polygon points="208,64 232,34 224,30 201,60"/>`, lx: 216, ly: 47 },
    { id: "bfspotl", name: "左翅斑点", svg: `<circle cx="132" cy="104" r="16"/>`, lx: 132, ly: 109 },
    { id: "bfspotr", name: "右翅斑点", svg: `<circle cx="268" cy="104" r="16"/>`, lx: 268, ly: 109 },
  ],
};

/** 城堡（15 块）——块多、层次多，给图例大画布用 */
const CASTLE: Picture = {
  name: "云端城堡",
  emoji: "🏰",
  regions: [
    { id: "cssky", name: "天空", svg: `<rect x="0" y="0" width="400" height="190" rx="6"/>`, lx: 30, ly: 30 },
    { id: "cssun", name: "太阳", svg: `<circle cx="344" cy="48" r="24"/>`, lx: 344, ly: 54 },
    { id: "cshill", name: "草坡", svg: `<rect x="0" y="190" width="400" height="50"/>`, lx: 30, ly: 215 },
    { id: "csground", name: "地面", svg: `<rect x="0" y="240" width="400" height="60" rx="6"/>`, lx: 30, ly: 280 },
    { id: "cswall", name: "城墙", svg: `<rect x="110" y="150" width="180" height="90"/>`, lx: 128, ly: 230 },
    { id: "cstowerl", name: "左塔", svg: `<rect x="64" y="118" width="52" height="122"/>`, lx: 90, ly: 232 },
    { id: "cstowerr", name: "右塔", svg: `<rect x="284" y="118" width="52" height="122"/>`, lx: 310, ly: 232 },
    { id: "cstowerm", name: "中塔", svg: `<rect x="176" y="96" width="48" height="54"/>`, lx: 200, ly: 140 },
    { id: "csroofl", name: "左塔顶", svg: `<polygon points="58,120 122,120 90,72"/>`, lx: 90, ly: 106 },
    { id: "csroofr", name: "右塔顶", svg: `<polygon points="278,120 342,120 310,72"/>`, lx: 310, ly: 106 },
    { id: "csroofm", name: "中塔顶", svg: `<polygon points="170,98 230,98 200,44"/>`, lx: 200, ly: 84 },
    { id: "csgate", name: "城门", svg: `<rect x="176" y="186" width="48" height="54" rx="6"/>`, lx: 200, ly: 214 },
    { id: "cswinl", name: "左窗", svg: `<circle cx="140" cy="176" r="13"/>`, lx: 140, ly: 181 },
    { id: "cswinr", name: "右窗", svg: `<circle cx="260" cy="176" r="13"/>`, lx: 260, ly: 181 },
    { id: "csflag", name: "塔尖旗", svg: `<polygon points="200,42 240,54 200,66"/>`, lx: 212, ly: 54 },
  ],
};

/** 火箭（13 块）——和 1.0 星光火箭城那一幅不是同一个造型，这一幅带行星环与月亮 */
const ROCKET: Picture = {
  name: "夜航火箭",
  emoji: "🚀",
  regions: [
    { id: "rksky", name: "夜空", svg: `<rect x="0" y="0" width="400" height="300" rx="6"/>`, lx: 28, ly: 150 },
    { id: "rkplanet", name: "行星", svg: `<circle cx="72" cy="76" r="30"/>`, lx: 72, ly: 58 },
    { id: "rkring", name: "行星环", svg: `<ellipse cx="72" cy="86" rx="48" ry="11"/>`, lx: 114, ly: 88 },
    { id: "rkmoon", name: "月亮", svg: `<circle cx="340" cy="170" r="26"/>`, lx: 340, ly: 176 },
    { id: "rkstar1", name: "大星星", svg: star(330, 60, 24), lx: 330, ly: 62 },
    { id: "rkstar2", name: "小星星", svg: star(300, 232, 18), lx: 300, ly: 234 },
    { id: "rkbody", name: "箭身", svg: `<rect x="170" y="90" width="60" height="120" rx="10"/>`, lx: 185, ly: 205 },
    { id: "rknose", name: "箭头", svg: `<polygon points="170,92 230,92 200,26"/>`, lx: 200, ly: 74 },
    { id: "rkfinl", name: "左尾翼", svg: `<polygon points="170,150 170,214 136,224"/>`, lx: 160, ly: 196 },
    { id: "rkfinr", name: "右尾翼", svg: `<polygon points="230,150 230,214 264,224"/>`, lx: 240, ly: 196 },
    { id: "rkflame", name: "尾焰", svg: `<polygon points="176,210 224,210 200,262"/>`, lx: 200, ly: 226 },
    { id: "rkstripe", name: "腰带", svg: `<rect x="170" y="170" width="60" height="18"/>`, lx: 200, ly: 182 },
    { id: "rkwin", name: "舷窗", svg: `<circle cx="200" cy="124" r="19"/>`, lx: 200, ly: 129 },
  ],
};

/** 大树（12 块）——三团树冠分深浅，渐变章最合适 */
const TREE: Picture = {
  name: "四季大树",
  emoji: "🌳",
  regions: [
    { id: "trsky", name: "天空", svg: `<rect x="0" y="0" width="400" height="300" rx="6"/>`, lx: 30, ly: 40 },
    { id: "trground", name: "草地", svg: `<rect x="0" y="236" width="400" height="64" rx="6"/>`, lx: 30, ly: 282 },
    { id: "trcrown1", name: "大树冠", svg: `<circle cx="200" cy="108" r="78"/>`, lx: 200, ly: 50 },
    { id: "trcrown2", name: "左树冠", svg: `<circle cx="126" cy="140" r="46"/>`, lx: 104, ly: 150 },
    { id: "trcrown3", name: "右树冠", svg: `<circle cx="274" cy="140" r="46"/>`, lx: 296, ly: 150 },
    { id: "trtrunk", name: "树干", svg: `<rect x="182" y="140" width="36" height="100"/>`, lx: 200, ly: 228 },
    { id: "trapple1", name: "红果子", svg: `<circle cx="164" cy="88" r="14"/>`, lx: 164, ly: 93 },
    { id: "trapple2", name: "小果子", svg: `<circle cx="238" cy="124" r="14"/>`, lx: 238, ly: 129 },
    { id: "trapple3", name: "青果子", svg: `<circle cx="128" cy="104" r="14"/>`, lx: 128, ly: 109 },
    { id: "trhole", name: "树洞", svg: `<ellipse cx="200" cy="192" rx="14" ry="18"/>`, lx: 200, ly: 197 },
    { id: "trbird", name: "小鸟", svg: `<ellipse cx="318" cy="196" rx="22" ry="14"/>`, lx: 318, ly: 201 },
    { id: "trflower", name: "小花", svg: `<circle cx="64" cy="252" r="15"/>`, lx: 64, ly: 257 },
  ],
};

/** 小猫（18 块）——块数最多的一幅，留给最后几章 */
const CAT: Picture = {
  name: "打盹小猫",
  emoji: "🐱",
  regions: [
    { id: "ctsky", name: "背景", svg: `<rect x="0" y="0" width="400" height="300" rx="6"/>`, lx: 26, ly: 26 },
    { id: "ctfloor", name: "地毯", svg: `<rect x="0" y="244" width="400" height="56" rx="6"/>`, lx: 30, ly: 286 },
    { id: "cttail", name: "尾巴", svg: `<ellipse cx="300" cy="222" rx="52" ry="14"/>`, lx: 338, ly: 224 },
    { id: "ctbody", name: "身体", svg: `<ellipse cx="200" cy="214" rx="84" ry="62"/>`, lx: 130, ly: 214 },
    { id: "ctbelly", name: "肚皮", svg: `<ellipse cx="200" cy="232" rx="48" ry="36"/>`, lx: 200, ly: 238 },
    { id: "ctlegl", name: "左前爪", svg: `<rect x="142" y="250" width="30" height="34" rx="8"/>`, lx: 157, ly: 270 },
    { id: "ctlegr", name: "右前爪", svg: `<rect x="228" y="250" width="30" height="34" rx="8"/>`, lx: 243, ly: 270 },
    { id: "ctearl", name: "左耳", svg: `<polygon points="146,74 176,30 190,80"/>`, lx: 168, ly: 50 },
    { id: "ctearr", name: "右耳", svg: `<polygon points="254,74 224,30 210,80"/>`, lx: 232, ly: 50 },
    { id: "cthead", name: "脑袋", svg: `<circle cx="200" cy="110" r="62"/>`, lx: 200, ly: 150 },
    { id: "ctearinl", name: "左耳窝", svg: `<polygon points="158,72 177,44 186,76"/>`, lx: 174, ly: 66 },
    { id: "ctearinr", name: "右耳窝", svg: `<polygon points="242,72 223,44 214,76"/>`, lx: 226, ly: 66 },
    { id: "cteyel", name: "左眼", svg: `<circle cx="176" cy="106" r="13"/>`, lx: 176, ly: 111 },
    { id: "cteyer", name: "右眼", svg: `<circle cx="224" cy="106" r="13"/>`, lx: 224, ly: 111 },
    { id: "ctnose", name: "鼻子", svg: `<polygon points="192,132 208,132 200,144"/>`, lx: 200, ly: 137 },
    { id: "ctcollar", name: "项圈", svg: `<rect x="166" y="166" width="68" height="16" rx="6"/>`, lx: 176, ly: 174 },
    { id: "ctbell", name: "小铃铛", svg: `<circle cx="200" cy="188" r="12"/>`, lx: 200, ly: 193 },
    { id: "ctball", name: "毛线球", svg: `<circle cx="76" cy="252" r="26"/>`, lx: 76, ly: 258 },
  ],
};

/** 1.2 追加的六幅，按区域数由少到多排 */
export const EXTRA_PICTURES: Picture[] = [BOAT, BUTTERFLY, TREE, ROCKET, CASTLE, CAT];
