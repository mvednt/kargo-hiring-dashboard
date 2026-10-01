// ---------------------------------------------------------------------------
// Ingestion. This is the privacy boundary of the whole system.
//
// Everything here is deterministic — no model call. Personal details are pulled
// out with regex and a header heuristic, stored on their own, and scrubbed from
// the body. Only the scrubbed body is ever passed to Gemini. If this step were
// done by an LLM, the personal details would have already left the building
// before they were separated, which defeats the point.
// ---------------------------------------------------------------------------

export type PersonalDetails = {
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  links: string[];
};

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Indian and international shapes: +91 98204 37810, 9820437810, (022) 1234-5678
const PHONE_RE =
  /(?:\+\d{1,3}[\s-]?)?(?:\(\d{2,4}\)[\s-]?)?\d{3,5}[\s-]?\d{3,5}(?:[\s-]?\d{2,5})?/g;
const URL_RE =
  /(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com|leetcode\.com|behance\.net|medium\.com|twitter\.com|x\.com)\/[A-Za-z0-9._\-\/]+/gi;

// A CV header often puts the role directly under the name, and "Product Manager"
// parses as a two-word capitalised phrase exactly like a name does. So the name
// heuristic has to reject job-title vocabulary outright, or the invite email
// opens with "Hi Product Manager,".
const NON_NAME =
  /\b(resume|curriculum|vitae|cv|profile|summary|experience|manager|director|engineer|product|senior|junior|lead|leader|head|chief|consultant|analyst|associate|executive|specialist|officer|founder|intern|strategy|strategic|operations|growth|marketing|sales|design|designer|developer|architect|principal|staff|advisor|partner|freelance|portfolio|contact|about|problem|solution|objective|overview|background|approach|context|note|notes|page)\b/i;

function titleCase(s: string) {
  return s
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Filenames in this dataset look like pm_01_priya_krishnan.pdf / 07_aditya_nair.pdf */
export function nameFromFileName(fileName: string): string | null {
  const base = fileName.replace(/\.[^.]+$/, "");
  const parts = base.split(/[_\-\s]+/).filter((p) => !/^\d+$/.test(p) && !/^(pm|spm|cv)$/i.test(p));
  if (parts.length < 2) return null;
  return titleCase(parts.join(" "));
}

function looksLikeName(line: string) {
  const t = line.trim();
  if (!t || t.length > 45) return false;
  if (NON_NAME.test(t)) return false;
  if (/[@\d]/.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length < 2 || words.length > 5) return false;
  return words.every((w) => /^[A-Za-z][A-Za-z.'-]*$/.test(w));
}

function isPlausiblePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) return false;
  // reject year ranges and money figures that survived the loose pattern
  if (/^(19|20)\d{2}(19|20)\d{2}$/.test(digits)) return false;
  return true;
}

export function separatePii(rawText: string, fileName: string) {
  const text = rawText.replace(/\r/g, "");
  const head = text.split("\n").slice(0, 12);

  // --- name -------------------------------------------------------------
  let name: string | null = null;
  for (const line of head) {
    if (looksLikeName(line)) {
      name = line.trim().replace(/\s+/g, " ");
      break;
    }
  }
  if (!name) name = nameFromFileName(fileName);
  if (name) name = titleCase(name);

  // --- email ------------------------------------------------------------
  const emails = Array.from(text.matchAll(EMAIL_RE)).map((m) => m[0]);
  const email = emails[0] ?? null;

  // --- phone ------------------------------------------------------------
  const phoneCandidates = Array.from(head.join("\n").matchAll(PHONE_RE))
    .map((m) => m[0].trim())
    .filter(isPlausiblePhone);
  const phone = phoneCandidates[0] ?? null;

  // --- links ------------------------------------------------------------
  const links = Array.from(new Set(Array.from(text.matchAll(URL_RE)).map((m) => m[0])));

  // --- location (best effort, not required) -----------------------------
  const CITIES =
    /\b(Mumbai|Bengaluru|Bangalore|Chennai|Delhi|New Delhi|Pune|Hyderabad|Kolkata|Gurugram|Noida|Ahmedabad|Kochi|Jaipur|Nhava Sheva|JNPT)\b/;
  const locLine = head.find((l) => CITIES.test(l));
  const location = locLine ? (locLine.match(CITIES) as RegExpMatchArray)[0] : null;

  // --- scrub ------------------------------------------------------------
  let body = text;
  for (const e of emails) body = body.split(e).join("[EMAIL]");
  for (const l of links) body = body.split(l).join("[LINK]");
  for (const p of phoneCandidates) body = body.split(p).join("[PHONE]");
  body = body.replace(EMAIL_RE, "[EMAIL]");

  if (name) {
    const parts = name.split(" ").filter((p) => p.length > 2);
    for (const p of [name, ...parts]) {
      body = body.replace(new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), "[NAME]");
    }
  }

  // drop the contact header block entirely
  const lines = body.split("\n");
  let start = 0;
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    if (/\[NAME\]|\[EMAIL\]|\[PHONE\]|\[LINK\]/.test(lines[i])) start = i + 1;
  }
  body = lines.slice(start).join("\n");

  const cv_content = body
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n")
    .trim();

  const personal_details: PersonalDetails = { name, email, phone, location, links };
  return { personal_details, cv_content };
}

/** Last line of defence: refuse to send anything that still carries an identifier. */
export function assertNoPii(content: string, pd: PersonalDetails) {
  const problems: string[] = [];
  if (EMAIL_RE.test(content)) problems.push("email");
  EMAIL_RE.lastIndex = 0;
  if (pd.phone && content.includes(pd.phone)) problems.push("phone");
  if (pd.name && new RegExp(`\\b${pd.name.split(" ")[0]}\\b`, "i").test(content)) problems.push("name");
  return problems;
}

export async function fileToText(buf: Buffer, fileName: string): Promise<string> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  }
  if (lower.endsWith(".docx")) {
    const mammoth = (await import("mammoth")).default ?? (await import("mammoth"));
    const { value } = await (mammoth as any).extractRawText({ buffer: buf });
    return value;
  }
  if (lower.endsWith(".txt") || lower.endsWith(".md")) return buf.toString("utf8");
  throw new Error(`Unsupported file type: ${fileName}`);
}
