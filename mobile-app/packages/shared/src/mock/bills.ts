import type { Bill } from "../types/common";
import { FOCUS_UNIT_OWNER, FOCUS_UNIT_TENANT, FOCUS_UNIT_LET_OUT } from "./society";

/**
 * Seed bills for the three focus units. Category mix follows README's "Roles and
 * data scoping" table directly, so no separate role-based filter is needed on top
 * of "which unit is the active ledger" — the owner's own unit (A-1204) carries
 * facility charges, the tenant's rented unit (B-0702) never does, and the let-out
 * unit (C-0405) carries maintenance only.
 */
export const bills: Bill[] = [
  {
    id: "b1",
    unit: FOCUS_UNIT_OWNER,
    title: "Maintenance — September",
    period: "1 Sep – 30 Sep 2026",
    category: "maintenance",
    status: "unpaid",
    amount: 4850,
    dueDate: "2026-09-17",
    lineItems: [
      { label: "Base maintenance", basis: "1,180 sq ft × ₹3.20", amount: 3776 },
      { label: "Water charges", basis: "Flat, per unit", amount: 420 },
      { label: "Sinking fund", basis: "Statutory, 0.25%", amount: 354 },
      { label: "Common electricity", basis: "Shared by 248 units", amount: 300 },
    ],
  },
  {
    id: "b2",
    unit: FOCUS_UNIT_OWNER,
    title: "Parking — Q3",
    period: "1 Jul – 30 Sep 2026",
    category: "parking",
    status: "unpaid",
    amount: 1200,
    dueDate: "2026-09-17",
    lineItems: [
      { label: "Covered slot B-42", basis: "Quarterly", amount: 900 },
      { label: "Second vehicle", basis: "Two-wheeler", amount: 300 },
    ],
  },
  {
    id: "b3",
    unit: FOCUS_UNIT_OWNER,
    title: "Maintenance — August",
    period: "1 Aug – 31 Aug 2026",
    category: "maintenance",
    status: "paid",
    amount: 4850,
    dueDate: "2026-08-17",
    paidOn: "2026-08-04",
    receiptNo: "RCP-2026-08-1204",
    paymentMethod: "UPI",
    lineItems: [
      { label: "Base maintenance", basis: "1,180 sq ft × ₹3.20", amount: 3776 },
      { label: "Water charges", basis: "Flat, per unit", amount: 420 },
      { label: "Sinking fund", basis: "Statutory, 0.25%", amount: 354 },
      { label: "Common electricity", basis: "Shared by 248 units", amount: 300 },
    ],
  },
  {
    id: "b4",
    unit: FOCUS_UNIT_OWNER,
    title: "Clubhouse booking",
    period: "12 Aug 2026",
    category: "facility",
    status: "paid",
    amount: 2500,
    dueDate: "2026-08-12",
    paidOn: "2026-08-10",
    receiptNo: "RCP-2026-08-0977",
    paymentMethod: "UPI",
    lineItems: [
      { label: "Hall, 4 hours", basis: "Member rate", amount: 2000 },
      { label: "Refundable deposit", basis: "Returned after inspection", amount: 500 },
    ],
  },
  {
    id: "b5",
    unit: FOCUS_UNIT_TENANT,
    title: "Maintenance — September",
    period: "1 Sep – 30 Sep 2026",
    category: "maintenance",
    status: "unpaid",
    amount: 3120,
    dueDate: "2026-09-17",
    lineItems: [
      { label: "Base maintenance", basis: "850 sq ft × ₹3.20", amount: 2720 },
      { label: "Water charges", basis: "Flat, per unit", amount: 400 },
    ],
  },
  {
    id: "b6",
    unit: FOCUS_UNIT_TENANT,
    title: "Parking — Q3",
    period: "1 Jul – 30 Sep 2026",
    category: "parking",
    status: "paid",
    amount: 900,
    dueDate: "2026-07-17",
    paidOn: "2026-07-10",
    receiptNo: "RCP-2026-07-0702",
    paymentMethod: "UPI",
    lineItems: [{ label: "Covered slot B-19", basis: "Quarterly", amount: 900 }],
  },
  {
    id: "b7",
    unit: FOCUS_UNIT_LET_OUT,
    title: "Maintenance — September",
    period: "1 Sep – 30 Sep 2026",
    category: "maintenance",
    status: "unpaid",
    amount: 3776,
    dueDate: "2026-09-17",
    lineItems: [{ label: "Base maintenance", basis: "1,180 sq ft × ₹3.20", amount: 3776 }],
  },
];
