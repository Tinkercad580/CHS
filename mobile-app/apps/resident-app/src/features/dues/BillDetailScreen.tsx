import React from "react";
import { View } from "react-native";
import { formatInr } from "@sahaj/shared";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { activeBill } from "../../state/selectors";
import { ScreenScroll } from "../../components/ScreenScroll";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";

export function BillDetailScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t, c } = useT();
  const bill = activeBill(state);
  if (!bill) return null;
  const paid = bill.status === "paid";

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader title={c(bill.id, "title", bill.title)} onBack={actions.back} />
      <ScreenScroll>
        <Card padding={20} style={{ marginBottom: 16 }}>
          <AppText variant="eyebrow" color={colors.inkMuted} forceLatin style={{ marginBottom: 8 }}>
            {t("totalPayable").toUpperCase()}
          </AppText>
          <AppText variant="moneyHeroSmall" style={{ marginBottom: 6 }} forceLatin>
            {formatInr(bill.amount)}
          </AppText>
          <AppText variant="bodySmall" color={colors.inkSoft}>
            {paid ? t("settledOn", { date: bill.paidOn ? new Date(bill.paidOn).toLocaleDateString("en-IN") : "" }) : `Payable by 17 September 2026 · ${c(bill.id, "period", bill.period)}`}
          </AppText>
        </Card>

        <AppText variant="cardTitle" color={colors.inkSoft} style={{ fontSize: 13, marginBottom: 10 }}>
          {t("whatThisCovers")}
        </AppText>
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, overflow: "hidden", marginBottom: 16 }}>
          {bill.lineItems.map((line, i) => (
            <View
              key={line.label + i}
              style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: colors.borderSoft, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}
            >
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
              <AppText variant="cardTitle" style={{ fontSize: 13.5 }} forceLatin>
                {formatInr(line.amount)}
              </AppText>
            </View>
          ))}
          <View style={{ padding: 14, backgroundColor: colors.subtle, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <AppText variant="cardTitle" style={{ fontSize: 13.5 }}>
              {t("total")}
            </AppText>
            <AppText variant="moneyMono" style={{ fontSize: 15 }} forceLatin>
              {formatInr(bill.amount)}
            </AppText>
          </View>
        </View>

        {paid ? (
          <View style={{ borderWidth: 1, borderColor: colors.okWash, borderRadius: 14, backgroundColor: colors.okWash, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: colors.ok, alignItems: "center", justifyContent: "center" }}>
              <Icon d={iconPaths.check} size={18} color="#FFFFFF" strokeWidth={3} />
            </View>
            <View>
              <AppText variant="cardTitle" color={colors.okInk} style={{ fontSize: 13.5 }}>
                {t("settledOn", { date: bill.paidOn ? new Date(bill.paidOn).toLocaleDateString("en-IN") : "" })}
              </AppText>
              <AppText variant="bodySmall" color={colors.inkSoft}>
                {t("receiptLabel", { n: bill.receiptNo ?? "" })}
              </AppText>
            </View>
          </View>
        ) : (
          <>
            <Button label={t("payAmount", { amount: formatInr(bill.amount) })} onPress={actions.openPay} />
            <AppText variant="bodySmall" color={colors.inkMuted} style={{ textAlign: "center", marginTop: 11 }}>
              {t("receiptNote")}
            </AppText>
          </>
        )}
      </ScreenScroll>
    </View>
  );
}
