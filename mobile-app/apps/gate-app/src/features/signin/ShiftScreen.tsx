import React, { useEffect, useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GateText } from "../../components/GateText";
import { DigitBoxes } from "../../components/DigitBoxes";
import { Keypad } from "../../components/Keypad";
import { GateButton } from "../../components/GateButton";
import { RevealItem } from "../../components/RevealItem";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { colors } from "../../theme";
import { initials } from "../../utils/time";
import { useGate } from "../../state/GateProvider";
import { useOffline } from "../../hooks/useOffline";
import { shiftLine } from "./shiftLine";
import { MAX_PIN_FAILURES, PIN_LENGTH, loadPin, savePin, type StoredPin } from "./shiftPin";

/**
 * The locked handset — Gate App.dc.html "01 Shift unlock", the prototype's
 * "Sign in to start your shift". This is the ONLY thing that mounts while
 * `!onDuty`, so no other screen can leak a live visitor code before a guard is
 * on duty (README.md, "Sign-in gate").
 *
 * By the time it shows, the password sign-in has already said who the guard is;
 * the card shows that account's name. The PIN is local (see shiftPin.ts): the
 * first time after a sign-in the guard chooses one, typed twice; after that it
 * unlocks this handset for the same account and checks nothing else. The fifth
 * wrong entry signs out for real (`onSignOut`: push unregistered, session
 * revoked), so a guessed PIN cannot outlast the password.
 */
export function ShiftScreen({ userId, guardName, societyName, onSignOut, signingOut }: { userId: string; guardName: string; societyName: string; onSignOut: () => void; signingOut: boolean }) {
  const { actions } = useGate();
  const offline = useOffline();
  const insets = useSafeAreaInsets();
  // undefined while the keychain is read — a local read, so nothing is drawn for it.
  const [stored, setStored] = useState<StoredPin | null | undefined>(undefined);
  const [pin, setPin] = useState("");
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    void loadPin(userId).then((p) => {
      if (live) setStored(p);
    });
    return () => {
      live = false;
    };
  }, [userId]);

  const exhausted = !!stored && stored.failures >= MAX_PIN_FAILURES;
  // Also covers a count already at the limit when the screen opens — the app was
  // closed between the fifth wrong PIN and the sign-out finishing.
  useEffect(() => {
    if (exhausted) onSignOut();
  }, [exhausted, onSignOut]);

  if (stored === undefined) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const choosing = stored === null;
  const confirming = choosing && first !== null;

  const onKey = (key: string) => {
    if (exhausted) return;
    setError(null);
    if (key === "clear") setPin("");
    else if (key === "del") setPin((p) => p.slice(0, -1));
    else setPin((p) => (p.length >= PIN_LENGTH ? p : p + key));
  };

  const submit = async () => {
    if (pin.length < PIN_LENGTH || saving) return;
    if (choosing && !confirming) {
      setFirst(pin);
      setPin("");
      return;
    }
    if (choosing) {
      if (pin !== first) {
        setFirst(null);
        setPin("");
        setError("The two PINs didn't match. Choose one again.");
        return;
      }
      setSaving(true);
      const startedAt = new Date().toISOString();
      await savePin(userId, { pin, failures: 0, startedAt }).catch(() => undefined);
      actions.startShift(guardName, startedAt);
      return;
    }
    if (pin === stored.pin) {
      if (stored.failures > 0) await savePin(userId, { ...stored, failures: 0 }).catch(() => undefined);
      actions.resumeShift(guardName, stored.startedAt);
      return;
    }
    const next = { ...stored, failures: stored.failures + 1 };
    await savePin(userId, next).catch(() => undefined);
    setStored(next);
    setPin("");
    const left = MAX_PIN_FAILURES - next.failures;
    setError(left > 0 ? `Wrong PIN · ${left} ${left === 1 ? "try" : "tries"} left, then you're signed out` : null);
  };

  const title = choosing ? "Start your shift" : "Handset locked";
  const lead = choosing
    ? "Choose a four-digit duty PIN. It opens this handset again if you lock it or the app restarts during your shift. It stays on this handset and is cleared when you sign out."
    : "Enter your duty PIN to carry on with your shift. Everything you do is recorded against your name.";
  const label = confirming ? "Enter the same PIN again" : choosing ? "Choose a duty PIN" : "Duty PIN";
  const remainingDigits = PIN_LENGTH - pin.length;
  const hint = exhausted
    ? "Too many wrong PINs · signing out, sign in again with your password"
    : error
      ? error
      : pin.length === 0
        ? confirming
          ? "Type it once more to confirm"
          : "Four digits"
        : remainingDigits > 0
          ? `${remainingDigits} more`
          : confirming || !choosing
            ? "Ready"
            : "Ready — next, confirm it";
  const cardLine = stored ? shiftLine(societyName, stored.startedAt) : `Signed in at ${societyName}`;
  const buttonLabel = saving ? "Starting…" : confirming ? "Start shift" : choosing ? "Next" : "Unlock";

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 22, paddingTop: 26, paddingBottom: 30 + insets.bottom }} keyboardShouldPersistTaps="handled">
      <RevealItem tier="screenBlock">
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 26 }}>
          <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.go, alignItems: "center", justifyContent: "center" }}>
            <Icon d={choosing ? iconPaths.shield : iconPaths.lock} color={colors.goInk} size={24} strokeWidth={2.1} />
          </View>
          {offline ? (
            <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(232,163,61,0.18)" }}>
              <GateText variant="label" color={colors.hold} style={{ fontSize: 9.5, letterSpacing: 0.6 }}>
                OFFLINE
              </GateText>
            </View>
          ) : null}
        </View>

        <GateText variant="screenTitleMobile" accessibilityRole="header" style={{ fontSize: 26, lineHeight: 30, letterSpacing: -0.7, marginBottom: 8 }}>
          {title}
        </GateText>
        <GateText variant="bodySmall" color={colors.soft} style={{ marginBottom: 24 }}>
          {lead}
        </GateText>
      </RevealItem>

      <RevealItem tier="screenBlock">
        <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.card, padding: 15, flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 20 }}>
          <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: colors.card2, alignItems: "center", justifyContent: "center" }}>
            <GateText variant="cardTitleLarge" color={colors.go} style={{ fontSize: 14 }}>
              {initials(guardName)}
            </GateText>
          </View>
          <View style={{ flex: 1 }}>
            <GateText variant="cardTitle" style={{ marginBottom: 2 }}>
              {guardName}
            </GateText>
            <GateText variant="meta" color={colors.soft}>
              {cardLine}
            </GateText>
          </View>
        </View>
      </RevealItem>

      <RevealItem tier="screenBlock">
        <GateText variant="label" color={colors.soft} style={{ marginBottom: 10 }}>
          {label}
        </GateText>
        <View style={{ marginBottom: 8 }}>
          <DigitBoxes value={pin} length={PIN_LENGTH} mask error={!!error || exhausted} />
        </View>
        <GateText variant="body" color={error || exhausted ? "#F7B5AE" : colors.dim} accessibilityLiveRegion="polite" style={{ fontSize: 12, minHeight: 20, marginBottom: 14 }}>
          {hint}
        </GateText>

        {exhausted ? (
          <GateButton label={signingOut ? "Signing out…" : "Sign in with password"} onPress={onSignOut} loading={signingOut} />
        ) : (
          <>
            <View style={{ marginBottom: 16 }}>
              <Keypad onKey={onKey} />
            </View>
            <GateButton label={buttonLabel} variant={pin.length === PIN_LENGTH ? "primary" : "disabled"} loading={saving} onPress={() => void submit()} />
          </>
        )}

        {exhausted ? null : (
          <Pressable
            onPress={onSignOut}
            disabled={signingOut}
            accessibilityRole="button"
            hitSlop={8}
            style={{ alignSelf: "center", marginTop: 14, paddingVertical: 4 }}
          >
            <GateText variant="meta" color={colors.dim} style={{ textAlign: "center" }}>
              {signingOut ? "Signing out…" : choosing ? `Not ${guardName}? ` : "Forgot it? "}
              {signingOut ? null : (
                <GateText variant="meta" color={colors.go}>
                  Sign out
                </GateText>
              )}
            </GateText>
          </Pressable>
        )}
      </RevealItem>
    </ScrollView>
  );
}
