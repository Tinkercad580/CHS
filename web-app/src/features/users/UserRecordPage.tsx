import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@chs/api-client";
import { toLoadState, useApiMutation, useApiQuery } from "@chs/api-client/react";
import { api, type AuthEvent, type Session, type SocietyUser } from "@chs/contract";
import { holds, useConsoleMe, useCurrentSociety, userTypeLabel } from "../../api/society";
import { NoAccess, NoSociety } from "../../components/NoSociety";
import { useAdminStore } from "../../store/AdminStore";
import { authEventLabel, deviceLabel, enumLabel, formatDate, formatDateTime, formatMobile, formatUntil, formatWhen, userStatusPill } from "../../lib/apiFormat";
import { matchingTemplate, moduleRows } from "../../lib/permissionLabels";
import type { PillKind } from "../../lib/types";
import { RecordAlertCard, RecordColumns, RecordHeaderCard, RecordMessage, RecordSkeleton, RecordTiles, SectionCard, type RecordAction } from "../record/RecordView";
import { TWO_COLUMNS, section, tile } from "../record/recordModel";
import { ChangeTemplateModal, EditUserModal, PermissionsModal, SuspendModal, TempPasswordModal } from "./UserModals";

type Modal = "temp" | "edit" | "template" | "permissions" | "suspend" | null;

/**
 * One user's record, from `users.get` with its sessions and sign-in history
 * alongside (MASTER_SPEC A2.3: temporary password, unlock, suspend and
 * reactivate, sessions, auth audit log). Laid out like the design's user
 * record; the helpdesk, booking and visitor sections it shows belong to
 * modules that have no API yet, so they are left out rather than faked.
 */
export function UserRecordPage({ userId }: { userId: string }) {
  const { society } = useCurrentSociety();
  if (!society) return <NoSociety title="Users & access" />;
  if (!holds(society, "users.manage")) return <NoAccess title="Users & access" need="users.manage" />;
  return <UserRecord societyId={society.societyId} userId={userId} />;
}

function UserRecord({ societyId, userId }: { societyId: string; userId: string }) {
  const navigate = useNavigate();
  const back = () => navigate("/users");
  const params = { societyId, userId };
  const user = useApiQuery(api.users.get, { params });
  const state = toLoadState(user);

  if (state.status === "loading") return <RecordSkeleton />;
  if (state.status === "error") {
    const missing = user.error instanceof ApiError && user.error.code === "NOT_FOUND";
    return (
      <RecordMessage
        title={missing ? "This user could not be found" : state.message}
        body={missing ? "They may have been removed from this society, or the link belongs to another society." : "Nothing was changed."}
        onBack={back}
        action={
          missing ? undefined : (
            <button type="button" onClick={state.retry} className="press-scale focus-ring" style={{ height: 34, padding: "0 14px", border: "1px solid var(--border-strong,#CCD6D2)", borderRadius: 10, background: "var(--surface,#fff)", font: "600 12.5px/1 Figtree, sans-serif", color: "var(--ink,#0F1A17)", cursor: "pointer" }}>
              Try again
            </button>
          )
        }
      />
    );
  }
  return <UserRecordView societyId={societyId} user={state.data} onBack={back} />;
}

function UserRecordView({ societyId, user, onBack }: { societyId: string; user: SocietyUser; onBack: () => void }) {
  const navigate = useNavigate();
  const me = useConsoleMe();
  const { toast } = useAdminStore();
  const [modal, setModal] = useState<Modal>(null);
  const params = { societyId, userId: user.id };

  const sessions = useApiQuery(api.users.sessions, { params });
  const events = useApiQuery(api.users.authEvents, { params, query: { limit: 20 } });
  const templates = useApiQuery(api.users.templates, { params: { societyId } });

  const unlock = useApiMutation(api.users.unlock);
  const reactivate = useApiMutation(api.users.reactivate);
  const logoutAll = useApiMutation(api.users.logoutAll);

  const self = user.userId === me.id;
  const pill = userStatusPill(user);
  const template = templates.data ? matchingTemplate(user, templates.data) : null;
  const templateName = templates.data ? (template?.name ?? "Custom") : "…";
  const liveSessions: Session[] = sessions.data ?? [];
  const history: AuthEvent[] = events.data?.items ?? [];
  const neverSignedIn = user.status === "INVITED";

  // One-click actions report through the toast; a refusal shows the server's reason.
  const report = (text: string, kind: "ok" | "warn" = "ok") => ({ onSuccess: () => toast(text, kind), onError: (e: ApiError) => toast(e.message, "warn") });
  const doUnlock = () => unlock.mutate({ params }, report(`${user.name} unlocked. They can sign in now.`));
  const doReactivate = () => reactivate.mutate({ params }, report(`${user.name} reactivated.`));

  const actions: RecordAction[] = [];
  // Someone who has never signed in has no password to reset: sign-in sends
  // them to create one, and a temporary password would never be asked for.
  if (!self && !neverSignedIn) actions.push({ label: "Reset password", kind: "primary", onClick: () => setModal("temp") });
  if (!self) actions.push({ label: "Change template", kind: "ghost", onClick: () => setModal("template") });
  actions.push({ label: "Edit", kind: "ghost", onClick: () => setModal("edit") });
  if (user.status === "LOCKED") actions.push({ label: "Unlock", kind: "warn", busy: unlock.isPending, busyLabel: "Unlocking…", onClick: doUnlock });
  else if (user.status === "SUSPENDED") actions.push({ label: "Reactivate", kind: "warn", busy: reactivate.isPending, busyLabel: "Reactivating…", onClick: doReactivate });
  else if (!self) actions.push({ label: "Suspend", kind: "warn", onClick: () => setModal("suspend") });

  const chips: [string, PillKind][] = [
    [pill.label, pill.kind],
    [user.role === "ADMIN" ? "ADMIN" : user.userType, "info"],
    ...(neverSignedIn ? ([["Never signed in", "warn"]] as [string, PillKind][]) : []),
  ];

  const lastSession = liveSessions[0];
  const tiles = [
    tile(
      "Last sign-in",
      formatWhen(user.lastLoginAt, "Never"),
      user.lastLoginAt ? (lastSession ? `${deviceLabel(lastSession)}${lastSession.ip ? ` · ${lastSession.ip}` : ""}` : "No device signed in now") : neverSignedIn ? "Password not set yet" : "No sign-in recorded",
      user.lastLoginAt ? "var(--ok,#167A3C)" : "var(--warn,#B45309)",
    ),
    tile("Active sessions", sessions.data ? String(liveSessions.length) : "—", sessions.data ? (liveSessions.length ? "Devices signed in now" : "Not signed in anywhere") : "Loading…", "var(--info,#1D4ED8)"),
    tile("Permissions", String(user.permissions.length), `Template: ${templateName}`, "var(--accent,#0E6B5C)"),
    tile(
      "Account",
      user.status === "LOCKED" ? "Locked" : user.status === "SUSPENDED" ? "Suspended" : neverSignedIn ? "Invited" : "Active",
      user.status === "LOCKED" && user.lockedUntil ? `Until ${formatUntil(user.lockedUntil)}` : `Added ${formatDate(user.createdAt)}`,
      user.status === "LOCKED" ? "var(--bad,#C0342B)" : user.status === "SUSPENDED" ? "var(--warn,#B45309)" : "var(--ink-muted,#8A9995)",
    ),
  ];

  const alert =
    user.status === "LOCKED"
      ? { label: "Locked out", value: user.lockedUntil ? `Until ${formatUntil(user.lockedUntil)}` : "Locked", sub: "Too many wrong passwords in a row. It clears on its own, or unlock now.", cta: "Unlock now" }
      : user.status === "SUSPENDED"
        ? { label: "Suspended", value: user.suspendedReason ?? "No reason recorded", sub: "No access to this society. Their history is kept.", cta: "Reactivate" }
        : null;
  const alertAct = user.status === "LOCKED" ? doUnlock : doReactivate;

  const historySection = section({
    h: "Sign-in history",
    sub: history.length ? `Last ${history.length} event${history.length === 1 ? "" : "s"}` : "Nothing recorded",
    type: "trail",
    rows: history.map((e) => [
      authEventLabel(e.type) + (e.actorName ? ` · by ${e.actorName}` : "") + (e.detail && e.type === "SUSPENDED" ? ` · ${e.detail}` : ""),
      [formatDateTime(e.createdAt), e.ip].filter(Boolean).join(" · "),
    ]),
    empty: neverSignedIn ? "Nothing yet — they have never signed in." : "No sign-in activity recorded.",
  });

  const sessionsSection = section({
    h: "Sessions",
    sub: liveSessions.length ? `${liveSessions.length} device${liveSessions.length === 1 ? "" : "s"} signed in` : "No device signed in",
    action: liveSessions.length && !self ? "Sign out everywhere" : undefined,
    type: "list",
    rows: liveSessions.map((s) => {
      const device = deviceLabel(s);
      // A mobile session often has no user agent, and the device label is then the client name; don't say it twice.
      const client = enumLabel(s.client);
      return [device, [device === client ? null : client, s.ip, `since ${formatDate(s.createdAt)}`].filter(Boolean).join(" · "), formatWhen(s.lastUsedAt)];
    }),
    empty: "Not signed in on any device.",
  });

  const profile = section({
    h: "Profile details",
    type: "grid",
    rows: [
      ["Mobile", formatMobile(user.mobile)],
      ["Name", user.name],
      ["Type", userTypeLabel(user.userType)],
      ["Unit", user.unitLabel ?? "—"],
      ["Created", formatDate(user.createdAt)],
      ["Template", templateName],
      ["Role", user.role === "ADMIN" ? "Administrator" : "User"],
      ["Email", user.email ?? "—"],
      ...(user.notes ? [["Notes", user.notes]] : []),
    ],
  });

  const money = user.unitId
    ? section({ h: "Money", sub: "The unit owns the ledger, not the login", action: "Member record", type: "list", rows: [[user.unitLabel ?? "Unit", "Open the member record for the unit's details", "Member record"]] })
    : null;

  const modules = section({
    h: "Modules visible",
    sub: `From ${template ? `the ${template.name} template` : "the permissions set on this user"}`,
    action: self ? undefined : "Edit",
    type: "list",
    rows: moduleRows(user.permissions),
    empty: "No permissions. They can sign in but see nothing.",
  });

  return (
    <div style={{ animation: "fadeUp .3s cubic-bezier(.2,.7,.3,1)", display: "flex", flexDirection: "column", gap: 14 }}>
      <RecordHeaderCard
        initial={user.name[0]?.toUpperCase() ?? "?"}
        name={user.name}
        code={formatMobile(user.mobile)}
        meta={[userTypeLabel(user.userType), user.unitLabel ? `Unit ${user.unitLabel}` : "No unit", ...(self ? ["This is you"] : [])]}
        chips={chips}
        actions={actions}
        onBack={onBack}
      />

      <RecordTiles tiles={tiles} />

      {alert && <RecordAlertCard alert={alert} onAct={alertAct} busy={unlock.isPending || reactivate.isPending} />}

      <RecordColumns
        grid={TWO_COLUMNS}
        left={
          <>
            <SectionCard s={historySection} load={toLoadState(events)} />
            <SectionCard
              s={sessionsSection}
              load={toLoadState(sessions)}
              busy={logoutAll.isPending}
              onAdd={() => logoutAll.mutate({ params }, report(`${user.name} is signed out on every device.`, "warn"))}
            />
          </>
        }
        right={
          <>
            <SectionCard s={profile} />
            {money && <SectionCard s={money} onAdd={() => navigate(`/members/record/${user.unitId}`)} />}
            <SectionCard s={modules} onAdd={() => setModal("permissions")} />
          </>
        }
      />

      {modal === "temp" && <TempPasswordModal societyId={societyId} user={user} onClose={() => setModal(null)} />}
      {modal === "edit" && <EditUserModal societyId={societyId} user={user} onClose={() => setModal(null)} />}
      {modal === "template" && <ChangeTemplateModal societyId={societyId} user={user} current={template?.name ?? null} onClose={() => setModal(null)} />}
      {modal === "permissions" && <PermissionsModal societyId={societyId} user={user} onClose={() => setModal(null)} />}
      {modal === "suspend" && <SuspendModal societyId={societyId} user={user} onClose={() => setModal(null)} />}
    </div>
  );
}
