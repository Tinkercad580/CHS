import { z } from "zod";
import { endpoint } from "../define";
import * as A from "../schemas/auth";
import { Ok } from "../schemas/common";
import * as P from "../schemas/platform";

export const health = {
  live: endpoint({ method: "GET", path: "/health", summary: "Liveness and dependency checks", access: { kind: "public" }, response: P.Health }),
};

export const auth = {
  lookup: endpoint({
    method: "POST",
    path: "/auth/lookup",
    summary: "Decide the next sign-in screen for a mobile number",
    access: { kind: "public" },
    rateLimit: "auth",
    body: A.LookupBody,
    response: A.LookupResult,
  }),
  activate: endpoint({
    method: "POST",
    path: "/auth/activate",
    summary: "First sign-in: create a password for an admin-added number",
    access: { kind: "public" },
    rateLimit: "auth",
    body: A.ActivateBody,
    response: A.LoginResult,
  }),
  login: endpoint({
    method: "POST",
    path: "/auth/login",
    summary: "Sign in with mobile and password",
    access: { kind: "public" },
    rateLimit: "auth",
    body: A.LoginBody,
    response: A.LoginResult,
  }),
  verifyTwoFactor: endpoint({
    method: "POST",
    path: "/auth/2fa/verify",
    summary: "Complete an admin sign-in with a TOTP code",
    access: { kind: "public" },
    rateLimit: "auth",
    body: A.TwoFactorVerifyBody,
    response: A.LoginResult,
  }),
  refresh: endpoint({
    method: "POST",
    path: "/auth/refresh",
    summary: "Rotate the refresh token and issue a new access token",
    access: { kind: "public" },
    rateLimit: "sensitive",
    body: A.RefreshBody,
    response: A.TokenPair,
  }),
  logout: endpoint({
    method: "POST",
    path: "/auth/logout",
    summary: "End this session",
    access: { kind: "authenticated" },
    allowRestricted: true,
    body: A.LogoutBody,
    response: Ok,
  }),
  forcedChange: endpoint({
    method: "POST",
    path: "/auth/forced-change",
    summary: "Replace a temporary password; returns a full session",
    access: { kind: "authenticated" },
    allowRestricted: true,
    rateLimit: "sensitive",
    body: A.ForcedChangeBody,
    response: A.LoginResult,
  }),
};

export const me = {
  get: endpoint({ method: "GET", path: "/me", summary: "The signed-in user and their societies", access: { kind: "authenticated" }, response: A.Me }),
  update: endpoint({
    method: "PATCH",
    path: "/me",
    summary: "Update own name, email or language",
    access: { kind: "authenticated" },
    body: A.UpdateMeBody,
    response: A.Me,
    invalidates: ["me.get", "notifications.preferences"],
  }),
  changePassword: endpoint({
    method: "POST",
    path: "/me/password",
    summary: "Change password; every other session is signed out",
    access: { kind: "authenticated" },
    rateLimit: "sensitive",
    body: A.ChangePasswordBody,
    response: Ok,
    invalidates: ["me.sessions"],
  }),
  sessions: endpoint({ method: "GET", path: "/me/sessions", summary: "Own active sessions", access: { kind: "authenticated" }, response: z.array(A.Session) }),
  revokeSession: endpoint({
    method: "DELETE",
    path: "/me/sessions/:sessionId",
    summary: "Sign out one device",
    access: { kind: "authenticated" },
    response: Ok,
    invalidates: ["me.sessions"],
  }),
  logoutAll: endpoint({
    method: "POST",
    path: "/me/logout-all",
    summary: "Sign out every device, this one included",
    access: { kind: "authenticated" },
    response: Ok,
  }),
  twoFactorSetup: endpoint({
    method: "POST",
    path: "/me/2fa/setup",
    summary: "Start TOTP enrolment (admins)",
    access: { kind: "authenticated" },
    response: A.TwoFactorSetup,
  }),
  twoFactorEnable: endpoint({
    method: "POST",
    path: "/me/2fa/enable",
    summary: "Confirm TOTP enrolment with a code",
    access: { kind: "authenticated" },
    body: A.TwoFactorCodeBody,
    response: Ok,
    invalidates: ["me.get"],
  }),
  twoFactorDisable: endpoint({
    method: "POST",
    path: "/me/2fa/disable",
    summary: "Turn TOTP off (needs a current code)",
    access: { kind: "authenticated" },
    body: A.TwoFactorCodeBody,
    response: Ok,
    invalidates: ["me.get"],
  }),
};
