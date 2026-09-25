import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import type { Row, ToastSpec } from "../lib/types";
import { STAFF_SEED, type StaffPerson } from "../mock/staff";
import { AMENITIES_SEED, BOOKINGS_SEED, type Amenity, type Booking } from "../mock/amenities";
import type { TicketCard } from "../mock/helpdesk";

/**
 * The single cross-page state store, mirroring the prototype's one state
 * object (README, "State management"). Everything a table row or a record
 * page can be changed to at runtime lives here — `added`/`edits` for table
 * rows, `recAdd` for record-page section additions, plus the small bits of
 * bespoke screen state (staff attendance, amenities/bookings, helpdesk
 * tickets, the selected society, toasts). Search/chip/sort/page stay local
 * to each page component, which is what makes them reset on navigation.
 */
export interface AdminState {
  added: Record<string, Row[]>;
  edits: Record<string, Record<number, Row>>;
  /** keyed "pageKey/rowPrimaryKey" -> section heading -> prepended rows */
  recAdd: Record<string, Record<string, string[][]>>;
  staff: StaffPerson[];
  amenities: Amenity[];
  bookings: Booking[];
  newTickets: TicketCard[];
  toasts: ToastSpec[];
  /** The admin membership the console is pointed at; resolved against `me` in api/society.ts. */
  societyId: string | null;
}

type Action =
  | { type: "toast"; text: string; kind?: "ok" | "warn" }
  | { type: "dismissToast"; id: string }
  | { type: "addRow"; page: string; row: Row }
  | { type: "saveEditedAdded"; page: string; idx: number; row: Row }
  | { type: "saveEditedSeed"; page: string; seed: number; row: Row }
  | { type: "patchActive"; page: string; row: Row; upd: Partial<Row> }
  | { type: "pushRecAdd"; key: string; heading: string; row: string[] }
  | { type: "setRecAddSection"; key: string; heading: string; rows: string[][] }
  | { type: "toggleStaffDay"; id: string; dayIdx: number }
  | { type: "addStaff"; person: StaffPerson }
  | { type: "revokeStaff"; id: string }
  | { type: "toggleAmenity"; id: string }
  | { type: "addAmenity"; amenity: Amenity }
  | { type: "addBooking"; booking: Booking }
  | { type: "confirmBooking"; id: string }
  | { type: "removeBooking"; id: string }
  | { type: "addTicket"; card: TicketCard }
  | { type: "switchSociety"; societyId: string };

function isSameRow(a: Row, b: Row): boolean {
  return a.a === b.a && a.b === b.b;
}

function reducer(state: AdminState, action: Action): AdminState {
  switch (action.type) {
    case "toast": {
      const id = Math.random().toString(36).slice(2);
      return { ...state, toasts: state.toasts.concat([{ id, text: action.text, kind: action.kind ?? "ok" }]) };
    }
    case "dismissToast":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    case "addRow":
      return { ...state, added: { ...state.added, [action.page]: [action.row].concat(state.added[action.page] ?? []) } };
    case "saveEditedAdded": {
      const list = (state.added[action.page] ?? []).slice();
      list[action.idx] = { ...action.row, isNew: true };
      return { ...state, added: { ...state.added, [action.page]: list } };
    }
    case "saveEditedSeed": {
      const pageEdits = { ...(state.edits[action.page] ?? {}) };
      pageEdits[action.seed] = { ...action.row, isNew: false, edited: true };
      return { ...state, edits: { ...state.edits, [action.page]: pageEdits } };
    }
    case "patchActive": {
      const list = state.added[action.page] ?? [];
      const isAdded = list.some((x) => isSameRow(x, action.row));
      if (isAdded) {
        return { ...state, added: { ...state.added, [action.page]: list.map((x) => (isSameRow(x, action.row) ? { ...x, ...action.upd } : x)) } };
      }
      const seed = action.row._seed;
      if (seed === undefined) return state;
      const e = { ...(state.edits[action.page] ?? {}) };
      e[seed] = { ...(e[seed] ?? action.row), ...action.upd };
      return { ...state, edits: { ...state.edits, [action.page]: e } };
    }
    case "pushRecAdd": {
      const per = { ...(state.recAdd[action.key] ?? {}) };
      per[action.heading] = [action.row].concat(per[action.heading] ?? []);
      return { ...state, recAdd: { ...state.recAdd, [action.key]: per } };
    }
    case "setRecAddSection": {
      const per = { ...(state.recAdd[action.key] ?? {}) };
      per[action.heading] = action.rows;
      return { ...state, recAdd: { ...state.recAdd, [action.key]: per } };
    }
    case "toggleStaffDay":
      return {
        ...state,
        staff: state.staff.map((p) =>
          p.id === action.id
            ? { ...p, days: p.days.map((d, i) => (i === action.dayIdx ? (d === 1 ? 0 : d === 0 ? 2 : 1) : d)) }
            : p,
        ),
      };
    case "addStaff":
      return { ...state, staff: state.staff.concat([action.person]) };
    case "revokeStaff":
      return { ...state, staff: state.staff.filter((x) => x.id !== action.id) };
    case "toggleAmenity":
      return { ...state, amenities: state.amenities.map((a) => (a.id === action.id ? { ...a, status: a.status === "Open" ? "Closed" : "Open" } : a)) };
    case "addAmenity":
      return { ...state, amenities: state.amenities.concat([action.amenity]) };
    case "addBooking":
      return { ...state, bookings: state.bookings.concat([action.booking]) };
    case "confirmBooking":
      return { ...state, bookings: state.bookings.map((b) => (b.id === action.id ? { ...b, state: "Confirmed" } : b)) };
    case "removeBooking":
      return { ...state, bookings: state.bookings.filter((b) => b.id !== action.id) };
    case "addTicket":
      return { ...state, newTickets: [action.card].concat(state.newTickets) };
    case "switchSociety":
      return { ...state, societyId: action.societyId };
    default:
      return state;
  }
}

function initialState(): AdminState {
  return {
    added: {},
    edits: {},
    recAdd: {},
    staff: STAFF_SEED.map((s) => ({ ...s, days: s.days.slice() })),
    amenities: AMENITIES_SEED.map((a) => ({ ...a })),
    bookings: BOOKINGS_SEED.map((b) => ({ ...b })),
    newTickets: [],
    toasts: [],
    societyId: readStoredSociety(),
  };
}

// The switcher's choice survives a reload. Storage can be blocked (private
// mode, a locked-down browser); then the choice lasts as long as the tab.
const SOCIETY_KEY = "chs.admin.society";

function readStoredSociety(): string | null {
  try {
    return globalThis.localStorage?.getItem(SOCIETY_KEY) ?? null;
  } catch {
    return null;
  }
}

function writeStoredSociety(id: string): void {
  try {
    globalThis.localStorage?.setItem(SOCIETY_KEY, id);
  } catch {
    // See above: in-memory only.
  }
}

interface AdminStoreValue {
  state: AdminState;
  dispatch: (action: Action) => void;
  toast: (text: string, kind?: "ok" | "warn") => void;
}

const AdminStoreContext = createContext<AdminStoreValue | null>(null);

export function AdminStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  useEffect(() => {
    if (state.societyId) writeStoredSociety(state.societyId);
  }, [state.societyId]);

  const toast = useCallback((text: string, kind?: "ok" | "warn") => {
    dispatch({ type: "toast", text, kind });
  }, []);

  const value = useMemo(() => ({ state, dispatch, toast }), [state, toast]);

  return <AdminStoreContext.Provider value={value}>{children}</AdminStoreContext.Provider>;
}

export function useAdminStore(): AdminStoreValue {
  const ctx = useContext(AdminStoreContext);
  if (!ctx) throw new Error("useAdminStore must be used within AdminStoreProvider");
  return ctx;
}
