import React from "react";
import { Pressable, View } from "react-native";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { currentUnit } from "../../state/selectors";
import { ScreenScroll } from "../../components/ScreenScroll";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";

export function PollsScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();
  const unit = currentUnit(state);
  const canVote = state.role !== "tenant";

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader title={t("votesTitle")} onBack={actions.back} />
      <ScreenScroll>
        {canVote ? (
          <>
            <AppText variant="bodySmall" color={colors.inkSoft} style={{ marginBottom: 16 }}>
              {t("twoItemsOpenIntro", { unit: unit.code })}
            </AppText>
            <View style={{ gap: 11 }}>
              {state.polls.map((poll) => {
                const voted = !!state.votes[poll.id];
                return (
                  <Pressable
                    key={poll.id}
                    onPress={() => actions.openPoll(poll.id)}
                    style={{ borderWidth: 1, borderColor: voted ? colors.border : colors.accent200, borderRadius: 16, backgroundColor: colors.surface, padding: 16 }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: voted ? colors.okWash : colors.warnWash }}>
                        <AppText variant="statusPill" color={voted ? colors.okInk : colors.warnInk}>
                          {voted ? t("votedTag").toUpperCase() : t("openTag").toUpperCase()}
                        </AppText>
                      </View>
                      <AppText variant="meta" color={colors.inkMuted}>
                        Closes 27 Sep, 6pm
                      </AppText>
                    </View>
                    <AppText variant="cardTitle" style={{ fontSize: 15, marginBottom: 5 }}>
                      {poll.title}
                    </AppText>
                    <AppText variant="bodySmall" color={colors.inkSoft}>
                      {poll.options.reduce((a, o) => a + o.votes, 0)} of {poll.totalUnits} owners voted
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <View style={{ borderWidth: 1, borderColor: colors.infoBorder, borderRadius: 16, backgroundColor: colors.infoWash, padding: 20 }}>
            <AppText variant="cardTitle" color={colors.infoInk} style={{ fontSize: 14.5, marginBottom: 6 }}>
              {t("tenantsCannotVoteTitle")}
            </AppText>
            <AppText variant="bodySmall" color={colors.inkSoft} style={{ lineHeight: 20 }}>
              {t("tenantsCannotVoteBody")}
            </AppText>
          </View>
        )}
      </ScreenScroll>
    </View>
  );
}
