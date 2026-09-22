import React from "react";
import { View } from "react-native";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { unreadNoticeCount } from "../../state/selectors";
import { ScreenScroll } from "../../components/ScreenScroll";
import { TitleHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { StatusPill } from "../../components/StatusPill";
import { AnimatedPressable } from "../../components/AnimatedPressable";
import { StaggerItem } from "../../components/StaggerItem";

const TAG_STYLE: Record<string, "bad" | "info" | "subtle"> = { urgent: "bad", agm: "info", facility: "subtle", billing: "subtle" };

export function NoticesScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t, c, num } = useT();
  const unread = unreadNoticeCount(state);

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <TitleHeader title={t("noticesTitle")} subtitle={t("unreadOf", { n: unread, total: num(state.notices.length) })} />
      <ScreenScroll>
        <View style={{ gap: 11 }}>
          {state.notices.map((n, i) => {
            const kind = TAG_STYLE[n.tag] ?? "subtle";
            const bg = kind === "bad" ? colors.badWash : kind === "info" ? colors.infoWash : colors.subtle;
            const fg = kind === "bad" ? colors.badInk : kind === "info" ? colors.infoInk : colors.inkSoft;
            return (
              <StaggerItem key={n.id} index={i} tier="listRow">
              <AnimatedPressable
                onPress={() => actions.openNotice(n.id)}
                style={{ borderWidth: 1, borderColor: n.unread ? colors.accent200 : colors.border, borderRadius: 16, backgroundColor: colors.surface, padding: 15 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 7 }}>
                  <StatusPill label={c(n.id, "tag", n.tag).toUpperCase()} bg={bg} fg={fg} />
                  <AppText variant="meta" color={colors.inkMuted}>
                    {c(n.id, "when", n.postedAt)}
                  </AppText>
                  {n.unread ? <View style={{ marginLeft: "auto", width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} /> : null}
                </View>
                <AppText variant="cardTitle" style={{ fontSize: 14.5, marginBottom: 4 }}>
                  {c(n.id, "title", n.title)}
                </AppText>
                <AppText variant="bodySmall" color={colors.inkSoft}>
                  {c(n.id, "blurb", n.blurb)}
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
