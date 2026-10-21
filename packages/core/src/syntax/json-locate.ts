// 定位 JSON 文本中第一个语法错误的位置, 供诊断给出行列; JSON.parse 的错误消息不保证带位置.
// 另为合法 JSON 建立指针到文本偏移的映射, 供数据诊断换算行列.
import { type JsonPointer, appendPointer } from "../schema/index.js";

export interface JsonSyntaxError {
	offset: number;
	/** 出错处的字符; 文本提前结束时为 undefined. */
	found: string | undefined;
}

class Stop {
	constructor(readonly offset: number) {}
}

const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const LITERALS = ["true", "false", "null"] as const;
const SIMPLE_ESCAPES = new Set(['"', "\\", "/", "b", "f", "n", "r", "t"]);
const HEX = /^[0-9a-fA-F]{4}$/;

class Scanner {
	pos = 0;
	constructor(
		private readonly text: string,
		private readonly offsets?: Map<JsonPointer, number>
	) {}

	private mark(pointer: JsonPointer): void {
		if (this.offsets !== undefined && !this.offsets.has(pointer))
			this.offsets.set(pointer, this.pos);
	}

	ws(): void {
		while (this.pos < this.text.length && " \t\n\r".includes(this.text.charAt(this.pos)))
			this.pos += 1;
	}

	expect(char: string): void {
		if (this.text.charAt(this.pos) !== char) throw new Stop(this.pos);
		this.pos += 1;
	}

	value(pointer: JsonPointer = ""): void {
		this.ws();
		this.mark(pointer);
		const c = this.text.charAt(this.pos);
		if (c === "{") this.object(pointer);
		else if (c === "[") this.array(pointer);
		else if (c === '"') this.string();
		else if (c === "-" || (c >= "0" && c <= "9")) this.number();
		else this.literal();
	}

	object(pointer: JsonPointer): void {
		this.pos += 1;
		this.ws();
		if (this.text.charAt(this.pos) === "}") {
			this.pos += 1;
			return;
		}
		for (;;) {
			this.ws();
			const start = this.pos;
			this.string();
			const member =
				this.offsets === undefined
					? pointer
					: appendPointer(
							pointer,
							JSON.parse(this.text.slice(start, this.pos)) as string
						);
			if (this.offsets !== undefined && !this.offsets.has(member))
				this.offsets.set(member, start);
			this.ws();
			this.expect(":");
			this.value(member);
			this.ws();
			if (this.text.charAt(this.pos) === "}") {
				this.pos += 1;
				return;
			}
			this.expect(",");
		}
	}

	array(pointer: JsonPointer): void {
		this.pos += 1;
		this.ws();
		if (this.text.charAt(this.pos) === "]") {
			this.pos += 1;
			return;
		}
		for (let i = 0; ; i++) {
			this.value(this.offsets === undefined ? pointer : appendPointer(pointer, String(i)));
			this.ws();
			if (this.text.charAt(this.pos) === "]") {
				this.pos += 1;
				return;
			}
			this.expect(",");
		}
	}

	string(): void {
		this.expect('"');
		for (;;) {
			if (this.pos >= this.text.length) throw new Stop(this.pos);
			const c = this.text.charAt(this.pos);
			if (c === '"') {
				this.pos += 1;
				return;
			}
			if (c < " ") throw new Stop(this.pos);
			if (c === "\\") {
				const e = this.text.charAt(this.pos + 1);
				if (SIMPLE_ESCAPES.has(e)) this.pos += 2;
				else if (e === "u" && HEX.test(this.text.slice(this.pos + 2, this.pos + 6)))
					this.pos += 6;
				else throw new Stop(this.pos + 1);
				continue;
			}
			this.pos += 1;
		}
	}

	number(): void {
		NUMBER.lastIndex = this.pos;
		const match = NUMBER.exec(this.text);
		if (!match) throw new Stop(this.pos);
		this.pos += match[0].length;
	}

	literal(): void {
		const word = LITERALS.find(w => this.text.startsWith(w, this.pos));
		if (word === undefined) throw new Stop(this.pos);
		this.pos += word.length;
	}
}

/** 文本是合法 JSON 时返回 undefined. */
export function locateJsonError(text: string): JsonSyntaxError | undefined {
	const scanner = new Scanner(text);
	try {
		scanner.value();
		scanner.ws();
		if (scanner.pos < text.length) throw new Stop(scanner.pos);
		return undefined;
	} catch (error) {
		if (!(error instanceof Stop)) throw error;
		return {
			offset: error.offset,
			found: error.offset < text.length ? text.charAt(error.offset) : undefined,
		};
	}
}

/** 合法 JSON 中每个值的指针 → 文本偏移; 对象成员取键名的起点. 文本不合法时返回 undefined. */
export function jsonPointerOffsets(text: string): Map<JsonPointer, number> | undefined {
	const offsets = new Map<JsonPointer, number>();
	const scanner = new Scanner(text, offsets);
	try {
		scanner.value();
		return offsets;
	} catch (error) {
		if (!(error instanceof Stop)) throw error;
		return undefined;
	}
}
