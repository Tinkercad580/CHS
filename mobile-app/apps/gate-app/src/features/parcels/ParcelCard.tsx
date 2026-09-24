import React from "react";
import { View } from "react-native";
import type { Parcel } from "@sahaj/shared";
import { GateText } from "../../components/GateText";
import { GateCard } from "../../components/GateCard";
import { GateButton } from "../../components/GateButton";
import { StatusPill } from "../../components/StatusPill";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { colors } from "../../theme";
import { stamp } from "../../utils/time";

interface Props {
  parcel: Parcel;
  preference: string;
  onCollect: () => void;
}

export function ParcelCard({ parcel, preference, onCollect }: Props) {
  const pending = parcel.status === "held";
  const meta = pending ? `${parcel.courier} · logged ${stamp(new Date(parcel.loggedAt))}` : `${parcel.courier} · handed over ${parcel.handedAt ? stamp(new Date(parcel.handedAt)) : ""}`;
  return (
    <GateCard>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: pending ? 11 : 0 }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.card2, alignItems: "center", justifyContent: "center" }}>
          <Icon d={iconPaths.parcelBox} color={colors.soft} size={19} strokeWidth={1.9} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <GateText variant="cardTitle" style={{ marginBottom: 2 }}>
            {parcel.unit}
          </GateText>
          <GateText variant="meta" color={colors.soft}>
            {meta}
          </GateText>
          <GateText variant="label" color={colors.hold} style={{ fontSize: 11, marginTop: 4 }}>
            {preference}
          </GateText>
        </View>
        <StatusPill label={pending ? "HELD" : "COLLECTED"} color={pending ? colors.hold : colors.go} />
      </View>
      {pending ? <GateButton label="Handed to resident" variant="secondary" height={42} radius={11} fontSize={13} weight={600} onPress={onCollect} /> : null}
    </GateCard>
  );
}
