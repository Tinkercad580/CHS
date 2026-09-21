/** Staff & help attendance seed — one row per person, one cell per day of
 * the month (README, "A 30-column attendance sheet"). */
export interface StaffPerson {
  id: string;
  name: string;
  role: string;
  pass: string;
  flats: string;
  phone: string;
  verified: string;
  salary: number;
  /** 1 = present, 0 = absent, 2 = weekly off */
  days: number[];
}

export const MDAYS = 30;

export const STAFF_ROLES = ["Housekeeping", "Cook", "Driver", "Nanny", "Gardener", "Security"];

export const STAFF_SEED: StaffPerson[] = [
  { id: "s1", name: "Lakshmi Bai", role: "Housekeeping", pass: "ST-0441", flats: "A-1204, A-903, B-702", phone: "+91 98220 41156", verified: "12 Apr 2025", salary: 5200, days: [1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1] },
  { id: "s2", name: "Ganesh Pawar", role: "Driver", pass: "ST-0288", flats: "A-1204", phone: "+91 99870 33421", verified: "03 Jan 2026", salary: 14000, days: [1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1] },
  { id: "s3", name: "Savita More", role: "Cook", pass: "ST-0517", flats: "C-405, C-108", phone: "+91 98765 11204", verified: "27 Aug 2025", salary: 8500, days: [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 0, 1, 1] },
  { id: "s4", name: "Imran Shaikh", role: "Gardener", pass: "ST-0102", flats: "Common areas", phone: "+91 90280 77341", verified: "19 Feb 2024", salary: 11000, days: [1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1] },
  { id: "s5", name: "Rekha Jadhav", role: "Nanny", pass: "ST-0630", flats: "B-1102", phone: "+91 97640 22185", verified: "08 Jul 2026", salary: 9000, days: [1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1] },
];
