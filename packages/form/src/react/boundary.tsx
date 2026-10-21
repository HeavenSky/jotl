// 错误边界: 捕获组件渲染期的异常并交给节点决定降级方式(F4 F5).
import { Component, type ReactNode } from 'react';

interface BoundaryProps {
  onError(error: unknown): void;
  children: ReactNode;
}

export class Boundary extends Component<BoundaryProps, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    this.props.onError(error);
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
