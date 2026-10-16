// 由 Jotl 生成, 不要手改.

/**
 * 报名表
 * @title 报名
 */
export interface SignUp {
  /**
   * @title 姓名
   * @minLength 2
   * @maxLength 20
   * @errorMessage `{"minLength":"姓名至少 2 个字","maxLength":"姓名最多 20 个字"}`
   */
  name: string;
  /**
   * @title 年龄
   * @asType integer
   * @minimum 18
   * @maximum 9007199254740991
   * @errorMessage "年龄须为不小于 18 的整数"
   */
  age?: number;
  /**
   * @title 邮箱
   * @format email
   * @errorMessage `{"required":"请填写邮箱","format":"邮箱格式不正确"}`
   */
  email: string;
  /**
   * @title 电话
   * @pattern `^1\d{10}$`
   * @errorMessage `{"pattern":"请填写 11 位手机号"}`
   */
  phone?: string;
}

export default SignUp;
