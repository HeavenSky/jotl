// 由 Jotl 生成, 不要手改.

/**
 * 基础类型样例: 覆盖全部基础类型与可选字段
 * @title 基础类型
 */
export interface Primitives {
  /**
   * @title 名称
   */
  name: string;
  /**
   * @title 年龄
   */
  age?: number;
  /**
   * @asType integer
   * @minimum -9007199254740991
   * @maximum 9007199254740991
   */
  count: number;
  /**
   * @title 启用
   */
  enabled: boolean;
  nothing?: null;
}

export default Primitives;
