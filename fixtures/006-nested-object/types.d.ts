// 由 Jotl 生成, 不要手改.

export interface Page {
  /**
   * @title 元信息
   */
  meta: {
    /**
     * @title SEO
     */
    seo: {
      keywords?: string[];
      /**
       * @defaultValue "index"
       */
      robots: "index" | "nofollow";
    };
    author?: string;
  };
  /**
   * @defaultValue "首页"
   */
  title: string;
}

export default Page;
