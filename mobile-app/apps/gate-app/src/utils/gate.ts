import { vehicleOwnerForUnit, type VisitorPass } from "@sahaj/shared";
import { validUntilLabel, expiredAgoLabel } from "./time";
import { colors } from "../theme";

/** Who to show as "Host" on the verdict card — derived from the unit's registered vehicles, never duplicated into the pass record itself. */
export function hostForUnit(unit: string): string {
  return vehicleOwnerForUnit(unit) ?? `Resident of ${unit}`;
}

/** GateAlert carries no resolution flag — a freshly raised alert (this shift) reads as still-active (red); anything older is treated as handled (green), the same split the seed data implies. */
export function alertDotColor(raisedAt: string): string {
  const minutesAgo = (Date.now() - new Date(raisedAt).getTime()) / 60000;
  return minutesAgo < 10 ? colors.stop : colors.go;
}

/** "Until 9:41pm today" / "Standing pass — every day" / "Expired 40 minutes ago" — always derived from the pass's own timestamps, never stored. */
export function passValidityLabel(pass: VisitorPass): string {
  if (pass.kind === "standing" && !pass.validUntil) return "Standing pass — every day";
  if (!pass.validUntil) return "Valid now";
  const expired = pass.state === "expired" || pass.state === "cancelled" || new Date(pass.validUntil).getTime() < Date.now();
  return expired ? expiredAgoLabel(pass.validUntil) : validUntilLabel(pass.validUntil);
}
