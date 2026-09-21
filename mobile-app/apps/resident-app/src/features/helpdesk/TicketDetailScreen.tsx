import React from "react";
import { View } from "react-native";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { ScreenScroll } from "../../components/ScreenScroll";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";

const STATE_LABEL: Record<string, string> = { open: "Open", in_progress: "In progress", resolved: "Resolved" };

export function TicketDetailScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t, c } = useT();
  const ticket = state.tickets.find((tk) => tk.id === state.activeTicketId) ?? state.tickets[0];
  if (!ticket) return null;
  const label = c(ticket.id, "state", STATE_LABEL[ticket.status]);
  const bg = ticket.status === "resolved" ? colors.okWash : ticket.status === "open" ? colors.warnWash : colors.infoWash;
  const fg = ticket.status === "resolved" ? colors.okInk : ticket.status === "open" ? colors.warnInk : colors.infoInk;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader
        title={ticket.id}
        onBack={actions.back}
        right={
          <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7, backgroundColor: bg }}>
            <AppText variant="cardTitle" color={fg} style={{ fontSize: 11 }}>
              {label}
            </AppText>
          </View>
        }
      />
      <ScreenScroll>
        <AppText variant="cardTitleLarge" style={{ fontSize: 20, marginBottom: 6 }}>
          {c(ticket.id, "title", ticket.title)}
        </AppText>
        <AppText variant="bodySmall" color={colors.inkSoft} style={{ marginBottom: 22 }}>
          {ticket.category} · raised {ticket.createdAt}
        </AppText>

        <View>
          {ticket.timeline.map((step, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 14 }}>
              <View style={{ alignItems: "center", width: 22 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent, marginTop: 4 }} />
                {i < ticket.timeline.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: colors.border, minHeight: 18 }} /> : null}
              </View>
              <View style={{ paddingBottom: 20, flex: 1 }}>
                <AppText variant="cardTitle" style={{ fontSize: 13.5, marginBottom: 3 }}>
                  {step.note.split(" — ")[0]}
                </AppText>
                <AppText variant="bodySmall" color={colors.inkSoft} style={{ marginBottom: 3 }}>
                  {step.note.split(" — ").slice(1).join(" — ")}
                </AppText>
                <AppText variant="meta" color={colors.inkMuted}>
                  {step.at}
                </AppText>
              </View>
            </View>
          ))}
        </View>

        {ticket.status !== "resolved" ? <Button label={t("markResolved")} kind="secondary" onPress={actions.resolveTicket} /> : null}
      </ScreenScroll>
    </View>
  );
}
