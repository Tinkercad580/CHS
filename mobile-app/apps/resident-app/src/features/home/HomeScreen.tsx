import React from "react";
import { View, Pressable } from "react-native";
import { residentName, formatInr, FOCUS_UNIT_OWNER, FOCUS_UNIT_LET_OUT } from "@sahaj/shared";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { currentUnit, totalDue, unpaidBillCount, unreadNotifCount, expectedPasses } from "../../state/selectors";
import { ScreenScroll } from "../../components/ScreenScroll";
import { AppText } from "../../components/AppText";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";

function initialsOf(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export function HomeScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t, c } = useT();
  const unit = currentUnit(state);
  const due = totalDue(state);
  const unpaidCount = unpaidBillCount(state);
  const unreadNotifs = unreadNotifCount(state);
  const expected = expectedPasses(state);
  const topNotice = state.notices[0];
  const isBad = state.utilities.some((u) => u.state === "down");
  const votesOpen = 2 - Object.keys(state.votes).length;

  const quickActions: { icon: keyof typeof iconPaths; label: string; go: () => void }[] = [
    { icon: "dues", label: t("qaPay"), go: () => actions.go("dues") },
    { icon: "people", label: t("qaInvite"), go: actions.goInvite },
    { icon: "ticket", label: t("qaTicket"), go: actions.goNewTicket },
    { icon: "amenity", label: t("qaAmenities"), go: () => actions.go("amenities", true) },
  ];

  return (
    <ScreenScroll contentPadded={false}>
      <View style={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: 22, backgroundColor: colors.accent }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => actions.go("profile")} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 }}>
            <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" }}>
              <AppText variant="cardTitleLarge" color="#FFFFFF" style={{ fontSize: 14 }} forceLatin>
                {initialsOf(residentName)}
              </AppText>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="cardTitle" color="#FFFFFF" style={{ fontSize: 15 }}>
                {t("greeting", { name: residentName.split(" ")[0] })}
              </AppText>
              <AppText variant="meta" color="rgba(255,255,255,0.78)">
                {unit.line}
              </AppText>
            </View>
          </Pressable>
          <Pressable onPress={() => actions.goSos()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" }}>
            <Icon d={iconPaths.sos} size={19} color="#FFFFFF" strokeWidth={1.95} />
          </Pressable>
          <Pressable onPress={actions.goNotifs} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" }}>
            <Icon d={iconPaths.bell} size={19} color="#FFFFFF" strokeWidth={1.9} />
            {unreadNotifs > 0 ? (
              <View style={{ position: "absolute", top: 8, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFC043", borderWidth: 1.5, borderColor: colors.accent }} />
            ) : null}
          </Pressable>
        </View>
      </View>

      <View style={{ paddingHorizontal: 22, marginTop: -14 }}>
        <Pressable onPress={() => actions.go("dues")} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface, padding: 19 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <AppText variant="eyebrow" color={colors.inkMuted} forceLatin>
              {t("amountDue").toUpperCase()}
            </AppText>
            <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: due > 0 ? colors.warnWash : colors.okWash }}>
              <AppText variant="cardTitle" color={due > 0 ? colors.warnInk : colors.okInk} style={{ fontSize: 11.5 }}>
                {due > 0 ? t("dueOn") : t("nothingDue")}
              </AppText>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
            <AppText variant="moneyHero" forceLatin>
              {formatInr(due)}
            </AppText>
            <AppText variant="bodySmall" color={colors.inkSoft}>
              {unpaidCount === 1 ? t("across1") : t("acrossN", { n: unpaidCount })}
            </AppText>
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
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 22, marginTop: 18 }}>
        <Pressable onPress={() => actions.go("utilities", true)} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 15, backgroundColor: colors.surface, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: isBad ? colors.badWash : colors.okWash, alignItems: "center", justifyContent: "center" }}>
            <Icon d={iconPaths.bolt} size={17} color={isBad ? colors.badInk : colors.okInk} strokeWidth={2} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="cardTitle" style={{ fontSize: 13.5, marginBottom: 2 }}>
              {isBad ? t("thingsDown", { n: state.utilities.filter((u) => u.state === "down").length }) : t("allNormal")}
            </AppText>
            <AppText variant="meta" color={colors.inkSoft}>
              {t("utilitySub")}
            </AppText>
          </View>
          <Icon d={iconPaths.chevronRight} size={16} color={colors.inkDim} strokeWidth={2.2} />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 22, marginTop: 20 }}>
        <AppText variant="cardTitle" color={colors.inkSoft} style={{ fontSize: 13, marginBottom: 11 }}>
          {t("quickActions")}
        </AppText>
        <View style={{ flexDirection: "row", gap: 9 }}>
          {quickActions.map((q) => (
            <Pressable key={q.label} onPress={q.go} style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 15, backgroundColor: colors.surface, paddingVertical: 13, alignItems: "center", gap: 8 }}>
              <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: colors.accentWash, alignItems: "center", justifyContent: "center" }}>
                <Icon d={iconPaths[q.icon]} size={17} color={colors.accentInk} strokeWidth={1.9} />
              </View>
              <AppText variant="cardTitle" style={{ fontSize: 11, textAlign: "center" }}>
                {q.label}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      {state.role === "owner_tenant" ? (
        <View style={{ paddingHorizontal: 22, marginTop: 20 }}>
          <View style={{ borderWidth: 1, borderColor: colors.accent200, borderRadius: 16, backgroundColor: colors.accentWash, padding: 15 }}>
            <AppText variant="cardTitle" color={colors.accentInk} style={{ fontSize: 13, marginBottom: 4 }}>
              {t("twoPositions")}
            </AppText>
            <AppText variant="bodySmall" color={colors.inkSoft} style={{ marginBottom: 12 }}>
              {t("switchLedger")}
            </AppText>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[FOCUS_UNIT_OWNER, FOCUS_UNIT_LET_OUT].map((u) => {
                const active = unit.code === u;
                return (
                  <Pressable
                    key={u}
                    onPress={() => actions.setUnit(u)}
                    style={{ flex: 1, height: 38, borderRadius: 11, borderWidth: 1, borderColor: active ? colors.accent : colors.borderStrong, backgroundColor: active ? colors.accent : colors.surface, alignItems: "center", justifyContent: "center" }}
                  >
                    <AppText variant="cardTitle" color={active ? "#FFFFFF" : colors.ink} style={{ fontSize: 12.5 }} forceLatin>
                      {u} · {u === FOCUS_UNIT_OWNER ? t("owned") : t("rentedOut")}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: 22, marginTop: 22 }}>
        <Pressable onPress={actions.goPolls} style={{ borderWidth: 1, borderColor: colors.accent200, borderRadius: 16, backgroundColor: colors.accentWash, padding: 15, flexDirection: "row", alignItems: "center", gap: 13 }}>
          <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
            <Icon d={iconPaths.vote} size={19} color={colors.accentInk} strokeWidth={1.9} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="cardTitle" style={{ fontSize: 14, marginBottom: 2 }}>
              {t("agmTitle")}
            </AppText>
            <AppText variant="meta" color={colors.inkSoft}>
              {state.role === "tenant" ? t("ownersVoting") : t("twoAgmItems", { n: votesOpen })}
            </AppText>
          </View>
          <Icon d={iconPaths.chevronRight} size={17} color={colors.accentInk} strokeWidth={2.2} />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 22, marginTop: 22 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
          <AppText variant="cardTitle" color={colors.inkSoft} style={{ fontSize: 13 }}>
            {t("latestNotice")}
          </AppText>
          <Pressable onPress={() => actions.go("notices")}>
            <AppText variant="cardTitle" color={colors.accentInk} style={{ fontSize: 12.5 }}>
              {t("seeAll")}
            </AppText>
          </Pressable>
        </View>
        {topNotice ? (
          <Pressable onPress={() => actions.openNotice(topNotice.id)} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, padding: 15 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 7 }}>
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.badWash }}>
                <AppText variant="statusPill" color={colors.badInk}>
                  {c(topNotice.id, "tag", topNotice.tag).toUpperCase()}
                </AppText>
              </View>
              <AppText variant="meta" color={colors.inkMuted}>
                {c(topNotice.id, "when", topNotice.postedAt)}
              </AppText>
            </View>
            <AppText variant="cardTitle" style={{ fontSize: 14.5, marginBottom: 4 }}>
              {c(topNotice.id, "title", topNotice.title)}
            </AppText>
            <AppText variant="bodySmall" color={colors.inkSoft}>
              {c(topNotice.id, "blurb", topNotice.blurb)}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <View style={{ paddingHorizontal: 22, marginTop: 22 }}>
        <AppText variant="cardTitle" color={colors.inkSoft} style={{ fontSize: 13, marginBottom: 11 }}>
          {t("expectedToday")}
        </AppText>
        {expected.length > 0 ? (
          <View style={{ gap: 9 }}>
            {expected.map((p) => (
              <Card key={p.id}>
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
            ))}
          </View>
        ) : (
          <EmptyState iconPath={iconPaths.household} title={t("noOneExpected")} body={t("noOneExpectedSub")} actionLabel={t("inviteAGuest")} onAction={actions.goInvite} />
        )}
      </View>
    </ScreenScroll>
  );
}
