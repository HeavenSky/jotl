// 由 Jotl 生成, 不要手改.

/**
 * @title 城市
 * @enumTitles `{"bj":"北京","sh":"上海","gz":"广州"}`
 */
export type Cities = "bj" | "sh" | "gz";

/**
 * @title 公共
 */
export interface Shared {
  /**
   * @title 备注
   */
  note?: string;
}

/**
 * 设置页
 * @title 设置
 * @root
 * @id https://jotl.dev/fixtures/111.json
 * @rules `[{"match":{"type":"boolean"},"ui":{"widget":"checkbox"}}]`
 */
export interface Settings {
  /**
   * @title 模式
   * @enumTitles `{"basic":"基础","pro":"专业"}`
   * @defaultValue "basic"
   */
  mode: "basic" | "pro";
  /**
   * @title 等级
   * @asType integer
   * @minimum 0
   * @maximum 10
   * @defaultValue 0
   */
  level: number;
  /**
   * @title 城市
   */
  city?: Cities;
  /**
   * @title 常驻城市
   * @maxItems 2
   * @uniqueItems
   */
  cities?: Cities[];
  /**
   * @title 高级选项
   * @ui `{"visibleIf":{"field":"/mode","eq":"pro"}}`
   */
  advanced?: string;
  /**
   * @title 奖励
   * @ui `{"visibleIf":{"all":[{"field":"/level","gte":5},{"field":"/level","lt":9}]}}`
   */
  bonus?: string;
  /**
   * @title 警告
   * @ui `{"visibleIf":{"any":[{"field":"/level","gt":8},{"field":"/level","lte":0}]}}`
   */
  warn?: string;
  /**
   * 未选城市时显示
   * @title 静默
   * @ui `{"visibleIf":{"field":"/city","truthy":false}}`
   */
  quiet?: string;
  /**
   * @title 链接
   * @ui `{"summary":"url"}`
   */
  links?: {
    /**
     * @title 地址
     * @format uri
     */
    url: string;
    /**
     * @title 打开
     */
    open?: boolean;
    /**
     * @title 目标
     * @ui `{"visibleIf":{"field":"/open","base":"node","truthy":true}}`
     */
    target?: "self" | "blank";
    /**
     * @title 提示
     * @ui `{"visibleIf":{"not":{"field":"/url","base":"node","in":["https://a.com"]}}}`
     */
    tip?: string;
    /**
     * @title 附加
     * @ui `{"visibleIf":{"field":"/links/*\/open","truthy":true}}`
     */
    extra?: string;
  }[];
}

export default Shared;
