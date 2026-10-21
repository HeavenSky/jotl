// 远程扩展组件模块的 `react`: index.html 的 import map 指到这里, 取宿主页面挂在 globalThis.__JOTL_REACT__ 上的同一份 React.
const React = globalThis.__JOTL_REACT__;
if (React === undefined)
	throw new Error("Jotl Playground: host React is not installed on globalThis.__JOTL_REACT__");

export default React;
export const {
	Children,
	Component,
	Fragment,
	Profiler,
	PureComponent,
	StrictMode,
	Suspense,
	cloneElement,
	createContext,
	createElement,
	createRef,
	forwardRef,
	isValidElement,
	lazy,
	memo,
	startTransition,
	use,
	useActionState,
	useCallback,
	useContext,
	useDebugValue,
	useDeferredValue,
	useEffect,
	useId,
	useImperativeHandle,
	useInsertionEffect,
	useLayoutEffect,
	useMemo,
	useOptimistic,
	useReducer,
	useRef,
	useState,
	useSyncExternalStore,
	useTransition,
	version,
} = React;
