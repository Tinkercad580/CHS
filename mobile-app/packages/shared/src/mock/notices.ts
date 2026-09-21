import type { Notice } from "../types/common";

/** Society-wide notices — same four the prototype seeds, unread/acked as the prototype's initial state does. */
export const notices: Notice[] = [
  {
    id: "n1",
    tag: "urgent",
    title: "Water supply off Thursday, 10am to 4pm",
    blurb: "Main pump replacement. Store water on Wednesday night.",
    postedAt: "2 hours ago",
    unread: true,
    acked: false,
    ackable: true,
    body:
      "The main pump feeding B and C wings is being replaced on Thursday. Supply will be off from 10am and should return by 4pm, though the contractor has asked for an hour's margin.\n\n" +
      "Store what you need on Wednesday night. Tankers will stand by at the podium for anyone who runs short, and the gate has been told to let them in without a pass.\n\n" +
      "If supply has not returned by 5pm, raise a ticket rather than calling the office — it reaches the on-duty supervisor directly.",
  },
  {
    id: "n2",
    tag: "agm",
    title: "Annual general meeting on 28 September",
    blurb: "Agenda, audited accounts and the proxy form are attached.",
    postedAt: "Yesterday",
    unread: true,
    acked: false,
    ackable: true,
    body:
      "The AGM will be held in the clubhouse at 10am on Sunday, 28 September. Audited accounts for 2025-26 and the proposed budget are attached to this notice.\n\n" +
      "Two items need a vote: the lift modernisation contract and the revised parking allotment rules. Owners unable to attend may file a proxy up to 24 hours before.\n\n" +
      "Tenants are welcome to attend and speak, though the vote rests with owners.",
  },
  {
    id: "n3",
    tag: "facility",
    title: "Clubhouse closed for flooring work",
    blurb: "Reopens 20 September. Existing bookings have been refunded.",
    postedAt: "3 days ago",
    unread: false,
    acked: false,
    ackable: false,
    body:
      "The clubhouse hall is closed while the flooring is redone. Bookings between 8 and 19 September have been cancelled and refunded in full — the credit shows against your next maintenance bill.\n\n" +
      "The gym and reading room stay open through the work.",
  },
  {
    id: "n4",
    tag: "billing",
    title: "September bills are out",
    blurb: "Maintenance and parking are both payable by 17 September.",
    postedAt: "11 days ago",
    unread: false,
    acked: false,
    ackable: false,
    body:
      "September maintenance and the Q3 parking charge are now on your dues screen. Both are payable by 17 September; after that a 1.5% monthly interest applies as per the bye-laws.\n\n" +
      "Every bill shows its full working. If a line looks wrong, raise a ticket under Billing and accounts will reply with the calculation.",
  },
];
