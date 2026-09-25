import { useRef, useCallback, useMemo } from "react";
import {
  motionDurationsMs,
  MAX_TOASTS,
  type EntryLogRow,
  type Parcel,
  type StaffMember,
  type AlertKind,
  type GateAlert,
} from "@sahaj/shared";
import type { AppGateState, AppScreen, GateAction } from "./types";
import { verifyCode } from "./verify";
import { receivingGuard } from "./selectors";
import { UNIT_DELIVERY_PREFS } from "../mock/gateSeed";
import { stamp } from "../utils/time";

type Dispatch = (action: GateAction) => void;

function uid(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * Bound handlers for every interaction the gate handset supports — the React
 * equivalent of the prototype's `renderVals()` bag of closures. Read/modify/write
 * transitions go through the reducer's functional "UPDATE" form so a burst of
 * near-simultaneous timers (a toast expiring while a verify resolves) can never
 * clobber each other with a stale snapshot.
 */
const DRILL_DOWNS: AppScreen[] = ["walkin", "alert", "plate", "handover", "notices", "notice"];
export const isDrillDownScreen = (s: AppScreen) => DRILL_DOWNS.includes(s);

/**
 * Stands in for the API round-trip a request will make once there is a backend.
 *
 * Resolves on the next tick, so nothing invents a wait: verifying a code against
 * the fixture passes bundled with the app completes immediately, and the button's
 * "Checking…" state passes through too fast to see. (There is no pass cache on
 * the handset yet; C9's offline store is what will make most lookups local.)
 *
 * The seam is kept so the wiring already exists: when a lookup does reach the
 * network, this is the one place it is awaited and the button shows the time it
 * actually costs. It previously hardcoded 620ms, which made a local cache hit
 * feel like a slow request.
 */
function whenRequestSettles(run: () => void): ReturnType<typeof setTimeout> {
  return setTimeout(run, 0);
}

/** How long an urgent toast (an emergency) stays up unless the guard taps it away — long enough to be read from across the cabin. */
const URGENT_TOAST_MS = 8000;

/**
 * Everything in flight on the handset — a typed code, an open verdict, a pending walk-in — which locking must not leave behind.
 * Toasts go too: locking cancels their dismiss timers, so any left in state would come back after unlock and never leave.
 */
const IN_FLIGHT: Partial<AppGateState> = {
  onDuty: false,
  toasts: [],
  screen: "entry",
  noticeId: null,
  code: "",
  checking: false,
  result: null,
  parcelOpen: false,
  parcelError: false,
  walkinStage: "form",
  holding: false,
  holdPct: 0,
};

export function useGateActions(dispatch: Dispatch) {
  const toastTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const verifyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdStartedAt = useRef<number>(0);

  const note = useCallback(
    (text: string) => {
      dispatch({
        type: "UPDATE",
        updater: (s) => ({ log: [{ id: uid("l"), at: new Date().toISOString(), message: text }].concat(s.log).slice(0, 14) }),
      });
    },
    [dispatch]
  );

  const dismissToast = useCallback(
    (id: string) => {
      const timer = toastTimers.current[id];
      if (timer) clearTimeout(timer);
      delete toastTimers.current[id];
      dispatch({ type: "UPDATE", updater: (s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }) });
    },
    [dispatch]
  );

  /** `urgent` is for emergencies: it stays up for URGENT_TOAST_MS rather than the standard 2.8s, and a tap dismisses it. */
  const toast = useCallback(
    (message: string, kind: "ok" | "warn" | "bad" = "ok", options?: { urgent?: boolean }) => {
      const id = uid("t");
      const urgent = options?.urgent === true;
      dispatch({
        type: "UPDATE",
        updater: (s) => ({ toasts: s.toasts.concat([{ id, message, kind, urgent }]).slice(-MAX_TOASTS) }),
      });
      toastTimers.current[id] = setTimeout(() => dismissToast(id), urgent ? URGENT_TOAST_MS : motionDurationsMs.toastDismiss);
    },
    [dispatch, dismissToast]
  );

  const clearAllTimers = useCallback(() => {
    Object.values(toastTimers.current).forEach(clearTimeout);
    toastTimers.current = {};
    if (verifyTimer.current) clearTimeout(verifyTimer.current);
    if (holdTimer.current) clearInterval(holdTimer.current);
  }, []);

  // ---- Shift ------------------------------------------------------------
  //
  // Who the guard is comes from the API session (SessionGate); these only move
  // the handset between locked and on duty. See features/signin/ShiftScreen.tsx
  // for what the duty PIN does and does not check.

  const startShift = useCallback(
    (guardName: string, startedAt: string) => {
      dispatch({ type: "SET", patch: { onDuty: true, guardName, shiftStartedAt: startedAt, screen: "entry", cameFrom: "entry" } });
      toast(`Signed in. Shift started at ${stamp(new Date(startedAt))}.`, "ok");
      note(`${guardName} signed in for shift`);
    },
    [dispatch, note, toast]
  );

  const resumeShift = useCallback(
    (guardName: string, startedAt: string) => {
      dispatch({ type: "SET", patch: { onDuty: true, guardName, shiftStartedAt: startedAt, screen: "entry", cameFrom: "entry" } });
      toast("Handset unlocked.", "ok");
      note(`${guardName} unlocked the handset`);
    },
    [dispatch, note, toast]
  );

  /** The door icon: back to the duty PIN. The API session stays; only the handset locks. */
  const lock = useCallback(() => {
    clearAllTimers();
    dispatch({ type: "SET", patch: IN_FLIGHT });
    note("Locked the handset");
  }, [clearAllTimers, dispatch, note]);

  /** The session ended (sign-out, expiry, revocation): the shift ends with it. The gate's own log and parcels stay on the handset. */
  const endShift = useCallback(() => {
    clearAllTimers();
    dispatch({ type: "SET", patch: { ...IN_FLIGHT, guardName: null, shiftStartedAt: null, cameFrom: "entry", handoverDone: false, handoverNote: "" } });
    note("Ended the shift");
  }, [clearAllTimers, dispatch, note]);

  // ---- Navigation ---------------------------------------------------------

  const go = useCallback(
    (screen: AppScreen, noteText?: string) => {
      // Record the screen being left, but only when moving INTO a drill-down.
      // Otherwise tabbing around would overwrite the origin and back would return
      // to whichever tab was touched last rather than the one that opened it.
      const isDrillDown = isDrillDownScreen(screen);
      dispatch({
        type: "UPDATE",
        updater: (prev) => (isDrillDown && !isDrillDownScreen(prev.screen) ? { screen, cameFrom: prev.screen } : { screen }),
      });
      if (noteText) note(noteText);
    },
    [dispatch, note]
  );

  /**
   * Back out of a drill-down to whatever opened it, defaulting to More.
   *
   * Walk-in is reachable from Entry ("No code? Log a walk-in") and from More
   * ("Walk-in entry"), so a hardcoded target is wrong for half the journeys —
   * that is what sent back to Entry from the More menu.
   */
  const goBack = useCallback(
    (noteText?: string) => {
      dispatch({ type: "UPDATE", updater: (prev) => ({ screen: isDrillDownScreen(prev.cameFrom) ? "more" : prev.cameFrom }) });
      if (noteText) note(noteText);
    },
    [dispatch, note]
  );

  const openNotice = useCallback(
    (noticeId: string) => {
      dispatch({ type: "SET", patch: { noticeId } });
      go("notice", "Opened a notice from the office");
    },
    [dispatch, go]
  );

  /**
   * A tapped push notification. The server puts the screen in `data.route`;
   * the gate has one route, so the path is mapped onto a screen here. Anything
   * else the office might send (an account notice) lands on the notices list.
   */
  const openRoute = useCallback(
    (route: string) => {
      const notice = /^\/notices\/([^/?#]+)/.exec(route);
      if (notice) openNotice(notice[1]);
      else go("notices", "Opened the office notices from a notification");
    },
    [go, openNotice]
  );

  // ---- Verify a code -------------------------------------------------------
  const codeKey = useCallback(
    (key: string) => {
      if (key === "clear") {
        dispatch({ type: "SET", patch: { code: "" } });
        return;
      }
      if (key === "del") {
        dispatch({ type: "UPDATE", updater: (s) => ({ code: s.code.slice(0, -1) }) });
        return;
      }
      dispatch({ type: "UPDATE", updater: (s) => (s.code.length >= 4 ? {} : { code: s.code + key }) });
    },
    [dispatch]
  );

  const runVerify = useCallback(
    (code: string) => {
      dispatch({ type: "SET", patch: { checking: true } });
      if (verifyTimer.current) clearTimeout(verifyTimer.current);
      verifyTimer.current = whenRequestSettles(() => {
        const result = verifyCode(code);
        dispatch({ type: "SET", patch: { checking: false, result } });
        if (result.type === "unknown") note(`Code ${code} rejected — no such pass`);
        else if (result.type === "expired") note(`Code ${code} rejected — expired`);
        else note(`Code ${code} verified — ${result.pass?.name}`);
      });
    },
    [dispatch, note]
  );

  const submitCode = useCallback(
    (code: string) => {
      if (code.length < 4) {
        toast("Four digits are needed.", "warn");
        return;
      }
      runVerify(code);
    },
    [runVerify, toast]
  );

  const tapExpectedPass = useCallback(
    (code: string, name: string) => {
      dispatch({ type: "SET", patch: { code } });
      note(`Tapped ${name} from the expected list`);
      runVerify(code);
    },
    [dispatch, note, runVerify]
  );

  const closeResult = useCallback(() => {
    dispatch({ type: "SET", patch: { result: null, code: "" } });
  }, [dispatch]);

  const callResident = useCallback(() => {
    dispatch({ type: "SET", patch: { result: null, code: "" } });
    // The handset can't place the call (masked calling is C9); this says what to do, not what happened.
    toast("Ring the flat on the intercom before letting anyone in.", "warn");
    note("Called the flat instead of allowing entry");
  }, [dispatch, note, toast]);

  const allowIn = useCallback(
    (state: AppGateState) => {
      const pass = state.result?.pass;
      if (!pass) return;
      const entry: EntryLogRow = {
        id: uid("e"),
        method: "code",
        visitorName: pass.name,
        unit: pass.unit,
        purpose: pass.purpose,
        status: "inside",
        enteredAt: new Date().toISOString(),
        note: `code ${pass.code}`,
      };
      dispatch({ type: "UPDATE", updater: (s) => ({ entries: [entry].concat(s.entries), result: null, code: "" }) });
      toast(`${pass.name} allowed in and logged. ${pass.unit} isn't notified from the gate yet.`, "ok");
      note(`Allowed ${pass.name} in to ${pass.unit}`);
      go("log");
    },
    [dispatch, go, note, toast]
  );

  const denyIn = useCallback(
    (state: AppGateState) => {
      const pass = state.result?.pass;
      if (!pass) return;
      const entry: EntryLogRow = {
        id: uid("e"),
        method: "code",
        visitorName: pass.name,
        unit: pass.unit,
        purpose: pass.purpose,
        status: "turned_away",
        enteredAt: new Date().toISOString(),
        note: "guard turned away",
      };
      dispatch({ type: "UPDATE", updater: (s) => ({ entries: [entry].concat(s.entries), result: null, code: "" }) });
      toast(`${pass.name} turned away. Logged with a reason.`, "warn");
      note(`Turned ${pass.name} away`);
      go("log");
    },
    [dispatch, go, note, toast]
  );

  // ---- Log ------------------------------------------------------------
  const setLogFilter = useCallback(
    (filter: AppGateState["logFilter"]) => {
      dispatch({ type: "SET", patch: { logFilter: filter } });
      note(`Filtered the log by ${filter === "turned_away" ? "turned away" : filter}`);
    },
    [dispatch, note]
  );

  const markExit = useCallback(
    (entry: EntryLogRow) => {
      dispatch({
        type: "UPDATE",
        updater: (s) => ({
          entries: s.entries.map((x) => (x.id === entry.id ? { ...x, status: "exited", exitedAt: new Date().toISOString() } : x)),
        }),
      });
      toast(`${entry.visitorName} marked out.`, "ok");
      note(`Marked exit for ${entry.visitorName}`);
    },
    [dispatch, note, toast]
  );

  // ---- Staff ------------------------------------------------------------
  const setStaffFilter = useCallback(
    (filter: AppGateState["staffFilter"]) => {
      dispatch({ type: "SET", patch: { staffFilter: filter } });
      note(`Filtered staff by ${filter}`);
    },
    [dispatch, note]
  );

  const toggleStaff = useCallback(
    (member: StaffMember, currentlyInside: boolean) => {
      const going = !currentlyInside;
      dispatch({
        type: "UPDATE",
        updater: (s) => ({
          staffInside: { ...s.staffInside, [member.passNo]: going },
          staffSince: { ...s.staffSince, [member.passNo]: going ? `In ${stamp()}` : `Left ${stamp()}` },
        }),
      });
      toast(`${member.name}${going ? " marked in." : " marked out."}`, "ok");
      note(`${member.name} ${going ? "came in" : "went out"}`);
    },
    [dispatch, note, toast]
  );

  // ---- Walk-in ------------------------------------------------------------
  const startWalkin = useCallback(() => {
    dispatch({ type: "SET", patch: { walkinStage: "form" } });
    go("walkin", "Started a walk-in");
  }, [dispatch, go]);

  const setWalkinName = useCallback(
    (name: string) => dispatch({ type: "UPDATE", updater: (s) => ({ walkin: { ...s.walkin, name } }) }),
    [dispatch]
  );
  const setWalkinUnit = useCallback(
    (unit: string) => dispatch({ type: "UPDATE", updater: (s) => ({ walkin: { ...s.walkin, unit: unit.toUpperCase() } }) }),
    [dispatch]
  );
  const setWalkinPurpose = useCallback(
    (purpose: string) => dispatch({ type: "UPDATE", updater: (s) => ({ walkin: { ...s.walkin, purpose } }) }),
    [dispatch]
  );

  /**
   * Moves the walk-in to "waiting for the flat's answer". Nothing is sent: the
   * gate can't reach a resident yet (C9's push with Allow / Deny), so the guard
   * rings the flat and records the answer — no timer ever admits anyone.
   */
  const askResident = useCallback(
    (name: string, unit: string) => {
      if (!name.trim() || !unit.trim()) {
        toast("A name and a flat are needed.", "warn");
        return;
      }
      dispatch({ type: "SET", patch: { walkinStage: "waiting" } });
      note(`Asked ${unit} about ${name.trim()}`);
    },
    [dispatch, note, toast]
  );

  const cancelWalkin = useCallback(() => {
    dispatch({ type: "SET", patch: { walkinStage: "form" } });
    toast("Request cancelled.", "warn");
    note("Cancelled the walk-in request");
  }, [dispatch, note, toast]);

  /** The guard's record of what the flat said on the phone or intercom: allowed in, or turned away. */
  const answerWalkin = useCallback(
    (walkin: AppGateState["walkin"], approved: boolean) => {
      const entry: EntryLogRow = {
        id: uid("e"),
        method: "walk_in",
        visitorName: walkin.name.trim(),
        unit: walkin.unit,
        purpose: walkin.purpose,
        status: approved ? "inside" : "turned_away",
        enteredAt: new Date().toISOString(),
        note: approved ? "walk-in, flat approved by phone" : "walk-in, flat refused by phone",
      };
      dispatch({
        type: "UPDATE",
        updater: (s) => ({ entries: [entry].concat(s.entries), walkin: { name: "", unit: "", purpose: "Guest" }, walkinStage: "form" }),
      });
      if (approved) {
        toast(`${entry.visitorName} allowed in.`, "ok");
        note(`${walkin.unit} approved walk-in ${entry.visitorName} by phone`);
      } else {
        toast(`${entry.visitorName} turned away. ${walkin.unit} said no.`, "warn");
        note(`${walkin.unit} refused walk-in ${entry.visitorName} by phone`);
      }
      go("log");
    },
    [dispatch, go, note, toast]
  );

  // ---- Parcels ------------------------------------------------------------
  const openLogParcel = useCallback(() => {
    dispatch({ type: "SET", patch: { parcelOpen: true, parcelError: false } });
    note("Started logging a parcel");
  }, [dispatch, note]);

  const closeParcel = useCallback(() => {
    dispatch({ type: "SET", patch: { parcelOpen: false } });
  }, [dispatch]);

  const setParcelUnit = useCallback(
    (unit: string) => dispatch({ type: "SET", patch: { parcelUnit: unit.toUpperCase(), parcelError: false } }),
    [dispatch]
  );
  const setCourier = useCallback((courier: string) => dispatch({ type: "SET", patch: { courier } }), [dispatch]);

  const saveParcel = useCallback(
    (unit: string, courier: string) => {
      if (!unit.trim()) {
        dispatch({ type: "SET", patch: { parcelError: true } });
        note("Blocked a parcel with no flat number");
        return;
      }
      const p: Parcel = { id: uid("q"), unit: unit.trim().toUpperCase(), courier, status: "held", loggedAt: new Date().toISOString() };
      dispatch({ type: "UPDATE", updater: (s) => ({ parcels: [p].concat(s.parcels), parcelOpen: false, parcelUnit: "" }) });
      toast(`Parcel for ${p.unit} logged. The resident isn't notified from the gate yet.`, "ok");
      note(`Logged a ${courier} parcel for ${p.unit}`);
    },
    [dispatch, note, toast]
  );

  const collectParcel = useCallback(
    (parcel: Parcel) => {
      dispatch({
        type: "UPDATE",
        updater: (s) => ({
          parcels: s.parcels.map((x) => (x.id === parcel.id ? { ...x, status: "delivered", handedAt: new Date().toISOString() } : x)),
        }),
      });
      toast(`Parcel for ${parcel.unit} handed over.`, "ok");
      note(`Handed the ${parcel.unit} parcel to the resident`);
    },
    [dispatch, note, toast]
  );

  // ---- Alerts ------------------------------------------------------------
  const setAlertKind = useCallback((kind: AlertKind) => dispatch({ type: "SET", patch: { alertKind: kind } }), [dispatch]);

  const holdStart = useCallback(
    (kind: AlertKind) => {
      if (holdTimer.current) clearInterval(holdTimer.current);
      holdStartedAt.current = Date.now();
      dispatch({ type: "SET", patch: { holding: true, holdPct: 0 } });
      holdTimer.current = setInterval(() => {
        // Elapsed wall-clock time drives the fill, not a per-tick increment — a
        // throttled background frame must not silently stall the confirm.
        const pct = Math.min(100, Math.round(((Date.now() - holdStartedAt.current) / motionDurationsMs.holdToConfirm) * 100));
        if (pct >= 100) {
          if (holdTimer.current) clearInterval(holdTimer.current);
          dispatch({
            type: "UPDATE",
            updater: (s) => {
              // Nothing leaves the handset (SOS is C9), so the record says so rather than implying help is coming.
              const raised: GateAlert = { id: uid("a"), kind, raisedAt: new Date().toISOString(), note: "Recorded on this handset only. Nobody was notified." };
              return { holding: false, holdPct: 0, alerts: [raised].concat(s.alerts) };
            },
          });
          toast(`${kind} alert recorded on this handset only. Phone the society office now.`, "bad", { urgent: true });
          note(`Raised a ${kind.toLowerCase()} alert`);
          return;
        }
        dispatch({ type: "SET", patch: { holdPct: pct } });
      }, 60);
    },
    [dispatch, note, toast]
  );

  const holdEnd = useCallback(() => {
    if (holdTimer.current) clearInterval(holdTimer.current);
    dispatch({ type: "UPDATE", updater: (s) => (s.holding ? { holding: false, holdPct: 0 } : {}) });
  }, [dispatch]);

  // ---- Plate lookup ------------------------------------------------------------
  const setPlateQuery = useCallback((query: string) => dispatch({ type: "SET", patch: { plateQuery: query.toUpperCase() } }), [dispatch]);

  // ---- Handover ------------------------------------------------------------
  const setHandoverNote = useCallback((value: string) => dispatch({ type: "SET", patch: { handoverNote: value } }), [dispatch]);
  const completeHandover = useCallback(
    (state: AppGateState) => {
      dispatch({ type: "SET", patch: { handoverDone: true } });
      toast("Shift handed over on this handset.", "ok");
      note(`Completed the shift handover to ${receivingGuard(state)}`);
    },
    [dispatch, note, toast]
  );

  return useMemo(
    () => ({
      startShift,
      resumeShift,
      lock,
      endShift,
      go,
      goBack,
      openNotice,
      openRoute,
      codeKey,
      submitCode,
      tapExpectedPass,
      closeResult,
      callResident,
      allowIn,
      denyIn,
      setLogFilter,
      markExit,
      setStaffFilter,
      toggleStaff,
      startWalkin,
      setWalkinName,
      setWalkinUnit,
      setWalkinPurpose,
      askResident,
      cancelWalkin,
      answerWalkin,
      openLogParcel,
      closeParcel,
      setParcelUnit,
      setCourier,
      saveParcel,
      collectParcel,
      setAlertKind,
      holdStart,
      holdEnd,
      setPlateQuery,
      setHandoverNote,
      completeHandover,
      toast,
      dismissToast,
      note,
      clearAllTimers,
      unitDeliveryPref: (unit: string) => UNIT_DELIVERY_PREFS[unit.trim().toUpperCase()],
    }),
    [
      startShift,
      resumeShift,
      lock,
      endShift,
      go,
      goBack,
      openNotice,
      openRoute,
      codeKey,
      submitCode,
      tapExpectedPass,
      closeResult,
      callResident,
      allowIn,
      denyIn,
      setLogFilter,
      markExit,
      setStaffFilter,
      toggleStaff,
      startWalkin,
      setWalkinName,
      setWalkinUnit,
      setWalkinPurpose,
      askResident,
      cancelWalkin,
      answerWalkin,
      openLogParcel,
      closeParcel,
      setParcelUnit,
      setCourier,
      saveParcel,
      collectParcel,
      setAlertKind,
      holdStart,
      holdEnd,
      setPlateQuery,
      setHandoverNote,
      completeHandover,
      toast,
      dismissToast,
      note,
      clearAllTimers,
    ]
  );
}

export type GateActions = ReturnType<typeof useGateActions>;
