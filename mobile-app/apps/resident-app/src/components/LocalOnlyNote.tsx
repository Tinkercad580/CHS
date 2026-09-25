import React from "react";
import { View } from "react-native";
import { useTheme } from "../hooks/useTheme";
import { AppText } from "./AppText";
import { Icon } from "./Icon";
import { iconPaths } from "./iconPaths";

/**
 * Says plainly that a feature isn't connected to the society yet: what it shows
 * is sample data or kept on this phone, and nothing it does reaches the office
 * or the gate. Used on the screens that still run on local fixtures (visitors,
 * helpdesk, amenities, votes, deliveries…) so none of them implies something
 * was sent. In the info colours, quieter than a warning — the screen still works.
 */
export function LocalOnlyNote({ children, marginBottom = 16 }: { children: string; marginBottom?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ borderWidth: 1, borderColor: colors.infoBorder, borderRadius: 12, backgroundColor: colors.infoWash, padding: 12, flexDirection: "row", gap: 10, marginBottom }}>
      <Icon d={iconPaths.alert} size={16} color={colors.infoInk} strokeWidth={2} />
      <AppText variant="bodySmall" color={colors.inkSoft} style={{ flex: 1, minWidth: 0 }}>
        {children}
      </AppText>
    </View>
  );
}
