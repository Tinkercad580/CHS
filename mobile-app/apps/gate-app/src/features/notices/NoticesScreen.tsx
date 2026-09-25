import React from "react";
import { View, ScrollView } from "react-native";
import type { NoticeRecord as Notice } from "@chs/contract";
import { GateText } from "../../components/GateText";
import { GateCard } from "../../components/GateCard";
import { GateButton } from "../../components/GateButton";
import { StatusPill } from "../../components/StatusPill";
import { ScreenHeader } from "../../components/ScreenHeader";
import { EmptyState } from "../../components/EmptyState";
import { LoadError } from "../../components/LoadError";
import { Skeleton } from "../../components/Skeleton";
import { RevealItem } from "../../components/RevealItem";
import { colors } from "../../theme";
import { useGate } from "../../state/GateProvider";
import { relativeLabel } from "../../utils/time";
import { NOTICE_CATEGORY_LABEL, isUnread, needsAck, useOfficeNotices } from "./useOfficeNotices";

/**
 * Notices from the society office — whatever it sent to staff, or to everyone.
 *
 * The gate design has no such screen (the prototype predates notices reaching
 * guards), so this is the smallest thing in the gate's own vocabulary: the
 * plate lookup's drill-down header, and log-style cards whose 3px edge carries
 * the state — stop for an emergency, go for one not yet opened.
 */
export function NoticesScreen() {
  const { actions } = useGate();
  const { feed, unread } = useOfficeNotices();

  let body: React.ReactNode;
  if (feed.status === "pending") {
    // A card: title row, two lines of body, the meta line — inside 14px padding.
    body = (
      <View style={{ gap: 9 }}>
        <Skeleton height={112} />
        <Skeleton height={112} />
        <Skeleton height={112} />
      </View>
    );
  } else if (feed.status === "error" && feed.items.length === 0) {
    body = <LoadError title="Couldn't load the notices" message={feed.error.message} onRetry={() => void feed.refetch()} retrying={feed.isRefetching} />;
  } else if (feed.items.length === 0) {
    body = <EmptyState title="Nothing from the office" detail="Notices the society office sends to staff will appear here." />;
  } else {
    body = (
      <View style={{ gap: 9 }}>
        {feed.items.map((n) => (
          <RevealItem key={n.id} tier="listRow">
            <NoticeCard notice={n} onPress={() => actions.openNotice(n.id)} />
          </RevealItem>
        ))}
        {feed.hasNextPage ? (
          <GateButton
            label={feed.isFetchingNextPage ? "Loading…" : "Show older notices"}
            variant="outline"
            height={48}
            fontSize={14.5}
            weight={600}
            radius={14}
            loading={feed.isFetchingNextPage}
            onPress={() => void feed.fetchNextPage()}
            style={{ marginTop: 4 }}
          />
        ) : null}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 24 }}>
      <RevealItem tier="screenBlock">
        <ScreenHeader title="From the office" onBack={() => actions.goBack()} />
        <GateText variant="bodySmall" color={colors.soft} style={{ marginBottom: 16 }}>
          Notices from the society office. Open one to mark it read; some ask you to confirm you have read them.
        </GateText>
        {feed.status === "success" && feed.items.length > 0 ? (
          <GateText variant="label" color={colors.soft} style={{ marginBottom: 11 }}>
            {unread > 0 ? `${unread} not opened yet` : "All read"}
          </GateText>
        ) : null}
      </RevealItem>
      <RevealItem tier="screenBlock">{body}</RevealItem>
    </ScrollView>
  );
}

function NoticeCard({ notice: n, onPress }: { notice: Notice; onPress: () => void }) {
  const emergency = n.category === "EMERGENCY";
  const unread = isUnread(n);
  const ack = needsAck(n);
  const edge = emergency ? colors.stop : unread ? colors.go : undefined;
  const pill = emergency ? { label: "EMERGENCY", color: colors.stop } : ack ? { label: "CONFIRM READ", color: colors.hold } : unread ? { label: "NEW", color: colors.go } : null;
  const meta = [NOTICE_CATEGORY_LABEL[n.category], n.pinned ? "Pinned" : null, n.publishedAt ? relativeLabel(n.publishedAt) : null].filter(Boolean).join(" · ");

  return (
    <GateCard edgeColor={edge} onPress={onPress}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
        <GateText variant="cardTitle" color={unread ? colors.ink : colors.soft} style={{ flex: 1, fontSize: 14.5 }} numberOfLines={2}>
          {n.title}
        </GateText>
        {pill ? <StatusPill label={pill.label} color={pill.color} /> : null}
      </View>
      <GateText variant="body" color={colors.soft} style={{ fontSize: 12.5, lineHeight: 18.5, marginBottom: 8 }} numberOfLines={2}>
        {n.body}
      </GateText>
      <GateText variant="meta" color={colors.dim}>
        {meta}
      </GateText>
    </GateCard>
  );
}
