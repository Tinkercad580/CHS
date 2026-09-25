import React, { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { api } from "@chs/contract";
import { useApiMutation } from "@chs/api-client/react";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { currentUnit } from "../../state/selectors";
import { householdRows, initialsOf, pendingFor, unitByLabel, useResidentAccount } from "../../api/identity";
import { splitError } from "../../api/errors";
import { ScreenScroll } from "../../components/ScreenScroll";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { OptionButton } from "../../components/FilterPill";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { RevealItem } from "../../components/RevealItem";
import { Skeleton } from "../../components/Skeleton";
import { Spinner } from "../../components/Spinner";
import { EmptyState } from "../../components/EmptyState";
import { LoadError } from "../../components/LoadError";
import { PendingRow } from "./PendingRow";

const RELATIONS: { key: "Spouse" | "Child" | "Parent"; labelKey: "spouse" | "child" | "parent" }[] = [
  { key: "Spouse", labelKey: "spouse" },
  { key: "Child", labelKey: "child" },
  { key: "Parent", labelKey: "parent" },
];

/**
 * The flat's household as the society holds it (myHome → family), with the
 * signed-in resident first. A resident's addition is a request: the office
 * approves it, realtime refreshes myHome, and the pending row becomes a member.
 */
export function HouseholdScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();
  const { me, membership, home } = useResidentAccount();
  const unit = currentUnit(state);
  const [nameError, setNameError] = useState<string | null>(null);
  const addFamily = useApiMutation(api.members.addFamily);
  const removeFamily = useApiMutation(api.members.removeFamily);

  const overview = home.status === "ready" ? unitByLabel(home.data, unit.code) : undefined;
  const livesHere = unit.code === state.identity?.homeUnit;
  const pending = home.status === "ready" && overview ? pendingFor(home.data, overview.unit.id, "FAMILY_ADD") : [];
  const societyId = membership?.societyId ?? "";

  const relationLabel = (relation: string) => {
    const known = RELATIONS.find((r) => r.key === relation);
    return known ? t(known.labelKey) : relation;
  };

  const add = () => {
    const name = state.memberNameInput.trim();
    if (name.length < 2) {
      setNameError("Enter the member's full name.");
      return;
    }
    if (!overview || addFamily.isPending) return;
    setNameError(null);
    addFamily.mutate(
      { params: { societyId, unitId: overview.unit.id }, body: { name, relation: state.relationInput } },
      {
        onSuccess: (res) => {
          actions.setMemberNameInput("");
          actions.toast("approvalId" in res ? `${name} sent to the society office for approval.` : `${name} added. The gate can verify them now.`);
        },
        onError: (err) => {
          const { fields, message } = splitError(err);
          if (fields.name) setNameError(fields.name);
          else actions.toast(fields.relation ?? message ?? "Could not add this member.", "warn");
        },
      }
    );
  };

  const remove = (id: string, name: string) => {
    if (removeFamily.isPending) return;
    removeFamily.mutate(
      { params: { societyId, familyMemberId: id } },
      {
        onSuccess: () => actions.toast(`${name} removed from the household.`, "warn"),
        onError: (err) => actions.toast(splitError(err).message ?? "Could not remove this member.", "warn"),
      }
    );
  };

  let list: React.ReactNode;
  if (home.status === "loading") {
    list = (
      <View style={{ gap: 10, marginBottom: 18 }}>
        <Skeleton height={70} />
        <Skeleton height={70} />
        <Skeleton height={70} />
      </View>
    );
  } else if (home.status === "error") {
    list = (
      <View style={{ marginBottom: 18 }}>
        <LoadError title="Couldn't load your household" message={home.message} onRetry={home.retry} />
      </View>
    );
  } else {
    // A let-out flat's occupants are the tenant's household, which the landlord doesn't see; only its family records (none, usually) are listed.
    const rows = overview ? (livesHere ? householdRows(me, overview, state.role === "tenant") : householdRows(me, overview, false).filter((r) => r.familyId)) : [];
    list = (
      <View style={{ gap: 10, marginBottom: 18 }}>
        {rows.length === 0 && pending.length === 0 ? (
          <EmptyState iconPath={iconPaths.household} title="No household on record" body={`Nobody is registered against ${unit.code}. Its occupants register their own household.`} />
        ) : null}
        {rows.map((m) => {
          const removing = removeFamily.isPending && removeFamily.variables?.params.familyMemberId === m.familyId;
          return (
            <RevealItem key={m.id} tier="listRow">
              <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 15, backgroundColor: colors.surface, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.accentWash, alignItems: "center", justifyContent: "center" }}>
                  <AppText variant="cardTitleLarge" color={colors.accentInk} style={{ fontSize: 13 }} forceLatin>
                    {initialsOf(m.name)}
                  </AppText>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText variant="cardTitle" style={{ fontSize: 14, marginBottom: 2 }}>
                    {m.name}
                  </AppText>
                  <AppText variant="meta" color={colors.inkSoft}>
                    {relationLabel(m.relation)} · gate access
                  </AppText>
                </View>
                {m.you ? (
                  <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7, backgroundColor: colors.subtle }}>
                    <AppText variant="cardTitle" color={colors.inkSoft} style={{ fontSize: 11 }}>
                      {t("youChip")}
                    </AppText>
                  </View>
                ) : m.familyId ? (
                  <Pressable
                    onPress={() => remove(m.familyId as string, m.name)}
                    disabled={removeFamily.isPending}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${m.name}`}
                    style={{ width: 38, height: 38, borderRadius: 11, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", opacity: removeFamily.isPending && !removing ? 0.55 : 1 }}
                  >
                    {removing ? <Spinner size={16} color={colors.badInk} /> : <Icon d={iconPaths.close} size={16} color={colors.badInk} strokeWidth={2} />}
                  </Pressable>
                ) : null}
              </View>
            </RevealItem>
          );
        })}
        {pending.map((a) => (
          <RevealItem key={a.id} tier="listRow">
            <PendingRow
              title={typeof a.payload.name === "string" ? a.payload.name : a.summary}
              detail={typeof a.payload.relation === "string" ? relationLabel(a.payload.relation) : "Family member"}
            />
          </RevealItem>
        ))}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader title={t("householdTitle")} onBack={actions.back} />
      <ScreenScroll keyboardShouldPersistTaps="handled">
        <AppText variant="bodySmall" color={colors.inkSoft} style={{ marginBottom: 16 }}>
          {t("householdIntro")}
        </AppText>
        {list}

        {/* The household of a let-out flat is the tenant's to register, not the landlord's. */}
        {livesHere && home.status !== "error" ? (
          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 15, backgroundColor: colors.surface, padding: 15 }}>
            <AppText variant="cardTitle" style={{ marginBottom: 10 }}>
              {t("addAMember")}
            </AppText>
            <TextInput
              value={state.memberNameInput}
              onChangeText={(v) => {
                actions.setMemberNameInput(v);
                if (nameError) setNameError(null);
              }}
              placeholder={t("fullName")}
              placeholderTextColor={colors.inkMuted}
              accessibilityLabel={t("fullName")}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="done"
              onSubmitEditing={add}
              style={{ height: 46, paddingHorizontal: 13, borderWidth: 1, borderColor: nameError ? colors.bad : colors.borderStrong, borderRadius: 11, backgroundColor: colors.surface, color: colors.ink, marginBottom: nameError ? 6 : 10 }}
            />
            {nameError ? (
              <AppText variant="meta" color={colors.badInk} style={{ marginBottom: 10 }}>
                {nameError}
              </AppText>
            ) : null}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              {RELATIONS.map((r) => (
                <OptionButton key={r.key} label={t(r.labelKey)} active={state.relationInput === r.key} flex={1} onPress={() => actions.setRelationInput(r.key)} height={40} />
              ))}
            </View>
            <Button
              label={addFamily.isPending ? "Sending…" : t("addToHousehold")}
              onPress={add}
              loading={addFamily.isPending}
              disabled={!overview}
              height={46}
              fontSize={14.5}
              weight={700}
            />
            <AppText variant="meta" color={colors.inkMuted} style={{ textAlign: "center", marginTop: 10 }}>
              New members are confirmed by the society office before the gate lets them in.
            </AppText>
          </View>
        ) : null}
      </ScreenScroll>
    </View>
  );
}
