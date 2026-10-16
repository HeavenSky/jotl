// 由 Jotl 生成, 不要手改.

export interface Home {
  hero: Banner;
  /**
   * @widget banner-mini
   */
  mini?: Banner;
}

/**
 * @widget banner-card
 */
export interface Banner {
  /**
   * @format uri
   * @ui `{"widget":"image","props":{"maxWidth":750}}`
   */
  img: string;
}

export default Home;
