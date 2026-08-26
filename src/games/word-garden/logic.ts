// 识字小花园：常见字出题纯逻辑（三座主题花园 + 错题本）

export type WordCard = {
  char: string;
  pinyin: string;
  /** 帮助理解的词语，例如「太阳」 */
  word: string;
  emoji: string;
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
      { char: "日", pinyin: "rì", word: "太阳", emoji: "☀️" },
      { char: "月", pinyin: "yuè", word: "月亮", emoji: "🌙" },
      { char: "水", pinyin: "shuǐ", word: "水滴", emoji: "💧" },
      { char: "火", pinyin: "huǒ", word: "火苗", emoji: "🔥" },
      { char: "山", pinyin: "shān", word: "大山", emoji: "⛰️" },
      { char: "田", pinyin: "tián", word: "田地", emoji: "🌾" },
      { char: "木", pinyin: "mù", word: "树木", emoji: "🌳" },
      { char: "花", pinyin: "huā", word: "花朵", emoji: "🌸" },
      { char: "云", pinyin: "yún", word: "白云", emoji: "☁️" },
      { char: "雨", pinyin: "yǔ", word: "下雨", emoji: "🌧️" },
      { char: "雪", pinyin: "xuě", word: "雪花", emoji: "❄️" },
      { char: "星", pinyin: "xīng", word: "星星", emoji: "⭐" },
      { char: "电", pinyin: "diàn", word: "闪电", emoji: "⚡" },
      { char: "风", pinyin: "fēng", word: "大风", emoji: "🌬️" },
      { char: "天", pinyin: "tiān", word: "天空", emoji: "🌤️" },
      { char: "叶", pinyin: "yè", word: "树叶", emoji: "🍃" },
      { char: "草", pinyin: "cǎo", word: "小草", emoji: "🌱" },
      { char: "竹", pinyin: "zhú", word: "竹子", emoji: "🎋" },
    ],
  },
  {
    name: "萌萌花园",
    desc: "动物朋友",
    emoji: "🐾",
    cards: [
      { char: "鸟", pinyin: "niǎo", word: "小鸟", emoji: "🐦" },
      { char: "鱼", pinyin: "yú", word: "小鱼", emoji: "🐟" },
      { char: "虫", pinyin: "chóng", word: "虫子", emoji: "🐛" },
      { char: "牛", pinyin: "niú", word: "小牛", emoji: "🐮" },
      { char: "羊", pinyin: "yáng", word: "小羊", emoji: "🐑" },
      { char: "马", pinyin: "mǎ", word: "小马", emoji: "🐴" },
      { char: "狗", pinyin: "gǒu", word: "小狗", emoji: "🐶" },
      { char: "猫", pinyin: "māo", word: "小猫", emoji: "🐱" },
      { char: "兔", pinyin: "tù", word: "兔子", emoji: "🐰" },
      { char: "猪", pinyin: "zhū", word: "小猪", emoji: "🐷" },
      { char: "鸡", pinyin: "jī", word: "小鸡", emoji: "🐔" },
      { char: "鸭", pinyin: "yā", word: "鸭子", emoji: "🦆" },
      { char: "龟", pinyin: "guī", word: "乌龟", emoji: "🐢" },
      { char: "熊", pinyin: "xióng", word: "小熊", emoji: "🐻" },
      { char: "象", pinyin: "xiàng", word: "大象", emoji: "🐘" },
      { char: "虎", pinyin: "hǔ", word: "老虎", emoji: "🐯" },
      { char: "蛙", pinyin: "wā", word: "青蛙", emoji: "🐸" },
      { char: "鹅", pinyin: "é", word: "白鹅", emoji: "🦢" },
    ],
  },
  {
    name: "星星花园",
    desc: "身体和宝贝",
    emoji: "✨",
    cards: [
      { char: "手", pinyin: "shǒu", word: "小手", emoji: "✋" },
      { char: "口", pinyin: "kǒu", word: "嘴巴", emoji: "👄" },
      { char: "耳", pinyin: "ěr", word: "耳朵", emoji: "👂" },
      { char: "目", pinyin: "mù", word: "眼睛", emoji: "👀" },
      { char: "足", pinyin: "zú", word: "小脚", emoji: "🦶" },
      { char: "牙", pinyin: "yá", word: "牙齿", emoji: "🦷" },
      { char: "心", pinyin: "xīn", word: "爱心", emoji: "❤️" },
      { char: "人", pinyin: "rén", word: "人儿", emoji: "🧍" },
      { char: "门", pinyin: "mén", word: "大门", emoji: "🚪" },
      { char: "车", pinyin: "chē", word: "汽车", emoji: "🚗" },
      { char: "船", pinyin: "chuán", word: "小船", emoji: "⛵" },
      { char: "伞", pinyin: "sǎn", word: "雨伞", emoji: "☂️" },
      { char: "书", pinyin: "shū", word: "书本", emoji: "📖" },
      { char: "笔", pinyin: "bǐ", word: "铅笔", emoji: "✏️" },
      { char: "灯", pinyin: "dēng", word: "灯泡", emoji: "💡" },
      { char: "球", pinyin: "qiú", word: "皮球", emoji: "⚽" },
      { char: "果", pinyin: "guǒ", word: "果子", emoji: "🍎" },
      { char: "米", pinyin: "mǐ", word: "大米", emoji: "🍚" },
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

/** 形近字：长得像，但意思和用法差得远 */
export interface LookalikeItem {
  char: string;
  /** 只有这个字才组得成的词 */
  word: string;
  /** 一句话说清它的意思 */
  hint: string;
}

export const LOOKALIKE_SETS: LookalikeItem[][] = [
  [
    { char: "己", word: "自己", hint: "说的是自个儿" },
    { char: "已", word: "已经", hint: "事情做完了" },
  ],
  [
    { char: "未", word: "未来", hint: "还没到的日子" },
    { char: "末", word: "周末", hint: "一段时间的尾巴" },
  ],
  [
    { char: "干", word: "干净", hint: "一点脏东西都没有" },
    { char: "千", word: "千米", hint: "十个百那么多" },
  ],
  [
    { char: "乌", word: "乌云", hint: "黑压压的云" },
    { char: "鸟", word: "小鸟", hint: "会飞会唱歌" },
  ],
  [
    { char: "免", word: "免费", hint: "不用花钱" },
    { char: "兔", word: "兔子", hint: "长耳朵爱吃草" },
  ],
  [
    { char: "辨", word: "分辨", hint: "把两样东西分清楚" },
    { char: "辩", word: "争辩", hint: "用话讲道理" },
    { char: "辫", word: "辫子", hint: "头发编成的" },
  ],
  [
    { char: "蓝", word: "蓝色", hint: "天空的颜色" },
    { char: "篮", word: "篮球", hint: "竹字头，装东西的筐" },
  ],
  [
    { char: "密", word: "秘密", hint: "藏起来不说的事" },
    { char: "蜜", word: "蜂蜜", hint: "甜甜的，虫字底" },
  ],
  [
    { char: "燥", word: "干燥", hint: "一点水分都没有" },
    { char: "躁", word: "急躁", hint: "心里静不下来" },
  ],
  [
    { char: "键", word: "键盘", hint: "一个一个按下去" },
    { char: "健", word: "健康", hint: "身体结实有力气" },
  ],
  [
    { char: "副", word: "副手", hint: "在旁边帮忙的" },
    { char: "幅", word: "一幅画", hint: "数画用的量词" },
  ],
  [
    { char: "陪", word: "陪伴", hint: "在身边一起走" },
    { char: "赔", word: "赔礼", hint: "做错事去道歉" },
  ],
  [
    { char: "拨", word: "拨动", hint: "用手轻轻一推" },
    { char: "拔", word: "拔草", hint: "用力往上抽出来" },
  ],
  [
    { char: "竟", word: "究竟", hint: "到底是怎么回事" },
    { char: "竞", word: "竞赛", hint: "大家比一比" },
  ],
  [
    { char: "即", word: "立即", hint: "马上就做" },
    { char: "既", word: "既然", hint: "承接上一句话" },
  ],
  [
    { char: "戴", word: "戴帽子", hint: "往身上套的动作" },
    { char: "带", word: "带上", hint: "随身拿着走" },
  ],
  [
    { char: "象", word: "大象", hint: "鼻子长长的动物" },
    { char: "像", word: "好像", hint: "看着很相似" },
  ],
  [
    { char: "座", word: "座位", hint: "坐的那个地方" },
    { char: "坐", word: "坐下", hint: "把身子放下来" },
  ],
  [
    { char: "在", word: "现在", hint: "此时此地" },
    { char: "再", word: "再见", hint: "又一次" },
  ],
  [
    { char: "历", word: "日历", hint: "一天天过去的记录" },
    { char: "厉", word: "厉害", hint: "很有本事" },
  ],
];

/** 成语补全：挖掉一个字，靠意思把它填回去 */
export interface IdiomCard {
  idiom: string;
  /** 挖空的位置（0 基） */
  blank: number;
  meaning: string;
}

export const IDIOM_CARDS: IdiomCard[] = [
  { idiom: "一心一意", blank: 1, meaning: "心思全在一件事上" },
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
  { idiom: "兴高采烈", blank: 1, meaning: "高兴得神气十足" },
  { idiom: "万紫千红", blank: 2, meaning: "花开得又多又艳" },
  { idiom: "鸟语花香", blank: 1, meaning: "又有鸟叫又有花香" },
  { idiom: "春暖花开", blank: 1, meaning: "天气转暖花都开了" },
  { idiom: "百发百中", blank: 2, meaning: "每一次都正中目标" },
  { idiom: "五颜六色", blank: 2, meaning: "颜色多得数不过来" },
];

/** 近义反义：一个词，一左一右两个方向 */
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
  { word: "诚实", synonym: "老实", antonym: "虚假" },
  { word: "简单", synonym: "容易", antonym: "复杂" },
  { word: "明亮", synonym: "光亮", antonym: "昏暗" },
  { word: "熟悉", synonym: "熟识", antonym: "陌生" },
  { word: "热闹", synonym: "喧闹", antonym: "冷清" },
  { word: "相信", synonym: "信任", antonym: "怀疑" },
  { word: "立刻", synonym: "马上", antonym: "迟缓" },
  { word: "保护", synonym: "爱护", antonym: "破坏" },
  { word: "增加", synonym: "增添", antonym: "减少" },
  { word: "温柔", synonym: "温和", antonym: "粗暴" },
  { word: "珍惜", synonym: "爱惜", antonym: "浪费" },
  { word: "结实", synonym: "牢固", antonym: "松软" },
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
  /** 这个偏旁多半和什么有关 */
  topic: string;
  chars: string[];
}

export const RADICAL_CARDS: RadicalCard[] = [
  { radical: "氵", topic: "水", chars: ["河", "海", "江", "湖", "流", "泪"] },
  { radical: "扌", topic: "手上的动作", chars: ["提", "推", "拉", "抱", "指", "打"] },
  { radical: "艹", topic: "花草植物", chars: ["花", "草", "菜", "苗", "茶", "药"] },
  { radical: "木", topic: "树木", chars: ["树", "松", "枝", "林", "板", "桥"] },
  { radical: "讠", topic: "说话", chars: ["说", "语", "话", "读", "请", "谢"] },
  { radical: "忄", topic: "心情", chars: ["情", "怕", "惊", "忙", "慢", "懂"] },
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
