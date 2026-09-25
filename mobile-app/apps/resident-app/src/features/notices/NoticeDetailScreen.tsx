import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import { api } from "@chs/contract";
import { toLoadState, useApiMutation, useApiQuery } from "@chs/api-client/react";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { dateTime, useSocietyId } from "../../api/billing";
import { noticeParagraphs, noticeTag, noticeTagTone, type Notice } from "../../api/notices";
import { ScreenScroll } from "../../components/ScreenScroll";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { StatusPill } from "../../components/StatusPill";
import { Button } from "../../components/Button";
import { RevealItem } from "../../components/RevealItem";
import { Skeleton } from "../../components/Skeleton";
import { LoadError } from "../../components/LoadError";

/**
 * One notice (notices.get). Opening it records the read (notices.markRead,
 * once per visit, only while it is unread); a notice that asks for it gets the
 * "I have read this" button, which is the society's proof of service
 * (notices.acknowledge).
 */
export function NoticeDetailScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const societyId = useSocietyId();
  const noticeId = state.activeNoticeId ?? "";
  const query = toLoadState(useApiQuery(api.notices.get, { params: { societyId, noticeId } }, { enabled: noticeId !== "" && societyId !== "" }));
  const { mutate: markRead } = useApiMutation(api.notices.markRead);
  const marked = useRef<string | null>(null);

  const unread = query.status === "ready" && query.data.mine !== null && !query.data.mine.read;
  useEffect(() => {
    if (!unread || marked.current === noticeId) return;
    marked.current = noticeId;
    markRead({ params: { societyId, noticeId } });
  }, [unread, noticeId, societyId, markRead]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader title="Notice" onBack={actions.back} />
      <ScreenScroll>
        {query.status === "loading" ? (
          <View>
            <Skeleton height={24} radius={7} />
            <View style={{ height: 14 }} />
            <Skeleton height={64} radius={10} />
            <View style={{ height: 20 }} />
            <Skeleton height={220} radius={12} />
          </View>
        ) : query.status === "error" ? (
          <LoadError title="Couldn't load this notice" message={query.message} onRetry={query.retry} />
        ) : (
          <NoticeBody notice={query.data} />
        )}
      </ScreenScroll>
    </View>
  );
}

function NoticeBody({ notice }: { notice: Notice }) {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();
  const societyId = useSocietyId();
  const acknowledge = useApiMutation(api.notices.acknowledge);
  const tag = noticeTag(notice);
  const tone = noticeTagTone(tag);
  const bg = tone === "bad" ? colors.badWash : tone === "info" ? colors.infoWash : colors.subtle;
  const fg = tone === "bad" ? colors.badInk : tone === "info" ? colors.infoInk : colors.inkSoft;
  const acked = notice.mine?.acknowledged ?? false;
  // Only a recipient can acknowledge; the server refuses anyone else.
  const canAck = notice.ackRequired && notice.mine !== null;

  const ack = () =>
    acknowledge.mutate(
      { params: { societyId, noticeId: notice.id } },
      {
        onSuccess: () => actions.toast(t("ackSent")),
        onError: (err) => actions.toast(err.message, "warn"),
      }
    );

  return (
    <>
      <View style={{ flexDirection: "row", gap: 7, marginBottom: 12 }}>
        <StatusPill label={tag} bg={bg} fg={fg} />
        {notice.supersededById ? <StatusPill label="Replaced by a newer notice" bg={colors.warnWash} fg={colors.warnInk} /> : null}
      </View>
      <AppText variant="sectionHeading" style={{ fontSize: 23, marginBottom: 8 }} accessibilityRole="header">
        {notice.title}
      </AppText>
      <AppText variant="meta" color={colors.inkMuted} style={{ marginBottom: 20 }}>
        {[state.identity?.societyName, notice.publishedAt ? `Posted ${dateTime(notice.publishedAt)}` : null].filter(Boolean).join(" · ")}
      </AppText>
      <View style={{ gap: 14, marginBottom: 24 }}>
        {noticeParagraphs(notice.body).map((p, i) => (
          <RevealItem key={i} tier="listRow">
            <AppText variant="body" color={colors.inkSoft}>
              {p}
            </AppText>
          </RevealItem>
        ))}
      </View>
      {canAck ? (
        <Button
          label={acked ? t("acknowledged") : acknowledge.isPending ? "Sending…" : t("iHaveRead")}
          kind={acked ? "ghost" : "primary"}
          onPress={ack}
          loading={acknowledge.isPending}
          disabled={acked}
          height={50}
          fontSize={15}
          weight={700}
        />
      ) : null}
    </>
  );
}
