import type { Ticket } from "../types/common";
import { FOCUS_UNIT_OWNER } from "./society";

/** Per-unit ticket ids, per DESIGN_NOTES/README's "per-unit content is keyed to the unit" convention. */
export const tickets: Ticket[] = [
  {
    id: "TKT-2291",
    unit: FOCUS_UNIT_OWNER,
    title: "Lift B making a grinding noise",
    description: "Grinding noise between floors 6 and 9.",
    category: "Lift",
    priority: "normal",
    status: "in_progress",
    createdAt: "Today, 9:12am",
    lastUpdate: "Technician assigned, arriving before 6pm.",
    timeline: [
      { at: "Today, 10:04am", note: "Assigned to technician — Ashok from OTIS, ETA before 6pm." },
      { at: "Today, 9:31am", note: "Acknowledged by facility desk — Lift B taken out of service as a precaution." },
      { at: "Today, 9:12am", note: "Raised by you — grinding noise between floors 6 and 9." },
    ],
  },
  {
    id: "TKT-2274",
    unit: FOCUS_UNIT_OWNER,
    title: "Corridor light out, 12th floor",
    description: "Light outside 1204 has been dead since Friday.",
    category: "Electrical",
    priority: "normal",
    status: "resolved",
    createdAt: "7 Sep, 8:02pm",
    lastUpdate: "Tube replaced and tested.",
    timeline: [
      { at: "8 Sep, 11:40am", note: "Resolved — tube replaced and tested by the house electrician." },
      { at: "7 Sep, 8:02pm", note: "Raised by you — light outside 1204 has been dead since Friday." },
    ],
  },
];

/** How many other flats have reported a ticket in each category today — drives the new-ticket duplicate-awareness banner. */
export const ticketDuplicateCounts: Record<string, number> = {
  Lift: 4,
  Plumbing: 2,
  Electrical: 1,
  Security: 0,
  Housekeeping: 0,
  Other: 0,
};
