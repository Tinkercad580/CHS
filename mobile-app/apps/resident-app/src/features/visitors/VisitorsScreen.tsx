import React from "react";
import { View } from "react-native";
import type { VisitorPass } from "@sahaj/shared";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { currentUnit, expectedPasses } from "../../state/selectors";
import { ScreenScroll } from "../../components/ScreenScroll";
import { TitleHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { iconPaths } from "../../components/iconPaths";
import { AnimatedPressable } from "../../components/AnimatedPressable";
import { RevealItem } from "../../components/RevealItem";
import { LocalOnlyNote } from "../../components/LocalOnlyNote";

function initialsOf(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function stateLabel(pass: VisitorPass): "Expected" | "Inside" | "Standing" | "Expired" {
  if (pass.state === "expected") return "Expected";
  if (pass.state === "inside") return "Inside";
  if (pass.state === "standing") return "Standing";
  return "Expired";
}

export function VisitorsScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();
  const unit = currentUnit(state);
  const passesForUnit = state.passes.filter((p) => p.unit === unit.code);
  const expected = expectedPasses(state).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <TitleHeader
        title={t("visitorsTitle")}
        subtitle={t("visitorCountLine", { n: passesForUnit.length, expected })}
        right={<Button label={t("invite")} onPress={actions.goInvite} height={40} fontSize={13.5} weight={600} style={{ paddingHorizontal: 15 }} />}
      />
      <ScreenScroll>
        <LocalOnlyNote>Not connected to the gate yet. These passes are samples or ones kept on this phone, so the guard won't find your guest's code.</LocalOnlyNote>
        {passesForUnit.length === 0 ? (
          <EmptyState iconPath={iconPaths.people} title={t("noPassesYet")} body={t("noPassesSub")} actionLabel={t("inviteAGuest")} onAction={actions.goInvite} />
        ) : (
          <View style={{ gap: 11 }}>
            {passesForUnit.map((pass, i) => {
              const state2 = stateLabel(pass);
              const stateBg = state2 === "Inside" ? colors.okWash : state2 === "Standing" ? colors.infoWash : colors.warnWash;
              const stateFg = state2 === "Inside" ? colors.okInk : state2 === "Standing" ? colors.infoInk : colors.warnInk;
              const cancellable = pass.state === "expected" || pass.state === "standing";
              return (
                <RevealItem key={pass.id} tier="listRow">
                <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, padding: 15 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: state2 === "Inside" ? colors.okWash : colors.subtle, alignItems: "center", justifyContent: "center" }}>
                      <AppText variant="cardTitleLarge" color={state2 === "Inside" ? colors.okInk : colors.inkSoft} style={{ fontSize: 13 }} forceLatin>
                        {initialsOf(pass.name)}
                      </AppText>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <AppText variant="cardTitle" style={{ fontSize: 14 }}>
                        {pass.name}
                      </AppText>
                      <AppText variant="meta" color={colors.inkSoft}>
                        {pass.purpose}{pass.kind === "standing" ? " · standing permission" : ""}
                      </AppText>
                    </View>
                    <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7, backgroundColor: stateBg }}>
                      <AppText variant="cardTitle" color={stateFg} style={{ fontSize: 11 }}>
                        {state2}
                      </AppText>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                    <View style={{ flex: 1, height: 40, borderRadius: 11, backgroundColor: colors.subtle, alignItems: "center", justifyContent: "center" }}>
                      <AppText variant="moneyMono" style={{ fontSize: 15, letterSpacing: 3 }} forceLatin>
                        {pass.code}
                      </AppText>
                    </View>
                    {cancellable ? (
                      <AnimatedPressable
                        onPress={() => actions.cancelPass(pass)}
                        style={{ height: 40, paddingHorizontal: 14, borderRadius: 11, borderWidth: 1, borderColor: colors.badBorder, alignItems: "center", justifyContent: "center" }}
                      >
                        <AppText variant="cardTitle" color={colors.badInk} style={{ fontSize: 12.5 }}>
                          {t("cancel")}
                        </AppText>
                      </AnimatedPressable>
                    ) : null}
                  </View>
                </View>
                </RevealItem>
              );
            })}
          </View>
        )}
      </ScreenScroll>
    </View>
  );
}
