import { PageHeader } from "./ApiTable";

/**
 * A platform administrator can open the console without administering a
 * society of their own. Society screens have nothing to read for them, and
 * say so rather than failing a request.
 */
export function NoSociety({ title }: { title: string }) {
  return (
    <div style={{ animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1)" }}>
      <PageHeader title={title} sub="This screen shows one society's data." />
      <div style={{ background: "var(--surface,#fff)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 15, padding: "48px 24px", textAlign: "center" }}>
        <div style={{ font: "600 15px/1.3 Figtree, sans-serif", marginBottom: 6 }}>No society to show</div>
        <div style={{ font: "400 13.5px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>
          Your account does not administer a society. Societies you are made an administrator of appear in the switcher.
        </div>
      </div>
    </div>
  );
}

/**
 * The signed-in admin's membership lacks the permission this screen needs —
 * a treasurer opening Users & access. Said up front instead of firing
 * requests the server will refuse.
 */
export function NoAccess({ title, need }: { title: string; need: string }) {
  return (
    <div style={{ animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1)" }}>
      <PageHeader title={title} sub="This screen is limited to administrators with the right permission." />
      <div style={{ background: "var(--surface,#fff)", border: "1px solid var(--border,#E3E9E6)", borderRadius: 15, padding: "48px 24px", textAlign: "center" }}>
        <div style={{ font: "600 15px/1.3 Figtree, sans-serif", marginBottom: 6 }}>You don't have access to this screen</div>
        <div style={{ font: "400 13.5px/1.5 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)" }}>
          It needs the {need} permission. An administrator who manages users can grant it.
        </div>
      </div>
    </div>
  );
}
