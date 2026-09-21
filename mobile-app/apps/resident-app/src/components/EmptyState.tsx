import React from "react";
import { View } from "react-native";
import { useTheme } from "../hooks/useTheme";
import { AppText } from "./AppText";
import { Icon } from "./Icon";
import { Button } from "./Button";

/** Icon tile + plain-language line + explanation + optional filling action (README's "Empty states" convention). */
export function EmptyState({
  iconPath,
  title,
  body,
  actionLabel,
  onAction,
  dashed = true,
}: {
  iconPath: string;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  dashed?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        borderWidth: 1,
        borderStyle: dashed ? "dashed" : "solid",
        borderColor: colors.borderStrong,
        borderRadius: 16,
        backgroundColor: colors.surface,
        padding: 28,
        alignItems: "center",
      }}
    >
      <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: colors.subtle, alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <Icon d={iconPath} size={22} color={colors.inkMuted} strokeWidth={1.8} />
      </View>
      <AppText variant="cardTitle" style={{ fontSize: 15, marginBottom: 5, textAlign: "center" }}>
        {title}
      </AppText>
      <AppText variant="bodySmall" color={colors.inkSoft} style={{ textAlign: "center", marginBottom: actionLabel ? 16 : 0 }}>
        {body}
      </AppText>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} height={44} style={{ paddingHorizontal: 20, alignSelf: "stretch" }} /> : null}
    </View>
  );
}
