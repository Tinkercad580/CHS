import React from "react";
import { View } from "react-native";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { currentUnit, openTicketCount } from "../../state/selectors";
import { ScreenScroll } from "../../components/ScreenScroll";
import { TitleHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { AnimatedPressable } from "../../components/AnimatedPressable";
import { StaggerItem } from "../../components/StaggerItem";

const STATE_LABEL: Record<string, string> = { open: "Open", in_progress: "In progress", resolved: "Resolved" };

export function HelpdeskScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t, c } = useT();
  const unit = currentUnit(state);
  const tickets = state.tickets.filter((tk) => tk.unit === unit.code);

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <TitleHeader
        title={t("helpdeskTitle")}
        subtitle={t("openOfTotal", { open: openTicketCount(state), total: tickets.length })}
        right={<Button label={t("raise")} onPress={actions.goNewTicket} height={40} fontSize={13.5} weight={600} style={{ paddingHorizontal: 15 }} />}
      />
      <ScreenScroll>
        <View style={{ gap: 11 }}>
          {tickets.map((tk, i) => {
            const label = c(tk.id, "state", STATE_LABEL[tk.status]);
            const bg = tk.status === "resolved" ? colors.okWash : tk.status === "open" ? colors.warnWash : colors.infoWash;
            const fg = tk.status === "resolved" ? colors.okInk : tk.status === "open" ? colors.warnInk : colors.infoInk;
            return (
              <StaggerItem key={tk.id} index={i} tier="listRow">
                <AnimatedPressable onPress={() => actions.openTicket(tk.id)} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, padding: 15 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <AppText variant="eyebrow" color={colors.inkMuted} forceLatin>
                      {tk.id}
                    </AppText>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: bg }}>
                      <AppText variant="statusPill" color={fg}>
                        {label.toUpperCase()}
                      </AppText>
                    </View>
                    <AppText variant="meta" color={colors.inkMuted} style={{ marginLeft: "auto" }}>
                      {tk.createdAt}
                    </AppText>
                  </View>
                  <AppText variant="cardTitle" style={{ fontSize: 14.5, marginBottom: 4 }}>
                    {c(tk.id, "title", tk.title)}
                  </AppText>
                  <AppText variant="bodySmall" color={colors.inkSoft}>
                    {c(tk.id, "lastUpdate", tk.lastUpdate)}
                  </AppText>
                </AnimatedPressable>
              </StaggerItem>
            );
          })}
        </View>
      </ScreenScroll>
    </View>
  );
}
