import { z } from "zod";

export const Id = z.uuid();
export const IsoDateTime = z.iso.datetime({ offset: true });
export const IsoDate = z.iso.date();

/** Indian mobile, stored and compared as the 10-digit national number. */
export const Mobile = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, "").replace(/^(\+91|0091|91(?=\d{10}$)|0(?=\d{10}$))/, ""))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, { error: "Enter a 10-digit Indian mobile number" }));

export const Email = z.email().trim().toLowerCase();

/** Money crosses the wire as integer paise. Never a float, never rupees. */
export const Paise = z.number().int().safe();

export const Language = z.enum(["en", "mr"]);

export const Cursor = z.string().min(1).max(200);

export const ListQuery = z.object({
  cursor: Cursor.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  q: z.string().trim().max(100).optional(),
});

export function Page<T extends z.ZodType>(item: T) {
  // `total` counts every match of the filter, across pages; null where counting would be too costly.
  return z.object({ items: z.array(item), nextCursor: z.string().nullable(), total: z.number().int().nullable().default(null) });
}

export const Ok = z.object({ ok: z.literal(true) });

/**
 * A general body resolution reference. Setting the interest rate or drawing on
 * the sinking fund is a general body decision, not a committee one; the save
 * is refused without one (MASTER_SPEC A1.2, B3.1).
 */
export const ResolutionRef = z.object({
  meetingRef: z.string().trim().min(1).max(100),
  resolvedOn: IsoDate,
});
