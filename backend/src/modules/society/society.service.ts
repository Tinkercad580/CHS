import { schemas, type BillingConfig, type Society as SocietyDto, type SocietySettings } from "@chs/contract";
import type { z } from "zod";
import { audit } from "../../core/audit";
import type { SocietyScope } from "../../core/context";
import { fromIsoDate, toIso, toIsoDate, todayIst } from "../../core/dates";
import { Prisma, prisma, transaction } from "../../core/db";
import { AppError, notFound } from "../../core/errors";
import { events } from "../../core/events";
import { fromWire, toWire } from "../../core/money";
import { paginate } from "../../core/pagination";
import { assertOverrideAllowed, configNumber, STATUTORY_KEYS } from "../../core/statutory";

type SocietyRow = Prisma.SocietyGetPayload<{ include: { _count: { select: { units: true } } } }>;

function toDto(s: SocietyRow): SocietyDto {
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    type: s.type,
    status: s.status,
    registrationNumber: s.registrationNumber,
    registrationDate: toIsoDate(s.registrationDate),
    addressLine: s.addressLine,
    city: s.city,
    district: s.district,
    pincode: s.pincode,
    registrarOffice: s.registrarOffice,
    pan: s.pan,
    tan: s.tan,
    gstin: s.gstin,
    gstRegistered: s.gstRegistered,
    fyStartMonth: s.fyStartMonth,
    contactEmail: s.contactEmail,
    contactPhone: s.contactPhone,
    unitCount: s._count.units,
    wentLiveAt: toIso(s.wentLiveAt),
    createdAt: toIso(s.createdAt),
  };
}

const withCount = { _count: { select: { units: true } } } as const;

export async function getSociety(id: string) {
  const s = await prisma.society.findUnique({ where: { id }, include: withCount });
  if (!s) throw notFound("Society");
  return toDto(s);
}

export async function updateSociety(scope: SocietyScope, body: z.output<typeof schemas.society.UpdateSocietyBody>) {
  return transaction(prisma, async (tx) => {
    const before = await tx.society.findUniqueOrThrow({ where: { id: scope.societyId }, include: withCount });
    if (body.gstRegistered && !(body.gstin ?? before.gstin)) {
      throw new AppError("VALIDATION_FAILED", "Enter the GSTIN before marking the society GST-registered.", [
        { path: ["gstin"], message: "Required when GST-registered" },
      ]);
    }
    const { registrationDate, ...rest } = body;
    const after = await tx.society.update({
      where: { id: scope.societyId },
      data: { ...rest, ...(registrationDate !== undefined ? { registrationDate: fromIsoDate(registrationDate) } : {}) },
      include: withCount,
    });
    await audit(tx, { action: "society.update", entity: "society", entityId: after.id, before: toDto(before), after: toDto(after) });
    events.emit({ name: "society.changed", to: { society: scope.societyId }, payload: {} });
    return toDto(after);
  });
}

// ─── Settings ───────────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: SocietySettings = {
  languages: ["en", "mr"],
  defaultLanguage: "en",
  directoryEnabled: true,
  financialTransparency: false,
  complianceSummaryVisible: false,
  visitorRetentionDays: 90,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  tenantExpiryReminderDays: 30,
  autoSuspendTenantOnExpiry: true,
};

export function readSettings(raw: unknown): SocietySettings {
  const merged = { ...DEFAULT_SETTINGS, ...(typeof raw === "object" && raw ? raw : {}) };
  const parsed = schemas.society.SocietySettings.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export async function getSettings(societyId: string) {
  const s = await prisma.society.findUniqueOrThrow({ where: { id: societyId }, select: { settings: true } });
  return readSettings(s.settings);
}

export async function updateSettings(scope: SocietyScope, body: z.output<typeof schemas.society.UpdateSocietySettingsBody>) {
  return transaction(prisma, async (tx) => {
    const s = await tx.society.findUniqueOrThrow({ where: { id: scope.societyId }, select: { settings: true } });
    const before = readSettings(s.settings);
    const after = schemas.society.SocietySettings.parse({ ...before, ...body });
    if (!after.languages.includes(after.defaultLanguage)) {
      throw new AppError("VALIDATION_FAILED", "The default language must be one of the enabled languages.");
    }
    const retentionCap = await configNumber(tx, "visitor_data_retention_days", scope.societyId);
    if (after.visitorRetentionDays > retentionCap) {
      throw new AppError("BUSINESS_RULE_VIOLATION", `Visitor data can be kept at most ${retentionCap} days (MASTER_SPEC B3.12).`);
    }
    await tx.society.update({ where: { id: scope.societyId }, data: { settings: after as unknown as Prisma.InputJsonValue } });
    await audit(tx, { action: "society.settings", entity: "society", entityId: scope.societyId, before, after });
    events.emit({ name: "society.changed", to: { society: scope.societyId }, payload: {} });
    return after;
  });
}

// ─── Onboarding & go-live ───────────────────────────────────────────────────

/**
 * Computed from the data every time, never stored — a checklist that can't
 * disagree with the society it describes. MASTER_SPEC C2: go-live needs an
 * admin, a unit, billing config, a bank account, charge heads and opening
 * balances. Charge heads and opening balances arrive with the billing and
 * accounting phases; until then they show as pending and don't block.
 */
export async function onboarding(societyId: string) {
  const [society, admins, units, buildings, banks, billing, members] = await Promise.all([
    prisma.society.findUniqueOrThrow({ where: { id: societyId } }),
    prisma.societyUser.count({ where: { societyId, role: "ADMIN", deletedAt: null, suspendedAt: null } }),
    prisma.unit.count({ where: { societyId } }),
    prisma.building.findMany({ where: { societyId, deletedAt: null }, select: { constructionCostPaise: true } }),
    prisma.bankAccount.count({ where: { societyId, active: true } }),
    prisma.billingConfig.findUnique({ where: { societyId } }),
    prisma.membership.count({ where: { societyId, cessationDate: null, kind: "PRIMARY" } }),
  ]);
  const items = [
    { key: "profile", label: "Society profile and registration", done: !!(society.registrationNumber && society.addressLine && society.city), requiredForLive: false, hint: "Registration number, address and city" },
    { key: "admin", label: "At least one administrator", done: admins > 0, requiredForLive: true, hint: null },
    { key: "buildings", label: "Buildings added", done: buildings.length > 0, requiredForLive: true, hint: null },
    { key: "construction_cost", label: "Construction cost for every building", done: buildings.length > 0 && buildings.every((b) => b.constructionCostPaise !== null), requiredForLive: false, hint: "Needed for sinking and repair fund charges" },
    { key: "units", label: "Units added", done: units > 0, requiredForLive: true, hint: null },
    { key: "members", label: "Owners recorded for units", done: units > 0 && members >= units, requiredForLive: false, hint: `${members} of ${units} units have a primary owner` },
    { key: "billing_config", label: "Billing configuration", done: !!billing?.configuredAt, requiredForLive: true, hint: null },
    { key: "bank_account", label: "Bank account", done: banks > 0, requiredForLive: true, hint: null },
    { key: "charge_heads", label: "Charge heads", done: false, requiredForLive: false, hint: "Arrives with the billing engine (Phase 4)" },
    { key: "opening_balances", label: "Opening balances", done: false, requiredForLive: false, hint: "Arrives with payments and accounting" },
  ];
  const done = items.filter((i) => i.done).length;
  return {
    percent: Math.round((done / items.length) * 100),
    canGoLive: society.status === "DRAFT" && items.filter((i) => i.requiredForLive).every((i) => i.done),
    items,
  };
}

export async function goLive(scope: SocietyScope) {
  const check = await onboarding(scope.societyId);
  const society = await prisma.society.findUniqueOrThrow({ where: { id: scope.societyId } });
  if (society.status !== "DRAFT") throw new AppError("CONFLICT", "The society is already live.");
  if (!check.canGoLive) {
    const missing = check.items.filter((i) => i.requiredForLive && !i.done).map((i) => i.label);
    throw new AppError("GO_LIVE_BLOCKED", `Finish setup first: ${missing.join(", ")}.`, { missing });
  }
  const after = await prisma.society.update({ where: { id: scope.societyId }, data: { status: "LIVE", wentLiveAt: new Date() }, include: withCount });
  await audit(prisma, { action: "society.go_live", entity: "society", entityId: after.id, before: { status: "DRAFT" }, after: { status: "LIVE" } });
  events.emit({ name: "society.changed", to: { society: scope.societyId }, payload: {} });
  return toDto(after);
}

// ─── Billing configuration ──────────────────────────────────────────────────

function billingDto(c: Prisma.BillingConfigGetPayload<object> | null): BillingConfig {
  return {
    cycle: c?.cycle ?? "MONTHLY",
    generationDay: c?.generationDay ?? 1,
    dueDay: c?.dueDay ?? 15,
    graceDays: c?.graceDays ?? 0,
    interestRateBps: c?.interestRateBps ?? 0,
    interestResolution: (c?.interestResolution as BillingConfig["interestResolution"]) ?? null,
    roundingRule: (c?.roundingRule as BillingConfig["roundingRule"]) ?? "NEAREST_RUPEE",
    billNumberFormat: c?.billNumberFormat ?? "{CODE}/{FY}/{SEQ}",
    receiptNumberFormat: c?.receiptNumberFormat ?? "{CODE}/R/{FY}/{SEQ}",
    allowPartialPayment: c?.allowPartialPayment ?? true,
    allocationOrder: (c?.allocationOrder as BillingConfig["allocationOrder"]) ?? ["INTEREST", "ARREARS", "CURRENT"],
    effectiveFromPeriod: c?.effectiveFromPeriod ?? null,
    updatedAt: toIso(c?.configuredAt),
  };
}

export async function getBillingConfig(societyId: string) {
  return billingDto(await prisma.billingConfig.findUnique({ where: { societyId } }));
}

/**
 * MASTER_SPEC B3.1: interest is simple, capped at the statutory rate, and
 * set by the general body — a changed non-zero rate needs a resolution
 * reference. Changes apply from the next unbilled period; with no billing
 * yet, that is the current month.
 */
export async function updateBillingConfig(scope: SocietyScope, body: z.output<typeof schemas.society.UpdateBillingConfigBody>) {
  return transaction(prisma, async (tx) => {
    const current = await tx.billingConfig.findUnique({ where: { societyId: scope.societyId } });
    const before = billingDto(current);
    const next = { ...before, ...body };

    if (body.interestRateBps !== undefined) {
      const capPercent = await configNumber(tx, "interest_cap_percent", scope.societyId);
      const capBps = Math.round(capPercent * 100);
      if (body.interestRateBps > capBps) {
        throw new AppError("INTEREST_RATE_EXCEEDS_CAP", `Interest can't exceed ${capPercent}% simple per year.`, { capBps });
      }
      const changed = body.interestRateBps !== before.interestRateBps;
      if (changed && body.interestRateBps > 0 && !body.interestResolution) {
        throw new AppError("RESOLUTION_REQUIRED", "Changing the interest rate needs the general body resolution that approved it.", [
          { path: ["interestResolution"], message: "Meeting reference and date required" },
        ]);
      }
    }
    for (const f of ["billNumberFormat", "receiptNumberFormat"] as const) {
      if (!next[f].includes("{SEQ}")) throw new AppError("VALIDATION_FAILED", "Number formats must include {SEQ}.", [{ path: [f], message: "Missing {SEQ}" }]);
    }
    if (new Set(next.allocationOrder).size !== 3) throw new AppError("VALIDATION_FAILED", "Allocation order must list each bucket once.");

    const now = new Date();
    const period = toIsoDate(todayIst(now)).slice(0, 7);
    const data = {
      cycle: next.cycle,
      generationDay: next.generationDay,
      dueDay: next.dueDay,
      graceDays: next.graceDays,
      interestRateBps: next.interestRateBps,
      interestResolution: next.interestResolution ? (next.interestResolution as Prisma.InputJsonValue) : Prisma.JsonNull,
      roundingRule: next.roundingRule,
      billNumberFormat: next.billNumberFormat,
      receiptNumberFormat: next.receiptNumberFormat,
      allowPartialPayment: next.allowPartialPayment,
      allocationOrder: next.allocationOrder,
      effectiveFromPeriod: period,
      configuredAt: now,
    };
    const row = await tx.billingConfig.upsert({ where: { societyId: scope.societyId }, create: { societyId: scope.societyId, ...data }, update: data });
    const after = billingDto(row);
    await audit(tx, { action: "billing_config.update", entity: "billing_config", entityId: row.id, before, after });
    events.emit({ name: "society.changed", to: { society: scope.societyId }, payload: {} });
    return after;
  });
}

// ─── Bank accounts ──────────────────────────────────────────────────────────

function mask(n: string): string {
  return `${"•".repeat(Math.max(0, n.length - 4))}${n.slice(-4)}`;
}

function bankDto(b: Prisma.BankAccountGetPayload<object>) {
  return {
    id: b.id,
    bankName: b.bankName,
    accountName: b.accountName,
    accountNumberMasked: mask(b.accountNumber),
    ifsc: b.ifsc,
    type: b.type,
    purpose: b.purpose,
    openingBalancePaise: toWire(b.openingBalancePaise)!,
    openingBalanceDate: toIsoDate(b.openingBalanceDate),
    vanPrefix: b.vanPrefix,
    active: b.active,
  };
}

export async function bankAccounts(societyId: string) {
  return (await prisma.bankAccount.findMany({ where: { societyId }, orderBy: { createdAt: "asc" } })).map(bankDto);
}

export async function createBankAccount(scope: SocietyScope, body: z.output<typeof schemas.society.CreateBankAccountBody>) {
  const row = await prisma.bankAccount.create({
    data: {
      societyId: scope.societyId,
      bankName: body.bankName,
      accountName: body.accountName,
      accountNumber: body.accountNumber,
      ifsc: body.ifsc,
      type: body.type,
      purpose: body.purpose,
      openingBalancePaise: fromWire(body.openingBalancePaise)!,
      openingBalanceDate: fromIsoDate(body.openingBalanceDate ?? null),
      vanPrefix: body.vanPrefix ?? null,
    },
  });
  await audit(prisma, { action: "bank_account.create", entity: "bank_account", entityId: row.id, after: bankDto(row) });
  events.emit({ name: "banks.changed", to: { admins: scope.societyId }, payload: {} });
  return bankDto(row);
}

export async function updateBankAccount(scope: SocietyScope, id: string, body: z.output<typeof schemas.society.UpdateBankAccountBody>) {
  const before = await prisma.bankAccount.findFirst({ where: { id, societyId: scope.societyId } });
  if (!before) throw notFound("Bank account");
  const { openingBalancePaise, openingBalanceDate, ...rest } = body;
  const row = await prisma.bankAccount.update({
    where: { id },
    data: {
      ...rest,
      ...(openingBalancePaise !== undefined ? { openingBalancePaise: fromWire(openingBalancePaise)! } : {}),
      ...(openingBalanceDate !== undefined ? { openingBalanceDate: fromIsoDate(openingBalanceDate) } : {}),
    },
  });
  await audit(prisma, { action: "bank_account.update", entity: "bank_account", entityId: id, before: bankDto(before), after: bankDto(row) });
  events.emit({ name: "banks.changed", to: { admins: scope.societyId }, payload: {} });
  return bankDto(row);
}

// ─── Statutory configuration ────────────────────────────────────────────────

type ConfigRow = Prisma.StatutoryConfigGetPayload<object>;
function configDto(r: ConfigRow) {
  return {
    id: r.id,
    key: r.key,
    value: r.value,
    unit: r.unit,
    effectiveFrom: toIsoDate(r.effectiveFrom),
    effectiveTo: toIsoDate(r.effectiveTo),
    sourceReference: r.sourceReference,
    ruleCitation: r.ruleCitation,
    verifiedOn: toIsoDate(r.verifiedOn),
    resolution: (r.resolutionReference as { meetingRef: string; resolvedOn: string } | null) ?? null,
    scope: r.societyId ? ("SOCIETY" as const) : ("PLATFORM" as const),
  };
}

/** Every row — platform and society, past, present and scheduled — newest first per key. */
export async function statutoryConfig(societyId: string, asOf?: string) {
  const at = asOf ? fromIsoDate(asOf) : null;
  const rows = await prisma.statutoryConfig.findMany({
    where: {
      OR: [{ societyId: null }, { societyId }],
      ...(at ? { effectiveFrom: { lte: at }, AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] }] } : {}),
    },
    orderBy: [{ key: "asc" }, { societyId: { sort: "desc", nulls: "last" } }, { effectiveFrom: "desc" }],
  });
  return rows.map(configDto);
}

export async function setStatutoryConfig(scope: SocietyScope, actorUserId: string, body: z.output<typeof schemas.society.SetStatutoryConfigBody>) {
  const spec = STATUTORY_KEYS[body.key];
  if (!spec) throw new AppError("VALIDATION_FAILED", `Unknown statutory parameter "${body.key}".`);
  const from = fromIsoDate(body.effectiveFrom);
  await assertOverrideAllowed(prisma, body.key, body.value, from);
  if (spec.requiresResolution && !body.resolution) {
    throw new AppError("RESOLUTION_REQUIRED", `Changing "${body.key}" needs a general body resolution reference.`);
  }
  return transaction(prisma, async (tx) => {
    // Close the society's open row for this key; history is kept, never overwritten.
    await tx.statutoryConfig.updateMany({
      where: { key: body.key, societyId: scope.societyId, effectiveTo: null, effectiveFrom: { lt: from } },
      data: { effectiveTo: from },
    });
    const clash = await tx.statutoryConfig.findFirst({ where: { key: body.key, societyId: scope.societyId, effectiveFrom: { gte: from } } });
    if (clash) throw new AppError("CONFLICT", `A value for "${body.key}" already starts on or after ${body.effectiveFrom}.`);
    const row = await tx.statutoryConfig.create({
      data: {
        societyId: scope.societyId,
        key: body.key,
        value: body.value,
        unit: spec.unit,
        effectiveFrom: from,
        resolutionReference: body.resolution ? (body.resolution as Prisma.InputJsonValue) : Prisma.JsonNull,
        setById: actorUserId,
        note: body.note ?? null,
        sourceReference: "Society override",
      },
    });
    await audit(tx, { action: "statutory_config.set", entity: "statutory_config", entityId: row.id, after: configDto(row) });
    events.emit({ name: "society.changed", to: { admins: scope.societyId }, payload: {} });
    return configDto(row);
  });
}

// ─── Audit log ──────────────────────────────────────────────────────────────

export async function auditLogs(societyId: string, q: z.output<typeof schemas.platform.AuditListQuery>) {
  const where: Prisma.AuditLogWhereInput = {
    societyId,
    ...(q.entity ? { entity: q.entity } : {}),
    ...(q.entityId ? { entityId: q.entityId } : {}),
    ...(q.actorId ? { actorId: q.actorId } : {}),
    ...(q.from || q.to
      ? { createdAt: { ...(q.from ? { gte: fromIsoDate(q.from) } : {}), ...(q.to ? { lt: new Date(fromIsoDate(q.to).getTime() + 86_400_000) } : {}) } }
      : {}),
    ...(q.q ? { OR: [{ action: { contains: q.q, mode: "insensitive" } }, { actorName: { contains: q.q, mode: "insensitive" } }] } : {}),
  };
  return paginate(
    q.limit,
    q.cursor,
    (p) => prisma.auditLog.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], ...p }),
    (a) => ({
      id: a.id,
      action: a.action,
      entity: a.entity,
      entityId: a.entityId,
      actorName: a.actorName,
      permission: a.permission,
      ip: a.ip,
      before: a.before,
      after: a.after,
      createdAt: toIso(a.createdAt),
    }),
  );
}
