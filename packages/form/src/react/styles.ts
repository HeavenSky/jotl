// 钻取页头与入口行的外观: 各 jotl- 语义类名对应的 jt: 前缀 Tailwind 工具类; 语义类名由组件自己输出.
import { styles as htmlStyles } from "../html/index.js";

const { inheritFont } = htmlStyles;

export const styles = {
	breadcrumb:
		"jt:m-0 jt:overflow-x-auto jt:[scrollbar-width:thin] jt:[-webkit-overflow-scrolling:touch] jt:text-[16px] jt:font-medium jt:leading-[24px]",
	breadcrumbList:
		"jt:flex jt:items-center jt:m-0 jt:p-0 jt:list-none jt:whitespace-nowrap jt:text-muted",
	breadcrumbItem:
		"jt:inline-flex jt:items-center jt:flex-none jt:max-w-48 jt:*:overflow-hidden jt:*:text-ellipsis",
	breadcrumbCurrent: "jt:text-text",
	breadcrumbLink: `jt:p-0 jt:border-0 jt:bg-transparent jt:text-inherit ${inheritFont} jt:cursor-pointer jt:hover:text-focus`,
	/** 入口行; 数组行内的入口不再画边框, 由行本身分隔. */
	entry:
		`jt:flex jt:items-center jt:gap-2 jt:w-full jt:min-h-[48px] jt:px-[16px] jt:py-0 jt:border jt:border-divider jt:rounded-base jt:bg-surface jt:text-inherit ${inheritFont} jt:text-left jt:cursor-pointer ` +
		"jt:hover:border-focus jt:aria-invalid:border-error " +
		"jt:in-[.jotl-array-item-content]:min-h-0 jt:in-[.jotl-array-item-content]:p-0 jt:in-[.jotl-array-item-content]:border-0 jt:in-[.jotl-array-item-content]:bg-transparent",
	entrySummary:
		"jt:flex-1 jt:min-w-0 jt:overflow-hidden jt:text-ellipsis jt:whitespace-nowrap jt:font-medium",
	entryErrors:
		"jt:flex-none jt:px-2 jt:rounded-[999px] jt:bg-error jt:text-on-accent jt:text-[0.75rem] jt:leading-[1.5]",
	entryArrow: "jt:flex-none jt:text-muted jt:text-[1.25rem] jt:leading-none",
	/** 折叠面板(nested 为 false 且 collapsible 时). */
	panel: "jt:min-w-0 jt:border jt:border-divider jt:rounded-base jt:bg-surface",
	// 高度对齐入口行; marker 与展开箭头由 tailwind.css 的语义类规则处理.
	panelHeader:
		"jt:flex jt:items-center jt:gap-2 jt:min-h-[48px] jt:px-[16px] jt:py-[8px] jt:rounded-base jt:bg-[var(--jotl-panel-header,#fafafa)] jt:cursor-pointer jt:select-none jt:hover:bg-[var(--jotl-panel-header-hover,#f0f0f0)]",
	panelTitle: "jt:flex-none jt:font-medium",
	panelSummary:
		"jt:flex-1 jt:min-w-0 jt:overflow-hidden jt:text-ellipsis jt:whitespace-nowrap jt:text-muted",
	panelBody: "jt:p-gap jt:border-t jt:border-divider",
	breadcrumbErrors:
		"jt:flex-none jt:ml-1 jt:px-2 jt:rounded-[999px] jt:bg-error jt:text-on-accent jt:text-[0.75rem] jt:leading-[1.5]",
} as const;
