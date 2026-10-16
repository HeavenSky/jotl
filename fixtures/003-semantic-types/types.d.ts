// 由 Jotl 生成, 不要手改.

export interface Semantic {
  /**
   * @widget textarea
   */
  intro: string;
  /**
   * @contentMediaType text/html
   */
  body?: string;
  /**
   * @format uri
   */
  site: string;
  /**
   * @format email
   */
  mail?: string;
  /**
   * @format date
   */
  birthday?: string;
  /**
   * @format date-time
   */
  createdAt?: string;
  /**
   * @valueFormat HH:mm:ss
   * @widget time
   */
  alarm?: string;
  /**
   * @format color
   * @defaultValue "#1677ff"
   */
  theme?: string;
  /**
   * @format uri
   * @widget image
   */
  cover?: string;
  /**
   * @format uri
   * @widget file
   */
  attachment?: string;
}

export default Semantic;
