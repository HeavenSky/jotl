// 源码偏移到行列位置的换算; 行列从 1 起, 列按 UTF-16 代码单元计.
import type { SourcePosition, SourceRange } from "../schema/index.js";

export class LineMap {
  private readonly lineStarts: number[] = [0];

  constructor(
    private readonly text: string,
    readonly file: string,
  ) {
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      if (c === 0x0d) {
        if (text.charCodeAt(i + 1) === 0x0a) i++;
        this.lineStarts.push(i + 1);
      } else if (c === 0x0a) {
        this.lineStarts.push(i + 1);
      }
    }
  }

  position(offset: number): SourcePosition {
    const clamped = Math.max(0, Math.min(offset, this.text.length));
    let lo = 0;
    let hi = this.lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.lineStarts[mid]! <= clamped) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, column: clamped - this.lineStarts[lo]! + 1, offset: clamped };
  }

  range(start: number, end: number): SourceRange {
    return { file: this.file, start: this.position(start), end: this.position(end) };
  }
}
