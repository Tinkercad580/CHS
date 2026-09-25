import React from "react";
import { View } from "react-native";
import { GateText } from "./GateText";
import { GateButton } from "./GateButton";
import { Icon } from "./Icon";
import { iconPaths } from "./iconPaths";
import { colors, withAlpha } from "../theme";

/**
 * The `error` branch of a LoadState: what failed, in the server's words, and a
 * way to try again. A request that fails must never leave a skeleton standing
 * in for it (docs/LOADING_AND_MOTION.md). Solid-bordered, unlike EmptyState's
 * dashed card — nothing is missing here, something went wrong.
 */
export function LoadError({ title, message, onRetry, retrying = false }: { title: string; message: string; onRetry?: () => void; retrying?: boolean }) {
  return (
    <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.card, paddingVertical: 24, paddingHorizontal: 18, alignItems: "center" }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: withAlpha(colors.hold, 0.16), alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <Icon d={iconPaths.alertTriangle} color={colors.hold} size={19} strokeWidth={2.1} />
      </View>
      <GateText variant="cardTitle" style={{ marginBottom: 5, textAlign: "center" }}>
        {title}
      </GateText>
      <GateText variant="bodySmall" color={colors.soft} style={{ textAlign: "center", marginBottom: onRetry ? 16 : 0 }}>
        {message}
      </GateText>
      {onRetry ? (
        // Stretched: the card centres its text, and a centred GateButton would shrink to its label.
        <View style={{ alignSelf: "stretch" }}>
          <GateButton label={retrying ? "Trying again…" : "Try again"} variant="secondary" height={46} fontSize={14.5} weight={600} radius={13} loading={retrying} onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}
