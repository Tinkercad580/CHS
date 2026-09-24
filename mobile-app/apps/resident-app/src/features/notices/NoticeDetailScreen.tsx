import React from "react";
import { View } from "react-native";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { ScreenScroll } from "../../components/ScreenScroll";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { StatusPill } from "../../components/StatusPill";
import { Button } from "../../components/Button";
import { StaggerItem } from "../../components/StaggerItem";

const TAG_STYLE: Record<string, "bad" | "info" | "subtle"> = { Urgent: "bad", AGM: "info", Facility: "subtle", Billing: "subtle" };

export function NoticeDetailScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t, c, cList } = useT();
  const notice = state.notices.find((n) => n.id === state.activeNoticeId) ?? state.notices[0];
  if (!notice) return null;
  const kind = TAG_STYLE[notice.tag] ?? "subtle";
  const bg = kind === "bad" ? colors.badWash : kind === "info" ? colors.infoWash : colors.subtle;
  const fg = kind === "bad" ? colors.badInk : kind === "info" ? colors.infoInk : colors.inkSoft;
  const paragraphs = cList(notice.id, "body", notice.body.split("\n\n"));

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader title="Notice" onBack={actions.back} />
      <ScreenScroll>
        <View style={{ marginBottom: 12 }}>
          <StatusPill label={c(notice.id, "tag", notice.tag)} bg={bg} fg={fg} />
        </View>
        <AppText variant="sectionHeading" style={{ fontSize: 23, marginBottom: 8 }}>
          {c(notice.id, "title", notice.title)}
        </AppText>
        <AppText variant="meta" color={colors.inkMuted} style={{ marginBottom: 20 }}>
          Posted by Sanjay Patil, Secretary
        </AppText>
        <View style={{ gap: 14, marginBottom: 24 }}>
          {paragraphs.map((p, i) => (
            <StaggerItem key={i} index={i} tier="listRow">
              <AppText variant="body" color={colors.inkSoft}>
                {p}
              </AppText>
            </StaggerItem>
          ))}
        </View>
        {notice.ackable ? (
          <Button
            label={notice.acked ? t("acknowledged") : t("iHaveRead")}
            kind={notice.acked ? "ghost" : "primary"}
            onPress={actions.ackNotice}
            disabled={notice.acked}
            height={50}
            fontSize={15}
            weight={700}
          />
        ) : null}
      </ScreenScroll>
    </View>
  );
}
