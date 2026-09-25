/**
 * Permission strings — MASTER_SPEC A1.1.
 *
 * Two roles exist (ADMIN, USER). What either can do is the set of permissions
 * on their society membership. Admin permissions let several admins share a
 * society with different scope (a treasurer without gate management).
 */

export const USER_PERMISSIONS = [
  "bills.view",
  "payments.pay",
  "ledger.view",
  "helpdesk.create",
  "helpdesk.resolve",
  "gate.operate",
  "visitor.approve",
  "notices.view",
  "documents.view",
  "meetings.vote",
  "amenities.book",
  "requests.raise",
  "accounts.view",
  "accounts.edit",
  "staff.attendance",
  "reports.view",
] as const;

export const ADMIN_PERMISSIONS = [
  "society.configure",
  "members.manage",
  "billing.generate",
  "billing.publish",
  "payments.record",
  "accounts.manage",
  "accounts.close",
  "recovery.notice",
  "helpdesk.manage",
  "gate.manage",
  "notices.publish",
  "meetings.manage",
  "documents.manage",
  "requests.approve",
  "compliance.manage",
  "users.manage",
  "audit.view",
] as const;

export const ALL_PERMISSIONS = [...USER_PERMISSIONS, ...ADMIN_PERMISSIONS] as const;

export type UserPermission = (typeof USER_PERMISSIONS)[number];
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];
export type Permission = UserPermission | AdminPermission;

export const ROLES = ["ADMIN", "USER"] as const;
export type Role = (typeof ROLES)[number];

/** Display and reporting label only — never an access decision. */
export const USER_TYPES = [
  "OWNER",
  "CO_OWNER",
  "FAMILY",
  "TENANT",
  "GUARD",
  "STAFF",
  "ACCOUNTANT",
  "AUDITOR",
  "COMMITTEE",
  "MANAGER",
] as const;
export type UserType = (typeof USER_TYPES)[number];

export function isAdminPermission(p: string): p is AdminPermission {
  return (ADMIN_PERMISSIONS as readonly string[]).includes(p);
}

export function isPermission(p: string): p is Permission {
  return (ALL_PERMISSIONS as readonly string[]).includes(p);
}

export interface PermissionTemplateSeed {
  code: string;
  name: string;
  role: Role;
  userType: UserType;
  permissions: readonly Permission[];
}

const OWNER: readonly Permission[] = [
  "bills.view",
  "payments.pay",
  "ledger.view",
  "helpdesk.create",
  "visitor.approve",
  "notices.view",
  "documents.view",
  "requests.raise",
  "meetings.vote",
  "amenities.book",
];

/** Platform defaults, copied into each society on creation and editable there. */
export const DEFAULT_PERMISSION_TEMPLATES: readonly PermissionTemplateSeed[] = [
  { code: "OWNER", name: "Owner", role: "USER", userType: "OWNER", permissions: OWNER },
  {
    code: "CO_OWNER",
    name: "Co-owner",
    role: "USER",
    userType: "CO_OWNER",
    // Same as owner minus voting (and sale NOC, which the requests module gates by membership kind).
    permissions: OWNER.filter((p) => p !== "meetings.vote"),
  },
  {
    code: "FAMILY",
    name: "Family member",
    role: "USER",
    userType: "FAMILY",
    permissions: ["helpdesk.create", "visitor.approve", "notices.view", "amenities.book"],
  },
  {
    code: "TENANT",
    name: "Tenant",
    role: "USER",
    userType: "TENANT",
    permissions: ["bills.view", "payments.pay", "helpdesk.create", "visitor.approve", "notices.view", "amenities.book"],
  },
  { code: "GUARD", name: "Security guard", role: "USER", userType: "GUARD", permissions: ["gate.operate"] },
  {
    code: "STAFF",
    name: "Staff",
    role: "USER",
    userType: "STAFF",
    permissions: ["helpdesk.resolve", "staff.attendance"],
  },
  {
    code: "ACCOUNTANT",
    name: "Accountant",
    role: "USER",
    userType: "ACCOUNTANT",
    permissions: ["accounts.view", "accounts.edit", "reports.view", "ledger.view"],
  },
  {
    code: "AUDITOR",
    name: "Auditor",
    role: "USER",
    userType: "AUDITOR",
    permissions: ["accounts.view", "reports.view"],
  },
  {
    code: "SECRETARY",
    name: "Secretary (full admin)",
    role: "ADMIN",
    userType: "COMMITTEE",
    // Every permission: a full admin must be able to grant any template (you can only grant what you hold).
    permissions: [...ADMIN_PERMISSIONS, ...USER_PERMISSIONS],
  },
  {
    code: "TREASURER",
    name: "Treasurer",
    role: "ADMIN",
    userType: "COMMITTEE",
    permissions: [
      "billing.generate",
      "billing.publish",
      "payments.record",
      "accounts.manage",
      "accounts.close",
      "recovery.notice",
      "audit.view",
      ...OWNER,
    ],
  },
];
