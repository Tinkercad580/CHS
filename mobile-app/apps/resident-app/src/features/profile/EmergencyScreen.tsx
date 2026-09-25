import React from "react";
import { Linking, View } from "react-native";
import { toLoadState } from "@chs/api-client/react";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { formatPhone, telUrl, useSocietyProfile } from "../../api/society";
import { ScreenScroll } from "../../components/ScreenScroll";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { AnimatedPressable } from "../../components/AnimatedPressable";
import { Skeleton } from "../../components/Skeleton";
import { LoadError } from "../../components/LoadError";

/** India's single emergency number (ERSS): police, fire and ambulance. */
const EMERGENCY_NUMBER = "112";

/**
 * Emergency. The design's hold-to-raise alert needs a backend that tells the
 * gate and the committee, and there is none yet — so instead of a button that
 * says "Help is on the way" and sends nothing, the screen says plainly that
 * alerts aren't connected and puts the calls that do work one tap away: 112,
 * and the society office's number from its profile (society.get).
 */
export function EmergencyScreen() {
  const { actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();
  const society = toLoadState(useSocietyProfile());

  const call = (raw: string, who: string) => {
    Linking.openURL(telUrl(raw)).catch(() => actions.toast(`Couldn't start a call on this phone. Dial ${formatPhone(raw)} for ${who}.`, "warn"));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader title={t("emergencyTitle")} onBack={actions.back} />
      <ScreenScroll>
        <View accessibilityRole="alert" style={{ borderWidth: 1, borderColor: colors.warnBorder, borderRadius: 15, backgroundColor: colors.warnWash, padding: 15, flexDirection: "row", gap: 12, marginBottom: 20 }}>
          <Icon d={iconPaths.alert} size={19} color={colors.warnInk} strokeWidth={2} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="cardTitle" color={colors.warnInk} style={{ fontSize: 13.5, marginBottom: 3 }}>
              Emergency alerts aren't connected yet
            </AppText>
            <AppText variant="bodySmall" color={colors.inkSoft}>
              Sahaj can't alert the gate or the committee from this phone yet. In an emergency, call for help directly.
            </AppText>
          </View>
        </View>

        {/* The design's big red hold button, now a single tap that dials. */}
        <AnimatedPressable
          onPress={() => call(EMERGENCY_NUMBER, "emergency services")}
          accessibilityRole="button"
          accessibilityLabel="Call 112, emergency services"
          style={{ width: "100%", height: 124, borderRadius: 22, backgroundColor: "#CF4137", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Icon d={iconPaths.phone} size={22} color="#FFFFFF" strokeWidth={2} />
            <AppText variant="cardTitleLarge" color="#FFFFFF" style={{ fontSize: 21 }} forceLatin>
              Call {EMERGENCY_NUMBER}
            </AppText>
          </View>
          <AppText variant="cardTitle" color="rgba(255,255,255,0.88)" style={{ fontSize: 12.5, fontWeight: "500" as const }}>
            Police, fire and ambulance, anywhere in India
          </AppText>
        </AnimatedPressable>

        <AppText variant="label" color={colors.inkSoft} style={{ marginTop: 22, marginBottom: 10 }}>
          Society office
        </AppText>
        {society.status === "loading" ? (
          <Skeleton height={76} radius={16} />
        ) : society.status === "error" ? (
          <LoadError title="Couldn't load the office's number" message={society.message} onRetry={society.retry} />
        ) : (
          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, padding: 15, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.accentWash, alignItems: "center", justifyContent: "center" }}>
              <Icon d={iconPaths.society} size={19} color={colors.accentInk} strokeWidth={1.9} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="cardTitle" style={{ fontSize: 14, marginBottom: 2 }}>
                {society.data.name}
              </AppText>
              <AppText variant="meta" color={colors.inkSoft} forceLatin={!!society.data.contactPhone}>
                {society.data.contactPhone ? formatPhone(society.data.contactPhone) : "No office number on record"}
              </AppText>
            </View>
            {society.data.contactPhone ? (
              <Button
                label="Call office"
                kind="secondary"
                onPress={() => call(society.data.contactPhone as string, "the society office")}
                height={40}
                fontSize={13}
                weight={600}
                style={{ paddingHorizontal: 14 }}
              />
            ) : null}
          </View>
        )}
      </ScreenScroll>
    </View>
  );
}
