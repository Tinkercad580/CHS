import React, { useState } from "react";
import { Platform, View } from "react-native";
import { api } from "@chs/contract";
import { toLoadState, useApiMutation } from "@chs/api-client/react";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { PREFERENCE_ROWS, useNotificationPreferences, type NotificationCategory, type NotificationPreferences } from "../../api/notifications";
import { retryPush, usePushState } from "../../push/bridge";
import { ScreenScroll } from "../../components/ScreenScroll";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { Toggle } from "../../components/Toggle";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { RevealItem } from "../../components/RevealItem";
import { Skeleton } from "../../components/Skeleton";
import { LoadError } from "../../components/LoadError";
import { Spinner } from "../../components/Spinner";

type Pref = NotificationPreferences["preferences"][number];
type Channel = "push" | "email";

/**
 * The notification *preference* toggles (Profile → Notifications) — distinct
 * from the feed at Home's bell icon (`NotifsFeedScreen`). Choices are the
 * account's (notifications.preferences), per channel: this phone, and email.
 * Emergencies and account security stay on and show locked. Above them, what
 * this phone can actually receive, and a test send to prove it end to end.
 */
export function NotificationsScreen() {
  const { actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();
  const query = useNotificationPreferences();
  const prefs = toLoadState(query);
  const update = useApiMutation(api.notifications.updatePreferences);
  // What the resident just asked for, shown until the server's answer replaces it.
  const [draft, setDraft] = useState<Pref[] | null>(null);

  const toggle = (current: Pref[], categories: NotificationCategory[], channel: Channel) => {
    const on = !rowOn(current, categories, channel);
    const next = current.map((p) => (categories.includes(p.category) && !p.mandatory ? { ...p, [channel]: on } : p));
    setDraft(next);
    update.mutate(
      { body: { preferences: next.filter((p) => !p.mandatory).map(({ category, push, email }) => ({ category, push, email })) } },
      {
        onError: (err) => actions.toast(err.message, "warn"),
        onSettled: () => setDraft(null),
      }
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader title={t("notifTitle")} onBack={actions.back} />
      <ScreenScroll>
        <AppText variant="bodySmall" color={colors.inkSoft} style={{ marginBottom: 16 }}>
          {t("notifIntro")}
        </AppText>

        <PushStatus />

        {prefs.status === "loading" ? (
          <View style={{ gap: 18 }}>
            <Skeleton height={430} radius={16} />
          </View>
        ) : prefs.status === "error" ? (
          <LoadError title="Couldn't load your choices" message={prefs.message} onRetry={prefs.retry} />
        ) : (
          <>
            <SectionTitle>On this phone</SectionTitle>
            <PrefList prefs={draft ?? prefs.data.preferences} channel="push" onToggle={(cats) => toggle(draft ?? prefs.data.preferences, cats, "push")} />

            <SectionTitle>By email</SectionTitle>
            {prefs.data.hasEmail ? (
              <PrefList prefs={draft ?? prefs.data.preferences} channel="email" onToggle={(cats) => toggle(draft ?? prefs.data.preferences, cats, "email")} />
            ) : (
              <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, padding: 16 }}>
                <AppText variant="cardTitle" style={{ fontSize: 13.5, marginBottom: 3 }}>
                  No email on your account
                </AppText>
                <AppText variant="meta" color={colors.inkSoft} style={{ marginBottom: 12 }}>
                  Add your email to get bills, receipts and reports by email.
                </AppText>
                <Button label="Add your email" kind="secondary" onPress={actions.goAddEmail} height={42} fontSize={13.5} weight={600} />
              </View>
            )}
          </>
        )}
      </ScreenScroll>
    </View>
  );
}

function rowOn(prefs: Pref[], categories: NotificationCategory[], channel: Channel): boolean {
  return prefs.filter((p) => categories.includes(p.category)).some((p) => p[channel]);
}

function SectionTitle({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <AppText variant="cardTitle" color={colors.inkSoft} style={{ fontSize: 13, marginTop: 20, marginBottom: 11 }} accessibilityRole="header">
      {children}
    </AppText>
  );
}

function PrefList({ prefs, channel, onToggle }: { prefs: Pref[]; channel: Channel; onToggle: (categories: NotificationCategory[]) => void }) {
  const { colors } = useTheme();
  const rows = PREFERENCE_ROWS.filter((r) => prefs.some((p) => r.categories.includes(p.category)));
  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, overflow: "hidden" }}>
      {rows.map((row, i) => {
        const locked = prefs.some((p) => row.categories.includes(p.category) && p.mandatory);
        const on = locked || rowOn(prefs, row.categories, channel);
        return (
          <RevealItem key={row.key} tier="prefRow">
            <View style={{ padding: 15, paddingHorizontal: 16, borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: colors.borderSoft, flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <AppText variant="cardTitle" style={{ fontSize: 13.5 }}>
                    {row.label}
                  </AppText>
                  {locked ? <Icon d={iconPaths.lock} size={13} color={colors.inkMuted} strokeWidth={2} /> : null}
                </View>
                <AppText variant="meta" color={colors.inkSoft}>
                  {locked ? `${row.detail}. Always on.` : row.detail}
                </AppText>
              </View>
              <Toggle on={on} disabled={locked} accessibilityLabel={`${row.label} ${channel === "push" ? "on this phone" : "by email"}`} onPress={() => onToggle(row.categories)} />
            </View>
          </RevealItem>
        );
      })}
    </View>
  );
}

/**
 * Whether push reaches this phone, and a test send. The web preview has no
 * push at all, which is said once and quietly; the inbox still works there.
 */
function PushStatus() {
  const { actions } = useResident();
  const { colors } = useTheme();
  const push = usePushState();
  const test = useApiMutation(api.notifications.test);
  const [asking, setAsking] = useState(false);

  const status =
    push === "granted"
      ? { title: "Notifications reach this phone", body: "Bills, receipts and notices arrive as they happen.", tone: "ok" as const }
      : push === "denied"
        ? { title: "Notifications are off for Sahaj", body: "Allow them in your phone's settings, or ask again here.", tone: "warn" as const }
        : push === "pending"
          ? { title: "Setting up notifications", body: "Checking with your phone.", tone: "info" as const }
          : Platform.OS === "web"
            ? { title: "No phone notifications here", body: "This preview can't receive them. Everything still arrives in your inbox.", tone: "info" as const }
            : { title: "Phone notifications aren't set up", body: "This build can't receive them. Everything still arrives in your inbox.", tone: "info" as const };
  const bg = status.tone === "ok" ? colors.okWash : status.tone === "warn" ? colors.warnWash : colors.subtle;
  const fg = status.tone === "ok" ? colors.okInk : status.tone === "warn" ? colors.warnInk : colors.inkSoft;

  const sendTest = () =>
    test.mutate({}, {
      onSuccess: (r) => {
        const parts = [
          r.push === "sent" ? "a push to your phone" : null,
          r.email === "sent" ? "an email" : null,
        ].filter(Boolean);
        actions.toast(parts.length ? `Test sent: ${parts.join(" and ")}. It's in your inbox too.` : "Test sent to your inbox.");
      },
      onError: (err) => actions.toast(err.message, "warn"),
    });

  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, padding: 15 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
          {push === "pending" ? <Spinner size={16} color={fg} /> : <Icon d={push === "granted" ? iconPaths.check : iconPaths.bell} size={17} color={fg} strokeWidth={1.9} />}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="cardTitle" style={{ fontSize: 13.5, marginBottom: 2 }}>
            {status.title}
          </AppText>
          <AppText variant="meta" color={colors.inkSoft}>
            {status.body}
          </AppText>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 9 }}>
        {push === "denied" ? (
          <Button
            label={asking ? "Asking…" : "Allow"}
            loading={asking}
            onPress={() => {
              setAsking(true);
              void retryPush().finally(() => setAsking(false));
            }}
            height={40}
            fontSize={13}
            weight={600}
            style={{ flex: 1 }}
          />
        ) : null}
        <Button
          label={test.isPending ? "Sending…" : "Send a test notification"}
          kind="secondary"
          loading={test.isPending}
          onPress={sendTest}
          height={40}
          fontSize={13}
          weight={600}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}
