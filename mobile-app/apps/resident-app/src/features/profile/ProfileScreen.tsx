import React, { useState } from "react";
import { View } from "react-native";
import { num } from "@sahaj/shared";
import { useSessionController } from "@chs/api-client/react";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { currentUnit, openTicketCount, unitDailyHelp } from "../../state/selectors";
import { HOLDING_LABEL, MEMBERSHIP_LABEL, OCCUPANCY_LABEL, householdRows, initialsOf, landlordUnits, shortDate, unitByLabel, useResidentAccount, type MyHome } from "../../api/identity";
import { ScreenScroll } from "../../components/ScreenScroll";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { AnimatedPressable } from "../../components/AnimatedPressable";
import { Toggle } from "../../components/Toggle";
import { RevealItem } from "../../components/RevealItem";
import { Skeleton } from "../../components/Skeleton";
import { LoadError } from "../../components/LoadError";
import { fontFamilyFor } from "../../theme/fonts";
import { signOut } from "../../push/bridge";
import { PREFERENCE_ROWS, useNotificationPreferences } from "../../api/notifications";

/**
 * The signed-in resident, their flat as the society records it, and settings.
 *
 * The prototype's "View the app as" switcher is gone: the role now comes from
 * the account itself. In its place is the design's "My unit" card (Resident
 * App.dc.html, screen 21) — carpet area, occupancy, share certificate, parking.
 * Settings also reach the helpdesk (the design gives it a tab of its own; this
 * app's tab bar follows the prototype, where the helpdesk sits under Profile)
 * and the dark theme, which this phone remembers.
 */
export function ProfileScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t, lang } = useT();
  const { me, home } = useResidentAccount();
  const session = useSessionController();
  const [signingOut, setSigningOut] = useState(false);
  const unit = currentUnit(state);
  const homeUnit = state.identity?.homeUnit ?? unit.code;
  const data = home.status === "ready" ? home.data : null;

  // "3 of 5 on" over the rows a resident can switch; the locked ones aren't a choice.
  const prefs = useNotificationPreferences().data?.preferences;
  const switchable = prefs ? PREFERENCE_ROWS.filter((r) => prefs.some((p) => r.categories.includes(p.category) && !p.mandatory)) : [];
  const notifOnCount = prefs ? switchable.filter((r) => prefs.some((p) => r.categories.includes(p.category) && p.push)).length : 0;
  const homeOverview = data ? unitByLabel(data, homeUnit) : undefined;
  const viewed = data ? unitByLabel(data, unit.code) : undefined;
  // How the home flat is held: the membership kind the society records for an
  // owner-member (Primary owner, Co-owner, Associate member), else the account's user type.
  const holding = state.identity?.homeHolding ?? "owner";
  const memberKind = homeOverview ? MEMBERSHIP_LABEL[homeOverview.currentMembers.find((m) => m.person.userId === me.id)?.kind ?? ""] : undefined;
  const heldAs = holding === "tenant" ? t("tenant") : holding === "family" ? HOLDING_LABEL.family : memberKind || (holding === "coOwner" ? HOLDING_LABEL.coOwner : t("owner"));
  const unitTickets = state.tickets.filter((tk) => tk.unit === unit.code).length;
  const liveTenancies = data ? landlordUnits(me, data).filter((u) => u.activeTenancy).length : 0;

  // Counts wait for myHome rather than show a number that is about to change.
  const settings: { label: string; value: string; go: () => void }[] = [
    { label: t("personal"), value: "Name, phone, email", go: () => actions.go("personal", true) },
    { label: t("myTenants"), value: !data ? "" : liveTenancies === 0 ? t("none") : liveTenancies === 1 ? t("oneActive") : `${liveTenancies} active`, go: () => actions.go("tenants", true) },
    { label: t("dailyHelpRow"), value: t("nPeople", { n: unitDailyHelp(state).length }), go: () => actions.go("dailyHelp", true) },
    { label: t("deliveries"), value: state.deliveryPref, go: () => actions.go("deliveries", true) },
    { label: t("helpdeskTitle"), value: t("openOfTotal", { open: num(openTicketCount(state), lang), total: num(unitTickets, lang) }), go: () => actions.go("helpdesk", true) },
    { label: t("householdRow"), value: homeOverview ? num(householdRows(me, homeOverview, state.role === "tenant").length, lang) : "", go: () => actions.go("household", true) },
    { label: t("vehiclesRow"), value: viewed ? num(viewed.vehicles.length, lang) : "", go: () => actions.go("vehicles", true) },
    { label: t("notifRow"), value: prefs ? `${num(notifOnCount, lang)} of ${num(switchable.length, lang)} on` : "", go: () => actions.go("notifPrefs", true) },
    { label: t("languageRow"), value: lang === "mr" ? "मराठी" : lang === "hi" ? "हिंदी" : "English", go: () => actions.go("language", true) },
  ];

  return (
    <ScreenScroll>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.accentWash, alignItems: "center", justifyContent: "center" }}>
          <AppText variant="cardTitleLarge" color={colors.accentInk} style={{ fontSize: 19 }} forceLatin>
            {initialsOf(me.name)}
          </AppText>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="cardTitleLarge" style={{ fontSize: 19 }}>
            {me.name}
          </AppText>
          <AppText variant="bodySmall" color={colors.inkSoft}>
            {heldAs} · {homeUnit}
          </AppText>
        </View>
      </View>

      <View style={{ marginBottom: 24 }}>
        {home.status === "loading" ? (
          <Skeleton height={149} radius={16} />
        ) : home.status === "error" ? (
          <LoadError title="Couldn't load your flat" message={home.message} onRetry={home.retry} />
        ) : (
          <RevealItem tier="listRow">
            <UnitCard data={home.data} label={unit.code} tenant={state.role === "tenant"} meId={me.id} />
          </RevealItem>
        )}
      </View>

      <AppText variant="cardTitle" color={colors.inkSoft} style={{ fontSize: 13, marginBottom: 11 }}>
        {t("settings")}
      </AppText>
      <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, overflow: "hidden" }}>
        {settings.map((row) => (
          <RevealItem key={row.label} tier="prefRow">
            <AnimatedPressable
              onPress={row.go}
              style={{ padding: 15, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.borderSoft, flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <AppText variant="body" style={{ flex: 1, fontWeight: "500" as const }}>
                {row.label}
              </AppText>
              <AppText variant="meta" color={colors.inkMuted} forceLatin>
                {row.value}
              </AppText>
              <Icon d={iconPaths.chevronRight} size={16} color={colors.inkDim} strokeWidth={2.2} />
            </AnimatedPressable>
          </RevealItem>
        ))}
        {/* The design has both themes but no in-app switch (its prototype toggles from the frame); it sits last in settings. */}
        <RevealItem tier="prefRow">
          <View style={{ padding: 15, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <AppText variant="body" style={{ flex: 1, fontWeight: "500" as const }}>
              Dark mode
            </AppText>
            <Toggle on={state.dark} onPress={actions.toggleTheme} accessibilityLabel="Dark mode" />
          </View>
        </RevealItem>
      </View>

      {/* The design has no sign-out control; it sits at the foot of settings in the app's existing danger treatment. */}
      <Button
        label={signingOut ? "Signing out…" : "Sign out"}
        kind="danger"
        loading={signingOut}
        onPress={() => {
          setSigningOut(true);
          void signOut(session);
        }}
        height={46}
        fontSize={14.5}
        weight={600}
        style={{ marginTop: 16 }}
      />
    </ScreenScroll>
  );
}

/** "My unit" — screen 21's facts card, for whichever of the resident's flats is being viewed. */
function UnitCard({ data, label, tenant, meId }: { data: MyHome; label: string; tenant: boolean; meId: string }) {
  const { colors } = useTheme();
  const overview = unitByLabel(data, label);
  if (!overview) return null;
  const mine = overview.currentMembers.find((m) => m.person.userId === meId);
  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: "Carpet area", value: overview.unit.carpetAreaSqft !== null ? `${overview.unit.carpetAreaSqft.toLocaleString("en-IN")} sq ft` : "Not recorded" },
    { label: "Occupancy", value: overview.occupancy ? OCCUPANCY_LABEL[overview.occupancy.status] ?? overview.occupancy.status : "Not recorded" },
    tenant
      ? { label: "Tenancy until", value: overview.activeTenancy ? shortDate(overview.activeTenancy.endDate) : "Not recorded" }
      : { label: "Share certificate", value: mine?.shareCertificateNo ?? overview.unit.shareCertificateNo ?? "Not issued", mono: true },
    { label: "Parking", value: overview.parkingSlots.length ? overview.parkingSlots.map((p) => p.code).join(", ") : "None allotted" },
  ];
  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, padding: 15 }}>
      <AppText variant="label" color={colors.inkSoft} style={{ fontSize: 11, lineHeight: 11, letterSpacing: 0.99, textTransform: "uppercase", marginBottom: 11 }}>
        My unit · {label}
      </AppText>
      {rows.map((r) => (
        <View key={r.label} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          <AppText variant="bodySmall" color={colors.inkSoft} style={{ fontSize: 12.5, lineHeight: 23.75 }}>
            {r.label}
          </AppText>
          <AppText variant="cardTitle" style={[{ fontSize: 12.5, lineHeight: 23.75 }, r.mono ? { fontFamily: fontFamilyFor("mono", 600) } : null]} forceLatin>
            {r.value}
          </AppText>
        </View>
      ))}
    </View>
  );
}
