// Vite 入口: 共享宿主 React 给扩展组件模块, 引入样式并挂载 Playground.
import './shared-react.js';
import { createRoot } from 'react-dom/client';
import './jotl.css';
import './app.css';
import { App } from './app.js';

const container = document.getElementById('root');
if (container === null) throw new Error('index.html 缺少 #root 容器');
createRoot(container).render(<App />);
