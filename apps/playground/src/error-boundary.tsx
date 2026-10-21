// 面板级错误边界: 子树渲染抛错时显示可读提示, resetKey 变化后重新渲染子树.
import { Component, type ContextType, type ReactNode } from 'react';
import { CopyContext } from './copy.js';

interface PanelErrorBoundaryProps {
  resetKey: unknown;
  children: ReactNode;
}

interface PanelErrorBoundaryState {
  failed: boolean;
  resetKey: unknown;
}

export class PanelErrorBoundary extends Component<PanelErrorBoundaryProps, PanelErrorBoundaryState> {
  static override contextType = CopyContext;
  declare context: ContextType<typeof CopyContext>;
  override state: PanelErrorBoundaryState = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError(): Partial<PanelErrorBoundaryState> {
    return { failed: true };
  }

  static getDerivedStateFromProps(
    props: PanelErrorBoundaryProps,
    state: PanelErrorBoundaryState
  ): Partial<PanelErrorBoundaryState> | null {
    return props.resetKey === state.resetKey ? null : { failed: false, resetKey: props.resetKey };
  }

  override render(): ReactNode {
    if (this.state.failed) {
      return (
        <p className="pg-alert" role="alert">
          {this.context.output.panelCrashed}
        </p>
      );
    }
    return this.props.children;
  }
}
