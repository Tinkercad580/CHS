/**
 * Seed data.
 *
 *   npm run db:seed              platform defaults + the demo society
 *   npm run db:seed -- --base    platform defaults only (what production runs)
 *
 * Platform defaults (statutory config, the platform admin) are safe to run
 * any number of times. The demo society — Shanti Vihar CHS, the reference
 * deployment the designs are drawn from — is development data with known
 * passwords, and refuses to run when NODE_ENV=production.
 */
import { DEFAULT_PERMISSION_TEMPLATES } from "@chs/contract";
import { hashPassword } from "../../src/core/auth/password";
import { fromIsoDate } from "../../src/core/dates";
import { prisma } from "../../src/core/db";
import { seedSocietyDefaults } from "../../src/modules/platform/platform.service";
import { DEFAULT_SETTINGS } from "../../src/modules/society/society.service";
import { STATUTORY_SEED } from "./statutory";

const baseOnly = process.argv.includes("--base");

async function seedStatutory() {
  let added = 0;
  for (const row of STATUTORY_SEED) {
    const exists = await prisma.statutoryConfig.findFirst({ where: { key: row.key, societyId: null } });
    if (exists) continue;
    await prisma.statutoryConfig.create({ data: { ...row, societyId: null, effectiveFrom: fromIsoDate("2026-06-30"), verifiedOn: null } });
    added++;
  }
  console.log(`statutory config: ${added} added, ${STATUTORY_SEED.length - added} already present`);
}

async function seedPlatformAdmin() {
  const mobile = process.env.SEED_PLATFORM_ADMIN_MOBILE ?? "9000000001";
  const existing = await prisma.user.findUnique({ where: { mobile } });
  if (existing) {
    if (!existing.isPlatformAdmin) await prisma.user.update({ where: { id: existing.id }, data: { isPlatformAdmin: true } });
    return console.log(`platform admin: ${mobile} (exists)`);
  }
  // No password: the first sign-in sets one, exactly like any provisioned user.
  await prisma.user.create({ data: { mobile, name: "Platform Admin", isPlatformAdmin: true } });
  console.log(`platform admin: ${mobile} — sign in to set a password`);
}

const DEMO_PASSWORD = "Sahaj@2026";

interface DemoUser {
  mobile: string;
  name: string;
  template: string;
  unit?: string;
  withPassword: boolean;
  email?: string;
}

const DEMO_USERS: DemoUser[] = [
  { mobile: "9820011001", name: "Sunil Kulkarni", template: "SECRETARY", withPassword: true, email: "secretary@shantivihar.in" },
  { mobile: "9820011002", name: "Meera Joshi", template: "TREASURER", withPassword: false },
  { mobile: "9822041155", name: "Anita Deshpande", template: "OWNER", unit: "A-1204", withPassword: true, email: "anita.deshpande@gmail.com" },
  { mobile: "9812300702", name: "Vikram Sethi", template: "TENANT", unit: "B-0702", withPassword: true },
  { mobile: "9890012345", name: "Ramesh Yadav", template: "GUARD", withPassword: true },
];

async function seedDemo() {
  if (process.env.NODE_ENV === "production") {
    console.log("demo society: skipped (NODE_ENV=production)");
    return;
  }
  if (await prisma.society.findUnique({ where: { code: "SVCHS" } })) {
    console.log("demo society: Shanti Vihar CHS already present");
    return;
  }
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  await prisma.$transaction(
    async (tx) => {
      const society = await tx.society.create({
        data: {
          code: "SVCHS",
          name: "Shanti Vihar CHS",
          type: "SOCIETY_CHS",
          registrationNumber: "PNA/PNA(4)/HSG/TC/10432/2004",
          registrationDate: fromIsoDate("2004-08-16"),
          addressLine: "Survey No. 41, Baner Road",
          city: "Pune",
          district: "Pune",
          pincode: "411045",
          registrarOffice: "Deputy Registrar, Co-operative Societies, Pune City (4)",
          pan: "AAAAS1234C",
          fyStartMonth: 4,
          contactEmail: "office@shantivihar.in",
          contactPhone: "02027291100",
          settings: DEFAULT_SETTINGS,
        },
      });
      await seedSocietyDefaults(tx, society.id);

      // Four buildings, 62 units each (12 full floors of five, two on the 13th) = 248, numbered floor+flat: A-1204, C-0405.
      const unitIds = new Map<string, string>();
      for (const [i, name] of ["A", "B", "C", "D"].entries()) {
        const b = await tx.building.create({
          data: {
            societyId: society.id,
            name,
            floorCount: 13,
            liftPresent: true,
            constructionYear: 2004 + Math.floor(i / 2),
            constructionCostPaise: 42_00_00_000_00n,
          },
        });
        const rows = [];
        for (let n = 0; n < 62; n++) {
          const floor = Math.floor(n / 5) + 1;
          const flat = (n % 5) + 1;
          rows.push({
            societyId: society.id,
            buildingId: b.id,
            number: `${String(floor).padStart(2, "0")}${String(flat).padStart(2, "0")}`,
            floor,
            carpetAreaSqft: [850, 980, 1180, 1420, 1180][flat - 1]!,
            waterInlets: flat >= 3 ? 3 : 2,
            liftServed: true,
          });
        }
        await tx.unit.createMany({ data: rows });
        for (const u of await tx.unit.findMany({ where: { buildingId: b.id }, select: { id: true, number: true } })) unitIds.set(`${name}-${u.number}`, u.id);
      }
      const unit = (label: string) => {
        const id = unitIds.get(label);
        if (!id) throw new Error(`seed: no unit ${label}`);
        return id;
      };

      // Logins.
      const templates = new Map(DEFAULT_PERMISSION_TEMPLATES.map((t) => [t.code, t]));
      const users = new Map<string, string>();
      for (const d of DEMO_USERS) {
        const t = templates.get(d.template)!;
        const user = await tx.user.upsert({
          where: { mobile: d.mobile },
          create: {
            mobile: d.mobile,
            name: d.name,
            email: d.email ?? null,
            ...(d.withPassword ? { passwordHash, passwordChangedAt: new Date(), activatedAt: new Date(), termsAcceptedAt: new Date() } : {}),
          },
          update: {},
        });
        users.set(d.mobile, user.id);
        await tx.societyUser.create({
          data: { societyId: society.id, userId: user.id, role: t.role, userType: t.userType, permissions: [...t.permissions], unitId: d.unit ? unit(d.unit) : null },
        });
      }

      // Owners of the three focus units, plus an owner for every other unit so the register is full.
      const person = (name: string, mobile: string | null, userId: string | null = null) =>
        tx.person.create({ data: { societyId: society.id, name, mobile, userId } });
      const anita = await person("Anita Deshpande", "9822041155", users.get("9822041155")!);
      await tx.membership.create({ data: { societyId: society.id, unitId: unit("A-1204"), personId: anita.id, kind: "PRIMARY", shareCertificateNo: "SV-1204", sharesHeld: 10, admissionDate: fromIsoDate("2019-03-01") } });
      await tx.membership.create({ data: { societyId: society.id, unitId: unit("C-0405"), personId: anita.id, kind: "PRIMARY", shareCertificateNo: "SV-C405", sharesHeld: 10, admissionDate: fromIsoDate("2021-06-15") } });
      const rajesh = await person("Rajesh Deshpande", "9822041156");
      await tx.membership.create({ data: { societyId: society.id, unitId: unit("A-1204"), personId: rajesh.id, kind: "CO_OWNER", admissionDate: fromIsoDate("2019-03-01") } });
      const kapoor = await person("Harish Kapoor", "9811107020");
      await tx.membership.create({ data: { societyId: society.id, unitId: unit("B-0702"), personId: kapoor.id, kind: "PRIMARY", shareCertificateNo: "SV-B702", sharesHeld: 10, admissionDate: fromIsoDate("2012-01-10") } });

      const firstNames = ["Amit", "Priya", "Rahul", "Sneha", "Vijay", "Kavita", "Sanjay", "Pooja", "Nitin", "Asha", "Deepak", "Swati", "Manoj", "Neha", "Suresh", "Rekha"];
      const lastNames = ["Patil", "Joshi", "Kulkarni", "Shinde", "Pawar", "Deshmukh", "Gokhale", "Bhosale", "Jadhav", "Kale", "More", "Sawant", "Chavan", "Naik"];
      let i = 0;
      const taken = new Set(["A-1204", "C-0405", "B-0702"]);
      const people = [];
      const memberships = [];
      for (const [label, id] of unitIds) {
        if (taken.has(label)) continue;
        const name = `${firstNames[i % firstNames.length]} ${lastNames[Math.floor(i / firstNames.length) % lastNames.length]}`;
        const personId = crypto.randomUUID();
        people.push({ id: personId, societyId: society.id, name, mobile: `98${String(10000000 + i * 7919).slice(-8)}` });
        memberships.push({ societyId: society.id, unitId: id, personId, kind: "PRIMARY" as const, shareCertificateNo: `SV-${label.replace("-", "")}`, sharesHeld: 10, admissionDate: fromIsoDate(`20${String(5 + (i % 18)).padStart(2, "0")}-04-01`) });
        i++;
      }
      await tx.person.createMany({ data: people });
      await tx.membership.createMany({ data: memberships });

      const occupancies = [...unitIds].map(([label, id]) => ({
        societyId: society.id,
        unitId: id,
        status: label === "B-0702" || label === "C-0405" ? ("TENANTED" as const) : ("SELF_OCCUPIED" as const),
        effectiveFrom: fromIsoDate(label === "C-0405" ? "2025-04-01" : label === "B-0702" ? "2024-06-01" : "2019-03-01"),
      }));
      await tx.occupancy.createMany({ data: occupancies });

      // Tenancies.
      const vikram = await person("Vikram Sethi", "9812300702", users.get("9812300702")!);
      await tx.tenancy.create({ data: { societyId: society.id, unitId: unit("B-0702"), tenantPersonId: vikram.id, startDate: fromIsoDate("2024-06-01"), endDate: fromIsoDate("2027-05-31"), monthlyRentPaise: 38_000_00n, depositPaise: 1_50_000_00n, policeIntimationRef: "PUN/TI/2024/88121", allowedOccupants: 3, billPayer: "TENANT" } });
      const mehta = await person("Rohan and Priya Mehta", "9823304405");
      await tx.tenancy.create({ data: { societyId: society.id, unitId: unit("C-0405"), tenantPersonId: mehta.id, startDate: fromIsoDate("2025-04-01"), endDate: fromIsoDate("2027-03-31"), monthlyRentPaise: 42_000_00n, depositPaise: 2_00_000_00n, policeIntimationRef: "PUN/TI/2025/10277", allowedOccupants: 4, billPayer: "OWNER" } });
      const bansal = await person("Ankit Bansal", "9823304406");
      await tx.tenancy.create({ data: { societyId: society.id, unitId: unit("C-0405"), tenantPersonId: bansal.id, startDate: fromIsoDate("2023-04-01"), endDate: fromIsoDate("2025-03-31"), endedOn: fromIsoDate("2025-03-31"), monthlyRentPaise: 36_000_00n, policeIntimationRef: "PUN/TI/2023/40112", billPayer: "OWNER" } });

      // Household, parking, vehicles.
      await tx.familyMember.createMany({
        data: [
          { societyId: society.id, unitId: unit("A-1204"), name: "Rajesh Deshpande", relation: "Spouse", mobile: "9822041156" },
          { societyId: society.id, unitId: unit("A-1204"), name: "Ira Deshpande", relation: "Child", dateOfBirth: fromIsoDate("2014-11-02") },
        ],
      });
      const slotA = await tx.parkingSlot.create({ data: { societyId: society.id, code: "P-A-12", type: "CAR_STILT", unitId: unit("A-1204"), allottedAt: new Date() } });
      const slotB = await tx.parkingSlot.create({ data: { societyId: society.id, code: "P-B-07", type: "CAR_STILT", unitId: unit("B-0702"), allottedAt: new Date() } });
      await tx.parkingSlot.createMany({
        data: [
          { societyId: society.id, code: "P-C-04", type: "CAR_OPEN", unitId: unit("C-0405"), allottedAt: new Date() },
          { societyId: society.id, code: "V-01", type: "VISITOR" },
          { societyId: society.id, code: "V-02", type: "VISITOR" },
        ],
      });
      await tx.vehicle.createMany({
        data: [
          { societyId: society.id, unitId: unit("A-1204"), plate: "MH12KJ4471", type: "CAR", make: "Honda City", colour: "White", ownerName: "Anita Deshpande", parkingSlotId: slotA.id, stickerNo: "SV-0412" },
          { societyId: society.id, unitId: unit("A-1204"), plate: "MH12AB9902", type: "TWO_WHEELER", make: "Honda Activa", colour: "Grey", ownerName: "Rajesh Deshpande", stickerNo: "SV-0413" },
          { societyId: society.id, unitId: unit("B-0702"), plate: "MH14DX7781", type: "CAR", make: "Hyundai Creta", colour: "Blue", ownerName: "Vikram Sethi", parkingSlotId: slotB.id, stickerNo: "SV-0288" },
          { societyId: society.id, unitId: unit("C-0405"), plate: "MH12QR3355", type: "CAR", make: "Maruti Baleno", colour: "Red", ownerName: "Rohan Mehta", stickerNo: "SV-0301" },
        ],
      });

      // Configuration that takes the society live.
      await tx.bankAccount.create({ data: { societyId: society.id, bankName: "Cosmos Co-operative Bank", accountName: "Shanti Vihar Co-operative Housing Society Ltd", accountNumber: "004120100088211", ifsc: "COSB0000041", type: "SAVINGS", purpose: "OPERATIONS", openingBalancePaise: 18_42_310_00n, openingBalanceDate: fromIsoDate("2026-04-01") } });
      await tx.billingConfig.create({ data: { societyId: society.id, cycle: "MONTHLY", generationDay: 1, dueDay: 15, graceDays: 0, interestRateBps: 1200, interestResolution: { meetingRef: "AGM 2025, resolution 7", resolvedOn: "2025-09-21" }, configuredAt: new Date(), effectiveFromPeriod: "2026-04" } });
      await tx.society.update({ where: { id: society.id }, data: { status: "LIVE", wentLiveAt: new Date() } });
    },
    { timeout: 120_000 },
  );

  console.log("demo society: Shanti Vihar CHS (SVCHS) — 4 buildings, 248 units");
  console.log(`  demo password for every account marked * : ${DEMO_PASSWORD}`);
  for (const d of DEMO_USERS) console.log(`  ${d.withPassword ? "*" : " "} ${d.mobile}  ${d.name.padEnd(18)} ${d.template}${d.unit ? ` · ${d.unit}` : ""}${d.withPassword ? "" : "  (first sign-in creates the password)"}`);
}

async function main() {
  await seedStatutory();
  await seedPlatformAdmin();
  if (!baseOnly) await seedDemo();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
