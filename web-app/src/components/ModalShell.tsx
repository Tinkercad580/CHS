import { useEffect, type ReactNode } from "react";

/**
 * Shared overlay + card wrapper for every sheet-style modal (README: "Every
 * modal has a close icon in its top-right corner, in addition to Cancel and
 * the scrim"). Closes on Escape and on a scrim click; the card itself stops
 * propagation so clicks inside never bubble to the scrim.
 */
export function ModalShell({
  onClose,
  maxWidth = 520,
  zIndex = 95,
  children,
}: {
  onClose: () => void;
  maxWidth?: number;
  zIndex?: number;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex,
        background: "rgba(15,26,23,.44)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        animation: "veilIn .2s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth,
          maxHeight: "92vh",
          overflowY: "auto",
          background: "var(--surface,#fff)",
          borderRadius: 20,
          boxShadow: "0 24px 60px -18px rgba(15,26,23,.4)",
          padding: 26,
          animation: "fadeUp .26s cubic-bezier(.2,.7,.3,1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 6 }}>
      <div style={{ flex: 1, minWidth: 0, font: "700 21px/1.25 Figtree, sans-serif", letterSpacing: "-.02em" }}>{title}</div>
      <button
        type="button"
        onClick={onClose}
        title="Close"
        style={{
          width: 32,
          height: 32,
          flex: "none",
          border: 0,
          borderRadius: 9,
          background: "var(--canvas,#F7F9F8)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink,#0F1A17)" strokeWidth="2.1" strokeLinecap="round">
          <path d="M17 7 7 17M7 7l10 10" />
        </svg>
      </button>
    </div>
  );
}

export function ModalFooter({ children }: { children: ReactNode }) {
  return <div style={{ marginTop: 24, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>{children}</div>;
}

export function GhostButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 44,
        padding: "0 18px",
        border: "1px solid var(--border-strong,#CCD6D2)",
        borderRadius: 11,
        background: "var(--surface,#fff)",
        font: "600 14.5px/1 Figtree, sans-serif",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 44,
        padding: "0 20px",
        border: 0,
        borderRadius: 11,
        background: "var(--accent,#0E6B5C)",
        color: "#fff",
        font: "600 14.5px/1 Figtree, sans-serif",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}
