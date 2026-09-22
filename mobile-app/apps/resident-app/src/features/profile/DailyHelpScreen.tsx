import React from "react";
import { Pressable, View } from "react-native";
import { formatInr } from "@sahaj/shared";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { currentUnit, helpSummary, helpRoleWords } from "../../state/selectors";
import { ScreenScroll } from "../../components/ScreenScroll";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { iconPaths } from "../../components/iconPaths";
import { StaggerItem } from "../../components/StaggerItem";

export function DailyHelpScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t, lang } = useT();
  const unit = currentUnit(state);
  const people = state.dailyHelp.filter((h) => h.unit === unit.code);
  const active = people.find((h) => h.passNo === state.activeHelpPassNo) ?? people[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader title={t("dailyHelpTitle")} onBack={actions.back} />
      <ScreenScroll>
        <AppText variant="bodySmall" color={colors.inkSoft} style={{ marginBottom: 16 }}>
          {t("dailyHelpIntro")}
        </AppText>

        {people.length === 0 ? (
          <EmptyState iconPath={iconPaths.household} title={t("nobodyRegistered")} body={t("nobodyRegisteredSub")} actionLabel={t("registerDailyHelp")} onAction={actions.goInvite} />
        ) : (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
              {people.map((h) => {
                const on = active?.passNo === h.passNo;
                const roleWord = lang === "en" ? h.role : helpRoleWords[h.role]?.[lang] ?? h.role;
                return (
                  <Pressable
                    key={h.passNo}
                    onPress={() => actions.selectHelpPerson(h.passNo)}
                    style={{ height: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: on ? colors.accent : colors.borderStrong, backgroundColor: on ? colors.accent : colors.surface, alignItems: "center", justifyContent: "center" }}
                  >
                    <AppText variant="cardTitle" color={on ? "#FFFFFF" : colors.ink} style={{ fontSize: 12.5 }}>
                      {h.name.split(" ")[0]} · {roleWord}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            {active ? <HelpAttendanceCard passNo={active.passNo} /> : null}
          </>
        )}
      </ScreenScroll>
    </View>
  );
}

function HelpAttendanceCard({ passNo }: { passNo: string }) {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();
  const person = state.dailyHelp.find((h) => h.passNo === passNo);
  const sheet = state.attendanceSheets.find((s) => s.personId === passNo);
  if (!person || !sheet) return null;
  const summary = helpSummary(state, passNo);
  const paid = !!state.paidHelp[passNo];

  const cellColor = (day: string) =>
    day === "present" ? { bg: colors.okWash, fg: colors.okInk } :
    day === "off" ? { bg: colors.subtle, fg: colors.inkMuted } :
    day === "unrecorded" ? { bg: colors.borderSoft, fg: colors.inkDim } :
    { bg: colors.badWash, fg: colors.badInk };

  const rows = [
    { label: t("daysPresent"), value: t("forDays", { present: summary.present, total: summary.totalWorkingDays }), fg: colors.okInk },
    { label: t("daysAbsent"), value: String(summary.absent), fg: summary.absent ? colors.badInk : colors.ink },
    { label: t("weeklyOffs"), value: String(summary.off), fg: colors.ink },
    { label: t("agreedSalary"), value: t("salaryForDays", { amount: formatInr(person.monthlySalary), days: summary.totalWorkingDays }), fg: colors.ink },
    { label: t("perDay"), value: formatInr(summary.perDay), fg: colors.ink },
  ];

  return (
    <>
      <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface, padding: 18, marginBottom: 16 }}>
        <AppText variant="cardTitleLarge" style={{ fontSize: 19, marginBottom: 3 }}>
          {person.name}
        </AppText>
        <AppText variant="bodySmall" color={colors.inkSoft} style={{ marginBottom: 16 }}>
          {person.role} · {person.window}
        </AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
          {sheet.days.map((day, i) => {
            const { bg, fg } = cellColor(day);
            return (
              <StaggerItem key={i} index={i} tier="listRow" style={{ width: "9%", aspectRatio: 1 }}>
                <View style={{ flex: 1, borderRadius: 5, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
                  <AppText variant="moneyMono" color={fg} style={{ fontSize: 8.5 }} forceLatin>
                    {i + 1}
                  </AppText>
                </View>
              </StaggerItem>
            );
          })}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
          <Legend color={colors.okWash} label={t("cameIn")} />
          <Legend color={colors.badWash} label={t("absentLabel")} />
          <Legend color={colors.subtle} label={t("weeklyOff")} />
        </View>
      </View>

      <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, overflow: "hidden", marginBottom: 16 }}>
        {rows.map((row, i) => (
          <View key={row.label} style={{ padding: 14, paddingHorizontal: 16, borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: colors.borderSoft, flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
            <AppText variant="bodySmall" color={colors.inkSoft}>
              {row.label}
            </AppText>
            <AppText variant="cardTitle" color={row.fg} style={{ fontSize: 13.5, textAlign: "right" }} forceLatin>
              {row.value}
            </AppText>
          </View>
        ))}
        <View style={{ padding: 16, backgroundColor: colors.subtle, flexDirection: "row", justifyContent: "space-between" }}>
          <AppText variant="cardTitleLarge" style={{ fontSize: 14 }}>
            {t("payableThisMonth")}
          </AppText>
          <AppText variant="moneyMono" style={{ fontSize: 19 }} forceLatin>
            {formatInr(summary.payable)}
          </AppText>
        </View>
      </View>

      <Button label={paid ? t("markedPaidThisMonth") : t("markSalaryPaid")} kind={paid ? "ghost" : "primary"} onPress={actions.markHelpPaid} />
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <AppText variant="body" color={colors.inkSoft} style={{ fontSize: 11.5, fontWeight: "500" as const }}>
        {label}
      </AppText>
    </View>
  );
}
