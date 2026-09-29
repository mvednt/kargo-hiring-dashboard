"use client";

import { useState } from "react";

type Res = { file: string; ok: boolean; name?: string; pm?: number; spm?: number; error?: string };

export default function Upload() {
  const [role, setRole] = useState<"PM" | "SPM">("PM");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [results, setResults] = useState<Res[]>([]);

  const say = (s: string) => setLog((l) => [...l, s]);

  async function run() {
    if (!files.length) return;
    setBusy(true);
    setResults([]);
    setLog([]);

    const BATCH = 3;
    const all: Res[] = [];
    say(`Uploading ${files.length} file(s) as ${role}.`);

    for (let i = 0; i < files.length; i += BATCH) {
      const chunk = files.slice(i, i + BATCH);
      const fd = new FormData();
      fd.append("role", role);
      chunk.forEach((f) => fd.append("files", f));
      say(`  extracting + scoring ${i + 1}–${Math.min(i + BATCH, files.length)}…`);
      try {
        const r = await fetch("/api/upload", { method: "POST", body: fd });
        const j = await r.json();
        if (j.error) say(`  ! ${j.error}`);
        (j.results || []).forEach((x: Res) => {
          all.push(x);
          say(x.ok ? `  ok  ${x.file} — PM ${x.pm} / SPM ${x.spm}` : `  ERR ${x.file} — ${x.error}`);
        });
        setResults([...all]);
      } catch (e: any) {
        say(`  ! ${e.message}`);
      }
    }

    say("Recomputing the shortlist and drafting briefs + emails…");
    for (let pass = 0; pass < 24; pass++) {
      const r = await fetch("/api/finalize", { method: "POST", body: JSON.stringify({ limit: 8 }) });
      const j = await r.json();
      if (j.error) { say(`  ! ${j.error}`); break; }
      say(`  drafted ${j.generated}, ${j.remaining} remaining`);
      (j.errors || []).forEach((e: any) => say(`  ! draft failed: ${e.error}`));
      if (!j.remaining) break;
    }
    say("Done. Nothing has been sent — open the dashboard to review.");
    setBusy(false);
  }

  return (
    <>
      <h1>Upload applications</h1>
      <p className="sub">
        Personal details are pulled out and stored separately before anything reaches a model. No email is
        sent from this page.
      </p>

      <div className="panel" style={{ display: "grid", gap: 12 }}>
        <div>
          <label className="fld">Role applied for</label>
          <select value={role} onChange={(e) => setRole(e.target.value as any)} disabled={busy}>
            <option value="PM">Product Manager</option>
            <option value="SPM">Senior Product Manager</option>
          </select>
        </div>

        <div>
          <label className="fld">CV files — pdf, docx or txt</label>
          <input
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.md"
            disabled={busy}
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
        </div>

        <div className="row">
          <button onClick={run} disabled={busy || !files.length}>
            {busy ? "Processing…" : `Process ${files.length || ""} file${files.length === 1 ? "" : "s"}`}
          </button>
          <span className="note">
            Every candidate is scored against both the PM and the SPM rubric, whichever role they picked.
          </span>
        </div>
      </div>

      {log.length > 0 && (
        <>
          <div className="divider" />
          <h2>Run log</h2>
          <div className="panel log">{log.join("\n")}</div>
        </>
      )}

      {results.length > 0 && !busy && (
        <p style={{ marginTop: 14 }}>
          <a className="btn" href="/dashboard" style={{ textDecoration: "none" }}>
            Open dashboard →
          </a>
        </p>
      )}
    </>
  );
}
