import { useRef, useState, type ReactNode } from "react";
import { ApiError } from "@chs/api-client";
import type { ImportReport } from "@chs/contract";
import { cellStyle, monoCell, rowBorder } from "../lib/uiStyles";
import { Blurb, DataTable, Note } from "./Kit";
import { FormError } from "./FormFields";
import { GhostButton, ModalFooter, ModalHeader, ModalShell, PrimaryButton } from "./ModalShell";

/** The server decodes at most 5 MB; refuse a bigger file before reading it into memory. */
const MAX_BYTES = 5 * 1024 * 1024;

type Format = "csv" | "xlsx";

function formatOf(name: string): Format | null {
  const ext = name.toLowerCase().split(".").pop();
  return ext === "csv" ? "csv" : ext === "xlsx" ? "xlsx" : null;
}

/** The file as base64, without the `data:…;base64,` prefix FileReader adds. */
function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = typeof r.result === "string" ? r.result : "";
      resolve(s.slice(s.indexOf(",") + 1));
    };
    r.onerror = () => reject(r.error ?? new Error("The file could not be read."));
    r.readAsDataURL(file);
  });
}

/**
 * A CSV / XLSX import with a dry run first (`users.import`,
 * `structure.importUnits`, both taking ImportBody). The admin picks a file,
 * the server checks every row and reports per-row errors without writing
 * anything; only then is "Import N" offered, which sends the same file with
 * `dryRun: false`. The server imports all or nothing — a file with any bad
 * row imports none — so the import is offered only for a clean file, and
 * otherwise the rows to fix are listed.
 */
export function ImportModal({
  title,
  blurb,
  columns,
  noun,
  run,
  onClose,
}: {
  title: string;
  blurb: ReactNode;
  /** The header row the server expects, required columns first. */
  columns: { name: string; required?: boolean; hint: string }[];
  /** "user" / "unit": pluralised with "s". */
  noun: string;
  run: (body: { format: Format; contentBase64: string; dryRun: boolean }) => Promise<ImportReport>;
  onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; format: Format; content: string } | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState<"check" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const plural = (n: number) => `${n} ${noun}${n === 1 ? "" : "s"}`;

  const pick = async (f: File | undefined) => {
    setError(null);
    setReport(null);
    setFile(null);
    if (!f) return;
    const format = formatOf(f.name);
    if (!format) {
      setError("Choose a .csv or .xlsx file.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError("The file is over 5 MB. Split it into smaller files.");
      return;
    }
    try {
      setFile({ name: f.name, format, content: await readBase64(f) });
    } catch {
      setError("The file could not be read. Try saving it again.");
    }
  };

  const send = async (dryRun: boolean) => {
    if (!file || busy) return;
    setBusy(dryRun ? "check" : "import");
    setError(null);
    try {
      const r = await run({ format: file.format, contentBase64: file.content, dryRun });
      setReport(r);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  };

  // A commit that found problems (the data changed since the check) imported nothing and lists them like a check.
  const done = report && !report.dryRun && report.errors.length === 0;

  return (
    <ModalShell onClose={busy ? () => undefined : onClose} maxWidth={680}>
      <ModalHeader title={title} onClose={onClose} />
      <Blurb>{blurb}</Blurb>

      <div style={{ border: "1px solid var(--border,#E3E9E6)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
        <DataTable
          cols={[{ label: "Column" }, { label: "What goes in it" }]}
          rows={{ status: "ready", data: columns }}
          minWidth={420}
          empty=""
          renderRow={(c) => (
            <tr key={c.name} style={rowBorder}>
              <td style={cellStyle("left", monoCell)}>
                {c.name}
                {c.required && <span style={{ marginLeft: 6, font: "500 11px/1 Figtree, sans-serif", color: "var(--ink-muted,#8A9995)" }}>required</span>}
              </td>
              <td style={cellStyle("left", { color: "var(--ink-soft,#5A6B66)", font: "400 12.5px/1.45 Figtree, sans-serif" })}>{c.hint}</td>
            </tr>
          )}
        />
      </div>

      {!done && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <input ref={input} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-label="File to import" onChange={(e) => void pick(e.target.files?.[0])} style={{ display: "none" }} />
          <GhostButton onClick={() => input.current?.click()} disabled={Boolean(busy)}>
            {file ? "Choose another file" : "Choose file"}
          </GhostButton>
          <span style={{ font: "500 13px/1.4 Figtree, sans-serif", color: file ? "var(--ink,#0F1A17)" : "var(--ink-muted,#8A9995)", overflowWrap: "anywhere" }}>{file ? file.name : "CSV or Excel (.xlsx), up to 5 MB"}</span>
        </div>
      )}

      {report && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 6 }}>
          <Note kind={done ? "ok" : report.errors.length ? "warn" : "info"}>
            {done
              ? `Imported ${plural(report.created)}.`
              : report.errors.length
                ? `Checked ${report.total} row${report.total === 1 ? "" : "s"}: ${report.errors.length} with problems. Nothing is imported while any row has one — fix them in the file and check it again.`
                : `Checked ${report.total} row${report.total === 1 ? "" : "s"}: all ${report.valid} ready to import. Nothing has been saved yet.`}
          </Note>
          {report.errors.length > 0 && (
            <div style={{ border: "1px solid var(--border,#E3E9E6)", borderRadius: 12, overflow: "hidden", maxHeight: 260, overflowY: "auto" }}>
              <DataTable
                cols={[{ label: "Row" }, { label: "Column" }, { label: "Problem" }]}
                rows={{ status: "ready", data: report.errors }}
                minWidth={420}
                empty=""
                renderRow={(e, i) => (
                  <tr key={`${e.row}-${i}`} style={rowBorder}>
                    <td style={cellStyle("left", monoCell)}>{e.row}</td>
                    <td style={cellStyle("left", monoCell)}>{e.field ?? "—"}</td>
                    <td style={cellStyle("left", { font: "400 12.5px/1.45 Figtree, sans-serif" })}>{e.message}</td>
                  </tr>
                )}
              />
            </div>
          )}
        </div>
      )}

      <FormError message={error} />

      <ModalFooter>
        {done ? (
          <PrimaryButton onClick={onClose}>Done</PrimaryButton>
        ) : (
          <>
            <GhostButton onClick={onClose} disabled={Boolean(busy)}>
              Cancel
            </GhostButton>
            {report?.dryRun && report.valid > 0 && report.errors.length === 0 ? (
              <PrimaryButton busy={busy === "import"} busyLabel="Importing…" disabled={busy === "check"} onClick={() => void send(false)}>
                Import {plural(report.valid)}
              </PrimaryButton>
            ) : (
              <PrimaryButton busy={busy === "check"} busyLabel="Checking rows…" disabled={!file} onClick={() => void send(true)}>
                Check file
              </PrimaryButton>
            )}
          </>
        )}
      </ModalFooter>
    </ModalShell>
  );
}
