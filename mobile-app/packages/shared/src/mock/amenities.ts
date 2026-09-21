import type { Amenity, Booking } from "../types/common";
import { FOCUS_UNIT_OWNER } from "./society";

export const amenities: Amenity[] = [
  { id: "clubhouse", name: "Clubhouse hall", capacity: 80, hours: "4 hours", rate: 2000, deposit: 500, open: true },
  { id: "gym", name: "Gym", capacity: 30, hours: "6am – 10pm", rate: 0, deposit: 0, open: true },
  { id: "terrace", name: "Terrace garden", capacity: 40, hours: "1 evening", rate: 1200, deposit: 500, open: true },
  { id: "court", name: "Badminton court", capacity: 4, hours: "1 hour", rate: 150, deposit: 0, open: true },
];

export const bookableDays = ["Sat 20", "Sun 21", "Mon 22", "Tue 23"];
export const bookableSlots = ["9am – 1pm", "2pm – 6pm", "6pm – 10pm"];

/** Seeded so the badminton-court slot on "Sat 20" / "2pm – 6pm" reads as already taken, per the design. */
export const preTakenSlot = { day: "Sat 20", slotIndex: 0 };

export const bookings: Booking[] = [
  { id: "bk0", amenityId: "court", unit: FOCUS_UNIT_OWNER, day: "Fri 19 Sep", slot: 2, status: "confirmed", charge: 150 },
];
