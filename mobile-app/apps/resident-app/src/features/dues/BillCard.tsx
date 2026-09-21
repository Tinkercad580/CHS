import React from "react";
import { Pressable, View } from "react-native";
import type { Bill } from "@sahaj/shared";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { AppText } from "../../components/AppText";
import { StatusPill } from "../../components/StatusPill";

/** A bill row card with a 3px status edge — README's "warn unpaid, ok paid". */
export function BillCard({ bill, amount, onPress }: { bill: Bill; amount: string; onPress: () => void }) {
  const { colors } = useTheme();
  const { t, c } = useT();
  const paid = bill.status === "paid";
  const edge = paid ? colors.ok : colors.warn;

  return (
    <Pressable
      onPress={onPress}
      style={{ borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3, borderLeftColor: edge, borderRadius: 15, backgroundColor: colors.surface, padding: 15 }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="cardTitle" style={{ marginBottom: 3 }}>
            {c(bill.id, "title", bill.title)}
          </AppText>
          <AppText variant="meta" color={colors.inkSoft}>
            {c(bill.id, "period", bill.period)}
          </AppText>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <AppText variant="moneyMono" forceLatin>
            {amount}
          </AppText>
          <AppText variant="cardTitle" color={paid ? colors.okInk : colors.warnInk} style={{ fontSize: 11 }}>
            {paid ? t("paid") : t("unpaid")}
          </AppText>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <StatusPill label={c(bill.id, "tag", bill.category)} bg={paid ? colors.okWash : colors.subtle} fg={paid ? colors.okInk : colors.inkSoft} />
        <AppText variant="meta" color={colors.inkMuted}>
          {paid ? t("settledOn", { date: bill.paidOn ? new Date(bill.paidOn).toLocaleDateString("en-IN") : "" }) : "Due 17 Sep"}
        </AppText>
      </View>
    </Pressable>
  );
}
