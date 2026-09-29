"use client";

import { useEffect, useState } from "react";

type Crit = { criterion: string; score: number; weight: number; reason: string };
type Row = {
  id: string; rank: number; above_line: boolean;
  name: string | null; email: string | null; location: string | null; file_name: string;
  applied_role: string; score: number; breakdown: Crit[];
  other_role: string | null; other_score: number;
  brief: string | null; email_type: string | null;
  email_subject: string; email_body: string; email_sent_at: string | null; sent_to: string | null;
};

function Ring({ value }: { value: number }) {
  const R = 34;
  const C = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  return (
    <div className="ring">
      <svg viewBox="0 0 84 84">
        {/* the ring is the one place a gradient is worth the markup — it is the
            first thing Arjun's eye lands on, and a flat stroke read as a chart
            axis rather than a score. */}
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--blue-400)" />
            <stop offset="100%" stopColor="var(--brand)" />
          </linearGradient>
        </defs>
        <circle className="track" cx="42" cy="42" r={R} fill="none" strokeWidth="7" />
        <circle
          className="fill"
          cx="42" cy="42" r={R} fill="none" strokeWidth="7"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - pct)}
        />
      </svg>
      <div className="val">
        <b className="tnum">{value.toFixed(0)}</b>
        <span>/100</span>
      </div>
    </div>
  );
}

function toneFor(score: number) {
  if (score >= 60) return "good";
  if (score >= 35) return "warn";
  return "crit";
}

export default function Dashboard() {
  const [role, setRole] = useState<"PM" | "SPM">("PM");
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<any>({});
  const [open, setOpen] = useState<string | null>(null);
  const [edit, setEdit] = useState<Record<string, { to: string; subject: string; body: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: string; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/candidates?role=${role}`);
    const j = await r.json();
    setRows(j.rows || []);
    setCounts(j.counts || {});
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [role]);

  async function refreshDrafts() {
    setBusy("refresh");
    setMsg({ tone: "", text: "Recomputing the line and filling in missing drafts…" });
    for (let i = 0; i < 30; i++) {
      const r = await fetch("/api/finalize", { method: "POST", body: JSON.stringify({ limit: 6 }) });
      const j = await r.json();
      if (j.error) { setMsg({ tone: "crit", text: j.error }); break; }
      setMsg({ tone: "", text: `Drafted ${j.generated}, ${j.remaining} remaining…` });
      if (!j.remaining) { setMsg({ tone: "good", text: "All drafts up to date." }); break; }
    }
    setBusy(null);
    load();
  }

  async function send(row: Row) {
    const e = edit[row.id] || { to: row.email || "", subject: row.email_subject, body: row.email_body };
    setConfirming(null);
    setBusy(row.id);
    setMsg(null);
    const r = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, to: e.to, subject: e.subject, body: e.body }),
    });
    const j = await r.json();
    setBusy(null);
    setMsg(
      j.ok
        ? { tone: "good", text: j.redirected ? `Sent to test inbox ${j.to} (intended ${j.intended}).` : `Sent to ${j.to}.` }
        : { tone: "crit", text: `Send failed: ${j.error}` }
    );
    load();
  }

  const roleName = role === "PM" ? "Product Manager" : "Senior Product Manager";
  const top = rows[0];

  return (
    <div className="fade-in">
      <h1 className="h1">Shortlist</h1>
      <p className="lede">
        Ranked against the {roleName} rubric. The system recommends and explains; you decide. Nothing goes out
        until you confirm it on a card.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <div className="seg">
          <button data-on={role === "PM" ? "1" : "0"} onClick={() => setRole("PM")}>Product Manager</button>
          <button data-on={role === "SPM" ? "1" : "0"} onClick={() => setRole("SPM")}>Senior PM</button>
        </div>
        <div style={{ flex: 1 }} />
        <button className="ghost" onClick={refreshDrafts} disabled={!!busy}>
          {busy === "refresh" && <span className="spinner" />}
          {busy === "refresh" ? "Working…" : "Refresh drafts"}
        </button>
      </div>

      {top && (
        <div className="card hero">
          <Ring value={top.score} />
          <div className="copy">
            <h2>{top.name || top.file_name} leads the {roleName} list</h2>
            <p>
              {counts.total} applicant{counts.total === 1 ? "" : "s"} scored against the rubric.{" "}
              {counts.shortlisted} above the line, {counts.drafted} with drafts ready, {counts.sent} sent.
            </p>
          </div>
        </div>
      )}

      <div className="tiles">
        <div className="card tile"><div className="k"><i /> Applicants</div><div className="v tnum">{counts.total ?? 0}</div></div>
        <div className="card tile"><div className="k"><i data-tone="good" /> Above the line</div><div className="v tnum">{counts.shortlisted ?? 0}</div></div>
        <div className="card tile"><div className="k"><i data-tone="warn" /> Drafts ready</div><div className="v tnum">{counts.drafted ?? 0}</div></div>
        <div className="card tile"><div className="k"><i data-tone="mute" /> Sent</div><div className="v tnum">{counts.sent ?? 0}</div></div>
      </div>

      {msg && (
        <div className="banner" data-tone={msg.tone} style={{ marginTop: 14 }}>
          {msg.text}
        </div>
      )}

      <div className="sechead">Ranked candidates</div>

      {loading && <>{[0, 1, 2, 3].map((i) => <div className="skel" key={i} />)}</>}
      {!loading && !rows.length && <p className="note">No applications for this role yet.</p>}

      <div className="rows">
        {rows.map((r, i) => {
          const isOpen = open === r.id;
          const e = edit[r.id] || { to: r.email || "", subject: r.email_subject, body: r.email_body };
          const crossover = r.other_role && r.other_score > r.score + 5;
          return (
            <div key={r.id}>
              {i === counts.shortlisted && rows.length > counts.shortlisted && (
                <div className="linemark">below the line</div>
              )}
              <div className="row-item" data-open={isOpen ? "1" : "0"} data-top={r.above_line ? "1" : "0"} style={{ ["--i" as any]: i }}>
                <button className="row-head" onClick={() => setOpen(isOpen ? null : r.id)} aria-expanded={isOpen}>
                  <span className="rank tnum">{r.rank}</span>
                  <span className="who">
                    <b>{r.name || r.file_name}</b>
                    <span>{[r.location, r.file_name].filter(Boolean).join(" · ")}</span>
                  </span>
                  {crossover && <span className="chip" data-tone="cross">stronger as {r.other_role}</span>}
                  {r.email_sent_at ? (
                    <span className="chip" data-tone="sent">sent</span>
                  ) : r.email_type ? (
                    <span className="chip" data-tone={r.email_type}>
                      {r.email_type === "invite" ? "invite drafted" : "rejection drafted"}
                    </span>
                  ) : (
                    <span className="chip">no draft</span>
                  )}
                  <span className="score">
                    <b>{r.score.toFixed(1)}</b>
                    <span>/100</span>
                  </span>
                  <svg className="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>

                <div className="panel-wrap">
                  <div className="panel-inner">
                    <div className="panel">
                      <div>
                        <div className="sechead" style={{ marginTop: 0 }}>Why this rank</div>
                        <div className="crit">
                          {r.breakdown.map((b) => (
                            <div className="c" key={b.criterion}>
                              <span className="cn">{b.criterion}</span>
                              <span className="cv">{b.score}/10 · {b.weight}%</span>
                              <div className="meter"><i style={{ ["--w" as any]: `${b.score * 10}%` }} /></div>
                              <span className="cw">{b.reason}</span>
                            </div>
                          ))}
                        </div>

                        {r.other_role && (
                          <div className="insight card" data-tone={crossover ? "warn" : "good"} style={{ marginTop: 18 }}>
                            <span className="ico">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2v20M2 12h20" />
                              </svg>
                            </span>
                            <div>
                              <h4>As {r.other_role}: {r.other_score.toFixed(1)}</h4>
                              <p>
                                {crossover
                                  ? `Scores materially higher against the ${r.other_role} rubric than the role applied for. Worth a look before passing.`
                                  : "Scored against the other rubric too — no material difference."}
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="sechead">Interview brief</div>
                        <div className="brief">
                          {r.brief || <span className="note">Not generated yet — press Refresh drafts.</span>}
                        </div>

                        <p className="note" style={{ marginTop: 12 }}>
                          Contact on file: {r.email || "—"}
                        </p>
                      </div>

                      <div>
                        <div className="sechead" style={{ marginTop: 0 }}>
                          Draft {r.email_type === "invite" ? "interview invite" : "rejection"}
                        </div>
                        <label className="fld" htmlFor={`t-${r.id}`}>To</label>
                        <input
                          id={`t-${r.id}`}
                          type="text"
                          inputMode="email"
                          placeholder="name@company.com"
                          value={e.to}
                          disabled={!!r.email_sent_at}
                          onChange={(ev) => setEdit({ ...edit, [r.id]: { ...e, to: ev.target.value } })}
                        />
                        <p className="note" style={{ marginTop: 5 }}>
                          {r.email
                            ? e.to.trim() && e.to.trim() !== r.email
                              ? `Overriding the address on the CV (${r.email}). This goes exactly where you type it.`
                              : "Taken from the CV. Change it and the email goes to the address you type."
                            : "No address was found on this CV — type one to send."}
                        </p>
                        <label className="fld" htmlFor={`s-${r.id}`} style={{ marginTop: 12 }}>Subject</label>
                        <input
                          id={`s-${r.id}`}
                          type="text"
                          value={e.subject}
                          disabled={!!r.email_sent_at}
                          onChange={(ev) => setEdit({ ...edit, [r.id]: { ...e, subject: ev.target.value } })}
                        />
                        <label className="fld" htmlFor={`b-${r.id}`} style={{ marginTop: 12 }}>Body</label>
                        <textarea
                          id={`b-${r.id}`}
                          rows={15}
                          value={e.body}
                          disabled={!!r.email_sent_at}
                          onChange={(ev) => setEdit({ ...edit, [r.id]: { ...e, body: ev.target.value } })}
                        />

                        {confirming === r.id ? (
                          <div className="banner" data-tone="crit" style={{ marginTop: 12, flexDirection: "column", gap: 10 }}>
                            <span>
                              Send this {r.email_type} to {r.name} &lt;{e.to.trim() || r.email}&gt;? This cannot be undone.
                            </span>
                            <span style={{ display: "flex", gap: 8 }}>
                              <button onClick={() => send(r)}>Yes, send it</button>
                              <button className="ghost" onClick={() => setConfirming(null)}>Cancel</button>
                            </span>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
                            {r.email_sent_at ? (
                              <span className="chip" data-tone="sent">
                                sent {new Date(r.email_sent_at).toLocaleString()}
                              </span>
                            ) : (
                              <button
                                onClick={() => setConfirming(r.id)}
                                disabled={busy === r.id || !r.email_body || !(e.to.trim() || r.email)}
                                className={r.email_type === "rejection" ? "ghost" : ""}
                              >
                                {busy === r.id && <span className="spinner" />}
                                {busy === r.id ? "Sending…" : `Confirm and send ${r.email_type}`}
                              </button>
                            )}
                            <span className="note">
                              {r.email_sent_at
                                ? `Delivered to ${r.sent_to || r.email}`
                                : `Will send to ${e.to.trim() || r.email || "— no address yet"}`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
