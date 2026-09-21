import { useRef, useCallback, useMemo } from "react";
import {
  guards,
  motionDurationsMs,
  MAX_TOASTS,
  type GateScreen,
  type EntryLogRow,
  type Parcel,
  type StaffMember,
  type AlertKind,
  type GateAlert,
} from "@sahaj/shared";
import type { AppGateState, GateAction } from "./types";
import { verifyCode } from "./verify";
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
export function useGateActions(dispatch: Dispatch) {
  const toastTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const verifyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const walkinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const toast = useCallback(
    (message: string, kind: "ok" | "warn" | "bad" = "ok") => {
      const id = uid("t");
      dispatch({
        type: "UPDATE",
        updater: (s) => ({ toasts: s.toasts.concat([{ id, message, kind }]).slice(-MAX_TOASTS) }),
      });
      toastTimers.current[id] = setTimeout(() => {
        delete toastTimers.current[id];
        dispatch({ type: "UPDATE", updater: (s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }) });
      }, motionDurationsMs.toastDismiss);
    },
    [dispatch]
  );

  const clearAllTimers = useCallback(() => {
    Object.values(toastTimers.current).forEach(clearTimeout);
    toastTimers.current = {};
    if (verifyTimer.current) clearTimeout(verifyTimer.current);
    if (walkinTimer.current) clearTimeout(walkinTimer.current);
    if (holdTimer.current) clearInterval(holdTimer.current);
  }, []);

  // ---- Sign-in ----------------------------------------------------------
  const pinKey = useCallback(
    (key: string) => {
      if (key === "clear") {
        dispatch({ type: "SET", patch: { pin: "", pinError: null } });
        return;
      }
      if (key === "del") {
        dispatch({ type: "UPDATE", updater: (s) => ({ pin: s.pin.slice(0, -1), pinError: null }) });
        return;
      }
      dispatch({ type: "UPDATE", updater: (s) => (s.pin.length >= 4 ? {} : { pin: s.pin + key, pinError: null }) });
    },
    [dispatch]
  );

  const startShift = useCallback(
    (currentPin: string) => {
      if (currentPin.length < 4) {
        toast("Four digits are needed.", "warn");
        return;
      }
      const guard = guards.find((g) => g.dutyPin === currentPin);
      if (!guard) {
        dispatch({ type: "SET", patch: { pinError: "That PIN is not on today's roster.", pin: "" } });
        note("Rejected a wrong duty PIN");
        return;
      }
      dispatch({ type: "SET", patch: { onDuty: true, guardName: guard.name, pinError: null, screen: "entry" } });
      toast(`Signed in. Shift started at ${stamp()}.`, "ok");
      note(`${guard.name} signed in for shift`);
    },
    [dispatch, note, toast]
  );

  const signOut = useCallback(() => {
    clearAllTimers();
    dispatch({
      type: "SET",
      patch: {
        onDuty: false,
        guardName: null,
        pin: "",
        pinError: null,
        screen: "entry",
        code: "",
        checking: false,
        result: null,
        parcelOpen: false,
        parcelError: false,
        walkinStage: "form",
        holding: false,
        holdPct: 0,
      },
    });
    toast("Signed out. Handset locked.", "warn");
    note("Ended the shift");
  }, [clearAllTimers, dispatch, note, toast]);

  // ---- Navigation ---------------------------------------------------------
  const go = useCallback(
    (screen: GateScreen, noteText?: string) => {
      dispatch({ type: "SET", patch: { screen } });
      if (noteText) note(noteText);
    },
    [dispatch, note]
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
      verifyTimer.current = setTimeout(() => {
        const result = verifyCode(code);
        dispatch({ type: "SET", patch: { checking: false, result } });
        if (result.type === "unknown") note(`Code ${code} rejected — no such pass`);
        else if (result.type === "expired") note(`Code ${code} rejected — expired`);
        else note(`Code ${code} verified — ${result.pass?.name}`);
      }, motionDurationsMs.verify);
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
    toast("Calling the flat over intercom.", "ok");
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
      toast(`${pass.name} allowed in. ${pass.unit} was told.`, "ok");
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

  const askResident = useCallback(
    (name: string, unit: string) => {
      if (!name.trim() || !unit.trim()) {
        toast("A name and a flat are needed.", "warn");
        return;
      }
      dispatch({ type: "SET", patch: { walkinStage: "waiting" } });
      note(`Asked ${unit} about ${name.trim()}`);
      if (walkinTimer.current) clearTimeout(walkinTimer.current);
      walkinTimer.current = setTimeout(() => {
        dispatch({ type: "SET", patch: { walkinStage: "approved" } });
        toast(`${unit} approved the walk-in.`, "ok");
        note(`${unit} approved ${name.trim()}`);
      }, motionDurationsMs.walkinPing);
    },
    [dispatch, note, toast]
  );

  const cancelWalkin = useCallback(() => {
    if (walkinTimer.current) clearTimeout(walkinTimer.current);
    dispatch({ type: "SET", patch: { walkinStage: "form" } });
    toast("Request cancelled.", "warn");
    note("Cancelled the walk-in request");
  }, [dispatch, note, toast]);

  const allowWalkin = useCallback(
    (walkin: AppGateState["walkin"]) => {
      const entry: EntryLogRow = {
        id: uid("e"),
        method: "walk_in",
        visitorName: walkin.name.trim(),
        unit: walkin.unit,
        purpose: walkin.purpose,
        status: "inside",
        enteredAt: new Date().toISOString(),
        note: "walk-in, resident approved",
      };
      dispatch({
        type: "UPDATE",
        updater: (s) => ({ entries: [entry].concat(s.entries), walkin: { name: "", unit: "", purpose: "Guest" }, walkinStage: "form" }),
      });
      toast(`${entry.visitorName} allowed in.`, "ok");
      note(`Allowed walk-in ${entry.visitorName} in to ${walkin.unit}`);
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
      toast(`Resident of ${p.unit} was notified.`, "ok");
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
              const raised: GateAlert = { id: uid("a"), kind, raisedAt: new Date().toISOString(), note: "Sent to the committee and the security desk." };
              return { holding: false, holdPct: 0, alerts: [raised].concat(s.alerts) };
            },
          });
          toast(`${kind} alert raised.`, "bad");
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
  const completeHandover = useCallback(() => {
    const receivingGuard = guards.find((g) => g.name !== guards[0].name)?.name ?? guards[0].name;
    dispatch({ type: "SET", patch: { handoverDone: true } });
    toast("Shift handed over.", "ok");
    note(`Completed the shift handover to ${receivingGuard}`);
  }, [dispatch, note, toast]);

  return useMemo(
    () => ({
      pinKey,
      startShift,
      signOut,
      go,
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
      allowWalkin,
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
      note,
      clearAllTimers,
      unitDeliveryPref: (unit: string) => UNIT_DELIVERY_PREFS[unit.trim().toUpperCase()],
    }),
    [
      pinKey,
      startShift,
      signOut,
      go,
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
      allowWalkin,
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
      note,
      clearAllTimers,
    ]
  );
}

export type GateActions = ReturnType<typeof useGateActions>;
