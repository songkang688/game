import { describe, expect, it } from "vitest";
import { makeChi, makeKan, makePon, type Meld } from "./melds";
import {
  DEFAULT_FAN_FLOOR,
  FALSE_HU_PENALTY_EACH,
  FAN_COUNT,
  FAN_TABLE,
  applyExclusions,
  canHuWithFloor,
  falseHuPenalty,
  ronPriority,
  scoreFans,
  settle,
  settleFalseHu,
  undetectedFans,
  type HuContext
} from "./fan";
import { parseTiles } from "./tiles";

function ctxOf(hand: string, winTile: number, extra: Partial<HuContext> = {}): HuContext {
  return {
    hand: parseTiles(hand),
    melds: [],
    winTile,
    selfDraw: false,
    seatWind: 1,
    roundWind: 1,
    ...extra
  };
}

/** 算番并返回番种名数组（测试里只关心「有没有这个番」） */
function namesOf(hand: string, winTile: number, extra: Partial<HuContext> = {}): string[] {
  return scoreFans(ctxOf(hand, winTile, extra)).names;
}

const T = (s: string): number => parseTiles(s)[0];

describe("番种全表", () => {
  it("国标 81 个番种一个不少", () => {
    expect(FAN_COUNT).toBe(81);
  });

  it("分值只用 88/64/48/32/24/16/12/8/6/4/2/1 这几档", () => {
    const allowed = new Set([88, 64, 48, 32, 24, 16, 12, 8, 6, 4, 2, 1]);
    for (const f of FAN_TABLE) expect(allowed.has(f.points)).toBe(true);
  });

  it("番种名不重复", () => {
    expect(new Set(FAN_TABLE.map((f) => f.name)).size).toBe(FAN_COUNT);
  });

  it("本款 81 个番种全部写了识别器", () => {
    expect(undetectedFans()).toEqual([]);
  });

  it("规格点名必做的那 40 个番种,全表里一个不缺", () => {
    const must = [
      "平和", "碰碰和", "混一色", "清一色", "七对", "十三幺", "大三元", "小三元", "大四喜", "小四喜",
      "清龙", "花龙", "三色三同顺", "三色三节高", "杠上开花", "抢杠和", "妙手回春", "海底捞月",
      "门前清", "不求人", "全求人", "断幺", "无字", "缺一门", "一般高", "喜相逢", "连六", "老少副",
      "边张", "坎张", "单钓将", "自摸", "四归一", "箭刻", "圈风刻", "门风刻", "双同刻", "双暗刻",
      "明杠", "暗杠"
    ];
    expect(must.length).toBe(40);
    const table = new Set(FAN_TABLE.map((f) => f.name));
    for (const name of must) expect(table.has(name)).toBe(true);
  });
});

describe("无番和与花牌", () => {
  it("一副什么番都沾不上的牌,按无番和算 8 分", () => {
    // 吃了一副 678s 所以不门前清;三门齐全、带字牌、两面和,连平和都够不着
    const melds: Meld[] = [makeChi(T("6s"), parseTiles("78s"), 3)];
    const r = scoreFans(ctxOf("456m345p789s22z", T("5p"), { melds }));
    expect(r.names).toContain("无番和");
    expect(r.points).toBe(8);
  });

  it("无番和就是全表最后的兜底,不跟别的番同时出现", () => {
    const melds: Meld[] = [makeChi(T("6s"), parseTiles("78s"), 3)];
    expect(scoreFans(ctxOf("456m345p789s22z", T("5p"), { melds })).names).toEqual(["无番和"]);
  });

  it("花牌每张 1 分,记在花分里,不混进番种表", () => {
    const withFlowers = scoreFans(ctxOf("111222333444z55m", T("5m"), { flowers: 3 }));
    expect(withFlowers.flowerPoints).toBe(3);
    expect(withFlowers.names).not.toContain("花牌");
    // 番数只看番,花再多也不顶番
    const noFlowers = scoreFans(ctxOf("111222333444z55m", T("5m")));
    expect(withFlowers.points).toBe(noFlowers.points);
  });

  it("花牌在全表里占一格,每张 1 分", () => {
    const flower = FAN_TABLE.find((f) => f.name === "花牌");
    expect(flower?.points).toBe(1);
    expect(flower?.repeatable).toBe(true);
  });

  it("起和门槛只看番,花分再多也不能拿来凑门槛", () => {
    const r = scoreFans(ctxOf("456m345p789s22z", T("5p"), {
      melds: [makeChi(T("6s"), parseTiles("78s"), 3)],
      flowers: 8
    }));
    expect(r.flowerPoints).toBe(8);
    expect(canHuWithFloor(r.points, 8)).toBe(true);
    expect(canHuWithFloor(r.points, 12)).toBe(false);
  });
});

describe("88 分档", () => {
  it("大四喜", () => {
    expect(namesOf("111222333444z55m", T("5m"))).toContain("大四喜");
  });
  it("大三元", () => {
    expect(namesOf("123m44p555666777z", T("1m"))).toContain("大三元");
  });
  it("绿一色", () => {
    expect(namesOf("22233344466688s", T("2s"))).toContain("绿一色");
  });
  it("九莲宝灯", () => {
    expect(namesOf("11123455678999m", T("5m"), { selfDraw: true })).toContain("九莲宝灯");
  });
  it("四杠", () => {
    const melds: Meld[] = [
      makeKan(T("1m"), "ankan", 0),
      makeKan(T("2m"), "ankan", 0),
      makeKan(T("3p"), "minkan", 1),
      makeKan(T("4s"), "minkan", 2)
    ];
    expect(scoreFans({ ...ctxOf("55p", T("5p"), { melds, selfDraw: true }) }).names).toContain("四杠");
  });
  it("连七对", () => {
    expect(namesOf("11223344556677p", T("1p"))).toContain("连七对");
  });
  it("十三幺", () => {
    expect(namesOf("119m19p19s1234567z", T("1m"))).toContain("十三幺");
  });
});

describe("64 分档", () => {
  it("清幺九", () => {
    expect(namesOf("111999m111999p11s", T("1s"))).toContain("清幺九");
  });
  it("小四喜", () => {
    expect(namesOf("123m11122233344z", T("1m"))).toContain("小四喜");
  });
  it("小三元", () => {
    expect(namesOf("123m456p55566677z", T("1m"))).toContain("小三元");
  });
  it("字一色", () => {
    expect(namesOf("11122233355566z", T("6z"))).toContain("字一色");
  });
  it("四暗刻", () => {
    expect(namesOf("111222m333444p55s", T("5s"), { selfDraw: true })).toContain("四暗刻");
  });
  it("一色双龙会", () => {
    expect(namesOf("11223355778899m", T("1m"))).toContain("一色双龙会");
  });
});

describe("48 / 32 分档", () => {
  it("一色四同顺", () => {
    expect(namesOf("111122223333m55p", T("1m"))).toContain("一色四同顺");
  });
  it("一色四节高", () => {
    expect(namesOf("111222333444m55p", T("1m"))).toContain("一色四节高");
  });
  it("一色四步高", () => {
    expect(namesOf("122333444556m55p", T("1m"))).toContain("一色四步高");
  });
  it("三杠", () => {
    const melds: Meld[] = [
      makeKan(T("1m"), "ankan", 0),
      makeKan(T("2m"), "minkan", 1),
      makeKan(T("3p"), "minkan", 2)
    ];
    expect(scoreFans(ctxOf("456s55p", T("4s"), { melds })).names).toContain("三杠");
  });
  it("混幺九", () => {
    expect(namesOf("111m999p111z555z99s", T("9s"))).toContain("混幺九");
  });
});

describe("24 分档", () => {
  it("七对", () => {
    expect(namesOf("1122m3344p5566s77z", T("1m"))).toContain("七对");
  });
  it("七星不靠", () => {
    expect(namesOf("147m258p3s1234567z", T("1m"))).toContain("七星不靠");
  });
  it("全双刻", () => {
    expect(namesOf("222888m444p666s22s", T("2s"))).toContain("全双刻");
  });
  it("清一色", () => {
    expect(namesOf("11112345678922m", T("2m"))).toContain("清一色");
  });
  it("一色三同顺", () => {
    // 吃来一副 123m,手里再凑两副 123m。这样拆不出 111/222/333 三个刻子,
    // 「就高不就低」也只剩三同顺这一条路
    const melds: Meld[] = [makeChi(T("1m"), parseTiles("23m"), 3)];
    expect(scoreFans(ctxOf("112233m456p55s", T("4p"), { melds })).names).toContain("一色三同顺");
  });

  it("同一副牌能读成三同顺也能读成三节高时，按分高的那套算", () => {
    // 111222333m 既是三个连号刻子也是三副 123m,国标取分高的三节高 + 三暗刻
    const names = namesOf("111222333m456p55s", T("4p"));
    expect(names).toContain("一色三节高");
    expect(names).toContain("三暗刻");
    expect(names).not.toContain("一色三同顺");
  });
  it("一色三节高", () => {
    expect(namesOf("111222333m456p55s", T("4p"))).toContain("一色三节高");
  });
  it("全大", () => {
    expect(namesOf("778899m999p77788s", T("8s"))).toContain("全大");
  });
  it("全中", () => {
    expect(namesOf("444456m456p555s66p", T("6p"))).toContain("全中");
  });
  it("全小", () => {
    expect(namesOf("112233m111p22333s", T("2s"))).toContain("全小");
  });
});

describe("16 分档", () => {
  it("清龙", () => {
    expect(namesOf("123456789m111p22s", T("2s"))).toContain("清龙");
  });
  it("三色双龙会", () => {
    expect(namesOf("123789m123789p55s", T("5s"))).toContain("三色双龙会");
  });
  it("一色三步高", () => {
    expect(namesOf("123234345m456p55s", T("4p"))).toContain("一色三步高");
  });
  it("全带五", () => {
    expect(namesOf("345567m456p555s55p", T("5p"))).toContain("全带五");
  });
  it("三同刻", () => {
    expect(namesOf("222123m222p222s55p", T("5p"))).toContain("三同刻");
  });
  it("三暗刻", () => {
    const melds: Meld[] = [makeChi(T("4s"), parseTiles("56s"), 3)];
    expect(scoreFans(ctxOf("111222m333p55s", T("5s"), { melds })).names).toContain("三暗刻");
  });
});

describe("12 分档", () => {
  it("全不靠", () => {
    expect(namesOf("147m258p36s123456z", T("1m"))).toContain("全不靠");
  });
  it("组合龙", () => {
    expect(namesOf("147789m22258p369s", T("9m"))).toContain("组合龙");
  });
  it("大于五", () => {
    expect(namesOf("666678m789p999s88p", T("8p"))).toContain("大于五");
  });
  it("小于五", () => {
    expect(namesOf("111123m234p444s22p", T("2p"))).toContain("小于五");
  });
  it("三风刻", () => {
    expect(namesOf("123m55p111222333z", T("1m"))).toContain("三风刻");
  });
});

describe("8 分档", () => {
  it("花龙", () => {
    expect(namesOf("123m456p789s555z22m", T("2m"))).toContain("花龙");
  });
  it("推不倒", () => {
    expect(namesOf("12334599p456888s", T("9p"))).toContain("推不倒");
  });
  it("三色三同顺", () => {
    expect(namesOf("234m234p234s111z55m", T("5m"))).toContain("三色三同顺");
  });
  it("三色三节高", () => {
    expect(namesOf("123222m333p444s55p", T("5p"))).toContain("三色三节高");
  });
  it("无番和", () => {
    const melds: Meld[] = [makeChi(T("3p"), parseTiles("45p"), 3)];
    expect(scoreFans(ctxOf("333789m678s22z", T("3m"), { melds })).names).toEqual(["无番和"]);
  });
  it("妙手回春", () => {
    expect(namesOf("123456789m123p55s", T("5s"), { selfDraw: true, lastDraw: true })).toContain("妙手回春");
  });
  it("海底捞月", () => {
    expect(namesOf("123456789m123p55s", T("5s"), { lastDiscard: true })).toContain("海底捞月");
  });
  it("杠上开花", () => {
    const melds: Meld[] = [makeKan(T("1m"), "ankan", 0)];
    expect(
      scoreFans(ctxOf("456789m234p55s", T("4m"), { melds, selfDraw: true, afterKan: true })).names
    ).toContain("杠上开花");
  });
  it("抢杠和", () => {
    expect(namesOf("123456789m123p55s", T("5s"), { robKan: true })).toContain("抢杠和");
  });
});

describe("6 分档", () => {
  it("碰碰和", () => {
    const melds: Meld[] = [makePon(T("3p"), 1)];
    expect(scoreFans(ctxOf("111999m555s22p", T("2p"), { melds })).names).toContain("碰碰和");
  });
  it("混一色", () => {
    expect(namesOf("123456789m111z55m", T("5m"), { seatWind: 2, roundWind: 3 })).toContain("混一色");
  });
  it("三色三步高", () => {
    expect(namesOf("123m234p345s111z55m", T("5m"), { seatWind: 2, roundWind: 3 })).toContain("三色三步高");
  });
  it("五门齐", () => {
    expect(namesOf("123m456p789s111z55z", T("5z"), { seatWind: 2, roundWind: 3 })).toContain("五门齐");
  });
  it("全求人", () => {
    const melds: Meld[] = [
      makeChi(T("1m"), parseTiles("23m"), 3),
      makeChi(T("4m"), parseTiles("56m"), 3),
      makePon(T("9p"), 1),
      makeChi(T("2s"), parseTiles("34s"), 3)
    ];
    expect(scoreFans(ctxOf("55s", T("5s"), { melds })).names).toContain("全求人");
  });
  it("双暗杠", () => {
    const melds: Meld[] = [makeKan(T("1m"), "ankan", 0), makeKan(T("2m"), "ankan", 0)];
    expect(scoreFans(ctxOf("456789m55s", T("4m"), { melds })).names).toContain("双暗杠");
  });
  it("双箭刻", () => {
    expect(namesOf("123m456p55s555666z", T("1m"))).toContain("双箭刻");
  });
});

describe("4 分档", () => {
  it("全带幺", () => {
    expect(namesOf("11123m789p999s111z", T("2m"), { seatWind: 2, roundWind: 3 })).toContain("全带幺");
  });
  it("不求人", () => {
    expect(namesOf("123456789m123p55s", T("5s"), { selfDraw: true })).toContain("不求人");
  });
  it("双明杠", () => {
    const melds: Meld[] = [makeKan(T("1m"), "minkan", 1), makeKan(T("2m"), "minkan", 2)];
    expect(scoreFans(ctxOf("456789m55s", T("4m"), { melds })).names).toContain("双明杠");
  });
  it("和绝张", () => {
    expect(namesOf("123456789m123p55s", T("5s"), { lastTile: true })).toContain("和绝张");
  });
});

describe("2 分档", () => {
  it("箭刻", () => {
    expect(namesOf("123m456p789s555z22m", T("2m"))).toContain("箭刻");
  });
  it("圈风刻", () => {
    expect(namesOf("123m456p789s111z22m", T("2m"), { roundWind: 1, seatWind: 2 })).toContain("圈风刻");
  });
  it("门风刻", () => {
    expect(namesOf("123m456p789s222z22m", T("2m"), { roundWind: 1, seatWind: 2 })).toContain("门风刻");
  });
  it("门前清", () => {
    expect(namesOf("123456789m123p55s", T("5s"))).toContain("门前清");
  });
  it("平和", () => {
    expect(namesOf("123456m234678p55s", T("1m"))).toContain("平和");
  });
  it("四归一", () => {
    expect(namesOf("111123m456p789s55m", T("5m"))).toContain("四归一");
  });
  it("双同刻", () => {
    expect(namesOf("222456m222p123s55p", T("5p"))).toContain("双同刻");
  });
  it("双暗刻", () => {
    const melds: Meld[] = [makeChi(T("4s"), parseTiles("56s"), 3), makeChi(T("7s"), parseTiles("89s"), 3)];
    expect(scoreFans(ctxOf("333m444p55s", T("5s"), { melds })).names).toContain("双暗刻");
  });
  it("暗杠", () => {
    const melds: Meld[] = [makeKan(T("1m"), "ankan", 0)];
    expect(scoreFans(ctxOf("456789m234p55s", T("4m"))).names).not.toContain("暗杠");
    expect(scoreFans(ctxOf("456789m234p55s", T("4m"), { melds })).names).toContain("暗杠");
  });
  it("断幺", () => {
    expect(namesOf("234456m234p567s55p", T("5p"))).toContain("断幺");
  });
});

describe("1 分档", () => {
  it("一般高", () => {
    expect(namesOf("123123m456p789s55m", T("5m"))).toContain("一般高");
  });
  it("喜相逢", () => {
    expect(namesOf("123789m123p456s55p", T("5p"))).toContain("喜相逢");
  });
  it("连六", () => {
    expect(namesOf("123456m789p123s55m", T("5m"))).toContain("连六");
  });
  it("老少副", () => {
    expect(namesOf("123789m456p123s55s", T("5s"))).toContain("老少副");
  });
  it("幺九刻", () => {
    const melds: Meld[] = [makePon(T("3p"), 1)];
    expect(scoreFans(ctxOf("111999m555s22p", T("2p"), { melds })).names).toContain("幺九刻");
  });
  it("明杠", () => {
    const melds: Meld[] = [makeKan(T("1m"), "minkan", 1)];
    expect(scoreFans(ctxOf("456789m234p55s", T("4m"), { melds })).names).toContain("明杠");
  });
  it("缺一门", () => {
    expect(namesOf("123456789m123p55p", T("5p"))).toContain("缺一门");
  });
  it("无字", () => {
    expect(namesOf("123456789m123p55s", T("5s"))).toContain("无字");
  });
  it("边张", () => {
    expect(namesOf("12345556789m123p", T("3m"))).toContain("边张");
  });
  it("坎张", () => {
    expect(namesOf("12345556789m123p", T("2m"))).toContain("坎张");
  });
  it("单钓将", () => {
    expect(namesOf("123456789m123p99s", T("9s"))).toContain("单钓将");
  });
  it("自摸", () => {
    const melds: Meld[] = [makePon(T("9p"), 1)];
    expect(scoreFans(ctxOf("123456789m55s", T("5s"), { melds, selfDraw: true })).names).toContain("自摸");
  });
});

describe("不重复计（三原则之一）", () => {
  it("大三元不再单算箭刻与双箭刻", () => {
    const names = namesOf("123m44p555666777z", T("1m"));
    expect(names).toContain("大三元");
    expect(names).not.toContain("箭刻");
    expect(names).not.toContain("双箭刻");
  });

  it("清一色不再单算无字与缺一门", () => {
    const names = namesOf("11112345678922m", T("2m"));
    expect(names).toContain("清一色");
    expect(names).not.toContain("无字");
    expect(names).not.toContain("缺一门");
  });

  it("断幺不再单算无字", () => {
    const names = namesOf("234456m234p567s55p", T("5p"));
    expect(names).toContain("断幺");
    expect(names).not.toContain("无字");
  });

  it("四暗刻不再单算三暗刻 / 双暗刻 / 碰碰和", () => {
    const names = namesOf("111222m333444p55s", T("5s"), { selfDraw: true });
    expect(names).toContain("四暗刻");
    expect(names).not.toContain("三暗刻");
    expect(names).not.toContain("双暗刻");
    expect(names).not.toContain("碰碰和");
  });

  it("清龙只吃掉两个连六和一个老少副", () => {
    const names = namesOf("123456789m111p22s", T("2s"));
    expect(names).toContain("清龙");
    expect(names).not.toContain("连六");
    expect(names).not.toContain("老少副");
  });

  it("互斥表不会把自己吃掉", () => {
    const kept = applyExclusions([{ name: "清一色", points: 24 }]);
    expect(kept.map((k) => k.name)).toEqual(["清一色"]);
  });
});

describe("就高不就低", () => {
  it("同一手牌能拆成两套时取分高的那套", () => {
    // 一色四同顺(48) 明显高于按四步高之类拆出来的分
    const r = scoreFans(ctxOf("111122223333m55p", T("1m")));
    expect(r.points).toBeGreaterThanOrEqual(48);
    expect(r.names).toContain("一色四同顺");
  });
});

describe("起和门槛与错和", () => {
  it("默认门槛是 8 番", () => {
    expect(DEFAULT_FAN_FLOOR).toBe(8);
  });

  it("够 8 番才能点和", () => {
    expect(canHuWithFloor(8)).toBe(true);
    expect(canHuWithFloor(7)).toBe(false);
    expect(canHuWithFloor(24)).toBe(true);
  });

  it("教学关把门槛降到 1 番时小番也能和", () => {
    expect(canHuWithFloor(3, 1)).toBe(true);
    expect(canHuWithFloor(0, 1)).toBe(false);
  });

  it("错和默认赔每家 10 花分，一共 30", () => {
    expect(FALSE_HU_PENALTY_EACH).toBe(10);
    expect(falseHuPenalty()).toBe(30);
    const s = settleFalseHu(2);
    expect(s.delta[2]).toBe(-30);
    expect(s.delta[0]).toBe(10);
    expect(s.delta.reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe("截和顺序", () => {
  it("一炮只和一家，下家优先", () => {
    expect(ronPriority([1, 2, 3], 0)).toBe(1);
    expect(ronPriority([2, 3], 0)).toBe(2);
    expect(ronPriority([3], 0)).toBe(3);
  });

  it("按打牌人算相对位次，不是按绝对座号", () => {
    expect(ronPriority([0, 2], 2)).toBe(0);
    expect(ronPriority([1], 3)).toBe(1);
  });

  it("没人和返回 -1", () => {
    expect(ronPriority([], 0)).toBe(-1);
  });
});

describe("结算", () => {
  it("自摸时其余三家各付 8 + 番", () => {
    const s = settle(0, true, 10);
    expect(s.delta[1]).toBe(-18);
    expect(s.delta[2]).toBe(-18);
    expect(s.delta[3]).toBe(-18);
    expect(s.delta[0]).toBe(54);
  });

  it("点炮时点炮者付 8 + 番，另两家各付 8", () => {
    const s = settle(1, false, 10, 3);
    expect(s.delta[3]).toBe(-18);
    expect(s.delta[0]).toBe(-8);
    expect(s.delta[2]).toBe(-8);
    expect(s.delta[1]).toBe(34);
  });

  it("花牌分不计番，每张花其余三家各付 1 分", () => {
    const s = settle(0, true, 8, -1, 3);
    expect(s.delta[0]).toBe(48 + 9);
    expect(s.delta[1]).toBe(-16 - 3);
  });

  it("不管有没有花，一桌四家的分加起来永远是 0", () => {
    for (const [selfDraw, from, flowers] of [
      [true, -1, 0],
      [true, -1, 5],
      [false, 2, 0],
      [false, 3, 8]
    ] as Array<[boolean, number, number]>) {
      const s = settle(0, selfDraw, 12, from, flowers);
      expect(s.delta.reduce((a, b) => a + b, 0)).toBe(0);
    }
  });

  it("座位号不合法时原样返回全 0，不抛异常", () => {
    expect(settle(9, true, 10).delta).toEqual([0, 0, 0, 0]);
  });
});

describe("没胡就没有番", () => {
  it("散牌算不出番种", () => {
    const r = scoreFans(ctxOf("123m456p789s11z3z", T("3z")));
    expect(r.points).toBe(0);
    expect(r.form).toBeNull();
  });
});
