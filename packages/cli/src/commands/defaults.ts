// defaults 命令: 按 schema 生成默认数据并以 JSON 输出.
import { getDefaults } from '@jotl/data';
import { hasErrors } from '@jotl/core';
import type { SchemaVersion } from '@jotl/convert';
import { type Command, OUT_OPTION, assertOutputDistinct, toJsonText, writeOutput } from '../command.js';
import { CONFIG_OPTIONS, configResolver } from '../config.js';
import { cliDiagnostic } from '../diagnostics.js';
import { SCHEMA_VERSION_OPTION, loadSchema, resolveSchemaFormat } from '../inputs.js';

type Strategy = 'explicit' | 'required' | 'all';

export const defaultsCommand: Command = {
  name: 'defaults',
  options: {
    strategy: { type: 'string', choices: ['explicit', 'required', 'all'] },
    'schema-version': SCHEMA_VERSION_OPTION,
    out: OUT_OPTION,
    ...CONFIG_OPTIONS,
  },
  positionals: { names: ['<schema>'] },
  execute(ctx, args) {
    const [file = ''] = args.positionals;
    const out = args.strings.get('out');
    const format = resolveSchemaFormat('defaults', file);
    assertOutputDistinct('defaults', ctx.io, out, [file]);

    const version = args.strings.get('schema-version') as SchemaVersion | undefined;
    const config = configResolver('defaults', ctx, args);
    const loaded = loadSchema(ctx, file, format, {
      showChanges: false,
      config,
      ...(version === undefined ? {} : { version }),
    });
    if (loaded === undefined) return;
    const strategy = (args.strings.get('strategy') ?? 'explicit') as Strategy;
    const result = getDefaults(loaded.schema, { strategy });
    ctx.reporter.report(result.diagnostics, loaded.origin);
    if (hasErrors(result.diagnostics)) return;
    if (result.value === undefined) {
      ctx.reporter.report([cliDiagnostic('JOTL9054')], { file });
      return;
    }
    writeOutput(ctx, toJsonText(result.value), out);
  },
};
