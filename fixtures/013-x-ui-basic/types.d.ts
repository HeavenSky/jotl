// 由 Jotl 生成, 不要手改.

/**
 * @ui `{"order":["bare","title"],"groups":[{"title":"高级","fields":["secret","matrix"]}]}`
 */
export interface Ui {
  /**
   * @title 标题
   * @ui `{"widget":"headline","props":{"size":"large"}}`
   */
  title: string;
  /**
   * @ui `{"hidden":true}`
   */
  secret?: string;
  /**
   * @maxItems 5
   * @widget tag-list
   * @itemWidget tag
   */
  tags?: string[];
  /**
   * @widget table
   * @itemWidget row
   * @itemWidget slider
   */
  matrix?: number[][];
  /**
   * @ui `{"decorator":false}`
   */
  bare: string;
  /**
   * @ui `{"decorator":"card"}`
   */
  boxed?: string;
  /**
   * @deprecated 已弃用.
   */
  legacy?: string;
  /**
   * @enumTitles `{"low":"低","high":"高"}`
   * @enumDescriptions `{"low":"低档位"}`
   */
  level: "low" | "high";
}

export default Ui;
