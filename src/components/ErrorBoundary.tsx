import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[RAF ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground p-8 gap-4">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-lg font-semibold text-red-400">Render error — RAF Demo</h2>
          <pre className="text-xs text-muted-foreground bg-card border border-border rounded-md p-4 max-w-2xl overflow-auto whitespace-pre-wrap">
            {this.state.error.message}
          </pre>
          <button
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
