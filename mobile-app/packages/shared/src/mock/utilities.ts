import type { UtilityStatus } from "../types/common";

export const utilities: UtilityStatus[] = [
  { id: "u_water", name: "Water supply", state: "down", cause: "Main pump replacement in B and C wings. Tankers at the podium.", updatedAt: "Updated 25 min ago" },
  { id: "u_liftb", name: "Lift B", state: "down", cause: "Grinding noise reported. OTIS technician arriving before 6pm.", updatedAt: "Updated 2 hours ago" },
  { id: "u_lifta", name: "Lift A", state: "normal", cause: "Serving all floors normally.", updatedAt: "Checked 10 min ago" },
  { id: "u_power", name: "Mains power", state: "normal", cause: "No load shedding scheduled today.", updatedAt: "Live" },
  { id: "u_gen", name: "Generator", state: "degraded", cause: "Diesel at 62%. Covers lifts, pumps and common lights only.", updatedAt: "Updated 1 hour ago" },
];
