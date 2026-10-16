// 由 Jotl 生成, 不要手改.

/**
 * 页面由不同类型的区块组成
 * @title 页面
 */
export interface Page {
  /**
   * @title 区块
   * @maxItems 10
   */
  blocks: Block[];
  /**
   * @title 头图
   * @branchTitles ["文本","图片"]
   */
  hero?: (TextBlock & {
    kind: "text";
  }) | (ImageBlock & {
    kind: "image";
  });
}

/**
 * @title 区块
 * @branchTitles ["文本","图片","分隔线"]
 */
export type Block = (TextBlock & {
  kind: "text";
}) | (ImageBlock & {
  kind: "image";
}) | {
  kind: "divider";
};

/**
 * @title 文本区块
 */
export interface TextBlock {
  /**
   * @title 内容
   * @maxLength 200
   * @widget textarea
   */
  content: string;
}

/**
 * @title 图片区块
 */
export interface ImageBlock {
  /**
   * @title 图片
   * @format uri
   * @widget image
   */
  src: string;
  /**
   * @title 替代文字
   */
  alt?: string;
}

export default Page;
