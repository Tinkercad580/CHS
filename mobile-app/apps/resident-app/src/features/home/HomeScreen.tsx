import React from "react";
import { View } from "react-native";
import { t as translate, type Language, type Role } from "@sahaj/shared";
import { toLoadState, useMe } from "@chs/api-client/react";
import { initialsOf } from "../../api/identity";
import { dayMonth, duesDeadline, duesForUnit, formatPaise, timeAgo, useMyDues, type Dues } from "../../api/billing";
import { noticeBlurb, noticeTag, noticeTagTone, useNoticeFeed, type Notice } from "../../api/notices";
import { useNotificationPreferences, useUnreadCount } from "../../api/notifications";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { currentUnit, expectedPasses } from "../../state/selectors";
import { ScreenScroll } from "../../components/ScreenScroll";
import { AppText } from "../../components/AppText";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { AnimatedPressable } from "../../components/AnimatedPressable";
import { RevealItem } from "../../components/RevealItem";
import { Skeleton } from "../../components/Skeleton";
import { LoadError } from "../../components/LoadError";

/**
 * Home. The dues card, the bell's unread dot and the latest notice are the
 * API's (billing.myDues, notifications.unreadCount, notices.feed); utilities,
 * polls and expected visitors are still local fixtures, which have no wait.
 * Everything tied to a flat (dues, expected visitors) follows the flat being viewed.
 */
export function HomeScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t, c, lang } = useT();
  const me = useMe();
  const unit = currentUnit(state);
  // Every flat of the account's, from its own records: the home flat, then any it owns besides.
  const identity = state.identity;
  const positions = identity && identity.otherUnits.length > 0 ? [{ label: identity.homeUnit, letOut: false }, ...identity.otherUnits] : [];
  const dues = useMyDues();
  const unreadNotifs = useUnreadCount().data?.unread ?? 0;
  const feed = toLoadState(useNoticeFeed());
  const latest = feed.status === "ready" ? latestOf(feed.data.items) : undefined;
  const prefs = useNotificationPreferences();
  const expected = expectedPasses(state);
  // No email on file: the account says so first, the preferences endpoint once it has answered.
  const noEmail = !me.email || prefs.data?.hasEmail === false;
  const isBad = state.utilities.some((u) => u.state === "down");
  const agmLine = agmSubtitle(lang, state.role, state.polls.length, state.polls.filter((p) => !state.votes[p.id]).length);

  const quickActions: { icon: keyof typeof iconPaths; label: string; go: () => void }[] = [
    { icon: "dues", label: t("qaPay"), go: () => actions.go("dues") },
    { icon: "people", label: t("qaInvite"), go: actions.goInvite },
    { icon: "ticket", label: t("qaTicket"), go: actions.goNewTicket },
    { icon: "amenity", label: t("qaAmenities"), go: () => actions.go("amenities", true) },
  ];

  return (
    <ScreenScroll contentPadded={false}>
      <RevealItem tier="screenBlock" style={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: 22, backgroundColor: colors.accent }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <AnimatedPressable onPress={() => actions.go("profile")} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 }}>
            <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" }}>
              <AppText variant="cardTitleLarge" color="#FFFFFF" style={{ fontSize: 14 }} forceLatin>
                {initialsOf(me.name)}
              </AppText>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="cardTitle" color="#FFFFFF" style={{ fontSize: 15 }}>
                {greeting(lang, me.name.split(" ")[0])}
              </AppText>
              <AppText variant="meta" color="rgba(255,255,255,0.78)">
                {unit.line}
              </AppText>
            </View>
          </AnimatedPressable>
          <AnimatedPressable onPress={() => actions.goSos()} accessibilityRole="button" accessibilityLabel="Emergency" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" }}>
            <Icon d={iconPaths.sos} size={19} color="#FFFFFF" strokeWidth={1.95} />
          </AnimatedPressable>
          <AnimatedPressable
            onPress={actions.goNotifs}
            accessibilityRole="button"
            accessibilityLabel={unreadNotifs > 0 ? `Notifications, ${unreadNotifs} unread` : "Notifications"}
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" }}
          >
            <Icon d={iconPaths.bell} size={19} color="#FFFFFF" strokeWidth={1.9} />
            {unreadNotifs > 0 ? (
              <View style={{ position: "absolute", top: 8, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFC043", borderWidth: 1.5, borderColor: colors.accent }} />
            ) : null}
          </AnimatedPressable>
        </View>
      </RevealItem>

      <RevealItem tier="screenBlock" style={{ paddingHorizontal: 22, marginTop: -14 }}>
        {dues.status === "loading" ? (
          <Skeleton height={157} radius={18} />
        ) : dues.status === "error" ? (
          <LoadError title="Couldn't load your dues" message={dues.message} onRetry={dues.retry} />
        ) : (
          <DuesCard dues={duesForUnit(dues.data, unit.code)} onPress={() => actions.go("dues")} />
        )}
      </RevealItem>

      {noEmail && !state.emailPromptDismissed ? (
        <RevealItem tier="screenBlock" style={{ paddingHorizontal: 22, marginTop: 18 }}>
          <EmailPrompt onAdd={actions.goAddEmail} onDismiss={actions.dismissEmailPrompt} />
        </RevealItem>
      ) : null}

      <RevealItem tier="screenBlock" style={{ paddingHorizontal: 22, marginTop: 18 }}>
        <AnimatedPressable onPress={() => actions.go("utilities", true)} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 15, backgroundColor: colors.surface, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: isBad ? colors.badWash : colors.okWash, alignItems: "center", justifyContent: "center" }}>
            <Icon d={iconPaths.bolt} size={17} color={isBad ? colors.badInk : colors.okInk} strokeWidth={2} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="cardTitle" style={{ fontSize: 13.5, marginBottom: 2 }}>
              {isBad
                ? state.utilities
                    .filter((u) => u.state === "down")
                    .map((u) => c(u.id, "name", u.name))
                    .join(" · ") +
                  " " +
                  t("down")
                : t("allNormal")}
            </AppText>
            <AppText variant="meta" color={colors.inkSoft}>
              {t("utilitySub")}
            </AppText>
          </View>
          <Icon d={iconPaths.chevronRight} size={16} color={colors.inkDim} strokeWidth={2.2} />
        </AnimatedPressable>
      </RevealItem>

      <RevealItem tier="screenBlock" style={{ paddingHorizontal: 22, marginTop: 20 }}>
        <AppText variant="cardTitle" color={colors.inkSoft} style={{ fontSize: 13, marginBottom: 11 }}>
          {t("quickActions")}
        </AppText>
        <View style={{ flexDirection: "row", gap: 9 }}>
          {quickActions.map((q) => (
            <AnimatedPressable key={q.label} onPress={q.go} style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 15, backgroundColor: colors.surface, paddingVertical: 13, alignItems: "center", gap: 8 }}>
              <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: colors.accentWash, alignItems: "center", justifyContent: "center" }}>
                <Icon d={iconPaths[q.icon]} size={17} color={colors.accentInk} strokeWidth={1.9} />
              </View>
              <AppText variant="cardTitle" style={{ fontSize: 11, textAlign: "center" }}>
                {q.label}
              </AppText>
            </AnimatedPressable>
          ))}
        </View>
      </RevealItem>

      {positions.length > 1 ? (
        <RevealItem tier="screenBlock" style={{ paddingHorizontal: 22, marginTop: 20 }}>
          <View style={{ borderWidth: 1, borderColor: colors.accent200, borderRadius: 16, backgroundColor: colors.accentWash, padding: 15 }}>
            <AppText variant="cardTitle" color={colors.accentInk} style={{ fontSize: 13, marginBottom: 4 }}>
              {state.role === "owner_tenant" && positions.length === 2 ? t("twoPositions") : `You hold ${positions.length} flats here`}
            </AppText>
            <AppText variant="bodySmall" color={colors.inkSoft} style={{ marginBottom: 12 }}>
              {t("switchLedger")}
            </AppText>
            {/* Two flats sit side by side as in the design; a third or fourth wraps to the next row. */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {positions.map((u) => {
                const active = unit.code === u.label;
                return (
                  <AnimatedPressable
                    key={u.label}
                    onPress={() => actions.setUnit(u.label)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={{ flexGrow: 1, flexBasis: "45%", height: 38, borderRadius: 11, borderWidth: 1, borderColor: active ? colors.accent : colors.borderStrong, backgroundColor: active ? colors.accent : colors.surface, alignItems: "center", justifyContent: "center" }}
                  >
                    {/* Not forceLatin: "owned" / "rented out" are translated, and the Latin face has no Devanagari. */}
                    <AppText variant="cardTitle" color={active ? "#FFFFFF" : colors.ink} style={{ fontSize: 12.5 }}>
                      {u.label} · {u.letOut ? t("rentedOut") : t("owned")}
                    </AppText>
                  </AnimatedPressable>
                );
              })}
            </View>
          </View>
        </RevealItem>
      ) : null}

      <RevealItem tier="screenBlock" style={{ paddingHorizontal: 22, marginTop: 22 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
          <AppText variant="cardTitle" color={colors.inkSoft} style={{ fontSize: 13 }}>
            {t("latestNotice")}
          </AppText>
          <AnimatedPressable onPress={() => actions.go("notices")}>
            <AppText variant="cardTitle" color={colors.accentInk} style={{ fontSize: 12.5 }}>
              {t("seeAll")}
            </AppText>
          </AnimatedPressable>
        </View>
        {feed.status === "loading" ? (
          <Skeleton height={108} radius={16} />
        ) : feed.status === "error" ? (
          <LoadError title="Couldn't load notices" message={feed.message} onRetry={feed.retry} />
        ) : latest ? (
          <LatestNotice notice={latest} onPress={actions.openNotice} />
        ) : (
          <EmptyState iconPath={iconPaths.notices} title="No notices yet" body="Anything the committee posts will show here." dashed />
        )}
      </RevealItem>

      <RevealItem tier="screenBlock" style={{ paddingHorizontal: 22, marginTop: 22 }}>
        <AnimatedPressable onPress={actions.goPolls} style={{ borderWidth: 1, borderColor: colors.accent200, borderRadius: 16, backgroundColor: colors.accentWash, padding: 15, flexDirection: "row", alignItems: "center", gap: 13 }}>
          <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
            <Icon d={iconPaths.vote} size={19} color={colors.accentInk} strokeWidth={1.9} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="cardTitle" style={{ fontSize: 14, marginBottom: 2 }}>
              {t("agmTitle")}
            </AppText>
            {agmLine ? (
              <AppText variant="meta" color={colors.inkSoft}>
                {agmLine}
              </AppText>
            ) : null}
          </View>
          <Icon d={iconPaths.chevronRight} size={17} color={colors.accentInk} strokeWidth={2.2} />
        </AnimatedPressable>
      </RevealItem>

      <RevealItem tier="screenBlock" style={{ paddingHorizontal: 22, marginTop: 22 }}>
        <AppText variant="cardTitle" color={colors.inkSoft} style={{ fontSize: 13, marginBottom: 11 }}>
          {t("expectedToday")}
        </AppText>
        {expected.length > 0 ? (
          <View style={{ gap: 9 }}>
            {expected.map((p, i) => (
              <RevealItem key={p.id} tier="listRow">
                <Card>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: colors.subtle, alignItems: "center", justifyContent: "center" }}>
                      <AppText variant="cardTitleLarge" color={colors.inkSoft} style={{ fontSize: 12 }} forceLatin>
                        {initialsOf(p.name)}
                      </AppText>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <AppText variant="cardTitle" style={{ fontSize: 13.5 }}>
                        {p.name}
                      </AppText>
                      <AppText variant="meta" color={colors.inkSoft}>
                        {p.purpose}
                      </AppText>
                    </View>
                    <AppText variant="moneyMono" color={colors.accentInk} style={{ fontSize: 11.5, backgroundColor: colors.accentWash, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7 }} forceLatin>
                      {p.code}
                    </AppText>
                  </View>
                </Card>
              </RevealItem>
            ))}
          </View>
        ) : (
          <EmptyState iconPath={iconPaths.household} title={t("noOneExpected")} body="Invite a guest to make a pass for them. Passes stay on this phone until the gate is connected." actionLabel={t("inviteAGuest")} onAction={actions.goInvite} />
        )}
      </RevealItem>
    </ScreenScroll>
  );
}

/** The notice published most recently. The feed puts pinned notices first, so its first item can be an old one. */
function latestOf(items: Notice[]): Notice | undefined {
  return items.reduce<Notice | undefined>((best, n) => (!best || (n.publishedAt ?? "") > (best.publishedAt ?? "") ? n : best), undefined);
}

/** "Good morning / afternoon / evening", by the hour in India. The morning form is the design's own copy. */
function greeting(lang: Language, name: string): string {
  const hour = new Date(Date.now() + 330 * 60_000).getUTCHours();
  if (hour >= 4 && hour < 12) return translate(lang, "greeting", { name });
  const afternoon = hour >= 12 && hour < 17;
  const words: Record<Language, string> = afternoon
    ? { en: "Good afternoon", mr: "नमस्कार", hi: "नमस्ते" }
    : { en: "Good evening", mr: "शुभ संध्याकाळ", hi: "शुभ संध्या" };
  return `${words[lang]}, ${name}`;
}

/**
 * The AGM card's second line, from the polls on hand: how many still need this
 * flat's vote. The design's copy is written for exactly two items; any other
 * count gets its own English line, and with no polls there is no line at all.
 */
function agmSubtitle(lang: Language, role: Role, total: number, open: number): string | null {
  if (total === 0) return null;
  if (role === "tenant") return total === 2 ? translate(lang, "ownersVoting") : `Owners are voting on ${total} AGM ${total === 1 ? "item" : "items"}`;
  if (total === 2) return translate(lang, "twoAgmItems", { n: open });
  return open === 0 ? "You have voted on every AGM item" : `${open} of ${total} AGM ${total === 1 ? "item needs" : "items need"} your vote`;
}

/** The amount-due card for the unit being viewed. No dues card for it means nothing was ever billed — nothing due. */
function DuesCard({ dues, onPress }: { dues: Dues | undefined; onPress: () => void }) {
  const { colors } = useTheme();
  const { t } = useT();
  const due = dues?.totalDuePaise ?? 0;
  const openCount = dues?.openBills.length ?? 0;
  const deadline = dues && due > 0 ? duesDeadline(dues) : null;
  const overdue = deadline?.overdue ?? false;
  const chip = due <= 0 ? t("nothingDue") : deadline ? (overdue ? `Overdue since ${dayMonth(deadline.date)}` : `Due ${dayMonth(deadline.date)}`) : t("amountDue");
  const across = openCount === 1 ? t("across1") : t("acrossN", { n: openCount });

  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={due > 0 ? `${formatPaise(due)} due, ${chip}. Open dues` : "Nothing due. Open dues"}
      style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface, padding: 19 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <AppText variant="eyebrow" color={colors.inkMuted} forceLatin>
          {t("amountDue").toUpperCase()}
        </AppText>
        <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: due <= 0 ? colors.okWash : overdue ? colors.badWash : colors.warnWash }}>
          <AppText variant="cardTitle" color={due <= 0 ? colors.okInk : overdue ? colors.badInk : colors.warnInk} style={{ fontSize: 11.5 }}>
            {chip}
          </AppText>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: 8, marginBottom: 14 }}>
        <AppText variant="moneyHero" forceLatin>
          {formatPaise(Math.max(0, due))}
        </AppText>
        {due > 0 ? (
          <AppText variant="bodySmall" color={colors.inkSoft}>
            {dues && dues.interestPaise > 0 ? `${across} · ${formatPaise(dues.interestPaise)} interest` : across}
          </AppText>
        ) : dues && dues.advancePaise > 0 ? (
          <AppText variant="bodySmall" color={colors.inkSoft}>
            {formatPaise(dues.advancePaise)} in advance
          </AppText>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1, height: 46, borderRadius: 12, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
          <AppText variant="cardTitleLarge" color="#FFFFFF" style={{ fontSize: 15 }}>
            {due > 0 ? t("payNow") : t("allSettled")}
          </AppText>
        </View>
        <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: colors.accentWash, alignItems: "center", justifyContent: "center" }}>
          <Icon d={iconPaths.chevronRight} size={19} color={colors.accentInk} strokeWidth={2} />
        </View>
      </View>
    </AnimatedPressable>
  );
}

function LatestNotice({ notice, onPress }: { notice: Notice; onPress: (id: string) => void }) {
  const { colors } = useTheme();
  const tag = noticeTag(notice);
  const tone = noticeTagTone(tag);
  return (
    <AnimatedPressable
      onPress={() => onPress(notice.id)}
      accessibilityRole="button"
      style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, padding: 15 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 7 }}>
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: tone === "bad" ? colors.badWash : tone === "info" ? colors.infoWash : colors.subtle }}>
          <AppText variant="statusPill" color={tone === "bad" ? colors.badInk : tone === "info" ? colors.infoInk : colors.inkSoft}>
            {tag}
          </AppText>
        </View>
        {notice.publishedAt ? (
          <AppText variant="meta" color={colors.inkMuted}>
            {timeAgo(notice.publishedAt)}
          </AppText>
        ) : null}
      </View>
      <AppText variant="cardTitle" style={{ fontSize: 14.5, marginBottom: 4 }}>
        {notice.title}
      </AppText>
      <AppText variant="bodySmall" color={colors.inkSoft}>
        {noticeBlurb(notice.body)}
      </AppText>
    </AnimatedPressable>
  );
}

/**
 * Shown while the account has no email: bills, receipts and reports can't be
 * emailed without one. It opens Personal details with the field ready, and
 * closing it hides it until the next sign-in.
 */
function EmailPrompt({ onAdd, onDismiss }: { onAdd: () => void; onDismiss: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 15, backgroundColor: colors.surface, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <AnimatedPressable onPress={onAdd} accessibilityRole="button" accessibilityLabel="Add your email" style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 }}>
        <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: colors.accentWash, alignItems: "center", justifyContent: "center" }}>
          <Icon d={iconPaths.mail} size={17} color={colors.accentInk} strokeWidth={1.9} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="cardTitle" style={{ fontSize: 13.5, marginBottom: 2 }}>
            Add your email
          </AppText>
          <AppText variant="meta" color={colors.inkSoft}>
            Get bills, receipts and reports by email.
          </AppText>
        </View>
      </AnimatedPressable>
      <AnimatedPressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={8} style={{ width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" }}>
        <Icon d={iconPaths.close} size={15} color={colors.inkMuted} strokeWidth={2.1} />
      </AnimatedPressable>
    </View>
  );
}
