import { useRef, useCallback, useMemo } from "react";
import { motionDurationsMs, MAX_TOASTS, FOCUS_UNIT_OWNER, FOCUS_UNIT_TENANT, vehicleOwnerForUnit, t, type Role, type Language, type VisitorPass, type DailyHelp, type AttendanceSheet, type Ticket, type HouseholdMember, type Vehicle, type Booking, type PersonalInfo } from "@sahaj/shared";
import type { AppResidentState, ResidentAction } from "./types";
import { currentUnit } from "./selectors";
import { createInitialState } from "./initialState";

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
 * form, and every timer this hook starts (toasts, the QR countdown, the SOS
 * hold) is torn down by `clearAllTimers`.
 */
export function useResidentActions(dispatch: Dispatch, getState: GetState) {
  const toastTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const qrTick = useRef<ReturnType<typeof setInterval> | null>(null);
  const sosTick = useRef<ReturnType<typeof setInterval> | null>(null);
  const sosStartedAt = useRef<number>(0);
  const duesShimmer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const note = useCallback(
    (text: string) => {
      dispatch({ type: "UPDATE", updater: (s) => ({ log: [{ id: uid("l"), at: new Date().toISOString(), message: text }].concat(s.log).slice(0, 14) }) });
    },
    [dispatch]
  );

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
    if (sosTick.current) clearInterval(sosTick.current);
    if (duesShimmer.current) clearTimeout(duesShimmer.current);
  }, []);

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

  // ---- Role / unit / language / theme -------------------------------------
  const roleLabel = (role: Role, lang: Language) => t(lang, role === "owner" ? "owner" : role === "tenant" ? "tenant" : "ownerAndTenant");

  const setRole = useCallback(
    (role: Role) => {
      // Each role has its own home unit (README's "Roles and data scoping" table):
      // owner and owner-and-tenant start on the occupied flat A-1204, tenant starts
      // on the rented flat B-0702 — never leave a tenant looking at the owner's unit.
      const unit = role === "tenant" ? FOCUS_UNIT_TENANT : FOCUS_UNIT_OWNER;
      dispatch({ type: "SET", patch: { role, unit, dueFilter: "all" } });
      const lang = getState().language;
      toast(t(lang, "nowViewingAs", { role: roleLabel(role, lang).toLowerCase() }));
      note(`Switched view to ${role}`);
    },
    [dispatch, getState, note, toast]
  );

  const setUnit = useCallback(
    (unit: string) => {
      dispatch({ type: "SET", patch: { unit } });
      note(`Switched ledger to ${unit}`);
    },
    [dispatch, note]
  );

  const setLanguage = useCallback(
    (language: Language) => {
      dispatch({ type: "SET", patch: { language } });
      toast(t(language, "languageSet", { name: language === "mr" ? "मराठी" : language === "hi" ? "हिंदी" : "English" }));
      note(`Set language to ${language}`);
    },
    [dispatch, note, toast]
  );

  const toggleTheme = useCallback(() => dispatch({ type: "UPDATE", updater: (s) => ({ dark: !s.dark }) }), [dispatch]);

  // ---- Dues / bills ---------------------------------------------------------
  const setDueFilter = useCallback(
    (filter: AppResidentState["dueFilter"]) => {
      dispatch({ type: "SET", patch: { dueFilter: filter, duesLoading: true } });
      note(`Filtered dues by ${filter}`);
      if (duesShimmer.current) clearTimeout(duesShimmer.current);
      duesShimmer.current = setTimeout(() => dispatch({ type: "SET", patch: { duesLoading: false } }), motionDurationsMs.skeletonShimmer);
    },
    [dispatch, note]
  );

  const openBill = useCallback(
    (id: string) => {
      dispatch({ type: "SET", patch: { activeBillId: id } });
      go("bill", true);
      note(`Opened bill ${id}`);
    },
    [dispatch, go, note]
  );

  // ---- Payment sheet ---------------------------------------------------------
  const openPay = useCallback(() => {
    dispatch({ type: "SET", patch: { sheet: "pay" } });
    note("Opened payment options");
  }, [dispatch, note]);

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
    note("Generated a QR code, 10:00 on the clock");
  }, [dispatch, note, startQrTimer]);

  const restartQr = useCallback(() => {
    dispatch({ type: "SET", patch: { qrLeftSeconds: 600, qrState: "live" } });
    startQrTimer();
    note("Generated a fresh QR code");
  }, [dispatch, note, startQrTimer]);

  const cancelQr = useCallback(() => {
    if (qrTick.current) clearInterval(qrTick.current);
    dispatch({ type: "SET", patch: { sheet: null } });
    toast("Payment cancelled. Nothing was charged.", "warn");
    note("Cancelled the QR payment");
  }, [dispatch, note, toast]);

  const payApp = useCallback(() => {
    dispatch({ type: "SET", patch: { sheet: "app" } });
    note("Chose to pay with an installed app");
  }, [dispatch, note]);

  const markPaid = useCallback(
    (via: string) => {
      if (qrTick.current) clearInterval(qrTick.current);
      const s = getState();
      const bill = s.bills.find((b) => b.id === s.activeBillId);
      if (!bill) return;
      const receipt = "RCP-2026-09-" + String(1000 + Math.floor(Math.random() * 8999));
      dispatch({
        type: "UPDATE",
        updater: (st) => ({
          bills: st.bills.map((b) => (b.id === st.activeBillId ? { ...b, status: "paid", paidOn: new Date().toISOString(), receiptNo: receipt, paymentMethod: via } : b)),
          lastPaidBillId: st.activeBillId,
          sheet: "success",
        }),
      });
      note(`Paid bill ${bill.id} via ${via}`);
    },
    [dispatch, getState, note]
  );

  const simulatePaid = useCallback(() => markPaid("UPI QR"), [markPaid]);
  const choosePaymentApp = useCallback((name: string) => markPaid(name), [markPaid]);

  const downloadReceipt = useCallback(() => toast("Receipt saved to your phone."), [toast]);

  const finishPay = useCallback(() => {
    dispatch({ type: "SET", patch: { sheet: null } });
    go("dues");
    note("Closed the receipt");
  }, [dispatch, go, note]);

  // ---- Notices ---------------------------------------------------------
  const openNotice = useCallback(
    (id: string) => {
      dispatch({ type: "UPDATE", updater: (s) => ({ activeNoticeId: id, notices: s.notices.map((n) => (n.id === id ? { ...n, unread: false } : n)) }) });
      go("notice", true);
      note(`Read notice ${id}`);
    },
    [dispatch, go, note]
  );

  const ackNotice = useCallback(() => {
    const id = getState().activeNoticeId;
    dispatch({ type: "UPDATE", updater: (s) => ({ notices: s.notices.map((n) => (n.id === id ? { ...n, acked: true } : n)) }) });
    toast("Acknowledgement sent to the office.");
    note("Acknowledged a notice");
  }, [getState, note, toast, dispatch]);

  // ---- Visitors / invite ---------------------------------------------------------
  const goInvite = useCallback(() => {
    go("invite", true);
    note("Started a guest invite");
  }, [go, note]);

  const setInviteType = useCallback((kind: AppResidentState["inviteType"]) => dispatch({ type: "SET", patch: { inviteType: kind, guestFormError: false } }), [dispatch]);

  const setGuestName = useCallback((name: string) => dispatch({ type: "UPDATE", updater: (s) => ({ guestForm: { ...s.guestForm, name }, guestFormError: false }) }), [dispatch]);
  const setGuestPurpose = useCallback((purpose: AppResidentState["guestForm"]["purpose"]) => dispatch({ type: "UPDATE", updater: (s) => ({ guestForm: { ...s.guestForm, purpose } }) }), [dispatch]);
  const setGuestWindow = useCallback((window: AppResidentState["guestForm"]["window"]) => dispatch({ type: "UPDATE", updater: (s) => ({ guestForm: { ...s.guestForm, window } }) }), [dispatch]);

  const createGuestPass = useCallback(() => {
    const s = getState();
    if (!s.guestForm.name.trim()) {
      dispatch({ type: "SET", patch: { guestFormError: true } });
      note("Blocked an invite with no name");
      return;
    }
    dispatch({ type: "SET", patch: { creatingPass: true } });
    setTimeout(() => {
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
      note(`Created pass ${code} for ${pass.name}`);
    }, motionDurationsMs.createGuestPass);
  }, [dispatch, getState, go, note]);

  const sharePass = useCallback(() => toast("Code sent to your guest over WhatsApp."), [toast]);

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
      note(standing ? `Revoked ${pass.name}'s standing pass` : `Cancelled the pass for ${pass.name}`);
    },
    [dispatch, note, toast]
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
    note(`Registered ${person.name} as daily help — pass ${passNo}`);
  }, [dispatch, getState, go, note, toast]);

  const goAfterPassDone = useCallback(() => {
    const s = getState();
    const isStanding = s.passes.some((p) => p.code === s.newPassCode && p.kind === "standing");
    if (isStanding) {
      go("dailyHelp");
      note("Opened the new attendance record");
    } else {
      go("visitors");
      note("Back to visitors");
    }
  }, [getState, go, note]);

  // ---- Helpdesk / tickets ---------------------------------------------------------
  const goNewTicket = useCallback(() => {
    go("newTicket", true);
    note("Started a new ticket");
  }, [go, note]);

  const setTicketCategory = useCallback((category: AppResidentState["ticketForm"]["category"]) => dispatch({ type: "UPDATE", updater: (s) => ({ ticketForm: { ...s.ticketForm, category } }) }), [dispatch]);
  const setTicketIssue = useCallback((issue: string) => dispatch({ type: "UPDATE", updater: (s) => ({ ticketForm: { ...s.ticketForm, issue }, ticketFormError: false }) }), [dispatch]);
  const toggleTicketUrgent = useCallback(() => dispatch({ type: "UPDATE", updater: (s) => ({ ticketForm: { ...s.ticketForm, urgent: !s.ticketForm.urgent } }) }), [dispatch]);

  const submitTicket = useCallback(() => {
    const s = getState();
    if (!s.ticketForm.issue.trim()) {
      dispatch({ type: "SET", patch: { ticketFormError: true } });
      note("Blocked an empty ticket");
      return;
    }
    dispatch({ type: "SET", patch: { submittingTicket: true } });
    setTimeout(() => {
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
        lastUpdate: s.ticketForm.urgent ? "Marked urgent. Supervisor paged." : "Waiting for the facility desk.",
        timeline: [{ at: "Just now", note: `Raised by you — ${s.ticketForm.issue.trim()}` }],
      };
      dispatch({
        type: "UPDATE",
        updater: (st) => ({ tickets: [ticket].concat(st.tickets), submittingTicket: false, activeTicketId: id, ticketForm: { ...st.ticketForm, issue: "", urgent: false } }),
      });
      go("helpdesk");
      toast(`${id} raised. Expect a reply within 4 hours.`);
      note(`Raised ${id} under ${s.ticketForm.category}`);
    }, 680);
  }, [dispatch, getState, go, note, toast]);

  const openTicket = useCallback(
    (id: string) => {
      dispatch({ type: "SET", patch: { activeTicketId: id } });
      go("ticket", true);
      note(`Opened ${id}`);
    },
    [dispatch, go, note]
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
    note(`Resolved ${id}`);
  }, [getState, note, toast, dispatch]);

  // ---- Notifications feed / preferences ---------------------------------------------------------
  const goNotifs = useCallback(() => {
    go("notifs", true);
    note("Opened notifications");
  }, [go, note]);

  const markAllNotifsRead = useCallback(() => {
    dispatch({ type: "UPDATE", updater: (s) => ({ notifs: s.notifs.map((n) => ({ ...n, unread: false })) }) });
    note("Marked all notifications read");
  }, [dispatch, note]);

  const toggleNotifPref = useCallback(
    (key: string) => {
      dispatch({ type: "UPDATE", updater: (s) => ({ prefs: s.prefs.map((p) => (p.key === key ? { ...p, on: !p.on } : p)) }) });
      const pref = getState().prefs.find((p) => p.key === key);
      if (pref) note(`${pref.on ? "Turned off " : "Turned on "}${pref.label.toLowerCase()}`);
    },
    [dispatch, getState, note]
  );

  // ---- Personal details ---------------------------------------------------------
  const toggleEditPersonal = useCallback(() => dispatch({ type: "UPDATE", updater: (s) => ({ editingPersonalDetails: !s.editingPersonalDetails }) }), [dispatch]);
  const setPersonalField = useCallback((field: keyof PersonalInfo, value: string) => dispatch({ type: "UPDATE", updater: (s) => ({ me: { ...s.me, [field]: value } }) }), [dispatch]);
  const savePersonalDetails = useCallback(() => {
    dispatch({ type: "SET", patch: { editingPersonalDetails: false } });
    toast("Personal details updated.");
    note("Saved personal details");
  }, [dispatch, note, toast]);

  // ---- Household ---------------------------------------------------------
  const setMemberNameInput = useCallback((value: string) => dispatch({ type: "SET", patch: { memberNameInput: value } }), [dispatch]);
  const setRelationInput = useCallback((value: AppResidentState["relationInput"]) => dispatch({ type: "SET", patch: { relationInput: value } }), [dispatch]);
  const addHouseholdMember = useCallback(() => {
    const s = getState();
    const name = s.memberNameInput.trim();
    if (!name) {
      toast("A member needs a name.", "warn");
      return;
    }
    const unit = currentUnit(s).code;
    const member: HouseholdMember = { id: uid("h"), unit, name, relation: s.relationInput };
    dispatch({ type: "UPDATE", updater: (st) => ({ household: st.household.concat([member]), memberNameInput: "" }) });
    toast(`${name} added. The gate can verify them now.`);
    note(`Added ${name} to the household`);
  }, [dispatch, getState, note, toast]);
  const removeHouseholdMember = useCallback(
    (member: HouseholdMember) => {
      dispatch({ type: "UPDATE", updater: (s) => ({ household: s.household.filter((m) => m.id !== member.id) }) });
      toast(`${member.name} removed from the household.`, "warn");
      note(`Removed ${member.name} from the household`);
    },
    [dispatch, note, toast]
  );

  // ---- Vehicles ---------------------------------------------------------
  const setPlateInput = useCallback((value: string) => dispatch({ type: "SET", patch: { plateInput: value.toUpperCase() } }), [dispatch]);
  const setVehicleTypeInput = useCallback((value: AppResidentState["vehicleTypeInput"]) => dispatch({ type: "SET", patch: { vehicleTypeInput: value } }), [dispatch]);
  const addVehicle = useCallback(() => {
    const s = getState();
    const plate = s.plateInput.trim();
    if (plate.length < 6) {
      toast("Enter the full registration number.", "warn");
      return;
    }
    const unit = currentUnit(s).code;
    const vehicle: Vehicle = { id: uid("v"), unit, plate, type: s.vehicleTypeInput, ownerName: vehicleOwnerForUnit(unit) ?? "", slot: undefined };
    dispatch({ type: "UPDATE", updater: (st) => ({ vehicles: st.vehicles.concat([vehicle]), plateInput: "" }) });
    toast(`${plate} registered. Slot follows from the office.`);
    note(`Registered vehicle ${plate}`);
  }, [dispatch, getState, note, toast]);
  const removeVehicle = useCallback(
    (vehicle: Vehicle) => {
      dispatch({ type: "UPDATE", updater: (s) => ({ vehicles: s.vehicles.filter((v) => v.id !== vehicle.id) }) });
      toast(`${vehicle.plate} removed.`, "warn");
      note(`Removed vehicle ${vehicle.plate}`);
    },
    [dispatch, note, toast]
  );

  // ---- Deliveries ---------------------------------------------------------
  const setDeliveryPref = useCallback(
    (pref: AppResidentState["deliveryPref"]) => {
      dispatch({ type: "SET", patch: { deliveryPref: pref } });
      toast("The gate has been told.");
      note(`Delivery preference: ${pref.toLowerCase()}`);
    },
    [dispatch, note, toast]
  );

  // ---- Amenities / booking ---------------------------------------------------------
  const openAmenity = useCallback(
    (id: string) => {
      dispatch({ type: "SET", patch: { bookAmenityId: id } });
      go("book", true);
      note(`Opened booking for ${id}`);
    },
    [dispatch, go, note]
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
    toast(`${amenity.name} booked for ${s.bookDay}.`);
    note(`Booked ${amenity.name.toLowerCase()} for ${s.bookDay}`);
    go("amenities");
  }, [dispatch, getState, go, note, toast]);
  const cancelBooking = useCallback(
    (booking: Booking, amenityName: string) => {
      dispatch({ type: "UPDATE", updater: (s) => ({ bookings: s.bookings.filter((b) => b.id !== booking.id) }) });
      toast(`${amenityName} booking cancelled. Deposit returns in 3 days.`, "warn");
      note(`Cancelled the ${amenityName.toLowerCase()} booking`);
    },
    [dispatch, note, toast]
  );

  // ---- Votes / AGM ---------------------------------------------------------
  const goPolls = useCallback(() => {
    go("polls", true);
    note("Opened votes");
  }, [go, note]);
  const openPoll = useCallback(
    (id: string) => {
      dispatch({ type: "SET", patch: { activePollId: id } });
      go("poll", true);
      note(`Opened vote ${id}`);
    },
    [dispatch, go, note]
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
      toast(`Vote recorded for ${unit}.`);
      note(`Voted on ${pollId}`);
    },
    [dispatch, getState, note, toast]
  );

  // ---- Statement ---------------------------------------------------------
  const goStatement = useCallback(() => {
    go("statement", true);
    note("Opened the statement");
  }, [go, note]);
  const downloadStatement = useCallback(() => toast("Statement for 2026-27 saved to your phone."), [toast]);

  // ---- Tenants ---------------------------------------------------------
  const startRenewal = useCallback(() => {
    const s = getState();
    if (s.renewed) {
      toast("A renewal request is already with the office.", "warn");
      return;
    }
    dispatch({ type: "SET", patch: { renewed: true } });
    toast("Renewal started. The office will send the draft.");
    note("Started the tenancy renewal");
  }, [dispatch, getState, note, toast]);

  // ---- Daily help attendance screen ---------------------------------------------------------
  const selectHelpPerson = useCallback(
    (passNo: string) => {
      dispatch({ type: "SET", patch: { activeHelpPassNo: passNo } });
      note(`Viewed attendance for ${passNo}`);
    },
    [dispatch, note]
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
    note(`Marked ${person?.name}'s salary paid`);
  }, [dispatch, getState, note, toast]);

  // ---- Emergency / SOS ---------------------------------------------------------
  const goSos = useCallback(() => {
    go("sos", true);
    note("Opened the emergency screen");
  }, [go, note]);
  const setSosKind = useCallback((kind: AppResidentState["sosKind"]) => dispatch({ type: "SET", patch: { sosKind: kind } }), [dispatch]);
  const sosStart = useCallback(() => {
    if (sosTick.current) clearInterval(sosTick.current);
    sosStartedAt.current = Date.now();
    dispatch({ type: "SET", patch: { holdingSos: true, sosPct: 0 } });
    sosTick.current = setInterval(() => {
      // Elapsed wall-clock time drives the fill, never a per-tick counter (README's
      // "Hold-to-confirm... computed from elapsed wall-clock time, not by incrementing
      // a counter per tick" — throttled frames must not silently stall the confirm).
      const pct = Math.min(100, Math.round(((Date.now() - sosStartedAt.current) / motionDurationsMs.holdToConfirm) * 100));
      if (pct >= 100) {
        if (sosTick.current) clearInterval(sosTick.current);
        dispatch({ type: "SET", patch: { holdingSos: false, sosPct: 0, sosSent: true } });
        const kind = getState().sosKind ?? "Medical";
        toast(`${kind} alert sent. Help is on the way.`, "warn");
        note(`Raised a ${kind.toLowerCase()} emergency`);
        return;
      }
      dispatch({ type: "SET", patch: { sosPct: pct } });
    }, 60);
  }, [dispatch, getState, note, toast]);
  const sosEnd = useCallback(() => {
    if (sosTick.current) clearInterval(sosTick.current);
    dispatch({ type: "UPDATE", updater: (s) => (s.holdingSos ? { holdingSos: false, sosPct: 0 } : {}) });
  }, [dispatch]);

  // ---- Reset ---------------------------------------------------------
  const resetAll = useCallback(() => {
    clearAllTimers();
    dispatch({ type: "SET", patch: createInitialState() });
  }, [clearAllTimers, dispatch]);

  return useMemo(
    () => ({
      note,
      toast,
      clearAllTimers,
      go,
      back,
      setRole,
      setUnit,
      setLanguage,
      toggleTheme,
      setDueFilter,
      openBill,
      openPay,
      closeSheet,
      startQr,
      restartQr,
      cancelQr,
      payApp,
      simulatePaid,
      choosePaymentApp,
      downloadReceipt,
      finishPay,
      openNotice,
      ackNotice,
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
      markAllNotifsRead,
      toggleNotifPref,
      toggleEditPersonal,
      setPersonalField,
      savePersonalDetails,
      setMemberNameInput,
      setRelationInput,
      addHouseholdMember,
      removeHouseholdMember,
      setPlateInput,
      setVehicleTypeInput,
      addVehicle,
      removeVehicle,
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
      setSosKind,
      sosStart,
      sosEnd,
      resetAll,
    }),
    [
      note, toast, clearAllTimers, go, back, setRole, setUnit, setLanguage, toggleTheme, setDueFilter, openBill,
      openPay, closeSheet, startQr, restartQr, cancelQr, payApp, simulatePaid, choosePaymentApp, downloadReceipt, finishPay,
      openNotice, ackNotice, goInvite, setInviteType, setGuestName, setGuestPurpose, setGuestWindow, createGuestPass, sharePass, cancelPass,
      setHelpName, setHelpRole, setHelpWindow, setHelpSalary, toggleHelpDay, createHelpPass, goAfterPassDone,
      goNewTicket, setTicketCategory, setTicketIssue, toggleTicketUrgent, submitTicket, openTicket, resolveTicket,
      goNotifs, markAllNotifsRead, toggleNotifPref, toggleEditPersonal, setPersonalField, savePersonalDetails,
      setMemberNameInput, setRelationInput, addHouseholdMember, removeHouseholdMember, setPlateInput, setVehicleTypeInput, addVehicle, removeVehicle,
      setDeliveryPref, openAmenity, setBookDay, setBookSlot, confirmBooking, cancelBooking, goPolls, openPoll, castVote,
      goStatement, downloadStatement, startRenewal, selectHelpPerson, markHelpPaid, goSos, setSosKind, sosStart, sosEnd, resetAll,
    ]
  );
}

export type ResidentActions = ReturnType<typeof useResidentActions>;
