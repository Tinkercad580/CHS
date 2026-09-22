import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming, useReducedMotion } from "react-native-reanimated";
import { formatInr } from "@sahaj/shared";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { activeBill, currentUnit } from "../../state/selectors";
import { AppText } from "../../components/AppText";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { Button } from "../../components/Button";
import { BottomSheet } from "../../components/BottomSheet";
import { AnimatedPressable } from "../../components/AnimatedPressable";
import { EASE_OUT } from "../../components/motion";
import { QrGraphic } from "./QrGraphic";

const UPI_APPS = [
  { name: "UPI Wallet", meta: "•••• 4412 · default", mark: "UW" },
  { name: "BankPay", meta: "Savings •••• 7781", mark: "BP" },
  { name: "QuickPe", meta: "Linked 2 days ago", mark: "QP" },
];

/** The four payment overlays — Pay method picker, QR, app picker, success — one component so the shell mounts it once. */
export function PaymentSheets() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();
  const bill = activeBill(state);
  if (!bill) return null;
  const unit = currentUnit(state);

  return (
    <>
      <BottomSheet visible={state.sheet === "pay"} onBackdropPress={actions.closeSheet}>
        <AppText variant="cardTitleLarge" style={{ marginBottom: 5 }}>
          {t("payAmount", { amount: formatInr(bill.amount) })}
        </AppText>
        <AppText variant="bodySmall" color={colors.inkSoft} style={{ marginBottom: 20 }}>
          {bill.title} · {unit.line}
        </AppText>
        <View style={{ gap: 11 }}>
          <PayMethodRow icon="qr" title={t("payUsingQr")} sub={t("payUsingQrSub")} onPress={actions.startQr} />
          <PayMethodRow icon="phoneApp" title={t("payUsingApp")} sub={t("payUsingAppSub")} onPress={actions.payApp} />
        </View>
        <View style={{ marginTop: 16 }}>
          <Button label={t("cancel")} kind="ghost" onPress={actions.closeSheet} height={48} />
        </View>
      </BottomSheet>

      <BottomSheet visible={state.sheet === "qr"}>
        <QrSheetBody />
      </BottomSheet>

      <BottomSheet visible={state.sheet === "app"} onBackdropPress={actions.closeSheet}>
        <AppText variant="cardTitleLarge" style={{ fontSize: 19, marginBottom: 5 }}>
          {t("chooseApp")}
        </AppText>
        <AppText variant="bodySmall" color={colors.inkSoft} style={{ marginBottom: 18 }}>
          {t("chooseAppSub", { amount: formatInr(bill.amount) })}
        </AppText>
        <View style={{ gap: 9 }}>
          {UPI_APPS.map((app) => (
            <AnimatedPressable
              key={app.name}
              onPress={() => actions.choosePaymentApp(app.name)}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface, padding: 14, flexDirection: "row", alignItems: "center", gap: 13 }}
            >
              <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: colors.accentWash, alignItems: "center", justifyContent: "center" }}>
                <AppText variant="cardTitleLarge" color={colors.accentInk} style={{ fontSize: 13 }} forceLatin>
                  {app.mark}
                </AppText>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText variant="cardTitle" style={{ fontSize: 14 }}>
                  {app.name}
                </AppText>
                <AppText variant="meta" color={colors.inkSoft}>
                  {app.meta}
                </AppText>
              </View>
              <Icon d={iconPaths.chevronRight} size={16} color={colors.inkDim} strokeWidth={2.2} />
            </AnimatedPressable>
          ))}
        </View>
        <View style={{ marginTop: 16 }}>
          <Button label={t("back")} kind="ghost" onPress={actions.closeSheet} height={48} />
        </View>
      </BottomSheet>

      <BottomSheet visible={state.sheet === "success"} fullScreen>
        <SuccessBody />
      </BottomSheet>
    </>
  );
}

function PayMethodRow({ icon, title, sub, onPress }: { icon: keyof typeof iconPaths; title: string; sub: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <AnimatedPressable onPress={onPress} style={{ borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 16, backgroundColor: colors.surface, padding: 16, flexDirection: "row", alignItems: "center", gap: 14 }}>
      <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: colors.accentWash, alignItems: "center", justifyContent: "center" }}>
        <Icon d={iconPaths[icon]} size={22} color={colors.accentInk} strokeWidth={1.9} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="cardTitle" style={{ fontSize: 14.5, marginBottom: 2 }}>
          {title}
        </AppText>
        <AppText variant="bodySmall" color={colors.inkSoft}>
          {sub}
        </AppText>
      </View>
      <Icon d={iconPaths.chevronRight} size={17} color={colors.inkDim} strokeWidth={2.2} />
    </AnimatedPressable>
  );
}

function QrSheetBody() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();
  const bill = activeBill(state);
  if (!bill) return null;
  const expired = state.qrState === "expired";
  const low = state.qrLeftSeconds <= 60;
  const mm = Math.floor(state.qrLeftSeconds / 60);
  const ss = state.qrLeftSeconds % 60;
  const timerText = expired ? "00:00" : `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  const timerBg = expired ? colors.badWash : low ? colors.warnWash : colors.accentWash;
  const timerFg = expired ? colors.badInk : low ? colors.warnInk : colors.accentInk;
  const pct = Math.max(0, Math.round((state.qrLeftSeconds / 600) * 100));

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="cardTitleLarge" style={{ fontSize: 19 }}>
            {t("scanToPay")}
          </AppText>
          <AppText variant="bodySmall" color={colors.inkSoft}>
            {formatInr(bill.amount)} · {bill.title}
          </AppText>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: timerBg }}>
          <Icon d={iconPaths.clock} size={14} color={timerFg} strokeWidth={2.1} />
          <AppText variant="moneyMono" color={timerFg} style={{ fontSize: 13.5 }} forceLatin>
            {timerText}
          </AppText>
        </View>
      </View>

      <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 20, backgroundColor: colors.surface, padding: 18, alignItems: "center", marginBottom: 16 }}>
        <View style={{ width: 190, height: 190, alignItems: "center", justifyContent: "center", opacity: expired ? 0.45 : 1 }}>
          <QrGraphic seed={state.qrLeftSeconds % 3} />
          {expired ? (
            <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(255,255,255,0.72)", alignItems: "center", justifyContent: "center", borderRadius: 12 }}>
              <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.bad }}>
                <AppText variant="cardTitleLarge" color="#FFFFFF" style={{ fontSize: 13 }}>
                  {t("expiredBadge")}
                </AppText>
              </View>
            </View>
          ) : null}
        </View>
        <AppText variant="bodySmall" color={colors.inkSoft} style={{ textAlign: "center", marginTop: 14, maxWidth: 240 }}>
          {expired ? t("expiredHint") : t("liveQrHint")}
        </AppText>
      </View>

      <View style={{ height: 5, borderRadius: 999, backgroundColor: colors.subtle, overflow: "hidden", marginBottom: 16 }}>
        <View style={{ height: "100%", width: `${pct}%`, backgroundColor: timerFg, borderRadius: 999 }} />
      </View>

      {!expired ? (
        <>
          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.canvas, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <ActivityIndicator color={colors.accent} />
            <AppText variant="bodySmall" color={colors.inkSoft} style={{ flex: 1 }}>
              {t("waitingBank")}
            </AppText>
          </View>
          <Button label={t("iHavePaid")} onPress={actions.simulatePaid} style={{ marginBottom: 10 }} />
        </>
      ) : (
        <Button label={t("generateNewCode")} onPress={actions.restartQr} style={{ marginBottom: 10 }} />
      )}
      <Button label={t("cancelPayment")} kind="secondary" onPress={actions.cancelQr} height={48} />
      <AppText variant="meta" color={colors.inkMuted} style={{ textAlign: "center", marginTop: 12 }}>
        {t("cancelNothing")}
      </AppText>
    </View>
  );
}

function SuccessBody() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();
  const unit = currentUnit(state);
  const bill = state.bills.find((b) => b.id === state.lastPaidBillId);
  if (!bill) return null;

  const rows = [
    { label: "Receipt", value: bill.receiptNo ?? "" },
    { label: "Paid via", value: bill.paymentMethod ?? "" },
    { label: "Unit", value: unit.code },
    { label: "Date", value: bill.paidOn ? new Date(bill.paidOn).toLocaleString("en-IN") : "" },
  ];

  return (
    <View style={{ flex: 1, paddingTop: 70, paddingHorizontal: 26, paddingBottom: 30 }}>
      <View style={{ flex: 1, alignItems: "center" }}>
        <PopInGlyph>
          <View style={{ width: 86, height: 86, borderRadius: 28, backgroundColor: colors.okWash, alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
            <Icon d={iconPaths.check} size={44} color={colors.okInk} strokeWidth={2.5} />
          </View>
        </PopInGlyph>
        <AppText variant="screenTitleMobile" style={{ fontSize: 26, marginBottom: 9 }}>
          {t("paymentReceived")}
        </AppText>
        <AppText variant="body" color={colors.inkSoft} style={{ marginBottom: 26, textAlign: "center" }}>
          {formatInr(bill.amount)} paid for {bill.title}.
        </AppText>
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.canvas, overflow: "hidden", width: "100%" }}>
          {rows.map((r) => (
            <View key={r.label} style={{ padding: 13, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.borderSoft, flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <AppText variant="bodySmall" color={colors.inkSoft}>
                {r.label}
              </AppText>
              <AppText variant="cardTitle" style={{ fontSize: 13 }} forceLatin>
                {r.value}
              </AppText>
            </View>
          ))}
        </View>
      </View>
      <Button label={t("downloadReceipt")} kind="secondary" onPress={actions.downloadReceipt} style={{ marginBottom: 11 }} />
      <Button label={t("done")} onPress={actions.finishPay} />
    </View>
  );
}

/** `popIn`: scale(.5)→1.1→1 + opacity 0→1 — the payment-success checkmark, README's "Success glyphs". */
function PopInGlyph({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      scale.value = 1;
      opacity.value = 1;
      return;
    }
    scale.value = withSequence(withTiming(1.1, { duration: 220, easing: EASE_OUT }), withTiming(1, { duration: 140, easing: EASE_OUT }));
    opacity.value = withTiming(1, { duration: 220, easing: EASE_OUT });
  }, [reduced, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}
