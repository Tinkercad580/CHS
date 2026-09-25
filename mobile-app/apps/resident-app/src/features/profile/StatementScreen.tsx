import React from "react";
import { View } from "react-native";
import { toLoadState } from "@chs/api-client/react";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { currentUnit } from "../../state/selectors";
import {
  PAYMENT_MODE_LABEL,
  dayMonth,
  duesDeadline,
  financialYear,
  duesForUnit,
  formatPaise,
  istDate,
  longDate,
  useMyDues,
  useUnitId,
  useUnitLedger,
  useUnitPayments,
  type Ledger,
  type Payment,
} from "../../api/billing";
import { ScreenScroll } from "../../components/ScreenScroll";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { RevealItem } from "../../components/RevealItem";
import { Skeleton } from "../../components/Skeleton";
import { LoadError } from "../../components/LoadError";
import { EmptyState } from "../../components/EmptyState";
import { StatusPill } from "../../components/StatusPill";
import { iconPaths } from "../../components/iconPaths";

const ENTRY_KIND: Record<string, string> = {
  BILL: "Bill",
  PAYMENT: "Payment",
  CREDIT_NOTE: "Credit note",
  REVERSAL: "Reversal",
  OPENING: "Opening balance",
  ADVANCE_APPLIED: "Advance applied",
};

/**
 * The unit's statement for this financial year — its ledger (billing.ledger)
 * with the running balance the society keeps — and the receipts issued against
 * it (payments.mine). Interest is whatever the society has charged, as the dues
 * card reports it; the app never estimates it.
 */
export function StatementScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();
  const unit = currentUnit(state);
  const { unitId, loading: waitingForUnit } = useUnitId(unit.code);
  const ledger = toLoadState(useUnitLedger(unitId));
  const payments = toLoadState(useUnitPayments(unitId));
  const dues = useMyDues();
  const unitDues = dues.status === "ready" ? duesForUnit(dues.data, unit.code) : undefined;

  let body: React.ReactNode;
  if (waitingForUnit || (unitId && ledger.status === "loading")) {
    body = (
      <View style={{ gap: 16 }}>
        <Skeleton height={112} radius={18} />
        <Skeleton height={260} radius={16} />
      </View>
    );
  } else if (!unitId) {
    body = <EmptyState iconPath={iconPaths.dues} title="Nothing billed yet" body={`${unit.code} has no bills or payments on record.`} dashed />;
  } else if (ledger.status === "error") {
    body = <LoadError title="Couldn't load your statement" message={ledger.message} onRetry={ledger.retry} />;
  } else if (ledger.status === "ready") {
    body = <StatementBody ledger={ledger.data} interestPaise={unitDues?.interestPaise ?? 0} deadline={unitDues ? duesDeadline(unitDues) : null} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader title={t("statementTitle")} onBack={actions.back} />
      <ScreenScroll>
        {body}

        {unitId && ledger.status === "ready" ? (
          <>
            <AppText variant="cardTitle" color={colors.inkSoft} style={{ fontSize: 13, marginBottom: 11 }}>
              Receipts
            </AppText>
            {payments.status === "loading" ? (
              <Skeleton height={130} radius={16} />
            ) : payments.status === "error" ? (
              <LoadError title="Couldn't load receipts" message={payments.message} onRetry={payments.retry} />
            ) : (
              <Receipts payments={payments.data.items} />
            )}
            <Button label={t("downloadPdf")} kind="secondary" onPress={() => actions.downloadStatement(financialYear())} height={50} fontSize={15} weight={600} style={{ marginTop: 18 }} />
          </>
        ) : null}
      </ScreenScroll>
    </View>
  );
}

function StatementBody({ ledger, interestPaise, deadline }: { ledger: Ledger; interestPaise: number; deadline: { date: string; overdue: boolean } | null }) {
  const { colors } = useTheme();
  const { t } = useT();
  const due = ledger.balancePaise;
  const overdue = due > 0 && !!deadline?.overdue;
  const sub =
    due <= 0
      ? ledger.advancePaise > 0
        ? `Fully settled, with ${formatPaise(ledger.advancePaise)} paid in advance.`
        : t("accountSettled")
      : deadline
        ? overdue
          ? `Overdue since ${longDate(deadline.date)}.`
          : `Payable by ${longDate(deadline.date)}.`
        : "Payable now.";

  return (
    <>
      <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface, padding: 18, marginBottom: 16 }}>
        <AppText variant="eyebrow" color={colors.inkMuted} forceLatin style={{ marginBottom: 9 }}>
          {t("closingBalance").toUpperCase()}
        </AppText>
        <AppText variant="moneyHeroSmall" color={due > 0 ? colors.warnInk : colors.okInk} style={{ marginBottom: 7 }} forceLatin>
          {formatPaise(Math.max(0, due))}
        </AppText>
        <AppText variant="bodySmall" color={overdue ? colors.badInk : colors.inkSoft}>
          {sub}
        </AppText>
      </View>

      {due > 0 ? (
        <View style={{ borderWidth: 1, borderColor: colors.warnBorder, borderRadius: 15, backgroundColor: colors.warnWash, padding: 15, marginBottom: 18 }}>
          <AppText variant="cardTitle" color={colors.warnInk} style={{ fontSize: 13, marginBottom: 4 }}>
            {t("interestTitle")}
          </AppText>
          <AppText variant="bodySmall" color={colors.inkSoft}>
            {interestPaise > 0
              ? `${formatPaise(interestPaise)} of interest has been charged on this account for late payment. More accrues on anything unpaid after its due date, at the rate the bye-laws set.`
              : "Anything unpaid after its due date attracts interest at the rate the bye-laws set. Each bill shows it as its own line."}
          </AppText>
        </View>
      ) : null}

      <AppText variant="cardTitle" color={colors.inkSoft} style={{ fontSize: 13, marginBottom: 11 }}>
        {t("thisYear")}
      </AppText>
      {ledger.entries.length === 0 ? (
        <View style={{ marginBottom: 18 }}>
          <EmptyState iconPath={iconPaths.dues} title="Nothing this year yet" body="Bills and payments since 1 April appear here." dashed />
        </View>
      ) : (
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, overflow: "hidden", marginBottom: 18 }}>
          {ledger.entries.map((l, i) => {
            const credit = l.creditPaise > 0;
            return (
              <RevealItem key={l.id} tier="listRow">
                <View style={{ padding: 13, paddingHorizontal: 15, borderBottomWidth: i === ledger.entries.length - 1 ? 0 : 1, borderBottomColor: colors.borderSoft, flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText variant="cardTitle" style={{ fontSize: 13.5, fontWeight: "500" as const, marginBottom: 2 }}>
                      {l.narration}
                    </AppText>
                    <AppText variant="meta" color={colors.inkMuted}>
                      {dayMonth(l.date)} · {ENTRY_KIND[l.kind] ?? l.kind} · balance {formatPaise(l.balancePaise)}
                    </AppText>
                  </View>
                  <AppText variant="moneyMono" color={credit ? colors.okInk : colors.ink} style={{ fontSize: 13.5 }} forceLatin>
                    {credit ? "− " : "+ "}
                    {formatPaise(credit ? l.creditPaise : l.debitPaise)}
                  </AppText>
                </View>
              </RevealItem>
            );
          })}
        </View>
      )}
    </>
  );
}

/** A payment with no receipt yet: only a cheque waits on clearance; anything else waits on the office confirming it. */
function pendingLabel(p: Payment): string {
  return p.mode === "CHEQUE" ? "Cheque awaiting clearance" : `${PAYMENT_MODE_LABEL[p.mode]} payment awaiting confirmation`;
}

/** Receipts the society issued for this flat. Abandoned checkouts (never paid) aren't receipts and aren't listed. */
function Receipts({ payments }: { payments: Payment[] }) {
  const { colors } = useTheme();
  const shown = payments.filter((p) => p.receipt !== null || p.status === "PENDING");
  if (shown.length === 0) return <EmptyState iconPath={iconPaths.check} title="No receipts yet" body="A receipt is issued the moment a payment is confirmed." dashed />;
  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, overflow: "hidden" }}>
      {shown.map((p, i) => {
        const cancelled = p.receipt?.status === "CANCELLED" || p.status === "REVERSED";
        const date = p.receipt?.date ?? (p.paidAt ? istDate(p.paidAt) : istDate(p.createdAt));
        return (
          <View key={p.id} style={{ padding: 13, paddingHorizontal: 15, borderBottomWidth: i === shown.length - 1 ? 0 : 1, borderBottomColor: colors.borderSoft, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="cardTitle" style={{ fontSize: 13, marginBottom: 2 }} forceLatin>
                {p.receipt?.number ?? pendingLabel(p)}
              </AppText>
              <AppText variant="meta" color={colors.inkMuted}>
                {dayMonth(date)} · {PAYMENT_MODE_LABEL[p.mode]}
                {p.instrumentNo ? ` · ${p.instrumentNo}` : ""}
              </AppText>
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <AppText variant="moneyMono" color={cancelled ? colors.inkMuted : colors.ink} style={{ fontSize: 13.5, textDecorationLine: cancelled ? "line-through" : "none" }} forceLatin>
                {formatPaise(p.amountPaise)}
              </AppText>
              {cancelled ? <StatusPill label="Cancelled" bg={colors.badWash} fg={colors.badInk} /> : p.status === "PENDING" ? <StatusPill label="Pending" bg={colors.warnWash} fg={colors.warnInk} /> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
