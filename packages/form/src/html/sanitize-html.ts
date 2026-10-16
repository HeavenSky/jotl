// 富文本 HTML 的白名单清洗: 只保留基本排版标签与安全链接, 去掉脚本, 样式与全部事件属性.

const ALLOWED_TAGS = new Set(["P", "BR", "DIV", "SPAN", "B", "STRONG", "I", "EM", "U", "S", "A", "UL", "OL", "LI", "BLOCKQUOTE", "CODE", "PRE", "H1", "H2", "H3", "H4"]);

/** 连同内容一起丢弃; 其余不在白名单中的标签只去掉标签本身, 保留其中的文字. */
const DROPPED_TAGS = new Set(["SCRIPT", "STYLE", "IFRAME", "FRAME", "OBJECT", "EMBED", "TEMPLATE", "NOSCRIPT", "LINK", "META", "BASE", "SVG", "MATH", "FORM", "INPUT", "TEXTAREA", "SELECT", "BUTTON"]);

const SAFE_SCHEMES = new Set(["http", "https", "mailto", "tel"]);

/** 链接地址是否安全: 相对地址, 或 http https mailto tel. */
export function isSafeUrl(url: string): boolean {
  // 浏览器解析协议前会去掉空白与控制字符, 判定时同样去掉, 防止 "java\tscript:" 绕过.
  const compact = url.replace(/[\x00-\x20\x7f]/g, "");
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(compact)?.[1];
  return scheme === undefined || SAFE_SCHEMES.has(scheme.toLowerCase());
}

function clean(parent: ParentNode): void {
  for (const node of [...parent.childNodes]) {
    if (node.nodeType === Node.TEXT_NODE) continue;
    if (node.nodeType !== Node.ELEMENT_NODE) {
      node.parentNode?.removeChild(node);
      continue;
    }
    const element = node as Element;
    const tag = element.tagName.toUpperCase();
    if (DROPPED_TAGS.has(tag)) {
      element.remove();
      continue;
    }
    clean(element);
    if (!ALLOWED_TAGS.has(tag)) {
      element.replaceWith(...element.childNodes);
      continue;
    }
    for (const attr of [...element.attributes]) {
      const keep = tag === "A" && ((attr.name === "href" && isSafeUrl(attr.value)) || attr.name === "title");
      if (!keep) element.removeAttribute(attr.name);
    }
  }
}

/** 在惰性的 template 中解析, 解析期间不执行脚本也不加载资源. */
export function sanitizeHtml(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  clean(template.content);
  return template.innerHTML;
}
