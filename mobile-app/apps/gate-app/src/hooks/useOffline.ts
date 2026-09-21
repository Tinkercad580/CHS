import { useNetworkState } from "expo-network";

/**
 * The OFFLINE pill in the status bar reflects the device's real connectivity —
 * there is no backend to be offline from, but the handset itself can lose signal,
 * and the design calls for that indicator to be genuine, not a toggle.
 */
export function useOffline(): boolean {
  const net = useNetworkState();
  if (net.isConnected === undefined) return false;
  return !net.isConnected || net.isInternetReachable === false;
}
