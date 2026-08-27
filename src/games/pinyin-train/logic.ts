// 拼音小火车：出题纯逻辑（三站递进 + 声调题 + 看图选音节）
import {
  markTone,
  readTone,
  removeToneMarks,
  WHOLE_READ_SYLLABLES as WHOLE_READ,
} from "./pinyin";

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

/**
 * 音节的声调：1..4，轻声（没有调号）返回 0。
 * 1.2 起规则统一收在 `pinyin.ts`，这里只做转调，结果与 1.1 完全一致。
 */
export function toneOf(syllable: string): number {
  return readTone(syllable);
}

/** 去掉调号，得到「光板」音节（轻声本来就没调号，原样返回） */
export function stripTone(syllable: string): string {
  return removeToneMarks(syllable);
}

/**
 * 给光板音节标调（tone 为 0 就是轻声，不加调号）。
 * 标调规则见 `pinyin.ts` 的 `toneTargetIndex`：有 a 标 a，没 a 找 o / e，
 * 都没有就标在最后一个 i / u / ü 上（iu 标 u、ui 标 i 都由这一条覆盖）。
 */
export function applyTone(plain: string, tone: number): string {
  return markTone(plain, tone);
}

/** 十六个整体认读音节：看见就整个儿读出来，不用拼（数据在 `pinyin.ts`） */
export const WHOLE_READ_SYLLABLES: readonly string[] = WHOLE_READ;

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
      // 「同行」两读都标准（tóng háng 同业 / tóng xíng 结伴走），词本身定不了音，换成只读 háng 的「行列」
      { pinyin: "háng", words: ["银行", "行业", "行列"], sentence: "爸爸带我去银行存压岁钱" },
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
      // 「好学」两读都标准（hào xué 爱学 / hǎo xué 容易学），换成只读 hào 的「好动」
      { pinyin: "hào", words: ["爱好", "好奇", "好动"], sentence: "他的爱好是收集各地邮票" },
    ],
  },
  {
    char: "觉",
    readings: [
      { pinyin: "jué", words: ["觉得", "感觉", "自觉"], sentence: "我觉得这个办法很聪明" },
      // 「困觉」是方言词（现汉标〈方〉），普通话不这么说，换成同样常见的「懒觉」
      { pinyin: "jiào", words: ["睡觉", "午觉", "懒觉"], sentence: "弟弟中午一定要睡午觉" },
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
      // 「转动」两读都收（zhuàn dòng 打转 / zhuǎn dòng 挪动），和「同行」同一类毛病，换成只读 zhuàn 的「转盘」
      { pinyin: "zhuàn", words: ["转圈", "转盘", "打转"], sentence: "风车在屋顶上一直转圈" },
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

// ===========================================================================
// 1.2 追加：易混淆专项 / 标声调 / 拼读组合的题库
// 以下全部是新增数据，上面 1.0 与 1.1 的题库一个字都没动。
// ===========================================================================

/** 一个易混淆的字：正确读音，外加同组里最像的那个错读音 */
export interface ConfuseItem {
  /** 单音字（不要放多音字，否则「唯一正确答案」立不住） */
  char: string;
  /** 正确读音（带调号） */
  pinyin: string;
  /** 同组对手的读音：只差组内那一个特征，且本身是合法音节写法 */
  rival: string;
}

/** 一组容易混的声母或韵母 */
export interface ConfuseGroup {
  id: string;
  /** 展示名，例如「b d p q」 */
  name: string;
  /** 这一组混的是声母还是韵母 */
  kind: "initial" | "final";
  members: string[];
  /** 判别方法，只讲怎么想，不写任何一题的答案 */
  tip: string;
  /** 挖空题的第三个选项（同组只有两个成员时补上一个近邻） */
  extras: string[];
  items: ConfuseItem[];
  /** 每个成员的音节池，「找出读音不同的一个」从这里取 */
  pools: Record<string, string[]>;
}

/** 六组专项：形近四胞胎、鼻音、唇齿与喉、前后鼻韵母、平翘舌 */
export const CONFUSE_GROUPS: ConfuseGroup[] = [
  {
    id: "b-d-p-q",
    name: "b d p q",
    kind: "initial",
    members: ["b", "d", "p", "q"],
    tip: "先看竖线在左边还是右边，再看半圆朝上还是朝下。",
    extras: [],
    items: [
      { char: "八", pinyin: "bā", rival: "pā" },
      { char: "爸", pinyin: "bà", rival: "pà" },
      { char: "大", pinyin: "dà", rival: "bà" },
      { char: "弟", pinyin: "dì", rival: "qì" },
      { char: "皮", pinyin: "pí", rival: "bí" },
      { char: "跑", pinyin: "pǎo", rival: "bǎo" },
      { char: "七", pinyin: "qī", rival: "pī" },
      { char: "去", pinyin: "qù", rival: "bù" },
    ],
    pools: {
      b: ["bā", "bǐ", "bù", "bái", "bào"],
      d: ["dà", "dì", "dù", "dài", "dào"],
      p: ["pá", "pí", "pǎo", "pài", "pù"],
      q: ["qī", "qí", "qù", "qiū", "qiáo"],
    },
  },
  {
    id: "n-l",
    name: "n l",
    kind: "initial",
    members: ["n", "l"],
    tip: "捏住鼻子念一遍，鼻子发麻的那个是鼻音。",
    extras: ["m"],
    items: [
      { char: "那", pinyin: "nà", rival: "là" },
      { char: "男", pinyin: "nán", rival: "lán" },
      { char: "牛", pinyin: "niú", rival: "liú" },
      { char: "女", pinyin: "nǚ", rival: "lǚ" },
      { char: "老", pinyin: "lǎo", rival: "nǎo" },
      { char: "你", pinyin: "nǐ", rival: "lǐ" },
      { char: "力", pinyin: "lì", rival: "nì" },
      { char: "蓝", pinyin: "lán", rival: "nán" },
    ],
    pools: {
      n: ["nà", "nán", "niú", "nǚ", "nǎo", "nǐ"],
      l: ["là", "lán", "liú", "lǜ", "lǎo", "lǐ"],
    },
  },
  {
    id: "f-h",
    name: "f h",
    kind: "initial",
    members: ["f", "h"],
    tip: "上牙咬住下唇送气的是一个，喉咙里呼气的是另一个。",
    extras: ["k"],
    items: [
      { char: "飞", pinyin: "fēi", rival: "hēi" },
      { char: "饭", pinyin: "fàn", rival: "hàn" },
      { char: "风", pinyin: "fēng", rival: "hēng" },
      { char: "发", pinyin: "fā", rival: "hā" },
      { char: "黑", pinyin: "hēi", rival: "fēi" },
      { char: "很", pinyin: "hěn", rival: "fěn" },
      { char: "汗", pinyin: "hàn", rival: "fàn" },
      { char: "房", pinyin: "fáng", rival: "háng" },
    ],
    pools: {
      f: ["fēi", "fàn", "fēng", "fā", "fáng"],
      h: ["hēi", "hàn", "hěn", "hā", "háng"],
    },
  },
  {
    id: "an-ang",
    name: "an ang",
    kind: "final",
    members: ["an", "ang"],
    tip: "收音时舌尖抵住上齿龈的是前鼻韵母，舌根抬起来的是后鼻韵母。",
    extras: ["en", "eng"],
    items: [
      { char: "山", pinyin: "shān", rival: "shāng" },
      { char: "蓝", pinyin: "lán", rival: "láng" },
      { char: "班", pinyin: "bān", rival: "bāng" },
      { char: "半", pinyin: "bàn", rival: "bàng" },
      { char: "上", pinyin: "shàng", rival: "shàn" },
      { char: "忙", pinyin: "máng", rival: "mán" },
      { char: "帮", pinyin: "bāng", rival: "bān" },
      { char: "光", pinyin: "guāng", rival: "guān" },
    ],
    pools: {
      an: ["shān", "lán", "bān", "bàn", "sān", "guān"],
      ang: ["shāng", "láng", "bāng", "bàng", "sāng", "guāng"],
    },
  },
  {
    id: "in-ing",
    name: "in ing",
    kind: "final",
    members: ["in", "ing"],
    tip: "把手放在鼻梁上念，震得厉害、尾音拖长的那个是后鼻韵母。",
    extras: ["en", "eng"],
    items: [
      { char: "星", pinyin: "xīng", rival: "xīn" },
      { char: "心", pinyin: "xīn", rival: "xīng" },
      { char: "林", pinyin: "lín", rival: "líng" },
      { char: "铃", pinyin: "líng", rival: "lín" },
      { char: "金", pinyin: "jīn", rival: "jīng" },
      { char: "京", pinyin: "jīng", rival: "jīn" },
      { char: "明", pinyin: "míng", rival: "mín" },
      { char: "民", pinyin: "mín", rival: "míng" },
    ],
    pools: {
      in: ["xīn", "lín", "jīn", "mín", "pǐn", "bīn"],
      ing: ["xīng", "líng", "jīng", "míng", "pīng", "bīng"],
    },
  },
  {
    id: "z-zh",
    name: "z zh",
    kind: "initial",
    members: ["z", "zh"],
    tip: "舌尖平平贴着下齿的是平舌音，舌尖翘起来抵住上颚的是翘舌音。",
    extras: ["c"],
    items: [
      { char: "早", pinyin: "zǎo", rival: "zhǎo" },
      { char: "字", pinyin: "zì", rival: "zhì" },
      { char: "走", pinyin: "zǒu", rival: "zhǒu" },
      { char: "坐", pinyin: "zuò", rival: "zhuò" },
      { char: "找", pinyin: "zhǎo", rival: "zǎo" },
      { char: "知", pinyin: "zhī", rival: "zī" },
      { char: "纸", pinyin: "zhǐ", rival: "zǐ" },
      { char: "中", pinyin: "zhōng", rival: "zōng" },
    ],
    pools: {
      z: ["zǎo", "zì", "zǒu", "zuò", "zī", "zǐ"],
      zh: ["zhǎo", "zhì", "zhǒu", "zhuò", "zhī", "zhǐ"],
    },
  },
];

/** 按 id 找一组（找不到就退回第一组，绝不返回 undefined 让出题崩掉） */
export function confuseGroupById(id: string): ConfuseGroup {
  return CONFUSE_GROUPS.find((g) => g.id === id) ?? CONFUSE_GROUPS[0];
}

/** 标声调专用卡：光板音节 + 该标的调 + 一个能对上的字 */
export interface ToneDrillCard {
  plain: string;
  tone: number;
  word: string;
}

/**
 * 标声调题库：每张卡都至少有两个能戴调号的字母，
 * 覆盖 iu / ui / üe / ao / ei / ie / ou / uo / uai / iao 等课本反复强调的组合。
 */
export const TONE_DRILL_CARDS: ToneDrillCard[] = [
  { plain: "hao", tone: 3, word: "好" },
  { plain: "liu", tone: 2, word: "流" },
  { plain: "shui", tone: 3, word: "水" },
  { plain: "xue", tone: 2, word: "学" },
  { plain: "mei", tone: 3, word: "美" },
  { plain: "xie", tone: 3, word: "写" },
  { plain: "gou", tone: 3, word: "狗" },
  { plain: "huo", tone: 3, word: "火" },
  { plain: "kuai", tone: 4, word: "快" },
  { plain: "jiu", tone: 3, word: "九" },
  { plain: "gui", tone: 1, word: "龟" },
  { plain: "lüe", tone: 4, word: "略" },
  { plain: "niao", tone: 3, word: "鸟" },
  { plain: "bai", tone: 2, word: "白" },
  { plain: "tiao", tone: 4, word: "跳" },
  { plain: "zhuo", tone: 1, word: "桌" },
  { plain: "xiu", tone: 1, word: "休" },
  { plain: "dui", tone: 4, word: "对" },
  { plain: "yue", tone: 4, word: "月" },
  { plain: "you", tone: 3, word: "有" },
];

/** 拼读车厢卡：声母 + 韵母（基本形）+ 声调，拼出来就是那个字的音 */
export interface SpellCard {
  word: string;
  emoji: string;
  /** 声母；零声母写 "y" / "w"（按隔音规则处理） */
  initial: string;
  /** 韵母基本形：三拼不省写、ü 带两点 */
  final: string;
  tone: number;
  /** 属于哪几组易混淆（专项章按组挑卡；不属于任何一组就留空） */
  groups: string[];
}

export const SPELL_CARDS: SpellCard[] = [
  { word: "妈", emoji: "👩", initial: "m", final: "a", tone: 1, groups: [] },
  { word: "水", emoji: "💧", initial: "sh", final: "uei", tone: 3, groups: [] },
  { word: "学", emoji: "📚", initial: "x", final: "üe", tone: 2, groups: [] },
  { word: "女", emoji: "👧", initial: "n", final: "ü", tone: 3, groups: ["n-l"] },
  { word: "绿", emoji: "🟢", initial: "l", final: "ü", tone: 4, groups: ["n-l"] },
  { word: "六", emoji: "6️⃣", initial: "l", final: "iou", tone: 4, groups: ["n-l"] },
  { word: "牛", emoji: "🐮", initial: "n", final: "iou", tone: 2, groups: ["n-l"] },
  { word: "龟", emoji: "🐢", initial: "g", final: "uei", tone: 1, groups: [] },
  { word: "火", emoji: "🔥", initial: "h", final: "uo", tone: 3, groups: ["f-h"] },
  { word: "花", emoji: "🌸", initial: "h", final: "ua", tone: 1, groups: ["f-h"] },
  { word: "飞", emoji: "✈️", initial: "f", final: "ei", tone: 1, groups: ["f-h"] },
  { word: "风", emoji: "🌬️", initial: "f", final: "eng", tone: 1, groups: ["f-h"] },
  { word: "山", emoji: "⛰️", initial: "sh", final: "an", tone: 1, groups: ["an-ang"] },
  { word: "上", emoji: "⬆️", initial: "sh", final: "ang", tone: 4, groups: ["an-ang"] },
  { word: "蓝", emoji: "🟦", initial: "l", final: "an", tone: 2, groups: ["an-ang", "n-l"] },
  { word: "星", emoji: "⭐", initial: "x", final: "ing", tone: 1, groups: ["in-ing"] },
  { word: "心", emoji: "❤️", initial: "x", final: "in", tone: 1, groups: ["in-ing"] },
  { word: "明", emoji: "🌞", initial: "m", final: "ing", tone: 2, groups: ["in-ing"] },
  { word: "金", emoji: "🪙", initial: "j", final: "in", tone: 1, groups: ["in-ing"] },
  { word: "早", emoji: "🌅", initial: "z", final: "ao", tone: 3, groups: ["z-zh"] },
  { word: "找", emoji: "🔍", initial: "zh", final: "ao", tone: 3, groups: ["z-zh"] },
  { word: "桌", emoji: "🪑", initial: "zh", final: "uo", tone: 1, groups: ["z-zh"] },
  { word: "字", emoji: "🔤", initial: "z", final: "i", tone: 4, groups: ["z-zh"] },
  { word: "八", emoji: "8️⃣", initial: "b", final: "a", tone: 1, groups: ["b-d-p-q"] },
  { word: "大", emoji: "🐘", initial: "d", final: "a", tone: 4, groups: ["b-d-p-q"] },
  { word: "跑", emoji: "🏃", initial: "p", final: "ao", tone: 3, groups: ["b-d-p-q"] },
  { word: "七", emoji: "7️⃣", initial: "q", final: "i", tone: 1, groups: ["b-d-p-q"] },
  { word: "月", emoji: "🌙", initial: "y", final: "üe", tone: 4, groups: [] },
  { word: "鱼", emoji: "🐟", initial: "y", final: "ü", tone: 2, groups: [] },
  { word: "云", emoji: "☁️", initial: "y", final: "ün", tone: 2, groups: [] },
];
