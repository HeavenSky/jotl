// 测试初始化: 现有用例断言中文文案, 每个测试文件开始前把全局语言设为 zh-CN(库默认是 en).
// 两处都要设: 其他包经 @jotl/core 用构建产物, core 自身的测试直接引源码, 两者是不同的模块实例.
import { setLocale as setDistLocale } from "../packages/core/dist/index.js";
import { setLocale as setSourceLocale } from "../packages/core/src/schema/locale.js";

setDistLocale("zh-CN");
setSourceLocale("zh-CN");
