// 由 Jotl 生成, 不要手改.

/**
 * @title 文章
 * @ui `{"variants":{"mobile":{"layout":"stack","order":["title","body"]},"view":{"groups":[{"title":"元信息","fields":["tags","author"]}]}}}`
 */
export interface Article {
  /**
   * @title 标题
   * @maxLength 50
   * @ui `{"variants":{"view":{"widget":"output"}}}`
   */
  title: string;
  /**
   * @title 正文
   * @contentMediaType text/html
   * @ui `{"variants":{"view":{"widget":"json","props":{"readOnly":true}},"mobile":{"widget":"textarea","props":{"rows":6}}}}`
   */
  body: string;
  /**
   * @title 封面
   * @format uri
   * @ui `{"widget":"image","variants":{"view":{"hidden":true}}}`
   */
  cover?: string;
  /**
   * @title 标签
   * @ui `{"variants":{"view":{"decorator":false,"props":{"inline":true}}}}`
   */
  tags?: string[];
  /**
   * @title 作者
   * @ui `{"variants":{"mobile":{"visibleIf":{"field":"/title","truthy":true}}}}`
   */
  author?: Author;
}

/**
 * @title 作者
 * @ui `{"variants":{"view":{"layout":"grid","columns":2}}}`
 */
export interface Author {
  /**
   * @title 姓名
   */
  name: string;
  /**
   * @title 头像
   * @format uri
   * @widget image
   */
  avatar?: string;
}

export default Article;
