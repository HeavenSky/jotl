// --typia-tags 只对 TS 输出有意义, 与其他输出格式同用时报用法错误.
import { cliDiagnostic } from '../diagnostics.js';
import type { CommandName } from '../messages.js';
import { UsageError } from '../report.js';

export function assertTypiaTarget(command: CommandName, typiaTags: boolean, to: string): void {
  if (typiaTags && to !== 'ts') {
    throw new UsageError(cliDiagnostic('JOTL9011', { option: '--typia-tags', requires: '--to ts' }), command);
  }
}
