// 识字小花园：常见字出题纯逻辑（三座主题花园 + 错题本）

export type WordCard = {
  char: string;
  pinyin: string;
  /** 帮助理解的词语，例如「太阳」 */
  word: string;
  emoji: string;
  /**
   * 1.2 追加：一句话说清这个字是什么意思。
   * 只进数据、不进题面 —— 前 99 关的题目一个字都不会因为它而改变。
   */
  meaning: string;
};

export type WordLevel = {
  name: string;
  desc: string;
  emoji: string;
  cards: WordCard[];
};

export const WORD_LEVELS: WordLevel[] = [
  {
    name: "青青花园",
    desc: "自然天地",
    emoji: "🌿",
    cards: [
      { char: "日", pinyin: "rì", word: "太阳", emoji: "☀️", meaning: "天上发光发热的那个大圆球，也指一整天" },
      { char: "月", pinyin: "yuè", word: "月亮", emoji: "🌙", meaning: "夜里挂在空中、会圆会缺的那个" },
      { char: "水", pinyin: "shuǐ", word: "水滴", emoji: "💧", meaning: "会流动、能喝的那种东西，河里海里都是它" },
      { char: "火", pinyin: "huǒ", word: "火苗", emoji: "🔥", meaning: "烧起来又亮又烫的那个东西" },
      { char: "山", pinyin: "shān", word: "大山", emoji: "⛰️", meaning: "地面上高高鼓起来的一大块" },
      { char: "田", pinyin: "tián", word: "田地", emoji: "🌾", meaning: "种庄稼的一块块地" },
      { char: "木", pinyin: "mù", word: "树木", emoji: "🌳", meaning: "树，也指做家具用的那种材料" },
      { char: "花", pinyin: "huā", word: "花朵", emoji: "🌸", meaning: "植物开出来的漂亮东西，常有香味" },
      { char: "云", pinyin: "yún", word: "白云", emoji: "☁️", meaning: "空中一团一团白白的，会飘会变" },
      { char: "雨", pinyin: "yǔ", word: "下雨", emoji: "🌧️", meaning: "从空中落下来的一滴一滴，会打湿地面" },
      { char: "雪", pinyin: "xuě", word: "雪花", emoji: "❄️", meaning: "冬季飘下来的白色小片片，落地会化" },
      { char: "星", pinyin: "xīng", word: "星星", emoji: "⭐", meaning: "夜空里一闪一闪的小亮点" },
      { char: "电", pinyin: "diàn", word: "闪电", emoji: "⚡", meaning: "插上插头才有的那股力量，能让屋里亮起来" },
      { char: "风", pinyin: "fēng", word: "大风", emoji: "🌬️", meaning: "看不见、能把树枝吹弯的那股气" },
      { char: "天", pinyin: "tiān", word: "天空", emoji: "🌤️", meaning: "头顶上蓝蓝的一大片，也指一昼夜" },
      { char: "叶", pinyin: "yè", word: "树叶", emoji: "🍃", meaning: "长在树枝上的绿片片" },
      { char: "草", pinyin: "cǎo", word: "小草", emoji: "🌱", meaning: "地上矮矮绿绿的一片，春季会返青" },
      { char: "竹", pinyin: "zhú", word: "竹子", emoji: "🎋", meaning: "一节一节、里面是空的，熊猫爱吃" },
    ],
  },
  {
    name: "萌萌花园",
    desc: "动物朋友",
    emoji: "🐾",
    cards: [
      { char: "鸟", pinyin: "niǎo", word: "小鸟", emoji: "🐦", meaning: "长羽毛、会飞会唱歌的动物" },
      { char: "鱼", pinyin: "yú", word: "小鱼", emoji: "🐟", meaning: "在河里海里游、用鳃呼吸的动物" },
      { char: "虫", pinyin: "chóng", word: "虫子", emoji: "🐛", meaning: "小小的爬着走的，蚂蚁蝴蝶都算" },
      { char: "牛", pinyin: "niú", word: "小牛", emoji: "🐮", meaning: "有角、力气大、会耕地的大牲口" },
      { char: "羊", pinyin: "yáng", word: "小羊", emoji: "🐑", meaning: "身上长白毛、咩咩叫的家畜" },
      { char: "马", pinyin: "mǎ", word: "小马", emoji: "🐴", meaning: "跑得飞快、能骑上去的大动物" },
      { char: "狗", pinyin: "gǒu", word: "小狗", emoji: "🐶", meaning: "会看家、见到主人就摇尾巴的" },
      { char: "猫", pinyin: "māo", word: "小猫", emoji: "🐱", meaning: "会抓老鼠、走路没有声音的" },
      { char: "兔", pinyin: "tù", word: "兔子", emoji: "🐰", meaning: "蹦蹦跳跳、三瓣嘴、爱吃萝卜的小动物" },
      { char: "猪", pinyin: "zhū", word: "小猪", emoji: "🐷", meaning: "鼻子圆圆、爱睡觉的家畜" },
      { char: "鸡", pinyin: "jī", word: "小鸡", emoji: "🐔", meaning: "清早会打鸣、咯咯叫的家禽" },
      { char: "鸭", pinyin: "yā", word: "鸭子", emoji: "🦆", meaning: "扁嘴巴、脚上有蹼、嘎嘎叫的家禽" },
      { char: "龟", pinyin: "guī", word: "乌龟", emoji: "🐢", meaning: "背着硬壳、爬得很慢的动物" },
      { char: "熊", pinyin: "xióng", word: "小熊", emoji: "🐻", meaning: "个子大、力气大、毛茸茸的猛兽" },
      { char: "象", pinyin: "xiàng", word: "大象", emoji: "🐘", meaning: "鼻子长长、身子最大的陆地动物" },
      { char: "虎", pinyin: "hǔ", word: "老虎", emoji: "🐯", meaning: "身上有条纹、很威风的猛兽" },
      { char: "蛙", pinyin: "wā", word: "青蛙", emoji: "🐸", meaning: "会跳、呱呱叫、住在池塘边的" },
      { char: "鹅", pinyin: "é", word: "白鹅", emoji: "🦢", meaning: "脖子长长、走起路来一摇一摆的家禽" },
    ],
  },
  {
    name: "星星花园",
    desc: "身体和宝贝",
    emoji: "✨",
    cards: [
      { char: "手", pinyin: "shǒu", word: "小手", emoji: "✋", meaning: "身体上用来拿东西、写字的那部分" },
      { char: "口", pinyin: "kǒu", word: "嘴巴", emoji: "👄", meaning: "吃饭说话的那个地方" },
      { char: "耳", pinyin: "ěr", word: "耳朵", emoji: "👂", meaning: "长在头两侧、用来听声音的" },
      { char: "目", pinyin: "mù", word: "眼睛", emoji: "👀", meaning: "用来看东西的，一眨一眨" },
      { char: "足", pinyin: "zú", word: "小脚", emoji: "🦶", meaning: "走路跑步靠它，长在腿下面" },
      { char: "牙", pinyin: "yá", word: "牙齿", emoji: "🦷", meaning: "嘴里白白硬硬、用来咬东西的" },
      { char: "心", pinyin: "xīn", word: "爱心", emoji: "❤️", meaning: "胸口会怦怦跳的那个器官" },
      { char: "人", pinyin: "rén", word: "人儿", emoji: "🧍", meaning: "会说话、会思考的这一类，男女老少都算" },
      { char: "门", pinyin: "mén", word: "大门", emoji: "🚪", meaning: "屋子上能开能关、进出走的那个" },
      { char: "车", pinyin: "chē", word: "汽车", emoji: "🚗", meaning: "有轮子、能载着大家跑的" },
      { char: "船", pinyin: "chuán", word: "小船", emoji: "⛵", meaning: "在河上海上走的交通工具" },
      { char: "伞", pinyin: "sǎn", word: "雨伞", emoji: "☂️", meaning: "圆圆一把，撑开来能遮头顶" },
      { char: "书", pinyin: "shū", word: "书本", emoji: "📖", meaning: "一页一页装订起来、用来读的" },
      { char: "笔", pinyin: "bǐ", word: "铅笔", emoji: "✏️", meaning: "握在指间写字画画的细长东西" },
      { char: "灯", pinyin: "dēng", word: "灯泡", emoji: "💡", meaning: "夜里打开、能照亮屋子的" },
      { char: "球", pinyin: "qiú", word: "皮球", emoji: "⚽", meaning: "圆圆的，能拍能踢能滚" },
      { char: "果", pinyin: "guǒ", word: "果子", emoji: "🍎", meaning: "树上结的，能吃，有的甜有的酸" },
      { char: "米", pinyin: "mǐ", word: "大米", emoji: "🍚", meaning: "白白一粒粒，煮熟就是饭" },
    ],
  },
];

export const WORD_BANK: WordCard[] = WORD_LEVELS.flatMap((l) => l.cards);

export type WordQuestion = {
  target: WordCard;
  /** 三个候选字卡（含正确的），已打乱 */
  choices: WordCard[];
  answerIndex: number;
};

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

/**
 * 从指定字卡池里出一道「看图选字」题。
 * @param pool 本关可出题的字卡池（至少 3 张）
 * @param exclude 最近用过 / 已答对的字，尽量不重复出题
 */
export function makeQuestionFrom(
  pool: WordCard[],
  rand: () => number = Math.random,
  exclude: string[] = []
): WordQuestion {
  const fresh = pool.filter((c) => !exclude.includes(c.char));
  const candidates = fresh.length > 0 ? fresh : pool;
  const target = pick(candidates, rand);

  const others = pool.filter((c) => c.char !== target.char);
  const distractors: WordCard[] = [];
  while (distractors.length < 2) {
    const d = pick(others, rand);
    if (!distractors.includes(d)) distractors.push(d);
  }

  const choices = [target, ...distractors];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { target, choices, answerIndex: choices.indexOf(target) };
}

/** 从全部字库出一道题（兼容旧接口）。 */
export function makeWordQuestion(rand: () => number = Math.random, exclude: string[] = []): WordQuestion {
  return makeQuestionFrom(WORD_BANK, rand, exclude);
}

// ===========================================================================
// 1.1 追加：第 100–188 关的高年级字词库
// 形近字 / 成语 / 近反义 / 句子填空 / 偏旁部首 / 两步组字
// 以下全部是新增内容，前 99 关的字库与出题函数一个字都没动。
// ===========================================================================

/**
 * 形近字：长得像，但意思和用法差得远。
 *
 * 1.2 起每一组都补到 **至少 3 个字**，出题时三个选项全部从组内取 ——
 * 1.1 的 20 组里有 19 组只有 2 个字，第三个选项只能从全表随机抓，
 * 常常凑出「拨 / 拔 / 象」这种毫不相干的三选一。
 *
 * 组内两两之间必须「共享部件」或「笔画数只差一笔」，这两条都写进了数据：
 * `parts` 列出这个字拆得出的部件（形近全靠某一笔时就写那一笔的名字），
 * `strokes` 是笔画数，`bank.test.ts` 会逐组两两反查。
 *
 * 1.1 的「戴 / 带」是**同音**不是形近，一个部件都不共享，这里拆成
 * 「戴 / 栽 / 裁」（共享 𢦏）与「带 / 帮 / 常」（共享 巾）两组。
 */
export interface LookalikeItem {
  char: string;
  /** 只有这个字才组得成的词 */
  word: string;
  /**
   * 一句话说清它的意思。**一个字都不许和 `char` 重复**——提示里带上答案字，
   * 孩子不认得这一组形近字也能照着抄回去（1.2 窗口5 修的 W5-F-03）。
   * 和字卡那边「释义不抄答案字」是同一条规矩，`noSpoiler.test.ts` 钉着。
   */
  hint: string;
  /** 拆得出的部件；形近全靠某一笔时写那一笔的名字 */
  parts: string[];
  /** 笔画数 */
  strokes: number;
}

export const LOOKALIKE_SETS: LookalikeItem[][] = [
  [
    { char: "己", word: "自己", hint: "说的是自个儿", parts: ["横折", "竖弯钩"], strokes: 3 },
    { char: "已", word: "已经", hint: "事情做完了", parts: ["横折", "竖弯钩"], strokes: 3 },
    { char: "巴", word: "尾巴", hint: "小动物身后甩来甩去的", parts: ["横折", "竖弯钩"], strokes: 4 },
  ],
  [
    { char: "未", word: "未来", hint: "还没到的日子", parts: ["木"], strokes: 5 },
    { char: "末", word: "周末", hint: "一段时间的尾巴", parts: ["木"], strokes: 5 },
    { char: "术", word: "美术", hint: "画画做手工那门课", parts: ["木"], strokes: 5 },
  ],
  [
    { char: "干", word: "干净", hint: "一点脏东西都没有", parts: ["十"], strokes: 3 },
    { char: "千", word: "千米", hint: "十个百那么多", parts: ["十"], strokes: 3 },
    { char: "午", word: "中午", hint: "一天里太阳最高的时候", parts: ["十"], strokes: 4 },
  ],
  [
    { char: "乌", word: "乌云", hint: "黑压压的云", parts: ["竖折折钩"], strokes: 4 },
    { char: "鸟", word: "小鸟", hint: "会飞会唱歌", parts: ["竖折折钩"], strokes: 5 },
    { char: "马", word: "小马", hint: "跑得飞快能骑的", parts: ["竖折折钩"], strokes: 3 },
  ],
  [
    { char: "免", word: "免费", hint: "不用花钱", parts: ["儿"], strokes: 7 },
    { char: "兔", word: "兔子", hint: "长耳朵爱吃草", parts: ["儿"], strokes: 8 },
    { char: "先", word: "先后", hint: "排在前头的那个", parts: ["儿"], strokes: 6 },
  ],
  [
    { char: "辨", word: "分辨", hint: "把两样东西分清楚", parts: ["辡"], strokes: 16 },
    { char: "辩", word: "争辩", hint: "用话讲道理", parts: ["辡"], strokes: 16 },
    { char: "辫", word: "辫子", hint: "头发编成的", parts: ["辡"], strokes: 17 },
  ],
  [
    { char: "蓝", word: "蓝色", hint: "天空的颜色", parts: ["艹", "监", "皿"], strokes: 13 },
    { char: "篮", word: "篮球", hint: "竹字头，装东西的筐", parts: ["𥫗", "监", "皿"], strokes: 16 },
    { char: "盐", word: "食盐", hint: "做菜时放的咸味调料", parts: ["土", "皿"], strokes: 10 },
  ],
  [
    { char: "密", word: "秘密", hint: "藏起来不说的事", parts: ["宀", "必"], strokes: 11 },
    { char: "蜜", word: "蜂蜜", hint: "甜甜的，虫字底", parts: ["宀", "必", "虫"], strokes: 14 },
    { char: "秘", word: "神秘", hint: "猜不透说不清的", parts: ["禾", "必"], strokes: 10 },
  ],
  [
    { char: "燥", word: "干燥", hint: "一点水分都没有", parts: ["火", "喿"], strokes: 17 },
    { char: "躁", word: "急躁", hint: "心里静不下来", parts: ["足", "喿"], strokes: 20 },
    { char: "操", word: "操场", hint: "学校里上体育课的空地", parts: ["扌", "喿"], strokes: 16 },
  ],
  [
    { char: "键", word: "键盘", hint: "一个一个按下去", parts: ["钅", "建"], strokes: 13 },
    { char: "健", word: "健康", hint: "身体结实有力气", parts: ["亻", "建"], strokes: 10 },
    { char: "建", word: "建房", hint: "一砖一瓦盖起来", parts: ["建"], strokes: 8 },
  ],
  [
    { char: "副", word: "副手", hint: "在旁边帮忙的", parts: ["畐", "刂"], strokes: 11 },
    { char: "幅", word: "一幅画", hint: "数画用的量词", parts: ["巾", "畐"], strokes: 12 },
    { char: "富", word: "丰富", hint: "东西多得用不完", parts: ["宀", "畐"], strokes: 12 },
  ],
  [
    { char: "陪", word: "陪伴", hint: "在身边一起走", parts: ["阝", "咅"], strokes: 10 },
    { char: "赔", word: "赔礼", hint: "做错事去道歉", parts: ["贝", "咅"], strokes: 12 },
    { char: "培", word: "培养", hint: "慢慢教慢慢养成", parts: ["土", "咅"], strokes: 11 },
  ],
  [
    { char: "拨", word: "拨动", hint: "用手轻轻一推", parts: ["扌", "发"], strokes: 8 },
    { char: "拔", word: "拔草", hint: "用力往上抽出来", parts: ["扌", "犮"], strokes: 8 },
    { char: "披", word: "披上", hint: "把衣服搭在肩膀上", parts: ["扌", "皮"], strokes: 8 },
  ],
  [
    { char: "竟", word: "究竟", hint: "到底是怎么回事", parts: ["立", "儿"], strokes: 11 },
    { char: "竞", word: "竞赛", hint: "大家比一比", parts: ["立", "儿"], strokes: 10 },
    { char: "章", word: "文章", hint: "一篇写好的话", parts: ["立", "早"], strokes: 11 },
  ],
  [
    { char: "即", word: "立即", hint: "马上就做", parts: ["皀", "卩"], strokes: 7 },
    { char: "既", word: "既然", hint: "承接上一句话", parts: ["皀", "旡"], strokes: 9 },
    { char: "概", word: "大概", hint: "差不多说个大数", parts: ["木", "皀", "旡"], strokes: 13 },
  ],
  [
    { char: "戴", word: "戴帽子", hint: "往头上身上套", parts: ["𢦏", "异"], strokes: 17 },
    { char: "栽", word: "栽树", hint: "把小树苗种进土里", parts: ["𢦏", "木"], strokes: 10 },
    { char: "裁", word: "裁纸", hint: "用剪刀把纸剪开", parts: ["𢦏", "衣"], strokes: 12 },
  ],
  [
    { char: "带", word: "带上", hint: "随身拿着走", parts: ["巾"], strokes: 9 },
    { char: "帮", word: "帮忙", hint: "搭把手出份力", parts: ["巾", "邦"], strokes: 9 },
    { char: "常", word: "平常", hint: "天天都这样，不稀奇", parts: ["巾", "尚"], strokes: 11 },
  ],
  [
    { char: "象", word: "大象", hint: "鼻子长长的动物", parts: ["象"], strokes: 11 },
    { char: "像", word: "好像", hint: "看着很相似", parts: ["亻", "象"], strokes: 13 },
    { char: "橡", word: "橡皮", hint: "写错字了用它擦", parts: ["木", "象"], strokes: 15 },
  ],
  [
    { char: "座", word: "座位", hint: "坐的那个地方", parts: ["广", "坐"], strokes: 10 },
    { char: "坐", word: "坐下", hint: "把身子放下来", parts: ["坐"], strokes: 7 },
    { char: "挫", word: "挫折", hint: "路上遇到的一道小坎", parts: ["扌", "坐"], strokes: 10 },
  ],
  [
    { char: "在", word: "现在", hint: "此时此地", parts: ["𠂇", "土"], strokes: 6 },
    { char: "再", word: "再见", hint: "又一次", parts: ["冂", "土"], strokes: 6 },
    { char: "存", word: "存钱", hint: "先攒着不花掉", parts: ["𠂇", "子"], strokes: 6 },
  ],
  [
    { char: "历", word: "日历", hint: "一天天过去的记录", parts: ["厂", "力"], strokes: 4 },
    { char: "厉", word: "厉害", hint: "很有本事", parts: ["厂", "万"], strokes: 5 },
    { char: "励", word: "鼓励", hint: "给人加油打气", parts: ["厉", "厂", "力"], strokes: 7 },
  ],
];

/** 两个形近字凭什么摆在一起：共享部件，或者笔画数只差一笔 */
export function isConfusable(a: LookalikeItem, b: LookalikeItem): boolean {
  if (a.char === b.char) return false;
  if (a.parts.some((p) => b.parts.includes(p))) return true;
  return Math.abs(a.strokes - b.strokes) <= 1;
}

/** 某个字所在的那一组（出题时干扰项只许从这里取） */
export function lookalikeGroupOf(char: string): LookalikeItem[] {
  return LOOKALIKE_SETS.find((g) => g.some((x) => x.char === char)) ?? [];
}

/** 成语补全：挖掉一个字，靠意思把它填回去 */
export interface IdiomCard {
  idiom: string;
  /**
   * 挖空的位置（0 基）。成语里有重复字时要挑那个**只出现一次**的位置挖，
   * 挖了重复字等于把答案留在题面上（1.2 窗口5 修的 W5-F-02）。
   */
  blank: number;
  /**
   * 释义句。**一个字都不许和被挖掉的那个字重复**——释义里带上答案字，
   * 孩子不用会这条成语也能照着抄回去（1.2 窗口5 修的 W5-A-02）。
   * `bank.test.ts` 有一条守门用例钉着这件事。
   */
  meaning: string;
}

export const IDIOM_CARDS: IdiomCard[] = [
  { idiom: "一心一意", blank: 1, meaning: "只认准一件事去做" },
  { idiom: "三心二意", blank: 1, meaning: "拿不定主意，分神" },
  { idiom: "画蛇添足", blank: 2, meaning: "多此一举反而坏事" },
  { idiom: "守株待兔", blank: 2, meaning: "死等运气不动脑" },
  { idiom: "亡羊补牢", blank: 3, meaning: "出了问题赶紧补救" },
  { idiom: "井底之蛙", blank: 3, meaning: "见识小，眼界窄" },
  { idiom: "掩耳盗铃", blank: 1, meaning: "自己骗自己" },
  { idiom: "刻舟求剑", blank: 2, meaning: "情况变了还照老办法" },
  { idiom: "对牛弹琴", blank: 3, meaning: "话说给听不懂的人" },
  { idiom: "自相矛盾", blank: 2, meaning: "前后两句话打起架" },
  { idiom: "狐假虎威", blank: 2, meaning: "借别人的势头吓人" },
  { idiom: "画龙点睛", blank: 3, meaning: "关键一笔让画活了" },
  { idiom: "愚公移山", blank: 2, meaning: "有恒心，再难也成" },
  { idiom: "熟能生巧", blank: 3, meaning: "练得多自然就熟练" },
  { idiom: "温故知新", blank: 1, meaning: "复习旧的有新收获" },
  { idiom: "全神贯注", blank: 1, meaning: "注意力全部集中" },
  { idiom: "专心致志", blank: 2, meaning: "一门心思做一件事" },
  { idiom: "目不转睛", blank: 2, meaning: "眼睛一动不动地看" },
  { idiom: "兴高采烈", blank: 1, meaning: "情绪很好、很神气" },
  { idiom: "万紫千红", blank: 2, meaning: "花开得又多又艳" },
  { idiom: "鸟语花香", blank: 1, meaning: "又有鸟叫又有花香" },
  { idiom: "春暖花开", blank: 1, meaning: "天气回温，花都开了" },
  // 挖第 1 位而不是第 2 位：这条成语里「百」出现两次，挖掉后面那个，前面那个
  // 还明晃晃摆在题面上（窗口5 第1轮 W5-F-02）
  { idiom: "百发百中", blank: 1, meaning: "每一次都正中目标" },
  { idiom: "五颜六色", blank: 2, meaning: "颜色多得数不过来" },
];

/**
 * 近义反义：一个词，一左一右两个方向。
 *
 * 1.2 修了三处会让答案不唯一或干脆配错的坑：
 *  - 「结实」是一词多音多义（jiē shi 牢固 / jiē shí 结果实），配的反义词「松软」
 *    对的其实是「坚硬」；改成方向清楚的**松散**；
 *  - 「诚实」的反义词「虚假」对的是「真实」，诚实的反义是**虚伪**；
 *  - 「熟识」对小学生偏生，近义词换成**了解**。
 */
export interface SynAntCard {
  word: string;
  synonym: string;
  antonym: string;
}

export const SYN_ANT_CARDS: SynAntCard[] = [
  { word: "美丽", synonym: "漂亮", antonym: "丑陋" },
  { word: "高兴", synonym: "快乐", antonym: "难过" },
  { word: "认真", synonym: "仔细", antonym: "马虎" },
  { word: "寒冷", synonym: "冰冷", antonym: "炎热" },
  { word: "安静", synonym: "宁静", antonym: "吵闹" },
  { word: "勇敢", synonym: "英勇", antonym: "胆小" },
  { word: "诚实", synonym: "老实", antonym: "虚伪" },
  { word: "简单", synonym: "容易", antonym: "复杂" },
  { word: "明亮", synonym: "光亮", antonym: "昏暗" },
  { word: "熟悉", synonym: "了解", antonym: "陌生" },
  { word: "热闹", synonym: "喧闹", antonym: "冷清" },
  { word: "相信", synonym: "信任", antonym: "怀疑" },
  { word: "立刻", synonym: "马上", antonym: "迟缓" },
  { word: "保护", synonym: "爱护", antonym: "破坏" },
  { word: "增加", synonym: "增添", antonym: "减少" },
  { word: "温柔", synonym: "温和", antonym: "粗暴" },
  { word: "珍惜", synonym: "爱惜", antonym: "浪费" },
  { word: "结实", synonym: "牢固", antonym: "松散" },
];

/** 句子填空：答案一定是某张近反义卡上的词，干扰项就用它的反义词 */
export interface ClozeCard {
  /** 句子里用 ____ 表示要填的空 */
  text: string;
  answer: string;
}

export const CLOZE_CARDS: ClozeCard[] = [
  { text: "雨过天晴，天边挂着一道____的彩虹。", answer: "美丽" },
  { text: "他做事一向____，作业本上很少出现错别字。", answer: "认真" },
  { text: "图书馆里非常____，只听得见翻书的声音。", answer: "安静" },
  { text: "面对困难，他表现得特别____。", answer: "勇敢" },
  { text: "这道题看着复杂，其实方法很____。", answer: "简单" },
  { text: "台灯把书桌照得格外____。", answer: "明亮" },
  { text: "我们要____粮食，一粒米也不浪费。", answer: "珍惜" },
  { text: "森林里的小动物需要大家一起____。", answer: "保护" },
  { text: "听到好消息，全班同学都____得鼓起掌来。", answer: "高兴" },
  { text: "冬天的清晨格外____，呼出的气都成了白雾。", answer: "寒冷" },
  { text: "节日的广场上人来人往，十分____。", answer: "热闹" },
  { text: "他说的话有根有据，我完全____。", answer: "相信" },
  { text: "上课铃一响，大家____回到了座位上。", answer: "立刻" },
  { text: "妈妈说话又轻又____，像春风拂过。", answer: "温柔" },
  { text: "这条绳子看着细，其实很____。", answer: "结实" },
  { text: "这条路我走过很多回，早就____了。", answer: "熟悉" },
];

/** 偏旁部首：看偏旁猜字义 */
export interface RadicalCard {
  radical: string;
  /**
   * 这个偏旁多半和什么有关。
   * 反过来问「哪个字和「X」有关？」的时候，凡是出现在这句话里的字都不许当答案
   * ——义项词里就写着那个字，等于白送（1.2 窗口5 修的 W5-A-02，见 `radicalTargets`）。
   */
  topic: string;
  chars: string[];
}

/**
 * 这张偏旁卡里可以拿来当「哪个字和「X」有关？」答案的字。
 *
 * 把义项词里出现过的字剔掉：`木 / 树木` 不能问出「树」、`讠 / 说话` 不能问出「说」。
 * 剔干净了要是一个都不剩（数据写坏了），就退回全表，宁可弱一点也不能出不了题。
 */
export function radicalTargets(card: RadicalCard): string[] {
  const clean = card.chars.filter((c) => !card.topic.includes(c));
  return clean.length ? clean : card.chars;
}

export const RADICAL_CARDS: RadicalCard[] = [
  { radical: "氵", topic: "水", chars: ["河", "海", "江", "湖", "流", "泪"] },
  { radical: "扌", topic: "手上的动作", chars: ["提", "推", "拉", "抱", "指", "打"] },
  { radical: "艹", topic: "花草植物", chars: ["花", "草", "菜", "苗", "茶", "药"] },
  { radical: "木", topic: "树木", chars: ["树", "松", "枝", "林", "板", "桥"] },
  { radical: "讠", topic: "说话", chars: ["说", "语", "话", "读", "请", "谢"] },
  // 1.2 修：原来 topic 写「心情」却收了管快慢的「慢」，换成同样带忄、确实在说心里的「愉」
  { radical: "忄", topic: "心里的感受", chars: ["情", "怕", "惊", "忙", "愉", "懂"] },
  { radical: "目", topic: "眼睛", chars: ["看", "眼", "睛", "睡", "眨", "瞧"] },
  { radical: "足", topic: "脚下的动作", chars: ["跑", "跳", "踢", "跨", "跟", "路"] },
  { radical: "钅", topic: "金属", chars: ["钟", "铜", "针", "铁", "银", "钩"] },
  { radical: "虫", topic: "小虫子", chars: ["蚂", "蜂", "蝶", "蜻", "蚁", "蛙"] },
  { radical: "火", topic: "火和热", chars: ["灯", "烧", "烤", "烟", "炉", "焰"] },
  { radical: "宀", topic: "房屋", chars: ["家", "宝", "室", "安", "客", "宿"] },
];

/** 两步组字：先挑偏旁定意思，再挑部件定读音 */
export interface BuildCharCard {
  char: string;
  radical: string;
  /** 剩下的那半边 */
  part: string;
  word: string;
  clue: string;
}

export const BUILD_CHAR_CARDS: BuildCharCard[] = [
  { char: "河", radical: "氵", part: "可", word: "小河", clue: "水流成的一条带子" },
  { char: "海", radical: "氵", part: "每", word: "大海", clue: "最大的一片水" },
  { char: "江", radical: "氵", part: "工", word: "长江", clue: "又宽又长的大河" },
  { char: "洋", radical: "氵", part: "羊", word: "海洋", clue: "比海还大的水域" },
  { char: "泡", radical: "氵", part: "包", word: "泡泡", clue: "水里鼓起来的小圆球" },
  { char: "清", radical: "氵", part: "青", word: "清水", clue: "水干净得能看见底" },
  { char: "跑", radical: "足", part: "包", word: "奔跑", clue: "两只脚飞快地动" },
  { char: "跳", radical: "足", part: "兆", word: "跳高", clue: "脚一蹬就离地" },
  { char: "抱", radical: "扌", part: "包", word: "拥抱", clue: "两只手圈起来" },
  { char: "提", radical: "扌", part: "是", word: "提水", clue: "用手拎起来" },
  { char: "情", radical: "忄", part: "青", word: "心情", clue: "心里的滋味" },
  { char: "晴", radical: "日", part: "青", word: "晴天", clue: "太阳出来了" },
  { char: "睛", radical: "目", part: "青", word: "眼睛", clue: "用来看东西的" },
  { char: "请", radical: "讠", part: "青", word: "请客", clue: "开口邀别人" },
  { char: "语", radical: "讠", part: "吾", word: "语文", clue: "开口说出来的话" },
  { char: "树", radical: "木", part: "对", word: "大树", clue: "一年年往上长的木本植物" },
  { char: "松", radical: "木", part: "公", word: "松树", clue: "冬天也不落叶的树" },
  { char: "花", radical: "艹", part: "化", word: "花朵", clue: "草木开出来的漂亮东西" },
  { char: "草", radical: "艹", part: "早", word: "小草", clue: "地上一片绿绿的" },
  { char: "灯", radical: "火", part: "丁", word: "台灯", clue: "晚上照亮屋子的" },
  { char: "钟", radical: "钅", part: "中", word: "时钟", clue: "金属做的，会报时间" },
  { char: "蚂", radical: "虫", part: "马", word: "蚂蚁", clue: "排着队搬东西的小虫" },
  { char: "安", radical: "宀", part: "女", word: "安全", clue: "屋子里踏踏实实的" },
  { char: "客", radical: "宀", part: "各", word: "客人", clue: "上门做客的人" },
];

// ===========================================================================
// 1.2 追加：多音字辨析
// 同一个字摆进两句话，读音就变了 —— 光背单字读不出来，必须回到句子里。
// ===========================================================================

export interface PolyphoneReading {
  /** 这个读音的拼音（带声调） */
  pinyin: string;
  /** 这个读音下最常见的词 */
  word: string;
  /** 一句话，里面一定含这个字 */
  sentence: string;
  /** 这个读音是什么意思 */
  meaning: string;
}

export interface PolyphoneCard {
  char: string;
  /** 正好两个读音，一句话配一个 */
  readings: [PolyphoneReading, PolyphoneReading];
  /**
   * 第三个选项：一个和正确读音只差声调（或只差声母）的近音，
   * 不是这个字的任何一个真读音 —— 逼孩子把声调听准，而不是二选一乱猜。
   */
  decoy: string;
}

export const POLYPHONE_CARDS: PolyphoneCard[] = [
  {
    char: "长",
    readings: [
      { pinyin: "cháng", word: "长短", sentence: "这条路很长，走了半个钟头。", meaning: "两头之间距离大" },
      { pinyin: "zhǎng", word: "长大", sentence: "小树苗一年年长大了。", meaning: "一点点变大" },
    ],
    decoy: "chǎng",
  },
  {
    char: "乐",
    readings: [
      { pinyin: "lè", word: "快乐", sentence: "过节了，大家都很快乐。", meaning: "心里高兴" },
      { pinyin: "yuè", word: "音乐", sentence: "下午第一节是音乐课。", meaning: "唱的奏的曲子" },
    ],
    decoy: "yuē",
  },
  {
    char: "觉",
    readings: [
      { pinyin: "jué", word: "觉得", sentence: "我觉得这道题不难。", meaning: "心里这么想" },
      { pinyin: "jiào", word: "睡觉", sentence: "他九点就上床睡觉了。", meaning: "闭上眼睛休息" },
    ],
    decoy: "jiāo",
  },
  {
    char: "行",
    readings: [
      { pinyin: "xíng", word: "行走", sentence: "过马路要走人行道。", meaning: "走，或者可以" },
      { pinyin: "háng", word: "银行", sentence: "妈妈去银行取钱了。", meaning: "一行一行，也指行业" },
    ],
    decoy: "hàng",
  },
  {
    char: "空",
    readings: [
      { pinyin: "kōng", word: "天空", sentence: "天空里飘着几朵白云。", meaning: "什么都没有的地方" },
      { pinyin: "kòng", word: "空儿", sentence: "你明天有空儿来我家吗？", meaning: "空出来的时间或地方" },
    ],
    decoy: "gōng",
  },
  {
    char: "数",
    readings: [
      { pinyin: "shǔ", word: "数一数", sentence: "把篮子里的苹果数一数。", meaning: "一个一个点清楚" },
      { pinyin: "shù", word: "数学", sentence: "他的数学作业写完了。", meaning: "数目、数字" },
    ],
    decoy: "shū",
  },
  {
    char: "好",
    readings: [
      { pinyin: "hǎo", word: "好人", sentence: "他是个热心肠的好人。", meaning: "不错，让人满意" },
      { pinyin: "hào", word: "爱好", sentence: "我的爱好是画画。", meaning: "喜欢，有兴趣" },
    ],
    decoy: "háo",
  },
  {
    char: "种",
    readings: [
      { pinyin: "zhǒng", word: "种子", sentence: "把种子埋进土里。", meaning: "能长出新苗的籽" },
      { pinyin: "zhòng", word: "种花", sentence: "奶奶在院子里种花。", meaning: "把苗栽进土里" },
    ],
    decoy: "chóng",
  },
  {
    char: "发",
    readings: [
      { pinyin: "fā", word: "发现", sentence: "我发现了一只小蜗牛。", meaning: "放出来，或者找到" },
      { pinyin: "fà", word: "头发", sentence: "姐姐的头发又黑又长。", meaning: "头上长的毛" },
    ],
    decoy: "fá",
  },
  {
    char: "少",
    readings: [
      { pinyin: "shǎo", word: "多少", sentence: "碗里的米饭有点少。", meaning: "数量不多" },
      { pinyin: "shào", word: "少年", sentence: "他是个懂事的少年。", meaning: "年纪小" },
    ],
    decoy: "sháo",
  },
  {
    char: "教",
    readings: [
      { pinyin: "jiāo", word: "教书", sentence: "爸爸在小学里教书。", meaning: "把本事传给别人" },
      { pinyin: "jiào", word: "教室", sentence: "我们的教室在二楼。", meaning: "教导、教育" },
    ],
    decoy: "jiǎo",
  },
  {
    char: "重",
    readings: [
      { pinyin: "zhòng", word: "重量", sentence: "这个书包太重了。", meaning: "分量大" },
      { pinyin: "chóng", word: "重来", sentence: "写错了没关系，重来一遍。", meaning: "再一次" },
    ],
    decoy: "zhōng",
  },
  {
    char: "还",
    readings: [
      { pinyin: "hái", word: "还有", sentence: "篮子里还有两个桃子。", meaning: "仍旧、另外" },
      { pinyin: "huán", word: "还书", sentence: "看完了记得去还书。", meaning: "把东西送回去" },
    ],
    decoy: "huàn",
  },
  {
    char: "干",
    readings: [
      { pinyin: "gān", word: "干净", sentence: "衣服晒得又干又香。", meaning: "没有水分，或者清洁" },
      { pinyin: "gàn", word: "干活", sentence: "大家一起干活可快了。", meaning: "做事情" },
    ],
    decoy: "gǎn",
  },
  {
    char: "只",
    readings: [
      { pinyin: "zhī", word: "一只", sentence: "树上停着一只小鸟。", meaning: "数动物的量词" },
      { pinyin: "zhǐ", word: "只有", sentence: "盒子里只有一块糖了。", meaning: "仅仅" },
    ],
    decoy: "zhì",
  },
  {
    char: "相",
    readings: [
      { pinyin: "xiāng", word: "相同", sentence: "这两片叶子形状相同。", meaning: "互相、一样" },
      { pinyin: "xiàng", word: "照相", sentence: "我们在花园里照相。", meaning: "样子、模样" },
    ],
    decoy: "xiǎng",
  },
  {
    char: "假",
    readings: [
      { pinyin: "jiǎ", word: "假装", sentence: "他假装没听见。", meaning: "不是真的" },
      { pinyin: "jià", word: "放假", sentence: "过几天学校就放假了。", meaning: "休息的日子" },
    ],
    decoy: "jiā",
  },
  {
    char: "曲",
    readings: [
      { pinyin: "qū", word: "弯曲", sentence: "小路弯曲着通向山上。", meaning: "不直，拐来拐去" },
      { pinyin: "qǔ", word: "歌曲", sentence: "这首歌曲真好听。", meaning: "唱的调子" },
    ],
    decoy: "qù",
  },
  {
    char: "尽",
    readings: [
      { pinyin: "jǐn", word: "尽量", sentence: "请你尽量早点来。", meaning: "在能做到的范围里" },
      { pinyin: "jìn", word: "用尽", sentence: "力气快用尽了，歇一会儿。", meaning: "全部用完" },
    ],
    decoy: "jīn",
  },
  {
    char: "传",
    readings: [
      { pinyin: "chuán", word: "传话", sentence: "请你帮我传一句话。", meaning: "递过去" },
      { pinyin: "zhuàn", word: "传记", sentence: "我读了一本名人传记。", meaning: "记一个人一生的书" },
    ],
    decoy: "chuàn",
  },
];

/**
 * 受控真词表：组词题的每一个选项都必须在这张表里。
 * 表里全是字卡上真实出现过的词，加上组字工坊与形近字用到的词，
 * 保证孩子看到的三个选项都是真词，没有一个是生造出来凑数的。
 */
export function realWordList(extra: readonly string[] = []): string[] {
  const set = new Set<string>();
  for (const c of WORD_BANK) set.add(c.word);
  for (const g of LOOKALIKE_SETS) for (const it of g) set.add(it.word);
  for (const c of BUILD_CHAR_CARDS) set.add(c.word);
  for (const c of SYN_ANT_CARDS) {
    set.add(c.word);
    set.add(c.synonym);
    set.add(c.antonym);
  }
  for (const c of POLYPHONE_CARDS) for (const r of c.readings) set.add(r.word);
  for (const w of extra) set.add(w);
  return [...set];
}

/** 针对某个指定字出一道题（错题本再练用）。 */
export function makeReviewQuestion(card: WordCard, rand: () => number = Math.random): WordQuestion {
  const others = WORD_BANK.filter((c) => c.char !== card.char);
  const distractors: WordCard[] = [];
  while (distractors.length < 2) {
    const d = pick(others, rand);
    if (!distractors.includes(d)) distractors.push(d);
  }
  const choices = [card, ...distractors];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { target: card, choices, answerIndex: choices.indexOf(card) };
}
