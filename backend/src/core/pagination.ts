import { AppError } from "./errors";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Cursor pagination. The cursor is the id of the last row returned; Prisma
 * resumes from that row's position in whatever ordering the query uses, so
 * pages stay stable while rows are added. One extra row is fetched to know
 * whether there is a next page.
 */
export async function paginate<T extends { id: string }, R>(
  limit: number,
  cursor: string | undefined,
  fetch: (args: { take: number; skip?: number; cursor?: { id: string } }) => Promise<T[]>,
  map: (row: T) => R,
  count?: () => Promise<number>,
): Promise<{ items: R[]; nextCursor: string | null; total: number | null }> {
  if (cursor && !UUID.test(cursor)) throw new AppError("VALIDATION_FAILED", "Invalid cursor.");
  const [rows, total] = await Promise.all([
    fetch({ take: limit + 1, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}) }),
    count ? count() : Promise.resolve(null),
  ]);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return { items: page.map(map), nextCursor: hasMore ? page[page.length - 1]!.id : null, total };
}

/** Case-insensitive contains, for `q` filters. */
export function contains(q: string | undefined) {
  return q ? { contains: q, mode: "insensitive" as const } : undefined;
}
