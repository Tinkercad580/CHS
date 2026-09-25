import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming, useReducedMotion } from "react-native-reanimated";
import { api, type Checkout } from "@chs/contract";
import { useApiMutation } from "@chs/api-client/react";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { currentUnit } from "../../state/selectors";
import { dateTime, formatPaise, useSocietyId, type Payment } from "../../api/billing";
import { AppText } from "../../components/AppText";
import { Spinner } from "../../components/Spinner";
import { Icon } from "../../components/Icon";
import { iconPaths } from "../../components/iconPaths";
import { Button } from "../../components/Button";
import { BottomSheet } from "../../components/BottomSheet";
import { AnimatedPressable } from "../../components/AnimatedPressable";
import { StatusPill } from "../../components/StatusPill";
import { EASE_OUT } from "../../components/motion";
import { QrGraphic } from "./QrGraphic";

const UPI_APPS = [
  { name: "UPI Wallet", meta: "•••• 4412 · default", mark: "UW" },
  { name: "BankPay", meta: "Savings •••• 7781", mark: "BP" },
  { name: "QuickPe", meta: "Linked 2 days ago", mark: "QP" },
];

type Outcome = "success" | "failure";

/**
 * The payment overlays — method picker, QR, app picker, receipt, declined —
 * one component so the shell mounts it once.
 *
 * They are the dummy gateway's checkout. Picking a method starts the payment
 * (payments.start, which prices it at everything due on the flat); "I have
 * paid" or picking an app finishes it through completeDummyCheckout, and the
 * receipt shown is the payment the server returns. No money moves, which the
 * sheets say with a "Test mode" tag; each checkout also offers a quiet way to
 * decline, so the failure path can be tried. A real gateway would hand over
 * to its own checkout at the same two points.
 *
 * A started payment the resident walks away from — the sheet closed, or the QR
 * left to expire — is cancelled on the server (payments.cancelCheckout), so it
 * never lingers as an open checkout; "Generate a new code" starts a new order.
 */
export function PaymentSheets() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();
  const societyId = useSocietyId();
  const target = state.payTarget;
  const unit = currentUnit(state);
  const start = useApiMutation(api.payments.start);
  const complete = useApiMutation(api.payments.completeDummyCheckout);
  const cancelMutate = useApiMutation(api.payments.cancelCheckout).mutate;
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  // The payment the server holds open (CREATED) for this sheet: set when
  // payments.start answers, cleared once it is completed or abandoned.
  const openCheckout = useRef<Checkout | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [result, setResult] = useState<Payment | null>(null);
  const [paidVia, setPaidVia] = useState("");
  const [startingVia, setStartingVia] = useState<"qr" | "app" | null>(null);
  const [pending, setPending] = useState<{ via: string; outcome: Outcome } | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Cancels the open checkout, if any. Not awaited: nothing was charged either way, and the server also cancels checkouts left open for 30 minutes. */
  const abandon = () => {
    const open = openCheckout.current;
    if (!open) return;
    openCheckout.current = null;
    cancelMutate({ params: { societyId, paymentId: open.payment.id } });
  };

  // Closing the sheets, or going back to the method picker, walks away from the
  // order; each visit to the picker is a fresh attempt (a failed order can't be paid again).
  useEffect(() => {
    if (state.sheet === null || state.sheet === "pay") abandon();
    if (state.sheet === "pay") {
      setCheckout(null);
      setError(null);
    }
  }, [state.sheet]); // eslint-disable-line react-hooks/exhaustive-deps

  // An expired code is a dead order: cancel it now rather than when the sheet closes.
  useEffect(() => {
    if (state.qrState === "expired") abandon();
  }, [state.qrState]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!target) return null;
  const amount = formatPaise(checkout?.amountPaise ?? target.amountPaise);

  const begin = (via: "qr" | "app") => {
    if (startingVia) return;
    setError(null);
    setStartingVia(via);
    // No amount: the server charges everything due now, even if the screen behind was a moment stale.
    start.mutate(
      { params: { societyId }, body: { unitId: target.unitId } },
      {
        onSuccess: (co) => {
          openCheckout.current = co;
          setCheckout(co);
          if (via === "qr") actions.startQr();
          else actions.payApp();
        },
        onError: (err) => setError(err.message),
        onSettled: () => setStartingVia(null),
      }
    );
  };

  const finish = (via: string, outcome: Outcome) => {
    if (!checkout || pending) return;
    setError(null);
    setPending({ via, outcome });
    complete.mutate(
      { params: { societyId, paymentId: checkout.payment.id }, body: { orderId: checkout.orderId, outcome, method: "UPI" } },
      {
        onSuccess: (payment) => {
          openCheckout.current = null;
          setResult(payment);
          setPaidVia(via);
          actions.showPayOutcome(payment.status === "SUCCESS" ? "success" : "failed");
        },
        onError: (err) => setError(err.message),
        onSettled: () => setPending(null),
      }
    );
  };

  /** The expired QR's "Generate a new code": the old order is already cancelled, so this is a new one at today's dues. */
  const regenerate = () => {
    if (regenerating) return;
    abandon();
    setError(null);
    setRegenerating(true);
    start.mutate(
      { params: { societyId }, body: { unitId: target.unitId } },
      {
        onSuccess: (co) => {
          openCheckout.current = co;
          setCheckout(co);
          actions.restartQr();
        },
        onError: (err) => setError(err.message),
        onSettled: () => setRegenerating(false),
      }
    );
  };

  // Android's back button, per sheet (BottomSheet onRequestClose): the same as its
  // own close control, and nothing while a call is in flight.
  return (
    <>
      <BottomSheet visible={state.sheet === "pay"} onBackdropPress={startingVia ? undefined : actions.closeSheet} onRequestClose={startingVia ? undefined : actions.closeSheet}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
          <AppText variant="cardTitleLarge" style={{ flexShrink: 1 }}>
            {t("payAmount", { amount })}
          </AppText>
          <TestModeTag />
        </View>
        <AppText variant="bodySmall" color={colors.inkSoft} style={{ marginBottom: 20 }}>
          {target.title} · {target.unitLabel === unit.code ? unit.line : target.unitLabel}
        </AppText>
        <View style={{ gap: 11 }}>
          <PayMethodRow icon="qr" title={t("payUsingQr")} sub={t("payUsingQrSub")} busy={startingVia === "qr"} disabled={startingVia !== null} onPress={() => begin("qr")} />
          <PayMethodRow icon="phoneApp" title={t("payUsingApp")} sub={t("payUsingAppSub")} busy={startingVia === "app"} disabled={startingVia !== null} onPress={() => begin("app")} />
        </View>
        {error ? <SheetError message={error} /> : null}
        <View style={{ marginTop: 16 }}>
          <Button label={t("cancel")} kind="ghost" onPress={actions.closeSheet} disabled={startingVia !== null} height={48} fontSize={14.5} weight={600} />
        </View>
      </BottomSheet>

      <BottomSheet visible={state.sheet === "qr"} onRequestClose={pending || regenerating ? undefined : actions.cancelQr}>
        <QrSheetBody
          amount={amount}
          title={target.title}
          seed={checkout?.orderId ?? ""}
          pending={pending}
          regenerating={regenerating}
          error={error}
          onPaid={() => finish("UPI QR", "success")}
          onDecline={() => finish("UPI QR", "failure")}
          onRegenerate={regenerate}
        />
      </BottomSheet>

      <BottomSheet visible={state.sheet === "app"} onBackdropPress={pending ? undefined : actions.closeSheet} onRequestClose={pending ? undefined : actions.closeSheet}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
          <AppText variant="cardTitleLarge" style={{ fontSize: 19, flexShrink: 1 }}>
            {t("chooseApp")}
          </AppText>
          <TestModeTag />
        </View>
        <AppText variant="bodySmall" color={colors.inkSoft} style={{ marginBottom: 18 }}>
          {t("chooseAppSub", { amount })}
        </AppText>
        <View style={{ gap: 9 }}>
          {UPI_APPS.map((app) => (
            <AnimatedPressable
              key={app.name}
              onPress={() => finish(app.name, "success")}
              disabled={pending !== null}
              accessibilityRole="button"
              accessibilityLabel={`Pay with ${app.name}`}
              accessibilityState={{ disabled: pending !== null, busy: pending?.via === app.name }}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface, padding: 14, flexDirection: "row", alignItems: "center", gap: 13, opacity: pending && pending.via !== app.name ? 0.55 : 1 }}
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
                  {pending?.via === app.name && pending.outcome === "success" ? "Waiting for the bank…" : app.meta}
                </AppText>
              </View>
              {pending?.via === app.name && pending.outcome === "success" ? <Spinner size={18} /> : <Icon d={iconPaths.chevronRight} size={16} color={colors.inkDim} strokeWidth={2.2} />}
            </AnimatedPressable>
          ))}
        </View>
        {error ? <SheetError message={error} /> : null}
        <View style={{ marginTop: 16 }}>
          <Button label={t("back")} kind="ghost" onPress={actions.closeSheet} disabled={pending !== null} height={48} fontSize={14.5} weight={600} />
        </View>
        <DeclineLink busy={pending?.outcome === "failure"} disabled={pending !== null} onPress={() => finish(UPI_APPS[0].name, "failure")} />
      </BottomSheet>

      <BottomSheet visible={state.sheet === "success"} fullScreen onRequestClose={actions.finishPay}>
        {result ? <SuccessBody payment={result} via={paidVia} title={target.title} /> : null}
      </BottomSheet>

      <BottomSheet visible={state.sheet === "failed"} onBackdropPress={actions.closeSheet} onRequestClose={actions.closeSheet}>
        {result ? <FailedBody payment={result} /> : null}
      </BottomSheet>
    </>
  );
}

/** Says, without shouting, that this checkout moves no money. */
function TestModeTag() {
  const { colors } = useTheme();
  return <StatusPill label="Test mode" bg={colors.warnWash} fg={colors.warnInk} />;
}

function SheetError({ message }: { message: string }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="alert" style={{ marginTop: 14, borderRadius: 12, backgroundColor: colors.badWash, padding: 12 }}>
      <AppText variant="bodySmall" color={colors.badInk}>
        {message}
      </AppText>
    </View>
  );
}

/** The test checkout's way to try the failure path — a small link under the real actions, not a button beside them. */
function DeclineLink({ busy, disabled, onPress }: { busy: boolean; disabled: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy }}
      hitSlop={8}
      style={{ alignSelf: "center", marginTop: 12, flexDirection: "row", alignItems: "center", gap: 7, opacity: disabled && !busy ? 0.55 : 1 }}
    >
      {busy ? <Spinner size={13} color={colors.inkMuted} /> : null}
      <AppText variant="meta" color={colors.inkMuted} style={{ textDecorationLine: "underline" }}>
        {busy ? "Declining…" : "Simulate a failed payment"}
      </AppText>
    </AnimatedPressable>
  );
}

function PayMethodRow({ icon, title, sub, busy, disabled, onPress }: { icon: keyof typeof iconPaths; title: string; sub: string; busy: boolean; disabled: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled, busy }}
      style={{ borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 16, backgroundColor: colors.surface, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, opacity: disabled && !busy ? 0.55 : 1 }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: colors.accentWash, alignItems: "center", justifyContent: "center" }}>
        <Icon d={iconPaths[icon]} size={22} color={colors.accentInk} strokeWidth={1.9} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="cardTitle" style={{ fontSize: 14.5, marginBottom: 2 }}>
          {title}
        </AppText>
        <AppText variant="bodySmall" color={colors.inkSoft}>
          {busy ? "Starting the payment…" : sub}
        </AppText>
      </View>
      {busy ? <Spinner size={18} /> : <Icon d={iconPaths.chevronRight} size={17} color={colors.inkDim} strokeWidth={2.2} />}
    </AnimatedPressable>
  );
}

function QrSheetBody({
  amount,
  title,
  seed,
  pending,
  regenerating,
  error,
  onPaid,
  onDecline,
  onRegenerate,
}: {
  amount: string;
  title: string;
  /** The order id: the placeholder pattern belongs to the order, not to the second on the clock. */
  seed: string;
  pending: { outcome: Outcome } | null;
  regenerating: boolean;
  error: string | null;
  onPaid: () => void;
  onDecline: () => void;
  onRegenerate: () => void;
}) {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();
  const expired = state.qrState === "expired";
  const low = state.qrLeftSeconds <= 60;
  const mm = Math.floor(state.qrLeftSeconds / 60);
  const ss = state.qrLeftSeconds % 60;
  const timerText = expired ? "00:00" : `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  const timerBg = expired ? colors.badWash : low ? colors.warnWash : colors.accentWash;
  const timerFg = expired ? colors.badInk : low ? colors.warnInk : colors.accentInk;
  const pct = Math.max(0, Math.round((state.qrLeftSeconds / 600) * 100));
  const checking = pending?.outcome === "success";

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <AppText variant="cardTitleLarge" style={{ fontSize: 19 }}>
              {t("scanToPay")}
            </AppText>
            <TestModeTag />
          </View>
          <AppText variant="bodySmall" color={colors.inkSoft}>
            {amount} · {title}
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
          <QrGraphic seed={seed} />
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
            <Spinner size={30} />
            <AppText variant="bodySmall" color={colors.inkSoft} style={{ flex: 1 }}>
              {t("waitingBank")}
            </AppText>
          </View>
          <Button label={checking ? "Checking with the bank…" : t("iHavePaid")} loading={checking} disabled={pending !== null} onPress={onPaid} height={50} fontSize={15} weight={700} style={{ marginBottom: 10 }} />
        </>
      ) : (
        <Button label={regenerating ? "Generating a new code…" : t("generateNewCode")} loading={regenerating} onPress={onRegenerate} height={50} fontSize={15} weight={700} style={{ marginBottom: 10 }} />
      )}
      <Button label={t("cancelPayment")} kind="secondary" onPress={actions.cancelQr} disabled={pending !== null || regenerating} height={48} fontSize={14.5} weight={600} />
      {error ? <SheetError message={error} /> : null}
      <AppText variant="meta" color={colors.inkMuted} style={{ textAlign: "center", marginTop: 12 }}>
        {t("cancelNothing")}
      </AppText>
      {!expired ? <DeclineLink busy={pending?.outcome === "failure"} disabled={pending !== null} onPress={onDecline} /> : null}
    </View>
  );
}

/** The receipt takeover — every figure is the confirmed payment's, as the server recorded it. */
function SuccessBody({ payment, via, title }: { payment: Payment; via: string; title: string }) {
  const { actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();

  const rows = [
    { label: "Receipt", value: payment.receipt?.number ?? "Being issued" },
    { label: "Amount", value: formatPaise(payment.amountPaise) },
    { label: "Paid via", value: via },
    { label: "Unit", value: payment.unitLabel },
    { label: "Date", value: payment.paidAt ? dateTime(payment.paidAt) : "" },
  ];

  return (
    <View style={{ flex: 1, paddingTop: 70, paddingHorizontal: 26, paddingBottom: 30 }}>
      <View style={{ flex: 1, alignItems: "center" }}>
        <PopInGlyph>
          <View style={{ width: 86, height: 86, borderRadius: 28, backgroundColor: colors.okWash, alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
            <Icon d={iconPaths.check} size={44} color={colors.okInk} strokeWidth={2.5} />
          </View>
        </PopInGlyph>
        <AppText variant="screenTitleMobile" style={{ fontSize: 26, marginBottom: 9 }} accessibilityRole="header">
          {t("paymentReceived")}
        </AppText>
        <AppText variant="body" color={colors.inkSoft} style={{ marginBottom: 26, textAlign: "center" }}>
          {formatPaise(payment.amountPaise)} paid for {title}.
        </AppText>
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.canvas, overflow: "hidden", width: "100%" }}>
          {rows.map((r, i) => (
            <View key={r.label} style={{ padding: 13, paddingHorizontal: 16, borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: colors.borderSoft, flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <AppText variant="bodySmall" color={colors.inkSoft}>
                {r.label}
              </AppText>
              <AppText variant="cardTitle" style={{ fontSize: 13, flexShrink: 1, textAlign: "right" }} forceLatin>
                {r.value}
              </AppText>
            </View>
          ))}
        </View>
        <View style={{ marginTop: 14 }}>
          <TestModeTag />
        </View>
      </View>
      <Button label={t("downloadReceipt")} kind="secondary" onPress={actions.downloadReceipt} height={50} fontSize={15} weight={600} style={{ marginBottom: 11 }} />
      <Button label={t("done")} onPress={actions.finishPay} />
    </View>
  );
}

/** The gateway declined. Says why, in the server's words, and that no money left the account. */
function FailedBody({ payment }: { payment: Payment }) {
  const { actions } = useResident();
  const { colors } = useTheme();
  return (
    <View>
      <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.badWash, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <Icon d={iconPaths.alert} size={26} color={colors.badInk} strokeWidth={2} />
      </View>
      <AppText variant="cardTitleLarge" style={{ fontSize: 19, marginBottom: 6 }} accessibilityRole="header">
        Payment didn't go through
      </AppText>
      <AppText variant="body" color={colors.inkSoft} style={{ marginBottom: 6 }}>
        {formatPaise(payment.amountPaise)} for {payment.unitLabel} — {payment.failureReason ?? "the bank declined it"}.
      </AppText>
      <AppText variant="cardTitle" color={colors.okInk} style={{ fontSize: 13.5, marginBottom: 20 }}>
        Nothing was charged.
      </AppText>
      <Button label="Try again" onPress={actions.retryPay} height={50} fontSize={15} weight={700} style={{ marginBottom: 10 }} />
      <Button label="Close" kind="secondary" onPress={actions.closeSheet} height={48} fontSize={14.5} weight={600} />
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
