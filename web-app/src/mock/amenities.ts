/** Amenities & booking calendar seed (README: "A booking calendar, three
 * slots × five days, each cell either free or showing the amenity, flat and
 * state"). */
export interface Amenity {
  id: string;
  name: string;
  capacity: string;
  rate: number;
  unit: string;
  deposit: number;
  open: string;
  status: "Open" | "Closed";
}

export interface Booking {
  id: string;
  day: number;
  slot: number;
  amenity: string;
  unit: string;
  who: string;
  state: "Confirmed" | "Pending";
  amount: number;
}

export const AMENITIES_SEED: Amenity[] = [
  { id: "am1", name: "Clubhouse hall", capacity: "80 seated", rate: 2000, unit: "4 hours", deposit: 500, open: "9:00am – 10:00pm", status: "Open" },
  { id: "am2", name: "Gym", capacity: "12 at a time", rate: 0, unit: "free for residents", deposit: 0, open: "6:00am – 10:00pm", status: "Open" },
  { id: "am3", name: "Terrace garden", capacity: "40 standing", rate: 1200, unit: "evening", deposit: 500, open: "4:00pm – 10:00pm", status: "Open" },
  { id: "am4", name: "Badminton court", capacity: "4 players", rate: 150, unit: "hour", deposit: 0, open: "6:00am – 9:00pm", status: "Open" },
  { id: "am5", name: "Swimming pool", capacity: "20 at a time", rate: 0, unit: "free for residents", deposit: 0, open: "Closed for repair", status: "Closed" },
];

export const BOOKINGS_SEED: Booking[] = [
  { id: "bk1", day: 19, slot: 2, amenity: "Badminton court", unit: "A-1204", who: "Anita Deshpande", state: "Confirmed", amount: 150 },
  { id: "bk2", day: 20, slot: 1, amenity: "Clubhouse hall", unit: "B-702", who: "Vikram Sethi", state: "Confirmed", amount: 2000 },
  { id: "bk3", day: 20, slot: 2, amenity: "Terrace garden", unit: "C-405", who: "Prakash Rao", state: "Pending", amount: 1200 },
  { id: "bk4", day: 21, slot: 0, amenity: "Clubhouse hall", unit: "A-903", who: "Vikas Kale", state: "Confirmed", amount: 2000 },
  { id: "bk5", day: 22, slot: 1, amenity: "Badminton court", unit: "B-1102", who: "Sneha Iyer", state: "Pending", amount: 150 },
];

export const CAL_DAYS = [
  { n: 19, l: "Fri" },
  { n: 20, l: "Sat" },
  { n: 21, l: "Sun" },
  { n: 22, l: "Mon" },
  { n: 23, l: "Tue" },
];
export const CAL_SLOTS = ["9am – 1pm", "2pm – 6pm", "6pm – 10pm"];
