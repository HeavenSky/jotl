// 为 JSON Schema 的 pattern 生成一个匹配的样例字符串; 不支持断言与反向引用.
export type Random = () => number;

type RegexNode =
  | { kind: "seq"; items: RegexNode[] }
  | { kind: "alt"; options: RegexNode[] }
  | { kind: "chars"; ranges: [number, number][] }
  | { kind: "repeat"; node: RegexNode; min: number; max: number };

/** 不限上限的量词最多重复的额外次数. */
const OPEN_REPEAT = 3;
const PRINTABLE: [number, number] = [0x20, 0x7e];
const DIGIT: [number, number][] = [[0x30, 0x39]];
const WORD: [number, number][] = [[0x30, 0x39], [0x41, 0x5a], [0x5f, 0x5f], [0x61, 0x7a]];
const SPACE: [number, number][] = [[0x20, 0x20]];

class Unsupported extends Error {}

/** 生成并用 RegExp(pattern, "u") 复核; 无法生成时返回 undefined. */
export function sampleRegex(pattern: string, random: Random): string | undefined {
  let tester: RegExp;
  let tree: RegexNode;
  try {
    tester = new RegExp(pattern, "u");
    tree = new Parser(pattern).parse();
  } catch {
    return undefined;
  }
  for (let attempt = 0; attempt < 8; attempt++) {
    const sample = generate(tree, random);
    if (tester.test(sample)) return sample;
  }
  return undefined;
}

function generate(node: RegexNode, random: Random): string {
  switch (node.kind) {
    case "seq":
      return node.items.map((n) => generate(n, random)).join("");
    case "alt":
      return generate(node.options[Math.floor(random() * node.options.length)]!, random);
    case "chars":
      return String.fromCodePoint(pickCodePoint(node.ranges, random));
    case "repeat": {
      const count = node.min + Math.floor(random() * (node.max - node.min + 1));
      let out = "";
      for (let i = 0; i < count; i++) out += generate(node.node, random);
      return out;
    }
  }
}

function pickCodePoint(ranges: readonly [number, number][], random: Random): number {
  const total = ranges.reduce((sum, [lo, hi]) => sum + hi - lo + 1, 0);
  let offset = Math.floor(random() * total);
  for (const [lo, hi] of ranges) {
    const size = hi - lo + 1;
    if (offset < size) return lo + offset;
    offset -= size;
  }
  return ranges[0]![0];
}

function complement(ranges: readonly [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (let c = PRINTABLE[0]; c <= PRINTABLE[1]; c++) {
    if (!ranges.some(([lo, hi]) => c >= lo && c <= hi)) out.push([c, c]);
  }
  if (out.length === 0) throw new Unsupported();
  return out;
}

class Parser {
  private readonly chars: string[];
  private index = 0;

  constructor(pattern: string) {
    this.chars = [...pattern];
  }

  parse(): RegexNode {
    const node = this.alternation();
    if (this.index < this.chars.length) throw new Unsupported();
    return node;
  }

  private peek(offset = 0): string | undefined {
    return this.chars[this.index + offset];
  }

  private next(): string {
    const c = this.chars[this.index++];
    if (c === undefined) throw new Unsupported();
    return c;
  }

  private alternation(): RegexNode {
    const options = [this.sequence()];
    while (this.peek() === "|") {
      this.index++;
      options.push(this.sequence());
    }
    return options.length === 1 ? options[0]! : { kind: "alt", options };
  }

  private sequence(): RegexNode {
    const items: RegexNode[] = [];
    while (this.peek() !== undefined && this.peek() !== "|" && this.peek() !== ")") {
      const atom = this.atom();
      if (atom !== undefined) items.push(this.quantified(atom));
    }
    return { kind: "seq", items };
  }

  private atom(): RegexNode | undefined {
    const c = this.next();
    switch (c) {
      case "^":
      case "$":
        return undefined;
      case ".":
        return { kind: "chars", ranges: [PRINTABLE] };
      case "(": {
        if (this.peek() === "?") {
          if (this.peek(1) === ":") this.index += 2;
          else if (this.peek(1) === "<" && this.peek(2) !== "=" && this.peek(2) !== "!") {
            while (this.next() !== ">");
          } else throw new Unsupported();
        }
        const inner = this.alternation();
        if (this.next() !== ")") throw new Unsupported();
        return inner;
      }
      case "[":
        return this.charClass();
      case "\\":
        return { kind: "chars", ranges: this.escape(false) };
      default:
        return { kind: "chars", ranges: [[c.codePointAt(0)!, c.codePointAt(0)!]] };
    }
  }

  private quantified(atom: RegexNode): RegexNode {
    const c = this.peek();
    let min: number;
    let max: number;
    if (c === "*") [min, max] = [0, OPEN_REPEAT];
    else if (c === "+") [min, max] = [1, 1 + OPEN_REPEAT];
    else if (c === "?") [min, max] = [0, 1];
    else if (c === "{") {
      const rest = this.chars.slice(this.index).join("");
      const match = /^\{(\d+)(,(\d*))?\}/.exec(rest);
      if (!match) return atom;
      min = Number(match[1]);
      max = match[2] === undefined ? min : match[3] === "" ? min + OPEN_REPEAT : Number(match[3]);
      this.index += [...match[0]].length - 1;
    } else return atom;
    this.index++;
    if (this.peek() === "?") this.index++;
    return { kind: "repeat", node: atom, min, max };
  }

  private charClass(): RegexNode {
    const negated = this.peek() === "^";
    if (negated) this.index++;
    const ranges: [number, number][] = [];
    let first = true;
    while (this.peek() !== "]" || first) {
      first = false;
      const c = this.next();
      let lo: [number, number][];
      if (c === "\\") lo = this.escape(true);
      else lo = [[c.codePointAt(0)!, c.codePointAt(0)!]];
      if (this.peek() === "-" && this.peek(1) !== "]" && lo.length === 1 && lo[0]![0] === lo[0]![1]) {
        this.index++;
        const d = this.next();
        const hi = d === "\\" ? this.escape(true) : [[d.codePointAt(0)!, d.codePointAt(0)!] as [number, number]];
        if (hi.length !== 1 || hi[0]![0] !== hi[0]![1]) throw new Unsupported();
        ranges.push([lo[0]![0], hi[0]![0]]);
      } else ranges.push(...lo);
    }
    this.index++;
    return { kind: "chars", ranges: negated ? complement(ranges) : ranges };
  }

  private escape(inClass: boolean): [number, number][] {
    const c = this.next();
    const single = (code: number): [number, number][] => [[code, code]];
    switch (c) {
      case "d":
        return DIGIT;
      case "D":
        return complement(DIGIT);
      case "w":
        return WORD;
      case "W":
        return complement(WORD);
      case "s":
        return SPACE;
      case "S":
        return complement(SPACE);
      case "n":
        return single(0x0a);
      case "t":
        return single(0x09);
      case "r":
        return single(0x0d);
      case "f":
        return single(0x0c);
      case "v":
        return single(0x0b);
      case "0":
        return single(0);
      case "b":
        if (inClass) return single(0x08);
        throw new Unsupported();
      case "x": {
        const hex = this.next() + this.next();
        return single(parseInt(hex, 16));
      }
      case "u": {
        if (this.peek() === "{") {
          this.index++;
          let hex = "";
          while (this.peek() !== "}") hex += this.next();
          this.index++;
          return single(parseInt(hex, 16));
        }
        const hex = this.next() + this.next() + this.next() + this.next();
        return single(parseInt(hex, 16));
      }
      default:
        if (/[1-9B]/.test(c) || c === "k" || c === "p" || c === "P") throw new Unsupported();
        return single(c.codePointAt(0)!);
    }
  }
}
