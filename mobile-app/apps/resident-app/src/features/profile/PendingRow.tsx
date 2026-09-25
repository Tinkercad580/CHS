import React from "react";
import { View } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { AppText } from "../../components/AppText";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";

/**
 * A request waiting on the society office (myHome → pendingApprovals). Same
 * card as a confirmed row, dashed and chipped so it can't be mistaken for one:
 * the gate doesn't know about it yet.
 */
export function PendingRow({ title, detail, mono }: { title: string; detail: string; mono?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ borderWidth: 1, borderStyle: "dashed", borderColor: colors.borderStrong, borderRadius: 15, backgroundColor: colors.surface, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.warnWash, alignItems: "center", justifyContent: "center" }}>
        <Icon d={iconPaths.clock} size={18} color={colors.warnInk} strokeWidth={1.9} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant={mono ? "cardTitleLarge" : "cardTitle"} style={mono ? { fontSize: 15, letterSpacing: 1, marginBottom: 2 } : { fontSize: 14, marginBottom: 2 }} forceLatin={mono}>
          {title}
        </AppText>
        <AppText variant="meta" color={colors.inkSoft}>
          {detail}
        </AppText>
      </View>
      <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7, backgroundColor: colors.warnWash }}>
        <AppText variant="cardTitle" color={colors.warnInk} style={{ fontSize: 11 }}>
          With the office
        </AppText>
      </View>
    </View>
  );
}
