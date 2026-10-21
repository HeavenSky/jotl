// 输出语言: --lang 与环境变量的优先级, 英文下的帮助, 诊断与结果行, 以及诊断代码表的英文模板.
import { getLocale, setLocale } from '@jotl/core';
import { afterEach, describe, expect, it } from 'vitest';
import { CLI_DIAGNOSTICS, COMMAND_NAMES, run } from '../src/index.js';
import { SHARED_FIXTURES, cli, createMemoryIo, diagnosticLines } from './helpers.js';

const HAN = /\p{Script=Han}/u;
const EN_USAGE = 'Usage: jotl <command> [options]';
const ZH_USAGE = '用法: jotl <命令> [选项]';
const F002 = `${SHARED_FIXTURES}/002-constraints`;

describe('英文帮助', () => {
  it.each([[['--lang', 'en', '--help']], [['--help', '--lang=en']], [['help', '--lang', 'en']]])(
    '%j 输出英文全局帮助',
    argv => {
      const r = cli(argv);
      expect(r.code).toBe(0);
      expect(r.stdout).toContain(EN_USAGE);
      expect(r.stdout).toContain('--lang <zh|en>');
      expect(r.stdout).not.toMatch(HAN);
      for (const name of COMMAND_NAMES) expect(r.stdout).toContain(`  ${name} `);
    }
  );

  it.each(COMMAND_NAMES.map(name => [name]))('%s --help 在 --lang en 下为英文', name => {
    const r = cli([name, '--help', '--lang', 'en']);
    expect(r.code).toBe(0);
    expect(r.stdout.startsWith(`Usage: jotl ${name} `)).toBe(true);
    expect(r.stdout).not.toMatch(HAN);
    expect(r.stdout).not.toContain('{');
    expect(cli(['help', name], { env: { JOTL_LANG: 'en' } }).stdout).toBe(r.stdout);
  });

  it('JOTL_LANG=en 时帮助为英文', () => {
    expect(cli(['--help'], { env: { JOTL_LANG: 'en' } }).stdout).toContain(EN_USAGE);
  });
});

describe('英文诊断与结果行', () => {
  it.each([
    ['--lang en', ['build', '--lang', 'en'], {}],
    ['JOTL_LANG=en', ['build'], { JOTL_LANG: 'en' }],
  ])('%s: 用法错误的诊断与提示为英文', (_label, argv, env) => {
    const r = cli(argv, { env });
    expect(r.code).toBe(2);
    expect(r.stderr).toBe('jotl JOTL9001 error: unknown command `build`\nRun `jotl --help` for usage\n');
  });

  it('命令内的用法错误提示命令帮助', () => {
    const r = cli(['compile', '--lang', 'en']);
    expect(r.code).toBe(2);
    expect(r.stderr).toBe('jotl JOTL9006 error: missing argument <file.jotl>\nRun `jotl compile --help` for usage\n');
  });

  it('文件读取失败的原因为英文', () => {
    const r = cli(['check', 'mem/missing.jotl'], { env: { JOTL_LANG: 'en' } });
    expect(r.code).toBe(1);
    expect(diagnosticLines(r.stderr)).toEqual([
      {
        location: 'mem/missing.jotl',
        code: 'JOTL9050',
        severity: 'error',
        message: 'cannot read file `mem/missing.jotl`: file not found',
      },
    ]);
  });

  it('validate 的结果行为英文', () => {
    const data = `${F002}/valid/required.json`;
    const r = cli(['validate', `${F002}/schema.json`, data, '--lang', 'en']);
    expect(r.code).toBe(0);
    expect(r.stdout).toBe(`${data}: passed\n`);
  });

  it('其他包产生的诊断也使用英文级别标签', () => {
    const r = cli(['check', `${SHARED_FIXTURES}/016-errors/source.jotl`, '--lang', 'en']);
    expect(r.code).toBe(1);
    expect(diagnosticLines(r.stderr).length).toBeGreaterThan(0);
    for (const d of diagnosticLines(r.stderr)) expect(d.severity).toBe('error');
  });
});

describe('语言来源的优先级', () => {
  const isEnglish = (argv: string[], env: Record<string, string>) =>
    cli([...argv, '--help'], { env }).stdout.includes(EN_USAGE);

  it.each<[string, string[], Record<string, string>, boolean]>([
    ['环境变量都为空时为英文', [], {}, true],
    ['--lang 优先于 JOTL_LANG', ['--lang', 'zh-CN'], { JOTL_LANG: 'en' }, false],
    ['JOTL_LANG 优先于 LANG', [], { JOTL_LANG: 'zh-CN', LANG: 'en_US.UTF-8' }, false],
    [
      'LC_ALL 优先于 LC_MESSAGES 与 LANG',
      [],
      { LC_ALL: 'en_US.UTF-8', LC_MESSAGES: 'zh_CN.UTF-8', LANG: 'zh_CN.UTF-8' },
      true,
    ],
    ['LC_MESSAGES 优先于 LANG', [], { LC_MESSAGES: 'zh_CN.UTF-8', LANG: 'en_US.UTF-8' }, false],
    ['空值视为未设置', [], { JOTL_LANG: '', LC_ALL: ' ', LANG: 'en_US.UTF-8' }, true],
    ['LANG=zh_CN.UTF-8 为中文', [], { LANG: 'zh_CN.UTF-8' }, false],
    ['LANG=C 为英文', [], { LANG: 'C' }, true],
    ['LANG=POSIX 为英文', [], { LANG: 'POSIX' }, true],
    ['其他语言为英文', [], { LANG: 'fr_FR.UTF-8' }, true],
  ])('%s', (_label, argv, env, english) => {
    expect(isEnglish(argv, env)).toBe(english);
  });

  it('中文下帮助为中文', () => {
    expect(cli(['--help']).stdout).toContain(ZH_USAGE);
  });

  it.each<[string, string, boolean]>([
    ['zh', '--lang', false],
    ['zh-cn', '--lang', false],
    ['zh_CN', '--lang=', false],
    ['ZH-Hans-CN', '--lang', false],
    ['en-US', '--lang', true],
    ['en_GB.UTF-8', '--lang=', true],
    ['EN', '--lang', true],
  ])('--lang 接受地区写法 %s', (value, form, english) => {
    const argv = form === '--lang=' ? [`--lang=${value}`, '--help'] : ['--lang', value, '--help'];
    const r = cli(argv, { env: { JOTL_LANG: english ? 'zh-CN' : 'en' } });
    expect(r.code).toBe(0);
    expect(r.stdout).toContain(english ? EN_USAGE : ZH_USAGE);
  });

  it.each([
    [['--lang', 'fr', '--help'], 'JOTL9005'],
    [['--lang', 'zho', '--help'], 'JOTL9005'],
    [['--lang=fr-FR', '--help'], 'JOTL9005'],
    [['--help', '--lang'], 'JOTL9003'],
    [['--lang', '--help'], 'JOTL9003'],
  ])('%j 是用法错误 %s', (argv, code) => {
    const r = cli(argv);
    expect(r.code).toBe(2);
    expect(diagnosticLines(r.stderr).map(d => d.code)).toEqual([code]);
  });
});

describe('run 未传 env', () => {
  afterEach(() => setLocale('zh-CN'));

  it('沿用当前全局语言', () => {
    setLocale('en');
    const sink = { out: [] as string[], err: [] as string[] };
    expect(run(['--help'], createMemoryIo({}, sink))).toBe(0);
    expect(sink.out.join('')).toContain(EN_USAGE);
    expect(getLocale()).toBe('en');
  });

  it('调用结束后恢复调用前的全局语言, 含 --lang, env 与用法错误', () => {
    setLocale('en');
    const sink = { out: [] as string[], err: [] as string[] };
    expect(run(['--help', '--lang', 'zh'], createMemoryIo({}, sink))).toBe(0);
    expect(sink.out.join('')).toContain(ZH_USAGE);
    expect(getLocale()).toBe('en');
    expect(run(['--help'], createMemoryIo({}, sink), { env: { JOTL_LANG: 'zh-CN' } })).toBe(0);
    expect(getLocale()).toBe('en');
    expect(run(['nope', '--lang', 'zh-CN'], createMemoryIo({}, sink))).toBe(2);
    expect(getLocale()).toBe('en');
  });
});

describe('诊断代码表', () => {
  const placeholders = (template: string) => [...template.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();

  it.each(Object.entries(CLI_DIAGNOSTICS))('%s 有英文模板且占位符与中文一致', (_code, def) => {
    const en: string | undefined = 'en' in def ? def.en : undefined;
    expect(en).toBeTypeOf('string');
    expect(en).not.toMatch(HAN);
    expect(placeholders(en ?? '')).toEqual(placeholders(def.message));
  });
});
