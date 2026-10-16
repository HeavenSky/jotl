// 组件包面向使用者的全部文案(中英两套同形), 组件内经 useCopy() 按表单语言取用.
import type { Locale } from "@jotl/core";
import { useLocale } from "../locale-context.js";

const ZH = {
  add: "新增",
  remove: "删除",
  moveUp: "上移",
  moveDown: "下移",
  removeItem: (index: number) => `删除第 ${index + 1} 项`,
  duplicate: "复制",
  duplicateItem: (index: number) => `复制第 ${index + 1} 项`,
  moveItemUp: (index: number) => `上移第 ${index + 1} 项`,
  moveItemDown: (index: number) => `下移第 ${index + 1} 项`,
  submit: "提交",
  reset: "重置",
  emptyOption: "请选择",
  requiredMark: "*",
  requiredHint: "必填",
  jsonInvalid: "JSON 格式不正确, 修正前不会保存",
  numberInvalid: "请输入数字",
  temporalInvalid: (format: string) => `不符合存储格式 ${format}, 修正前不会保存`,
  currency: "币种",
  unit: "单位",
  upload: "上传文件",
  uploadImage: "上传图片",
  uploading: "上传中…",
  uploadFailed: "上传失败, 请重试",
  imagePreview: "图片预览",
  richTextToolbar: "格式",
  bold: "粗体",
  italic: "斜体",
  link: "链接",
  linkPrompt: "链接地址",
  bulletList: "无序列表",
  orderedList: "有序列表",
  setNull: "置为空",
  nullValue: "空值",
  branch: "类型",
  entryName: (index: number) => `第 ${index + 1} 项的键名`,
  removeEntry: (name: string) => `删除 ${name}`,
  newEntryName: (n: number) => `key${n}`,
  entryNameEmpty: "键名不能为空, 修正前不会保存",
  entryNameDuplicate: (name: string) => `键名 "${name}" 已存在, 修正前不会保存`,
  additionalKeys: "其他键",
  expand: "展开",
  collapse: "收起",
  tabErrors: (n: number) => `${n} 个错误`,
  goToError: (message: string) => `${message}, 跳到所在位置`,
};

export type Copy = typeof ZH;

const EN: Copy = {
  add: "Add",
  remove: "Remove",
  moveUp: "Up",
  moveDown: "Down",
  removeItem: (index) => `Remove item ${index + 1}`,
  duplicate: "Duplicate",
  duplicateItem: (index) => `Duplicate item ${index + 1}`,
  moveItemUp: (index) => `Move item ${index + 1} up`,
  moveItemDown: (index) => `Move item ${index + 1} down`,
  submit: "Submit",
  reset: "Reset",
  emptyOption: "Select…",
  requiredMark: "*",
  requiredHint: "Required",
  jsonInvalid: "Invalid JSON; not saved until fixed",
  numberInvalid: "Enter a number",
  temporalInvalid: (format) => `Does not match the storage format ${format}; not saved until fixed`,
  currency: "Currency",
  unit: "Unit",
  upload: "Upload file",
  uploadImage: "Upload image",
  uploading: "Uploading…",
  uploadFailed: "Upload failed, please retry",
  imagePreview: "Image preview",
  richTextToolbar: "Formatting",
  bold: "Bold",
  italic: "Italic",
  link: "Link",
  linkPrompt: "Link URL",
  bulletList: "Bulleted list",
  orderedList: "Numbered list",
  setNull: "Set to null",
  nullValue: "null",
  branch: "Type",
  entryName: (index) => `Key of entry ${index + 1}`,
  removeEntry: (name) => `Remove ${name}`,
  newEntryName: (n) => `key${n}`,
  entryNameEmpty: "Key must not be empty; not saved until fixed",
  entryNameDuplicate: (name) => `Key "${name}" already exists; not saved until fixed`,
  additionalKeys: "Other keys",
  expand: "Expand",
  collapse: "Collapse",
  tabErrors: (n) => (n === 1 ? "1 error" : `${n} errors`),
  goToError: (message) => `${message}, go to field`,
};

/** 中文文案; 不在组件内(取不到表单语言)时使用. */
export const COPY: Copy = ZH;

export function copyFor(locale: Locale): Copy {
  return locale === "en" ? EN : ZH;
}

/** 按表单语言(JotlForm 的 locale, 未指定时为全局语言)取文案. */
export function useCopy(): Copy {
  return copyFor(useLocale());
}
