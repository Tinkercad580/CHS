import React from "react";
import { View, Pressable, TextInput } from "react-native";
import { formatInr } from "@sahaj/shared";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { ScreenScroll } from "../../components/ScreenScroll";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { OptionButton, DayToggle } from "../../components/FilterPill";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { StaggerItem } from "../../components/StaggerItem";

const PURPOSES: { key: "Guest" | "Delivery" | "Cab" | "Service"; labelKey: "guest" | "delivery" | "cab" | "service" }[] = [
  { key: "Guest", labelKey: "guest" },
  { key: "Delivery", labelKey: "delivery" },
  { key: "Cab", labelKey: "cab" },
  { key: "Service", labelKey: "service" },
];
const WINDOWS: { key: "2 hours" | "Today" | "This week"; labelKey: "twoHours" | "today" | "thisWeek" }[] = [
  { key: "2 hours", labelKey: "twoHours" },
  { key: "Today", labelKey: "today" },
  { key: "This week", labelKey: "thisWeek" },
];
const HELP_ROLES: { key: "Housekeeping" | "Cook" | "Driver" | "Nanny" | "Care giver"; labelKey: "housekeeping" | "cook" | "driver" | "nanny" | "careGiver" }[] = [
  { key: "Housekeeping", labelKey: "housekeeping" },
  { key: "Cook", labelKey: "cook" },
  { key: "Driver", labelKey: "driver" },
  { key: "Nanny", labelKey: "nanny" },
  { key: "Care giver", labelKey: "careGiver" },
];
const HELP_WINDOWS: { key: "Morning" | "Twice daily" | "Full day" | "Evening"; labelKey: "morning" | "twiceDaily" | "fullDay" | "evening"; detail: string }[] = [
  { key: "Morning", labelKey: "morning", detail: "7:00am – 11:00am" },
  { key: "Twice daily", labelKey: "twiceDaily", detail: "7:00am and 5:00pm" },
  { key: "Full day", labelKey: "fullDay", detail: "9:00am – 7:00pm" },
  { key: "Evening", labelKey: "evening", detail: "4:00pm – 8:00pm" },
];
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function InviteScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();
  const isGuest = state.inviteType === "guest";

  const workingDays = state.helpForm.days.filter(Boolean).length * 4;
  const salaryNum = parseInt(state.helpForm.salary || "0", 10);
  const perDayHint = !salaryNum
    ? t("perDayHint")
    : t("perDayRateLine", { amount: formatInr(salaryNum), days: workingDays, perDay: formatInr(Math.round(salaryNum / Math.max(1, workingDays))) });

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader title={t("inviteTitle")} onBack={actions.back} />
      <ScreenScroll>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 20, padding: 4, borderRadius: 13, backgroundColor: colors.subtle }}>
          <SegmentButton label={t("oneTimeGuest")} active={isGuest} onPress={() => actions.setInviteType("guest")} />
          <SegmentButton label={t("dailyHelpMode")} active={!isGuest} onPress={() => actions.setInviteType("help")} />
        </View>

        {isGuest ? (
          <View>
            <FieldLabel>{t("guestName")}</FieldLabel>
            <TextField value={state.guestForm.name} onChangeText={actions.setGuestName} placeholder={t("guestNamePh")} />

            <FieldLabel style={{ marginTop: 16 }}>{t("purpose")}</FieldLabel>
            <Row wrap>
              {PURPOSES.map((p, i) => (
                <StaggerItem key={p.key} index={i} tier="listRow">
                  <OptionButton label={t(p.labelKey)} active={state.guestForm.purpose === p.key} onPress={() => actions.setGuestPurpose(p.key)} flex={0} height={38} />
                </StaggerItem>
              ))}
            </Row>

            <FieldLabel style={{ marginTop: 16 }}>{t("validFor")}</FieldLabel>
            <Row>
              {WINDOWS.map((w, i) => (
                <StaggerItem key={w.key} index={i} tier="listRow" style={{ flex: 1 }}>
                  <OptionButton label={t(w.labelKey)} active={state.guestForm.window === w.key} onPress={() => actions.setGuestWindow(w.key)} />
                </StaggerItem>
              ))}
            </Row>

            {state.guestFormError ? <ErrorBanner text={t("guestNameError")} /> : null}

            <Button
              label={state.creatingPass ? t("creatingPass") : t("createPass")}
              loading={state.creatingPass}
              onPress={actions.createGuestPass}
              style={{ marginTop: 22 }}
            />
            <AppText variant="meta" color={colors.inkMuted} style={{ textAlign: "center", marginTop: 11 }}>
              {t("codeReachesBoth")}
            </AppText>
          </View>
        ) : (
          <View>
            <AppText variant="bodySmall" color={colors.inkSoft} style={{ marginBottom: 18 }}>
              {t("standingPassIntro")}
            </AppText>

            <FieldLabel>{t("helpName")}</FieldLabel>
            <TextField value={state.helpForm.name} onChangeText={actions.setHelpName} placeholder={t("helpNamePh")} />

            <FieldLabel style={{ marginTop: 16 }}>{t("helpRole")}</FieldLabel>
            <Row wrap>
              {HELP_ROLES.map((r, i) => (
                <StaggerItem key={r.key} index={i} tier="listRow">
                  <OptionButton label={t(r.labelKey)} active={state.helpForm.role === r.key} onPress={() => actions.setHelpRole(r.key)} flex={0} height={38} />
                </StaggerItem>
              ))}
            </Row>

            <FieldLabel style={{ marginTop: 16 }}>{t("daysTheyCome")}</FieldLabel>
            <View style={{ flexDirection: "row", gap: 7 }}>
              {WEEKDAYS.map((d, i) => (
                <StaggerItem key={i} index={i} tier="listRow" style={{ flex: 1 }}>
                  <DayToggle label={d} active={state.helpForm.days[i]} onPress={() => actions.toggleHelpDay(i)} />
                </StaggerItem>
              ))}
            </View>

            <FieldLabel style={{ marginTop: 16 }}>{t("hoursTheyWork")}</FieldLabel>
            <View style={{ gap: 8 }}>
              {HELP_WINDOWS.map((w, i) => (
                <StaggerItem key={w.key} index={i} tier="listRow">
                  <OptionButton label={t(w.labelKey)} sub={w.detail} active={state.helpForm.window === w.key} onPress={() => actions.setHelpWindow(w.key)} height={46} />
                </StaggerItem>
              ))}
            </View>

            <FieldLabel style={{ marginTop: 16 }}>{t("monthlySalary")}</FieldLabel>
            <TextField value={state.helpForm.salary} onChangeText={actions.setHelpSalary} placeholder={t("monthlySalaryPh")} keyboardType="number-pad" mono />
            <AppText variant="meta" color={colors.inkMuted} style={{ marginTop: 9 }}>
              {perDayHint}
            </AppText>

            <Button label={t("registerAndIssue")} onPress={actions.createHelpPass} style={{ marginTop: 22 }} />
            <AppText variant="meta" color={colors.inkMuted} style={{ textAlign: "center", marginTop: 11 }}>
              {t("officeVerifies")}
            </AppText>
          </View>
        )}
      </ScreenScroll>
    </View>
  );
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flex: 1, height: 42, borderRadius: 10, backgroundColor: active ? colors.surface : "transparent", alignItems: "center", justifyContent: "center" }}>
      <AppText variant="cardTitle" color={active ? colors.ink : colors.inkSoft} style={{ fontSize: 13 }}>
        {label}
      </AppText>
    </Pressable>
  );
}

function FieldLabel({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <AppText variant="label" style={[{ marginBottom: 8 }, style]}>
      {children}
    </AppText>
  );
}

function Row({ children, wrap }: { children: React.ReactNode; wrap?: boolean }) {
  return <View style={{ flexDirection: "row", gap: 9, flexWrap: wrap ? "wrap" : "nowrap" }}>{children}</View>;
}

function TextField({ value, onChangeText, placeholder, keyboardType, mono }: { value: string; onChangeText: (v: string) => void; placeholder: string; keyboardType?: "default" | "number-pad"; mono?: boolean }) {
  const { colors, type } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.inkMuted}
      keyboardType={keyboardType}
      style={[
        { height: 50, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 12, backgroundColor: colors.surface, color: colors.ink },
        mono ? type("moneyMono") : { fontSize: 15 },
      ]}
    />
  );
}

function ErrorBanner({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: 16, borderWidth: 1, borderColor: colors.badBorder, borderRadius: 12, backgroundColor: colors.badWash, padding: 13, flexDirection: "row", gap: 10 }}>
      <Icon d={iconPaths.sos} size={17} color={colors.badInk} strokeWidth={2} />
      <AppText variant="bodySmall" color={colors.badInk} style={{ flex: 1 }}>
        {text}
      </AppText>
    </View>
  );
}
