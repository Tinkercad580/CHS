import React from "react";
import { View } from "react-native";
import { api } from "@chs/contract";
import { useApiInfiniteQuery, useApiMutation } from "@chs/api-client/react";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { timeAgo } from "../../api/billing";
import { notificationTone, useOpenRoute, useUnreadCount, type AppNotification } from "../../api/notifications";
import { ScreenScroll } from "../../components/ScreenScroll";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { RevealItem } from "../../components/RevealItem";
import { AnimatedPressable } from "../../components/AnimatedPressable";
import { Skeleton } from "../../components/Skeleton";
import { LoadError } from "../../components/LoadError";
import { EmptyState } from "../../components/EmptyState";
import { Button } from "../../components/Button";
import { Spinner } from "../../components/Spinner";

/**
 * The notification inbox (notifications.list), newest first. Tapping one marks
 * it read and opens what it is about — the same routing a tapped push uses.
 * New ones arrive by `notifications.changed`, not by polling.
 */
export function NotifsFeedScreen() {
  const { actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();
  const list = useApiInfiniteQuery(api.notifications.list, { query: { limit: 30 } });
  const unread = useUnreadCount().data?.unread ?? 0;
  const markAll = useApiMutation(api.notifications.markAllRead);
  const { mutate: markRead } = useApiMutation(api.notifications.markRead);
  const openRoute = useOpenRoute();

  const open = (n: AppNotification) => {
    if (!n.read) markRead({ params: { notificationId: n.id } });
    if (n.data.route) openRoute(n.data.route);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader
        title={t("notifTitle")}
        onBack={actions.back}
        right={
          unread > 0 ? (
            <AnimatedPressable
              onPress={() => markAll.mutate({ body: {} }, { onError: (err) => actions.toast(err.message, "warn") })}
              disabled={markAll.isPending}
              accessibilityRole="button"
              accessibilityState={{ busy: markAll.isPending }}
              hitSlop={8}
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              {markAll.isPending ? <Spinner size={13} /> : null}
              <AppText variant="cardTitle" color={colors.accentInk} style={{ fontSize: 12.5 }}>
                {t("markAllRead")}
              </AppText>
            </AnimatedPressable>
          ) : null
        }
      />
      <ScreenScroll>
        {list.status === "pending" ? (
          <View style={{ gap: 9 }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={92} radius={14} />
            ))}
          </View>
        ) : list.status === "error" ? (
          <LoadError title="Couldn't load notifications" message={list.error?.message ?? "Something went wrong."} onRetry={() => void list.refetch()} />
        ) : list.items.length === 0 ? (
          <EmptyState iconPath={iconPaths.bell} title="No notifications yet" body="Bills, receipts and society notices will show up here as they arrive." dashed />
        ) : (
          <View style={{ gap: 9 }}>
            {list.items.map((n) => (
              <RevealItem key={n.id} tier="listRow">
                <NotificationRow notification={n} onPress={() => open(n)} />
              </RevealItem>
            ))}
            {list.hasNextPage ? (
              <Button
                label={list.isFetchingNextPage ? "Loading…" : "Show older"}
                kind="secondary"
                loading={list.isFetchingNextPage}
                onPress={() => void list.fetchNextPage()}
                height={46}
                fontSize={14}
                weight={600}
              />
            ) : null}
          </View>
        )}
      </ScreenScroll>
    </View>
  );
}

function NotificationRow({ notification: n, onPress }: { notification: AppNotification; onPress: () => void }) {
  const { colors } = useTheme();
  const kind = notificationTone(n);
  const iconBg = kind === "warn" ? colors.warnWash : kind === "ok" ? colors.okWash : colors.infoWash;
  const iconFg = kind === "warn" ? colors.warnInk : kind === "ok" ? colors.okInk : colors.infoInk;
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${n.read ? "" : "Unread: "}${n.title}`}
      style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: n.read ? colors.surface : colors.accentWash, padding: 14, flexDirection: "row", gap: 12 }}
    >
      <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: iconBg, alignItems: "center", justifyContent: "center" }}>
        <Icon d={kind === "warn" ? iconPaths.sos : kind === "ok" ? iconPaths.check : iconPaths.bell} size={17} color={iconFg} strokeWidth={1.9} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="cardTitle" style={{ fontSize: 13.5, marginBottom: 3 }}>
          {n.title}
        </AppText>
        <AppText variant="bodySmall" color={colors.inkSoft} style={{ marginBottom: 4 }} numberOfLines={3}>
          {n.body}
        </AppText>
        <AppText variant="meta" color={colors.inkMuted}>
          {timeAgo(n.createdAt)}
        </AppText>
      </View>
    </AnimatedPressable>
  );
}
