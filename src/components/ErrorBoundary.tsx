import { Component, type ErrorInfo, type ReactNode } from "react";
import { monitoring } from "@/lib/monitoring";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode };
type State = {
  hasError: boolean;
  message?: string;
  stack?: string;
  componentStack?: string;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message, stack: error.stack };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Temporary diagnostics — capture the real source of crashes such as the
    // "Cannot read properties of null (reading 'cached')" report. Remove once
    // the root cause is identified and fixed.
    // eslint-disable-next-line no-console
    console.error("[error-boundary]", error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? undefined });
    monitoring.captureError(error, { componentStack: info.componentStack });
  }

  private reset = () =>
    this.setState({
      hasError: false,
      message: undefined,
      stack: undefined,
      componentStack: undefined,
    });

  render() {
    if (!this.state.hasError) return this.props.children;
    const isDev = import.meta.env.DEV;
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-3xl text-navy">Something went wrong</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {this.state.message ?? "An unexpected error occurred. Please try again."}
        </p>
        {isDev && (this.state.stack || this.state.componentStack) && (
          <details className="max-w-2xl w-full text-left text-xs text-muted-foreground">
            <summary className="cursor-pointer">Show error details</summary>
            {this.state.stack && (
              <pre className="mt-2 overflow-auto whitespace-pre-wrap rounded bg-muted p-3">
                {this.state.stack}
              </pre>
            )}
            {this.state.componentStack && (
              <pre className="mt-2 overflow-auto whitespace-pre-wrap rounded bg-muted p-3">
                {this.state.componentStack}
              </pre>
            )}
          </details>
        )}
        <Button onClick={this.reset}>Try again</Button>
      </div>
    );
  }
}
