/**
 * Jotl 图标的前景: 一对花括号 (Schema / JSON 的意象) 夹着字母 J; J 的横笔画成带光标的输入框,
 * 左侧点缀两层表单控件 (上层开关, 下层单选框与复选框), 表达 "schema 渲染为表单"。
 * 配色取语法高亮的观感: 括号金橙, 输入框蓝, J 身紫粉, 表单控件用柔和的粉, 青, 淡紫, 各部件像不同类别的 token。
 *
 * 底座 (画布尺寸, 圆角, 背景渐变, 描边) 来自 `lib/icon-brand.mjs`, 这里只描述前景。
 * SVG 与 PNG 都由 `scripts/gen-icon.mjs` 从这一份数据生成, 不要手写 `media/icon.svg`。
 * 渲染器只支持折线, 曲线段在这里按固定步数采样成折线。
 */
import { ACCENT_FROM, ACCENT_TO, SIZE, baseShapes } from './lib/icon-brand.mjs';

const STEPS = 12;
const round = value => Math.round(value * 100) / 100;

/** 二次贝塞尔采样, 不含起点。 */
function quad(from, control, to) {
  const points = [];
  for (let i = 1; i <= STEPS; i += 1) {
    const t = i / STEPS;
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    points.push([round(a * from[0] + b * control[0] + c * to[0]), round(a * from[1] + b * control[1] + c * to[1])]);
  }
  return points;
}

/** 三次贝塞尔采样, 不含起点。 */
function cubic(from, c1, c2, to) {
  const points = [];
  for (let i = 1; i <= STEPS; i += 1) {
    const t = i / STEPS;
    const u = 1 - t;
    const x = u * u * u * from[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * to[0];
    const y = u * u * u * from[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * to[1];
    points.push([round(x), round(y)]);
  }
  return points;
}

const vertical = (from, to) => ({ kind: 'linear', from, to, direction: 'vertical' });

const BRACE = vertical('#FFD866', '#FF9F43');
const INPUT = vertical(ACCENT_FROM, ACCENT_TO);
const STEM = vertical('#C792EA', '#FF6AC1');
/** 开关偏粉, 介于括号的橙与 J 身的粉之间, 避免与括号同为暖橙而辨识度不足。 */
const SWITCH = vertical('#FFB3C1', '#FF7E9D');
const RADIO = vertical('#9BE7F0', '#5BC4DE');
const CHECK = vertical('#C3B5FF', '#9D88F2');
/** 光标, 开关圆钮与对勾用略带暖调的近白, 比纯白柔和; 不用半透明, 以免在小尺寸下与底色混在一起。 */
const WHITE = '#FFF8F2';

/** 左花括号; 右花括号按画布中线镜像。 */
const leftBrace = [
  [88, 48],
  ...quad([88, 48], [66, 48], [66, 72]),
  [66, 108],
  ...quad([66, 108], [66, 128], [48, 128]),
  ...quad([48, 128], [66, 128], [66, 148]),
  [66, 184],
  ...quad([66, 184], [66, 208], [88, 208]),
];
const rightBrace = leftBrace.map(([x, y]) => [SIZE - x, y]);

/** 前景四周统一的留白; 前景按设计坐标画在中心 174×174 的方框内 (花括号含描边), 再以画布中心等比缩放到留白处。 */
const MARGIN = 34;
const DESIGN_HALF = 87;
const SCALE = (SIZE / 2 - MARGIN) / DESIGN_HALF;
const C = SIZE / 2;
const sx = value => round(C + (value - C) * SCALE);
const sl = value => round(value * SCALE);

/** J 的竖笔比初版加长的长度; 输入框为避开花括号上端下移, 竖笔相应少加长一些, 弯钩底部位置不变。 */
const STEM_EXTRA = 12;
/** J 一组 (输入框, 竖笔与弯钩, 开关) 的竖直偏移, 使其在花括号内上下居中。 */
const DY = -3;

/** 花括号竖段的内沿 (竖段中心 66 / 190, 描边 14)。 */
const BRACE_INNER_LEFT = 73;
const BRACE_INNER_RIGHT = SIZE - BRACE_INNER_LEFT;
/** 三个表单控件的统一高度与整组宽度 (下层: 单选框, 间隔, 复选框)。 */
const CONTROL = 22;
const CONTROL_GAP = 6;
const CONTROL_WIDTH = CONTROL * 2 + CONTROL_GAP;
/** 控件与 J 竖笔之间的空隙。 */
const STEM_GAP = 14;
const STEM_WIDTH = 20;
/** 控件左沿到左括号, J 右沿到右括号的距离相等。 */
const SIDE = (BRACE_INNER_RIGHT - BRACE_INNER_LEFT - CONTROL_WIDTH - STEM_GAP - STEM_WIDTH) / 2;
const CONTROL_LEFT = BRACE_INNER_LEFT + SIDE;
const CHECK_LEFT = CONTROL_LEFT + CONTROL + CONTROL_GAP;
const STEM_X = CONTROL_LEFT + CONTROL_WIDTH + STEM_GAP + STEM_WIDTH / 2;
const J_RIGHT = STEM_X + STEM_WIDTH / 2;
/** 开关圆钮与轨道边缘的距离。 */
const SWITCH_INSET = 3.75;
const SWITCH_KNOB_R = CONTROL / 2 - SWITCH_INSET;
const SWITCH_KNOB_X = CONTROL_LEFT + CONTROL_WIDTH - CONTROL / 2;
/** 圆钮左侧的短横线: 可见长度 (含圆头) 比圆钮直径短, 线宽与光标接近; 在轨道左沿与圆钮之间居中。 */
const SWITCH_DASH_LEN = 11;
const SWITCH_DASH = 3;
const SWITCH_DASH_START = (CONTROL_LEFT + SWITCH_KNOB_X - SWITCH_KNOB_R) / 2 - SWITCH_DASH_LEN / 2;
/** 两层控件的上沿。 */
const ROW_1 = 104;
const ROW_2 = ROW_1 + CONTROL + 6;

/** 以画布中心等比缩放一个前景图形。 */
function scaled(shape) {
  const out = { ...shape };
  if (shape.points) out.points = shape.points.map(([x, y]) => [sx(x), sx(y)]);
  for (const key of ['x', 'y', 'cx', 'cy']) if (key in shape) out[key] = sx(shape[key]);
  for (const key of ['w', 'h', 'r', 'outer', 'inner', 'strokeWidth']) if (key in shape) out[key] = sl(shape[key]);
  return out;
}

export default {
  size: SIZE,
  label: 'Jotl',
  shapes: [
    ...baseShapes(),
    ...[
      { kind: 'polyline', points: leftBrace, stroke: BRACE, strokeWidth: 14 },
      { kind: 'polyline', points: rightBrace, stroke: BRACE, strokeWidth: 14 },
      // J 的横笔: 输入框与光标, 右沿与竖笔右沿齐平
      {
        kind: 'roundedRectStroke',
        x: CONTROL_LEFT + 3,
        y: 68 + DY,
        w: J_RIGHT - 3 - (CONTROL_LEFT + 3),
        h: 28,
        r: 9,
        stroke: INPUT,
        strokeWidth: 6,
      },
      { kind: 'roundedRect', x: CONTROL_LEFT + 14, y: 75 + DY, w: 4, h: 14, r: 2, fill: WHITE },
      // J 的竖笔与弯钩, 从输入框底边伸出
      {
        kind: 'polyline',
        points: [
          [0, 96],
          [0, 150 + STEM_EXTRA],
          ...cubic([0, 150 + STEM_EXTRA], [0, 190 + STEM_EXTRA], [-40, 192 + STEM_EXTRA], [-40, 162 + STEM_EXTRA]),
        ].map(([x, y]) => [x + STEM_X, y + DY]),
        stroke: STEM,
        strokeWidth: STEM_WIDTH,
      },
      // 点缀上层: 开关
      { kind: 'roundedRect', x: CONTROL_LEFT, y: ROW_1, w: CONTROL_WIDTH, h: CONTROL, r: CONTROL / 2, fill: SWITCH },
      // 开关圆钮靠右, 与轨道边缘留出 SWITCH_INSET
      { kind: 'circle', cx: SWITCH_KNOB_X, cy: ROW_1 + CONTROL / 2, r: SWITCH_KNOB_R, fill: WHITE },
      // 圆钮左侧一道短横线, 在轨道左沿与圆钮之间水平居中; 端点内缩半个线宽, 使圆头落在线段长度内
      {
        kind: 'polyline',
        points: [
          [SWITCH_DASH_START + SWITCH_DASH / 2, ROW_1 + CONTROL / 2],
          [SWITCH_DASH_START + SWITCH_DASH_LEN - SWITCH_DASH / 2, ROW_1 + CONTROL / 2],
        ],
        stroke: WHITE,
        strokeWidth: SWITCH_DASH,
      },
      // 点缀下层: 选中的单选框与勾选的复选框, 左右分别与开关对齐
      {
        kind: 'ring',
        cx: CONTROL_LEFT + CONTROL / 2,
        cy: ROW_2 + CONTROL / 2,
        outer: CONTROL / 2,
        inner: 6.5,
        fill: RADIO,
      },
      { kind: 'circle', cx: CONTROL_LEFT + CONTROL / 2, cy: ROW_2 + CONTROL / 2, r: 4, fill: RADIO },
      { kind: 'roundedRect', x: CHECK_LEFT, y: ROW_2, w: CONTROL, h: CONTROL, r: 6, fill: CHECK },
      {
        kind: 'polyline',
        points: [
          [5.5, 11.4],
          [9.4, 15.3],
          [16.5, 7],
        ].map(([x, y]) => [CHECK_LEFT + x, ROW_2 + y]),
        stroke: WHITE,
        strokeWidth: 3.4,
      },
    ].map(scaled),
  ],
};
