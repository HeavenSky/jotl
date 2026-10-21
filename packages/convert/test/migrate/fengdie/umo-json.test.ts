// 文法与 toJson: umo-edit-sdk 文法的各种写法解析为与 toJson 同构的 umo JSON; 期望值取自 umo-edit-sdk 0.0.8 的实际输出.
import { describe, expect, it } from 'vitest';
import { fengdieToUmoJson } from '../../../src/migrate/index.js';
import { FILE, codes, located } from './helpers.js';

function umo(source: string): unknown {
  const result = fengdieToUmoJson(source, FILE);
  expect(result.value, JSON.stringify(result.diagnostics)).toBeDefined();
  return result.value;
}

const str = (key: string, description: string) => ({ key, type: 'string', description });

describe('新增写法', () => {
  it('Action, OpenAction(空体)与 Spm', () => {
    expect(
      umo(`Object(根) { a(行为): Action[group: "advance"] { url(链接): URL } b(开放): OpenAction {} c(埋点): Spm }`)
    ).toEqual({
      type: 'object',
      description: '根',
      properties: {
        a: {
          key: 'a',
          type: 'action',
          description: '行为',
          properties: { url: { key: 'url', type: 'url', description: '链接' } },
          meta: { group: 'advance' },
        },
        b: { key: 'b', type: 'openAction', description: '开放', properties: {} },
        c: {
          key: 'c',
          type: 'spm',
          description: '埋点',
          properties: { spma: str('spma', 'a位'), spmb: str('spmb', 'b位'), spmc: str('spmc', 'c位') },
        },
      },
    });
  });

  it('Module 与 ModuleArray: 带元数据时补 dist, 不带时保留原写法', () => {
    expect(
      umo(
        `Object(根) { m(模块): Module[namespace: "ns", version: "1"] { t(标题) } ma(模块数组): ModuleArray[namespace: "ns"] { t(标题) } n(无元数据): Module { t(T) } }`
      )
    ).toEqual({
      type: 'object',
      description: '根',
      properties: {
        m: {
          key: 'm',
          type: 'module',
          description: '模块',
          properties: { t: str('t', '标题') },
          meta: { namespace: 'ns', version: '1', dist: 'https://alipay.com' },
        },
        ma: {
          key: 'ma',
          type: 'modulearray',
          description: '模块数组',
          properties: { t: str('t', '标题') },
          meta: { namespace: 'ns', dist: 'https://alipay.com' },
        },
        n: { key: 'n', type: 'Module', description: '无元数据', properties: { t: str('t', 'T') } },
      },
    });
  });

  it('命名空间.组件, [Array] 与 [Object]', () => {
    expect(
      umo(
        `Object(根) { c(自定义): ns.Comp { t(T) } ca(数组): ns.Comp[Array] { t(T) } co(对象): ns.Comp[Object] { t(T) } }`
      )
    ).toEqual({
      type: 'object',
      description: '根',
      properties: {
        c: { key: 'c', type: 'ns.Comp', description: '自定义', properties: { t: str('t', 'T') } },
        ca: { key: 'ca', type: 'ns.Comp[Array]', description: '数组', properties: { t: str('t', 'T') } },
        co: { key: 'co', type: 'ns.Comp', description: '对象', properties: { t: str('t', 'T') } },
      },
    });
  });

  it('Array<string> 与 Array<number>(类型名不区分大小写)', () => {
    expect(umo(`Object(根) { s(字符串): Array<string> n(数字): Array<number> x(大写): Array<Number> }`)).toEqual({
      type: 'object',
      description: '根',
      properties: {
        s: { key: 's', type: 'arraystring', description: '字符串' },
        n: { key: 'n', type: 'arraynumber', description: '数字' },
        x: { key: 'x', type: 'arraynumber', description: '大写' },
      },
    });
  });

  it('负数元数据与 $ 开头的名字', () => {
    expect(umo(`Object(根) { n(数): Number[min: -10, max: -0.5] $a(美元): String $b-c(横线) }`)).toEqual({
      type: 'object',
      description: '根',
      properties: {
        n: { key: 'n', type: 'number', description: '数', meta: { min: -10, max: -0.5 } },
        $a: str('$a', '美元'),
        '$b-c': str('$b-c', '横线'),
      },
    });
  });

  it('Object[...] Array[...] Enum[...] 无体写法', () => {
    expect(
      umo(
        `Object(根) { o(对象): Object[entityType: "user"] a(数组): Array[entityType: "user"] e(枚举): Enum[source: "api"] }`
      )
    ).toEqual({
      type: 'object',
      description: '根',
      properties: {
        o: { key: 'o', type: 'object', description: '对象', properties: {}, meta: { entityType: 'user' } },
        a: { key: 'a', type: 'array', description: '数组', properties: {}, meta: { entityType: 'user' } },
        e: { key: 'e', type: 'enum', description: '枚举', items: [], meta: { source: 'api' } },
      },
    });
  });

  it('export 多文档', () => {
    expect(umo(`export a Object(甲) { x(X) } export b Array(乙) { y(Y) }`)).toEqual({
      a: { type: 'object', description: '甲', properties: { x: str('x', 'X') } },
      b: { type: 'array', description: '乙', properties: { y: str('y', 'Y') } },
    });
  });

  it('public Lottery', () => {
    expect(umo(`public Lottery(抽奖) { flag(F) }`)).toEqual({
      type: 'object',
      description: '抽奖',
      properties: { flag: str('flag', 'F') },
      lottery: true,
      public: true,
    });
  });

  it('根为 OpenAction, ModuleArray, 命名空间.组件[Array] 与空对象', () => {
    expect(umo(`OpenAction(根) { u(U): URL }`)).toEqual({
      type: 'openaction',
      description: '根',
      properties: { u: { key: 'u', type: 'url', description: 'U' } },
    });
    expect(umo(`ModuleArray(根)[namespace: "n"] { t(T) }`)).toEqual({
      type: 'modulearray',
      description: '根',
      properties: { t: str('t', 'T') },
      meta: { namespace: 'n', dist: 'https://alipay.com' },
    });
    expect(umo(`ns.Comp[Array](根) { t(T) }`)).toEqual({
      type: 'ns.Comp[Array]',
      description: '根',
      properties: { t: str('t', 'T') },
    });
    expect(umo(`Object(空) {}`)).toEqual({ type: 'object', description: '空', properties: {} });
  });
});

describe('toJson 的取舍', () => {
  it('类型取路径中第一段已知类型名, 都不认识时为 string 并报 JOTL8111', () => {
    const result = fengdieToUmoJson(`Object(根) { a(A): cms.$x.image b(B): foo }`, FILE);
    expect(result.value).toMatchObject({ properties: { a: { type: 'image' }, b: { type: 'string' } } });
    expect(codes(result.diagnostics)).toEqual(['JOTL8111']);
  });

  it('白名单外的元数据丢弃(JOTL8105), custom 开头的保留, 重复的后者覆盖(JOTL8110)', () => {
    const result = fengdieToUmoJson(
      `Object(根) { a(A): String[foo: 1, customBar: "x", maxLength: 1, maxLength: 2] }`,
      FILE
    );
    expect(result.value).toMatchObject({ properties: { a: { meta: { customBar: 'x', maxLength: 2 } } } });
    expect(codes(result.diagnostics)).toEqual(['JOTL8105', 'JOTL8110']);
  });

  it('没有元数据表的类型: toJson 会抛错, 迁移丢弃并报 JOTL8118', () => {
    const result = fengdieToUmoJson(
      `Object(根) { a(A): Array<string>[minLength: 1] b(B): Component[group: "x"] }`,
      FILE
    );
    expect(result.value).toMatchObject({
      properties: { a: { type: 'arraystring', meta: {} }, b: { type: 'component', meta: {} } },
    });
    expect(codes(result.diagnostics)).toEqual(['JOTL8118', 'JOTL8118']);
  });

  it('重复字段后者覆盖, 位置取第一次出现处', () => {
    const result = fengdieToUmoJson(`Object(根) { a(一) b(B) a(二): Number }`, FILE);
    expect(Object.keys((result.value as { properties: object }).properties)).toEqual(['a', 'b']);
    expect(result.value).toMatchObject({ properties: { a: { description: '二', type: 'number' } } });
    expect(codes(result.diagnostics)).toEqual(['JOTL8109']);
  });

  it('枚举成员只取说明与名字; 成员上的类型与元数据报 JOTL8112', () => {
    const result = fengdieToUmoJson(`Object(根) { e(E): Enum { a(甲): Number[min: 1] b(乙) } }`, FILE);
    expect(result.value).toMatchObject({
      properties: {
        e: {
          items: [
            { label: '甲', value: 'a' },
            { label: '乙', value: 'b' },
          ],
        },
      },
    });
    expect(codes(result.diagnostics)).toEqual(['JOTL8112', 'JOTL8112']);
  });
});

describe('语法错误', () => {
  it.each([
    ['点号路径的第一段被命名空间规则吞掉', `Object(根) { x(X): image.png }`],
    ['public 不能用于 Action', `public Action(根) { a(A) }`],
    ['数组不允许空体', `Object(根) { a(A): Array {} }`],
    ['空元数据', `Object(根) { a(A): String[] }`],
    ['缺少说明', `Object(根) { a: String }`],
  ])('%s', (_name, source) => {
    const result = fengdieToUmoJson(source, FILE);
    expect(result.value).toBeUndefined();
    expect(codes(result.diagnostics)).toEqual(['JOTL8002']);
  });

  it('位置与消息', () => {
    const result = fengdieToUmoJson(`Object(根) {\n  a: String\n}`, FILE);
    expect(located(result.diagnostics)).toEqual([{ code: 'JOTL8002', line: 2, column: 4 }]);
    expect(result.diagnostics[0]!.message).toBe('凤蝶 schema 语法错误: 此处应为 说明 `(...)`, 实际是 `:`');
  });
});
