import React, { useEffect, useRef } from "react";
import { View, ScrollView } from "react-native";
import { api } from "@chs/contract";
import { useApiMutation, useApiQuery, toLoadState } from "@chs/api-client/react";
import { GateText } from "../../components/GateText";
import { GateButton } from "../../components/GateButton";
import { StatusPill } from "../../components/StatusPill";
import { ScreenHeader } from "../../components/ScreenHeader";
import { LoadError } from "../../components/LoadError";
import { Skeleton } from "../../components/Skeleton";
import { RevealItem } from "../../components/RevealItem";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { colors, withAlpha } from "../../theme";
import { useGate } from "../../state/GateProvider";
import { useGuard } from "../../api/guard";
import { splitError } from "../../api/errors";
import { NOTICE_CATEGORY_LABEL } from "./useOfficeNotices";

function publishedLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/**
 * One notice. Opening it records the read (`notices.markRead`, once, only for a
 * recipient who hasn't); a notice that asks for it gets "I have read this"
 * (`notices.acknowledge`), which is the society's proof the guard was told.
 */
export function NoticeScreen({ noticeId }: { noticeId: string }) {
  const { actions } = useGate();
  const { societyId } = useGuard();
  const params = { societyId, noticeId };
  const query = useApiQuery(api.notices.get, { params });
  const notice = toLoadState(query);
  const markRead = useApiMutation(api.notices.markRead);
  const acknowledge = useApiMutation(api.notices.acknowledge, {
    onSuccess: () => actions.toast("Marked as read. The office can see you confirmed it.", "ok"),
    onError: (err) => actions.toast(splitError(err).message ?? "Could not confirm. Try again.", "warn"),
  });

  const marked = useRef<string | null>(null);
  const data = query.data;
  useEffect(() => {
    if (!data?.mine || data.mine.read || marked.current === data.id) return;
    marked.current = data.id;
    // A failed read receipt costs nothing on screen; the next open tries again.
    markRead.mutate({ params: { societyId, noticeId: data.id } }, { onError: () => (marked.current = null) });
  }, [data, societyId, markRead]);

  let body: React.ReactNode;
  if (notice.status === "loading") {
    body = (
      <View>
        <View style={{ width: 110, marginBottom: 12 }}>
          <Skeleton height={22} borderRadius={8} />
        </View>
        <View style={{ width: "80%", marginBottom: 18 }}>
          <Skeleton height={26} borderRadius={8} />
        </View>
        <Skeleton height={180} />
      </View>
    );
  } else if (notice.status === "error") {
    body = <LoadError title="Couldn't open this notice" message={notice.message} onRetry={notice.retry} retrying={query.isRefetching} />;
  } else {
    const n = notice.data;
    const emergency = n.category === "EMERGENCY";
    const acked = n.mine?.acknowledged ?? false;
    body = (
      <View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <StatusPill label={NOTICE_CATEGORY_LABEL[n.category].toUpperCase()} color={emergency ? colors.stop : colors.go} />
          {n.pinned ? <StatusPill label="PINNED" color={colors.soft} /> : null}
          {n.publishedAt ? (
            <GateText variant="meta" color={colors.dim}>
              {publishedLabel(n.publishedAt)}
            </GateText>
          ) : null}
        </View>
        <GateText variant="cardTitleLarge" accessibilityRole="header" style={{ fontSize: 21, lineHeight: 27, marginBottom: 14 }}>
          {n.title}
        </GateText>

        {n.status === "SUPERSEDED" ? (
          <View style={{ padding: 13, borderRadius: 13, backgroundColor: "#3A2C10", marginBottom: 14 }}>
            <GateText variant="body" color="#F3D9A5" style={{ fontSize: 12.5, lineHeight: 18.75, marginBottom: n.supersededById ? 10 : 0 }}>
              The office has replaced this notice with a corrected one.
            </GateText>
            {n.supersededById ? (
              <GateButton label="Open the new notice" variant="secondary" height={42} fontSize={13.5} weight={600} radius={12} onPress={() => actions.openNotice(n.supersededById ?? n.id)} />
            ) : null}
          </View>
        ) : null}

        <View style={{ borderWidth: 1, borderColor: colors.line, borderLeftWidth: emergency ? 3 : 1, borderLeftColor: emergency ? colors.stop : colors.line, borderRadius: 15, backgroundColor: colors.card, padding: 16, marginBottom: 18 }}>
          <GateText variant="body" color={colors.ink} style={{ fontSize: 14.5, lineHeight: 22.5 }} selectable>
            {n.body}
          </GateText>
        </View>

        {n.ackRequired && n.mine ? (
          acked ? (
            <View style={{ borderWidth: 1, borderColor: withAlpha(colors.go, 0.35), borderRadius: 15, backgroundColor: withAlpha(colors.go, 0.1), padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: withAlpha(colors.go, 0.2), alignItems: "center", justifyContent: "center" }}>
                <Icon d={iconPaths.check} color={colors.go} size={18} strokeWidth={2.8} />
              </View>
              <View style={{ flex: 1 }}>
                <GateText variant="cardTitle" color={colors.go} style={{ fontSize: 14, marginBottom: 2 }}>
                  You confirmed you read this
                </GateText>
                <GateText variant="meta" color={colors.soft}>
                  The office sees it on the notice's delivery report.
                </GateText>
              </View>
            </View>
          ) : (
            <View>
              <GateText variant="bodySmall" color={colors.soft} style={{ marginBottom: 12 }}>
                The office asked everyone to confirm they have read this.
              </GateText>
              <GateButton
                label={acknowledge.isPending ? "Confirming…" : "I have read this"}
                loading={acknowledge.isPending}
                onPress={() => acknowledge.mutate({ params: { societyId, noticeId: n.id } })}
              />
            </View>
          )
        ) : null}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 24 }}>
      <RevealItem tier="screenBlock">
        <ScreenHeader title="From the office" onBack={() => actions.go("notices")} />
      </RevealItem>
      <RevealItem tier="screenBlock">{body}</RevealItem>
    </ScrollView>
  );
}
