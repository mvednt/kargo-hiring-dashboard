"use client";

import { useEffect, useState } from "react";

type Crit = {
  id: string; role: string; name: string; description: string;
  weight: number; sort_order: number; anchors?: Record<string, string>;
};

const BANDS = ["0-2", "3-4", "5-6", "7-8", "9-10"];

export default function RubricPage() {
  const [role, setRole] = useState<"PM" | "SPM">("PM");
  const [data, setData] = useState<Record<string, Crit[]>>({ PM: [], SPM: [] });
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/rubric")
      .then((r) => r.json())
      .then((j) => { setData(j); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const list = data[role] || [];
  const total = list.reduce((s, c) => s + Number(c.weight), 0);

  return (
    <div className="fade-in">
      <h1 className="h1">The rubric</h1>
      <p className="lede">
        Derived from Kargo&apos;s eight past hires and their performance ratings — not from the job
        descriptions. Every criterion traces to something a named hire actually did.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 18, flexWrap: "wrap" }}>
        <div className="seg">
          <button data-on={role === "PM" ? "1" : "0"} onClick={() => setRole("PM")}>Product Manager</button>
          <button data-on={role === "SPM" ? "1" : "0"} onClick={() => setRole("SPM")}>Senior PM</button>
        </div>
        <div style={{ flex: 1 }} />
        <span className="chip" data-tone={total === 100 ? "invite" : "rejection"}>
          weights total {total}%
        </span>
      </div>

      <div className="insight card" data-tone="warn" style={{ marginBottom: 18 }}>
        <span className="ico">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </span>
        <div>
          <h4>Calibration</h4>
          <p>
            Baseline evidence caps at 3. Certifications, tool lists, institution names, job titles, years of
            experience and generic phrasing are not evidence. Where two bands both look defensible, the lower
            one wins — under-scoring is recoverable, over-scoring is not.
          </p>
        </div>
      </div>

      {loading && <>{[0, 1, 2].map((i) => <div className="skel" key={i} />)}</>}

      <div className="rows">
        {list.map((c, i) => {
          const isOpen = open === c.id;
          return (
            <div className="row-item" key={c.id} data-open={isOpen ? "1" : "0"} style={{ ["--i" as any]: i }}>
              <button className="row-head" onClick={() => setOpen(isOpen ? null : c.id)} aria-expanded={isOpen}>
                <span className="rank tnum">{i + 1}</span>
                <span className="who">
                  <b>{c.name}</b>
                  <span>{isOpen ? "Score bands below" : "Tap for the score bands"}</span>
                </span>
                <span className="score">
                  <b>{c.weight}%</b>
                  <span>weight</span>
                </span>
                <svg className="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
              <div className="panel-wrap">
                <div className="panel-inner">
                  <div className="panel" style={{ gridTemplateColumns: "1fr" }}>
                    <div>
                      <div className="sechead" style={{ marginTop: 0 }}>What a strong candidate looks like</div>
                      <div className="brief">{c.description}</div>

                      <div className="sechead">Score bands</div>
                      <div className="crit">
                        {BANDS.filter((b) => c.anchors?.[b]).map((b) => (
                          <div className="c" key={b}>
                            <span className="cn">{b}</span>
                            <span className="cv">out of 10</span>
                            <div className="meter">
                              <i style={{ ["--w" as any]: `${(Number(b.split("-")[1]) / 10) * 100}%` }} />
                            </div>
                            <span className="cw">{c.anchors?.[b]}</span>
                          </div>
                        ))}
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
