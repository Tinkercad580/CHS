import React from "react";
import { SessionGate } from "../features/auth/SessionGate";

/**
 * The gate handset has exactly one route. SessionGate decides between the
 * sign-in, the duty-PIN shift screen and the shell — and which subtree mounts
 * is gated on session and duty state, not just which chrome shows, so a locked
 * handset never mounts the shell that holds every live visitor code
 * (README.md, "Sign-in gate").
 *
 * Only the top safe-area edge is applied (in SessionGate) — the real OS status
 * bar (tinted by expo-status-bar in _layout.tsx) already occupies that space on
 * device, and its actual height adapts to whatever notch/punch-hole/no-cutout
 * shape that specific phone has. The bottom edge is left to TabBar and the
 * sign-in screens, which add their own inset so it isn't padded twice.
 */
export default function GateApp() {
  return <SessionGate />;
}
