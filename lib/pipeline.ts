import { db } from "./supabase";
import { geminiJson } from "./gemini";

export type Criterion = { id: string; role: string; name: string; description: string; weight: number; sort_order: number };
export type CriterionScore = { criterion: string; score: number; weight: number; reason: string };

export const SHORTLIST_SIZE = 5;

export async function loadRubric(): Promise<Record<"PM" | "SPM", Criterion[]>> {
  const { data, error } = await db().from("rubric_criteria").select("*").order("sort_order");
  if (error) throw error;
  const out: any = { PM: [], SPM: [] };
  for (const c of data as Criterion[]) out[c.role].push(c);
  return out;
}

function rubricBlock(role: string, crit: Criterion[]) {
  return crit
    .map(
      (c, i) =>
        `${i + 1}. ${c.name} (weight ${c.weight}%)\n   What a strong candidate looks like: ${c.description}`
    )
    .join("\n\n");
}

const SCORE_SCHEMA = {
  type: "object",
  properties: {
    PM: {
      type: "object",
      properties: {
        criteria: {
          type: "array",
          items: {
            type: "object",
            properties: {
              criterion: { type: "string" },
              score: { type: "number" },
              reason: { type: "string" },
            },
            required: ["criterion", "score", "reason"],
          },
        },
      },
      required: ["criteria"],
    },
    SPM: {
      type: "object",
      properties: {
        criteria: {
          type: "array",
          items: {
            type: "object",
            properties: {
              criterion: { type: "string" },
              score: { type: "number" },
              reason: { type: "string" },
            },
            required: ["criterion", "score", "reason"],
          },
        },
      },
      required: ["criteria"],
    },
  },
  required: ["PM", "SPM"],
};

/**
 * Every candidate is scored against BOTH rubrics regardless of which role they
 * applied for. Arjun's problem is not sorting applications into the boxes people
 * chose for themselves — it is finding the hire. A weak PM applicant may be a
 * strong SPM one, and he would never have seen it.
 */
export async function scoreCandidate(cvContent: string, rubric: Record<"PM" | "SPM", Criterion[]>) {
  const prompt = `You are scoring an anonymised CV against two hiring rubrics for Kargo, a Series A logistics SaaS company in Mumbai.

The CV below has had all personal identifiers removed and replaced with placeholders like [NAME], [EMAIL], [PHONE], [LINK]. Ignore the placeholders entirely. Never comment on, guess at, or infer identity, gender, age, caste, religion or nationality. Score only what the work history evidences.

Score EACH criterion in BOTH rubrics from 0 to 10:
  0-2  no evidence at all in the CV
  3-4  adjacent or implied, but not demonstrated
  5-6  demonstrated once, or weakly
  7-8  demonstrated clearly and more than once
  9-10 demonstrated repeatedly and unmistakably, with specifics

For each criterion give a "reason" of ONE sentence that quotes or points to the specific thing in the CV that drove the score. If the score is low, say what was missing. Never write a reason that could apply to any CV.

=== RUBRIC: PRODUCT MANAGER ===
${rubricBlock("PM", rubric.PM)}

=== RUBRIC: SENIOR PRODUCT MANAGER ===
${rubricBlock("SPM", rubric.SPM)}

=== CANDIDATE CV (anonymised) ===
${cvContent.slice(0, 24000)}

Return JSON with keys PM and SPM. Use the exact criterion names given above.`;

  const raw = await geminiJson<any>(prompt, SCORE_SCHEMA);

  const build = (role: "PM" | "SPM") => {
    const crit = rubric[role];
    const got: any[] = raw?.[role]?.criteria ?? [];
    const breakdown: CriterionScore[] = crit.map((c) => {
      const hit =
        got.find((g) => String(g.criterion).trim().toLowerCase() === c.name.toLowerCase()) ??
        got.find((g) => String(g.criterion).toLowerCase().includes(c.name.slice(0, 18).toLowerCase()));
      const score = Math.max(0, Math.min(10, Number(hit?.score ?? 0)));
      return { criterion: c.name, score, weight: Number(c.weight), reason: hit?.reason ?? "No evidence found in the CV." };
    });
    const total = breakdown.reduce((s, b) => s + (b.score / 10) * b.weight, 0);
    return { breakdown, total: Math.round(total * 10) / 10 };
  };

  return { PM: build("PM"), SPM: build("SPM") };
}

const BRIEF_SCHEMA = {
  type: "object",
  properties: {
    brief: { type: "string" },
    subject: { type: "string" },
    body: { type: "string" },
  },
  required: ["brief", "subject", "body"],
};

/**
 * Brief + draft email in one call. The email is written from the anonymised CV
 * and uses the literal token [NAME]; the real name is substituted afterwards
 * from the row in Supabase. The model never sees who this is.
 */
export async function briefAndEmail(args: {
  cvContent: string;
  role: "PM" | "SPM";
  emailType: "invite" | "rejection";
  breakdown: CriterionScore[];
  total: number;
}) {
  const { cvContent, role, emailType, breakdown, total } = args;
  const roleName = role === "PM" ? "Product Manager" : "Senior Product Manager";

  const scoreLines = breakdown
    .map((b) => `- ${b.criterion}: ${b.score}/10 (weight ${b.weight}%) — ${b.reason}`)
    .join("\n");

  const prompt = `You are preparing a hiring review for Arjun Mehta, founder of Kargo (Series A logistics SaaS, Mumbai). Arjun is the hiring manager for every role and reviews candidates late at night with about forty-five minutes. He needs enough to make a confident call and to know what to probe if he moves forward.

The CV is anonymised. Personal identifiers are replaced with [NAME], [EMAIL], [PHONE], [LINK]. Do not speculate about identity of any kind.

Role being considered: ${roleName}
Weighted score against that rubric: ${total}/100
Criterion scores:
${scoreLines}

=== CANDIDATE CV (anonymised) ===
${cvContent.slice(0, 20000)}

Produce THREE things.

1. "brief" — EXACTLY three sentences.
   Sentence 1: who this person is in terms of what they have actually done.
   Sentence 2: the single strongest piece of evidence for the rubric, named specifically.
   Sentence 3: the one thing Arjun should probe in an interview, phrased as the question to ask.
   No preamble, no name, no hedging.

2. "subject" — an email subject line for a ${emailType === "invite" ? "first-round interview invitation" : "rejection"} for the ${roleName} role at Kargo.

3. "body" — the email itself, from Arjun Mehta, Founder, Kargo. Plain text, no markdown.
   Open with "Hi [NAME]," using that exact token — it is substituted later.
   ${
     emailType === "invite"
       ? `This is an interview invitation. Reference ONE specific thing from their work history so it is obvious a person read it. Propose a 45-minute first conversation with Arjun this week or next and ask for two windows that suit them. Warm, direct, four short paragraphs at most.`
       : `This is a rejection. Be brief, human and unambiguous — do not imply the process is still open. Reference the role and thank them for the time they spent applying. Do not give detailed feedback or scores. Do not say "we will keep your CV on file" unless it is true; instead say they are welcome to apply again as the team grows. Three short paragraphs at most.`
   }
   Sign off as:
   Arjun Mehta
   Founder, Kargo

Return JSON with keys brief, subject, body.`;

  return geminiJson<{ brief: string; subject: string; body: string }>(prompt, BRIEF_SCHEMA);
}

export function personalise(text: string, name: string | null) {
  return (text || "").replace(/\[NAME\]/g, name || "there").replace(/\[EMAIL\]|\[PHONE\]|\[LINK\]/g, "");
}
