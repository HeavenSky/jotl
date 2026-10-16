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
   * @ui `{"visibleIf":{"field":"/method","eq":"express"}}`
   */
  address?: string;
  /**
   * @title 自提点
   * @ui `{"visibleIf":{"field":"/method","ne":"express"}}`
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
   * @ui `{"visibleIf":{"all":[{"field":"/invoice","truthy":true},{"not":{"field":"/method","in":["pickup"]}}]}}`
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
     * @ui `{"visibleIf":{"any":[{"field":"/items/*\/gift","eq":true},{"field":"/method","notIn":["express","pickup"]}]}}`
     */
    note?: string;
  }[];
}

export default Shipping;
