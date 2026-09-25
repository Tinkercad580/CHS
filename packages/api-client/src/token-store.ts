import type { TokenPair } from "@chs/contract";

/**
 * Where the session lives. The web uses localStorage; the mobile apps pass an
 * adapter over expo-secure-store. Reads are synchronous because every request
 * needs the access token; `hydrate` lets an async store load once at start.
 */
export interface TokenStore {
  get(): TokenPair | null;
  set(tokens: TokenPair | null): void;
  hydrate?(): Promise<void>;
}

export function memoryTokenStore(initial: TokenPair | null = null): TokenStore {
  let tokens = initial;
  return { get: () => tokens, set: (t) => void (tokens = t) };
}

export function localStorageTokenStore(key = "chs.session"): TokenStore {
  let cache: TokenPair | null | undefined;
  const read = (): TokenPair | null => {
    try {
      const raw = globalThis.localStorage?.getItem(key);
      return raw ? (JSON.parse(raw) as TokenPair) : null;
    } catch {
      return null;
    }
  };
  return {
    get: () => (cache === undefined ? (cache = read()) : cache),
    set: (t) => {
      cache = t;
      try {
        if (t) globalThis.localStorage?.setItem(key, JSON.stringify(t));
        else globalThis.localStorage?.removeItem(key);
      } catch {
        // Private mode or blocked storage: the session lasts as long as the tab.
      }
    },
  };
}

/** Wraps an async key-value store (expo-secure-store) behind the sync interface. */
export function asyncTokenStore(backend: {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}, key = "chs.session"): TokenStore {
  let cache: TokenPair | null = null;
  return {
    get: () => cache,
    set: (t) => {
      cache = t;
      void (t ? backend.setItem(key, JSON.stringify(t)) : backend.deleteItem(key)).catch(() => undefined);
    },
    hydrate: async () => {
      try {
        const raw = await backend.getItem(key);
        cache = raw ? (JSON.parse(raw) as TokenPair) : null;
      } catch {
        cache = null;
      }
    },
  };
}
