/** Helpdesk kanban seed. */
export interface TicketCard {
  id: string;
  title: string;
  meta: string;
  sla: string;
  slaBg: string;
  slaFg: string;
}

export interface KanbanColumn {
  title: string;
  count: number;
  cards: TicketCard[];
}

export const KANBAN: KanbanColumn[] = [
  {
    title: "Open",
    count: 8,
    cards: [
      { id: "TKT/1188", title: "Lift stuck between 4 and 5", meta: "Lift · Wing B · 12 min ago", sla: "24m left", slaBg: "var(--warn-wash,#FDF3E7)", slaFg: "var(--warn-ink,#8F4A0A)" },
      { id: "TKT/1187", title: "No water pressure", meta: "Plumbing · C-1508 · 40 min ago", sla: "3h left", slaBg: "var(--border-soft,#F1F4F3)", slaFg: "var(--ink-soft,#3D4A46)" },
      { id: "TKT/1186", title: "Corridor light not working", meta: "Electrical · A 7th floor", sla: "8h left", slaBg: "var(--border-soft,#F1F4F3)", slaFg: "var(--ink-soft,#3D4A46)" },
    ],
  },
  {
    title: "Assigned",
    count: 6,
    cards: [
      { id: "TKT/1182", title: "Seepage in bedroom wall", meta: "Civil · B-0902 · Ganesh M.", sla: "Breached", slaBg: "var(--bad-wash,#FCEDEC)", slaFg: "var(--bad-ink,#9B2B22)" },
      { id: "TKT/1179", title: "Parking slot blocked", meta: "Parking · P1-14 · Ramesh J.", sla: "1h left", slaBg: "var(--warn-wash,#FDF3E7)", slaFg: "var(--warn-ink,#8F4A0A)" },
    ],
  },
  {
    title: "In progress",
    count: 9,
    cards: [
      { id: "TKT/1171", title: "Pump motor noise", meta: "Common · pump room · vendor", sla: "On track", slaBg: "var(--ok-wash,#E8F5EC)", slaFg: "var(--ok-ink,#14663A)" },
      { id: "TKT/1168", title: "Intercom dead — Wing C", meta: "Electrical · awaiting parts", sla: "On hold", slaBg: "var(--info-wash,#EAF0FE)", slaFg: "var(--info-ink,#12327A)" },
    ],
  },
  {
    title: "Resolved",
    count: 5,
    cards: [
      { id: "TKT/1160", title: "Garbage not collected", meta: "Housekeeping · resolved 2 h ago", sla: "Awaiting confirm", slaBg: "var(--border-soft,#F1F4F3)", slaFg: "var(--ink-soft,#3D4A46)" },
      { id: "TKT/1157", title: "Gym AC not cooling", meta: "Amenity · rated 4/5", sla: "Closed", slaBg: "var(--ok-wash,#E8F5EC)", slaFg: "var(--ok-ink,#14663A)" },
    ],
  },
  {
    title: "Billing queries",
    count: 3,
    cards: [
      { id: "TKT/1184", title: "Why non-occupancy on my flat?", meta: "Billing · A-0805 · family occupied", sla: "2h left", slaBg: "var(--warn-wash,#FDF3E7)", slaFg: "var(--warn-ink,#8F4A0A)" },
      { id: "TKT/1181", title: "Lift charge on ground floor", meta: "Billing · B-0002", sla: "Resolved", slaBg: "var(--ok-wash,#E8F5EC)", slaFg: "var(--ok-ink,#14663A)" },
    ],
  },
];

export const TICKET_CATEGORIES = ["Lift", "Plumbing", "Electrical", "Housekeeping", "Security", "Billing"];
export const TICKET_PRIORITIES: { key: string; sla: string }[] = [
  { key: "Emergency", sla: "1 h" },
  { key: "Urgent", sla: "4 h" },
  { key: "Normal", sla: "24 h" },
];
