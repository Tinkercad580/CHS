import type { ReactNode } from "react";
import type { Permission, SocietyMembership } from "@chs/contract";
import { holds, useCurrentSociety } from "../../api/society";
import { PageHeader } from "../../components/ApiTable";
import { SubNav } from "../../components/Kit";
import { NoAccess, NoSociety } from "../../components/NoSociety";
import { BILLS_PERMS, HEADS_PERMS, RUNS_PERMS } from "./billingAccess";

/** The permissions that open any part of Billing — the union of the runs, bills and heads access rules. */
const BILLING_PERMS = ["billing.generate", "billing.publish", "society.configure", "payments.record", "accounts.manage"] as const;

/**
 * The society/permission guard every billing screen needs before it reads.
 * `need` narrows it to the screen's own rule — a cashier with only
 * payments.record opens Bills but not a bill run — so the screen never
 * fires a read the server would refuse. Keyed by society so switching
 * society resets the screen's filters.
 */
export function BillingGuard({ need, children }: { need?: Permission[]; children: (society: SocietyMembership) => ReactNode }) {
  const { society } = useCurrentSociety();
  if (!society) return <NoSociety title="Billing" />;
  if (!holds(society, ...BILLING_PERMS)) return <NoAccess title="Billing" need="billing.generate" />;
  if (need && !holds(society, ...need)) return <NoAccess title="Billing" need={need.join(" or ")} />;
  return <div key={society.societyId}>{children(society)}</div>;
}

/** Billing's title and a tab per list the admin can open: runs, bills, charge heads. */
export function BillingHeader({ sub, actions }: { sub: ReactNode; actions?: ReactNode }) {
  const { society } = useCurrentSociety();
  const can = (perms: Permission[]) => (society ? holds(society, ...perms) : false);
  return (
    <>
      <PageHeader title="Billing" sub={sub} actions={actions} />
      <SubNav
        items={[
          ...(can(RUNS_PERMS) ? [{ to: "/billing", label: "Bill runs", end: true }] : []),
          ...(can(BILLS_PERMS) ? [{ to: "/billing/bills", label: "Bills" }] : []),
          ...(can(HEADS_PERMS) ? [{ to: "/billing/heads", label: "Charge heads" }] : []),
        ]}
      />
    </>
  );
}
