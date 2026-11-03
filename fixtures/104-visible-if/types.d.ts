// 由 Jotl 生成, 不要手改.

/**
 * @title 配送
 */
export interface Shipping {
  /**
   * @title 配送方式
   * @enumTitles `{"express":"快递","pickup":"自提"}`
   * @defaultValue "express"
   */
  method: "express" | "pickup";
  /**
   * @title 收货地址
   * @ui `{"visibleIf":{"left":"method","op":"eq","right":"express"}}`
   */
  address?: string;
  /**
   * @title 自提点
   * @ui `{"visibleIf":{"left":"method","op":"ne","right":"express"}}`
   */
  store?: string;
  /**
   * @title 需要发票
   * @defaultValue false
   */
  invoice: boolean;
  /**
   * 只在需要发票且不是自提时填写
   * @title 发票抬头
   * @ui `{"visibleIf":{"op":"and","conditions":[{"left":"invoice","op":"truthy","right":true},{"op":"not","condition":{"left":"method","op":"in","right":["pickup"]}}]}}`
   */
  title?: string;
  /**
   * @title 商品
   */
  items?: {
    /**
     * @title 名称
     */
    name: string;
    /**
     * @title 礼品
     * @defaultValue false
     */
    gift: boolean;
    /**
     * @title 赠言
     * @ui `{"visibleIf":{"op":"or","conditions":[{"left":"items[*].gift","op":"eq","right":true},{"left":"method","op":"notIn","right":["express","pickup"]}]}}`
     */
    note?: string;
  }[];
}

export default Shipping;
