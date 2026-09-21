import React from "react";
import { View, Pressable } from "react-native";
import { useTheme } from "../hooks/useTheme";
import { AppText } from "./AppText";
import { Icon } from "./Icon";
import { iconPaths } from "./iconPaths";

/** The back-chevron + title bar every drill-down screen opens with. */
export function ScreenHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: 18,
        paddingVertical: 12,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <Pressable
        onPress={onBack}
        style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.subtle, alignItems: "center", justifyContent: "center" }}
      >
        <Icon d={iconPaths.chevronLeft} size={19} color={colors.ink} strokeWidth={2.1} />
      </Pressable>
      <AppText variant="cardTitle" style={{ fontSize: 15.5, flex: 1 }} numberOfLines={1}>
        {title}
      </AppText>
      {right}
    </View>
  );
}

/** Tab-root screen title bar (no back button) — Dues/Notices/Visitors/Helpdesk. */
export function TitleHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: 22,
        paddingTop: 14,
        paddingBottom: 18,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="screenTitleMobile" style={{ marginBottom: 3 }}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="bodySmall" color={colors.inkSoft}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </View>
  );
}
