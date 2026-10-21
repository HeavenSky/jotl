// 端到端: 凤蝶源码 → Jotl → `@jotl/core` 编译无 error 且 schema 一致; 含 umo-edit-sdk `tips.md` 的全部示例.
import { describe, expect, it } from 'vitest';
import { codes, roundTrip } from './helpers.js';

/** umo-edit-sdk 0.0.8 `tips.md` 中的全部 schema 示例(含"特性"一节 js 代码里的两段), 原样抄录. */
const TIPS: readonly [name: string, source: string, expectedCodes: string[]][] = [
  [
    'String',
    `Object(banner内容填写) {\n    btnText(活动跳转按钮文案): String[minLength: 10, default: "领取折扣"]\n}`,
    ['JOTL8108'],
  ],
  [
    'Image',
    `Object(banner内容填写) {\n  image(图片地址[图片要求尺寸为590*250]): Image[width: 590, height: 250]\n  name(用户名)\n}`,
    [],
  ],
  ['Number', `Object(券描述) {\n  amount(券金额): Number[default: 20]\n}`, []],
  ['Boolean', `Object(活动规则) {\n  show(拥有边框): Boolean\n}`, []],
  ['URL', `Array(用户列表) {\n  link(目标地址): URL[regExp: "/^https:/gi"]\n}`, []],
  ['Text', `Object(协议描述) {\n  desc(描述): Text\n}`, []],
  ['RichText', `Object(协议描述) {\n  desc(规则描述): RichText\n}`, []],
  ['Color', `Object(用户列表) {\n  bgColor(背景颜色): Color\n}`, []],
  ['Enum', `Object(描述) {\n  type(抽奖形式): Enum {\n    normal(一键抽奖),\n    checksum(校验码)\n  }\n}`, []],
  ['File', `Object(描述) {\n  desc(上传文件): File\n}`, []],
  ['Date', `Object(用户列表) {\n  name(用户名),\n  birth(出身日期): Date\n}`, []],
  ['Box', `Object(描述) {\n  button(热区按钮位置): Box\n}`, []],
  [
    '复合 Object',
    `Object(主内容) {\n  title(标题),\n  image(介绍图片): Image,\n  desc(描述),\n  btnName(按钮名称),\n  btnHref(按钮链接): URL\n}`,
    [],
  ],
  [
    '复合 Array',
    `Array(Banner，填单个图片时不轮播) {\n  link(跳转链接 [不填时点击 banner 不能转跳]): URL,\n  seed(链接埋点),\n  image(图片地址): Image[width:750]\n}`,
    [],
  ],
  [
    '自定义类型',
    `Object(生活号城市选择) {\n  citys(配置): moduleName.componentName {\n    title(按钮正上方的介绍文案),\n    moreText(按钮文案),\n    moreLink(按钮正下方的文案),\n    province(省份),\n    city(市),\n    district(区)\n  },\n}`,
    [],
  ],
  [
    '解析 schema',
    `\n  Array(foo) {\n    href(href),\n    title(title),\n    img(image url): Image,\n    amount(money amout)\n  }\n`,
    [],
  ],
  [
    '嵌套对象',
    `\n  Object(abc) {\n    title(title),\n    user(user): Object {\n      name(user name),\n      age(user age): Number\n    }\n  }\n`,
    [],
  ],
];

describe('tips.md 示例', () => {
  it.each(TIPS)('%s', (_name, source, expectedCodes) => {
    const result = roundTrip(source);
    expect(codes(result.diagnostics)).toEqual(expectedCodes);
  });

  it('自定义类型迁移为带 x-fengdie.type 的对象', () => {
    expect(roundTrip(TIPS[14]![1]).jotl).toContain("citys(配置)?: [x_fengdie: {type: 'moduleName.componentName'}] {");
  });

  it('带定界符的 regExp 去掉定界符, i 标志改写进 pattern', () => {
    expect(roundTrip(TIPS[4]![1]).jotl).toContain("link(目标地址)?: url[pattern: '^[hH][tT][tT][pP][sS]:']");
  });
});

describe('端到端', () => {
  it('运营页: 分组, 必填, 显示条件, 模块与埋点', () => {
    const result = roundTrip(`/* 运营页 */
Object(运营页) {
  title(标题): String[maxLength: 20, required: true, group: "normal", placeholder: "请输入标题"]
  showBanner(显示轮播): Boolean[default: true, group: "normal"]
  banners(轮播): Array[minLength: 1, maxLength: 5, showKey: "img", if: "$.showBanner", group: "normal"] {
    img(图片): Image[maxSize: 500]
    link(链接): URL
  }
  start(开始时间): Date[group: "operator"]
  coupon(券): Module[namespace: "mkt", component: "Coupon", version: "1.2.0", group: "developer"] {
    id(券 ID)
  }
  spm(埋点): Spm
  tags(标签): Array<string>
}`);
    expect(result.jotl).toContain(
      "Root(运营页): [groups: [{title: '常规', fields: ['title', 'showBanner', 'banners']}, {title: '运营', fields: ['start']}, {title: '开发者', fields: ['coupon']}]] {"
    );
    expect(result.jotl).toContain('  title(标题): string[');
    expect(result.jotl).toContain("root_if: 'showBanner'");
    expect(codes(result.diagnostics)).toEqual([]);
  });

  it('抽奖: public Lottery, 行为与开放行为', () => {
    const result = roundTrip(`public Lottery(大转盘)[rule: "lottery-v2"] {
  flag(活动标识)
  success(中奖配置): Array { prizeId(奖品 ID) prizeText(奖品文案): Text }
  error(失败配置): Array { code(错误码) codeText(错误文案) }
  onWin(中奖行为): Action[if: "$.flag"] { url(跳转): URL }
  share(分享): OpenAction {}
}`);
    expect(result.diagnostics).toEqual([]);
    expect(result.jotl).toContain("x_fengdie: {lottery: true, public: true, rule: 'lottery-v2'}");
  });

  it('多导出与自定义组件数组', () => {
    const result = roundTrip(`export Header Object(页头) {
  logo(Logo): Image
}
export Cards ns.Card[Array](卡片) {
  title(标题)
  price(价格): Number[min: 0]
}`);
    expect(result.jotl).toContain('Header(页头): {');
    expect(result.jotl).toContain("Cards(卡片): array[x_fengdie: {type: 'ns.Card[Array]'}] {");
  });
});
