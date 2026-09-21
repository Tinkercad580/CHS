/** Compliance calendar seed (README section 2, "compliance" nav item; see
 * also MASTER_SPEC.md Part B, "Compliance calendar seed"). */
export interface ComplianceItem {
  item: string;
  rule: string;
  due: string;
  state: string;
  stateFg: string;
  dot: string;
  action: string;
}

export const COMPLIANCE_ITEMS: ComplianceItem[] = [
  { item: "Annual General Meeting", rule: "MCS Act · within statutory date", due: "28 Sep 2026", state: "Notice due in 3 days", stateFg: "var(--warn,#B45309)", dot: "var(--warn,#B45309)", action: "Draft notice" },
  { item: "Statutory audit & report filing", rule: "MCS Act Sec. 81", due: "30 Sep 2026", state: "Auditor appointed", stateFg: "var(--ok-ink,#14663A)", dot: "var(--ok,#167A3C)", action: "Open" },
  { item: "Annual returns to the Registrar", rule: "MCS Act Sec. 79", due: "31 Oct 2026", state: "Not started", stateFg: "var(--ink-soft,#5A6B66)", dot: "#CCD6D2", action: "Start" },
  { item: "Lift licence renewal — Wing A", rule: "Maharashtra Lifts Act", due: "18 Oct 2026", state: "Application drafted", stateFg: "var(--warn,#B45309)", dot: "var(--warn,#B45309)", action: "Upload" },
  { item: "Fire safety audit — Form B", rule: "Fire Prevention Act 2006", due: "02 Dec 2026", state: "Evidence filed", stateFg: "var(--ok-ink,#14663A)", dot: "var(--ok,#167A3C)", action: "View" },
  { item: "Structural audit", rule: "By building age · 22 years", due: "31 Mar 2027", state: "Scheduled", stateFg: "var(--ok-ink,#14663A)", dot: "var(--ok,#167A3C)", action: "View" },
  { item: "Water tank cleaning", rule: "Municipal norm · quarterly", due: "30 Sep 2026", state: "Vendor visit missed", stateFg: "var(--bad-ink,#9B2B22)", dot: "var(--bad,#C0342B)", action: "Reschedule" },
  { item: "GST return — GSTR-3B", rule: "CBIC · monthly", due: "20 Sep 2026", state: "Data ready", stateFg: "var(--ok-ink,#14663A)", dot: "var(--ok,#167A3C)", action: "File" },
];
