import React from "react";
import { View } from "react-native";
import { toLoadState } from "@chs/api-client/react";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { timeAgo } from "../../api/billing";
import { isUnread, noticeBlurb, noticeTag, noticeTagTone, useNoticeFeed, type Notice } from "../../api/notices";
import { ScreenScroll } from "../../components/ScreenScroll";
import { TitleHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { StatusPill } from "../../components/StatusPill";
import { AnimatedPressable } from "../../components/AnimatedPressable";
import { RevealItem } from "../../components/RevealItem";
import { Skeleton } from "../../components/Skeleton";
import { LoadError } from "../../components/LoadError";
import { EmptyState } from "../../components/EmptyState";
import { iconPaths } from "../../components/iconPaths";

/** Notices sent to this resident (notices.feed) — pinned first, then newest; an unread one keeps the accent border and dot. */
export function NoticesScreen() {
  const { actions } = useResident();
  const { colors } = useTheme();
  const { t, num } = useT();
  const feed = toLoadState(useNoticeFeed());
  const items = feed.status === "ready" ? feed.data.items : [];
  const unread = items.filter(isUnread).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <TitleHeader title={t("noticesTitle")} subtitle={feed.status === "ready" ? t("unreadOf", { n: num(unread), total: num(items.length) }) : " "} />
      <ScreenScroll>
        {feed.status === "loading" ? (
          <View style={{ gap: 11 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={112} radius={16} />
            ))}
          </View>
        ) : feed.status === "error" ? (
          <LoadError title="Couldn't load notices" message={feed.message} onRetry={feed.retry} />
        ) : items.length === 0 ? (
          <EmptyState iconPath={iconPaths.notices} title="No notices yet" body="Anything the committee posts will show here." dashed />
        ) : (
          <View style={{ gap: 11 }}>
            {items.map((n) => (
              <RevealItem key={n.id} tier="listRow">
                <NoticeCard notice={n} onPress={() => actions.openNotice(n.id)} />
              </RevealItem>
            ))}
          </View>
        )}
      </ScreenScroll>
    </View>
  );
}

function NoticeCard({ notice, onPress }: { notice: Notice; onPress: () => void }) {
  const { colors } = useTheme();
  const tag = noticeTag(notice);
  const tone = noticeTagTone(tag);
  const bg = tone === "bad" ? colors.badWash : tone === "info" ? colors.infoWash : colors.subtle;
  const fg = tone === "bad" ? colors.badInk : tone === "info" ? colors.infoInk : colors.inkSoft;
  const unread = isUnread(notice);
  const needsAck = notice.ackRequired && notice.mine !== null && !notice.mine.acknowledged;

  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${tag}${notice.pinned ? ", pinned" : ""}${unread ? ", unread" : ""}: ${notice.title}`}
      style={{ borderWidth: 1, borderColor: unread ? colors.accent200 : colors.border, borderRadius: 16, backgroundColor: colors.surface, padding: 15 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 7 }}>
        <StatusPill label={tag} bg={bg} fg={fg} />
        {notice.pinned ? <StatusPill label="Pinned" bg={colors.accentWash} fg={colors.accentInk} /> : null}
        {notice.publishedAt ? (
          <AppText variant="meta" color={colors.inkMuted}>
            {timeAgo(notice.publishedAt)}
          </AppText>
        ) : null}
        {unread ? <View style={{ marginLeft: "auto", width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} /> : null}
      </View>
      <AppText variant="cardTitle" style={{ fontSize: 14.5, marginBottom: 4 }}>
        {notice.title}
      </AppText>
      <AppText variant="bodySmall" color={colors.inkSoft}>
        {noticeBlurb(notice.body)}
      </AppText>
      {needsAck ? (
        <AppText variant="meta" color={colors.warnInk} style={{ marginTop: 8 }}>
          Needs your acknowledgement
        </AppText>
      ) : null}
    </AnimatedPressable>
  );
}
