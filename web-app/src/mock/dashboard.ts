/** Dashboard-only seed data (billed vs collected chart, attention list,
 * defaulters, fund balances, gate snapshot, notification drawer). */

export const CHART_MONTHS = [
  { m: "Apr", hBill: 72, hColl: 58 },
  { m: "May", hBill: 76, hColl: 66 },
  { m: "Jun", hBill: 74, hColl: 62 },
  { m: "Jul", hBill: 88, hColl: 71 },
  { m: "Aug", hBill: 84, hColl: 78 },
  { m: "Sep", hBill: 96, hColl: 75 },
];

export interface AttentionItem {
  dot: string;
  title: string;
  meta: string;
  cta: string;
}

export const NEEDS_ATTENTION: AttentionItem[] = [
  { dot: "var(--bad,#C0342B)", title: "3 tickets breached SLA", meta: "Lift · Wing B · oldest 31 hours", cta: "Open" },
  { dot: "var(--warn,#B45309)", title: "Lift AMC expires in 21 days", meta: "Wing B · Otis · no renewal recorded", cta: "Renew" },
  { dot: "var(--warn,#B45309)", title: "AGM must be held by 30 Sep", meta: "14 clear days notice required — send by 15 Sep", cta: "Draft" },
  { dot: "var(--info,#1D4ED8)", title: "₹2,14,000 unmatched bank credits", meta: "6 lines from HDFC statement, 09 Sep", cta: "Match" },
  { dot: "var(--ink-soft,#5A6B66)", title: "4 requests awaiting approval", meta: "2 sale NOC · 1 renovation · 1 tenancy", cta: "Review" },
];

export interface TopDefaulter {
  unit: string;
  name: string;
  meta: string;
  amount: string;
  fg: string;
}

export const TOP_DEFAULTERS: TopDefaulter[] = [
  { unit: "B-0407", name: "Farhan Shaikh", meta: "94 days · final notice sent", amount: "₹43,180", fg: "var(--bad,#C0342B)" },
  { unit: "C-1508", name: "Vikram Nair", meta: "41 days · reminder stage", amount: "₹21,400", fg: "var(--bad,#C0342B)" },
  { unit: "A-0710", name: "Nilesh Gokhale", meta: "38 days · settlement plan", amount: "₹18,900", fg: "var(--warn,#B45309)" },
];

export interface FundBalance {
  name: string;
  amount: string;
  pct: number;
  color: string;
}

export const FUND_BALANCES: FundBalance[] = [
  { name: "Sinking fund", amount: "₹41,20,000", pct: 82, color: "#0E6B5C" },
  { name: "Repair & maintenance", amount: "₹18,60,000", pct: 54, color: "#6FB3A1" },
  { name: "Major repair", amount: "₹6,40,000", pct: 26, color: "var(--accent-200,#C9E4DC)" },
];

export const GATE_TODAY = [
  { value: "63", label: "visitors in" },
  { value: "11", label: "still inside" },
  { value: "28", label: "deliveries" },
  { value: "19/21", label: "staff present" },
];

export interface NotifItem {
  dot: string;
  t: string;
  b: string;
  time: string;
}

export const NOTIFS: NotifItem[] = [
  { dot: "var(--bad,#C0342B)", t: "3 tickets breached SLA", b: "Lift · Wing B · oldest 31 hours", time: "12 minutes ago" },
  { dot: "var(--warn,#B45309)", t: "AGM notice due in 3 days", b: "14 clear days required before 28 Sep", time: "1 hour ago" },
  { dot: "var(--info,#1D4ED8)", t: "6 unmatched bank credits", b: "₹2,14,000 from the HDFC statement", time: "3 hours ago" },
  { dot: "var(--ok,#167A3C)", t: "September bills published", b: "248 bills · 97% delivered", time: "4 days ago" },
  { dot: "var(--ink-soft,#5A6B66)", t: "Sneha Kamat signed in", b: "Accountant · read-write · FY 2026-27", time: "5 days ago" },
  { dot: "var(--warn,#B45309)", t: "Lift AMC expires in 21 days", b: "Otis · Wing B · no renewal recorded", time: "6 days ago" },
];
