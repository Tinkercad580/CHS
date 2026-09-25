import { endpoint } from "../define";
import { Page, ListQuery } from "../schemas/common";
import * as P from "../schemas/platform";

export const platform = {
  societies: endpoint({
    method: "GET",
    path: "/platform/societies",
    summary: "All societies on the platform",
    access: { kind: "platform" },
    query: ListQuery,
    response: Page(P.PlatformSociety),
  }),
  createSociety: endpoint({
    method: "POST",
    path: "/platform/societies",
    summary: "Onboard a society and provision its first admin",
    access: { kind: "platform" },
    body: P.CreateSocietyBody,
    response: P.PlatformSociety,
    invalidates: ["platform.societies"],
  }),
};
