import { useRef, useCallback, useMemo } from "react";
import { Share } from "react-native";
import { motionDurationsMs, MAX_TOASTS, t, type Role, type Language, type VisitorPass, type DailyHelp, type AttendanceSheet, type Ticket, type Booking, type PersonalInfo } from "@sahaj/shared";
import { heldUnits, type ResidentIdentity } from "../api/identity";
import type { AppResidentState, PayTarget, ResidentAction } from "./types";
import { currentUnit } from "./selectors";
import { createInitialState } from "./initialState";
import { saveLanguage, saveTheme, type DevicePrefs } from "./devicePrefs";

type Dispatch = (action: ResidentAction) => void;
type GetState = () => AppResidentState;

function uid(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fourDigitCode(): string {
  return String(1000 + Math.floor(Math.random() * 8999));
}

/**
 * Bound handlers for every interaction the resident app supports — the React
 * equivalent of the prototype's `renderVals()` bag of closures (README.md
 * "State management"). Mirrors the gate app's `state/actions.ts` conventions:
 * read/modify/write transitions go through the reducer's functional "UPDATE"
 * form, and every timer this hook starts (toasts, the QR countdown) is torn
 * down by `clearAllTimers`.
 */
/**
 * Stands in for the API round-trip an action will make once there is a backend.
 *
 * It resolves on the next tick, so nothing invents a wait: today creating a pass
 * or filing a ticket completes immediately, and the button's "Creating pass…"
 * state simply passes through too fast to see. That is the correct behaviour for
 * data that never leaves the device.
 *
 * The seam is kept so the spinner wiring already exists: when the call becomes
 * real, this is the one place it is awaited, and the button shows the wait the
 * network actually costs. Previously both callers hardcoded their own delay —
 * 620ms and 680ms — which made a local action feel like a slow request.
 */
function whenRequestSettles(run: () => void): void {
  setTimeout(run, 0);
}

export function useResidentActions(dispatch: Dispatch, getState: GetState) {
  const toastTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const qrTick = useRef<ReturnType<typeof setInterval> | null>(null);
  // Set once the resident (or this phone's saved setting) has picked a language,
  // after which the account's `me.language` no longer overrides it.
  const languageChosen = useRef(false);

  const toast = useCallback(
    (message: string, kind: "ok" | "warn" = "ok") => {
      const id = uid("t");
      dispatch({ type: "UPDATE", updater: (s) => ({ toasts: s.toasts.concat([{ id, message, kind }]).slice(-MAX_TOASTS) }) });
      // Each toast owns its own 2.8s timer (README: "a shared timer is a bug") —
      // a second toast must never cancel the first one's dismissal.
      toastTimers.current[id] = setTimeout(() => {
        delete toastTimers.current[id];
        dispatch({ type: "UPDATE", updater: (s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }) });
      }, motionDurationsMs.toastDismiss);
    },
    [dispatch]
  );

  const clearAllTimers = useCallback(() => {
    Object.values(toastTimers.current).forEach(clearTimeout);
    toastTimers.current = {};
    if (qrTick.current) clearInterval(qrTick.current);
  }, []);

  /** A fresh store for a new account or a sign-out; the phone's theme and language carry over. */
  const freshState = useCallback((): AppResidentState => {
    const { dark, language } = getState();
    return { ...createInitialState(), dark, language };
  }, [getState]);

  // ---- Navigation ---------------------------------------------------------
  const go = useCallback(
    (screen: AppResidentState["screen"], pushCurrent = false) => {
      dispatch({ type: "UPDATE", updater: (s) => ({ screen, stack: pushCurrent ? s.stack.concat([s.screen]) : [] }) });
    },
    [dispatch]
  );

  const back = useCallback(() => {
    dispatch({
      type: "UPDATE",
      updater: (s) => {
        const stack = s.stack.slice();
        const prev = stack.pop() ?? "home";
        return { screen: prev, stack };
      },
    });
  }, [dispatch]);

  // ---- Identity / unit / language / theme -------------------------------------
  const adoptIdentity = useCallback(
    (identity: ResidentIdentity, role: Role) => {
      // A different account starts from a clean slate, so nothing one person did
      // locally (a draft pass, a vote) is visible to the next.
      if (getState().identity?.userId !== identity.userId) {
        clearAllTimers();
        dispatch({ type: "SET", patch: { ...freshState(), identity, role, unit: identity.homeUnit } });
        return;
      }
      // Same account, fresher data (e.g. a let-out flat just arrived): keep the
      // flat being viewed if it is still one of theirs.
      dispatch({
        type: "UPDATE",
        updater: (s) => ({ identity, role, unit: heldUnits(identity).includes(s.unit) ? s.unit : identity.homeUnit }),
      });
    },
    [clearAllTimers, dispatch, freshState, getState]
  );

  const setUnit = useCallback(
    (unit: string) => {
      dispatch({ type: "SET", patch: { unit } });
    },
    [dispatch]
  );

  const setLanguage = useCallback(
    (language: Language) => {
      languageChosen.current = true;
      saveLanguage(language);
      dispatch({ type: "SET", patch: { language } });
      toast(t(language, "languageSet", { name: language === "mr" ? "मराठी" : language === "hi" ? "हिंदी" : "English" }));
    },
    [dispatch, toast]
  );

  /** The account's own language, used only until one is chosen on this phone. */
  const defaultLanguage = useCallback(
    (language: Language) => {
      if (!languageChosen.current) dispatch({ type: "SET", patch: { language } });
    },
    [dispatch]
  );

  const toggleTheme = useCallback(() => {
    const dark = !getState().dark;
    saveTheme(dark);
    dispatch({ type: "SET", patch: { dark } });
  }, [dispatch, getState]);

  /** What the phone remembered from last time, read once at start-up. A saved choice wins over anything set meanwhile. */
  const hydratePrefs = useCallback(
    (prefs: DevicePrefs) => {
      if (prefs.language) languageChosen.current = true;
      const patch: Partial<AppResidentState> = {};
      if (prefs.dark !== undefined) patch.dark = prefs.dark;
      if (prefs.language) patch.language = prefs.language;
      dispatch({ type: "SET", patch });
    },
    [dispatch]
  );

  // ---- Dues / bills ---------------------------------------------------------
  const setDueFilter = useCallback(
    (filter: AppResidentState["dueFilter"]) => {
      // Filtering bills already in memory. The list swaps on the next render;
      // there is nothing to wait for, so nothing is shown waiting. This used to
      // set duesLoading and clear it on a 520ms timer, which put a skeleton in
      // front of data the app already had. See docs/LOADING_AND_MOTION.md.
      dispatch({ type: "SET", patch: { dueFilter: filter } });
    },
    [dispatch]
  );

  const openBill = useCallback(
    (id: string) => {
      dispatch({ type: "SET", patch: { activeBillId: id } });
      go("bill", true);
    },
    [dispatch, go]
  );

  // ---- Payment sheet ---------------------------------------------------------
  // The sheets are the dummy gateway's checkout. What they pay is set here; the
  // API calls (payments.start, then completeDummyCheckout) are made by
  // PaymentSheets, which owns the order and the outcome while it is open.
  const openPay = useCallback(
    (target: PayTarget) => {
      dispatch({ type: "SET", patch: { sheet: "pay", payTarget: target } });
    },
    [dispatch]
  );

  const closeSheet = useCallback(() => {
    if (qrTick.current) clearInterval(qrTick.current);
    dispatch({ type: "SET", patch: { sheet: null } });
  }, [dispatch]);

  const startQrTimer = useCallback(() => {
    if (qrTick.current) clearInterval(qrTick.current);
    qrTick.current = setInterval(() => {
      dispatch({
        type: "UPDATE",
        updater: (s) => {
          if (s.qrState !== "live" || s.sheet !== "qr") return {};
          const left = s.qrLeftSeconds - 1;
          if (left <= 0) {
            if (qrTick.current) clearInterval(qrTick.current);
            return { qrLeftSeconds: 0, qrState: "expired" };
          }
          return { qrLeftSeconds: left };
        },
      });
    }, 1000);
  }, [dispatch]);

  const startQr = useCallback(() => {
    dispatch({ type: "SET", patch: { sheet: "qr", qrLeftSeconds: 600, qrState: "live" } });
    startQrTimer();
  }, [dispatch, startQrTimer]);

  const restartQr = useCallback(() => {
    dispatch({ type: "SET", patch: { qrLeftSeconds: 600, qrState: "live" } });
    startQrTimer();
  }, [dispatch, startQrTimer]);

  const cancelQr = useCallback(() => {
    if (qrTick.current) clearInterval(qrTick.current);
    dispatch({ type: "SET", patch: { sheet: null } });
    toast("Payment cancelled. Nothing was charged.", "warn");
  }, [dispatch, toast]);

  const payApp = useCallback(() => {
    dispatch({ type: "SET", patch: { sheet: "app" } });
  }, [dispatch]);

  /** The gateway answered: the receipt takeover, or the declined sheet. */
  const showPayOutcome = useCallback(
    (outcome: "success" | "failed") => {
      if (qrTick.current) clearInterval(qrTick.current);
      dispatch({ type: "SET", patch: { sheet: outcome } });
    },
    [dispatch]
  );

  /** From the declined sheet: back to the method picker for a fresh attempt (a failed order can't be retried). */
  const retryPay = useCallback(() => {
    dispatch({ type: "SET", patch: { sheet: "pay" } });
  }, [dispatch]);

  // There is no receipt or statement PDF to download yet; say so rather than claim a file was saved.
  const downloadReceipt = useCallback(() => toast("Receipt downloads aren't available yet. The receipt number above is your proof of payment."), [toast]);

  const finishPay = useCallback(() => {
    dispatch({ type: "SET", patch: { sheet: null, payTarget: null } });
    go("dues");
  }, [dispatch, go]);

  // ---- Notices ---------------------------------------------------------
  // Read and acknowledged are recorded by the API (NoticeDetailScreen); only which notice is open lives here.
  const openNotice = useCallback(
    (id: string) => {
      dispatch({ type: "SET", patch: { activeNoticeId: id } });
      go("notice", true);
    },
    [dispatch, go]
  );

  // ---- Visitors / invite ---------------------------------------------------------
  const goInvite = useCallback(() => {
    go("invite", true);
  }, [go]);

  const setInviteType = useCallback((kind: AppResidentState["inviteType"]) => dispatch({ type: "SET", patch: { inviteType: kind, guestFormError: false } }), [dispatch]);

  const setGuestName = useCallback((name: string) => dispatch({ type: "UPDATE", updater: (s) => ({ guestForm: { ...s.guestForm, name }, guestFormError: false }) }), [dispatch]);
  const setGuestPurpose = useCallback((purpose: AppResidentState["guestForm"]["purpose"]) => dispatch({ type: "UPDATE", updater: (s) => ({ guestForm: { ...s.guestForm, purpose } }) }), [dispatch]);
  const setGuestWindow = useCallback((window: AppResidentState["guestForm"]["window"]) => dispatch({ type: "UPDATE", updater: (s) => ({ guestForm: { ...s.guestForm, window } }) }), [dispatch]);

  const createGuestPass = useCallback(() => {
    const s = getState();
    if (!s.guestForm.name.trim()) {
      dispatch({ type: "SET", patch: { guestFormError: true } });
      return;
    }
    dispatch({ type: "SET", patch: { creatingPass: true } });
    whenRequestSettles(() => {
      const code = fourDigitCode();
      const unit = currentUnit(getState()).code;
      const pass: VisitorPass = {
        id: uid("p"),
        code,
        kind: "guest",
        unit,
        name: s.guestForm.name.trim(),
        purpose: s.guestForm.purpose,
        state: "expected",
        issuedAt: new Date().toISOString(),
      };
      dispatch({
        type: "UPDATE",
        updater: (st) => ({ passes: [pass].concat(st.passes), newPassCode: code, creatingPass: false, guestForm: { ...st.guestForm, name: "" } }),
      });
      go("passDone");
    });
  }, [dispatch, getState, go]);

  /** Hands the code to the phone's own share sheet — the app sends nothing itself. */
  const sharePass = useCallback(() => {
    const s = getState();
    const pass = s.passes.find((p) => p.code === s.newPassCode);
    if (!pass) return;
    const where = s.identity?.societyName ? `${pass.unit}, ${s.identity.societyName}` : pass.unit;
    const message = pass.kind === "standing" ? `Your staff pass for ${where}: ${pass.code}` : `Your visitor code for ${where}: ${pass.code}`;
    Share.share({ message }).catch(() => toast(`Couldn't open sharing on this phone. The code is ${pass.code}.`, "warn"));
  }, [getState, toast]);

  const cancelPass = useCallback(
    (pass: VisitorPass) => {
      const standing = pass.kind === "standing";
      dispatch({
        type: "UPDATE",
        updater: (s) => ({
          passes: s.passes.filter((x) => x.id !== pass.id),
          dailyHelp: standing ? s.dailyHelp.filter((h) => h.name !== pass.name) : s.dailyHelp,
          attendanceSheets: standing ? s.attendanceSheets.filter((sheet) => !s.dailyHelp.some((h) => h.name === pass.name && h.passNo === sheet.personId)) : s.attendanceSheets,
        }),
      });
      toast(standing ? `${pass.name}'s pass revoked. Attendance record closed.` : `Pass for ${pass.name} cancelled.`, "warn");
    },
    [dispatch, toast]
  );

  // ---- Daily-help invite (standing pass + attendance, one atomic action) ----
  const setHelpName = useCallback((name: string) => dispatch({ type: "UPDATE", updater: (s) => ({ helpForm: { ...s.helpForm, name } }) }), [dispatch]);
  const setHelpRole = useCallback((role: AppResidentState["helpForm"]["role"]) => dispatch({ type: "UPDATE", updater: (s) => ({ helpForm: { ...s.helpForm, role } }) }), [dispatch]);
  const setHelpWindow = useCallback((window: AppResidentState["helpForm"]["window"]) => dispatch({ type: "UPDATE", updater: (s) => ({ helpForm: { ...s.helpForm, window } }) }), [dispatch]);
  const setHelpSalary = useCallback((salary: string) => dispatch({ type: "UPDATE", updater: (s) => ({ helpForm: { ...s.helpForm, salary: salary.replace(/[^0-9]/g, "") } }) }), [dispatch]);
  const toggleHelpDay = useCallback(
    (index: number) => dispatch({ type: "UPDATE", updater: (s) => { const days = s.helpForm.days.slice() as AppResidentState["helpForm"]["days"]; days[index] = !days[index]; return { helpForm: { ...s.helpForm, days } }; } }),
    [dispatch]
  );

  const createHelpPass = useCallback(() => {
    const s = getState();
    const f = s.helpForm;
    if (!f.name.trim()) {
      toast("A name is needed.", "warn");
      return;
    }
    if (!f.salary) {
      toast("Enter the agreed monthly salary.", "warn");
      return;
    }
    const passNo = "ST-" + String(1000 + Math.floor(Math.random() * 8999));
    const workingDaysPerWeek = f.days.filter(Boolean).length;
    const workingDays = workingDaysPerWeek * 4;
    const salary = parseInt(f.salary, 10);
    const perDayRate = Math.round(salary / Math.max(1, workingDays));
    const unit = currentUnit(s).code;
    const person: DailyHelp = { passNo, unit, name: f.name.trim(), role: f.role, days: f.days, window: f.window, monthlySalary: salary, perDayRate };
    const sheet: AttendanceSheet = { personId: passNo, days: new Array(30).fill("unrecorded") };
    const pass: VisitorPass = { id: uid("p"), code: passNo, kind: "standing", unit, name: person.name, purpose: "Service", state: "standing", issuedAt: new Date().toISOString() };
    dispatch({
      type: "UPDATE",
      updater: (st) => ({
        passes: [pass].concat(st.passes),
        dailyHelp: st.dailyHelp.concat([person]),
        attendanceSheets: st.attendanceSheets.concat([sheet]),
        activeHelpPassNo: passNo,
        newPassCode: passNo,
        helpForm: { ...st.helpForm, name: "", salary: "" },
      }),
    });
    go("passDone");
  }, [dispatch, getState, go, toast]);

  const goAfterPassDone = useCallback(() => {
    const s = getState();
    const isStanding = s.passes.some((p) => p.code === s.newPassCode && p.kind === "standing");
    if (isStanding) {
      go("dailyHelp");
    } else {
      go("visitors");
    }
  }, [getState, go]);

  // ---- Helpdesk / tickets ---------------------------------------------------------
  const goNewTicket = useCallback(() => {
    go("newTicket", true);
  }, [go]);

  const setTicketCategory = useCallback((category: AppResidentState["ticketForm"]["category"]) => dispatch({ type: "UPDATE", updater: (s) => ({ ticketForm: { ...s.ticketForm, category } }) }), [dispatch]);
  const setTicketIssue = useCallback((issue: string) => dispatch({ type: "UPDATE", updater: (s) => ({ ticketForm: { ...s.ticketForm, issue }, ticketFormError: false }) }), [dispatch]);
  const toggleTicketUrgent = useCallback(() => dispatch({ type: "UPDATE", updater: (s) => ({ ticketForm: { ...s.ticketForm, urgent: !s.ticketForm.urgent } }) }), [dispatch]);

  const submitTicket = useCallback(() => {
    const s = getState();
    if (!s.ticketForm.issue.trim()) {
      dispatch({ type: "SET", patch: { ticketFormError: true } });
      return;
    }
    dispatch({ type: "SET", patch: { submittingTicket: true } });
    whenRequestSettles(() => {
      const id = "TKT-" + (2292 + s.tickets.length);
      const unit = currentUnit(s).code;
      const ticket: Ticket = {
        id,
        unit,
        title: s.ticketForm.issue.trim().slice(0, 60),
        description: s.ticketForm.issue.trim(),
        category: s.ticketForm.category,
        priority: s.ticketForm.urgent ? "urgent" : "normal",
        status: "open",
        createdAt: "Just now",
        lastUpdate: s.ticketForm.urgent ? "Marked urgent. Saved on this phone; the office hasn't seen it." : "Saved on this phone; the office hasn't seen it.",
        timeline: [{ at: "Just now", note: `Raised by you — ${s.ticketForm.issue.trim()}` }],
      };
      dispatch({
        type: "UPDATE",
        updater: (st) => ({ tickets: [ticket].concat(st.tickets), submittingTicket: false, activeTicketId: id, ticketForm: { ...st.ticketForm, issue: "", urgent: false } }),
      });
      go("helpdesk");
      toast(`${id} saved on this phone. The helpdesk isn't connected yet, so call the office if it's urgent.`, "warn");
    });
  }, [dispatch, getState, go, toast]);

  const openTicket = useCallback(
    (id: string) => {
      dispatch({ type: "SET", patch: { activeTicketId: id } });
      go("ticket", true);
    },
    [dispatch, go]
  );

  const resolveTicket = useCallback(() => {
    const id = getState().activeTicketId;
    dispatch({
      type: "UPDATE",
      updater: (s) => ({
        tickets: s.tickets.map((tk) =>
          tk.id === id
            ? { ...tk, status: "resolved", lastUpdate: "Closed by you.", timeline: [{ at: "Just now", note: "Closed by you — you marked this resolved." }].concat(tk.timeline) }
            : tk
        ),
      }),
    });
    toast(`${id} marked resolved.`);
  }, [getState, toast, dispatch]);

  // ---- Notifications feed / preferences ---------------------------------------------------------
  const goNotifs = useCallback(() => {
    go("notifs", true);
  }, [go]);

  // ---- Email prompt ---------------------------------------------------------
  const dismissEmailPrompt = useCallback(() => {
    dispatch({ type: "SET", patch: { emailPromptDismissed: true } });
  }, [dispatch]);

  /** The prompt's action: Personal details, already in edit mode with the email field open. */
  const goAddEmail = useCallback(() => {
    dispatch({ type: "SET", patch: { editingPersonalDetails: true } });
    go("personal", true);
  }, [dispatch, go]);

  // ---- Personal details ---------------------------------------------------------
  const toggleEditPersonal = useCallback(() => dispatch({ type: "UPDATE", updater: (s) => ({ editingPersonalDetails: !s.editingPersonalDetails }) }), [dispatch]);
  const setPersonalField = useCallback((field: keyof PersonalInfo, value: string) => dispatch({ type: "UPDATE", updater: (s) => ({ me: { ...s.me, [field]: value } }) }), [dispatch]);
  /** Closes edit mode. Only the email is the account's; the other two fields live in this session only. */
  const savePersonalDetails = useCallback(
    (emailSaved: boolean) => {
      dispatch({ type: "SET", patch: { editingPersonalDetails: false } });
      toast(emailSaved ? "Email saved to your account." : "Kept until you close the app. Only your email reaches the society office.");
    },
    [dispatch, toast]
  );

  // ---- Household ---------------------------------------------------------
  const setMemberNameInput = useCallback((value: string) => dispatch({ type: "SET", patch: { memberNameInput: value } }), [dispatch]);
  const setRelationInput = useCallback((value: AppResidentState["relationInput"]) => dispatch({ type: "SET", patch: { relationInput: value } }), [dispatch]);
  // ---- Vehicles ---------------------------------------------------------
  const setPlateInput = useCallback((value: string) => dispatch({ type: "SET", patch: { plateInput: value.toUpperCase() } }), [dispatch]);
  const setVehicleTypeInput = useCallback((value: AppResidentState["vehicleTypeInput"]) => dispatch({ type: "SET", patch: { vehicleTypeInput: value } }), [dispatch]);
  // ---- Deliveries ---------------------------------------------------------
  const setDeliveryPref = useCallback(
    (pref: AppResidentState["deliveryPref"]) => {
      dispatch({ type: "SET", patch: { deliveryPref: pref } });
      toast("Saved on this phone. The gate can't see it yet.");
    },
    [dispatch, toast]
  );

  // ---- Amenities / booking ---------------------------------------------------------
  const openAmenity = useCallback(
    (id: string) => {
      dispatch({ type: "SET", patch: { bookAmenityId: id } });
      go("book", true);
    },
    [dispatch, go]
  );
  const setBookDay = useCallback((day: string) => dispatch({ type: "SET", patch: { bookDay: day } }), [dispatch]);
  const setBookSlot = useCallback(
    (slotIndex: number, taken: boolean) => {
      if (taken) {
        toast("That slot is already taken.", "warn");
        return;
      }
      dispatch({ type: "SET", patch: { bookSlot: slotIndex } });
    },
    [dispatch, toast]
  );
  const confirmBooking = useCallback(() => {
    const s = getState();
    const amenity = s.amenities.find((a) => a.id === s.bookAmenityId) ?? s.amenities[0];
    if (!amenity || s.bookDay === null || s.bookSlot === null) return;
    const unit = currentUnit(s).code;
    const booking: Booking = { id: uid("bk"), amenityId: amenity.id, unit, day: s.bookDay, slot: s.bookSlot, status: "confirmed", charge: amenity.rate };
    dispatch({ type: "UPDATE", updater: (st) => ({ bookings: [booking].concat(st.bookings) }) });
    toast(`${amenity.name} for ${s.bookDay} saved on this phone. The office hasn't been told yet.`);
    go("amenities");
  }, [dispatch, getState, go, toast]);
  const cancelBooking = useCallback(
    (booking: Booking, amenityName: string) => {
      dispatch({ type: "UPDATE", updater: (s) => ({ bookings: s.bookings.filter((b) => b.id !== booking.id) }) });
      toast(`${amenityName} booking removed.`, "warn");
    },
    [dispatch, toast]
  );

  // ---- Votes / AGM ---------------------------------------------------------
  const goPolls = useCallback(() => {
    go("polls", true);
  }, [go]);
  const openPoll = useCallback(
    (id: string) => {
      dispatch({ type: "SET", patch: { activePollId: id } });
      go("poll", true);
    },
    [dispatch, go]
  );
  const castVote = useCallback(
    (pollId: string, optionKey: string) => {
      const s = getState();
      if (s.votes[pollId]) {
        toast("Your vote is already cast.", "warn");
        return;
      }
      const unit = currentUnit(s).code;
      dispatch({ type: "UPDATE", updater: (st) => ({ votes: { ...st.votes, [pollId]: optionKey } }) });
      toast(`Vote saved on this phone for ${unit}. AGM voting isn't connected yet, so it hasn't been counted.`, "warn");
    },
    [dispatch, getState, toast]
  );

  // ---- Statement ---------------------------------------------------------
  const goStatement = useCallback(() => {
    go("statement", true);
  }, [go]);
  /** `fy` is the statement's financial year as the screen names it ("2026-27"). */
  const downloadStatement = useCallback((fy: string) => toast(`The ${fy} statement can't be downloaded yet. Everything on it is on this screen.`), [toast]);

  // ---- Tenants ---------------------------------------------------------
  const startRenewal = useCallback(() => {
    const s = getState();
    if (s.renewed) {
      toast("You've already noted a renewal on this phone.", "warn");
      return;
    }
    dispatch({ type: "SET", patch: { renewed: true } });
    toast("Renewal noted on this phone. The office hasn't been told, so ask them to start it.", "warn");
  }, [dispatch, getState, toast]);

  // ---- Daily help attendance screen ---------------------------------------------------------
  const selectHelpPerson = useCallback(
    (passNo: string) => {
      dispatch({ type: "SET", patch: { activeHelpPassNo: passNo } });
    },
    [dispatch]
  );
  const markHelpPaid = useCallback(() => {
    const s = getState();
    const passNo = s.activeHelpPassNo;
    if (!passNo) return;
    if (s.paidHelp[passNo]) {
      toast("Already marked paid for September.", "warn");
      return;
    }
    const person = s.dailyHelp.find((h) => h.passNo === passNo);
    dispatch({ type: "UPDATE", updater: (st) => ({ paidHelp: { ...st.paidHelp, [passNo]: true } }) });
    toast(`${person?.name ?? "Salary"} marked paid.`);
  }, [dispatch, getState, toast]);

  // ---- Emergency ---------------------------------------------------------
  // No alert is raised from the app yet; the screen offers phone calls instead (EmergencyScreen).
  const goSos = useCallback(() => {
    go("sos", true);
  }, [go]);

  // ---- Reset ---------------------------------------------------------
  const resetAll = useCallback(() => {
    clearAllTimers();
    dispatch({ type: "SET", patch: freshState() });
  }, [clearAllTimers, dispatch, freshState]);

  return useMemo(
    () => ({
      toast,
      clearAllTimers,
      go,
      back,
      adoptIdentity,
      setUnit,
      setLanguage,
      defaultLanguage,
      toggleTheme,
      hydratePrefs,
      setDueFilter,
      openBill,
      openPay,
      closeSheet,
      startQr,
      restartQr,
      cancelQr,
      payApp,
      showPayOutcome,
      retryPay,
      downloadReceipt,
      finishPay,
      openNotice,
      goInvite,
      setInviteType,
      setGuestName,
      setGuestPurpose,
      setGuestWindow,
      createGuestPass,
      sharePass,
      cancelPass,
      setHelpName,
      setHelpRole,
      setHelpWindow,
      setHelpSalary,
      toggleHelpDay,
      createHelpPass,
      goAfterPassDone,
      goNewTicket,
      setTicketCategory,
      setTicketIssue,
      toggleTicketUrgent,
      submitTicket,
      openTicket,
      resolveTicket,
      goNotifs,
      dismissEmailPrompt,
      goAddEmail,
      toggleEditPersonal,
      setPersonalField,
      savePersonalDetails,
      setMemberNameInput,
      setRelationInput,
      setPlateInput,
      setVehicleTypeInput,
      setDeliveryPref,
      openAmenity,
      setBookDay,
      setBookSlot,
      confirmBooking,
      cancelBooking,
      goPolls,
      openPoll,
      castVote,
      goStatement,
      downloadStatement,
      startRenewal,
      selectHelpPerson,
      markHelpPaid,
      goSos,
      resetAll,
    }),
    [
      toast, clearAllTimers, go, back, adoptIdentity, setUnit, setLanguage, defaultLanguage, toggleTheme, hydratePrefs, setDueFilter, openBill,
      openPay, closeSheet, startQr, restartQr, cancelQr, payApp, showPayOutcome, retryPay, downloadReceipt, finishPay,
      openNotice, goInvite, setInviteType, setGuestName, setGuestPurpose, setGuestWindow, createGuestPass, sharePass, cancelPass,
      setHelpName, setHelpRole, setHelpWindow, setHelpSalary, toggleHelpDay, createHelpPass, goAfterPassDone,
      goNewTicket, setTicketCategory, setTicketIssue, toggleTicketUrgent, submitTicket, openTicket, resolveTicket,
      goNotifs, dismissEmailPrompt, goAddEmail, toggleEditPersonal, setPersonalField, savePersonalDetails,
      setMemberNameInput, setRelationInput, setPlateInput, setVehicleTypeInput,
      setDeliveryPref, openAmenity, setBookDay, setBookSlot, confirmBooking, cancelBooking, goPolls, openPoll, castVote,
      goStatement, downloadStatement, startRenewal, selectHelpPerson, markHelpPaid, goSos, resetAll,
    ]
  );
}

export type ResidentActions = ReturnType<typeof useResidentActions>;
