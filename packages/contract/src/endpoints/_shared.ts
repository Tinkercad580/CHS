import type { Access } from "../define";
import type { Permission } from "../permissions";

/** Society-scoped path, typed as a literal so path params stay inferable. */
export const sp = <P extends string>(p: P): `/societies/:societyId${P}` => `/societies/:societyId${p}`;

export const inSociety = (permission?: Permission | readonly Permission[]): Access =>
  permission ? { kind: "society", permission } : { kind: "society" };
