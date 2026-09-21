import type { Language } from "../types/resident";
import { num } from "./numerals";

/**
 * The `COPY` UI string pack (README.md "Localisation") — keyed by string id, one
 * object per language. Read through `t()` below, with a `{n}` interpolation slot.
 * Covers tab labels, every screen/sub-screen title, section headings, quick actions,
 * filters, status chips, counts, settings-row labels/values and intro paragraphs.
 */
const en = {
  home: "Home", dues: "Dues", notices: "Notices", visitors: "Visitors", profile: "Profile",
  greeting: "Good morning, {name}", amountDue: "Amount due", payNow: "Pay now", allSettled: "All settled",
  across1: "across 1 bill", acrossN: "across {n} bills", dueOn: "Due 17 Sep", nothingDue: "Nothing due",
  quickActions: "Quick actions", qaPay: "Pay dues", qaInvite: "Invite guest", qaTicket: "Raise ticket", qaAmenities: "Amenities",
  latestNotice: "Latest notice", seeAll: "See all", expectedToday: "Expected today",
  down: "down", allNormal: "All systems normal", thingsDown: "{n} not working right now",
  utilitySub: "Water, lifts, power and generator", agmTitle: "AGM votes are open",
  twoAgmItems: "{n} of 2 AGM items need your vote", ownersVoting: "Owners are voting on two AGM items",
  noOneExpected: "No one expected today", noOneExpectedSub: "Invite a guest and the gate will have their name before they arrive.",
  inviteAGuest: "Invite a guest", twoPositions: "You hold two positions here", switchLedger: "Switch ledger to see the right dues, notices and passes.",
  owned: "owned", rentedOut: "rented out",

  duesTitle: "Dues", statement: "Statement", filterAll: "All", filterUnpaid: "Unpaid", filterPaid: "Paid",
  unpaid: "Unpaid", paid: "Paid", nothingOutstanding: "Nothing outstanding",
  nothingOutstandingSub: "Every bill in this filter is settled. Receipts stay under Paid.",

  totalPayable: "Total payable", whatThisCovers: "What this covers", total: "Total",
  payAmount: "Pay {amount}", receiptNote: "Receipt is issued the moment the bank confirms.",
  settledOn: "Settled on {date}", receiptLabel: "Receipt {n}",

  payUsingQr: "Pay using QR code", payUsingQrSub: "Scan with any UPI app on another device",
  payUsingApp: "Pay using installed app", payUsingAppSub: "Opens a UPI app on this phone",
  cancel: "Cancel", scanToPay: "Scan to pay", waitingBank: "Waiting for the bank to confirm. Keep this open until it does.",
  iHavePaid: "I have paid — check now", cancelPayment: "Cancel payment",
  cancelNothing: "Cancelling here charges nothing. The code dies with the timer.",
  cancelledNothing: "Payment cancelled. Nothing was charged.",
  expiredBadge: "Expired", expiredHint: "This code has expired. Generate a new one to try again.",
  liveQrHint: "Open any UPI app on another phone and scan. The code is valid for ten minutes only.",
  generateNewCode: "Generate a new code", chooseApp: "Choose an app",
  chooseAppSub: "{amount} will be requested by the app you pick.", back: "Back",

  paymentReceived: "Payment received", downloadReceipt: "Download receipt", done: "Done",
  receiptSaved: "Receipt saved to your phone.",

  noticesTitle: "Notices", unreadOf: "{n} unread of {total}", iHaveRead: "I have read this",
  acknowledged: "Acknowledged", ackSent: "Acknowledgement sent to the office.",

  visitorsTitle: "Visitors", invite: "Invite", noPassesYet: "No passes yet",
  noPassesSub: "Create one and the gate can wave your guest through in seconds.",
  passCancelled: "Pass for {name} cancelled.", passRevoked: "{name}'s pass revoked. Attendance record closed.",
  visitorCountLine: "{n} passes · {expected} expected",

  inviteTitle: "Invite a guest", oneTimeGuest: "One-time guest", dailyHelpMode: "Daily help",
  guestName: "Guest name", guestNamePh: "Who is coming?", purpose: "Purpose", validFor: "Valid for",
  createPass: "Create pass", creatingPass: "Creating pass…",
  guestNameError: "A guest needs a name before the gate can verify them.",
  codeReachesBoth: "The code reaches your guest and the gate at the same moment.",
  standingPassIntro: "A standing pass, not a code. Every time the gate marks them in or out, it lands in their attendance for the month.",
  helpName: "Name", helpNamePh: "Who works with you?", helpRole: "Role", daysTheyCome: "Days they come",
  hoursTheyWork: "Hours they work", monthlySalary: "Monthly salary", monthlySalaryPh: "4500",
  registerAndIssue: "Register and issue pass", officeVerifies: "The society office verifies the ID before the pass goes live.",
  perDayHint: "Attendance is counted against this, so the per-day rate is never in dispute.",
  perDayRateLine: "{amount} over about {days} working days is {perDay} a day.",
  helpNameRequired: "A name is needed.", helpSalaryRequired: "Enter the agreed monthly salary.",

  standingPassIssued: "Standing pass issued", passCreatedTitle: "Pass created",
  staffPass: "Staff pass", gateCode: "Gate code", sendPassToThem: "Send the pass to them",
  shareWithGuest: "Share with guest", seeAttendance: "See attendance", backToVisitors: "Back to visitors",
  codeSentWhatsapp: "Code sent to your guest over WhatsApp.",

  helpdeskTitle: "Helpdesk", raise: "Raise", newTicketTitle: "Raise a ticket",
  category: "Category", whatIsWrong: "What is wrong?", whatIsWrongPh: "One or two lines is enough.",
  urgent: "Urgent", urgentSub: "Pages the on-duty supervisor", submitTicket: "Submit ticket", sending: "Sending…",
  markResolved: "Mark as resolved", ticketRequiredError: "Tell us what is wrong so the right person is sent.",
  ticketRaised: "{id} raised. Expect a reply within 4 hours.", ticketResolvedToast: "{id} marked resolved.",
  duplicateLine: "{n} other flat has reported {category} today", duplicateLineN: "{n} other flats have reported {category} today",
  duplicateDetail: "The facility desk already knows. Raising this still helps them judge how widespread it is.",
  openOfTotal: "{open} open · {total} total",

  settings: "Settings", viewAs: "View the app as", personal: "Personal details", myTenants: "My tenants",
  dailyHelpRow: "Daily help", deliveries: "Deliveries", householdRow: "Household members",
  vehiclesRow: "Vehicles", notifRow: "Notifications", languageRow: "Language",
  none: "None", oneActive: "1 active", nPeople: "{n} people", nOf4On: "{n} of 4 on",
  nowViewingAs: "Now viewing as {role}.",

  personalTitle: "Personal details", edit: "Edit", cancelEdit: "Cancel", saveChanges: "Save changes",
  contact: "Contact", residence: "Residence", mobileNumber: "Mobile number", setByOffice: "Set by the office",
  email: "Email", alternatePhone: "Alternate phone", emergencyContact: "Emergency contact",
  flatLabel: "Flat", societyLabel: "Society", heldAs: "Held as", carpetArea: "Carpet area", parkingSlots: "Parking slots",
  slotsAllotted: "{n} allotted", detailsUpdated: "Personal details updated.",
  mobileIsLoginNote: "Your mobile number is your login and can only be changed by the office.",

  householdTitle: "Household members", householdIntro: "Anyone listed here can be verified at the gate without a pass.",
  addAMember: "Add a member", fullName: "Full name", relation: "Relation", addToHousehold: "Add to household",
  memberRemoved: "{name} removed from the household.", memberNeedsName: "A member needs a name.",
  memberAdded: "{name} added. The gate can verify them now.", youChip: "You",

  vehiclesTitle: "Vehicles", vehiclesIntro: "Registered plates open the boom barrier without the guard stepping out.",
  registerVehicle: "Register a vehicle", plateNumber: "MH 12 AB 1234", register: "Register",
  vehicleRemoved: "{plate} removed.", plateTooShort: "Enter the full registration number.",
  vehicleRegistered: "{plate} registered. Slot follows from the office.", slotPending: "Pending",

  notifTitle: "Notifications", notifIntro: "Turn off what you do not need. Urgent notices always come through.",
  markAllRead: "Mark all read",

  languageTitle: "Language", languageIntro: "Notices from the office are shown in your language when a translation exists.",
  languageSet: "Language set to {name}.", languageDefault: "Default across the app",

  deliveriesTitle: "Deliveries", deliveriesIntro: "The gate follows this for every parcel, every time. No call needed.",
  whatGuardSees: "What the guard sees", guardTold: "The gate has been told.",
  guardSeesLine: "{unit} — {pref}. This shows on the parcel screen before the guard logs anything.",

  dailyHelpTitle: "Daily help", dailyHelpIntro: "September, counted from the gate's own record. No registers, no arguments.",
  cameIn: "Came in", absentLabel: "Absent", weeklyOff: "Weekly off", notYetRecorded: "Not yet recorded",
  daysPresent: "Days present", daysAbsent: "Days absent", weeklyOffs: "Weekly offs", agreedSalary: "Agreed salary",
  perDay: "Per day", payableThisMonth: "Payable this month", markSalaryPaid: "Mark salary paid",
  markedPaidThisMonth: "Marked paid this month", salaryMarkedPaid: "{name}'s salary marked paid.",
  alreadyMarkedPaid: "Already marked paid for September.", nobodyRegistered: "Nobody registered yet",
  nobodyRegisteredSub: "Register your maid, cook or driver and the gate's in-and-out becomes their attendance.",
  registerDailyHelp: "Register daily help", forDays: "{present} of {total}",
  salaryForDays: "{amount} for {days} days",

  amenitiesTitle: "Amenities", yourBookings: "Your bookings", bookAnAmenity: "Book an amenity",
  cancelBooking: "Cancel booking", bookingCancelled: "{amenity} booking cancelled. Deposit returns in 3 days.",
  bookTitle: "Book", day: "Day", slot: "Slot", takenLabel: "Taken", freeLabel: "Free", slotTaken: "That slot is already taken.",
  confirmBooking: "Confirm booking", chargeNote: "The charge appears on your next maintenance bill.",
  bookingConfirmed: "{amenity} booked for {day}.", amenitySummary: "{n} booking{s} · 4 amenities open to residents",
  free: "Free", noDeposit: "No deposit", refundable: "₹{amount} refundable",

  statementTitle: "Statement", closingBalance: "Closing balance", accountSettled: "Your account is fully settled.",
  payableByDate: "Payable by 17 September 2026. Nothing is overdue yet.",
  interestTitle: "Interest on late payment",
  interestBody: "Bye-law 68 charges 1.5% a month on anything unpaid after the due date. On {amount} that is about {perMonth} a month.",
  thisYear: "This year", downloadPdf: "Download as PDF", statementSaved: "Statement for 2026-27 saved to your phone.",

  votesTitle: "Votes", twoItemsOpenIntro: "Two items are open before the AGM on 28 September. Your vote is tied to {unit}.",
  tenantsCannotVoteTitle: "Tenants cannot vote",
  tenantsCannotVoteBody: "The vote at a general meeting rests with the owner of the flat. You are welcome to attend and speak — the AGM notice has the time and agenda.",
  castVote: "Cast your vote", liveTally: "Live tally", voteRecordedToast: "Vote recorded for {unit}.",
  alreadyVotedToast: "Your vote is already cast.", votedTag: "Voted", openTag: "Open",
  voteCast: "Vote cast", votedLine: "Recorded against {unit} on 13 Sep 2026.",
  cannotChangeVote: "Your vote is recorded against {unit} and cannot be changed once cast.",

  myTenantsTitle: "My tenants", oneAgreementLive: "You let out {unit}. One agreement is live.",
  notLettingOut: "You are not letting out a flat right now.", agreementFrom: "Agreement from",
  expiresLabel: "Expires", policeVerification: "Police verification", verifiedOn: "Verified {date}",
  nonOccupancyChargeLabel: "Non-occupancy charge", perMonthAmount: "₹{amount} a month",
  startRenewal: "Start renewal", renewalSent: "Renewal request sent", renewalRequestSent: "Renewal started. The office will send the draft.",
  renewalAlready: "A renewal request is already with the office.", activeStatus: "Active", endedStatus: "Ended",
  registeringNewTenant: "Registering a new tenant",
  registeringNewTenantBody: "The society needs the agreement, police verification and a ₹5,000 non-occupancy deposit before the tenant gets app access.",
  noTenanciesTitle: "No tenancies on your name",
  noTenanciesBody: "This screen fills in once you let out a flat you own. Tell the office and they will link the agreement here.",

  buildingStatusTitle: "Building status", buildingStatusIntro: "Water, lifts, power and generator, as the office last recorded them.",

  emergencyTitle: "Emergency",
  emergencyIntro: "Hold for two seconds. The gate, the committee and your emergency contact are told at once, with your flat number.",
  whatIsHappening: "What is happening?", holdToRaise: "Hold to raise {kind}", keepHolding: "Keep holding…",
  secondsToGo: "{n} second to go", twoSecondsUnit: "Two seconds · {unit}",
  reachesImmediately: "Reaches immediately", alertSentToast: "{kind} alert sent. Help is on the way.",
  alertRaisedFrom: "{kind} alert raised from {unit}", gateAcknowledged: "The gate acknowledged in 4 seconds. Two committee members are calling you.",
  mainGate: "Main gate", committee: "Committee", committeeNotified: "6 members notified",
  yourEmergencyContact: "Your emergency contact", nearestHospital: "Nearest hospital", hospitalDistance: "Sahyadri, 2.4 km",

  spouse: "Spouse", child: "Child", parent: "Parent", car: "Car", twoWheeler: "Two-wheeler",
  owner: "Owner", tenant: "Tenant", ownerAndTenant: "Owner and tenant",
  ownerDetail: "You bought and live in {unit}. Full vote at the AGM.",
  tenantDetail: "You rent {unit}. Dues you owe, notices you need, no AGM vote.",
  bothDetail: "You own {unit} and rent out {letOut}. The app keeps the two ledgers apart.",

  morning: "Morning", twiceDaily: "Twice daily", fullDay: "Full day", evening: "Evening",
  housekeeping: "Housekeeping", cook: "Cook", driver: "Driver", nanny: "Nanny", careGiver: "Care giver",
  guest: "Guest", delivery: "Delivery", cab: "Cab", service: "Service",
  twoHours: "2 hours", today: "Today", thisWeek: "This week",
  plumbing: "Plumbing", electrical: "Electrical", lift: "Lift", security: "Security", other: "Other",
  medical: "Medical", fire: "Fire",
};

type CopyKey = keyof typeof en;
type CopyPack = Record<CopyKey, string>;

const mr: Partial<CopyPack> = {
  home: "मुख्यपृष्ठ", dues: "देयके", notices: "सूचना", visitors: "पाहुणे", profile: "प्रोफाइल",
  greeting: "सुप्रभात, {name}", amountDue: "देय रक्कम", payNow: "आता भरा", allSettled: "सर्व भरले",
  across1: "१ देयकासाठी", acrossN: "{n} देयकांसाठी", dueOn: "१७ सप्टेंबरपर्यंत", nothingDue: "काहीही देय नाही",
  quickActions: "झटपट कामे", qaPay: "देयके भरा", qaInvite: "पाहुणा बोलवा", qaTicket: "तक्रार नोंदवा", qaAmenities: "सुविधा",
  latestNotice: "ताजी सूचना", seeAll: "सर्व पहा", expectedToday: "आज अपेक्षित",
  down: "बंद", allNormal: "सर्व यंत्रणा सुरळीत", thingsDown: "{n} बंद आहेत",
  utilitySub: "पाणी, लिफ्ट, वीज आणि जनरेटर", agmTitle: "वार्षिक सभेचे मतदान सुरू",
  twoAgmItems: "{n} पैकी २ वार्षिक सभा विषयांवर तुमचे मत हवे", ownersVoting: "मालक दोन वार्षिक सभा विषयांवर मतदान करत आहेत",
  noOneExpected: "आज कोणीही अपेक्षित नाही", noOneExpectedSub: "पाहुण्याला बोलवा, गेटकडे ते येण्यापूर्वीच नाव असेल.",
  inviteAGuest: "पाहुणा बोलवा", twoPositions: "तुमच्याकडे इथे दोन भूमिका आहेत", switchLedger: "योग्य देयके, सूचना आणि पास पाहण्यासाठी हिशोब बदला.",
  owned: "मालकीचे", rentedOut: "भाड्याने दिलेले",

  duesTitle: "देयके", statement: "तपशील", filterAll: "सर्व", filterUnpaid: "न भरलेली", filterPaid: "भरलेली",
  unpaid: "न भरलेले", paid: "भरले", nothingOutstanding: "काहीही थकीत नाही",
  nothingOutstandingSub: "या फिल्टरमधील प्रत्येक देयक भरले आहे. पावत्या भरलेल्या विभागात राहतात.",

  totalPayable: "एकूण देय", whatThisCovers: "यात काय समाविष्ट आहे", total: "एकूण",
  payAmount: "{amount} भरा", receiptNote: "बँकेने पुष्टी दिल्यावर लगेच पावती दिली जाते.",
  settledOn: "{date} रोजी भरले", receiptLabel: "पावती {n}",

  payUsingQr: "QR कोडने भरा", payUsingQrSub: "इतर उपकरणावरील कोणत्याही UPI अ‍ॅपने स्कॅन करा",
  payUsingApp: "इन्स्टॉल केलेल्या अ‍ॅपने भरा", payUsingAppSub: "या फोनवर UPI अ‍ॅप उघडते",
  cancel: "रद्द करा", scanToPay: "भरण्यासाठी स्कॅन करा", waitingBank: "बँकेच्या पुष्टीची वाट पाहत आहोत. होईपर्यंत हे उघडे ठेवा.",
  iHavePaid: "मी भरले — आता तपासा", cancelPayment: "पैसे भरणे रद्द करा",
  cancelNothing: "इथे रद्द केल्यास काहीही शुल्क नाही. वेळ संपल्यावर कोड आपोआप बंद होतो.",
  cancelledNothing: "पैसे भरणे रद्द केले. काहीही शुल्क घेतले नाही.",
  expiredBadge: "कालबाह्य", expiredHint: "हा कोड कालबाह्य झाला आहे. पुन्हा प्रयत्न करण्यासाठी नवीन कोड तयार करा.",
  liveQrHint: "दुसऱ्या फोनवर कोणतेही UPI अ‍ॅप उघडून स्कॅन करा. कोड फक्त दहा मिनिटे वैध आहे.",
  generateNewCode: "नवीन कोड तयार करा", chooseApp: "अ‍ॅप निवडा",
  chooseAppSub: "तुम्ही निवडलेले अ‍ॅप {amount} मागेल.", back: "मागे",

  paymentReceived: "पैसे मिळाले", downloadReceipt: "पावती डाउनलोड करा", done: "पूर्ण",
  receiptSaved: "पावती तुमच्या फोनवर जतन झाली.",

  noticesTitle: "सूचना", unreadOf: "{total} पैकी {n} न वाचलेल्या", iHaveRead: "मी हे वाचले",
  acknowledged: "मान्य केले", ackSent: "कार्यालयाला मान्यता पाठवली.",

  visitorsTitle: "पाहुणे", invite: "बोलवा", noPassesYet: "अजून पास नाहीत",
  noPassesSub: "एक तयार करा आणि गेट काही सेकंदांत तुमच्या पाहुण्याला आत सोडेल.",
  passCancelled: "{name} चा पास रद्द केला.", passRevoked: "{name} चा पास रद्द केला. उपस्थितीची नोंद बंद झाली.",
  visitorCountLine: "{n} पास · {expected} अपेक्षित",

  inviteTitle: "पाहुणा बोलवा", oneTimeGuest: "एकवेळचा पाहुणा", dailyHelpMode: "रोजची मदत",
  guestName: "पाहुण्याचे नाव", guestNamePh: "कोण येत आहे?", purpose: "कारण", validFor: "इतका वेळ वैध",
  createPass: "पास तयार करा", creatingPass: "पास तयार होत आहे…",
  guestNameError: "गेट पडताळणी करण्यापूर्वी पाहुण्याचे नाव हवे.",
  codeReachesBoth: "कोड तुमच्या पाहुण्याला आणि गेटला एकाच वेळी पोहोचतो.",
  standingPassIntro: "हा कोड नाही, स्थायी पास आहे. गेट त्यांना आत किंवा बाहेर नोंदवेल तेव्हा ते महिन्याच्या उपस्थितीत जमा होते.",
  helpName: "नाव", helpNamePh: "तुमच्याकडे कोण काम करते?", helpRole: "काम", daysTheyCome: "येण्याचे दिवस",
  hoursTheyWork: "कामाच्या वेळा", monthlySalary: "मासिक पगार", monthlySalaryPh: "४५००",
  registerAndIssue: "नोंदणी करून पास द्या", officeVerifies: "पास सुरू होण्यापूर्वी कार्यालय ओळखपत्र तपासते.",
  perDayHint: "उपस्थिती याच्यावरून मोजली जाते, त्यामुळे दैनिक दर कधीही वादग्रस्त नसतो.",
  perDayRateLine: "सुमारे {days} कामाच्या दिवसांसाठी {amount} म्हणजे दिवसाला {perDay}.",
  helpNameRequired: "नाव आवश्यक आहे.", helpSalaryRequired: "ठरलेला मासिक पगार टाका.",

  standingPassIssued: "स्थायी पास दिला", passCreatedTitle: "पास तयार झाला",
  staffPass: "कामगार पास", gateCode: "गेट कोड", sendPassToThem: "त्यांना पास पाठवा",
  shareWithGuest: "पाहुण्याला शेअर करा", seeAttendance: "उपस्थिती पहा", backToVisitors: "पाहुण्यांकडे परत",
  codeSentWhatsapp: "कोड तुमच्या पाहुण्याला व्हॉट्सअॅपवर पाठवला.",

  helpdeskTitle: "मदत कक्ष", raise: "नोंदवा", newTicketTitle: "तक्रार नोंदवा",
  category: "प्रकार", whatIsWrong: "काय चुकीचे आहे?", whatIsWrongPh: "एक-दोन ओळी पुरेशा आहेत.",
  urgent: "तातडीचे", urgentSub: "ड्युटीवरील पर्यवेक्षकाला सूचित करते", submitTicket: "तक्रार पाठवा", sending: "पाठवत आहे…",
  markResolved: "सुटले म्हणून नोंदवा", ticketRequiredError: "योग्य व्यक्तीकडे जाण्यासाठी काय चुकीचे आहे ते सांगा.",
  ticketRaised: "{id} नोंदवली. ४ तासांत उत्तर मिळेल.", ticketResolvedToast: "{id} सुटले म्हणून नोंदवले.",
  duplicateLine: "आज {n} इतर सदनिकेने {category} नोंदवले आहे", duplicateLineN: "आज {n} इतर सदनिकांनी {category} नोंदवले आहे",
  duplicateDetail: "देखभाल विभागाला हे आधीच माहीत आहे. तरीही नोंदवल्याने व्याप्ती समजण्यास मदत होते.",
  openOfTotal: "{open} सुरू · {total} एकूण",

  settings: "सेटिंग्ज", viewAs: "या रूपात पहा", personal: "वैयक्तिक माहिती", myTenants: "माझे भाडेकरू",
  dailyHelpRow: "रोजची मदत", deliveries: "पार्सल", householdRow: "घरातील सदस्य",
  vehiclesRow: "वाहने", notifRow: "सूचना सेटिंग", languageRow: "भाषा",
  none: "नाही", oneActive: "१ सुरू", nPeople: "{n} व्यक्ती", nOf4On: "४ पैकी {n} सुरू",
  nowViewingAs: "आता {role} म्हणून पाहत आहात.",

  personalTitle: "वैयक्तिक माहिती", edit: "बदला", cancelEdit: "रद्द करा", saveChanges: "बदल जतन करा",
  contact: "संपर्क", residence: "निवास", mobileNumber: "मोबाईल क्रमांक", setByOffice: "कार्यालयाने सेट केले",
  email: "ईमेल", alternatePhone: "दुसरा फोन नंबर", emergencyContact: "आपत्कालीन संपर्क",
  flatLabel: "सदनिका", societyLabel: "सोसायटी", heldAs: "मालकी प्रकार", carpetArea: "कार्पेट क्षेत्र", parkingSlots: "पार्किंग जागा",
  slotsAllotted: "{n} दिलेल्या", detailsUpdated: "वैयक्तिक माहिती अद्ययावत केली.",
  mobileIsLoginNote: "तुमचा मोबाईल क्रमांक हाच लॉगिन आहे आणि तो फक्त कार्यालयच बदलू शकते.",

  householdTitle: "घरातील सदस्य", householdIntro: "इथे नोंदलेल्या कोणालाही पासशिवाय गेटवर ओळखता येते.",
  addAMember: "सदस्य जोडा", fullName: "पूर्ण नाव", relation: "नाते", addToHousehold: "घरात जोडा",
  memberRemoved: "{name} ला घरातून काढले.", memberNeedsName: "सदस्याचे नाव आवश्यक आहे.",
  memberAdded: "{name} जोडले. गेट आता त्यांना ओळखू शकते.", youChip: "तुम्ही",

  vehiclesTitle: "वाहने", vehiclesIntro: "नोंदणीकृत क्रमांक पाहिल्यावर रक्षकाला बाहेर न येता बॅरिअर उघडता येतो.",
  registerVehicle: "वाहन नोंदवा", plateNumber: "MH 12 AB 1234", register: "नोंदवा",
  vehicleRemoved: "{plate} काढले.", plateTooShort: "पूर्ण नोंदणी क्रमांक टाका.",
  vehicleRegistered: "{plate} नोंदवले. जागा कार्यालयाकडून ठरेल.", slotPending: "प्रतीक्षेत",

  notifTitle: "सूचना सेटिंग", notifIntro: "नको असलेल्या सूचना बंद करा. तातडीच्या सूचना नेहमी येतात.",
  markAllRead: "सर्व वाचले म्हणून चिन्हांकित करा",

  languageTitle: "भाषा", languageIntro: "भाषांतर उपलब्ध असल्यास कार्यालयाच्या सूचना तुमच्या भाषेत दिसतात.",
  languageSet: "भाषा {name} केली.", languageDefault: "अ‍ॅपमध्ये मूळ भाषा",

  deliveriesTitle: "पार्सल", deliveriesIntro: "प्रत्येक पार्सलसाठी गेट हेच पाळते. फोन करण्याची गरज नाही.",
  whatGuardSees: "रक्षकाला काय दिसते", guardTold: "गेटला सांगितले आहे.",
  guardSeesLine: "{unit} — {pref}. पार्सल नोंदवण्यापूर्वी हे रक्षकाला दिसते.",

  dailyHelpTitle: "रोजची मदत", dailyHelpIntro: "सप्टेंबर, गेटच्या स्वतःच्या नोंदीवरून मोजलेले. वह्या नाहीत, वाद नाहीत.",
  cameIn: "आले", absentLabel: "अनुपस्थित", weeklyOff: "आठवडी सुट्टी", notYetRecorded: "अजून नोंद नाही",
  daysPresent: "उपस्थित दिवस", daysAbsent: "अनुपस्थित दिवस", weeklyOffs: "आठवडी सुट्ट्या", agreedSalary: "ठरलेला पगार",
  perDay: "दिवसाला", payableThisMonth: "या महिन्याचे देय", markSalaryPaid: "पगार भरला म्हणून नोंदवा",
  markedPaidThisMonth: "या महिन्यासाठी भरले म्हणून नोंदवले", salaryMarkedPaid: "{name} चा पगार भरला म्हणून नोंदवला.",
  alreadyMarkedPaid: "सप्टेंबरसाठी आधीच भरले म्हणून नोंदवले आहे.", nobodyRegistered: "अजून कोणाचीही नोंदणी नाही",
  nobodyRegisteredSub: "तुमच्या मोलकरीण, स्वयंपाकी किंवा चालकाची नोंदणी करा — गेटचे आत-बाहेर त्यांची उपस्थिती बनते.",
  registerDailyHelp: "रोजची मदत नोंदवा", forDays: "{total} पैकी {present}",
  salaryForDays: "{days} दिवसांसाठी {amount}",

  amenitiesTitle: "सुविधा", yourBookings: "तुमची आरक्षणे", bookAnAmenity: "सुविधा आरक्षित करा",
  cancelBooking: "आरक्षण रद्द करा", bookingCancelled: "{amenity} आरक्षण रद्द केले. अनामत रक्कम ३ दिवसांत परत येईल.",
  bookTitle: "आरक्षण", day: "दिवस", slot: "वेळ", takenLabel: "घेतलेली", freeLabel: "मोकळी", slotTaken: "ती वेळ आधीच घेतली आहे.",
  confirmBooking: "आरक्षण निश्चित करा", chargeNote: "शुल्क तुमच्या पुढील देखभाल देयकात येईल.",
  bookingConfirmed: "{amenity} {day} साठी आरक्षित केले.", amenitySummary: "{n} आरक्षण{s} · रहिवाशांसाठी ४ सुविधा खुल्या",
  free: "मोफत", noDeposit: "अनामत नाही", refundable: "₹{amount} परत मिळणारे",

  statementTitle: "तपशील", closingBalance: "अंतिम शिल्लक", accountSettled: "तुमचे खाते पूर्ण भरले आहे.",
  payableByDate: "१७ सप्टेंबर २०२६ पर्यंत देय. अजून काहीही थकीत नाही.",
  interestTitle: "उशिरा भरल्यास व्याज",
  interestBody: "पोटनियम ६८ नुसार देय तारखेनंतर थकीत रकमेवर दरमहा १.५% व्याज लागते. {amount} वर ते सुमारे {perMonth} दरमहा होते.",
  thisYear: "या वर्षी", downloadPdf: "PDF म्हणून डाउनलोड करा", statementSaved: "२०२६-२७ चा तपशील फोनवर जतन झाला.",

  votesTitle: "मतदान", twoItemsOpenIntro: "२८ सप्टेंबरच्या वार्षिक सभेपूर्वी दोन विषय खुले आहेत. तुमचे मत {unit} शी जोडलेले आहे.",
  tenantsCannotVoteTitle: "भाडेकरू मतदान करू शकत नाहीत",
  tenantsCannotVoteBody: "सर्वसाधारण सभेतील मताचा अधिकार सदनिकेच्या मालकाकडे असतो. तुम्ही उपस्थित राहून बोलू शकता — वार्षिक सभेच्या सूचनेत वेळ आणि विषयसूची आहे.",
  castVote: "मत द्या", liveTally: "थेट मोजणी", voteRecordedToast: "{unit} साठी मत नोंदवले.",
  alreadyVotedToast: "तुमचे मत आधीच नोंदवले आहे.", votedTag: "मत दिले", openTag: "खुले",
  voteCast: "मत दिले", votedLine: "{unit} विरुद्ध १३ सप्टेंबर २०२६ रोजी नोंदवले.",
  cannotChangeVote: "तुमचे मत {unit} विरुद्ध नोंदवले आहे आणि दिल्यानंतर बदलता येत नाही.",

  myTenantsTitle: "माझे भाडेकरू", oneAgreementLive: "तुम्ही {unit} भाड्याने दिले आहे. एक करार सुरू आहे.",
  notLettingOut: "तुम्ही सध्या कोणतीही सदनिका भाड्याने दिलेली नाही.", agreementFrom: "करार सुरू",
  expiresLabel: "संपतो", policeVerification: "पोलीस पडताळणी", verifiedOn: "{date} रोजी पडताळले",
  nonOccupancyChargeLabel: "अनिवासी शुल्क", perMonthAmount: "₹{amount} दरमहा",
  startRenewal: "नूतनीकरण सुरू करा", renewalSent: "नूतनीकरण विनंती पाठवली", renewalRequestSent: "नूतनीकरण सुरू केले. कार्यालय मसुदा पाठवेल.",
  renewalAlready: "नूतनीकरण विनंती आधीच कार्यालयाकडे आहे.", activeStatus: "सुरू", endedStatus: "संपले",
  registeringNewTenant: "नवीन भाडेकरू नोंदवणे",
  registeringNewTenantBody: "भाडेकरूला अ‍ॅप वापर मिळण्यापूर्वी सोसायटीला करार, पोलीस पडताळणी आणि ₹५,०००ची अनिवासी अनामत रक्कम हवी.",
  noTenanciesTitle: "तुमच्या नावावर कोणताही भाडेकरार नाही",
  noTenanciesBody: "तुम्ही मालकीची सदनिका भाड्याने दिल्यावर हा पडदा भरतो. कार्यालयाला सांगा, ते करार इथे जोडतील.",

  buildingStatusTitle: "इमारतीची स्थिती", buildingStatusIntro: "पाणी, लिफ्ट, वीज आणि जनरेटर — कार्यालयाने शेवटची नोंद केल्याप्रमाणे.",

  emergencyTitle: "आपत्कालीन",
  emergencyIntro: "दोन सेकंद दाबून ठेवा. गेट, कार्यकारिणी आणि तुमचा आपत्कालीन संपर्क यांना तुमच्या सदनिका क्रमांकासह एकाच वेळी कळवले जाते.",
  whatIsHappening: "काय घडत आहे?", holdToRaise: "{kind} साठी दाबून ठेवा", keepHolding: "दाबून ठेवा…",
  secondsToGo: "{n} सेकंद उरला", twoSecondsUnit: "दोन सेकंद · {unit}",
  reachesImmediately: "लगेच पोहोचते", alertSentToast: "{kind} सूचना पाठवली. मदत येत आहे.",
  alertRaisedFrom: "{unit} वरून {kind} सूचना दिली", gateAcknowledged: "गेटने ४ सेकंदांत मान्य केले. कार्यकारिणीचे दोन सदस्य तुम्हाला फोन करत आहेत.",
  mainGate: "मुख्य गेट", committee: "कार्यकारिणी", committeeNotified: "६ सदस्यांना कळवले",
  yourEmergencyContact: "तुमचा आपत्कालीन संपर्क", nearestHospital: "जवळचे रुग्णालय", hospitalDistance: "सह्याद्री, २.४ किमी",

  spouse: "पती/पत्नी", child: "मूल", parent: "पालक", car: "कार", twoWheeler: "दुचाकी",
  owner: "मालक", tenant: "भाडेकरू", ownerAndTenant: "मालक आणि भाडेकरू",
  ownerDetail: "{unit} तुम्ही विकत घेतले आहे आणि तिथेच राहता. वार्षिक सभेत पूर्ण मत.",
  tenantDetail: "{unit} भाड्याने घेतले आहे. तुमची देयके आणि लागणाऱ्या सूचना दिसतात, मतदान नाही.",
  bothDetail: "{unit} तुमचे आहे आणि {letOut} भाड्याने दिले आहे. दोन्हींचे हिशोब वेगळे राहतात.",

  morning: "सकाळ", twiceDaily: "दिवसातून दोनदा", fullDay: "पूर्ण दिवस", evening: "संध्याकाळ",
  housekeeping: "साफसफाई", cook: "स्वयंपाक", driver: "चालक", nanny: "आया", careGiver: "देखभाल",
  guest: "पाहुणा", delivery: "पार्सल", cab: "कॅब", service: "सेवा",
  twoHours: "२ तास", today: "आज", thisWeek: "या आठवड्यात",
  plumbing: "नळकाम", electrical: "वीजकाम", lift: "लिफ्ट", security: "सुरक्षा", other: "इतर",
  medical: "वैद्यकीय", fire: "आग",
};

const hi: Partial<CopyPack> = {
  home: "होम", dues: "बकाया", notices: "सूचनाएँ", visitors: "मेहमान", profile: "प्रोफ़ाइल",
  greeting: "सुप्रभात, {name}", amountDue: "बकाया राशि", payNow: "अभी भुगतान करें", allSettled: "सब चुकता",
  across1: "१ बिल का", acrossN: "{n} बिलों का", dueOn: "१७ सितंबर तक", nothingDue: "कुछ बकाया नहीं",
  quickActions: "तुरंत काम", qaPay: "बकाया भरें", qaInvite: "मेहमान बुलाएँ", qaTicket: "शिकायत दर्ज करें", qaAmenities: "सुविधाएँ",
  latestNotice: "ताज़ा सूचना", seeAll: "सभी देखें", expectedToday: "आज अपेक्षित",
  down: "बंद", allNormal: "सब सामान्य", thingsDown: "{n} बंद हैं",
  utilitySub: "पानी, लिफ्ट, बिजली और जनरेटर", agmTitle: "वार्षिक सभा का मतदान खुला",
  twoAgmItems: "{n} में से २ वार्षिक सभा विषयों पर आपका मत चाहिए", ownersVoting: "मालिक दो वार्षिक सभा विषयों पर मतदान कर रहे हैं",
  noOneExpected: "आज कोई अपेक्षित नहीं", noOneExpectedSub: "मेहमान बुलाएँ, गेट के पास उनके आने से पहले ही नाम होगा.",
  inviteAGuest: "मेहमान बुलाएँ", twoPositions: "आपकी यहाँ दो भूमिकाएँ हैं", switchLedger: "सही बकाया, सूचनाएँ और पास देखने के लिए हिसाब बदलें.",
  owned: "मालिकाना", rentedOut: "किराये पर दिया",

  duesTitle: "बकाया", statement: "विवरण", filterAll: "सभी", filterUnpaid: "अनभुगतान", filterPaid: "भुगतान",
  unpaid: "अनभुगतान", paid: "भुगतान", nothingOutstanding: "कुछ भी बकाया नहीं",
  nothingOutstandingSub: "इस फ़िल्टर का हर बिल चुकता है. रसीदें भुगतान में रहती हैं.",

  totalPayable: "कुल देय", whatThisCovers: "इसमें क्या शामिल है", total: "कुल",
  payAmount: "{amount} भुगतान करें", receiptNote: "बैंक की पुष्टि होते ही रसीद जारी होती है.",
  settledOn: "{date} को चुकता", receiptLabel: "रसीद {n}",

  payUsingQr: "QR कोड से भुगतान करें", payUsingQrSub: "दूसरे डिवाइस पर किसी भी UPI ऐप से स्कैन करें",
  payUsingApp: "इंस्टॉल किए ऐप से भुगतान करें", payUsingAppSub: "इस फ़ोन पर UPI ऐप खुलता है",
  cancel: "रद्द करें", scanToPay: "भुगतान के लिए स्कैन करें", waitingBank: "बैंक की पुष्टि का इंतज़ार है. जब तक न हो, इसे खुला रखें.",
  iHavePaid: "मैंने भुगतान कर दिया — अभी जाँचें", cancelPayment: "भुगतान रद्द करें",
  cancelNothing: "यहाँ रद्द करने पर कोई शुल्क नहीं लगता. समय पूरा होने पर कोड खुद बंद हो जाता है.",
  cancelledNothing: "भुगतान रद्द किया गया. कोई शुल्क नहीं लिया गया.",
  expiredBadge: "समाप्त", expiredHint: "यह कोड समाप्त हो गया है. फिर कोशिश करने के लिए नया कोड बनाएँ.",
  liveQrHint: "दूसरे फ़ोन पर कोई भी UPI ऐप खोलकर स्कैन करें. कोड सिर्फ़ दस मिनट के लिए मान्य है.",
  generateNewCode: "नया कोड बनाएँ", chooseApp: "ऐप चुनें",
  chooseAppSub: "आपके चुने ऐप से {amount} माँगा जाएगा.", back: "पीछे",

  paymentReceived: "भुगतान मिल गया", downloadReceipt: "रसीद डाउनलोड करें", done: "पूर्ण",
  receiptSaved: "रसीद आपके फ़ोन में सहेजी गई.",

  noticesTitle: "सूचनाएँ", unreadOf: "{total} में से {n} अपठित", iHaveRead: "मैंने यह पढ़ लिया",
  acknowledged: "स्वीकृत", ackSent: "स्वीकृति दफ़्तर को भेज दी गई.",

  visitorsTitle: "मेहमान", invite: "बुलाएँ", noPassesYet: "अभी कोई पास नहीं",
  noPassesSub: "एक बनाएँ और गेट सेकंडों में आपके मेहमान को अंदर आने देगा.",
  passCancelled: "{name} का पास रद्द किया.", passRevoked: "{name} का पास रद्द किया. उपस्थिति रिकॉर्ड बंद हुआ.",
  visitorCountLine: "{n} पास · {expected} अपेक्षित",

  inviteTitle: "मेहमान बुलाएँ", oneTimeGuest: "एक बार का मेहमान", dailyHelpMode: "रोज़ की मदद",
  guestName: "मेहमान का नाम", guestNamePh: "कौन आ रहा है?", purpose: "उद्देश्य", validFor: "इतने समय तक मान्य",
  createPass: "पास बनाएँ", creatingPass: "पास बनाया जा रहा है…",
  guestNameError: "गेट पहचान करने से पहले मेहमान का नाम चाहिए.",
  codeReachesBoth: "कोड आपके मेहमान और गेट दोनों तक एक ही समय पहुँचता है.",
  standingPassIntro: "यह कोड नहीं, स्थायी पास है. गेट जब भी उन्हें अंदर या बाहर दर्ज करेगा, वह महीने की उपस्थिति में जुड़ जाएगा.",
  helpName: "नाम", helpNamePh: "आपके साथ कौन काम करता है?", helpRole: "काम", daysTheyCome: "आने के दिन",
  hoursTheyWork: "काम के घंटे", monthlySalary: "मासिक वेतन", monthlySalaryPh: "४५००",
  registerAndIssue: "दर्ज करें और पास दें", officeVerifies: "पास शुरू होने से पहले दफ़्तर पहचान जाँचता है.",
  perDayHint: "उपस्थिति इसी पर गिनी जाती है, इसलिए दैनिक दर कभी विवादित नहीं होती.",
  perDayRateLine: "लगभग {days} कार्यदिनों के लिए {amount} यानी प्रतिदिन {perDay}.",
  helpNameRequired: "नाम आवश्यक है.", helpSalaryRequired: "तय मासिक वेतन डालें.",

  standingPassIssued: "स्थायी पास जारी हुआ", passCreatedTitle: "पास बना",
  staffPass: "स्टाफ़ पास", gateCode: "गेट कोड", sendPassToThem: "उन्हें पास भेजें",
  shareWithGuest: "मेहमान से शेयर करें", seeAttendance: "उपस्थिति देखें", backToVisitors: "मेहमानों पर वापस",
  codeSentWhatsapp: "कोड आपके मेहमान को व्हाट्सऐप पर भेजा गया.",

  helpdeskTitle: "सहायता", raise: "दर्ज करें", newTicketTitle: "शिकायत दर्ज करें",
  category: "श्रेणी", whatIsWrong: "क्या गड़बड़ है?", whatIsWrongPh: "एक-दो पंक्तियाँ काफ़ी हैं.",
  urgent: "अत्यावश्यक", urgentSub: "ड्यूटी पर तैनात सुपरवाइज़र को सूचित करता है", submitTicket: "शिकायत भेजें", sending: "भेजा जा रहा है…",
  markResolved: "हल हुआ मार्क करें", ticketRequiredError: "सही व्यक्ति तक पहुँचाने के लिए बताएँ कि क्या गड़बड़ है.",
  ticketRaised: "{id} दर्ज हुई. ४ घंटे में जवाब मिलेगा.", ticketResolvedToast: "{id} हल हुआ मार्क किया.",
  duplicateLine: "आज {n} अन्य फ़्लैट ने {category} दर्ज की है", duplicateLineN: "आज {n} अन्य फ़्लैट्स ने {category} दर्ज की है",
  duplicateDetail: "फ़ैसिलिटी डेस्क को यह पहले से पता है. फिर भी दर्ज करना व्यापकता समझने में मदद करता है.",
  openOfTotal: "{open} खुली · {total} कुल",

  settings: "सेटिंग्ज", viewAs: "इस रूप में देखें", personal: "व्यक्तिगत जानकारी", myTenants: "मेरे किरायेदार",
  dailyHelpRow: "रोज़ की मदद", deliveries: "पार्सल", householdRow: "घर के सदस्य",
  vehiclesRow: "वाहन", notifRow: "सूचना सेटिंग", languageRow: "भाषा",
  none: "कोई नहीं", oneActive: "१ सक्रिय", nPeople: "{n} लोग", nOf4On: "४ में से {n} चालू",
  nowViewingAs: "अब {role} के रूप में देख रहे हैं.",

  personalTitle: "व्यक्तिगत जानकारी", edit: "बदलें", cancelEdit: "रद्द करें", saveChanges: "बदलाव सहेजें",
  contact: "संपर्क", residence: "निवास", mobileNumber: "मोबाइल नंबर", setByOffice: "दफ़्तर द्वारा सेट",
  email: "ईमेल", alternatePhone: "दूसरा फ़ोन नंबर", emergencyContact: "आपातकालीन संपर्क",
  flatLabel: "फ़्लैट", societyLabel: "सोसाइटी", heldAs: "स्वामित्व प्रकार", carpetArea: "कार्पेट क्षेत्र", parkingSlots: "पार्किंग स्थान",
  slotsAllotted: "{n} आवंटित", detailsUpdated: "व्यक्तिगत जानकारी अपडेट हुई.",
  mobileIsLoginNote: "आपका मोबाइल नंबर ही लॉगिन है और इसे केवल दफ़्तर बदल सकता है.",

  householdTitle: "घर के सदस्य", householdIntro: "यहाँ दर्ज किसी को भी गेट पर बिना पास पहचाना जा सकता है.",
  addAMember: "सदस्य जोड़ें", fullName: "पूरा नाम", relation: "संबंध", addToHousehold: "घर में जोड़ें",
  memberRemoved: "{name} को घर से हटाया.", memberNeedsName: "सदस्य का नाम आवश्यक है.",
  memberAdded: "{name} जोड़ा गया. गेट अब उन्हें पहचान सकता है.", youChip: "आप",

  vehiclesTitle: "वाहन", vehiclesIntro: "दर्ज नंबर देखकर गार्ड बाहर आए बिना बैरियर खोल देता है.",
  registerVehicle: "वाहन दर्ज करें", plateNumber: "MH 12 AB 1234", register: "दर्ज करें",
  vehicleRemoved: "{plate} हटाया.", plateTooShort: "पूरा पंजीकरण नंबर डालें.",
  vehicleRegistered: "{plate} दर्ज हुआ. स्थान दफ़्तर से तय होगा.", slotPending: "प्रतीक्षा में",

  notifTitle: "सूचना सेटिंग", notifIntro: "जो नहीं चाहिए उसे बंद कर दें. अत्यावश्यक सूचनाएँ हमेशा आती हैं.",
  markAllRead: "सभी पढ़ी हुई मार्क करें",

  languageTitle: "भाषा", languageIntro: "अनुवाद उपलब्ध होने पर दफ़्तर की सूचनाएँ आपकी भाषा में दिखती हैं.",
  languageSet: "भाषा {name} की गई.", languageDefault: "ऐप में मूल भाषा",

  deliveriesTitle: "पार्सल", deliveriesIntro: "हर पार्सल पर गेट यही मानता है. फ़ोन करने की ज़रूरत नहीं.",
  whatGuardSees: "गार्ड को क्या दिखता है", guardTold: "गेट को बता दिया गया है.",
  guardSeesLine: "{unit} — {pref}. पार्सल दर्ज करने से पहले यह गार्ड को दिखता है.",

  dailyHelpTitle: "रोज़ की मदद", dailyHelpIntro: "सितंबर, गेट के अपने रिकॉर्ड से गिना गया. न रजिस्टर, न बहस.",
  cameIn: "आए", absentLabel: "अनुपस्थित", weeklyOff: "साप्ताहिक अवकाश", notYetRecorded: "अभी दर्ज नहीं",
  daysPresent: "उपस्थित दिन", daysAbsent: "अनुपस्थित दिन", weeklyOffs: "साप्ताहिक अवकाश", agreedSalary: "तय वेतन",
  perDay: "प्रतिदिन", payableThisMonth: "इस महीने का देय", markSalaryPaid: "वेतन भुगतान मार्क करें",
  markedPaidThisMonth: "इस महीने के लिए भुगतान मार्क किया", salaryMarkedPaid: "{name} का वेतन भुगतान मार्क किया गया.",
  alreadyMarkedPaid: "सितंबर के लिए पहले ही भुगतान मार्क किया गया है.", nobodyRegistered: "अभी किसी की दर्ज नहीं",
  nobodyRegisteredSub: "अपनी बाई, रसोइया या ड्राइवर दर्ज करें — गेट का आना-जाना ही उनकी उपस्थिति बन जाएगा.",
  registerDailyHelp: "रोज़ की मदद दर्ज करें", forDays: "{total} में से {present}",
  salaryForDays: "{days} दिनों के लिए {amount}",

  amenitiesTitle: "सुविधाएँ", yourBookings: "आपकी बुकिंग", bookAnAmenity: "सुविधा बुक करें",
  cancelBooking: "बुकिंग रद्द करें", bookingCancelled: "{amenity} बुकिंग रद्द हुई. जमा राशि ३ दिनों में वापस आएगी.",
  bookTitle: "बुकिंग", day: "दिन", slot: "समय", takenLabel: "ली गई", freeLabel: "खाली", slotTaken: "वह समय पहले से लिया गया है.",
  confirmBooking: "बुकिंग पक्की करें", chargeNote: "शुल्क आपके अगले रखरखाव बिल में आएगा.",
  bookingConfirmed: "{amenity} {day} के लिए बुक हुआ.", amenitySummary: "{n} बुकिंग{s} · निवासियों के लिए ४ सुविधाएँ खुली",
  free: "मुफ़्त", noDeposit: "जमा राशि नहीं", refundable: "₹{amount} वापसी योग्य",

  statementTitle: "विवरण", closingBalance: "अंतिम शेष", accountSettled: "आपका खाता पूरी तरह चुकता है.",
  payableByDate: "१७ सितंबर २०२६ तक देय. अभी कुछ भी अतिदेय नहीं.",
  interestTitle: "देर से भुगतान पर ब्याज",
  interestBody: "उपनियम ६८ के अनुसार देय तिथि के बाद बकाया पर प्रतिमाह १.५% ब्याज लगता है. {amount} पर यह लगभग {perMonth} प्रतिमाह होता है.",
  thisYear: "इस वर्ष", downloadPdf: "PDF के रूप में डाउनलोड करें", statementSaved: "२०२६-२७ का विवरण फ़ोन में सहेजा गया.",

  votesTitle: "मतदान", twoItemsOpenIntro: "२८ सितंबर की वार्षिक सभा से पहले दो विषय खुले हैं. आपका मत {unit} से जुड़ा है.",
  tenantsCannotVoteTitle: "किरायेदार मतदान नहीं कर सकते",
  tenantsCannotVoteBody: "वार्षिक सभा में मत का अधिकार फ़्लैट के मालिक के पास रहता है. आप उपस्थित होकर अपनी बात रख सकते हैं — वार्षिक सभा सूचना में समय और कार्यसूची है.",
  castVote: "मत दें", liveTally: "लाइव गिनती", voteRecordedToast: "{unit} के लिए मत दर्ज हुआ.",
  alreadyVotedToast: "आपका मत पहले ही दिया जा चुका है.", votedTag: "मत दिया", openTag: "खुला",
  voteCast: "मत दिया गया", votedLine: "{unit} के विरुद्ध १३ सितंबर २०२६ को दर्ज.",
  cannotChangeVote: "आपका मत {unit} के विरुद्ध दर्ज है और देने के बाद बदला नहीं जा सकता.",

  myTenantsTitle: "मेरे किरायेदार", oneAgreementLive: "आपने {unit} किराये पर दिया है. एक करार सक्रिय है.",
  notLettingOut: "आप अभी कोई फ़्लैट किराये पर नहीं दे रहे.", agreementFrom: "करार शुरू",
  expiresLabel: "समाप्ति", policeVerification: "पुलिस सत्यापन", verifiedOn: "{date} को सत्यापित",
  nonOccupancyChargeLabel: "अनिवास शुल्क", perMonthAmount: "₹{amount} प्रतिमाह",
  startRenewal: "नवीनीकरण शुरू करें", renewalSent: "नवीनीकरण अनुरोध भेजा गया", renewalRequestSent: "नवीनीकरण शुरू हुआ. दफ़्तर मसौदा भेजेगा.",
  renewalAlready: "नवीनीकरण अनुरोध पहले से दफ़्तर के पास है.", activeStatus: "सक्रिय", endedStatus: "समाप्त",
  registeringNewTenant: "नया किरायेदार दर्ज करना",
  registeringNewTenantBody: "किरायेदार को ऐप एक्सेस मिलने से पहले सोसाइटी को करार, पुलिस सत्यापन और ₹५,००० की अनिवास जमा राशि चाहिए.",
  noTenanciesTitle: "आपके नाम कोई किरायानामा नहीं",
  noTenanciesBody: "जब आप अपना कोई फ़्लैट किराये पर देंगे तब यह स्क्रीन भरेगी. दफ़्तर को बताएँ, वे करार यहाँ जोड़ देंगे.",

  buildingStatusTitle: "इमारत की स्थिति", buildingStatusIntro: "पानी, लिफ्ट, बिजली और जनरेटर — दफ़्तर की आख़िरी दर्ज स्थिति.",

  emergencyTitle: "आपातकाल",
  emergencyIntro: "दो सेकंड दबाकर रखें. गेट, समिति और आपका आपातकालीन संपर्क — सबको आपके फ़्लैट नंबर के साथ एक साथ सूचित किया जाता है.",
  whatIsHappening: "क्या हो रहा है?", holdToRaise: "{kind} के लिए दबाकर रखें", keepHolding: "दबाकर रखें…",
  secondsToGo: "{n} सेकंड बाकी", twoSecondsUnit: "दो सेकंड · {unit}",
  reachesImmediately: "तुरंत पहुँचता है", alertSentToast: "{kind} अलर्ट भेजा गया. मदद आ रही है.",
  alertRaisedFrom: "{unit} से {kind} अलर्ट उठाया", gateAcknowledged: "गेट ने ४ सेकंड में स्वीकार किया. समिति के दो सदस्य आपको फ़ोन कर रहे हैं.",
  mainGate: "मुख्य गेट", committee: "समिति", committeeNotified: "६ सदस्यों को सूचित किया",
  yourEmergencyContact: "आपका आपातकालीन संपर्क", nearestHospital: "निकटतम अस्पताल", hospitalDistance: "सह्याद्री, २.४ किमी",

  spouse: "पति/पत्नी", child: "बच्चा", parent: "माता-पिता", car: "कार", twoWheeler: "दोपहिया",
  owner: "मालिक", tenant: "किरायेदार", ownerAndTenant: "मालिक और किरायेदार",
  ownerDetail: "{unit} आपने खरीदा है और वहीं रहते हैं. वार्षिक सभा में पूरा मत.",
  tenantDetail: "{unit} किराये पर है. आपके बकाया और ज़रूरी सूचनाएँ दिखती हैं, मतदान नहीं.",
  bothDetail: "{unit} आपका है और {letOut} किराये पर दिया है. दोनों के हिसाब अलग रहते हैं.",

  morning: "सुबह", twiceDaily: "दिन में दो बार", fullDay: "पूरा दिन", evening: "शाम",
  housekeeping: "साफ़-सफ़ाई", cook: "रसोइया", driver: "ड्राइवर", nanny: "आया", careGiver: "देखभाल",
  guest: "मेहमान", delivery: "पार्सल", cab: "कैब", service: "सेवा",
  twoHours: "२ घंटे", today: "आज", thisWeek: "इस हफ़्ते",
  plumbing: "नलसाज़ी", electrical: "बिजली", lift: "लिफ्ट", security: "सुरक्षा", other: "अन्य",
  medical: "मेडिकल", fire: "आग",
};

const PACKS: Record<Language, Partial<CopyPack>> = { en, mr, hi };

/**
 * `t(language, key, vars?)` — the README's `t(key, n)` helper, widened to take any
 * named interpolation (not just `{n}`), and to fall back English → literal key
 * when a language pack is missing an entry (mirrors the prototype's
 * `pack[key] || COPY.English[key] || key`).
 */
export function t(language: Language, key: CopyKey, vars?: Record<string, string | number>): string {
  const template = PACKS[language]?.[key] ?? en[key] ?? key;
  if (!vars) return template;
  return Object.entries(vars).reduce((acc, [k, v]) => {
    const value = k === "n" && typeof v === "number" ? num(v, language) : String(v);
    return acc.split(`{${k}}`).join(value);
  }, template);
}

export type { CopyKey };
