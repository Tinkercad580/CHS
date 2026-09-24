import type { ReactNode } from "react";
import type { LoadState } from "../lib/loadState";

/**
 * Renders one of the three states a screen's data can be in.
 *
 * The error branch is the reason this exists as a component rather than an
 * inline ternary. A loading state that cannot fail is the common way this goes
 * wrong: the request errors, nothing resolves, and the placeholder sits there
 * forever looking like a slow network. A wait the user cannot escape is worse
 * than an error they can retry, so failure is a first-class branch here and
 * carries the retry.
 */
export function DataBoundary<T>({ state, skeleton, children }: {
  state: LoadState<T>;
  skeleton: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (state.status === "loading") return <>{skeleton}</>;
  if (state.status === "error") {
    return (
      <div style={{ padding: "26px 16px", textAlign: "center" }}>
        <div style={{ font: "600 13.5px/1.4 Figtree, sans-serif", color: "var(--ink,#0F1A17)", marginBottom: 4 }}>
          {state.message}
        </div>
        <div style={{ font: "400 12.5px/1.45 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: 13 }}>
          Nothing was changed.
        </div>
        {state.retry ? (
          <button
            type="button"
            onClick={state.retry}
            className="press-scale"
            style={{
              height: 34,
              padding: "0 14px",
              border: "1px solid var(--border-strong,#CCD6D2)",
              borderRadius: 10,
              background: "var(--surface,#fff)",
              font: "600 12.5px/1 Figtree, sans-serif",
              color: "var(--ink,#0F1A17)",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        ) : null}
      </div>
    );
  }
  return <>{children(state.data)}</>;
}
