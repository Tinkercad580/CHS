import { z } from "zod";
import { endpoint } from "../define";
import * as A from "../schemas/auth";
import { Ok, Page, ListQuery } from "../schemas/common";
import * as U from "../schemas/users";
import { inSociety, sp } from "./_shared";

export const users = {
  list: endpoint({
    method: "GET",
    path: sp("/users"),
    summary: "Users of this society",
    access: inSociety("users.manage"),
    query: U.UserListQuery,
    response: Page(U.SocietyUser),
  }),
  get: endpoint({ method: "GET", path: sp("/users/:userId"), summary: "One user", access: inSociety("users.manage"), response: U.SocietyUser }),
  create: endpoint({
    method: "POST",
    path: sp("/users"),
    summary: "Add a user by mobile number — the only way anyone gets in",
    access: inSociety("users.manage"),
    idempotent: true,
    body: U.CreateUserBody,
    response: U.SocietyUser,
    invalidates: ["users.list", "society.onboarding"],
  }),
  update: endpoint({
    method: "PATCH",
    path: sp("/users/:userId"),
    summary: "Change a user's details, type or permissions",
    access: inSociety("users.manage"),
    body: U.UpdateUserBody,
    response: U.SocietyUser,
    invalidates: ["users.list", "users.get"],
  }),
  issueTempPassword: endpoint({
    method: "POST",
    path: sp("/users/:userId/temp-password"),
    summary: "Generate a single-use temporary password (24 h)",
    access: inSociety("users.manage"),
    rateLimit: "sensitive",
    // Deliberately not idempotent: a replay would have to store the plain
    // password to return it again. A retry simply issues a fresh one.
    response: U.TempPasswordIssued,
    invalidates: ["users.get", "users.authEvents"],
  }),
  unlock: endpoint({
    method: "POST",
    path: sp("/users/:userId/unlock"),
    summary: "Clear a failed-attempt lockout",
    access: inSociety("users.manage"),
    response: U.SocietyUser,
    invalidates: ["users.list", "users.get", "users.authEvents"],
  }),
  suspend: endpoint({
    method: "POST",
    path: sp("/users/:userId/suspend"),
    summary: "Suspend access to this society and revoke sessions",
    access: inSociety("users.manage"),
    body: U.SuspendBody,
    response: U.SocietyUser,
    invalidates: ["users.list", "users.get", "users.sessions"],
  }),
  reactivate: endpoint({
    method: "POST",
    path: sp("/users/:userId/reactivate"),
    summary: "Restore a suspended user",
    access: inSociety("users.manage"),
    response: U.SocietyUser,
    invalidates: ["users.list", "users.get"],
  }),
  logoutAll: endpoint({
    method: "POST",
    path: sp("/users/:userId/logout-all"),
    summary: "Force sign-out on every device",
    access: inSociety("users.manage"),
    response: Ok,
    invalidates: ["users.sessions"],
  }),
  sessions: endpoint({
    method: "GET",
    path: sp("/users/:userId/sessions"),
    summary: "A user's active sessions",
    access: inSociety("users.manage"),
    response: z.array(A.Session),
  }),
  authEvents: endpoint({
    method: "GET",
    path: sp("/users/:userId/auth-events"),
    summary: "A user's sign-in history",
    access: inSociety("users.manage"),
    query: ListQuery,
    response: Page(A.AuthEvent),
  }),
  import: endpoint({
    method: "POST",
    path: sp("/users/import"),
    summary: "Bulk add users from CSV/XLSX (name, mobile, unit, user_type); dry run first",
    access: inSociety("users.manage"),
    body: U.ImportBody,
    response: U.ImportReport,
    invalidates: ["users.list"],
  }),
  templates: endpoint({
    method: "GET",
    path: sp("/permission-templates"),
    summary: "Permission templates",
    access: inSociety("users.manage"),
    response: z.array(U.PermissionTemplate),
  }),
  upsertTemplate: endpoint({
    method: "PUT",
    path: sp("/permission-templates/:code"),
    summary: "Create or edit a permission template",
    access: inSociety("users.manage"),
    body: U.UpsertPermissionTemplateBody,
    response: U.PermissionTemplate,
    invalidates: ["users.templates"],
  }),
};
