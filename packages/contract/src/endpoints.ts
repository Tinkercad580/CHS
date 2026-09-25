import { defineApi } from "./define";
import { auth, health, me } from "./endpoints/auth";
import { billing } from "./endpoints/billing";
import { members } from "./endpoints/members";
import { notices } from "./endpoints/notices";
import { notifications } from "./endpoints/notifications";
import { payments } from "./endpoints/payments";
import { platform } from "./endpoints/platform";
import { reports } from "./endpoints/reports";
import { society } from "./endpoints/society";
import { structure } from "./endpoints/structure";
import { users } from "./endpoints/users";

/**
 * Every endpoint of the API, in one place.
 *
 * The backend binds a handler to each entry and gets validation, access
 * control, auditing context and the response envelope from the entry itself.
 * Clients derive their typed calls, React Query keys and cache invalidation
 * from the same entries. Adding an endpoint means adding it here first.
 *
 * Paths are relative to `/api/v1`.
 */

export const api = defineApi({
  health,
  auth,
  me,
  notifications,
  users,
  society,
  structure,
  members,
  notices,
  billing,
  payments,
  reports,
  platform,
});

export type Api = typeof api;
