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
   * @ui `{"visibleIf":{"left":"mode","op":"eq","right":"pro"}}`
   */
  advanced?: string;
  /**
   * @title 奖励
   * @ui `{"visibleIf":{"op":"and","conditions":[{"left":"level","op":"gte","right":5},{"left":"level","op":"lt","right":9}]}}`
   */
  bonus?: string;
  /**
   * @title 警告
   * @ui `{"visibleIf":{"op":"or","conditions":[{"left":"level","op":"gt","right":8},{"left":"level","op":"lte","right":0}]}}`
   */
  warn?: string;
  /**
   * 未选城市时显示
   * @title 静默
   * @ui `{"visibleIf":{"left":"city","op":"truthy","right":false}}`
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
     * @ui `{"visibleIf":{"base":"node","left":"open","op":"truthy","right":true}}`
     */
    target?: "self" | "blank";
    /**
     * @title 提示
     * @ui `{"visibleIf":{"op":"not","condition":{"base":"node","left":"url","op":"in","right":["https://a.com"]}}}`
     */
    tip?: string;
    /**
     * @title 附加
     * @ui `{"visibleIf":{"left":"links[*].open","op":"truthy","right":true}}`
     */
    extra?: string;
  }[];
}

export default Shared;
