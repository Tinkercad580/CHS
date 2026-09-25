import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View, type TextInputProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GateText } from "../../components/GateText";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { colors, withAlpha } from "../../theme";
import { fontFamilyFor } from "../../theme/fonts";

export { splitError } from "../../api/errors";

/**
 * The building blocks of the handset's sign-in screens.
 *
 * The gate design has no password sign-in — it assumed a device already bound
 * to the gate (MASTER_SPEC C9, not built yet), so the guard's identity has to
 * come from the same mobile-and-password sign-in the resident app uses. These
 * screens take that flow and draw it in the gate's own language: the shift
 * screen's column (22px sides, 26px top, 26/30 title), the visitor form's
 * uppercase field labels and 54px card-2 fields, GateButton for the action.
 *
 * Every screen is one column with the action cluster pinned to the bottom. On a
 * phone the keyboard takes half of that, so the column scrolls and rides above
 * the keyboard instead of hiding the button under it.
 */
export function AuthScreen({
  back,
  children,
  footer,
}: {
  back?: { label: string; onPress: () => void };
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingTop: back ? 16 : 26, paddingHorizontal: 22, paddingBottom: 26 + insets.bottom }}
      >
        {back ? <BackRow label={back.label} onPress={back.onPress} /> : null}
        {children}
        {/* margin-top:auto — whatever is left of the screen sits between the form and its action. */}
        <View style={{ flexGrow: 1, minHeight: 24 }} />
        {footer}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** The gate's back control (ScreenHeader's 40px square) beside the number being signed in: the way back, and whose account this is. */
function BackRow({ label, onPress }: { label: string; onPress: () => void }) {
  const number = label.startsWith("+");
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={number ? `Change number, ${label}` : label}
      hitSlop={8}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 26, alignSelf: "flex-start" }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" }}>
        <Icon d={iconPaths.backChevron} color={colors.ink} size={19} strokeWidth={2.1} />
      </View>
      <GateText variant={number ? "gateCodeKeypad" : "label"} color={colors.soft} style={{ fontSize: number ? 15 : 14, lineHeight: 18, letterSpacing: number ? 0.9 : 0 }}>
        {label}
      </GateText>
    </Pressable>
  );
}

/** The 46px tile carrying the screen's one icon — the shift screen's shield tile, recoloured per state. */
export function IconTile({ path, tone = "go" }: { path: string; tone?: "go" | "hold" | "stop" }) {
  const solid = tone === "go";
  const fg = tone === "go" ? colors.goInk : tone === "hold" ? colors.hold : colors.stop;
  const bg = solid ? colors.go : withAlpha(tone === "hold" ? colors.hold : colors.stop, 0.16);
  return (
    <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: bg, alignItems: "center", justifyContent: "center", marginBottom: 26 }}>
      <Icon d={path} color={fg} size={24} strokeWidth={2.1} />
    </View>
  );
}

/** 700 26/30, -0.028em — "Sign in to start your shift". */
export function AuthTitle({ children, marginBottom = 8 }: { children: React.ReactNode; marginBottom?: number }) {
  return (
    <GateText variant="screenTitleMobile" accessibilityRole="header" style={{ fontSize: 26, lineHeight: 30, letterSpacing: -0.7, marginBottom }}>
      {children}
    </GateText>
  );
}

/** 400 13.5/1.55 soft. */
export function AuthLead({ children, marginBottom = 24 }: { children: React.ReactNode; marginBottom?: number }) {
  return (
    <GateText variant="bodySmall" color={colors.soft} style={{ fontSize: 13.5, lineHeight: 21, marginBottom }}>
      {children}
    </GateText>
  );
}

/** Hints and footnotes, in the shift screen's dim meta. */
export function AuthNote({ children, center, style }: { children: React.ReactNode; center?: boolean; style?: object }) {
  return (
    <GateText variant="meta" color={colors.dim} style={[{ fontSize: 12, lineHeight: 18 }, center ? { textAlign: "center" } : null, style]}>
      {children}
    </GateText>
  );
}

interface FieldProps extends Omit<TextInputProps, "style" | "secureTextEntry"> {
  label: string;
  error?: string | null;
  /** "+91" — its own segment with a divider, not part of the value. */
  prefix?: string;
  /** Password field: dots with wide tracking, plus a show/hide control when `revealable`. */
  secret?: boolean;
  revealable?: boolean;
  inputRef?: React.Ref<TextInput>;
  marginTop?: number;
}

/**
 * A labelled field, as the visitor form draws one: an uppercase 12px label, a
 * 54px card-2 box whose border turns go on focus (stop on error), and a mono
 * value for numbers. The server's message sits directly under the field it
 * belongs to.
 */
export function AuthField({ label, error, prefix, secret, revealable, inputRef, marginTop = 0, onFocus, onBlur, value, ...input }: FieldProps) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const hidden = !!secret && !revealed;
  const edge = error ? colors.stop : focused ? colors.go : colors.line;
  const thick = focused || !!error;

  const valueFont = prefix
    ? { fontFamily: fontFamilyFor("mono", 600), fontSize: 18, letterSpacing: 1.1 }
    : hidden && value
      ? { fontFamily: fontFamilyFor("sans", 700), fontSize: 16, letterSpacing: 3.5 }
      : { fontFamily: fontFamilyFor("sans", 500), fontSize: 15.5 };

  return (
    <View style={{ marginTop }}>
      <GateText variant="label" color={colors.soft} style={{ fontSize: 12, lineHeight: 12, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8 }}>
        {label}
      </GateText>
      <View
        style={{
          height: 54,
          flexDirection: "row",
          alignItems: "center",
          borderRadius: 13,
          // Width changes 1 → 1.5 on focus; the padding gives back the difference so the text never shifts.
          borderWidth: thick ? 1.5 : 1,
          borderColor: edge,
          backgroundColor: colors.card2,
        }}
      >
        {prefix ? (
          <View style={{ paddingLeft: thick ? 14.5 : 15, paddingRight: 12, borderRightWidth: 1, borderRightColor: colors.line }}>
            <GateText variant="gateCodeKeypad" color={colors.soft} style={{ fontSize: 16, lineHeight: 18 }}>
              {prefix}
            </GateText>
          </View>
        ) : null}
        <TextInput
          {...input}
          ref={inputRef}
          value={value}
          secureTextEntry={hidden}
          accessibilityLabel={label}
          placeholderTextColor={colors.dim}
          selectionColor={colors.go}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            // The field draws its own focus edge; on web the browser's outline would sit inside it.
            { flex: 1, height: "100%", paddingHorizontal: prefix ? 12 : thick ? 14.5 : 15, color: colors.ink, outlineStyle: "solid", outlineWidth: 0 },
            valueFont,
          ]}
        />
        {secret && revealable ? (
          <Pressable
            onPress={() => setRevealed((r) => !r)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
            hitSlop={8}
            style={{ width: 48, height: "100%", alignItems: "center", justifyContent: "center" }}
          >
            <Icon d={revealed ? iconPaths.eyeOff : iconPaths.eye} size={19} color={colors.soft} strokeWidth={1.9} />
          </Pressable>
        ) : null}
      </View>
      {error ? <FieldError>{error}</FieldError> : null}
    </View>
  );
}

/** The same pale red the shift screen uses for a rejected PIN. */
export const ERROR_INK = "#F7B5AE";

export function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <GateText variant="body" color={ERROR_INK} accessibilityLiveRegion="polite" style={{ fontSize: 12.5, lineHeight: 18.75, marginTop: 7 }}>
      {children}
    </GateText>
  );
}

/** One password rule: an empty ring until it passes, then a go tick. */
export function RuleRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
      <View
        style={{
          width: 17,
          height: 17,
          borderRadius: 8.5,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: ok ? colors.go : "transparent",
          borderWidth: ok ? 0 : 1.5,
          borderColor: colors.line,
        }}
      >
        {ok ? <Icon d={iconPaths.check} size={10} color={colors.goInk} strokeWidth={3.6} /> : null}
      </View>
      <GateText variant="bodySmall" color={ok ? colors.go : colors.soft} style={{ lineHeight: 18.2 }}>
        {label}
      </GateText>
    </View>
  );
}

export function Checkbox({ checked, onToggle, label, error }: { checked: boolean; onToggle: () => void; label: string; error?: string | null }) {
  return (
    <View>
      <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked }} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
        <View
          style={{
            width: 20,
            height: 20,
            marginTop: 1,
            borderRadius: 6,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: checked ? colors.go : colors.card2,
            borderWidth: checked ? 0 : 1.5,
            borderColor: error ? colors.stop : colors.line,
          }}
        >
          {checked ? <Icon d={iconPaths.check} size={12} color={colors.goInk} strokeWidth={3.2} /> : null}
        </View>
        <GateText variant="bodySmall" color={colors.soft} style={{ flex: 1, lineHeight: 19 }}>
          {label}
        </GateText>
      </Pressable>
      {error ? <FieldError>{error}</FieldError> : null}
    </View>
  );
}

/**
 * A tinted note block — the design's offline-sync warning (#3A2C10 / #F3D9A5)
 * for `warn`, the same shape in stop for a failure that belongs to no one field.
 */
export function NoteBox({ tone, children, marginBottom = 0 }: { tone: "warn" | "bad"; children: React.ReactNode; marginBottom?: number }) {
  const warn = tone === "warn";
  return (
    <View style={{ paddingVertical: 13, paddingHorizontal: 14, borderRadius: 13, backgroundColor: warn ? "#3A2C10" : withAlpha(colors.stop, 0.16), flexDirection: "row", gap: 10, marginBottom }}>
      <View style={{ marginTop: 1 }}>
        <Icon d={iconPaths.alertTriangle} size={17} color={warn ? colors.hold : colors.stop} strokeWidth={2.1} />
      </View>
      <GateText
        variant="body"
        color={warn ? "#F3D9A5" : ERROR_INK}
        accessibilityLiveRegion={warn ? "none" : "polite"}
        style={{ flex: 1, fontSize: 12.5, lineHeight: 18.75 }}
      >
        {children}
      </GateText>
    </View>
  );
}

/** The password rules ticked off live. The server re-checks these and more (common passwords, reuse). */
export function passwordRules(password: string, mobile: string | null) {
  return [
    { label: "At least 8 characters", ok: password.length >= 8 },
    { label: "A letter and a number", ok: /[A-Za-z]/.test(password) && /\d/.test(password) },
    ...(mobile ? [{ label: "Not the same as your mobile number", ok: password.length > 0 && !password.replace(/\D/g, "").includes(mobile) }] : []),
  ];
}
