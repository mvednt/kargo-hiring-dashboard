# Kargo Hiring

An internal review tool for Arjun, Kargo's founder, who has 60 CVs across two
open roles and no recruiter. It scores each applicant against a rubric, ranks
them, explains every score, drafts the email — and then stops, because the
decision is his.

**Live:** https://kargo-hiring-dashboard-theta.vercel.app

Built for MESA Case 2. The full reasoning — the nine checks, the cut, Arjun's
psychology, how the rubric was derived and how it was calibrated — is in
[EXECUTION.md](./EXECUTION.md).

---

## What it does

1. **Upload** CVs (PDF / DOCX / TXT) and pick the role they applied for.
2. **Separate** personal details from the CV text — deterministically, before
   any text reaches a model.
3. **Score** every candidate against *both* rubrics (PM and Senior PM), with a
   written reason per criterion tied to a score band.
4. **Rank** them, draw the line at the top 5, and draft an interview brief plus
   an invite or rejection for each.
5. **Send nothing** until a human confirms it on the card.

## The two boundaries that shape the code

**Personal details never reach the model.** `lib/extract.ts` pulls name, email,
phone and location out with regexes and a header heuristic — no LLM call, so
there is no prompt that could leak them and no model behaviour to trust.
`assertNoPii()` then re-scans the scrubbed body and blocks the row outright if
an identifier survived. The model sees experience and evidence; it never sees
who it is judging.

**One exit, one hand on it.** `app/api/send/route.ts` is the only path an email
can leave by, and it is reachable exactly one way: Arjun clicking Confirm on a
candidate card. There is no scheduler, no batch send, no "send all" — a
rejection is irreversible and the system is not the one accountable for it.

## The rubric

Derived from Kargo's eight past hires and their performance ratings, not from
the job descriptions — a JD describes the role someone wrote down; the hires
describe the role that actually worked. Three patterns separated the strong
hires from the weak ones, and every criterion traces back to something a named
hire did. Scores are 0–10 against written bands; the weighted total is computed
in code, never by the model.

Calibration is deliberately harsh: baseline evidence caps at 3. Certifications,
tool lists, institution names, job titles and years of experience are not
evidence. Where two bands both look defensible, the lower one wins —
under-scoring is recoverable, over-scoring is not.

See [rubric.txt](./rubric.txt) for the full criteria, weights and bands.

## Stack

Next.js 15 (App Router) · TypeScript · Supabase (Postgres) · Gemini via
structured output · Resend · deployed on Vercel.

## Running it

```bash
npm install
cp .env.example .env.local   # then fill it in
npm run dev
```

`SEND_OVERRIDE_TO` is a safety valve: while it is set, the *default* recipient
is redirected to a test inbox and the subject is tagged, so a rejection cannot
reach a stranger by accident during development. An address typed into the To
field by hand overrides it — that is a deliberate act by the person accountable
for the send. Clear the variable to go live.

## Not in this repo

`case-data/` — the applicant CVs — is gitignored, and so is `.env.local`.
