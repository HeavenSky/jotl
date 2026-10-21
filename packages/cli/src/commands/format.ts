// format 命令: 格式化 Jotl 源码, 输出到 stdout 或写回原文件.
import { hasErrors } from '@jotl/core';
import { format } from '@jotl/core';
import { type Command, writeFileReported } from '../command.js';
import { cliDiagnostic } from '../diagnostics.js';
import { BOM, STDIN, readInputText } from '../inputs.js';
import { UsageError } from '../report.js';

export const formatCommand: Command = {
  name: 'format',
  options: { write: { type: 'boolean' } },
  positionals: { names: ['<file.jotl>'] },
  execute(ctx, args) {
    const [file = ''] = args.positionals;
    if (file === STDIN && args.flags.has('write'))
      throw new UsageError(cliDiagnostic('JOTL9014', { option: '--write' }), 'format');
    const input = readInputText(ctx, file);
    if (input === undefined) return;
    const result = format(input.text, file);
    ctx.reporter.report(result.diagnostics, { file });
    if (result.value === undefined || hasErrors(result.diagnostics)) return;
    if (!args.flags.has('write')) ctx.io.stdout(result.value);
    else if (result.value !== input.text) writeFileReported(ctx, file, (input.bom ? BOM : '') + result.value);
  },
};
