import { useState, type ReactNode } from "react";
import { toLoadState, useApi, useApiMutation, useApiQuery } from "@chs/api-client/react";
import { ApiError } from "@chs/api-client";
import { ADMIN_PERMISSIONS, USER_PERMISSIONS, api, schemas, type Permission, type PermissionTemplate, type SocietyUser } from "@chs/contract";
import { ModalFooter, ModalHeader, ModalShell, GhostButton, PrimaryButton } from "../../components/ModalShell";
import { FormError, PickField, TextField } from "../../components/FormFields";
import { SkeletonText } from "../../components/Skeleton";
import { DataBoundary } from "../../components/DataBoundary";
import { useAdminStore } from "../../store/AdminStore";
import { splitError } from "../../lib/apiErrors";
import { formatDateTime, formatMobile } from "../../lib/apiFormat";
import { modulesSummary, permissionModule, permissionVerb } from "../../lib/permissionLabels";

/**
 * The Users & access forms. Each one is a single API write: the button
 * carries the spinner while it is in flight, the server's field messages land
 * under their fields, and anything else it says is shown above the buttons as
 * written. The list and record refetch on success through the contract's
 * `invalidates`, so nothing here patches a cache by hand.
 */

function Blurb({ children }: { children: ReactNode }) {
  return <div style={{ font: "400 14px/1.55 Figtree, sans-serif", color: "var(--ink-soft,#5A6B66)", marginBottom: 22 }}>{children}</div>;
}

function Form({ onSubmit, children }: { onSubmit: () => void; children: ReactNode }) {
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {children}
    </form>
  );
}

/**
 * The API takes a unit id; people type "A-1204". Resolve the label with the
 * unit search the list page uses, and only accept an exact match.
 */
function useUnitResolver(societyId: string) {
  const client = useApi();
  return async (label: string): Promise<string | null | "missing"> => {
    const want = label.trim().toUpperCase();
    if (!want) return null;
    const page = await client.structure.units({ params: { societyId }, query: { q: want, limit: 20 } });
    return page.items.find((u) => u.label.toUpperCase() === want)?.id ?? "missing";
  };
}

function TemplatePicker({ societyId, value, onPick, error }: { societyId: string; value: string | null; onPick: (t: PermissionTemplate) => void; error?: string }) {
  const templates = useApiQuery(api.users.templates, { params: { societyId } });
  const state = toLoadState(templates);
  return (
    <DataBoundary
      state={state}
      skeleton={
        <div>
          <div style={{ font: "600 12.5px/1 Figtree, sans-serif", marginBottom: 10 }}>Permission template</div>
          <SkeletonText lines={2} />
        </div>
      }
    >
      {(list) => {
        const chosen = list.find((t) => t.code === value);
        return (
          <div>
            <PickField
              label="Permission template"
              req
              value={value}
              options={list.map((t) => ({ value: t.code, label: t.name }))}
              onPick={(code) => {
                const t = list.find((x) => x.code === code);
                if (t) onPick(t);
              }}
              error={error}
            />
            {chosen && (
              <div style={{ marginTop: 8, font: "400 12.5px/1.45 Figtree, sans-serif", color: "var(--ink-muted,#6B7A75)" }}>
                {chosen.role === "ADMIN" ? "Administrator · " : ""}
                {modulesSummary(chosen.permissions) || "No modules"}
              </div>
            )}
          </div>
        );
      }}
    </DataBoundary>
  );
}

export function AddUserModal({ societyId, onClose, onCreated }: { societyId: string; onClose: () => void; onCreated: (u: SocietyUser) => void }) {
  const { toast } = useAdminStore();
  const create = useApiMutation(api.users.create);
  const resolveUnit = useUnitResolver(societyId);
  const [template, setTemplate] = useState<PermissionTemplate | null>(null);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [unit, setUnit] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [field, setField] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setField({});
    setFormError(null);
    // Check against the contract's own schema first, so every field's problem
    // shows at once — the same messages the server would send back.
    const draft = { name, mobile, email: email.trim() || undefined, role: template?.role ?? "USER", userType: template?.userType ?? "OWNER", templateCode: template?.code ?? "-" };
    const parsed = schemas.users.CreateUserBody.safeParse(draft);
    const local: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) local[String(i.path[0])] ??= i.message;
    if (!template) local.template = "Choose a permission template";
    if (Object.keys(local).length) {
      setField(local);
      return;
    }
    if (!template) return;
    setBusy(true);
    try {
      const unitId = await resolveUnit(unit);
      if (unitId === "missing") {
        setField({ unit: `No unit "${unit.trim().toUpperCase()}" in this society.` });
        return;
      }
      const user = await create.mutateAsync({
        params: { societyId },
        body: {
          name,
          mobile,
          email: email.trim() || undefined,
          unitId,
          // The template's role must come with it: an admin template on a USER role is refused.
          role: template.role,
          userType: template.userType,
          templateCode: template.code,
        },
      });
      toast(`${user.name} can sign in with ${formatMobile(user.mobile)}.`, "ok");
      onClose();
      onCreated(user);
    } catch (err) {
      const split = splitError(err, ["name", "mobile", "email", "unitId", "permissions", "templateCode"]);
      const f = { ...split.field };
      if (f.unitId) f.unit = f.unitId;
      if (f.permissions || f.templateCode) f.template = f.permissions ?? f.templateCode;
      if (err instanceof ApiError && err.code === "MOBILE_ALREADY_EXISTS") {
        f.mobile = err.message;
        split.form = null;
      }
      setField(f);
      setFormError(split.form);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell onClose={onClose} maxWidth={560}>
      <ModalHeader title="Add user" onClose={onClose} />
      <Blurb>The mobile number is how they sign in. They create their own password the first time; nothing is sent until you issue a temporary one.</Blurb>
      <Form onSubmit={() => void submit()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <TextField label="Full name" req value={name} onChange={setName} error={field.name} placeholder="Full name" autoFocus autoComplete="off" />
          <TextField label="Mobile" req mono value={mobile} onChange={(v) => setMobile(v.replace(/[^\d+\s-]/g, ""))} error={field.mobile} placeholder="98220 00000" type="tel" inputMode="tel" autoComplete="off" />
          <TemplatePicker societyId={societyId} value={template?.code ?? null} onPick={setTemplate} error={field.template} />
          <TextField label="Unit" mono value={unit} onChange={(v) => setUnit(v.toUpperCase())} error={field.unit} placeholder="A-1206" hint="For owners, tenants and family. Leave empty for staff." autoComplete="off" />
          <TextField label="Email" type="email" value={email} onChange={setEmail} error={field.email} placeholder="name@example.com" autoComplete="off" />
          <FormError message={formError} />
        </div>
        <ModalFooter>
          <GhostButton onClick={onClose} disabled={busy}>
            Cancel
          </GhostButton>
          <PrimaryButton type="submit" busy={busy} busyLabel="Creating…">
            Create user
          </PrimaryButton>
        </ModalFooter>
      </Form>
    </ModalShell>
  );
}

export function EditUserModal({ societyId, user, onClose }: { societyId: string; user: SocietyUser; onClose: () => void }) {
  const { toast } = useAdminStore();
  const update = useApiMutation(api.users.update);
  const resolveUnit = useUnitResolver(societyId);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email ?? "");
  const [unit, setUnit] = useState(user.unitLabel ?? "");
  const [notes, setNotes] = useState(user.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [field, setField] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setField({});
    setFormError(null);
    setBusy(true);
    try {
      const unitChanged = unit.trim().toUpperCase() !== (user.unitLabel ?? "").toUpperCase();
      const unitId = unitChanged ? await resolveUnit(unit) : undefined;
      if (unitId === "missing") {
        setField({ unit: `No unit "${unit.trim().toUpperCase()}" in this society.` });
        return;
      }
      await update.mutateAsync({
        params: { societyId, userId: user.id },
        body: { name, email: email.trim() || null, notes: notes.trim() || null, ...(unitChanged ? { unitId } : {}) },
      });
      toast(`${name.trim()} updated.`, "ok");
      onClose();
    } catch (err) {
      const split = splitError(err, ["name", "email", "unitId", "notes"]);
      setField({ ...split.field, ...(split.field.unitId ? { unit: split.field.unitId } : {}) });
      setFormError(split.form);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell onClose={onClose} maxWidth={520}>
      <ModalHeader title="Edit user" onClose={onClose} />
      <Blurb>The mobile number is their sign-in and cannot be changed here. To move someone to a new number, add them again.</Blurb>
      <Form onSubmit={() => void submit()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <TextField label="Full name" req value={name} onChange={setName} error={field.name} autoFocus autoComplete="off" />
          <TextField label="Unit" mono value={unit} onChange={(v) => setUnit(v.toUpperCase())} error={field.unit} placeholder="A-1206" autoComplete="off" />
          <TextField label="Email" type="email" value={email} onChange={setEmail} error={field.email} autoComplete="off" />
          <TextField label="Notes" multiline value={notes} onChange={setNotes} error={field.notes} placeholder="Visible to admins only" />
          <FormError message={formError} />
        </div>
        <ModalFooter>
          <GhostButton onClick={onClose} disabled={busy}>
            Cancel
          </GhostButton>
          <PrimaryButton type="submit" busy={busy} busyLabel="Saving…">
            Save
          </PrimaryButton>
        </ModalFooter>
      </Form>
    </ModalShell>
  );
}

export function ChangeTemplateModal({ societyId, user, current, onClose }: { societyId: string; user: SocietyUser; current: string | null; onClose: () => void }) {
  const { toast } = useAdminStore();
  const update = useApiMutation(api.users.update);
  const [template, setTemplate] = useState<PermissionTemplate | null>(null);
  const [field, setField] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    if (update.isPending) return;
    setField({});
    setFormError(null);
    if (!template) {
      setField({ template: "Choose a permission template" });
      return;
    }
    try {
      await update.mutateAsync({ params: { societyId, userId: user.id }, body: { templateCode: template.code, userType: template.userType } });
      toast(`${user.name} moved to the ${template.name} template.`, "ok");
      onClose();
    } catch (err) {
      const split = splitError(err, ["templateCode", "permissions"]);
      setField({ template: split.field.templateCode ?? split.field.permissions ?? "" });
      setFormError(split.form);
    }
  };

  return (
    <ModalShell onClose={onClose} maxWidth={560}>
      <ModalHeader title="Change permission template" onClose={onClose} />
      <Blurb>
        What {user.name} can see changes the moment you save. {current ? `Now: ${current}.` : "Their current permissions do not match a template."}
      </Blurb>
      <Form onSubmit={() => void submit()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <TemplatePicker societyId={societyId} value={template?.code ?? null} onPick={setTemplate} error={field.template || undefined} />
          <FormError message={formError} />
        </div>
        <ModalFooter>
          <GhostButton onClick={onClose} disabled={update.isPending}>
            Cancel
          </GhostButton>
          <PrimaryButton type="submit" busy={update.isPending} busyLabel="Applying…">
            Apply template
          </PrimaryButton>
        </ModalFooter>
      </Form>
    </ModalShell>
  );
}

export function PermissionsModal({ societyId, user, onClose }: { societyId: string; user: SocietyUser; onClose: () => void }) {
  const { toast } = useAdminStore();
  const update = useApiMutation(api.users.update);
  const [picked, setPicked] = useState<Set<Permission>>(() => new Set(user.permissions));
  const [formError, setFormError] = useState<string | null>(null);
  const admin = user.role === "ADMIN";

  const toggle = (p: Permission) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });

  const submit = async () => {
    if (update.isPending) return;
    setFormError(null);
    try {
      await update.mutateAsync({ params: { societyId, userId: user.id }, body: { permissions: [...picked] } });
      toast(`Permissions for ${user.name} saved.`, "ok");
      onClose();
    } catch (err) {
      setFormError(splitError(err, []).form);
    }
  };

  const group = (title: string, note: string, list: readonly Permission[], enabled: boolean) => (
    <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
      <legend style={{ padding: 0, font: "600 12.5px/1 Figtree, sans-serif", marginBottom: 4 }}>{title}</legend>
      <div style={{ font: "400 12px/1.45 Figtree, sans-serif", color: "var(--ink-muted,#6B7A75)", marginBottom: 10 }}>{note}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: "6px 14px" }}>
        {list.map((p) => (
          <label key={p} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 0", font: "500 13px/1.3 Figtree, sans-serif", color: enabled ? "var(--ink,#0F1A17)" : "var(--ink-dim,#A8B5B0)", cursor: enabled ? "pointer" : "default" }}>
            <input type="checkbox" className="auth-check" checked={picked.has(p)} disabled={!enabled} onChange={() => toggle(p)} style={{ width: 16, height: 16, margin: 0, accentColor: "var(--accent,#0E6B5C)" }} />
            <span>
              {permissionModule(p)} · {permissionVerb(p)}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );

  return (
    <ModalShell onClose={onClose} maxWidth={640}>
      <ModalHeader title={`Permissions · ${user.name}`} onClose={onClose} />
      <Blurb>Fine-tune what this user can do. Choosing a template later replaces these.</Blurb>
      <Form onSubmit={() => void submit()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {group("Everyday use", "What a resident, guard or staff member can do in the app.", USER_PERMISSIONS, true)}
          {group("Administration", admin ? "Management of the society in this console." : "Only administrators can hold these. Apply an admin template first.", ADMIN_PERMISSIONS, admin)}
          <FormError message={formError} />
        </div>
        <ModalFooter>
          <GhostButton onClick={onClose} disabled={update.isPending}>
            Cancel
          </GhostButton>
          <PrimaryButton type="submit" busy={update.isPending} busyLabel="Saving…">
            Save permissions
          </PrimaryButton>
        </ModalFooter>
      </Form>
    </ModalShell>
  );
}

export function SuspendModal({ societyId, user, onClose }: { societyId: string; user: SocietyUser; onClose: () => void }) {
  const { toast } = useAdminStore();
  const suspend = useApiMutation(api.users.suspend);
  const [reason, setReason] = useState("");
  const [field, setField] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    if (suspend.isPending) return;
    setField({});
    setFormError(null);
    try {
      await suspend.mutateAsync({ params: { societyId, userId: user.id }, body: { reason } });
      toast(`${user.name} suspended. Their access to this society has ended.`, "warn");
      onClose();
    } catch (err) {
      const split = splitError(err, ["reason"]);
      setField(split.field);
      setFormError(split.form);
    }
  };

  return (
    <ModalShell onClose={onClose} maxWidth={500}>
      <ModalHeader title={`Suspend ${user.name}`} onClose={onClose} />
      <Blurb>Access to this society ends now and their open sessions are signed out. Their history is kept, and you can reactivate them at any time.</Blurb>
      <Form onSubmit={() => void submit()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <TextField label="Reason" req multiline value={reason} onChange={setReason} error={field.reason} placeholder="Recorded in their sign-in history" />
          <FormError message={formError} />
        </div>
        <ModalFooter>
          <GhostButton onClick={onClose} disabled={suspend.isPending}>
            Cancel
          </GhostButton>
          <PrimaryButton type="submit" tone="bad" busy={suspend.isPending} busyLabel="Suspending…">
            Suspend
          </PrimaryButton>
        </ModalFooter>
      </Form>
    </ModalShell>
  );
}

/**
 * MASTER_SPEC A2.1(4) and A2.4: the admin is the only recovery path, so the
 * temporary password is shown once, copyable, with a one-tap WhatsApp share.
 * It lives only in this component's state; closing the modal drops it and
 * nothing can show it again — a retry issues a fresh one.
 */
export function TempPasswordModal({ societyId, user, onClose }: { societyId: string; user: SocietyUser; onClose: () => void }) {
  const { toast } = useAdminStore();
  const issue = useApiMutation(api.users.issueTempPassword);
  const [copied, setCopied] = useState(false);
  const result = issue.data;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast("Temporary password copied.", "ok");
    } catch {
      toast("Copy is blocked in this browser. Select the password and copy it.", "warn");
    }
  };

  if (!result) {
    return (
      <ModalShell onClose={onClose} maxWidth={480}>
        <ModalHeader title="Reset password" onClose={onClose} />
        <Blurb>
          This creates a one-time password for {user.name}, valid for 24 hours. They use it once and then set their own. Their current password keeps working until then.
        </Blurb>
        <FormError message={issue.error ? issue.error.message : null} />
        <ModalFooter>
          <GhostButton onClick={onClose} disabled={issue.isPending}>
            Cancel
          </GhostButton>
          <PrimaryButton onClick={() => issue.mutate({ params: { societyId, userId: user.id } })} busy={issue.isPending} busyLabel="Generating…">
            Generate temporary password
          </PrimaryButton>
        </ModalFooter>
      </ModalShell>
    );
  }

  const via = result.deliveredVia.map((c) => (c === "sms" ? "SMS" : c === "whatsapp" ? "WhatsApp" : "email"));
  return (
    <ModalShell onClose={onClose} maxWidth={480}>
      <ModalHeader title="Temporary password" onClose={onClose} />
      <Blurb>
        Shown once. {via.length ? `Also sent to ${formatMobile(user.mobile)} by ${via.join(" and ")}.` : ""} It expires {formatDateTime(result.expiresAt)}.
      </Blurb>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 14px 14px 18px", borderRadius: 13, background: "var(--canvas,#F7F9F8)", border: "1px solid var(--border,#E3E9E6)" }}>
        <span aria-label="Temporary password" style={{ flex: 1, minWidth: 0, font: "600 22px/1.2 'IBM Plex Mono',monospace", letterSpacing: ".06em", color: "var(--ink,#0F1A17)", userSelect: "all", overflowWrap: "anywhere" }}>
          {result.tempPassword}
        </span>
        <button type="button" onClick={() => void copy(result.tempPassword)} className="press-scale focus-ring" style={{ height: 36, padding: "0 13px", border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 9, background: "var(--surface,#fff)", font: "600 12.5px/1 Figtree, sans-serif", color: "var(--ink,#0F1A17)", cursor: "pointer", flex: "none" }}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <ModalFooter>
        <a
          href={result.whatsappShareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="press-scale focus-ring"
          style={{ height: 44, padding: "0 18px", border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 11, background: "var(--surface,#fff)", font: "600 14.5px/44px Figtree, sans-serif", color: "var(--ink,#0F1A17)", whiteSpace: "nowrap" }}
        >
          Share on WhatsApp
        </a>
        <PrimaryButton onClick={onClose}>Done</PrimaryButton>
      </ModalFooter>
    </ModalShell>
  );
}
