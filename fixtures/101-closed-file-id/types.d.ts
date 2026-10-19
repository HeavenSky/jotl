// 由 Jotl 生成, 不要手改.

/**
 * 收件地址, 不允许出现未声明的字段
 * @title 地址
 * @closed
 * @id https://jotl.dev/fixtures/101-closed-file-id.json
 */
export interface Address {
  /**
   * @title 城市
   */
  city: string;
  /**
   * @title 街道
   */
  street?: string;
  /**
   * @title 国家
   * @defaultValue "中国"
   */
  country: string;
  /**
   * @title 坐标
   * @closed
   */
  geo?: {
    lat: number;
    lng: number;
  };
  /**
   * @title 途经点
   * @closed
   */
  points?: {
    x: number;
    y: number;
  }[];
  /**
   * @title 附加信息
   */
  extra?: {
    [key: string]: string;
  };
}

export default Address;
