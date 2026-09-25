import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View, type TextInputProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../hooks/useTheme";
import { AppText } from "../../components/AppText";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { fontFamilyFor } from "../../theme/fonts";

export { splitError } from "../../api/errors";

/**
 * The building blocks of the sign-in screens — Resident App.dc.html, "01 · Access".
 *
 * Every screen there is the same column: 38px top (20px when a back row leads),
 * 26px sides, content from the top and one action cluster pinned to the bottom
 * (`margin-top:auto`). On a phone the keyboard takes half of that, so the column
 * scrolls and rides above the keyboard instead of hiding the button under it.
 *
 * Copy on these screens is English only: they are shown before the resident has
 * picked a language, and @sahaj/shared's copy table has no auth keys yet.
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
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingTop: back ? 20 : 38, paddingHorizontal: 26, paddingBottom: 26 + insets.bottom }}
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

/** Chevron + the number being signed in, as on the design's "Create password" screen: it is both the way back and the reminder of whose account this is. */
function BackRow({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Change number, ${label}`}
      hitSlop={12}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 26, alignSelf: "flex-start" }}
    >
      <Icon d={iconPaths.chevronLeft} size={20} color={colors.ink} strokeWidth={2} />
      <AppText variant="label" color={colors.inkSoft} style={{ fontSize: 14, lineHeight: 14 }} forceLatin>
        {label}
      </AppText>
    </Pressable>
  );
}

/** 46px rounded tile carrying the screen's one icon (brand, warning, lock). */
export function IconTile({ path, background, stroke, size = 46, marginBottom = 24 }: { path: string; background: string; stroke: string; size?: number; marginBottom?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 14, backgroundColor: background, alignItems: "center", justifyContent: "center", marginBottom }}>
      <Icon d={path} size={Math.round(size / 2)} color={stroke} strokeWidth={2} />
    </View>
  );
}

/** 700 25/1.2, -0.022em — the design's screen title on every step (27px on the welcome step). */
export function AuthTitle({ children, size = 25, marginBottom = 9 }: { children: React.ReactNode; size?: 25 | 27; marginBottom?: number }) {
  return (
    <AppText variant="sectionHeading" accessibilityRole="header" style={{ fontSize: size, lineHeight: size * 1.2, letterSpacing: -(size === 27 ? 0.024 : 0.022) * size, marginBottom }}>
      {children}
    </AppText>
  );
}

/** 400 14.5/1.55 ink-soft. */
export function AuthLead({ children, marginBottom = 26 }: { children: React.ReactNode; marginBottom?: number }) {
  const { colors } = useTheme();
  return (
    <AppText variant="body" color={colors.inkSoft} style={{ lineHeight: 22.5, marginBottom }}>
      {children}
    </AppText>
  );
}

/** 400 12.5/1.5 ink-soft — hints and footnotes. */
export function AuthNote({ children, center, style }: { children: React.ReactNode; center?: boolean; style?: object }) {
  const { colors } = useTheme();
  return (
    <AppText variant="bodySmall" color={colors.inkSoft} style={[{ fontSize: 12.5, lineHeight: 18.75 }, center ? { textAlign: "center" } : null, style]}>
      {children}
    </AppText>
  );
}

interface FieldProps extends Omit<TextInputProps, "style" | "secureTextEntry"> {
  label: string;
  error?: string | null;
  /** "+91" — drawn as a separate segment with its own divider, not part of the value. */
  prefix?: string;
  /** Password field: dots with the design's letter-spacing, plus a show/hide control. */
  secret?: boolean;
  revealable?: boolean;
  height?: 50 | 52;
  inputRef?: React.Ref<TextInput>;
  marginTop?: number;
}

/**
 * A labelled input in the design's two states: resting (1px border-strong) and
 * focused (1.5px accent with a 3px accent ring). An error turns the border bad
 * and puts the server's message directly under the field it belongs to.
 */
export function AuthField({ label, error, prefix, secret, revealable, height = 50, inputRef, marginTop = 0, onFocus, onBlur, value, ...input }: FieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const hidden = !!secret && !revealed;
  const edge = error ? colors.bad : focused ? colors.accent : colors.borderStrong;
  const thick = focused || !!error;

  const valueFont = prefix
    ? { fontFamily: fontFamilyFor("mono", 500), fontSize: 17, letterSpacing: 1.02 }
    : hidden && value
      ? { fontFamily: fontFamilyFor("sans", 600), fontSize: 16, letterSpacing: 3.5 }
      : { fontFamily: fontFamilyFor("sans", 500), fontSize: 15.5 };

  return (
    <View style={{ marginTop }}>
      <AppText variant="label" style={{ marginBottom: 8 }}>
        {label}
      </AppText>
      <View
        style={{
          height,
          flexDirection: "row",
          alignItems: "center",
          borderRadius: 12,
          // Width changes 1 → 1.5 on focus; the padding gives back the difference so the text never shifts.
          borderWidth: thick ? 1.5 : 1,
          borderColor: edge,
          backgroundColor: colors.surface,
          boxShadow: focused ? `0 0 0 3px ${error ? "rgba(192,52,43,0.13)" : "rgba(14,107,92,0.13)"}` : undefined,
        }}
      >
        {prefix ? (
          // The divider is only as tall as the "+91" itself, as in the design — not a full-height rule.
          <View style={{ paddingHorizontal: 13, borderRightWidth: 1, borderRightColor: colors.border }}>
            <AppText variant="label" color={colors.inkSoft} style={{ fontSize: 15, lineHeight: 15 }} forceLatin>
              {prefix}
            </AppText>
          </View>
        ) : null}
        <TextInput
          {...input}
          ref={inputRef}
          value={value}
          secureTextEntry={hidden}
          accessibilityLabel={label}
          placeholderTextColor={colors.inkDim}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            // The field draws its own focus ring; on web the browser's (outline-style: auto ignores a zero width) would sit inside it.
            { flex: 1, height: "100%", paddingHorizontal: prefix ? 13 : thick ? 13.5 : 14, color: colors.ink, outlineStyle: "solid", outlineWidth: 0 },
            valueFont,
          ]}
        />
        {secret && revealable ? (
          <Pressable
            onPress={() => setRevealed((r) => !r)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
            hitSlop={8}
            style={{ width: 44, height: "100%", alignItems: "center", justifyContent: "center" }}
          >
            <Icon d={revealed ? iconPaths.eyeOff : iconPaths.eye} size={19} color={colors.inkMuted} strokeWidth={1.8} />
          </Pressable>
        ) : null}
      </View>
      {error ? <FieldError>{error}</FieldError> : null}
    </View>
  );
}

export function FieldError({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <AppText variant="bodySmall" color={colors.badInk} accessibilityLiveRegion="polite" style={{ fontSize: 12.5, lineHeight: 18.75, marginTop: 7 }}>
      {children}
    </AppText>
  );
}

/** One password rule: an empty ring until it passes, then a green tick and green text. */
export function RuleRow({ ok, label }: { ok: boolean; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
      <View
        style={{
          width: 17,
          height: 17,
          borderRadius: 8.5,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: ok ? colors.ok : "transparent",
          borderWidth: ok ? 0 : 1.5,
          borderColor: colors.borderStrong,
        }}
      >
        {ok ? <Icon d={iconPaths.check} size={10} color="#FFFFFF" strokeWidth={3.6} /> : null}
      </View>
      <AppText variant="bodySmall" color={ok ? colors.okInk : colors.inkSoft} style={{ lineHeight: 18.2 }}>
        {label}
      </AppText>
    </View>
  );
}

export function Checkbox({ checked, onToggle, label, error }: { checked: boolean; onToggle: () => void; label: string; error?: string | null }) {
  const { colors } = useTheme();
  return (
    <View>
      <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked }} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
        <View
          style={{
            width: 19,
            height: 19,
            marginTop: 1,
            borderRadius: 6,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: checked ? colors.accent : colors.surface,
            borderWidth: checked ? 0 : 1.5,
            borderColor: error ? colors.bad : colors.borderStrong,
          }}
        >
          {checked ? <Icon d={iconPaths.check} size={12} color="#FFFFFF" strokeWidth={3.2} /> : null}
        </View>
        <AppText variant="bodySmall" color={colors.inkSoft} style={{ flex: 1, lineHeight: 18.85 }}>
          {label}
        </AppText>
      </Pressable>
      {error ? <FieldError>{error}</FieldError> : null}
    </View>
  );
}

/** The tinted 12×14 note block the design uses on the forced-change screen; the bad variant carries a failure that belongs to no one field. */
export function NoteBox({ tone, children, marginBottom = 0 }: { tone: "warn" | "bad"; children: React.ReactNode; marginBottom?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 11, backgroundColor: tone === "warn" ? colors.warnWash : colors.badWash, marginBottom }}>
      <AppText variant="medium" color={tone === "warn" ? colors.warnInk : colors.badInk} accessibilityLiveRegion={tone === "bad" ? "polite" : "none"} style={{ fontSize: 12.5, lineHeight: 18.75 }}>
        {children}
      </AppText>
    </View>
  );
}

/** "98220 41155" — the design prints the national number in two groups of five, without the +91 it shows separately. */
export function groupMobile(digits: string): string {
  return digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}

/** The password rules the design ticks off live. The server re-checks these and more (common passwords, reuse). */
export function passwordRules(password: string, mobile: string | null) {
  return [
    { label: "At least 8 characters", ok: password.length >= 8 },
    { label: "A letter and a number", ok: /[A-Za-z]/.test(password) && /\d/.test(password) },
    ...(mobile ? [{ label: "Not the same as your mobile number", ok: password.length > 0 && !password.replace(/\D/g, "").includes(mobile) }] : []),
  ];
}
