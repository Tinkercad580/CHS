import React from "react";
import { View } from "react-native";
import { formatInr } from "@sahaj/shared";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { currentUnit, visibleBills } from "../../state/selectors";
import { ScreenScroll } from "../../components/ScreenScroll";
import { TitleHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { FilterPill } from "../../components/FilterPill";
import { Skeleton } from "../../components/Skeleton";
import { EmptyState } from "../../components/EmptyState";
import { iconPaths } from "../../components/iconPaths";
import { BillCard } from "./BillCard";
import { Button } from "../../components/Button";
import { StaggerItem } from "../../components/StaggerItem";

export function DuesScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();
  const unit = currentUnit(state);
  const bills = visibleBills(state);

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
        <StaggerItem index={0} tier="screenBlock" style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          <FilterPill label={t("filterAll")} active={state.dueFilter === "all"} onPress={() => actions.setDueFilter("all")} />
          <FilterPill label={t("filterUnpaid")} active={state.dueFilter === "unpaid"} onPress={() => actions.setDueFilter("unpaid")} />
          <FilterPill label={t("filterPaid")} active={state.dueFilter === "paid"} onPress={() => actions.setDueFilter("paid")} />
        </StaggerItem>

        {state.duesLoading ? (
          <View style={{ gap: 11 }}>
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </View>
        ) : bills.length === 0 ? (
          <EmptyState iconPath={iconPaths.check} title={t("nothingOutstanding")} body={t("nothingOutstandingSub")} dashed />
        ) : (
          <View style={{ gap: 11 }}>
            {bills.map((b, i) => (
              <StaggerItem key={b.id} index={i} tier="listRow">
                <BillCard bill={b} amount={formatInr(b.amount)} onPress={() => actions.openBill(b.id)} />
              </StaggerItem>
            ))}
          </View>
        )}
      </ScreenScroll>
    </View>
  );
}
