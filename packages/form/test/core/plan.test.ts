import { describe, expect, it } from 'vitest';
import type { JsonSchema, JsonSchemaObject } from '@jotl/core';
import { listFixtures, readFixture } from '../../../../test-utils/fixtures.js';
import {
  DEFAULT_MAX_DEPTH,
  createRegistry,
  expand,
  plan,
  type RenderPlanNode,
  type ResolveContext,
} from '../../src/core/index.js';
import { builtinRegistry, dataRoot, findNode, planOk, walk, widget } from './helpers.js';

const obj = (properties: Record<string, JsonSchema>, extra: JsonSchemaObject = {}): JsonSchemaObject => ({
  type: 'object',
  properties,
  ...extra,
});

describe('候选列表与降级', () => {
  it('F1: x-ui 指定的组件未注册', () => {
    const result = plan(obj({ a: { type: 'string', 'x-ui': { widget: 'missing' } } }), builtinRegistry());
    expect(findNode(result.value!, '/a')).toMatchObject({
      widget: 'input',
      source: 'builtin',
      degraded: [{ reason: 'F1', from: 'missing' }],
      fallbackChain: ['json'],
    });
    expect(result.diagnostics).toEqual([
      {
        code: 'JOTL5001',
        severity: 'warning',
        message: 'widget missing 未注册, 已改用下一个候选 widget(F1)',
        location: { kind: 'pointer', pointer: '/properties/a' },
      },
    ]);
  });

  it('F2: 组件的 accepts 拒绝该数据形态', () => {
    const registry = builtinRegistry([widget('slider', 'field', { accepts: s => s.type === 'number' })]);
    const root = planOk(
      obj({ a: { type: 'string', 'x-ui': { widget: 'slider' } }, b: { type: 'number', 'x-ui': { widget: 'slider' } } }),
      registry
    );
    expect(findNode(root, '/a')).toMatchObject({
      widget: 'input',
      degraded: [{ reason: 'F2', from: 'slider' }],
      fallbackChain: ['json'],
    });
    expect(findNode(root, '/b')).toMatchObject({
      widget: 'slider',
      source: 'node',
      degraded: [],
      fallbackChain: ['number', 'json'],
    });
  });

  it('fallbackChain 只含选中项之后仍可用的候选, 末尾是 json', () => {
    const registry = builtinRegistry([widget('a1'), widget('never', 'field', { accepts: () => false })]);
    const schema = obj({
      x: { type: 'string', 'x-ui': { widget: 'missing', variants: { default: { widget: 'a1' } } } },
      y: { type: 'string', 'x-ui': { widget: 'never', variants: { default: { widget: 'missing' } } } },
    });
    const root = planOk(schema, registry);
    expect(findNode(root, '/x')).toMatchObject({ widget: 'a1', degraded: [], fallbackChain: ['input', 'json'] });
    expect(findNode(root, '/y')).toMatchObject({
      widget: 'input',
      degraded: [
        { reason: 'F1', from: 'missing' },
        { reason: 'F2', from: 'never' },
      ],
      fallbackChain: ['json'],
    });
  });

  it('内置组件未注册时同样按 F1 降级到 json', () => {
    const registry = createRegistry([widget('form', 'view'), widget('page', 'layout'), widget('json')]);
    const root = planOk(obj({ t: { type: 'array', prefixItems: [{ type: 'string' }], items: false } }), registry);
    expect(findNode(root, '/t')).toMatchObject({
      widget: 'json',
      source: 'fallback',
      degraded: [{ reason: 'F1', from: 'tuple' }],
      fallbackChain: [],
      children: [],
    });
  });

  it('空注册表: 视图节点降级为 json, 不展开子节点', () => {
    const result = plan(obj({ a: { type: 'string' } }), createRegistry());
    expect(result.value).toMatchObject({
      widget: 'json',
      level: 'field',
      source: 'fallback',
      degraded: [{ reason: 'F1', from: 'form' }],
      children: [],
    });
  });

  it('F7: 不支持的特性与无法解析的引用', () => {
    const result = plan(
      obj(
        {
          n: { type: 'string', not: { const: 'x' } },
          c: {
            if: { properties: { a: { const: 1 } } },
            then: { required: ['b'] },
            type: 'object',
            properties: { a: { type: 'number' } },
          },
          r: { $ref: '#/$defs/Nope', 'x-ui': { hidden: true } },
          cycle: { $ref: '#/$defs/A' },
          ok: { type: 'string' },
        },
        { $defs: { A: { $ref: '#/$defs/B' }, B: { $ref: '#/$defs/A' } } }
      ),
      builtinRegistry()
    );
    const root = result.value!;
    for (const path of ['/n', '/c', '/r', '/cycle']) {
      expect(findNode(root, path)).toMatchObject({
        widget: 'json',
        source: 'fallback',
        degraded: [{ reason: 'F7' }],
        fallbackChain: [],
        children: [],
      });
    }
    expect(findNode(root, '/r').hidden).toBe(true);
    expect(findNode(root, '/ok').widget).toBe('input');
    expect(result.diagnostics.map(d => [d.code, d.severity])).toEqual([
      ['JOTL5004', 'warning'],
      ['JOTL5004', 'warning'],
      ['JOTL5005', 'warning'],
      ['JOTL5005', 'warning'],
    ]);
    expect(result.diagnostics[0]!.message).toContain('not');
    expect(result.diagnostics[1]!.message).toContain('if');
  });

  it('注册表匹配器: 分值高者胜, 低于 x-ui 候选, 高于内置规则', () => {
    const seen: ResolveContext[] = [];
    const registry = builtinRegistry([
      widget('low', 'field', { match: s => (s.type === 'number' ? 1 : 0) }),
      widget('high', 'field', {
        match: (s, ctx) => {
          seen.push(ctx);
          return s.type === 'number' ? 5 : 0;
        },
      }),
      widget('pinned'),
    ]);
    const root = planOk(
      obj({ list: { type: 'array', items: { type: 'number' } }, p: { type: 'number', 'x-ui': { widget: 'pinned' } } }),
      registry,
      { scene: 'view', mode: 'disabled' }
    );
    expect(findNode(root, '/list/*')).toMatchObject({
      widget: 'high',
      source: 'matcher',
      fallbackChain: ['low', 'number', 'json'],
    });
    expect(findNode(root, '/p')).toMatchObject({ widget: 'pinned', fallbackChain: ['high', 'low', 'number', 'json'] });
    expect(seen).toContainEqual({
      scene: 'view',
      mode: 'disabled',
      schemaPointer: '/properties/list/items',
      dataPath: '/list/*',
      parentWidget: 'list',
      depth: 3,
    });
  });

  it('实例级注册表分值相同时本级优先', () => {
    const global = builtinRegistry([widget('g', 'field', { match: s => (s.type === 'string' ? 2 : 0) })]);
    const local = global.extend();
    local.register(widget('l', 'field', { match: s => (s.type === 'string' ? 2 : 0) }));
    expect(findNode(planOk(obj({ a: { type: 'string' } }), local), '/a').widget).toBe('l');
    expect(findNode(planOk(obj({ a: { type: 'string' } }), global), '/a').widget).toBe('g');
  });

  it('注册项回调抛错时按拒绝处理, 不中断 plan', () => {
    const boom = (): never => {
      throw new Error('boom');
    };
    const registry = builtinRegistry([
      widget('bad', 'composite', { accepts: boom }),
      widget('m', 'field', { match: boom }),
      widget('c', 'composite', { claims: boom }),
    ]);
    const root = planOk(
      obj({
        a: { type: 'string', 'x-ui': { widget: 'bad' } },
        b: obj({ x: { type: 'string' } }, { 'x-ui': { widget: 'c' } }),
      }),
      registry
    );
    expect(findNode(root, '/a')).toMatchObject({ widget: 'input', degraded: [{ reason: 'F2', from: 'bad' }] });
    expect(findNode(root, '/b').children.map(c => c.dataPath)).toEqual(['/b/x']);
  });
});

describe('模板树', () => {
  it('对象子节点按 order 排序, 未列出的保持原顺序', () => {
    const root = planOk(
      obj(
        { a: { type: 'string' }, b: { type: 'string' }, c: { type: 'string' }, d: { type: 'string' } },
        { 'x-ui': { order: ['c', 'a', 'zz'] } }
      )
    );
    expect(dataRoot(root).children.map(c => c.dataPath)).toEqual(['/c', '/a', '/b', '/d']);
  });

  it('嵌套 3 层数组: 每层一个元素模板, 下标为 *', () => {
    const root = planOk(
      obj({ cube: { type: 'array', items: { type: 'array', items: { type: 'array', items: { type: 'number' } } } } })
    );
    const cube = findNode(root, '/cube');
    const paths: [string, string, string][] = [];
    walk(cube, n => paths.push([n.dataPath, n.schemaPointer, n.widget]));
    expect(paths).toEqual([
      ['/cube', '/properties/cube', 'list'],
      ['/cube/*', '/properties/cube/items', 'list'],
      ['/cube/*/*', '/properties/cube/items/items', 'list'],
      ['/cube/*/*/*', '/properties/cube/items/items/items', 'number'],
    ]);
    expect(findNode(root, '/cube/*/*/*').decorator).toBe('field');
  });

  it('fixture 009: 对象二维数组的元素来自 $defs', () => {
    const root = planOk(readFixture('009-array-nested').schema as JsonSchema);
    expect(findNode(root, '/pages/*/*')).toMatchObject({
      widget: 'page',
      schemaPointer: '/$defs/Matrix/properties/pages/items/items',
    });
    expect(findNode(root, '/pages/*/*/img')).toMatchObject({
      widget: 'image',
      schemaPointer: '/$defs/Banner/properties/img',
    });
  });

  it('union 每个分支一个子节点, 数据路径与本节点相同; 可空只含非空分支', () => {
    const root = planOk(readFixture('011-union-nullable').schema as JsonSchema);
    const id = findNode(root, '/id');
    expect(id.widget).toBe('union');
    expect(id.children.map(c => [c.schemaPointer, c.dataPath, c.widget, c.decorator])).toEqual([
      ['/$defs/Unions/properties/id/anyOf/0', '/id', 'input', false],
      ['/$defs/Unions/properties/id/anyOf/1', '/id', 'number', false],
    ]);
    const link = findNode(root, '/link');
    expect(link.widget).toBe('nullable');
    expect(link.children.map(c => [c.schemaPointer, c.widget])).toEqual([
      ['/$defs/Unions/properties/link/anyOf/0', 'page'],
    ]);
    expect(link.children[0]!.children.map(c => c.dataPath)).toEqual(['/link/href']);
    const note = findNode(root, '/note');
    expect(note.widget).toBe('nullable');
    expect(note.children.map(c => [c.schemaPointer, c.dataPath, c.widget])).toEqual([
      ['/$defs/Unions/properties/note', '/note', 'input'],
    ]);
    expect(findNode(root, '/size').widget).toBe('nullable');
  });

  it('可空字段的 widget 作用于内容节点', () => {
    const root = planOk(
      obj({ intro: { type: ['string', 'null'], 'x-ui': { widget: 'textarea', props: { rows: 3 } } } })
    );
    const intro = findNode(root, '/intro');
    expect(intro).toMatchObject({ widget: 'nullable', props: { rows: 3 }, degraded: [] });
    expect(intro.children[0]).toMatchObject({ widget: 'textarea', source: 'node', props: {} });
  });

  it('anyOf / oneOf 形态的可空字段, widget 同样作用于内容节点, 引用目标自身的 x-ui 保留', () => {
    const root = planOk(
      obj(
        {
          a: {
            anyOf: [{ $ref: '#/$defs/Note' }, { type: 'null' }],
            'x-ui': { widget: 'textarea', props: { rows: 3 } },
          },
          b: { oneOf: [{ type: 'string' }, { type: 'null' }], 'x-ui': { widget: 'textarea' } },
          c: { anyOf: [{ $ref: '#/$defs/Note' }, { type: 'null' }] },
        },
        { $defs: { Note: { type: 'string', 'x-ui': { props: { placeholder: '备注' } } } } }
      )
    );
    const a = findNode(root, '/a');
    expect(a).toMatchObject({ widget: 'nullable', props: { rows: 3 }, degraded: [] });
    expect(a.children[0]).toMatchObject({
      widget: 'textarea',
      source: 'node',
      schemaPointer: '/properties/a/anyOf/0',
      props: { placeholder: '备注' },
    });
    expect(findNode(root, '/b').children[0]).toMatchObject({
      widget: 'textarea',
      schemaPointer: '/properties/b/oneOf/0',
    });
    expect(findNode(root, '/c').children[0]).toMatchObject({ widget: 'input', props: { placeholder: '备注' } });
  });

  it('字典的值模板路径为 *', () => {
    const root = planOk(readFixture('012-map').schema as JsonSchema);
    expect(findNode(root, '/labels').children.map(c => [c.dataPath, c.schemaPointer, c.widget])).toEqual([
      ['/labels/*', '/$defs/Dict/properties/labels/additionalProperties', 'input'],
    ]);
  });

  it('对象同时有属性与 schema 形式的 additionalProperties: 属性之后加其余键的值模板 *', () => {
    const root = planOk(
      obj({
        m: obj({ a: { type: 'string' } }, { additionalProperties: { type: 'number' } }),
        n: obj({ a: { type: 'string' } }, { additionalProperties: true }),
      })
    );
    expect(findNode(root, '/m')).toMatchObject({ widget: 'page' });
    expect(findNode(root, '/m').children.map(c => [c.dataPath, c.schemaPointer, c.widget, c.decorator])).toEqual([
      ['/m/a', '/properties/m/properties/a', 'input', 'field'],
      ['/m/*', '/properties/m/additionalProperties', 'number', 'field'],
    ]);
    expect(findNode(root, '/n').children.map(c => c.dataPath)).toEqual(['/n/a']);
  });

  it('tuple 已注册时元组不降级, 子节点按位置', () => {
    const root = planOk(
      obj({ t: { type: 'array', prefixItems: [{ type: 'string', title: '名' }, { type: 'number' }], items: false } })
    );
    const t = findNode(root, '/t');
    expect(t).toMatchObject({ widget: 'tuple', source: 'builtin', degraded: [], fallbackChain: ['json'] });
    expect(t.children.map(c => [c.dataPath, c.schemaPointer, c.widget])).toEqual([
      ['/t/0', '/properties/t/prefixItems/0', 'input'],
      ['/t/1', '/properties/t/prefixItems/1', 'number'],
    ]);
  });

  it('元组的 items 为 schema 时位置之后另有剩余元素模板, 缺省时没有', () => {
    const root = planOk(
      obj({
        t: { type: 'array', prefixItems: [{ type: 'string' }], items: { type: 'number' } },
        u: { type: 'array', prefixItems: [{ type: 'string' }] },
      })
    );
    expect(findNode(root, '/t').children.map(c => [c.dataPath, c.schemaPointer, c.widget])).toEqual([
      ['/t/0', '/properties/t/prefixItems/0', 'input'],
      ['/t/*', '/properties/t/items', 'number'],
    ]);
    expect(findNode(root, '/u').children.map(c => c.dataPath)).toEqual(['/u/0']);
  });

  it('field 层组件不展开子节点', () => {
    const root = planOk(obj({ m: obj({ a: { type: 'string' } }, { 'x-ui': { widget: 'json' } }) }));
    expect(findNode(root, '/m')).toMatchObject({ widget: 'json', source: 'node', children: [] });
  });
});

describe('递归引用', () => {
  const tree: JsonSchemaObject = {
    $ref: '#/$defs/Node',
    $defs: {
      Node: obj({ name: { type: 'string' }, children: { type: 'array', items: { $ref: '#/$defs/Node' } } }),
    },
  };

  const depthOf = (root: RenderPlanNode): { trees: number; lazy: RenderPlanNode[] } => {
    let trees = 0;
    const lazy: RenderPlanNode[] = [];
    walk(root, n => {
      if (n.widget === 'tree') trees++;
      if (n.lazy) lazy.push(n);
    });
    return { trees, lazy };
  };

  it('自引用类型不死循环, 超过 maxDepth 的引用标 lazy', () => {
    const root = planOk(tree);
    const { trees, lazy } = depthOf(root);
    expect(trees).toBe(DEFAULT_MAX_DEPTH + 1);
    expect(lazy).toHaveLength(1);
    expect(lazy[0]).toMatchObject({
      widget: 'tree',
      dataPath: '/children/*/children/*/children/*',
      schemaPointer: '/$defs/Node/properties/children/items',
      children: [],
    });
    const first = findNode(root, '/children/*');
    expect(first).toMatchObject({ widget: 'tree', source: 'builtin', level: 'composite' });
    expect(first.children).toHaveLength(1);
    expect(first.children[0]).toMatchObject({
      widget: 'page',
      dataPath: '/children/*',
      schemaPointer: '/$defs/Node',
      decorator: false,
    });
  });

  it('maxDepth 0: 第一处递归即 lazy', () => {
    const { trees, lazy } = depthOf(planOk(tree, builtinRegistry(), { maxDepth: 0 }));
    expect(trees).toBe(1);
    expect(lazy.map(n => n.dataPath)).toEqual(['/children/*']);
  });

  it('expand() 展开 lazy 节点, 沿用场景, 新的递归再按 maxDepth 截断', () => {
    const registry = builtinRegistry();
    const schema: JsonSchemaObject = {
      ...tree,
      $defs: {
        Node: {
          ...(tree.$defs!.Node as JsonSchemaObject),
          'x-ui': { variants: { view: { props: { scene: 'view' } } } },
        },
      },
    };
    const root = planOk(schema, registry, { scene: 'view', maxDepth: 1 });
    const lazy = depthOf(root).lazy[0]!;
    expect(lazy.dataPath).toBe('/children/*/children/*');
    const expanded = expand(lazy, schema, registry);
    expect(expanded.diagnostics).toEqual([]);
    const node = expanded.value!;
    expect(node.lazy).toBeUndefined();
    expect(node).toMatchObject({ widget: 'tree', dataPath: '/children/*/children/*', props: { scene: 'view' } });
    expect(node.children[0]!.children.map(c => c.dataPath)).toEqual([
      '/children/*/children/*/name',
      '/children/*/children/*/children',
    ]);
    const again = depthOf(node).lazy;
    expect(again.map(n => n.dataPath)).toEqual(['/children/*/children/*/children/*/children/*']);
  });

  it('expand() 对复制后的节点按 schemaPointer 定位', () => {
    const registry = builtinRegistry();
    const lazy = depthOf(planOk(tree, registry, { maxDepth: 0 })).lazy[0]!;
    const copy = JSON.parse(JSON.stringify(lazy)) as RenderPlanNode;
    const node = expand(copy, tree, registry).value!;
    expect(node).toMatchObject({ widget: 'tree', dataPath: '/children/*', decorator: 'field' });
    expect(node.children[0]!.widget).toBe('page');
    expect(expand({ ...copy, schemaPointer: '/nope' }, tree, registry).diagnostics[0]?.code).toBe('JOTL5102');
  });

  it('expand() 的 ctx 优先于生成时记录的场景与 maxDepth, 复制后的节点也能沿用', () => {
    const registry = builtinRegistry();
    const schema: JsonSchemaObject = {
      ...tree,
      $defs: {
        Node: {
          ...(tree.$defs!.Node as JsonSchemaObject),
          'x-ui': { variants: { view: { props: { scene: 'view' } } } },
        },
      },
    };
    const lazy = depthOf(planOk(schema, registry, { maxDepth: 0 })).lazy[0]!;
    const copy = JSON.parse(JSON.stringify(lazy)) as RenderPlanNode;
    const node = expand(copy, schema, registry, { scene: 'view', maxDepth: 0 }).value!;
    expect(node).toMatchObject({ widget: 'tree', props: { scene: 'view' } });
    expect(depthOf(node).lazy.map(n => n.dataPath)).toEqual(['/children/*/children/*']);
  });

  it('相互递归与经由可空分支的递归', () => {
    const schema: JsonSchemaObject = {
      $ref: '#/$defs/A',
      $defs: {
        A: obj({ b: { $ref: '#/$defs/B' } }),
        B: obj({ a: { anyOf: [{ $ref: '#/$defs/A' }, { type: 'null' }] } }),
      },
    };
    const root = planOk(schema);
    expect(findNode(root, '/b').widget).toBe('page');
    expect(findNode(root, '/b/a')).toMatchObject({ widget: 'nullable' });
    expect(findNode(root, '/b/a').children[0]).toMatchObject({
      widget: 'tree',
      schemaPointer: '/$defs/B/properties/a/anyOf/0',
    });
    expect(depthOf(root).lazy.length).toBe(1);
  });
});

describe('接管登记(claims)', () => {
  const schema = obj({
    a: obj(
      {
        b: obj({ c: obj({ d: { type: 'string' }, e: { type: 'string' } }), f: { type: 'string' } }),
        g: { type: 'string' },
      },
      { 'x-ui': { widget: 'card-a' } }
    ),
    list: {
      type: 'array',
      items: obj({ img: { type: 'string' }, href: { type: 'string' } }),
      'x-ui': { widget: 'gallery' },
    },
    whole: obj({ x: { type: 'string' } }, { 'x-ui': { widget: 'whole' } }),
  });

  it('相对路径的子孙不进入 children; all 接管整棵子树; 嵌套 3 层', () => {
    const registry = builtinRegistry([
      widget('card-a', 'composite', { claims: () => ['b/c/d', '/g'] }),
      widget('gallery', 'composite', { claims: () => ['*/img'] }),
      widget('whole', 'composite', { claims: () => 'all' }),
    ]);
    const root = planOk(schema, registry);
    const paths: string[] = [];
    walk(dataRoot(root), n => paths.push(n.dataPath));
    expect(paths).toEqual([
      '',
      '/a',
      '/a/b',
      '/a/b/c',
      '/a/b/c/e',
      '/a/b/f',
      '/list',
      '/list/*',
      '/list/*/href',
      '/whole',
    ]);
  });

  it('嵌套复合组件各自接管, 祖先的接管对更深层同样生效', () => {
    const nested = obj({
      l1: obj(
        {
          l2: obj(
            {
              l3: obj(
                { keep: { type: 'string' }, drop1: { type: 'string' }, drop2: { type: 'string' } },
                { 'x-ui': { widget: 'c3' } }
              ),
            },
            { 'x-ui': { widget: 'c2' } }
          ),
        },
        { 'x-ui': { widget: 'c1' } }
      ),
    });
    const registry = builtinRegistry([
      widget('c1', 'composite', { claims: () => ['l2/l3/drop1'] }),
      widget('c2', 'composite', { claims: () => [''] }),
      widget('c3', 'composite', { claims: () => ['drop2'] }),
    ]);
    const l3 = findNode(planOk(nested, registry), '/l1/l2/l3');
    expect(l3.children.map(c => c.dataPath)).toEqual(['/l1/l2/l3/keep']);
  });
});

describe('P1 计划节点字段', () => {
  it('对象节点带 layout 与 columns, 默认 stack 与 2', () => {
    const root = planOk(
      obj({
        g: obj({ a: { type: 'string' } }, { 'x-ui': { layout: 'grid', columns: 3 } }),
        t: obj({}, { 'x-ui': { layout: 'tabs' } }),
        s: { type: 'string' },
      })
    );
    expect(dataRoot(root)).toMatchObject({ layout: 'stack', columns: 2 });
    expect(findNode(root, '/g')).toMatchObject({ layout: 'grid', columns: 3 });
    expect(findNode(root, '/t')).toMatchObject({ layout: 'tabs', columns: 2 });
    expect(findNode(root, '/s').layout).toBeUndefined();
    expect(findNode(root, '/s').columns).toBeUndefined();
  });

  it('对象节点带合并后的 groups, 无分组时为空数组', () => {
    const groups = [{ title: '高级', fields: ['b'] }];
    const root = planOk(
      obj({ o: obj({ a: { type: 'string' }, b: { type: 'string' } }, { 'x-ui': { groups } }), s: { type: 'string' } })
    );
    expect(findNode(root, '/o').groups).toEqual(groups);
    expect(dataRoot(root).groups).toEqual([]);
    expect(findNode(root, '/s').groups).toBeUndefined();
  });

  it('hidden 与 visibleIf 写入节点', () => {
    const visibleIf = { field: '/items/*/kind', eq: 'image' };
    const root = planOk(
      obj({
        secret: { type: 'string', 'x-ui': { hidden: true } },
        items: {
          type: 'array',
          items: obj({ kind: { type: 'string' }, img: { type: 'string', 'x-ui': { visibleIf } } }),
        },
      })
    );
    expect(findNode(root, '/secret')).toMatchObject({ hidden: true });
    expect(findNode(root, '/items/*/img')).toMatchObject({ hidden: false, visibleIf });
    expect(findNode(root, '/items/*/kind').visibleIf).toBeUndefined();
  });

  it('可区分联合: 识别区分字段', () => {
    const schema: JsonSchemaObject = {
      $ref: '#/$defs/Page',
      $defs: {
        Page: obj({
          block: { oneOf: [{ $ref: '#/$defs/Img' }, { $ref: '#/$defs/Txt' }] },
          loose: { anyOf: [{ $ref: '#/$defs/Img' }, { $ref: '#/$defs/Img2' }] },
        }),
        Img: obj({ src: { type: 'string' }, type: { type: 'string', const: 'img' } }, { required: ['src', 'type'] }),
        Txt: obj({ type: { type: 'string', const: 'txt' }, body: { type: 'string' } }, { required: ['type'] }),
        Img2: obj({ src: { type: 'string' }, type: { type: 'string', const: 'img' } }, { required: ['src', 'type'] }),
      },
    };
    const root = planOk(schema);
    expect(findNode(root, '/block')).toMatchObject({ widget: 'union', discriminator: 'type' });
    expect(findNode(root, '/block').children.map(c => c.schemaPointer)).toEqual([
      '/$defs/Page/properties/block/oneOf/0',
      '/$defs/Page/properties/block/oneOf/1',
    ]);
    expect(findNode(root, '/loose').discriminator).toBeUndefined();
    expect(findNode(planOk(readFixture('011-union-nullable').schema as JsonSchema), '/shape').discriminator).toBe(
      'kind'
    );
  });
});

describe('plan 选项', () => {
  it('schemaPointer 指向子节点时直接从该节点开始', () => {
    const schema = readFixture('014-x-ui-ref-override').schema as JsonSchema;
    const node = planOk(schema, builtinRegistry([widget('banner-mini', 'composite')]), {
      schemaPointer: '/$defs/Home/properties/mini',
      dataPath: '/mini',
      depth: 2,
      parentWidget: 'page',
    });
    expect(node).toMatchObject({ widget: 'banner-mini', dataPath: '/mini', decorator: 'field' });
    expect(node.children.map(c => c.dataPath)).toEqual(['/mini/img']);
  });

  it('输入错误返回 error 诊断, 不抛异常', () => {
    const registry = builtinRegistry();
    const codes = (r: ReturnType<typeof plan>) => [r.value, r.diagnostics.map(d => [d.code, d.severity])];
    expect(codes(plan(obj({}), registry, { schemaPointer: '/nope' }))).toEqual([undefined, [['JOTL5102', 'error']]]);
    expect(codes(plan(obj({}), registry, { dataPath: 'x' }))).toEqual([undefined, [['JOTL5103', 'error']]]);
    expect(codes(plan(obj({}), registry, { maxDepth: -1 }))).toEqual([undefined, [['JOTL5104', 'error']]]);
    expect(codes(plan(obj({}), registry, { depth: 1.5 }))).toEqual([undefined, [['JOTL5105', 'error']]]);
    expect(codes(plan('x' as never, registry))).toEqual([undefined, [['JOTL5101', 'error']]]);
  });

  it('布尔 schema', () => {
    expect(dataRoot(planOk(true))).toMatchObject({ widget: 'json', source: 'fallback', degraded: [] });
  });
});

describe('共享样例', () => {
  for (const name of listFixtures()) {
    const fixture = readFixture(name);
    if (!fixture.hasSchema) continue;
    it(`${name}: 内置注册表下只对未注册的自定义组件降级`, () => {
      const result = plan(fixture.schema as JsonSchema, builtinRegistry(), { maxDepth: 2 });
      expect(result.diagnostics.filter(d => d.code !== 'JOTL5001')).toEqual([]);
      walk(result.value!, n => {
        for (const d of n.degraded) expect(d.reason).toBe('F1');
        expect(n.fallbackChain.at(-1) ?? 'json').toBe('json');
      });
    });
  }
});
