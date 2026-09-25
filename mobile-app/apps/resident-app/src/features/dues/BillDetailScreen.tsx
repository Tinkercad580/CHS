import React from "react";
import { View } from "react-native";
import { api } from "@chs/contract";
import { toLoadState, useApiQuery } from "@chs/api-client/react";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { billTone, dateTime, duesForUnit, formatPaise, longDate, periodRange, settlingPayment, useMyDues, useSocietyId, useUnitPayments, type Bill, type Dues } from "../../api/billing";
import { ScreenScroll } from "../../components/ScreenScroll";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { RevealItem } from "../../components/RevealItem";
import { Skeleton } from "../../components/Skeleton";
import { LoadError } from "../../components/LoadError";

/**
 * One bill, head by head, each line with the basis the society billed it on
 * ("3 inlets × ₹140", "10% of Service charges (₹1,800.00)", the interest
 * line's days and rate) — billing.bill. Paying from here pays everything due
 * on the bill's flat, since the society applies money to the oldest dues first.
 */
export function BillDetailScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const societyId = useSocietyId();
  const billId = state.activeBillId ?? "";
  const query = toLoadState(useApiQuery(api.billing.bill, { params: { societyId, billId } }, { enabled: billId !== "" && societyId !== "" }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader title={query.status === "ready" ? query.data.title : "Bill"} onBack={actions.back} />
      <ScreenScroll>
        {query.status === "loading" ? (
          <View style={{ gap: 16 }}>
            <Skeleton height={124} radius={18} />
            <Skeleton height={420} radius={16} />
          </View>
        ) : query.status === "error" ? (
          <LoadError title="Couldn't load this bill" message={query.message} onRetry={query.retry} />
        ) : (
          <BillBody bill={query.data} />
        )}
      </ScreenScroll>
    </View>
  );
}

function BillBody({ bill }: { bill: Bill }) {
  const { actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();
  const dues = useMyDues();
  const payments = useUnitPayments(bill.unitId).data?.items;
  const unitDues: Dues | undefined = dues.status === "ready" ? duesForUnit(dues.data, bill.unitLabel) : undefined;
  const tone = billTone(bill);
  const open = bill.balancePaise > 0 && bill.paymentState !== "CANCELLED";
  const settled = settlingPayment(payments, bill.id);
  // Everything due on the flat, as its dues card has it; the bill's own balance if the card hasn't loaded or disagrees.
  const payPaise = unitDues && unitDues.totalDuePaise > 0 ? unitDues.totalDuePaise : bill.balancePaise;
  const coversMore = payPaise > bill.balancePaise;

  const headline = open ? bill.balancePaise : bill.totalPaise;
  const cover = bill.kind === "REGULAR" ? periodRange(bill.period) : longDate(bill.billDate);
  const when =
    bill.paymentState === "CANCELLED"
      ? `Cancelled${bill.cancelReason ? ` — ${bill.cancelReason}` : ""}`
      : !open
        ? settled?.paidAt
          ? `Settled on ${dateTime(settled.paidAt)}`
          : "Settled"
        : tone === "overdue"
          ? `Was due ${longDate(bill.dueDate)} · ${cover}`
          : `Payable by ${longDate(bill.dueDate)} · ${cover}`;

  return (
    <>
      <Card padding={20} style={{ marginBottom: 16 }}>
        <AppText variant="eyebrow" color={colors.inkMuted} forceLatin style={{ marginBottom: 8 }}>
          {(open ? t("totalPayable") : t("total")).toUpperCase()}
        </AppText>
        <AppText variant="moneyHeroSmall" style={{ marginBottom: 6 }} forceLatin>
          {formatPaise(headline)}
        </AppText>
        <AppText variant="bodySmall" color={tone === "overdue" && open ? colors.badInk : colors.inkSoft}>
          {when}
        </AppText>
        {bill.number ? (
          <AppText variant="meta" color={colors.inkMuted} style={{ marginTop: 6 }} forceLatin>
            {bill.number} · {bill.unitLabel}
          </AppText>
        ) : null}
      </Card>

      <AppText variant="cardTitle" color={colors.inkSoft} style={{ fontSize: 13, marginBottom: 10 }}>
        {t("whatThisCovers")}
      </AppText>
      <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, overflow: "hidden", marginBottom: 16 }}>
        {bill.lines.map((line, i) => (
          <RevealItem key={`${line.code}-${i}`} tier="listRow">
            <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: colors.borderSoft, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText variant="cardTitle" style={{ fontSize: 13.5, fontWeight: "500" as const }}>
                  {line.label}
                </AppText>
                {line.basis ? (
                  <AppText variant="meta" color={colors.inkMuted}>
                    {line.basis}
                  </AppText>
                ) : null}
              </View>
              <AppText variant="cardTitle" color={line.kind === "INTEREST" ? colors.badInk : colors.ink} style={{ fontSize: 13.5 }} forceLatin>
                {line.amountPaise < 0 ? `− ${formatPaise(-line.amountPaise)}` : formatPaise(line.amountPaise)}
              </AppText>
            </View>
          </RevealItem>
        ))}
        <View style={{ padding: 14, backgroundColor: colors.subtle, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <AppText variant="cardTitle" style={{ fontSize: 13.5 }}>
            {t("total")}
          </AppText>
          <AppText variant="moneyMono" style={{ fontSize: 15 }} forceLatin>
            {formatPaise(bill.totalPaise)}
          </AppText>
        </View>
        {bill.paidPaise > 0 && open ? (
          <>
            <SumRow label="Paid so far" value={`− ${formatPaise(bill.paidPaise)}`} ink={colors.okInk} />
            <SumRow label="Balance" value={formatPaise(bill.balancePaise)} />
          </>
        ) : null}
      </View>

      {open && bill.arrearsPaise > 0 ? (
        <View style={{ borderWidth: 1, borderColor: colors.warnBorder, borderRadius: 15, backgroundColor: colors.warnWash, padding: 15, marginBottom: 16 }}>
          <AppText variant="cardTitle" color={colors.warnInk} style={{ fontSize: 13, marginBottom: 4 }}>
            {formatPaise(bill.arrearsPaise)} unpaid from earlier bills
          </AppText>
          <AppText variant="bodySmall" color={colors.inkSoft}>
            {bill.interestPaise > 0 ? "Not part of this bill's total, but still due — the interest line above is charged on it." : "Not part of this bill's total, but still due."}
          </AppText>
        </View>
      ) : null}

      {!open ? (
        bill.paymentState === "CANCELLED" ? null : (
          <View style={{ borderWidth: 1, borderColor: colors.okWash, borderRadius: 14, backgroundColor: colors.okWash, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: colors.ok, alignItems: "center", justifyContent: "center" }}>
              <Icon d={iconPaths.check} size={18} color="#FFFFFF" strokeWidth={3} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="cardTitle" color={colors.okInk} style={{ fontSize: 13.5 }}>
                {settled?.paidAt ? t("settledOn", { date: dateTime(settled.paidAt) }) : "Settled"}
              </AppText>
              {settled?.receipt ? (
                <AppText variant="bodySmall" color={colors.inkSoft} forceLatin>
                  {t("receiptLabel", { n: settled.receipt.number })}
                </AppText>
              ) : null}
            </View>
          </View>
        )
      ) : (
        <>
          <Button
            label={t("payAmount", { amount: formatPaise(payPaise) })}
            loading={dues.status === "loading"}
            onPress={() =>
              actions.openPay({
                unitId: bill.unitId,
                unitLabel: bill.unitLabel,
                amountPaise: payPaise,
                title: coversMore ? `All dues for ${bill.unitLabel}` : bill.title,
              })
            }
          />
          <AppText variant="bodySmall" color={colors.inkMuted} style={{ textAlign: "center", marginTop: 11 }}>
            {coversMore ? `Clears everything due on ${bill.unitLabel}, oldest bill first. ` : ""}
            {t("receiptNote")}
          </AppText>
        </>
      )}
    </>
  );
}

function SumRow({ label, value, ink }: { label: string; value: string; ink?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ padding: 14, paddingTop: 0, backgroundColor: colors.subtle, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <AppText variant="bodySmall" color={colors.inkSoft}>
        {label}
      </AppText>
      <AppText variant="moneyMono" color={ink ?? colors.ink} style={{ fontSize: 13.5 }} forceLatin>
        {value}
      </AppText>
    </View>
  );
}
