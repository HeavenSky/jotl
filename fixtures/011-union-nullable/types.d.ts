// 由 Jotl 生成, 不要手改.

export interface Unions {
  id: string | number;
  /**
   * @defaultValue null
   */
  note: string | null;
  link?: Link | null;
  size: "s" | "m" | null;
  shape?: (Circle & {
    kind: "circle";
  }) | (Square & {
    kind: "square";
  });
}

export interface Link {
  /**
   * @format uri
   */
  href: string;
}

export interface Circle {
  r: number;
}

export interface Square {
  side: number;
}

export default Unions;
