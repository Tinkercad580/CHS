import { useEffect } from "react";
import { useAdminStore } from "../store/AdminStore";

/**
 * Bottom-centre toast stack, max effectively unbounded but each with its
 * OWN 2.8s dismissal timer (README: "a shared timer is a bug — a second
 * toast cancels the first one's dismissal and strands it on screen").
 */
export function Toaster() {
  const { state, dispatch } = useAdminStore();
  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: 26,
        zIndex: 120,
        display: "flex",
        flexDirection: "column",
        gap: 9,
        pointerEvents: "none",
      }}
    >
      {state.toasts.map((t) => (
        <ToastItem key={t.id} id={t.id} text={t.text} kind={t.kind} onDone={() => dispatch({ type: "dismissToast", id: t.id })} />
      ))}
    </div>
  );
}

function ToastItem({ text, kind, onDone }: { id: string; text: string; kind: "ok" | "warn"; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      style={{
        borderRadius: 12,
        background: kind === "warn" ? "var(--warn,#B45309)" : "var(--ink,#0F1A17)",
        padding: "13px 18px",
        boxShadow: "0 16px 36px -14px rgba(15,26,23,.5)",
        animation: "toastRise .26s cubic-bezier(.2,.7,.3,1) both",
      }}
    >
      <span style={{ font: "600 13.5px/1.4 Figtree, sans-serif", color: "#fff" }}>{text}</span>
    </div>
  );
}
