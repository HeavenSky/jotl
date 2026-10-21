// URI 引用解析(RFC 3986 第 5 节)与 `$ref` 片段的拆分, 解码和编码; 不依赖宿主的 URL 实现.

interface UriParts {
  scheme: string | undefined;
  authority: string | undefined;
  path: string;
  query: string | undefined;
  fragment: string | undefined;
}

const URI_PATTERN = /^(?:([^:/?#]+):)?(?:\/\/([^/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/s;

function parseUri(uri: string): UriParts {
  const m = URI_PATTERN.exec(uri)!;
  return { scheme: m[1], authority: m[2], path: m[3] ?? '', query: m[4], fragment: m[5] };
}

function composeUri(parts: UriParts): string {
  let out = '';
  if (parts.scheme !== undefined) out += parts.scheme + ':';
  if (parts.authority !== undefined) out += '//' + parts.authority;
  out += parts.path;
  if (parts.query !== undefined) out += '?' + parts.query;
  if (parts.fragment !== undefined) out += '#' + parts.fragment;
  return out;
}

function removeDotSegments(path: string): string {
  const input = path.split('/');
  const output: string[] = [];
  for (let i = 0; i < input.length; i++) {
    const segment = input[i]!;
    const last = i === input.length - 1;
    if (segment === '.') {
      if (last) output.push('');
    } else if (segment === '..') {
      if (output.length > 1 || (output.length === 1 && output[0] !== '')) output.pop();
      if (last) output.push('');
    } else {
      output.push(segment);
    }
  }
  return output.join('/');
}

function mergePaths(base: UriParts, reference: string): string {
  if (base.authority !== undefined && base.path === '') return '/' + reference;
  const slash = base.path.lastIndexOf('/');
  return slash === -1 ? reference : base.path.slice(0, slash + 1) + reference;
}

/** 按 RFC 3986 5.2.2 把 reference 解析为相对 base 的目标 URI. */
export function resolveUri(base: string, reference: string): string {
  const r = parseUri(reference);
  const b = parseUri(base);
  const t: UriParts = { scheme: undefined, authority: undefined, path: '', query: undefined, fragment: r.fragment };
  if (r.scheme !== undefined) {
    t.scheme = r.scheme;
    t.authority = r.authority;
    t.path = removeDotSegments(r.path);
    t.query = r.query;
    return composeUri(t);
  }
  t.scheme = b.scheme;
  if (r.authority !== undefined) {
    t.authority = r.authority;
    t.path = removeDotSegments(r.path);
    t.query = r.query;
    return composeUri(t);
  }
  t.authority = b.authority;
  if (r.path === '') {
    t.path = b.path;
    t.query = r.query ?? b.query;
  } else {
    t.path = removeDotSegments(r.path.startsWith('/') ? r.path : mergePaths(b, r.path));
    t.query = r.query;
  }
  return composeUri(t);
}

/** 拆出片段: 没有 `#` 时 fragment 为 undefined. */
export function splitFragment(uri: string): { base: string; fragment: string | undefined } {
  const hash = uri.indexOf('#');
  if (hash === -1) return { base: uri, fragment: undefined };
  return { base: uri.slice(0, hash), fragment: uri.slice(hash + 1) };
}

/** 片段按百分号编码解码; 编码不合法时返回 undefined. */
export function decodeFragment(fragment: string): string | undefined {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return undefined;
  }
}

const FRAGMENT_UNSAFE = /[^A-Za-z0-9\-._~!$&'()*+,;=:@/?]/gu;

/** 把已转义的 JSON Pointer 编码为 URI 片段; RFC 3986 片段允许的字符原样保留. */
export function encodeFragment(pointer: string): string {
  return pointer.replace(FRAGMENT_UNSAFE, c => encodeURIComponent(c));
}
