/**
 * 扫雷花园的手绘小图标（1.3 视觉升级）。
 *
 * 全部是纯函数：同样的入参永远吐出同一份「形状清单」，一笔都不会多。
 * 真正变成 `<svg>` 节点交给 `buildIcon()`——真机走 `createElementNS`，
 * 单测的 DOM 替身没有它就退回 `createElement`，两边都能长出同一棵树。
 *
 * emoji 只活在每个图标的 `<title>` 里当无障碍与旧断言的口径，不再是视觉主体。
 */

export interface ArtShape {
  tag: "path" | "circle" | "rect" | "ellipse";
  attrs: Record<string, string>;
}

export interface ArtIcon {
  viewBox: string;
  /** 塞进 `<title>` 的文案（也是这枚图标替换掉的那个 emoji） */
  title: string;
  shapes: ArtShape[];
}

/** 花的三档：0 = 破土（土裂缝里探出花芯）、1 = 花苞、2 = 五瓣盛开 */
export function flowerSVG(stage: 0 | 1 | 2 = 2): ArtIcon {
  if (stage === 0) {
    return {
      viewBox: "0 0 24 24",
      title: "🌼",
      shapes: [
        { tag: "ellipse", attrs: { cx: "12", cy: "17.4", rx: "7.2", ry: "3.8", fill: "#D9B98C" } },
        {
          tag: "path",
          attrs: {
            d: "M6.8 17.2l3-3.4 2.2 2 3-3.2 2.6 2.6",
            stroke: "#8A6B43",
            "stroke-width": "1.3",
            fill: "none",
            "stroke-linecap": "round",
            "stroke-linejoin": "round"
          }
        },
        { tag: "circle", attrs: { cx: "12", cy: "11.6", r: "2.7", fill: "#F2A9C4" } },
        { tag: "circle", attrs: { cx: "11.1", cy: "10.8", r: "0.9", fill: "#FFE1EC" } }
      ]
    };
  }
  if (stage === 1) {
    return {
      viewBox: "0 0 24 24",
      title: "🌼",
      shapes: [
        {
          tag: "path",
          attrs: { d: "M12 21v-8", stroke: "#5E9B45", "stroke-width": "1.8", fill: "none", "stroke-linecap": "round" }
        },
        { tag: "path", attrs: { d: "M12 17.4q-4.2-.8-4.8-4.6 3.8.4 4.8 4.6z", fill: "#7CC46F" } },
        { tag: "path", attrs: { d: "M12 15.4q4.2-.8 4.8-4.6-3.8.4-4.8 4.6z", fill: "#8CC46C" } },
        {
          tag: "path",
          attrs: { d: "M12 4.6q3.6 2.2 2.7 5.6-.8 3-2.7 3t-2.7-3Q8.4 6.8 12 4.6z", fill: "#F2A9C4" }
        },
        {
          tag: "path",
          attrs: {
            d: "M11 6.4q-1.2 2-.6 4.2",
            stroke: "#FFE1EC",
            "stroke-width": "1.1",
            fill: "none",
            "stroke-linecap": "round"
          }
        }
      ]
    };
  }
  const shapes: ArtShape[] = [];
  for (let k = 0; k < 5; k++) {
    shapes.push({
      tag: "ellipse",
      attrs: {
        cx: "12",
        cy: "6.3",
        rx: "3.1",
        ry: "4.5",
        fill: "#FFDDEB",
        stroke: "#F2B8CC",
        "stroke-width": "0.7",
        transform: `rotate(${k * 72} 12 12)`,
        "data-part": "petal"
      }
    });
  }
  for (let k = 0; k < 5; k++) {
    shapes.push({
      tag: "ellipse",
      attrs: { cx: "12", cy: "7.5", rx: "1.5", ry: "2.6", fill: "#FFF1F6", transform: `rotate(${k * 72} 12 12)` }
    });
  }
  shapes.push({
    tag: "circle",
    attrs: { cx: "12", cy: "12", r: "3.1", fill: "#F7C948", stroke: "#E0A94A", "stroke-width": "0.8" }
  });
  shapes.push({ tag: "circle", attrs: { cx: "10.9", cy: "10.9", r: "1", fill: "#FFF3C9" } });
  return { viewBox: "0 0 24 24", title: "🌼", shapes };
}

/** 小旗：木杆 + 红色三角旗面 + 一道褶皱高光 */
export function flagSVG(): ArtIcon {
  return {
    viewBox: "0 0 24 24",
    title: "🚩",
    shapes: [
      { tag: "ellipse", attrs: { cx: "10", cy: "20.6", rx: "4", ry: "1.1", fill: "#557A43", opacity: "0.3" } },
      { tag: "rect", attrs: { x: "7.1", y: "3.4", width: "1.8", height: "17", rx: "0.9", fill: "#8A5B33" } },
      { tag: "circle", attrs: { cx: "8", cy: "3.4", r: "1.2", fill: "#A97648" } },
      { tag: "path", attrs: { d: "M9.2 5.2l10.6 3.2-10.6 3.2z", fill: "#E4574C", "data-part": "banner" } },
      { tag: "path", attrs: { d: "M9.8 6.4l6.4 2-6.4 2z", fill: "#F08074" } }
    ]
  };
}

/** 四叶草：结算时替「插错的旗」圆场用 */
export function cloverSVG(): ArtIcon {
  const shapes: ArtShape[] = [];
  for (let k = 0; k < 4; k++) {
    shapes.push({
      tag: "ellipse",
      attrs: {
        cx: "12",
        cy: "7.4",
        rx: "3.2",
        ry: "4.2",
        fill: "#59A34E",
        transform: `rotate(${45 + k * 90} 12 12)`,
        "data-part": "leaf"
      }
    });
  }
  for (let k = 0; k < 4; k++) {
    shapes.push({
      tag: "ellipse",
      attrs: { cx: "12", cy: "8.2", rx: "1.5", ry: "2.3", fill: "#7CC46F", transform: `rotate(${45 + k * 90} 12 12)` }
    });
  }
  shapes.push({
    tag: "path",
    attrs: {
      d: "M12 12q1.6 4.4 3.2 6.2",
      stroke: "#4E8C44",
      "stroke-width": "1.5",
      fill: "none",
      "stroke-linecap": "round"
    }
  });
  return { viewBox: "0 0 24 24", title: "🍀", shapes };
}

/** 木牌问号：拿不准的格子插一块刻着问号的小木牌 */
export function signSVG(): ArtIcon {
  return {
    viewBox: "0 0 24 24",
    title: "❓",
    shapes: [
      { tag: "rect", attrs: { x: "11.1", y: "12.5", width: "1.8", height: "8.5", rx: "0.9", fill: "#8A5B33" } },
      {
        tag: "rect",
        attrs: {
          x: "4.6",
          y: "2.8",
          width: "14.8",
          height: "10.8",
          rx: "2.4",
          fill: "#E3B87E",
          stroke: "#A97B44",
          "stroke-width": "1.1"
        }
      },
      { tag: "path", attrs: { d: "M6 11.4h12", stroke: "#CDA05F", "stroke-width": "0.8", fill: "none" } },
      {
        tag: "path",
        attrs: {
          d: "M9.9 6.4q0-2 2.1-2t2.1 1.8q0 1.2-1.3 1.8-.8.4-.8 1.1",
          stroke: "#6B4A2B",
          "stroke-width": "1.5",
          fill: "none",
          "stroke-linecap": "round"
        }
      },
      { tag: "circle", attrs: { cx: "12", cy: "10.6", r: "0.9", fill: "#6B4A2B" } }
    ]
  };
}

/** 大花环：胜利结算面板配图 */
export function wreathSVG(): ArtIcon {
  const shapes: ArtShape[] = [
    { tag: "circle", attrs: { cx: "12", cy: "12", r: "8", stroke: "#6FA85A", "stroke-width": "2.4", fill: "none" } }
  ];
  for (let k = 0; k < 4; k++) {
    shapes.push({
      tag: "ellipse",
      attrs: { cx: "12", cy: "4", rx: "1.5", ry: "2.5", fill: "#8CC46C", transform: `rotate(${36 + k * 90} 12 12)` }
    });
  }
  const spots = [
    { x: "12", y: "4", fill: "#F2A9C4" },
    { x: "19.6", y: "9.5", fill: "#F7C948" },
    { x: "16.7", y: "19", fill: "#FFDDEB" },
    { x: "7.3", y: "19", fill: "#F7C948" },
    { x: "4.4", y: "9.5", fill: "#F2A9C4" }
  ];
  for (const s of spots) {
    shapes.push({ tag: "circle", attrs: { cx: s.x, cy: s.y, r: "1.7", fill: s.fill } });
  }
  shapes.push({ tag: "circle", attrs: { cx: "12", cy: "4", r: "0.6", fill: "#FFF3C9" } });
  shapes.push({ tag: "circle", attrs: { cx: "16.7", cy: "19", r: "0.6", fill: "#F7C948" } });
  return { viewBox: "0 0 24 24", title: "🏵", shapes };
}

/** 浇水壶：失败结算的温柔配图——没扫完的花园回头再浇一浇（≤ 15 笔） */
export function wateringCanSVG(): ArtIcon {
  return {
    viewBox: "0 0 24 24",
    title: "🌱",
    shapes: [
      { tag: "rect", attrs: { x: "7", y: "9", width: "10", height: "9", rx: "2", fill: "#7E97C0" } },
      { tag: "rect", attrs: { x: "8.2", y: "10.2", width: "2.2", height: "6.6", rx: "1.1", fill: "#A9BCD9" } },
      { tag: "path", attrs: { d: "M7 12L2.6 8.6 4 7.2l4.4 3.4z", fill: "#7E97C0" } },
      { tag: "circle", attrs: { cx: "3.2", cy: "7.8", r: "1.5", fill: "#65799C" } },
      {
        tag: "path",
        attrs: { d: "M17 11q4 .4 4 3.4t-4 3.4", stroke: "#65799C", "stroke-width": "1.6", fill: "none" }
      },
      {
        tag: "path",
        attrs: { d: "M9.5 9q2.5-3 5 0", stroke: "#65799C", "stroke-width": "1.6", fill: "none" }
      },
      { tag: "circle", attrs: { cx: "2.4", cy: "11.5", r: "0.9", fill: "#9CC8E8" } },
      { tag: "circle", attrs: { cx: "4", cy: "13.4", r: "0.9", fill: "#9CC8E8" } },
      { tag: "circle", attrs: { cx: "1.6", cy: "14", r: "0.7", fill: "#9CC8E8" } },
      {
        tag: "path",
        attrs: { d: "M3.4 20.4q-.4-2.6 0-4", stroke: "#5E9B45", "stroke-width": "1.4", fill: "none", "stroke-linecap": "round" }
      },
      { tag: "ellipse", attrs: { cx: "2.2", cy: "16.6", rx: "1.3", ry: "0.8", fill: "#7CC46F", transform: "rotate(-30 2.2 16.6)" } },
      { tag: "ellipse", attrs: { cx: "4.8", cy: "17.4", rx: "1.3", ry: "0.8", fill: "#8CC46C", transform: "rotate(24 4.8 17.4)" } }
    ]
  };
}

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * 把形状清单长成一棵 `<svg>`。
 * 图标一律 `aria-hidden`：格子的状态由按钮的 `aria-label` 念，图标只管好看。
 */
export function buildIcon(icon: ArtIcon, cls = ""): Element {
  const doc = document as Document & { createElementNS?: (ns: string, tag: string) => Element };
  const make = (tag: string): Element =>
    typeof doc.createElementNS === "function"
      ? doc.createElementNS(SVG_NS, tag)
      : (doc.createElement(tag) as unknown as Element);
  const svg = make("svg");
  svg.setAttribute("viewBox", icon.viewBox);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  if (cls) svg.setAttribute("class", cls);
  const title = make("title");
  title.textContent = icon.title;
  svg.appendChild(title);
  for (const s of icon.shapes) {
    const node = make(s.tag);
    for (const [k, v] of Object.entries(s.attrs)) node.setAttribute(k, v);
    svg.appendChild(node);
  }
  return svg;
}
