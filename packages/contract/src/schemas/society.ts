import { z } from "zod";
import { Email, Id, IsoDate, IsoDateTime, Language, Paise, ResolutionRef } from "./common";

export const SOCIETY_TYPES = ["SOCIETY_CHS", "SOCIETY_AOA", "UNREGISTERED"] as const;
export const SOCIETY_STATUSES = ["DRAFT", "LIVE", "SUSPENDED"] as const;

export const Society = z.object({
  id: Id,
  code: z.string(),
  name: z.string(),
  type: z.enum(SOCIETY_TYPES),
  status: z.enum(SOCIETY_STATUSES),
  registrationNumber: z.string().nullable(),
  registrationDate: IsoDate.nullable(),
  addressLine: z.string().nullable(),
  city: z.string().nullable(),
  district: z.string().nullable(),
  pincode: z.string().nullable(),
  registrarOffice: z.string().nullable(),
  pan: z.string().nullable(),
  tan: z.string().nullable(),
  gstin: z.string().nullable(),
  gstRegistered: z.boolean(),
  fyStartMonth: z.number().int().min(1).max(12),
  contactEmail: z.string().nullable(),
  contactPhone: z.string().nullable(),
  unitCount: z.number().int(),
  wentLiveAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
});
export type Society = z.infer<typeof Society>;

const Pan = z.string().trim().toUpperCase().regex(/^[A-Z]{5}\d{4}[A-Z]$/, { error: "PAN is 5 letters, 4 digits, 1 letter" });
const Tan = z.string().trim().toUpperCase().regex(/^[A-Z]{4}\d{5}[A-Z]$/, { error: "TAN is 4 letters, 5 digits, 1 letter" });
const Gstin = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/, { error: "Not a valid GSTIN" });

export const UpdateSocietyBody = z.object({
  name: z.string().trim().min(3).max(150).optional(),
  type: z.enum(SOCIETY_TYPES).optional(),
  registrationNumber: z.string().trim().max(60).nullable().optional(),
  registrationDate: IsoDate.nullable().optional(),
  addressLine: z.string().trim().max(300).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  district: z.string().trim().max(80).nullable().optional(),
  pincode: z.string().trim().regex(/^\d{6}$/).nullable().optional(),
  registrarOffice: z.string().trim().max(150).nullable().optional(),
  pan: Pan.nullable().optional(),
  tan: Tan.nullable().optional(),
  gstin: Gstin.nullable().optional(),
  gstRegistered: z.boolean().optional(),
  fyStartMonth: z.number().int().min(1).max(12).optional(),
  contactEmail: Email.nullable().optional(),
  contactPhone: z.string().trim().max(20).nullable().optional(),
});

export const SocietySettings = z.object({
  languages: z.array(Language).min(1),
  defaultLanguage: Language,
  directoryEnabled: z.boolean(),
  financialTransparency: z.boolean(),
  complianceSummaryVisible: z.boolean(),
  visitorRetentionDays: z.number().int().min(1).max(3650),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/),
  tenantExpiryReminderDays: z.number().int().min(1).max(180),
  autoSuspendTenantOnExpiry: z.boolean(),
});
export type SocietySettings = z.infer<typeof SocietySettings>;
export const UpdateSocietySettingsBody = SocietySettings.partial();

export const OnboardingItem = z.object({
  key: z.string(),
  label: z.string(),
  done: z.boolean(),
  requiredForLive: z.boolean(),
  hint: z.string().nullable(),
});
export const Onboarding = z.object({
  percent: z.number().int().min(0).max(100),
  canGoLive: z.boolean(),
  items: z.array(OnboardingItem),
});

export const BILLING_CYCLES = ["MONTHLY", "QUARTERLY", "HALF_YEARLY"] as const;
export const ROUNDING_RULES = ["NEAREST_RUPEE", "UP_RUPEE", "NONE"] as const;

export const BillingConfig = z.object({
  cycle: z.enum(BILLING_CYCLES),
  generationDay: z.number().int().min(1).max(28),
  dueDay: z.number().int().min(1).max(28),
  graceDays: z.number().int().min(0).max(60),
  /** Basis points of simple interest per annum, e.g. 1200 = 12%. */
  interestRateBps: z.number().int().min(0),
  interestResolution: ResolutionRef.nullable(),
  roundingRule: z.enum(ROUNDING_RULES),
  billNumberFormat: z.string().min(3).max(60),
  receiptNumberFormat: z.string().min(3).max(60),
  allowPartialPayment: z.boolean(),
  allocationOrder: z.array(z.enum(["INTEREST", "ARREARS", "CURRENT"])).length(3),
  effectiveFromPeriod: z.string().regex(/^\d{4}-\d{2}$/).nullable(),
  updatedAt: IsoDateTime.nullable(),
});
export type BillingConfig = z.infer<typeof BillingConfig>;

export const UpdateBillingConfigBody = BillingConfig.omit({ updatedAt: true, effectiveFromPeriod: true }).partial();

export const BANK_PURPOSES = ["OPERATIONS", "SINKING", "REPAIR", "OTHER"] as const;
export const BANK_ACCOUNT_TYPES = ["SAVINGS", "CURRENT"] as const;

export const BankAccount = z.object({
  id: Id,
  bankName: z.string(),
  accountName: z.string(),
  accountNumberMasked: z.string(),
  ifsc: z.string(),
  type: z.enum(BANK_ACCOUNT_TYPES),
  purpose: z.enum(BANK_PURPOSES),
  openingBalancePaise: Paise,
  openingBalanceDate: IsoDate.nullable(),
  vanPrefix: z.string().nullable(),
  active: z.boolean(),
});

export const CreateBankAccountBody = z.object({
  bankName: z.string().trim().min(2).max(100),
  accountName: z.string().trim().min(2).max(150),
  accountNumber: z.string().trim().regex(/^\d{6,20}$/, { error: "Account number is 6–20 digits" }),
  ifsc: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, { error: "Not a valid IFSC" }),
  type: z.enum(BANK_ACCOUNT_TYPES),
  purpose: z.enum(BANK_PURPOSES),
  openingBalancePaise: Paise.default(0),
  openingBalanceDate: IsoDate.nullable().optional(),
  vanPrefix: z.string().trim().max(20).nullable().optional(),
});
export const UpdateBankAccountBody = CreateBankAccountBody.omit({ accountNumber: true })
  .partial()
  .extend({ active: z.boolean().optional() });

export const StatutoryConfigEntry = z.object({
  id: Id,
  key: z.string(),
  value: z.string(),
  unit: z.string().nullable(),
  effectiveFrom: IsoDate,
  effectiveTo: IsoDate.nullable(),
  sourceReference: z.string().nullable(),
  ruleCitation: z.string().nullable(),
  verifiedOn: IsoDate.nullable(),
  resolution: ResolutionRef.nullable(),
  scope: z.enum(["PLATFORM", "SOCIETY"]),
});

export const SetStatutoryConfigBody = z.object({
  key: z.string().trim().min(2).max(60),
  value: z.string().trim().min(1).max(200),
  effectiveFrom: IsoDate,
  resolution: ResolutionRef.nullable().optional(),
  note: z.string().trim().max(300).optional(),
});
