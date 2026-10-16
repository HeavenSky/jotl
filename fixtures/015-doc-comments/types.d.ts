// 由 Jotl 生成, 不要手改.

/**
 * 文章
 * 第二行描述
 */
export interface Article {
  /**
   * 文章标题
   * 不超过 50 字
   * @maxLength 50
   */
  title: string;
  /**
   * @deprecated 改用 title
   */
  oldTitle?: string;
  /**
   * @readonly
   */
  id: string;
  /**
   * @writeOnly
   */
  password?: string;
  /**
   * @asType integer
   * @minimum -9007199254740991
   * @maximum 9007199254740991
   * @example 10
   * @example 200
   */
  views?: number;
  /**
   * @privateRemarks 内部使用
   */
  slug: string;
  /**
   * @enumTitles `{"draft":"草稿","published":"已发布"}`
   */
  status: "draft" | "published";
}

export default Article;
