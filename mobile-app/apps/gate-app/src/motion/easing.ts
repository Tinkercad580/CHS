/**
 * `--ease` and `--ease-out` from project/design_handoff_sahaj/README.md, "Motion" — as
 * Reanimated `Easing.bezier` curves. `EASE_OUT` drives entrances (stagger, sheets, pop-ins);
 * `EASE_STANDARD` drives state changes (press, toggles).
 */
import { Easing } from "react-native-reanimated";
import { easing } from "@sahaj/shared";

export const EASE_OUT = Easing.bezier(easing.out[0], easing.out[1], easing.out[2], easing.out[3]);
export const EASE_STANDARD = Easing.bezier(easing.standard[0], easing.standard[1], easing.standard[2], easing.standard[3]);
