import React, { useEffect, useState } from "react";
import { View, TextInput, type KeyboardTypeOptions } from "react-native";
import { api } from "@chs/contract";
import { useApiMutation } from "@chs/api-client/react";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { currentUnit } from "../../state/selectors";
import { formatMobile, initialsOf, monthYear, unitByLabel, useResidentAccount } from "../../api/identity";
import { splitError } from "../../api/errors";
import { ScreenScroll } from "../../components/ScreenScroll";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { RevealItem } from "../../components/RevealItem";
import { Skeleton } from "../../components/Skeleton";

/**
 * Name, mobile and email are the account's (`/me`); email saves through
 * `me.update`. Alternate phone and emergency contact have no field in the API
 * yet, so they stay in local state exactly as before.
 */
export function PersonalDetailsScreen() {
  const { state, actions } = useResident();
  const { colors, type } = useTheme();
  const { t, num } = useT();
  const { me, home } = useResidentAccount();
  const updateMe = useApiMutation(api.me.update);
  const unit = currentUnit(state);
  const editing = state.editingPersonalDetails;
  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const overview = home.status === "ready" ? unitByLabel(home.data, unit.code) : undefined;
  const mine = overview?.currentMembers.find((m) => m.person.userId === me.id);
  const since =
    state.role === "tenant"
      ? overview?.activeTenancy
        ? `Tenant since ${monthYear(overview.activeTenancy.startDate)}`
        : null
      : mine
        ? `Member since ${monthYear(mine.admissionDate)}${mine.shareCertificateNo ? ` · share cert. ${mine.shareCertificateNo}` : ""}`
        : null;

  const toggleEdit = () => {
    setEmailDraft(editing ? null : (me.email ?? ""));
    setEmailError(null);
    actions.toggleEditPersonal();
  };

  // The saved email shows from the draft until the session's copy of /me catches
  // up (useApiMutation refreshes it after me.update); any later change to the
  // account's email, from here or elsewhere, drops the draft.
  useEffect(() => {
    if (!editing) setEmailDraft(null);
  }, [me.email]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    // No draft means the field was never touched (or edit mode outlived a visit to another screen).
    const email = (emailDraft ?? me.email ?? "").trim();
    if (email === (me.email ?? "")) {
      setEmailDraft(null);
      actions.savePersonalDetails(false);
      return;
    }
    updateMe.mutate(
      { body: { email: email || null } },
      {
        onSuccess: () => {
          setEmailDraft(email);
          actions.savePersonalDetails(true);
        },
        onError: (err) => {
          const { fields, message } = splitError(err);
          setEmailError(fields.email ?? message);
        },
      }
    );
  };

  const contactRows: { label: string; value: string; locked?: boolean; local?: boolean; editable?: boolean; onChange?: (v: string) => void; error?: string | null; keyboardType?: KeyboardTypeOptions }[] = [
    { label: t("mobileNumber"), value: formatMobile(me.mobile), locked: true },
    {
      label: t("email"),
      value: editing ? (emailDraft ?? me.email ?? "") : (emailDraft ?? me.email) || "Not added",
      editable: editing,
      onChange: (v) => {
        setEmailDraft(v);
        if (emailError) setEmailError(null);
      },
      error: emailError,
      keyboardType: "email-address",
    },
    { label: t("alternatePhone"), value: state.me.alt, local: true, editable: editing, onChange: (v) => actions.setPersonalField("alt", v), keyboardType: "phone-pad" },
    { label: t("emergencyContact"), value: state.me.emergency, local: true, editable: editing, onChange: (v) => actions.setPersonalField("emergency", v) },
  ];

  const residenceRows: { label: string; value: string | null }[] = [
    { label: t("flatLabel"), value: unit.code },
    { label: t("societyLabel"), value: state.identity?.societyName ?? "" },
    { label: t("heldAs"), value: unit.tag },
    { label: t("carpetArea"), value: overview ? (overview.unit.carpetAreaSqft !== null ? `${overview.unit.carpetAreaSqft.toLocaleString("en-IN")} sq ft` : "Not recorded") : null },
    { label: t("parkingSlots"), value: overview ? t("slotsAllotted", { n: num(overview.parkingSlots.length) }) : null },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader
        title={t("personalTitle")}
        onBack={actions.back}
        right={<Button label={editing ? t("cancelEdit") : t("edit")} kind="secondary" height={36} fontSize={12.5} weight={600} onPress={toggleEdit} style={{ paddingHorizontal: 13 }} />}
      />
      <ScreenScroll keyboardShouldPersistTaps="handled">
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface, padding: 18, flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: colors.accentWash, alignItems: "center", justifyContent: "center" }}>
            <AppText variant="cardTitleLarge" color={colors.accentInk} style={{ fontSize: 20 }} forceLatin>
              {initialsOf(me.name)}
            </AppText>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="cardTitleLarge" style={{ fontSize: 18 }}>
              {me.name}
            </AppText>
            {home.status === "loading" ? (
              <View style={{ width: "75%", marginTop: 4 }}>
                <Skeleton height={12} radius={6} />
              </View>
            ) : since ? (
              <AppText variant="bodySmall" color={colors.inkSoft}>
                {since}
              </AppText>
            ) : null}
          </View>
        </View>

        <AppText variant="label" color={colors.inkSoft} style={{ marginBottom: 10 }}>
          {t("contact")}
        </AppText>
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, overflow: "hidden", marginBottom: 16 }}>
          {contactRows.map((row, i) => (
            <RevealItem key={row.label} tier="listRow">
              <View style={{ padding: 14, paddingHorizontal: 16, borderBottomWidth: i === contactRows.length - 1 ? 0 : 1, borderBottomColor: colors.borderSoft }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <AppText variant="meta" color={colors.inkMuted}>
                    {row.label}
                  </AppText>
                  {row.locked || row.local ? (
                    <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.subtle }}>
                      <AppText variant="meta" color={colors.inkSoft} style={{ fontSize: 10 }}>
                        {/* The API has no field for these two, so the society office never sees them. */}
                        {row.locked ? t("setByOffice") : "Not shared with the office"}
                      </AppText>
                    </View>
                  ) : null}
                </View>
                {row.editable ? (
                  <>
                    <TextInput
                      value={row.value}
                      onChangeText={row.onChange}
                      accessibilityLabel={row.label}
                      keyboardType={row.keyboardType}
                      autoCapitalize={row.keyboardType === "email-address" ? "none" : "sentences"}
                      autoCorrect={row.keyboardType !== "email-address"}
                      style={[{ height: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: row.error ? colors.bad : colors.accent, borderRadius: 10, backgroundColor: colors.surface, color: colors.ink }, type("body")]}
                    />
                    {row.error ? (
                      <AppText variant="meta" color={colors.badInk} style={{ marginTop: 6 }}>
                        {row.error}
                      </AppText>
                    ) : null}
                  </>
                ) : (
                  <AppText variant="body" style={{ color: row.value ? colors.ink : colors.inkMuted }} forceLatin>
                    {row.value || "Not added"}
                  </AppText>
                )}
              </View>
            </RevealItem>
          ))}
        </View>

        <AppText variant="label" color={colors.inkSoft} style={{ marginBottom: 10 }}>
          {t("residence")}
        </AppText>
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, overflow: "hidden", marginBottom: 16 }}>
          {residenceRows.map((row, i) => (
            <RevealItem key={row.label} tier="listRow">
              <View style={{ padding: 14, paddingHorizontal: 16, borderBottomWidth: i === residenceRows.length - 1 ? 0 : 1, borderBottomColor: colors.borderSoft, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <AppText variant="bodySmall" color={colors.inkSoft}>
                  {row.label}
                </AppText>
                {row.value !== null ? (
                  <AppText variant="cardTitle" style={{ fontSize: 13.5 }} forceLatin>
                    {row.value}
                  </AppText>
                ) : home.status === "loading" ? (
                  <View style={{ width: 72 }}>
                    <Skeleton height={12} radius={6} />
                  </View>
                ) : (
                  <AppText variant="cardTitle" color={colors.inkMuted} style={{ fontSize: 13.5 }}>
                    —
                  </AppText>
                )}
              </View>
            </RevealItem>
          ))}
        </View>

        {editing ? (
          <>
            <Button label={updateMe.isPending ? "Saving…" : t("saveChanges")} onPress={save} loading={updateMe.isPending} />
            <AppText variant="meta" color={colors.inkMuted} style={{ textAlign: "center", marginTop: 11 }}>
              {t("mobileIsLoginNote")}
            </AppText>
          </>
        ) : null}
      </ScreenScroll>
    </View>
  );
}
