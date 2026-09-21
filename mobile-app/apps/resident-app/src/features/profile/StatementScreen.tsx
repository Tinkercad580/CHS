import React from "react";
import { View } from "react-native";
import { formatInr, ledger as ledgerSeed, lateInterestMonthlyRate } from "@sahaj/shared";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { currentUnit, totalDue } from "../../state/selectors";
import { ScreenScroll } from "../../components/ScreenScroll";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";

export function StatementScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();
  const unit = currentUnit(state);
  const due = totalDue(state);
  const rows = ledgerSeed.filter((l) => l.unit === unit.code);
  const interestPerMonth = Math.round(due * lateInterestMonthlyRate);

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader title={t("statementTitle")} onBack={actions.back} />
      <ScreenScroll>
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface, padding: 18, marginBottom: 16 }}>
          <AppText variant="eyebrow" color={colors.inkMuted} forceLatin style={{ marginBottom: 9 }}>
            {t("closingBalance").toUpperCase()}
          </AppText>
          <AppText variant="moneyHeroSmall" color={due > 0 ? colors.warnInk : colors.okInk} style={{ marginBottom: 7 }} forceLatin>
            {formatInr(due)}
          </AppText>
          <AppText variant="bodySmall" color={colors.inkSoft}>
            {due > 0 ? t("payableByDate") : t("accountSettled")}
          </AppText>
        </View>

        <View style={{ borderWidth: 1, borderColor: colors.warnBorder, borderRadius: 15, backgroundColor: colors.warnWash, padding: 15, marginBottom: 18 }}>
          <AppText variant="cardTitle" color={colors.warnInk} style={{ fontSize: 13, marginBottom: 4 }}>
            {t("interestTitle")}
          </AppText>
          <AppText variant="bodySmall" color={colors.inkSoft}>
            {t("interestBody", { amount: formatInr(due), perMonth: formatInr(interestPerMonth) })}
          </AppText>
        </View>

        <AppText variant="cardTitle" color={colors.inkSoft} style={{ fontSize: 13, marginBottom: 11 }}>
          {t("thisYear")}
        </AppText>
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, overflow: "hidden", marginBottom: 18 }}>
          {rows.map((l, i) => (
            <View key={l.id} style={{ padding: 13, paddingHorizontal: 15, borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: colors.borderSoft, flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText variant="cardTitle" style={{ fontSize: 13.5, fontWeight: "500" as const, marginBottom: 2 }}>
                  {l.label}
                </AppText>
                <AppText variant="meta" color={colors.inkMuted}>
                  {l.when} · {l.note}
                </AppText>
              </View>
              <AppText variant="moneyMono" color={l.amount < 0 ? colors.okInk : l.kind === "interest" ? colors.badInk : colors.ink} style={{ fontSize: 13.5 }} forceLatin>
                {l.amount < 0 ? "− " : "+ "}
                {formatInr(Math.abs(l.amount))}
              </AppText>
            </View>
          ))}
        </View>

        <Button label={t("downloadPdf")} kind="secondary" onPress={actions.downloadStatement} />
      </ScreenScroll>
    </View>
  );
}
