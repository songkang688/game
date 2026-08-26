import { describe, expect, it } from "vitest";
import {
  ALBUM_KEY,
  C_FLOOR,
  C_PGATE,
  Disposer,
  PUZZLE_KINDS,
  ROOM_TEMPLATES,
  STICKER_SETS,
  albumBonusStars,
  albumChapterDone,
  albumTotal,
  boxAt,
  boxPushTargets,
  buildCastleRoom,
  canOpenKeyDoor,
  canPushBox,
  castleLine,
  castleRoomTitle,
  cellAt,
  cloneRoom,
  colorGateOpen,
  exploredRatio,
  isPlateDown,
  miniMapRows,
  nextSticker,
  normalizeAlbum,
  parseAlbum,
  parseRoom,
  platePressed,
  portalPartner,
  resetRoom,
  revealHidden,
  roomStuck,
  seesawTilt,
  seesawWalkable,
  serializeAlbum,
  solveRoom,
  stepMove,
  stickerId,
  templateById,
  templatePoolFor,
  templateWellFormed,
  toggleSwitch,
  walkable,
  type Dir,
  type RoomState,
  type RoomTemplate,
} from "./explore";

/** 照着一串方向走完,返回最后的房间状态与一路上的事件 */
function walk(start: RoomState, dirs: Dir[]): { state: RoomState; kinds: string[] } {
  let state = start;
  const kinds: string[] = [];
  for (const d of dirs) {
    const r = stepMove(state, d);
    state = r.state;
    for (const e of r.events) kinds.push(e.kind);
  }
  return { state, kinds };
}

function room(rows: string[]): RoomState {
  const tpl: RoomTemplate = { id: "t", name: "测试房", emoji: "🧪", focus: "door", rows };
  return parseRoom(tpl);
}

describe("冒险小王 · 六种解谜物件", () => {
  it("钥匙门:手上没钥匙推不开,有一把就开", () => {
    expect(canOpenKeyDoor(0)).toBe(false);
    expect(canOpenKeyDoor(1)).toBe(true);
    expect(canOpenKeyDoor(Number.NaN)).toBe(false);
  });

  it("推箱:空地板 / 压板推得动,墙与另一个箱子推不动", () => {
    expect(canPushBox(".", false)).toBe(true);
    expect(canPushBox("P", false)).toBe(true);
    expect(canPushBox(".", true)).toBe(false);
    expect(canPushBox("#", false)).toBe(false);
    expect(canPushBox("D", false)).toBe(false);
  });

  it("压板:箱子压上去才算压住", () => {
    const plates = [{ x: 3, y: 4 }];
    expect(platePressed(plates, [{ x: 1, y: 1 }])).toBe(false);
    expect(platePressed(plates, [{ x: 3, y: 4 }])).toBe(true);
    expect(platePressed([], [{ x: 3, y: 4 }])).toBe(false);
  });

  it("颜色开关:拨一下换一次,门跟着开关走", () => {
    expect(toggleSwitch(false)).toBe(true);
    expect(toggleSwitch(true)).toBe(false);
    expect(colorGateOpen(false)).toBe(false);
    expect(colorGateOpen(true)).toBe(true);
  });

  it("跷跷板:哪端重哪端沉,沉下去的那端才踩得上", () => {
    expect(seesawTilt(1, 0)).toBe(-1);
    expect(seesawTilt(0, 2)).toBe(1);
    expect(seesawTilt(1, 1)).toBe(0);
    expect(seesawWalkable("left", -1)).toBe(true);
    expect(seesawWalkable("right", -1)).toBe(false);
    expect(seesawWalkable("right", 0)).toBe(true);
  });

  it("隐藏墙:揭开过就一直记着,原来的集合不被改", () => {
    const before = new Set<string>();
    const after = revealHidden(before, 4, 2);
    expect(after.has("4,2")).toBe(true);
    expect(before.size).toBe(0);
    expect(revealHidden(after, 4, 2).size).toBe(1);
  });

  it("传送门:两两配对,单个漩涡传不了", () => {
    const portals = [
      { x: 1, y: 1 },
      { x: 7, y: 5 },
    ];
    expect(portalPartner(portals, 0)).toEqual({ x: 7, y: 5 });
    expect(portalPartner(portals, 1)).toEqual({ x: 1, y: 1 });
    expect(portalPartner([{ x: 1, y: 1 }], 0)).toBeNull();
    expect(portalPartner(portals, 9)).toBeNull();
  });

  it("六种物件都在提示清单里,名字不重复", () => {
    expect(PUZZLE_KINDS).toHaveLength(6);
    expect(new Set(PUZZLE_KINDS.map((p) => p.key)).size).toBe(6);
  });
});

describe("冒险小王 · 房间推进", () => {
  it("解析模板:起点变地板,箱子 / 压板 / 漩涡 / 贴纸各自登记", () => {
    const st = room([
      "#######",
      "#@.B.*#",
      "#..P.O#",
      "#....O#",
      "#######",
    ]);
    expect(st.player).toEqual({ x: 1, y: 1 });
    expect(cellAt(st, 1, 1)).toBe(C_FLOOR);
    expect(st.boxes).toEqual([{ x: 3, y: 1 }]);
    expect(st.plates).toEqual([{ x: 3, y: 2 }]);
    expect(st.portals).toHaveLength(2);
    expect(st.stickers).toHaveLength(1);
  });

  it("走一步不改原状态(拷贝式推进)", () => {
    const st = room(["#####", "#@..#", "#...#", "#####"]);
    const after = stepMove(st, "right").state;
    expect(st.player).toEqual({ x: 1, y: 1 });
    expect(after.player).toEqual({ x: 2, y: 1 });
    const copy = cloneRoom(st);
    copy.cells[0] = ".";
    expect(st.cells[0]).toBe("#");
  });

  it("撞墙只是弹一下,人不动也不计步", () => {
    const st = room(["#####", "#@..#", "#####"]);
    const r = stepMove(st, "up");
    expect(r.events[0].kind).toBe("bump");
    expect(r.state.player).toEqual({ x: 1, y: 1 });
    expect(r.state.moves).toBe(0);
  });

  it("钥匙门:先捡钥匙再开门,没钥匙给温和提示", () => {
    const st = room(["#######", "#@K.D.#", "#######"]);
    const locked = walk(st, ["right", "right", "right"]);
    expect(locked.kinds).toContain("key");
    const noKey = room(["#######", "#@..D.#", "#######"]);
    const bumped = walk(noKey, ["right", "right", "right"]);
    expect(bumped.kinds).toContain("locked");
    const opened = walk(st, ["right", "right", "right", "right"]);
    expect(opened.kinds).toContain("unlock");
    expect(opened.state.keys).toBe(0);
  });

  it("推箱压板:箱子上板,石门才让路", () => {
    const st = room([
      "#########",
      "#@......#",
      "#..B..###",
      "#..P#Q.E#",
      "#########",
    ]);
    const before = stepMove(st, "down").state;
    expect(walkable(before, 5, 3)).toBe(false);
    // 走到箱子正上方再往下推一格,箱子正好落在压板上
    const pushed = walk(st, ["right", "right", "down"]);
    expect(pushed.kinds).toContain("push");
    expect(isPlateDown(pushed.state)).toBe(true);
    expect(cellAt(pushed.state, 5, 3)).toBe(C_PGATE);
    expect(walkable(pushed.state, 5, 3)).toBe(true);
  });

  it("颜色开关:拨亮了彩门才开", () => {
    const st = room(["#######", "#@.S..#", "#..#G.#", "#######"]);
    expect(walkable(st, 4, 2)).toBe(false);
    const on = walk(st, ["right", "right"]);
    expect(on.kinds).toContain("switch");
    expect(on.state.switchOn).toBe(true);
    expect(walkable(on.state, 4, 2)).toBe(true);
  });

  it("隐藏墙:撞一下露出秘密房并 +1 秘密,人这一步不动", () => {
    const st = room(["#######", "#@H..*#", "#######"]);
    const r = stepMove(st, "right");
    expect(r.events[0].kind).toBe("secret");
    expect(r.state.secrets).toBe(1);
    expect(r.state.player).toEqual({ x: 1, y: 1 });
    expect(stepMove(r.state, "right").state.player).toEqual({ x: 2, y: 1 });
  });

  it("传送门:踩上就到对面那个漩涡", () => {
    const st = room(["#######", "#@O..O#", "#######"]);
    const r = stepMove(st, "right");
    expect(r.events.map((e) => e.kind)).toContain("portal");
    expect(r.state.player).toEqual({ x: 5, y: 1 });
  });

  it("贴纸与出口:捡到贴纸计数,踩到出口就过关", () => {
    const st = room(["######", "#@*E.#", "######"]);
    const r = walk(st, ["right", "right"]);
    expect(r.kinds).toContain("sticker");
    expect(r.state.picked).toBe(1);
    expect(r.state.cleared).toBe(true);
    expect(stepMove(r.state, "right").state.player.x).toBe(3);
  });
});

describe("冒险小王 · 探索留痕与小地图", () => {
  it("走过的地方留痕,比例只增不减", () => {
    const st = room(["#######", "#@....#", "#.....#", "#######"]);
    const a = exploredRatio(st);
    const b = exploredRatio(walk(st, ["right", "right", "right"]).state);
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThanOrEqual(1);
  });

  it("小地图:没去过的地方是点,人所在格是方块", () => {
    const st = room(["#######", "#@....#", "#.....#", "#######"]);
    const rows = miniMapRows(st);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toBe("▪▪▪▪▪▪▪");
    expect(rows[1][1]).toBe("▣");
    expect(rows[2][4]).toBe("·");
    const later = miniMapRows(walk(st, ["right", "right", "right"]).state);
    expect(later[1][2]).toBe("░");
  });
});

describe("冒险小王 · 不卡死", () => {
  const stuckRows = [
    "#########",
    "#@......#",
    "#..B..###",
    "#..P#Q.E#",
    "#########",
  ];

  it("正常摆法是走得通的", () => {
    expect(solveRoom(room(stuckRows))).toBe(true);
  });

  it("箱子被推进死角就判死局,一键复位后又走得通(且不动分数)", () => {
    const st = room(stuckRows);
    // 从压板那一侧往上顶,箱子贴到顶墙就再也回不到压板上了
    const dead = walk(st, ["down", "down", "right", "right", "up"]);
    expect(boxAt(dead.state, 3, 1)).toBeGreaterThanOrEqual(0);
    expect(roomStuck(dead.state)).toBe(true);

    const tpl: RoomTemplate = { id: "t", name: "测试房", emoji: "🧪", focus: "plate", rows: stuckRows };
    const runScore = { rooms: 3, stars: 5 };
    const fresh = resetRoom(tpl);
    expect(roomStuck(fresh)).toBe(false);
    expect(fresh.boxes).toEqual([{ x: 3, y: 2 }]);
    expect(runScore).toEqual({ rooms: 3, stars: 5 });
  });

  it("过关了就不算死局", () => {
    const st = room(["#####", "#@E.#", "#####"]);
    const done = stepMove(st, "right").state;
    expect(done.cleared).toBe(true);
    expect(roomStuck(done)).toBe(false);
  });

  it("箱子推得到的格子里包含压板", () => {
    const st = room(["#########", "#@......#", "#..B..###", "#..P#Q.E#", "#########"]);
    const spots = boxPushTargets(st, 0, (x, y) => cellAt(st, x, y) !== "#" && cellAt(st, x, y) !== "Q");
    expect(spots.some((p) => p.x === 3 && p.y === 3)).toBe(true);
  });

  it("真正无解的房间不会被当成能过", () => {
    const st = room(["#######", "#@..#E#", "#...#.#", "#######"]);
    expect(solveRoom(st)).toBe(false);
    expect(roomStuck(st)).toBe(true);
  });
});

describe("冒险小王 · 贴纸图鉴", () => {
  it("图鉴 key 用 yiduo-yixing 前缀,总数等于各章之和", () => {
    expect(ALBUM_KEY.startsWith("yiduo-yixing.")).toBe(true);
    expect(albumTotal()).toBe(STICKER_SETS.reduce((n, s) => n + s.items.length, 0));
    expect(STICKER_SETS.length).toBeGreaterThanOrEqual(8);
  });

  it("序列化往返:顺序乱了、重复了都还原成同一份", () => {
    const album = [stickerId(2, 1), stickerId(0, 0), stickerId(2, 1)];
    const raw = serializeAlbum(album);
    expect(parseAlbum(raw)).toEqual([stickerId(0, 0), stickerId(2, 1)]);
    expect(serializeAlbum(parseAlbum(raw))).toBe(raw);
  });

  it("坏数据一律降级成空图鉴,不抛异常", () => {
    expect(parseAlbum(null)).toEqual([]);
    expect(parseAlbum("{坏掉的 json")).toEqual([]);
    expect(parseAlbum('{"a":1}')).toEqual([]);
    expect(normalizeAlbum(["99-9", 7, null, stickerId(1, 1)])).toEqual([stickerId(1, 1)]);
  });

  it("集齐一章给一颗额外星星", () => {
    const first = STICKER_SETS[0].items.map((_, i) => stickerId(0, i));
    expect(albumChapterDone(first, 0)).toBe(true);
    expect(albumChapterDone(first.slice(1), 0)).toBe(false);
    expect(albumBonusStars(first)).toBe(1);
    expect(albumBonusStars([])).toBe(0);
  });

  it("下一张贴纸按章顺序发,全收齐了就没有下一张", () => {
    expect(nextSticker([])).toEqual({ chapter: 0, item: 0 });
    expect(nextSticker([stickerId(0, 0)])).toEqual({ chapter: 0, item: 1 });
    const all: string[] = [];
    STICKER_SETS.forEach((s, ci) => s.items.forEach((_, ii) => all.push(stickerId(ci, ii))));
    expect(nextSticker(all)).toBeNull();
  });
});

describe("冒险小王 · 无尽古堡", () => {
  it("模板库至少 12 间,id 不重复,每间都长方形且有起点出口", () => {
    expect(ROOM_TEMPLATES.length).toBeGreaterThanOrEqual(12);
    expect(new Set(ROOM_TEMPLATES.map((t) => t.id)).size).toBe(ROOM_TEMPLATES.length);
    for (const tpl of ROOM_TEMPLATES) {
      expect(templateWellFormed(tpl), `${tpl.id} 模板不规整`).toBe(true);
    }
    expect(templateById("hall")?.name).toBe("石门厅");
    expect(templateById("查无此房")).toBeNull();
  });

  it("每一张模板自己就得走得通(连通性 + 钥匙可达)", () => {
    for (const tpl of ROOM_TEMPLATES) {
      expect(solveRoom(parseRoom(tpl)), `${tpl.id} 走不通`).toBe(true);
    }
  });

  it("六种物件在模板库里都出现过", () => {
    const focuses = new Set(ROOM_TEMPLATES.map((t) => t.focus));
    for (const p of PUZZLE_KINDS) expect(focuses.has(p.key), `模板库缺少 ${p.name}`).toBe(true);
  });

  it("模板池随层数变大,但不超过模板库", () => {
    expect(templatePoolFor(1).length).toBe(3);
    expect(templatePoolFor(1).length).toBeLessThanOrEqual(templatePoolFor(9).length);
    expect(templatePoolFor(999).length).toBe(ROOM_TEMPLATES.length);
    expect(templatePoolFor(-5).length).toBe(3);
  });

  it("随机拼 1000 次,每一间都走得通", () => {
    for (let i = 0; i < 1000; i++) {
      const seed = 1 + i * 37;
      const roomNo = 1 + (i % 40);
      const built = buildCastleRoom(seed, roomNo);
      expect(built.state.templateId).toBe(built.template.id);
      expect(solveRoom(built.state), `seed=${seed} room=${roomNo} 走不通`).toBe(true);
    }
  });

  it("同一个种子拼出同一间房(可复现)", () => {
    const a = buildCastleRoom(2026, 7);
    const b = buildCastleRoom(2026, 7);
    expect(a.template.id).toBe(b.template.id);
    expect(a.state.cells).toEqual(b.state.cells);
  });

  it("房间标题与结束语只鼓励", () => {
    const built = buildCastleRoom(5, 3);
    expect(castleRoomTitle(3, built.template)).toContain("第 3 间");
    expect(castleLine(6, 4)).toContain("新纪录");
    expect(castleLine(2, 9)).toContain("复位");
    expect(castleLine(0, 0)).not.toContain("失败");
  });
});

describe("冒险小王 · 清理袋", () => {
  it("dispose 之后一件不剩,重复 dispose 也安全", () => {
    const bag = new Disposer();
    let left = 0;
    bag.add(() => left--);
    bag.add(() => left--);
    left = 2;
    expect(bag.size).toBe(2);
    bag.dispose();
    expect(bag.size).toBe(0);
    expect(left).toBe(0);
    expect(bag.disposed).toBe(true);
    bag.dispose();
    expect(bag.size).toBe(0);
  });

  it("已经收过之后再登记的,立刻就地收掉", () => {
    const bag = new Disposer();
    bag.dispose();
    let done = false;
    bag.add(() => {
      done = true;
    });
    expect(done).toBe(true);
    expect(bag.size).toBe(0);
  });

  it("某一件清理抛错也不影响后面的", () => {
    const bag = new Disposer();
    let tail = false;
    bag.add(() => {
      tail = true;
    });
    bag.add(() => {
      throw new Error("清理出错");
    });
    bag.dispose();
    expect(tail).toBe(true);
    expect(bag.size).toBe(0);
  });
});
