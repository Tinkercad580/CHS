import React, { useEffect, useState } from "react";
import { View, ScrollView } from "react-native";
import { keepPreviousData } from "@tanstack/react-query";
import { api, type Vehicle } from "@chs/contract";
import { useApiQuery } from "@chs/api-client/react";
import { GateText } from "../../components/GateText";
import { GateCard } from "../../components/GateCard";
import { GateInput } from "../../components/GateInput";
import { StatusPill } from "../../components/StatusPill";
import { ScreenHeader } from "../../components/ScreenHeader";
import { EmptyState } from "../../components/EmptyState";
import { LoadError } from "../../components/LoadError";
import { Skeleton } from "../../components/Skeleton";
import { RevealItem } from "../../components/RevealItem";
import { colors } from "../../theme";
import { useGate } from "../../state/GateProvider";
import { formatPlate, normalizePlate, useGuard } from "../../api/guard";

/** The API searches from two characters; shorter than that shows the register unfiltered. */
const MIN_SEARCH = 2;
const PAGE = 50;
/** Keystrokes closer together than this are one search, not five. It spaces requests out; it never holds back a result that has arrived. */
const TYPING_PAUSE_MS = 220;

const TYPE_LABEL: Record<Vehicle["type"], string> = { CAR: "Car", TWO_WHEELER: "Two-wheeler", OTHER: "Vehicle" };

function useSettled(value: string): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (value === settled) return;
    const id = setTimeout(() => setSettled(value), TYPING_PAUSE_MS);
    return () => clearTimeout(id);
  }, [value, settled]);
  return settled;
}

/**
 * Plate lookup against the society's vehicle register (`members.vehicles`).
 *
 * The API matches any part of the plate, spaces and dashes ignored, and gives
 * the gate the unit, vehicle, owner and slot — never a phone number. The
 * previous result stays on screen while the next one loads, so the list does
 * not blink on every keystroke.
 */
export function PlateLookupScreen() {
  const { state, actions } = useGate();
  const { societyId } = useGuard();
  const typed = normalizePlate(state.plateQuery);
  const searched = useSettled(typed);
  const searching = searched.length >= MIN_SEARCH;

  const query = useApiQuery(
    api.members.vehicles,
    { params: { societyId }, query: searching ? { plate: searched, limit: PAGE } : { limit: PAGE } },
    { placeholderData: keepPreviousData }
  );
  const settling = typed !== searched || query.isPlaceholderData;

  let label: string;
  let list: React.ReactNode;
  if (query.status === "pending") {
    label = "Loading the register…";
    // A card: plate row + one detail line inside 14px padding.
    list = (
      <View style={{ gap: 9 }}>
        <Skeleton height={76} />
        <Skeleton height={76} />
        <Skeleton height={76} />
      </View>
    );
  } else if (query.status === "error") {
    label = "Register unavailable";
    list = <LoadError title="Couldn't search the register" message={query.error.message} onRetry={() => void query.refetch()} retrying={query.isRefetching} />;
  } else {
    const { items, nextCursor } = query.data;
    if (settling) label = "Searching…";
    else if (searching) label = `${items.length}${nextCursor ? "+" : ""} match${items.length === 1 && !nextCursor ? "" : "es"}`;
    else if (typed.length > 0) label = "Keep typing — two characters or more";
    else label = nextCursor ? `First ${items.length} registered vehicles · type to search` : `${items.length} plates registered`;

    list =
      searching && !settling && items.length === 0 ? (
        <EmptyState title="Not a registered plate" detail="Treat it as a walk-in and ask the flat." />
      ) : items.length === 0 ? (
        <EmptyState title="No vehicles registered" detail="The society office hasn't added any vehicles to the register yet." />
      ) : (
        <View style={{ gap: 9, opacity: settling ? 0.6 : 1 }}>
          {items.map((v) => (
            <RevealItem key={v.id} tier="taggedCard">
              <VehicleCard vehicle={v} />
            </RevealItem>
          ))}
        </View>
      );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
      <RevealItem tier="screenBlock">
        <ScreenHeader title="Plate lookup" onBack={() => actions.goBack()} />
        <GateText variant="bodySmall" color={colors.soft} style={{ marginBottom: 16 }}>
          Type any part of a number. Registered plates open the barrier.
        </GateText>

        <View style={{ marginBottom: 16 }}>
          <GateInput
            mono
            placeholder="4471 or MH 12"
            value={state.plateQuery}
            onChangeText={actions.setPlateQuery}
            height={54}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            returnKeyType="search"
            accessibilityLabel="Plate number"
            selectionColor={colors.go}
            maxLength={15}
          />
        </View>
      </RevealItem>

      <RevealItem tier="screenBlock">
        <GateText variant="label" color={colors.soft} style={{ marginBottom: 11 }} accessibilityLiveRegion="polite">
          {label}
        </GateText>
        {list}
      </RevealItem>
    </ScrollView>
  );
}

function VehicleCard({ vehicle: v }: { vehicle: Vehicle }) {
  const detail = [v.ownerName, v.unitLabel, v.make ?? TYPE_LABEL[v.type], v.colour?.toLowerCase()].filter(Boolean).join(" · ");
  return (
    <GateCard edgeColor={colors.go}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 7 }}>
        <GateText variant="gateCodeKeypad" style={{ fontSize: 16, letterSpacing: 0.8 }}>
          {formatPlate(v.plate)}
        </GateText>
        {v.parkingSlotCode ? <StatusPill label={`SLOT ${v.parkingSlotCode}`} color={colors.go} /> : null}
      </View>
      <GateText variant="body" color={colors.soft} style={{ fontSize: 12.5 }}>
        {detail}
      </GateText>
    </GateCard>
  );
}
