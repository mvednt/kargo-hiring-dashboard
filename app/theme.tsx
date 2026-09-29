"use client";

import { useEffect, useState } from "react";

type Mode = "light" | "dark" | "system";

/**
 * Three states, not two. A plain light/dark switch has to pick a side on first
 * paint, and whichever it picks is wrong for half the people who open it.
 * "System" is the default and follows the OS, so Arjun opening this at 11pm
 * gets dark without ever having touched the control.
 *
 * The chosen mode is written to <html data-theme>. Light is pinned explicitly
 * so it survives an OS in dark mode; system clears the attribute and lets the
 * prefers-color-scheme block in globals.css take over.
 */
function apply(mode: Mode) {
  const root = document.documentElement;
  if (mode === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", mode);
  try {
    localStorage.setItem("kargo-theme", mode);
  } catch {
    /* private window — the toggle still works for this session */
  }
}

const ICONS: Record<Mode, React.ReactNode> = {
  light: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  dark: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  ),
  system: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="4" width="19" height="12.5" rx="2" />
      <path d="M8.5 20.5h7M12 16.5v4" />
    </svg>
  ),
};

const LABELS: Record<Mode, string> = { light: "Light", dark: "Dark", system: "System" };

export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");

  // Read what the inline script in <head> already decided, so the control
  // shows the state the page is actually in rather than resetting it.
  useEffect(() => {
    let saved: Mode = "system";
    try {
      const v = localStorage.getItem("kargo-theme");
      if (v === "light" || v === "dark" || v === "system") saved = v;
    } catch {
      /* ignore */
    }
    setMode(saved);
  }, []);

  function pick(m: Mode) {
    setMode(m);
    apply(m);
  }

  return (
    <div className="themetoggle" role="group" aria-label="Colour theme">
      {(["light", "dark", "system"] as Mode[]).map((m) => (
        <button
          key={m}
          type="button"
          data-on={mode === m ? "1" : "0"}
          aria-pressed={mode === m}
          title={LABELS[m]}
          aria-label={LABELS[m]}
          onClick={() => pick(m)}
        >
          {ICONS[m]}
        </button>
      ))}
    </div>
  );
}
