/**
 * 王子公主大冒险 · 关卡元素规范表(纯数据 + 查表函数,不碰 DOM)。
 *
 * 这是 1.2 这一步的核心交付。
 *
 * 1.1 的毛病在这儿写清楚:画面上「碰到掉心的」和「捡了加分的」共用同一批发光小图标,
 * 平台和地面几乎同色又没有描边,而危险的颜色还跟着 `PALETTES` 按章节换——
 * 同一个含义在第一章和第五章长得完全不是一回事。孩子只能靠挨一下才知道哪个不能碰。
 *
 * 所以这里把**含义**而不是**章节**钉死:
 *
 *  - 危险 `hazard`:尖锐三角,暖红填色 + 深红粗描边,**只有危险用三角形**;
 *  - 可踩 `stand`:圆角横条,奶油填色 + 深棕描边 + 顶上一条亮边,**只有能站的东西有亮顶边**;
 *  - 可推 `push` :方块,木色填色 + 深棕描边 + 一圈虚线「推我」纹,**只有方块推得动**;
 *  - 奖励 `reward`:菱形,金色填色 + 琥珀描边 + 外发光,**只有奖励发光**;
 *  - 出口 `exit`  :拱门,青绿填色 + 深绿描边,**只有出口是拱形**;
 *  - 检查点 `checkpoint`:小旗,天蓝填色 + 深蓝描边,**只有检查点是旗子**。
 *
 * 六个角色的**形状两两不同、描边色两两不同**,这样即使孩子分不清颜色(也照顾到色觉差异),
 * 光看轮廓也认得出来。渲染层照着这张表画,`guide.ts` 把同一张表翻成孩子能读的图例——
 * 攻略抽屉里看到的和关卡里看到的永远是同一套。
 *
 * 全 188 关统一:这张表**不接受任何章节参数**,查不到章节就改不出「这一章特殊」的花样。
 */
import type { LevelDef } from "./levels";

/** 六个含义角色 */
export type ElementRole = "hazard" | "stand" | "push" | "reward" | "exit" | "checkpoint";

/** 规范表里钉死的形状 */
export type ElementShape = "spike" | "slab" | "crate" | "gemCut" | "arch" | "flag";

export interface ElementSpec {
  role: ElementRole;
  /** 给孩子看的名字 */
  label: string;
  /** 一句话规矩(攻略图例直接用这一句) */
  rule: string;
  shape: ElementShape;
  /** 填色 */
  fill: string;
  /** 描边色 */
  stroke: string;
  /** 描边宽(px,按 1 倍缩放) */
  strokeWidth: number;
  /** 顶上那条亮边:只有「能站上去」的东西有 */
  topLight: string | null;
  /** 外发光:只有奖励有 */
  glow: string | null;
  /** HUD 与图例上的小图标 */
  icon: string;
}

/**
 * 六条规范。改这里等于改全 188 关的长相,所以每一条都写了「为什么是这个形状」。
 */
export const ELEMENT_SPECS: Record<ElementRole, ElementSpec> = {
  hazard: {
    role: "hazard",
    label: "别碰",
    rule: "尖尖的三角 + 深红边:碰到会闪一下小护盾,绕开或者跳过去。",
    shape: "spike",
    fill: "#E2705F",
    stroke: "#8E2F26",
    strokeWidth: 3,
    topLight: null,
    glow: null,
    icon: "⚠️",
  },
  stand: {
    role: "stand",
    label: "能站",
    rule: "圆角横条 + 顶上一条亮边:亮边就是踩得住的那一面。",
    shape: "slab",
    fill: "#FCE9C8",
    stroke: "#8A5A2B",
    strokeWidth: 3,
    topLight: "#FFF6DF",
    glow: null,
    icon: "🟫",
  },
  push: {
    role: "push",
    label: "能推",
    rule: "方方的箱子 + 一圈小虚线:只有王子推得动,推进断口就架成一座桥。",
    shape: "crate",
    fill: "#D9A566",
    stroke: "#6E4522",
    strokeWidth: 3,
    topLight: null,
    glow: null,
    icon: "📦",
  },
  reward: {
    role: "reward",
    label: "捡我",
    rule: "会发光的菱形:捡到就加分,只有奖励会发光。",
    shape: "gemCut",
    fill: "#FFD35C",
    stroke: "#C98A17",
    strokeWidth: 2,
    topLight: null,
    glow: "#FFF0B8",
    icon: "💎",
  },
  exit: {
    role: "exit",
    label: "出口",
    rule: "青绿色的拱门:走到这儿这一关就完成啦。",
    shape: "arch",
    fill: "#8ED6B4",
    stroke: "#2F7A57",
    strokeWidth: 3,
    topLight: null,
    glow: null,
    icon: "🚪",
  },
  checkpoint: {
    role: "checkpoint",
    label: "休息点",
    rule: "蓝色的小旗:走过就点亮,摔下去会被小云朵托回最近那面旗。",
    shape: "flag",
    fill: "#8FC6F0",
    stroke: "#2A5F92",
    strokeWidth: 3,
    topLight: null,
    glow: null,
    icon: "🚩",
  },
};

/** 遍历顺序固定,图例与用例都靠它 */
export const ELEMENT_ROLES: ElementRole[] = ["hazard", "stand", "push", "reward", "exit", "checkpoint"];

/**
 * 关卡里真实摆得出来的每一种具体元素。
 * 每加一种新机关就得在这儿登记,否则 `elements.test.ts` 会当场红给你看。
 */
export type ElementKind =
  | "ground"
  | "platformSolid"
  | "platformMove"
  | "heavyBlock"
  | "gap"
  | "spike"
  | "enemySlime"
  | "enemyBat"
  | "enemyArmor"
  | "enemyGhost"
  | "enemyTurret"
  | "enemyShot"
  | "boss"
  | "gem"
  | "door"
  | "checkpointFlag";

/** 具体元素 → 含义角色。全 188 关只认这一张映射 */
export const ELEMENT_ROLE_OF: Record<ElementKind, ElementRole> = {
  ground: "stand",
  platformSolid: "stand",
  platformMove: "stand",
  heavyBlock: "push",
  gap: "hazard",
  spike: "hazard",
  enemySlime: "hazard",
  enemyBat: "hazard",
  enemyArmor: "hazard",
  enemyGhost: "hazard",
  enemyTurret: "hazard",
  enemyShot: "hazard",
  boss: "hazard",
  gem: "reward",
  door: "exit",
  checkpointFlag: "checkpoint",
};

export const ELEMENT_KINDS = Object.keys(ELEMENT_ROLE_OF) as ElementKind[];

/** 查这一种元素该照哪一条规范画 */
export function specFor(kind: ElementKind): ElementSpec {
  return ELEMENT_SPECS[ELEMENT_ROLE_OF[kind]];
}

/** 按角色取规范 */
export function specOfRole(role: ElementRole): ElementSpec {
  return ELEMENT_SPECS[role];
}

/** 果冻怪那类小怪的元素名 */
export function enemyElementKind(kind: string): ElementKind {
  switch (kind) {
    case "slime":
      return "enemySlime";
    case "bat":
      return "enemyBat";
    case "armor":
      return "enemyArmor";
    case "ghost":
      return "enemyGhost";
    case "turret":
      return "enemyTurret";
    default:
      return "enemySlime";
  }
}

/**
 * 这一关摆了哪些元素(用例遍历 188 关就是拿它取并集,
 * 确认每一种真的出现过的东西都查得到规范条目)。
 */
export function elementsInLevel(def: LevelDef): ElementKind[] {
  const out = new Set<ElementKind>(["ground", "door"]);
  for (const p of def.platforms) out.add(p.kind === "move" ? "platformMove" : "platformSolid");
  if (def.gaps.length > 0) out.add("gap");
  if (def.spikes.length > 0) out.add("spike");
  if (def.gems.length > 0) out.add("gem");
  if (def.boss) out.add("boss");
  for (const e of def.enemies) {
    out.add(enemyElementKind(e.kind));
    if (e.kind === "turret") out.add("enemyShot");
  }
  if ((def.blocks ?? []).length > 0) out.add("heavyBlock");
  // 检查点是 1.2 起每一关都有的东西(`checkpoints.ts` 至少给两面旗)
  out.add("checkpointFlag");
  return [...out];
}

/** 图例文字:攻略抽屉与教学关都用这一份,一行一条,短句 */
export function legendLines(): string[] {
  return ELEMENT_ROLES.map((role) => {
    const s = ELEMENT_SPECS[role];
    return `${s.icon} ${s.label} —— ${s.rule}`;
  });
}
