// 由 Jotl 生成, 不要手改.

export interface Multi {
  /**
   * @title 颜色
   * @enumTitles `{"red":"红","green":"绿","blue":"蓝"}`
   * @uniqueItems
   * @defaultValue ["red"]
   */
  colors: ("red" | "green" | "blue")[];
  /**
   * @uniqueItems
   */
  flags: ("a" | "b")[];
}

export default Multi;
