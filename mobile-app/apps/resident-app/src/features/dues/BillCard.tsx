import React from "react";
import { View } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { AppText } from "../../components/AppText";
import { StatusPill } from "../../components/StatusPill";
import { AnimatedPressable } from "../../components/AnimatedPressable";
import { BILL_STATE_LABEL, billTag, billTone, dayMonth, dueWhen, formatPaise, periodRange, type Bill } from "../../api/billing";

/**
 * A bill row card with a 3px status edge — README's "warn unpaid, ok paid",
 * and bad once it is past its due date. An open bill shows what is left to pay
 * on it; a settled one, what it was for. `paidOn` is the settling payment's
 * date when the receipts have loaded.
 */
export function BillCard({ bill, paidOn, onPress }: { bill: Bill; paidOn?: string | null; onPress: () => void }) {
  const { colors } = useTheme();
  const tone = billTone(bill);
  const edge = tone === "paid" ? colors.ok : tone === "overdue" ? colors.bad : colors.warn;
  const ink = tone === "paid" ? colors.okInk : tone === "overdue" ? colors.badInk : colors.warnInk;
  const amount = tone === "paid" ? bill.totalPaise : bill.balancePaise;
  const when =
    bill.paymentState === "CANCELLED"
      ? "Cancelled"
      : tone === "paid"
        ? paidOn
          ? `Paid ${dayMonth(paidOn)}`
          : "Settled"
        : bill.paymentState === "PARTLY_PAID"
          ? `${formatPaise(bill.paidPaise)} paid · ${dueWhen(bill.dueDate)}`
          : dueWhen(bill.dueDate);

  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${bill.title}, ${formatPaise(amount)}, ${BILL_STATE_LABEL[bill.paymentState]}`}
      style={{ borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3, borderLeftColor: edge, borderRadius: 15, backgroundColor: colors.surface, padding: 15 }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="cardTitle" style={{ marginBottom: 3 }}>
            {bill.title}
          </AppText>
          <AppText variant="meta" color={colors.inkSoft}>
            {bill.kind === "REGULAR" ? periodRange(bill.period) : dayMonth(bill.billDate)}
          </AppText>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <AppText variant="moneyMono" forceLatin>
            {formatPaise(amount)}
          </AppText>
          <AppText variant="cardTitle" color={ink} style={{ fontSize: 11 }}>
            {BILL_STATE_LABEL[bill.paymentState]}
          </AppText>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <StatusPill label={billTag(bill)} bg={tone === "paid" ? colors.okWash : colors.subtle} fg={tone === "paid" ? colors.okInk : colors.inkSoft} />
        <AppText variant="meta" color={tone === "overdue" ? colors.badInk : colors.inkMuted}>
          {when}
        </AppText>
      </View>
    </AnimatedPressable>
  );
}
