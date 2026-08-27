/**
 * 1.3 素材包 · 测试桩（`src/art/kit/testing.ts`）
 *
 * `makeStubCtx()` 返回一个记录式 2D context 桩：记下每次绘制调用的方法名与参数、
 * 每次样式赋值（fillStyle / font / globalAlpha…），并统计非有限数值参数的个数
 * （素材契约：极端输入不许画出 NaN 坐标）。
 *
 * 仓库 vitest 跑在 node 环境（没有 jsdom），参考 `src/games/gold-hook/domStub.ts`
 * 的思路但更通用：本桩供本目录以及后面 25 个视觉步的素材契约测试复用。
 * 文件不带 `.test.` 后缀，vitest 不会当用例；纯模块无副作用，不碰 DOM。
 */

/** 一次被记录的调用（属性赋值记成 `set:属性名`） */
export interface CtxCall {
  method: string;
  args: unknown[];
}

function fmtArg(a: unknown): string {
  if (typeof a === "number") return String(Math.round(a * 1000) / 1000);
  return String(a);
}

/** 记录式 2D context 桩。用 `stub.ctx` 拿到可传给绘制函数的视图。 */
export class StubCtx2D {
  /** 按时间顺序记录的全部调用 */
  readonly calls: CtxCall[] = [];
  /** 每次给 fillStyle 赋的值（字符串化） */
  readonly fillStyleLog: string[] = [];
  /** 每次给 strokeStyle 赋的值（字符串化） */
  readonly strokeStyleLog: string[] = [];
  /** 每次给 font 赋的值 */
  readonly fontLog: string[] = [];
  /** fillText / strokeText 画过的文字 */
  readonly textLog: string[] = [];
  /** 见过的非有限数值参数个数（NaN / ±Infinity） */
  nonFiniteArgs = 0;

  private _fillStyle: unknown = "#000000";
  private _strokeStyle: unknown = "#000000";
  private _lineWidth = 1;
  private _lineCap = "butt";
  private _lineJoin = "miter";
  private _miterLimit = 10;
  private _globalAlpha = 1;
  private _font = "10px sans-serif";
  private _textAlign = "start";
  private _textBaseline = "alphabetic";
  private _shadowBlur = 0;
  private _shadowColor = "rgba(0, 0, 0, 0)";
  private _shadowOffsetX = 0;
  private _shadowOffsetY = 0;
  private _lineDashOffset = 0;
  private _globalCompositeOperation = "source-over";
  private _imageSmoothingEnabled = true;

  /** 以 2D context 的身份交给绘制函数（结构桩，够用即真） */
  get ctx(): CanvasRenderingContext2D {
    return this as unknown as CanvasRenderingContext2D;
  }

  /** 某方法被调用了几次（属性赋值查 `set:属性名`） */
  count(method: string): number {
    let n = 0;
    for (const c of this.calls) if (c.method === method) n++;
    return n;
  }

  /** 几个方法的调用次数之和 */
  countAny(...methods: string[]): number {
    let n = 0;
    for (const m of methods) n += this.count(m);
    return n;
  }

  /** 某方法最近一次调用的参数；没调用过返回 null */
  last(method: string): unknown[] | null {
    for (let i = this.calls.length - 1; i >= 0; i--) {
      if (this.calls[i].method === method) return this.calls[i].args;
    }
    return null;
  }

  /** 去重后的 fillStyle 值集合（断言三阶光影用） */
  distinctFillStyles(): string[] {
    return [...new Set(this.fillStyleLog)];
  }

  /** 整段调用序列拼成字符串（数值取 3 位小数），断言「输出不同」用 */
  snapshot(): string {
    return this.calls.map((c) => `${c.method}(${c.args.map(fmtArg).join(",")})`).join(";");
  }

  /** 清空全部记录，方便一个用例里画两次对比 */
  reset(): void {
    this.calls.length = 0;
    this.fillStyleLog.length = 0;
    this.strokeStyleLog.length = 0;
    this.fontLog.length = 0;
    this.textLog.length = 0;
    this.nonFiniteArgs = 0;
  }

  private rec(method: string, args: unknown[]): void {
    for (const a of args) {
      if (typeof a === "number" && !Number.isFinite(a)) this.nonFiniteArgs++;
    }
    this.calls.push({ method, args });
  }

  // —— 样式属性（赋值都会被记录） ——
  get fillStyle(): unknown {
    return this._fillStyle;
  }
  set fillStyle(v: unknown) {
    this._fillStyle = v;
    this.fillStyleLog.push(String(v));
    this.rec("set:fillStyle", [String(v)]);
  }
  get strokeStyle(): unknown {
    return this._strokeStyle;
  }
  set strokeStyle(v: unknown) {
    this._strokeStyle = v;
    this.strokeStyleLog.push(String(v));
    this.rec("set:strokeStyle", [String(v)]);
  }
  get lineWidth(): number {
    return this._lineWidth;
  }
  set lineWidth(v: number) {
    this._lineWidth = v;
    this.rec("set:lineWidth", [v]);
  }
  get lineCap(): string {
    return this._lineCap;
  }
  set lineCap(v: string) {
    this._lineCap = v;
    this.rec("set:lineCap", [v]);
  }
  get lineJoin(): string {
    return this._lineJoin;
  }
  set lineJoin(v: string) {
    this._lineJoin = v;
    this.rec("set:lineJoin", [v]);
  }
  get miterLimit(): number {
    return this._miterLimit;
  }
  set miterLimit(v: number) {
    this._miterLimit = v;
    this.rec("set:miterLimit", [v]);
  }
  get globalAlpha(): number {
    return this._globalAlpha;
  }
  set globalAlpha(v: number) {
    this._globalAlpha = v;
    this.rec("set:globalAlpha", [v]);
  }
  get font(): string {
    return this._font;
  }
  set font(v: string) {
    this._font = v;
    this.fontLog.push(v);
    this.rec("set:font", [v]);
  }
  get textAlign(): string {
    return this._textAlign;
  }
  set textAlign(v: string) {
    this._textAlign = v;
    this.rec("set:textAlign", [v]);
  }
  get textBaseline(): string {
    return this._textBaseline;
  }
  set textBaseline(v: string) {
    this._textBaseline = v;
    this.rec("set:textBaseline", [v]);
  }
  get shadowBlur(): number {
    return this._shadowBlur;
  }
  set shadowBlur(v: number) {
    this._shadowBlur = v;
    this.rec("set:shadowBlur", [v]);
  }
  get shadowColor(): string {
    return this._shadowColor;
  }
  set shadowColor(v: string) {
    this._shadowColor = v;
    this.rec("set:shadowColor", [v]);
  }
  get shadowOffsetX(): number {
    return this._shadowOffsetX;
  }
  set shadowOffsetX(v: number) {
    this._shadowOffsetX = v;
    this.rec("set:shadowOffsetX", [v]);
  }
  get shadowOffsetY(): number {
    return this._shadowOffsetY;
  }
  set shadowOffsetY(v: number) {
    this._shadowOffsetY = v;
    this.rec("set:shadowOffsetY", [v]);
  }
  get lineDashOffset(): number {
    return this._lineDashOffset;
  }
  set lineDashOffset(v: number) {
    this._lineDashOffset = v;
    this.rec("set:lineDashOffset", [v]);
  }
  get globalCompositeOperation(): string {
    return this._globalCompositeOperation;
  }
  set globalCompositeOperation(v: string) {
    this._globalCompositeOperation = v;
    this.rec("set:globalCompositeOperation", [v]);
  }
  get imageSmoothingEnabled(): boolean {
    return this._imageSmoothingEnabled;
  }
  set imageSmoothingEnabled(v: boolean) {
    this._imageSmoothingEnabled = v;
    this.rec("set:imageSmoothingEnabled", [v]);
  }

  // —— 状态与变换 ——
  save(): void {
    this.rec("save", []);
  }
  restore(): void {
    this.rec("restore", []);
  }
  translate(x: number, y: number): void {
    this.rec("translate", [x, y]);
  }
  rotate(a: number): void {
    this.rec("rotate", [a]);
  }
  scale(x: number, y: number): void {
    this.rec("scale", [x, y]);
  }
  transform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.rec("transform", [a, b, c, d, e, f]);
  }
  setTransform(...args: unknown[]): void {
    this.rec("setTransform", args);
  }
  resetTransform(): void {
    this.rec("resetTransform", []);
  }

  // —— 路径 ——
  beginPath(): void {
    this.rec("beginPath", []);
  }
  closePath(): void {
    this.rec("closePath", []);
  }
  moveTo(x: number, y: number): void {
    this.rec("moveTo", [x, y]);
  }
  lineTo(x: number, y: number): void {
    this.rec("lineTo", [x, y]);
  }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void {
    this.rec("quadraticCurveTo", [cx, cy, x, y]);
  }
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void {
    this.rec("bezierCurveTo", [c1x, c1y, c2x, c2y, x, y]);
  }
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean): void {
    this.rec("arc", [x, y, r, a0, a1, ccw ?? false]);
  }
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void {
    this.rec("arcTo", [x1, y1, x2, y2, r]);
  }
  ellipse(
    x: number,
    y: number,
    rx: number,
    ry: number,
    rot: number,
    a0: number,
    a1: number,
    ccw?: boolean
  ): void {
    this.rec("ellipse", [x, y, rx, ry, rot, a0, a1, ccw ?? false]);
  }
  rect(x: number, y: number, w: number, h: number): void {
    this.rec("rect", [x, y, w, h]);
  }
  roundRect(x: number, y: number, w: number, h: number, r?: unknown): void {
    this.rec("roundRect", [x, y, w, h, r ?? 0]);
  }

  // —— 绘制 ——
  fill(): void {
    this.rec("fill", []);
  }
  stroke(): void {
    this.rec("stroke", []);
  }
  clip(): void {
    this.rec("clip", []);
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    this.rec("fillRect", [x, y, w, h]);
  }
  strokeRect(x: number, y: number, w: number, h: number): void {
    this.rec("strokeRect", [x, y, w, h]);
  }
  clearRect(x: number, y: number, w: number, h: number): void {
    this.rec("clearRect", [x, y, w, h]);
  }
  fillText(text: string, x: number, y: number, maxWidth?: number): void {
    this.textLog.push(text);
    this.rec("fillText", maxWidth === undefined ? [text, x, y] : [text, x, y, maxWidth]);
  }
  strokeText(text: string, x: number, y: number, maxWidth?: number): void {
    this.textLog.push(text);
    this.rec("strokeText", maxWidth === undefined ? [text, x, y] : [text, x, y, maxWidth]);
  }

  // —— 其他常用能力（记录即可） ——
  measureText(text: string): TextMetrics {
    this.rec("measureText", [text]);
    return { width: text.length * 8 } as TextMetrics;
  }
  setLineDash(segments: number[]): void {
    this.rec("setLineDash", [...segments]);
  }
  getLineDash(): number[] {
    return [];
  }
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient {
    this.rec("createLinearGradient", [x0, y0, x1, y1]);
    return { addColorStop: () => {} } as unknown as CanvasGradient;
  }
  createRadialGradient(
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number
  ): CanvasGradient {
    this.rec("createRadialGradient", [x0, y0, r0, x1, y1, r1]);
    return { addColorStop: () => {} } as unknown as CanvasGradient;
  }
  drawImage(...args: unknown[]): void {
    this.rec("drawImage", args);
  }
}

/** 建一个全新的记录式 2D 桩 */
export function makeStubCtx(): StubCtx2D {
  return new StubCtx2D();
}
