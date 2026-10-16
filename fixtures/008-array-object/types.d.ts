// 由 Jotl 生成, 不要手改.

export interface Gallery {
  /**
   * @title 图片列表
   * @maxItems 10
   */
  items: {
    /**
     * @title 地址
     * @format uri
     */
    src: string;
    alt?: string;
  }[];
}

export default Gallery;
