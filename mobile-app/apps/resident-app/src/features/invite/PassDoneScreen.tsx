import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming, useReducedMotion } from "react-native-reanimated";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { AppText } from "../../components/AppText";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { Button } from "../../components/Button";
import { EASE_OUT } from "../../components/motion";
import { LocalOnlyNote } from "../../components/LocalOnlyNote";

export function PassDoneScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();
  const code = state.newPassCode ?? "";
  const pass = state.passes.find((p) => p.code === code);
  const standing = pass?.kind === "standing";

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas, paddingTop: 44, paddingHorizontal: 26, alignItems: "center" }}>
      <PopInGlyph>
        <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: colors.okWash, alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <Icon d={iconPaths.check} size={36} color={colors.okInk} strokeWidth={2.6} />
        </View>
      </PopInGlyph>
      <AppText variant="screenTitleMobile" style={{ marginBottom: 8, textAlign: "center" }}>
        {standing ? t("standingPassIssued") : t("passCreatedTitle")}
      </AppText>
      <AppText variant="body" color={colors.inkSoft} style={{ textAlign: "center", marginBottom: 26 }}>
        {pass ? `${pass.name} can enter with this ${standing ? "pass" : "code"}. ${pass.purpose}.` : ""}
      </AppText>
      <View style={{ borderWidth: 1, borderColor: colors.accent200, borderRadius: 18, backgroundColor: colors.accentWash, padding: 24, marginBottom: 24, alignSelf: "stretch", alignItems: "center" }}>
        <AppText variant="eyebrow" color={colors.accentInk} forceLatin style={{ marginBottom: 12 }}>
          {(standing ? t("staffPass") : t("gateCode")).toUpperCase()}
        </AppText>
        <AppText variant="moneyHero" style={{ fontSize: 40, letterSpacing: 6 }} forceLatin>
          {code}
        </AppText>
      </View>
      <View style={{ alignSelf: "stretch" }}>
        <LocalOnlyNote>Saved on this phone only. The gate can't check this code yet.</LocalOnlyNote>
      </View>
      <Button label={standing ? t("sendPassToThem") : t("shareWithGuest")} onPress={actions.sharePass} height={50} fontSize={15} weight={700} style={{ alignSelf: "stretch", marginBottom: 11 }} />
      <Button label={standing ? t("seeAttendance") : t("backToVisitors")} kind="secondary" height={50} fontSize={15} weight={600} onPress={actions.goAfterPassDone} style={{ alignSelf: "stretch" }} />
    </View>
  );
}

/** `popIn`: scale(.5)→1.1→1 + opacity 0→1 — the pass-created checkmark, README's "Success glyphs" (mirrors `PaymentSheets`' `PopInGlyph`). */
function PopInGlyph({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      scale.value = 1;
      opacity.value = 1;
      return;
    }
    scale.value = withSequence(withTiming(1.1, { duration: 220, easing: EASE_OUT }), withTiming(1, { duration: 140, easing: EASE_OUT }));
    opacity.value = withTiming(1, { duration: 220, easing: EASE_OUT });
  }, [reduced, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}
