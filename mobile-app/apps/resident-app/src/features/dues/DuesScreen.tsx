import React from "react";
import { View } from "react-native";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { currentUnit } from "../../state/selectors";
import { istDate, settlingPayment, useUnitBills, useUnitId, useUnitPayments, type Bill } from "../../api/billing";
import { ScreenScroll } from "../../components/ScreenScroll";
import { TitleHeader } from "../../components/ScreenHeader";
import { FilterPill } from "../../components/FilterPill";
import { EmptyState } from "../../components/EmptyState";
import { LoadError } from "../../components/LoadError";
import { Skeleton } from "../../components/Skeleton";
import { iconPaths } from "../../components/iconPaths";
import { BillCard } from "./BillCard";
import { Button } from "../../components/Button";
import { RevealItem } from "../../components/RevealItem";

/**
 * Every bill of the unit being viewed, newest first (billing.myBills). The
 * filter runs over the bills already loaded — paid/unpaid is a view, not a
 * refetch — and each settled bill is dated by the payment that settled it.
 */
export function DuesScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();
  const unit = currentUnit(state);
  const { unitId, loading: waitingForUnit } = useUnitId(unit.code);
  const bills = useUnitBills(unitId);
  const payments = useUnitPayments(unitId).data?.items;

  const shown = bills.items.filter((b) => visible(b, state.dueFilter));

  let body: React.ReactNode;
  if (waitingForUnit || (unitId && bills.status === "pending")) {
    body = (
      <View style={{ gap: 11 }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={96} radius={15} />
        ))}
      </View>
    );
  } else if (bills.status === "error") {
    body = <LoadError title="Couldn't load your bills" message={bills.error?.message ?? "Something went wrong."} onRetry={() => void bills.refetch()} />;
  } else if (!unitId || bills.items.length === 0) {
    body = <EmptyState iconPath={iconPaths.dues} title="No bills yet" body={`Bills for ${unit.code} appear here once the society publishes them.`} dashed />;
  } else if (shown.length === 0) {
    body =
      state.dueFilter === "paid" ? (
        <EmptyState iconPath={iconPaths.dues} title="No paid bills yet" body="Bills you settle move here, with their receipts." dashed />
      ) : (
        <EmptyState iconPath={iconPaths.check} title={t("nothingOutstanding")} body={t("nothingOutstandingSub")} dashed />
      );
  } else {
    body = (
      <View style={{ gap: 11 }}>
        {shown.map((b) => {
          const paidAt = settlingPayment(payments, b.id)?.paidAt;
          return (
            <RevealItem key={b.id} tier="listRow">
              <BillCard bill={b} paidOn={paidAt ? istDate(paidAt) : null} onPress={() => actions.openBill(b.id)} />
            </RevealItem>
          );
        })}
        {bills.hasNextPage ? (
          <Button
            label={bills.isFetchingNextPage ? "Loading…" : "Show older bills"}
            kind="secondary"
            loading={bills.isFetchingNextPage}
            onPress={() => void bills.fetchNextPage()}
            height={46}
            fontSize={14}
            weight={600}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <TitleHeader
        title={t("duesTitle")}
        subtitle={unit.line}
        right={
          <Button label={t("statement")} onPress={actions.goStatement} kind="secondary" height={40} fontSize={13} weight={600} style={{ paddingHorizontal: 14 }} />
        }
      />
      <ScreenScroll>
        <RevealItem tier="screenBlock" style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          <FilterPill label={t("filterAll")} active={state.dueFilter === "all"} onPress={() => actions.setDueFilter("all")} />
          <FilterPill label={t("filterUnpaid")} active={state.dueFilter === "unpaid"} onPress={() => actions.setDueFilter("unpaid")} />
          <FilterPill label={t("filterPaid")} active={state.dueFilter === "paid"} onPress={() => actions.setDueFilter("paid")} />
        </RevealItem>
        {body}
      </ScreenScroll>
    </View>
  );
}

function visible(bill: Bill, filter: "all" | "unpaid" | "paid"): boolean {
  if (filter === "unpaid") return bill.balancePaise > 0 && bill.paymentState !== "CANCELLED";
  if (filter === "paid") return bill.paymentState === "PAID";
  return true;
}
