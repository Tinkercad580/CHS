import React from "react";
import { View } from "react-native";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { currentUnit, pollTally } from "../../state/selectors";
import { ScreenScroll } from "../../components/ScreenScroll";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { AnimatedPressable } from "../../components/AnimatedPressable";
import { RevealItem } from "../../components/RevealItem";

export function PollDetailScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();
  const unit = currentUnit(state);
  const poll = state.polls.find((p) => p.id === state.activePollId) ?? state.polls[0];
  if (!poll) return null;
  const voted = state.votes[poll.id];
  const options = pollTally(state, poll.id);

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader title="Vote" onBack={actions.back} />
      <ScreenScroll>
        <AppText variant="cardTitleLarge" style={{ fontSize: 21, marginBottom: 8 }}>
          {poll.title}
        </AppText>
        <AppText variant="body" color={colors.inkSoft} style={{ marginBottom: 20 }}>
          {poll.description}
        </AppText>
        <AppText variant="label" style={{ marginBottom: 10 }}>
          {voted ? t("liveTally") : t("castVote")}
        </AppText>
        <View style={{ gap: 9, marginBottom: 16 }}>
          {options.map((o, i) => (
            <RevealItem key={o.key} tier="taggedCard">
            <AnimatedPressable
              onPress={() => actions.castVote(poll.id, o.key)}
              style={{ borderWidth: 1, borderColor: o.picked ? colors.accent : colors.border, borderRadius: 14, backgroundColor: o.picked ? colors.accentWash : colors.surface, padding: 14, overflow: "hidden" }}
            >
              {voted ? (
                <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${o.pct}%`, backgroundColor: o.picked ? colors.accentWash : colors.subtle }} />
              ) : null}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: o.picked ? colors.accent : colors.borderStrong, alignItems: "center", justifyContent: "center" }}>
                  {o.picked ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent }} /> : null}
                </View>
                <AppText variant="cardTitle" style={{ flex: 1, fontSize: 14 }}>
                  {o.label}
                </AppText>
                {voted ? (
                  <AppText variant="moneyMono" color={colors.inkSoft} style={{ fontSize: 13 }} forceLatin>
                    {o.count} · {o.pct}%
                  </AppText>
                ) : null}
              </View>
            </AnimatedPressable>
            </RevealItem>
          ))}
        </View>
        {!voted ? (
          <AppText variant="meta" color={colors.inkMuted} style={{ textAlign: "center" }}>
            {t("cannotChangeVote", { unit: unit.code })}
          </AppText>
        ) : (
          <View style={{ borderWidth: 1, borderColor: colors.okWash, borderRadius: 14, backgroundColor: colors.okWash, padding: 15, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: colors.ok, alignItems: "center", justifyContent: "center" }}>
              <Icon d={iconPaths.check} size={17} color="#FFFFFF" strokeWidth={3} />
            </View>
            <View>
              <AppText variant="cardTitle" color={colors.okInk} style={{ fontSize: 13.5, marginBottom: 2 }}>
                {t("voteCast")}
              </AppText>
              <AppText variant="bodySmall" color={colors.inkSoft}>
                {t("votedLine", { unit: unit.code })}
              </AppText>
            </View>
          </View>
        )}
      </ScreenScroll>
    </View>
  );
}
