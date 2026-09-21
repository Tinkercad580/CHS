import type { Poll } from "../types/common";

export const polls: Poll[] = [
  {
    id: "pl1",
    title: "Lift modernisation contract",
    description:
      "Two bids were received for replacing the lift controllers in A and B wings. The committee recommends the lower bid from OTIS at ₹18.4 lakh, payable from the sinking fund.",
    totalUnits: 248,
    options: [
      { key: "for", label: "Approve the OTIS bid", votes: 96 },
      { key: "against", label: "Reject and re-tender", votes: 41 },
      { key: "abstain", label: "Abstain", votes: 11 },
    ],
  },
  {
    id: "pl2",
    title: "Revised parking allotment rules",
    description:
      "The proposal moves second-vehicle slots from first-come to a yearly lottery, and raises the second-vehicle charge from ₹300 to ₹450 a quarter.",
    totalUnits: 248,
    options: [
      { key: "for", label: "Adopt the lottery", votes: 74 },
      { key: "against", label: "Keep first-come", votes: 52 },
      { key: "abstain", label: "Abstain", votes: 5 },
    ],
  },
];
