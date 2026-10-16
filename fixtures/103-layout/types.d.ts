// 由 Jotl 生成, 不要手改.

/**
 * 个人资料, 按标签页编排
 * @title 个人资料
 * @ui `{"groups":[{"title":"联系方式","fields":["phone","address","office"]},{"title":"其他","fields":["links"]}],"layout":"tabs"}`
 */
export interface Profile {
  /**
   * @title 姓名
   */
  name: string;
  /**
   * @title 简介
   * @widget textarea
   */
  bio?: string;
  /**
   * @title 电话
   */
  phone?: string;
  /**
   * @title 地址
   */
  address?: Address;
  /**
   * @title 办公地址
   * @ui `{"layout":"stack"}`
   */
  office?: Address;
  /**
   * @title 链接
   * @ui `{"layout":"grid","columns":3}`
   */
  links?: {
    /**
     * @title 主页
     * @format uri
     */
    site?: string;
    /**
     * @title 博客
     * @format uri
     */
    blog?: string;
    /**
     * @title 仓库
     * @format uri
     */
    repo?: string;
  };
}

/**
 * @title 地址
 * @ui `{"layout":"grid"}`
 */
export interface Address {
  /**
   * @title 省份
   */
  province: string;
  /**
   * @title 城市
   */
  city: string;
  /**
   * @title 详细地址
   */
  detail?: string;
}

export default Profile;
