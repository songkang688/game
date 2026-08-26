// 拼音小火车：出题纯逻辑（三站递进 + 声调题 + 看图选音节）

/** 韵母（单韵母 + 常见复韵母/鼻韵母） */
export const VOWELS = [
  "a", "o", "e", "i", "u", "ü",
  "ai", "ei", "ui", "ao", "ou", "iu",
  "ie", "üe", "er", "an", "en", "in",
  "un", "ün", "ang", "eng", "ing", "ong",
];

/** 全部声母 */
export const INITIALS = [
  "b", "p", "m", "f", "d", "t", "n", "l",
  "g", "k", "h", "j", "q", "x",
  "zh", "ch", "sh", "r", "z", "c", "s", "y", "w",
];

/** 容易认混的字母分组，用于「找相同」题 */
export const LOOKALIKE_GROUPS: string[][] = [
  ["b", "d", "p", "q"],
  ["m", "n"],
  ["u", "ü"],
  ["f", "t"],
  ["ei", "ie"],
  ["ui", "iu"],
  ["un", "ün"],
  ["z", "zh"],
  ["c", "ch"],
  ["s", "sh"],
  ["an", "ang"],
  ["en", "eng"],
  ["in", "ing"],
];

/** 带声调的单韵母，用于声调题 */
export const TONE_MARKS: Record<string, string[]> = {
  a: ["ā", "á", "ǎ", "à"],
  o: ["ō", "ó", "ǒ", "ò"],
  e: ["ē", "é", "ě", "è"],
  i: ["ī", "í", "ǐ", "ì"],
  u: ["ū", "ú", "ǔ", "ù"],
};
export const TONE_NAMES = ["第一声", "第二声", "第三声", "第四声"];

/** 看图选音节的图卡 */
export type SyllableCard = { emoji: string; word: string; pinyin: string };
export const SYLLABLE_CARDS: SyllableCard[] = [
  { emoji: "🐱", word: "猫", pinyin: "māo" },
  { emoji: "🐶", word: "狗", pinyin: "gǒu" },
  { emoji: "🐟", word: "鱼", pinyin: "yú" },
  { emoji: "🐴", word: "马", pinyin: "mǎ" },
  { emoji: "🌸", word: "花", pinyin: "huā" },
  { emoji: "🌙", word: "月", pinyin: "yuè" },
  { emoji: "☀️", word: "日", pinyin: "rì" },
  { emoji: "💧", word: "水", pinyin: "shuǐ" },
  { emoji: "🔥", word: "火", pinyin: "huǒ" },
  { emoji: "⛰️", word: "山", pinyin: "shān" },
  { emoji: "🐦", word: "鸟", pinyin: "niǎo" },
  { emoji: "🌳", word: "树", pinyin: "shù" },
  { emoji: "🐮", word: "牛", pinyin: "niú" },
  { emoji: "🐑", word: "羊", pinyin: "yáng" },
  { emoji: "🚗", word: "车", pinyin: "chē" },
  { emoji: "📖", word: "书", pinyin: "shū" },
];

export type PinyinQuestion = {
  kind: "vowel" | "initial" | "match" | "tone" | "syllable";
  /** 题目提示文字 */
  prompt: string;
  /** 车头上展示的大字母 / 图片，无则为空字符串 */
  display: string;
  choices: string[];
  answerIndex: number;
};

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickDistinct(arr: string[], n: number, rand: () => number, exclude: string[] = []): string[] {
  const pool = arr.filter((x) => !exclude.includes(x));
  const out: string[] = [];
  while (out.length < n && pool.length > 0) {
    const x = pick(pool, rand);
    if (!out.includes(x)) out.push(x);
  }
  return out;
}

export function makeVowelQuestion(rand: () => number = Math.random): PinyinQuestion {
  const target = pick(VOWELS, rand);
  const distractors = pickDistinct(INITIALS, 2, rand);
  const choices = shuffle([target, ...distractors], rand);
  return {
    kind: "vowel",
    prompt: "下面哪个是韵母？",
    display: "",
    choices,
    answerIndex: choices.indexOf(target),
  };
}

export function makeInitialQuestion(rand: () => number = Math.random): PinyinQuestion {
  const target = pick(INITIALS, rand);
  const distractors = pickDistinct(VOWELS, 2, rand);
  const choices = shuffle([target, ...distractors], rand);
  return {
    kind: "initial",
    prompt: "下面哪个是声母？",
    display: "",
    choices,
    answerIndex: choices.indexOf(target),
  };
}

export function makeMatchQuestion(rand: () => number = Math.random): PinyinQuestion {
  const group = pick(LOOKALIKE_GROUPS, rand);
  const target = pick(group, rand);
  const distractors = pickDistinct(group, Math.min(2, group.length - 1), rand, [target]);
  if (distractors.length < 2) {
    distractors.push(
      ...pickDistinct([...VOWELS, ...INITIALS], 2 - distractors.length, rand, [target, ...distractors])
    );
  }
  const choices = shuffle([target, ...distractors], rand);
  return {
    kind: "match",
    prompt: "找出和车头上一样的字母！",
    display: target,
    choices,
    answerIndex: choices.indexOf(target),
  };
}

export function makeToneQuestion(rand: () => number = Math.random): PinyinQuestion {
  const bases = Object.keys(TONE_MARKS);
  const base = pick(bases, rand);
  const forms = TONE_MARKS[base];
  const toneIdx = Math.floor(rand() * 4);
  const target = forms[toneIdx];
  const others = forms.filter((_, i) => i !== toneIdx);
  const distractors = pickDistinct(others, 2, rand);
  const choices = shuffle([target, ...distractors], rand);
  return {
    kind: "tone",
    prompt: `哪个是「${base}」的${TONE_NAMES[toneIdx]}？`,
    display: "",
    choices,
    answerIndex: choices.indexOf(target),
  };
}

export function makeSyllableQuestion(rand: () => number = Math.random): PinyinQuestion {
  const card = pick(SYLLABLE_CARDS, rand);
  const distractors = pickDistinct(
    SYLLABLE_CARDS.map((c) => c.pinyin),
    2,
    rand,
    [card.pinyin]
  );
  const choices = shuffle([card.pinyin, ...distractors], rand);
  return {
    kind: "syllable",
    prompt: `「${card.word}」的拼音是哪个？`,
    display: card.emoji,
    choices,
    answerIndex: choices.indexOf(card.pinyin),
  };
}

/** 兼容旧接口：随机出基础三类题 */
export function makePinyinQuestion(rand: () => number = Math.random): PinyinQuestion {
  const r = rand();
  if (r < 1 / 3) return makeVowelQuestion(rand);
  if (r < 2 / 3) return makeInitialQuestion(rand);
  return makeMatchQuestion(rand);
}

/**
 * 按车站出题：
 * 第 1 站认声母韵母，第 2 站双胞胎字母 + 声调，第 3 站看图选音节为主。
 */
export function makeQuestionForStage(stage: 1 | 2 | 3, rand: () => number = Math.random): PinyinQuestion {
  if (stage === 1) {
    return rand() < 0.5 ? makeVowelQuestion(rand) : makeInitialQuestion(rand);
  }
  if (stage === 2) {
    return rand() < 0.5 ? makeMatchQuestion(rand) : makeToneQuestion(rand);
  }
  const r = rand();
  if (r < 0.6) return makeSyllableQuestion(rand);
  if (r < 0.8) return makeToneQuestion(rand);
  return makeMatchQuestion(rand);
}

// ===========================================================================
// 1.1 追加：第 100–188 关的高年级题库
// 整体认读音节 / 多音字辨析 / 轻声与儿化 / 句子注音
// 以下全部是新增内容，前 99 关的题库与出题函数一个字都没动。
// ===========================================================================

/** 声调符号表：基础元音 → 一二三四声 */
const TONED_VOWELS: Record<string, string[]> = {
  a: ["ā", "á", "ǎ", "à"],
  o: ["ō", "ó", "ǒ", "ò"],
  e: ["ē", "é", "ě", "è"],
  i: ["ī", "í", "ǐ", "ì"],
  u: ["ū", "ú", "ǔ", "ù"],
  "ü": ["ǖ", "ǘ", "ǚ", "ǜ"],
};

/** 反查表：带调字母 → { 基础字母, 声调 } */
const TONE_LOOKUP: Record<string, { base: string; tone: number }> = (() => {
  const map: Record<string, { base: string; tone: number }> = {};
  for (const [base, forms] of Object.entries(TONED_VOWELS)) {
    forms.forEach((f, i) => {
      map[f] = { base, tone: i + 1 };
    });
  }
  return map;
})();

/** 音节的声调：1..4，轻声（没有调号）返回 0 */
export function toneOf(syllable: string): number {
  for (const ch of syllable) {
    const hit = TONE_LOOKUP[ch];
    if (hit) return hit.tone;
  }
  return 0;
}

/** 去掉调号，得到「光板」音节（轻声本来就没调号，原样返回） */
export function stripTone(syllable: string): string {
  let out = "";
  for (const ch of syllable) out += TONE_LOOKUP[ch]?.base ?? ch;
  return out;
}

/**
 * 给光板音节标调（tone 为 0 就是轻声，不加调号）。
 * 标调规则：有 a 标 a，没 a 找 o / e，iu 标后面的 u，ui 标后面的 i，其余标唯一的元音。
 */
export function applyTone(plain: string, tone: number): string {
  if (tone <= 0 || tone > 4) return plain;
  let idx = -1;
  for (const v of ["a", "o", "e"]) {
    idx = plain.indexOf(v);
    if (idx >= 0) break;
  }
  if (idx < 0) {
    if (plain.includes("iu")) idx = plain.indexOf("iu") + 1;
    else if (plain.includes("ui")) idx = plain.indexOf("ui") + 1;
    else idx = plain.search(/[iuü]/);
  }
  if (idx < 0) return plain;
  const forms = TONED_VOWELS[plain[idx]];
  if (!forms) return plain;
  return plain.slice(0, idx) + forms[tone - 1] + plain.slice(idx + 1);
}

/** 十六个整体认读音节：看见就整个儿读出来，不用拼 */
export const WHOLE_READ_SYLLABLES = [
  "zhi", "chi", "shi", "ri", "zi", "ci", "si", "yi",
  "wu", "yu", "ye", "yue", "yuan", "yin", "yun", "ying",
];

/** 长得像整体认读、其实要拼读的音节，用来做干扰项 */
export const SPELL_ONLY_SYLLABLES = [
  "zha", "zhe", "zhu", "zhao", "cha", "che", "chu", "chao",
  "sha", "she", "shu", "shao", "re", "ru", "rao", "za",
  "ze", "zu", "zao", "ca", "ce", "cu", "sa", "se",
  "su", "ya", "yao", "you", "yang", "yong", "wa", "wo",
  "wan", "wen", "wang", "weng",
];

/** 多音字的一个读音：同一个字在不同词里读法不同 */
export interface DuoyinReading {
  pinyin: string;
  /** 这个读音的常用词（第一个用于选词题） */
  words: string[];
  /** 一句能读出这个音的例句 */
  sentence: string;
}

export interface DuoyinCard {
  char: string;
  readings: DuoyinReading[];
}

/** 多音字卡：每个字两个读音，词与例句都能反过来验证读音 */
export const DUOYIN_CARDS: DuoyinCard[] = [
  {
    char: "行",
    readings: [
      { pinyin: "háng", words: ["银行", "行业", "同行"], sentence: "爸爸带我去银行存压岁钱" },
      { pinyin: "xíng", words: ["行走", "行动", "不行"], sentence: "我们沿着小路行走了很久" },
    ],
  },
  {
    char: "长",
    readings: [
      { pinyin: "cháng", words: ["长短", "长跑", "长江"], sentence: "这条丝带的长短正合适" },
      { pinyin: "zhǎng", words: ["长大", "生长", "校长"], sentence: "小树苗一年就长大了一截" },
    ],
  },
  {
    char: "重",
    readings: [
      { pinyin: "chóng", words: ["重复", "重叠", "重来"], sentence: "这道题他重复检查了三遍" },
      { pinyin: "zhòng", words: ["重量", "重要", "轻重"], sentence: "这个箱子的重量超过十斤" },
    ],
  },
  {
    char: "乐",
    readings: [
      { pinyin: "lè", words: ["快乐", "乐园", "欢乐"], sentence: "运动会上大家都特别快乐" },
      { pinyin: "yuè", words: ["音乐", "乐曲", "乐器"], sentence: "音乐课上我们学了一首新歌" },
    ],
  },
  {
    char: "数",
    readings: [
      { pinyin: "shǔ", words: ["数一数", "数星星", "数不清"], sentence: "我们一起数一数天上的星星" },
      { pinyin: "shù", words: ["数学", "分数", "数字"], sentence: "数学作业里有一道思考题" },
    ],
  },
  {
    char: "好",
    readings: [
      { pinyin: "hǎo", words: ["好看", "好人", "美好"], sentence: "这本书里的插图真好看" },
      { pinyin: "hào", words: ["爱好", "好奇", "好学"], sentence: "他的爱好是收集各地邮票" },
    ],
  },
  {
    char: "觉",
    readings: [
      { pinyin: "jué", words: ["觉得", "感觉", "自觉"], sentence: "我觉得这个办法很聪明" },
      { pinyin: "jiào", words: ["睡觉", "午觉", "困觉"], sentence: "弟弟中午一定要睡午觉" },
    ],
  },
  {
    char: "空",
    readings: [
      { pinyin: "kōng", words: ["天空", "空气", "空中"], sentence: "雨后的天空格外干净" },
      { pinyin: "kòng", words: ["有空", "空闲", "空隙"], sentence: "周末有空我们一起去打球" },
    ],
  },
  {
    char: "发",
    readings: [
      { pinyin: "fā", words: ["发现", "出发", "发明"], sentence: "他发现墙角冒出一株新芽" },
      { pinyin: "fà", words: ["头发", "理发", "白发"], sentence: "奶奶的头发已经花白了" },
    ],
  },
  {
    char: "教",
    readings: [
      { pinyin: "jiāo", words: ["教书", "教课", "教唱"], sentence: "王老师在乡下教书三十年" },
      { pinyin: "jiào", words: ["教室", "教育", "请教"], sentence: "教室里安静得能听见笔尖声" },
    ],
  },
  {
    char: "种",
    readings: [
      { pinyin: "zhǒng", words: ["种子", "品种", "各种"], sentence: "这些种子明年春天就会发芽" },
      { pinyin: "zhòng", words: ["种树", "种花", "栽种"], sentence: "植树节那天我们一起去种树" },
    ],
  },
  {
    char: "假",
    readings: [
      { pinyin: "jiǎ", words: ["假装", "真假", "假如"], sentence: "他假装没听见，偷偷笑了" },
      { pinyin: "jià", words: ["放假", "暑假", "假期"], sentence: "暑假我要读完这套课外书" },
    ],
  },
  {
    char: "还",
    readings: [
      { pinyin: "hái", words: ["还有", "还好", "还是"], sentence: "作业还有一小半没写完" },
      { pinyin: "huán", words: ["还书", "归还", "还给"], sentence: "记得明天去图书馆还书" },
    ],
  },
  {
    char: "转",
    readings: [
      { pinyin: "zhuàn", words: ["转圈", "转动", "打转"], sentence: "风车在屋顶上一直转圈" },
      { pinyin: "zhuǎn", words: ["转弯", "转身", "转告"], sentence: "前面路口向左转弯就到了" },
    ],
  },
  {
    char: "相",
    readings: [
      { pinyin: "xiāng", words: ["互相", "相同", "相信"], sentence: "同学之间要互相帮助" },
      { pinyin: "xiàng", words: ["照相", "相片", "相貌"], sentence: "我们在山顶照相留念" },
    ],
  },
  {
    char: "卷",
    readings: [
      { pinyin: "juǎn", words: ["卷起", "卷发", "卷尺"], sentence: "风把地上的落叶卷起来" },
      { pinyin: "juàn", words: ["试卷", "画卷", "书卷"], sentence: "老师把试卷一张张发下来" },
    ],
  },
  {
    char: "干",
    readings: [
      { pinyin: "gān", words: ["干净", "干燥", "饼干"], sentence: "雨后的空气清新又干净" },
      { pinyin: "gàn", words: ["干活", "能干", "干劲"], sentence: "大家一起干活很快就收拾好了" },
    ],
  },
  {
    char: "只",
    readings: [
      { pinyin: "zhī", words: ["一只", "两只", "只身"], sentence: "树枝上停着一只灰喜鹊" },
      { pinyin: "zhǐ", words: ["只有", "只要", "只是"], sentence: "只要坚持就会有收获" },
    ],
  },
];

/** 轻声词：第二个字读轻声（没有调号） */
export interface NeutralWord {
  word: string;
  syllables: [string, string];
}

export const NEUTRAL_WORDS: NeutralWord[] = [
  { word: "桌子", syllables: ["zhuō", "zi"] },
  { word: "椅子", syllables: ["yǐ", "zi"] },
  { word: "石头", syllables: ["shí", "tou"] },
  { word: "我们", syllables: ["wǒ", "men"] },
  { word: "朋友", syllables: ["péng", "you"] },
  { word: "眼睛", syllables: ["yǎn", "jing"] },
  { word: "耳朵", syllables: ["ěr", "duo"] },
  { word: "萝卜", syllables: ["luó", "bo"] },
  { word: "蘑菇", syllables: ["mó", "gu"] },
  { word: "喜欢", syllables: ["xǐ", "huan"] },
  { word: "明白", syllables: ["míng", "bai"] },
  { word: "暖和", syllables: ["nuǎn", "huo"] },
  { word: "舒服", syllables: ["shū", "fu"] },
  { word: "客气", syllables: ["kè", "qi"] },
  { word: "收拾", syllables: ["shōu", "shi"] },
  { word: "衣服", syllables: ["yī", "fu"] },
  { word: "力气", syllables: ["lì", "qi"] },
  { word: "故事", syllables: ["gù", "shi"] },
  { word: "时候", syllables: ["shí", "hou"] },
  { word: "妈妈", syllables: ["mā", "ma"] },
];

/** 对照组：两个字都有声调的普通双音节词 */
export const TONED_WORDS: NeutralWord[] = [
  { word: "学习", syllables: ["xué", "xí"] },
  { word: "老师", syllables: ["lǎo", "shī"] },
  { word: "火车", syllables: ["huǒ", "chē"] },
  { word: "大海", syllables: ["dà", "hǎi"] },
  { word: "白云", syllables: ["bái", "yún"] },
  { word: "春天", syllables: ["chūn", "tiān"] },
  { word: "铅笔", syllables: ["qiān", "bǐ"] },
  { word: "书包", syllables: ["shū", "bāo"] },
  { word: "雨伞", syllables: ["yǔ", "sǎn"] },
  { word: "公园", syllables: ["gōng", "yuán"] },
  { word: "森林", syllables: ["sēn", "lín"] },
  { word: "校园", syllables: ["xiào", "yuán"] },
  { word: "课本", syllables: ["kè", "běn"] },
  { word: "山峰", syllables: ["shān", "fēng"] },
];

/** 儿化词：末尾卷个舌，两个字连成一个音节 */
export interface ErhuaWord {
  word: string;
  /** 没儿化时的读音 */
  base: string;
  /** 儿化后的读音 */
  erhua: string;
}

export const ERHUA_WORDS: ErhuaWord[] = [
  { word: "花儿", base: "huā", erhua: "huār" },
  { word: "鸟儿", base: "niǎo", erhua: "niǎor" },
  { word: "玩儿", base: "wán", erhua: "wánr" },
  { word: "画儿", base: "huà", erhua: "huàr" },
  { word: "味儿", base: "wèi", erhua: "wèir" },
  { word: "门儿", base: "mén", erhua: "ménr" },
  { word: "事儿", base: "shì", erhua: "shìr" },
  { word: "空儿", base: "kòng", erhua: "kòngr" },
  { word: "头儿", base: "tóu", erhua: "tóur" },
  { word: "边儿", base: "biān", erhua: "biānr" },
  { word: "面儿", base: "miàn", erhua: "miànr" },
  { word: "歌儿", base: "gē", erhua: "gēr" },
];

/** 整句注音：text 的每个字对应 syllables 的同位音节 */
export interface PinyinSentence {
  text: string;
  syllables: string[];
}

export const PINYIN_SENTENCES: PinyinSentence[] = [
  {
    text: "晚风把院子里的花香送进屋",
    syllables: ["wǎn", "fēng", "bǎ", "yuàn", "zi", "lǐ", "de", "huā", "xiāng", "sòng", "jìn", "wū"],
  },
  {
    text: "小溪的水清凉又干净",
    syllables: ["xiǎo", "xī", "de", "shuǐ", "qīng", "liáng", "yòu", "gān", "jìng"],
  },
  {
    text: "我们在操场上练习跳绳",
    syllables: ["wǒ", "men", "zài", "cāo", "chǎng", "shàng", "liàn", "xí", "tiào", "shéng"],
  },
  {
    text: "秋天的枫叶红得像小火苗",
    syllables: ["qiū", "tiān", "de", "fēng", "yè", "hóng", "de", "xiàng", "xiǎo", "huǒ", "miáo"],
  },
  {
    text: "月光洒在安静的湖面上",
    syllables: ["yuè", "guāng", "sǎ", "zài", "ān", "jìng", "de", "hú", "miàn", "shàng"],
  },
  {
    text: "小猫踩着落叶走过花园",
    syllables: ["xiǎo", "māo", "cǎi", "zhe", "luò", "yè", "zǒu", "guò", "huā", "yuán"],
  },
  {
    text: "雨点敲打着屋檐上的青瓦",
    syllables: ["yǔ", "diǎn", "qiāo", "dǎ", "zhe", "wū", "yán", "shàng", "de", "qīng", "wǎ"],
  },
  {
    text: "同学们围坐在树荫下读诗",
    syllables: ["tóng", "xué", "men", "wéi", "zuò", "zài", "shù", "yīn", "xià", "dú", "shī"],
  },
  {
    text: "远处的山峰披着淡淡的云",
    syllables: ["yuǎn", "chù", "de", "shān", "fēng", "pī", "zhe", "dàn", "dàn", "de", "yún"],
  },
  {
    text: "厨房里飘出米饭的香味",
    syllables: ["chú", "fáng", "lǐ", "piāo", "chū", "mǐ", "fàn", "de", "xiāng", "wèi"],
  },
  {
    text: "他把心里的想法写进日记",
    syllables: ["tā", "bǎ", "xīn", "lǐ", "de", "xiǎng", "fǎ", "xiě", "jìn", "rì", "jì"],
  },
  {
    text: "清晨的露珠挂在草叶尖上",
    syllables: ["qīng", "chén", "de", "lù", "zhū", "guà", "zài", "cǎo", "yè", "jiān", "shàng"],
  },
];
