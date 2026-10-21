// 排版输出器: 缩进, 换行, 空行, 以及把源码注释放回原来两个记号之间; 打印与格式化共用.
import type { Comment } from "../ast.js";

const INDENT = "  ";

type Break = "none" | "line" | "blank";

interface PlacedComment {
	text: string;
	start: number;
	end: number;
	/** `//` 与 `///` 一直延续到行尾, 其后必须换行. */
	toLineEnd: boolean;
	ownLine: boolean;
	blankBefore: boolean;
	newlineAfter: boolean;
}

export interface WriterSource {
	text: string;
	comments: readonly Comment[];
}

function isLineBreak(ch: string | undefined): boolean {
	return ch === "\n" || ch === "\r";
}

export function newlinesBefore(
	text: string,
	offset: number
): { count: number; atFileStart: boolean } {
	let count = 0;
	let i = offset - 1;
	while (i >= 0 && /\s/u.test(text[i]!)) {
		if (text[i] === "\n" || (text[i] === "\r" && text[i + 1] !== "\n")) count++;
		i--;
	}
	return { count, atFileStart: i < 0 };
}

function placeComment(text: string, comment: Comment): PlacedComment {
	const start = comment.range.start.offset;
	const end = comment.range.end.offset;
	const before = newlinesBefore(text, start);
	let j = end;
	while (j < text.length && !isLineBreak(text[j]) && /\s/u.test(text[j]!)) j++;
	const block = comment.kind === "BlockComment";
	return {
		text: block ? comment.text.replace(/\r\n?/g, "\n") : comment.text.trimEnd(),
		start,
		end,
		toLineEnd: !block,
		ownLine: before.count > 0 || before.atFileStart,
		blankBefore: before.count >= 2,
		newlineAfter: j >= text.length || isLineBreak(text[j]),
	};
}

export class Writer {
	private readonly lines: string[] = [];
	private current: string | undefined;
	private level = 0;
	private pendingBreak: Break = "none";
	/** 由注释强制的换行续在表达式中间, 比所在行多缩进一级. */
	private continuation = false;
	private pendingSpace = false;
	private blockStart = false;
	private readonly comments: PlacedComment[];
	private nextComment = 0;

	constructor(source?: WriterSource) {
		this.comments = source ? source.comments.map(c => placeComment(source.text, c)) : [];
	}

	indent(): void {
		this.level++;
	}

	dedent(): void {
		this.level--;
	}

	space(): void {
		this.pendingSpace = true;
	}

	/** 请求在下一段内容前换行; blank 为 true 时留一个空行(块首与文件开头除外). */
	breakLine(blank = false): void {
		if (blank) this.pendingBreak = "blank";
		else if (this.pendingBreak === "none") this.pendingBreak = "line";
		this.continuation = false;
	}

	/** 在刚写出的 `{` 之后调用: 换行, 且块内第一行之前不留空行. */
	openBlock(): void {
		this.blockStart = true;
		this.breakLine();
	}

	/** 是否还有未输出的注释完全位于 (from, to) 之间. */
	hasCommentsWithin(from: number, to: number): boolean {
		return this.comments.slice(this.nextComment).some(c => c.start > from && c.end <= to);
	}

	/**
	 * 写出一个记号. start 为它在源码中的起点, 先输出结束于 start 之前的注释;
	 * blank 表示源码中该记号前有空行, 只在此处本来就要换行时生效.
	 */
	token(text: string, start?: number, blank = false): void {
		if (start !== undefined) this.flush(start);
		if (blank && this.pendingBreak === "line") this.pendingBreak = "blank";
		this.emit(text);
	}

	/** 输出结束于 offset 之前的全部注释. */
	flush(offset: number): void {
		while (
			this.nextComment < this.comments.length &&
			this.comments[this.nextComment]!.end <= offset
		) {
			const comment = this.comments[this.nextComment++]!;
			if (!comment.ownLine && this.current !== undefined) {
				this.current += ` ${comment.text}`;
				if (comment.toLineEnd || comment.newlineAfter) this.requireBreak();
				else this.pendingSpace = true;
				continue;
			}
			this.requireBreak();
			if (comment.blankBefore && this.pendingBreak === "line") this.pendingBreak = "blank";
			this.emit(comment.text);
			// 不能改用 requireBreak: 它会把下一记号当作续行多缩进一级.
			this.pendingBreak = "line";
		}
	}

	/** 输出剩余注释并返回全文; 非空时以换行结尾. */
	finish(): string {
		this.breakLine();
		this.flush(Number.POSITIVE_INFINITY);
		if (this.current !== undefined) this.lines.push(this.current);
		this.current = undefined;
		return this.lines.length > 0 ? `${this.lines.join("\n")}\n` : "";
	}

	private requireBreak(): void {
		if (this.pendingBreak !== "none") return;
		this.pendingBreak = "line";
		if (this.current !== undefined) this.continuation = true;
	}

	private emit(text: string): void {
		if (this.pendingBreak !== "none") {
			if (this.current !== undefined) this.lines.push(this.current);
			this.current = undefined;
			const blank =
				this.pendingBreak === "blank" && !this.blockStart && this.lines.length > 0;
			if (blank && this.lines[this.lines.length - 1] !== "") this.lines.push("");
			this.pendingBreak = "none";
		}
		if (this.current === undefined)
			this.current = INDENT.repeat(this.level + (this.continuation ? 1 : 0)) + text;
		else this.current += (this.pendingSpace ? " " : "") + text;
		this.pendingSpace = false;
		this.blockStart = false;
	}
}
