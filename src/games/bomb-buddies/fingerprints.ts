// 前 99 关地图指纹。
//
// 1.2 动了不少生成器代码(窄屏尺寸上限、v2 掉落表),但**前 99 关一格都不许变**:
// 已经背过板、已经拿了星星的孩子回来发现地图换了,是最伤人的一种「升级」。
// 下面这 99 行是升级前跑出来的原样,格局 / 藏品 / 目标 / 出口 / 限时 / 小怪站位
// 全都压进指纹里。任何一行对不上,都说明改动漏到老关卡里去了,必须回头改。

import { buildLevel } from "./levels";

/** FNV-1a:短字符串压成一个 32 位数,够用来当「这张图变没变」的凭据 */
function hash32(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** 一关的全量指纹:尺寸 + 格局 + 藏品 + 目标 + 出口 + 限时 + 小怪站位 */
export function levelFingerprint(level: number): string {
  const lv = buildLevel(level);
  const items = [...lv.hidden.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([cell, kind]) => `${cell}${kind}`)
    .join(",");
  const critters = lv.critters.map((c) => `${c.kind}@${c.pos}`).join("|");
  return [
    `${lv.board.w}x${lv.board.h}`,
    hash32(lv.board.cells.join("")),
    hash32(items),
    lv.goal,
    lv.exit,
    lv.seconds,
    critters,
  ].join(":");
}

export const FIRST_99_FINGERPRINTS: readonly string[] = [
  "9x9:12m1j6y:1ogg45a:clear:-1:90:slime@43|slime@59",
  "9x9:300oji:weg2fn:clear:-1:90:slime@51|slime@52",
  "9x9:iz8en6:7548zg:clear:-1:90:slime@61|slime@51",
  "9x9:1h390fu:1qgo618:clear:-1:90:slime@52|slime@68",
  "9x9:1ox423a:tuqz4u:clear:-1:90:slime@61|slime@68",
  "9x9:1obxnsa:ev518z:clear:-1:90:slime@61|slime@69",
  "9x9:soq4ve:7snzj6:clear:-1:90:slime@70|slime@52|slime@69",
  "9x9:ecfhya:1eyrdd9:clear:-1:90:slime@43|slime@69|slime@70",
  "9x9:15xdii:vuxltc:clear:-1:90:slime@52|slime@70|slime@67",
  "9x9:z2i79i:otiyq3:clear:-1:90:slime@68|slime@70|slime@51",
  "9x9:1azjt0k:ztntfp:clear:-1:90:slime@67|slime@59|slime@52",
  "9x9:uai6:1axp68a:clear:-1:90:slime@52|slime@67|slime@51",
  "9x9:11e9g1e:1rq6ywz:clear:-1:90:slime@61|slime@70|slime@59",
  "9x9:1qsbctc:phz2m8:clear:-1:90:slime@51|slime@70|slime@68",
  "11x9:12w3bez:1o3s8y1:clear:-1:90:slime@85|slime@73|slime@83",
  "11x9:1k7jmyb:t0cmu3:clear:-1:90:slime@86|slime@53|slime@73",
  "11x9:owt2wt:3y7gn1:clear:-1:90:slime@64|slime@83|slime@85",
  "11x9:1tjfz3t:19kd6a:clear:-1:90:slime@86|slime@85|slime@63",
  "11x9:1uylr4b:2bo1fq:clear:-1:90:slime@83|slime@73|slime@84|slime@82",
  "11x11:1a3wz0t:1aptzyz:clear:-1:90:slime@85|slime@75|slime@97|slime@108",
  "11x11:15n7r5l:1y050m7:clear:-1:90:slime@75|slime@104|slime@97|slime@86",
  "11x11:q01vcj:n8pqf3:clear:-1:90:slime@104|slime@107|slime@85|slime@106",
  "11x11:1s7mpb5:9xv19a:clear:-1:90:slime@75|slime@104|slime@107|slime@108",
  "11x11:tmiz55:1hcfia1:clear:-1:90:slime@86|slime@84|slime@104|slime@105",
  "11x11:w40ia3:1t1e3bf:clear:-1:98:slime@75|hopper@107",
  "11x11:bbkp9h:jg2eu4:clear:-1:98:slime@107|hopper@97",
  "11x11:z4x1l3:1ax9nvu:clear:-1:98:slime@107|hopper@97",
  "11x11:klq69t:ymmtum:clear:-1:98:slime@95|hopper@108",
  "11x11:aclvut:1ryvput:clear:-1:98:slime@85|hopper@97",
  "11x11:vxiibp:1olaap6:clear:-1:98:slime@86|hopper@85",
  "11x11:1gmlfa7:10c2v8p:clear:-1:98:slime@86|hopper@106|slime@95",
  "11x11:15pl8dz:we3l94:clear:-1:98:slime@95|hopper@105|slime@85",
  "11x11:9pzwfn:bmar7l:clear:-1:98:slime@107|hopper@75|slime@97",
  "11x11:pjulbj:1alpk1y:clear:-1:98:slime@95|hopper@106|slime@108",
  "11x11:qk4fsr:nh56bk:clear:-1:98:slime@105|hopper@95|slime@106",
  "11x11:1wea5ux:tg3ixv:clear:-1:98:slime@95|hopper@97|slime@105",
  "11x11:18f6tob:xfkewa:clear:-1:98:slime@108|hopper@86|slime@106",
  "11x11:y1imsn:1qvtbh7:clear:-1:98:slime@108|hopper@97|slime@86",
  "13x11:1ne5krx:7h04l:clear:-1:98:slime@125|hopper@89|slime@102",
  "13x11:1kan4lt:u1s598:clear:-1:98:slime@126|hopper@128|slime@113",
  "13x11:13klrgf:sjmvaj:clear:-1:98:slime@102|hopper@128|slime@126",
  "13x11:8b02fp:1a4fk40:clear:-1:98:slime@125|hopper@101|slime@115",
  "13x11:bqd81j:vslfhd:clear:-1:98:slime@100|hopper@101|slime@113|hopper@89",
  "13x13:11yi1ss:1mks64x:clear:-1:98:slime@139|hopper@126|slime@154|hopper@128",
  "13x13:18jp1ys:btkcm4:clear:-1:98:slime@115|hopper@126|slime@139|hopper@141",
  "13x13:1gwnt7c:16x8pjq:clear:-1:98:slime@102|hopper@126|slime@154|hopper@153",
  "13x13:1qat5bi:hcw382:clear:-1:98:slime@128|hopper@127|slime@151|hopper@126",
  "13x13:116j33w:17pu9rm:clear:-1:98:slime@152|hopper@128|slime@139|hopper@150",
  "11x11:88y3tl:yel3w9:clear:-1:106:hopper@106|slime@105|hopper@95",
  "11x11:xlawi7:2ur7ry:clear:-1:106:hopper@105|slime@108|hopper@106",
  "11x11:1iqa5pp:ntd0yf:clear:-1:106:hopper@95|slime@97|hopper@107",
  "11x11:1sty0z1:qsv8wa:clear:-1:106:hopper@105|slime@107|hopper@108",
  "11x11:1pkpu99:88m206:clear:-1:106:hopper@106|slime@86|hopper@97",
  "11x11:1ntmmzb:syebig:clear:-1:106:hopper@86|slime@75|hopper@97",
  "11x11:1oijk7r:1sofvdx:clear:-1:106:hopper@106|slime@107|hopper@105|slime@75",
  "11x11:e7wj5f:h7ple4:clear:-1:106:hopper@107|slime@105|hopper@97|slime@64",
  "11x11:ttzlm5:15q9nnl:clear:-1:106:hopper@75|slime@97|hopper@84|slime@86",
  "11x11:170f2n7:1aemzoj:clear:-1:106:hopper@104|slime@84|hopper@64|slime@97",
  "11x11:14m9q91:p5so8h:clear:-1:106:hopper@84|slime@105|hopper@97|slime@104",
  "11x11:54tezj:72acmn:clear:-1:106:hopper@85|slime@97|hopper@108|slime@104",
  "11x11:1o3ds1f:du5byf:clear:-1:106:hopper@64|slime@75|hopper@107|slime@85",
  "11x11:blmm2f:18jgtmb:clear:-1:106:hopper@95|slime@107|hopper@106|slime@97",
  "13x11:1cbkr4l:11ckjok:clear:-1:106:hopper@128|slime@125|hopper@102|slime@115",
  "13x11:af0cpn:y2ju1z:clear:-1:106:hopper@101|slime@89|hopper@126|slime@127",
  "13x11:1c2p1rx:s2ulng:clear:-1:106:hopper@100|slime@113|hopper@124|slime@89",
  "13x11:ivvi87:sfic6r:clear:-1:106:hopper@113|slime@100|hopper@126|slime@76",
  "13x11:p6yjn1:4ar18g:clear:-1:106:hopper@76|slime@128|hopper@63|slime@100|hopper@102",
  "13x13:18acz4m:984jip:clear:-1:106:hopper@102|slime@128|hopper@139|slime@101|hopper@113",
  "13x13:60dweq:r22i07:clear:-1:106:hopper@101|slime@102|hopper@113|slime@154|hopper@151",
  "13x13:1xpgsbi:1xb7lj:clear:-1:106:hopper@126|slime@101|hopper@141|slime@151|hopper@153",
  "13x13:9j2ssk:2ut8vh:clear:-1:106:hopper@127|slime@153|hopper@150|slime@89|hopper@113",
  "13x13:b71ov0:154e59n:clear:-1:106:hopper@115|slime@101|hopper@113|slime@152|hopper@153",
  "11x11:1ru3g1t:dwg30o:clear:-1:114:hopper@95|chaser@108|hopper@85|chaser@86",
  "11x11:w8y08p:69dr3m:clear:-1:114:hopper@104|chaser@97|hopper@106|chaser@86",
  "11x11:1j4efq3:thn3k2:exit:97:129:hopper@107|chaser@84|hopper@104|chaser@64",
  "11x11:n5w7hj:1asmdew:clear:-1:114:hopper@106|chaser@97|hopper@104|chaser@75",
  "11x11:2pua8d:1huapas:clear:-1:114:hopper@104|chaser@95|hopper@97|chaser@105",
  "11x11:k06r0j:1wmc66j:clear:-1:114:hopper@95|chaser@107|hopper@84|chaser@64",
  "11x11:1oo90nx:p15lh9:exit:93:129:hopper@106|chaser@53|hopper@95|chaser@105|hopper@73",
  "11x11:144sqwr:y9tlqa:clear:-1:114:hopper@84|chaser@106|hopper@105|chaser@86|hopper@107",
  "11x11:89qzp1:1v5pk2d:clear:-1:114:hopper@95|chaser@64|hopper@75|chaser@63|hopper@106",
  "11x11:9j6c95:13qvpt0:clear:-1:114:hopper@104|chaser@64|hopper@86|chaser@75|hopper@95",
  "11x11:f71k73:grrf79:exit:97:129:hopper@73|chaser@107|hopper@95|chaser@75|hopper@108",
  "11x11:4henh7:x9cg4u:clear:-1:114:hopper@104|chaser@84|hopper@97|chaser@95|hopper@107",
  "11x11:12hu5ir:1nfbrs5:clear:-1:114:hopper@73|chaser@104|hopper@53|chaser@64|hopper@86",
  "11x11:1wie1ah:1c10pr7:clear:-1:114:hopper@64|chaser@97|hopper@85|chaser@104|hopper@63",
  "13x11:1prb5tz:sqvyaz:exit:111:129:hopper@76|chaser@128|hopper@126|chaser@125|hopper@100",
  "13x11:1sd8ypj:6wdlw4:clear:-1:114:hopper@87|chaser@75|hopper@102|chaser@124|hopper@89",
  "13x11:8v7l0d:t4hy3t:clear:-1:114:hopper@126|chaser@63|hopper@87|chaser@100|hopper@128",
  "13x11:ivb48n:il0ikk:clear:-1:114:hopper@127|chaser@89|hopper@102|chaser@124|hopper@63",
  "13x11:nqfgr5:g6hzni:exit:126:129:hopper@101|chaser@111|hopper@123|chaser@99|hopper@102|chaser@124",
  "13x13:1swkw7k:18wrd6x:clear:-1:114:hopper@151|chaser@150|hopper@127|chaser@139|hopper@89|chaser@137",
  "13x13:1srk7d8:engdn:clear:-1:114:hopper@137|chaser@152|hopper@151|chaser@126|hopper@89|chaser@115",
  "13x13:i1d1iu:18utzqv:clear:-1:114:hopper@150|chaser@125|hopper@153|chaser@151|hopper@101|chaser@115",
  "13x13:1lu8dgu:wpxwl4:exit:137:129:hopper@115|chaser@126|hopper@154|chaser@125|hopper@127|chaser@150",
  "13x13:1vidauu:s17iwy:clear:-1:114:hopper@139|chaser@141|hopper@128|chaser@126|hopper@150|chaser@152",
  "13x11:fx7dn5:vzdmio:clear:-1:122:chaser@89|hopper@76|slime@102|chaser@126",
  "13x11:18xo96v:1135e0y:clear:-1:122:chaser@126|hopper@125|slime@115|chaser@76",
  "13x11:moaltb:t5umv9:exit:98:137:chaser@115|hopper@100|slime@102|chaser@128",
];
