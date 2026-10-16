// 由 Jotl 生成, 不要手改.

export interface Constraints {
  /**
   * @title 标题
   * @minLength 1
   * @maxLength 20
   * @defaultValue "欢迎"
   */
  title: string;
  /**
   * @pattern `^[a-z]+$`
   */
  code: string;
  /**
   * @format email
   */
  email?: string;
  /**
   * @title 价格
   * @minimum 0
   * @exclusiveMaximum 10000
   * @multipleOf 0.5
   * @defaultValue 9.5
   */
  price: number;
  /**
   * @asType integer
   * @minimum 1
   * @maximum 10
   * @defaultValue 1
   */
  count: number;
  /**
   * @minItems 1
   * @maxItems 3
   * @uniqueItems
   * @defaultValue ["a"]
   */
  tags: string[];
}

export default Constraints;
