// 由 Jotl 生成, 不要手改.

/**
 * 站点配置
 * @title 站点
 */
export interface Site {
  home: Page;
  about?: Page;
  footer: Footer;
}

/**
 * @title 页面
 */
export interface Page {
  title: string;
}

export interface Footer {
  /**
   * @defaultValue "©"
   */
  text: string;
}

export default Site;
