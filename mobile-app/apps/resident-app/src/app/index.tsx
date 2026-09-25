import React from "react";
import { SessionGate } from "../features/auth/SessionGate";

/**
 * The resident app's single route. SessionGate decides between sign-in and the
 * app; once signed in, every screen is a state switch inside ResidentShell (see
 * its header comment). Only the top safe-area edge is applied by the gate; the
 * bottom edge is left to TabBar and to each sign-in screen, which pad their own
 * so it isn't applied twice.
 */
export default function ResidentApp() {
  return <SessionGate />;
}
