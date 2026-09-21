import React from "react";
import { View } from "react-native";
import { radius } from "@sahaj/shared";
import { AppText } from "./AppText";

/** Small tag/status chip — background+foreground are passed in since every screen picks semantic tokens differently. */
export function StatusPill({ label, bg, fg, mono }: { label: string; bg: string; fg: string; mono?: boolean }) {
  return (
    <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.chip, backgroundColor: bg, alignSelf: "flex-start" }}>
      <AppText variant="statusPill" color={fg} forceLatin={mono}>
        {label}
      </AppText>
    </View>
  );
}
