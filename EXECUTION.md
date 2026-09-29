# Case 2 — Arjun / Kargo — Execution Record

Everything built, in the order it was built, with the reasoning for each decision.

---

## 0. The 'Why' before any of it

**Pain.** Two roles open since July. Sixty applications, nineteen opened, zero offers,
eleven weeks. Arjun reviews CVs at 11pm in forty-five-minute gaps, shortlists on
instinct, passes on instinct, and keeps no record of either. He could not reconstruct
his own decisions if asked. Meanwhile the engineering team runs without PM ownership
and the runway burns.

**User.** Arjun Mehta. One person. There is no HR function and no Head of Product.
He is the hiring manager for every open role. He is not a recruiter and does not want
to become one.

**Outcome.** An offer. Not a cleaner process, not better record-keeping — an offer,
to the right person, before the December headcount target becomes impossible.

**The journey today.**

```
Application arrives  →  sits in an inbox  →  Arjun opens it late at night
  →  reads for ~2 minutes  →  forms an instinct  →  closes the tab
  →  no note, no criteria, no rationale recorded
  →  next week, starts from scratch on the next batch
  →  two strong candidates get "let's chat" and are never followed up
  →  nineteen people hear nothing at all
```

Every review starts from zero because nothing from the last review survived.

**The deeper issue, which is upstream of all of it.** Arjun is scoring people against
the job spec. The spec describes the role; it does not predict who will succeed in it.
His eight past hires did not match their specs especially well. What they had in common
was never written down. That pattern is the actual signal, and it is sitting unused in
his own history.

---

## 1. The Nine Checks — worked with evidence

### Kill switches — any NO means don't build it

| # | Check | Verdict | Evidence from the case |
|---|---|---|---|
| 01 | Is the problem real? | **YES** | 60 received, 19 opened, 0 offers, 11 weeks. The cost is measurable: a PM hire is 6–12 months of product velocity. |
| 02 | Is the workflow repeated? | **YES** | Applications arrive weekly. The review-and-stall cycle repeats identically every batch. |
| 03 | Is the input available? | **YES** | 60 CVs, 8 hire profiles with ratings, 2 role specs. All of it exists today. Nothing has to be collected. |

### Sizing — any NO means build something smaller

| # | Check | Verdict | Evidence |
|---|---|---|---|
| 04 | Is the output valuable? | **YES** | A ranked shortlist with a per-criterion score and a reason replaces 60 unreviewed PDFs. It is the difference between a decision and a stall. |
| 05 | Is impact measurable? | **YES** | Baseline is 0 offers in 11 weeks. Target is a first offer within 2 weeks. Also measurable: time-to-first-response for the 19 who heard nothing. |
| 08 | Is the ROI worth it? | **YES** | One PM hire is 6–12 months of product velocity. Every week these roles stay open costs Kargo more than the whole build. |

### Boundary — any NO means put a human exactly there

| # | Check | Verdict | Evidence |
|---|---|---|---|
| 06 | Is the failure risk acceptable? | **YES** for ranking and scoring. **NO** for auto-rejection. | A wrongly ranked candidate is still visible and recoverable — Arjun scrolls past the line and finds them. A wrongly rejected candidate never knows, never returns, and there is no feedback loop that would surface the mistake. The failure is invisible, which makes it unfixable. |
| 07 | Is judgment protected? | **YES** | Arjun reviews every shortlist and confirms every send. The system never makes the hiring call. |
| 09 | Is the owner clear? | **YES** for the shortlist. **NO** for auto-rejection. | For a ranked list, Arjun owns the decision. For a system-generated rejection, no named person is accountable for that specific rejection of that specific person. That is not a workflow, it is a liability. |

### THE CUT

**What Arjun asked for:** auto-send emails to rejected and selected candidates, after he confirms.

**Killed by:** Check 06 + Check 09.

**What gets automated:** extraction, PII separation, scoring against the rubric, ranking,
brief generation, email drafting.

**What stays human:** the shortlist review, the confirm-to-send decision, the hiring call.

> The system ranks and explains. Arjun looks at everything below the line once — ten
> minutes, not ten hours, because the ranking does the heavy lifting. We do not reject
> on his behalf, because a wrong rejection is one he cannot fix.

**How the cut is enforced in the code, not just in the doc:**
- `/api/send` is the only path to Resend, and it takes a single candidate `id`.
- There is no batch-send route, no cron, no scheduler, no "send all" button anywhere.
- The dashboard's send button opens a browser confirm naming the recipient and the email type.
- Once `email_sent_at` is set, the draft is frozen and `/api/finalize` will never rewrite it.

---

## 2. Reading Arjun — what the system had to account for

These are design constraints, not colour.

| What the case tells us about him | What it forced in the build |
|---|---|
| Reviews at 11pm with ~45 minutes | Ranked list, collapsed by default. He opens one card at a time. Nothing requires reading a CV. |
| Shortlists and passes on instinct, keeps no record | Every criterion shows a score **and a one-sentence reason quoting the CV**. The record now exists whether or not he writes one. |
| "Could not reconstruct most of them" | The score breakdown is stored in Supabase per candidate per role. The rationale is queryable after the fact. |
| Wants to act "without managing what comes next" | The brief and the draft email are already written when he opens the card. His decision is the last thing he touches. |
| Two strong candidates got "let's chat" and nothing happened | The follow-up is pre-drafted, so there is no gap between intent and action. |
| 19 people heard nothing — "the reputation he is building by accident" | Everyone below the line has a rejection draft waiting. Sending it is one click, and it is his click. |
| Judges against the job spec; his real pattern is in his hires | The rubric is derived **only** from the 8 hire profiles. The JDs were read for context and deliberately excluded as a source. |

---

## 3. Components Map

The map from the session notes, in Trigger → Input → Context → Processing → AI → Output form,
is implemented as-is. Three boxes were added because the nine checks force them:

| Added box | Lane | Why it earns a box |
|---|---|---|
| **Privacy boundary** (deterministic PII split, assertion gate) | System | The original map has "excludes personal details from AI" as a parenthetical inside the extraction box. It is not a parenthetical — it is the one step that decides whether this system is DPDP-defensible. It is also the one step that must *not* be an AI step, so it cannot live inside an AI box. |
| **Rank & draw the line** | System | Invite-vs-rejection is not a property of a candidate, it is a property of their *rank* — which changes every time a CV is added. The original map implies the email type is decided at generation time. It has to be recomputed. |
| **Confirm gate** | Founder | The Cut lives here. Drawing it as a box makes it visible that the only edge into Resend comes from a human action. |

Full revised map: `components-map.html` in this folder (and published as an artifact).

```
FOUNDER   [upload CV + role] ──────────────────────────────────────────┐
                                                                        │
SYSTEM    [text extraction] → [PRIVACY BOUNDARY: split PII,             │
             pdf/docx          store separately, scrub body,            │
                               assert no identifiers remain]            │
                                      │                                 │
                               personal_details ──► Supabase (never leaves)
                               cv_content ────────┐                     │
                                                  ▼                     │
AI        [score vs PM rubric AND SPM rubric — 5 criteria each,         │
           0–10 per criterion + one-sentence reason quoting the CV]     │
                                      │                                 │
SYSTEM    [weighted total /100] → [RANK within applied role]            │
                                  [top 5 = above the line]              │
                                      │                                 │
AI        [3-sentence interview brief] + [draft email:                  │
           invite if above the line, rejection if below.                │
           Written with token [NAME] — model never sees the name]       │
                                      │                                 │
SYSTEM    [substitute real name from personal_details]                  │
                                      │                                 │
FOUNDER   [DASHBOARD: ranked cards, score breakdown, brief, draft] ◄────┘
                                      │
                              ═══ CONFIRM GATE ═══   ← the only edge out
                                      │
RESEND    [send one email to one candidate] → mark sent, freeze draft
```

---

## 4. The Rubric (Checkpoint L4·1)

**Method.** Compare the five hires rated *Exceeds Expectations* against the two rated
*Meets* and the one rated *Below*. Find what the high performers share that the others
lack or show only weakly. Use the JDs only to understand what the roles involve —
never as a source of criteria.

| Hire | Role | Rating |
|---|---|---|
| Rohan Desai | Head of Engineering | Exceeds |
| Sunita Krishnamurthy | Operations Lead | Exceeds |
| Aditya Shetty | Sales Lead | Exceeds |
| Meghna Tiwari | Customer Success Manager | Exceeds |
| Lavanya Iyer | Product Manager | Exceeds |
| Vikram Nair | Product Manager | Meets |
| Rahul Bose | Growth & Marketing Lead | Meets |
| Preetham Rao | Backend Engineer | Below |

### Pattern 1 — Personal accountability *inside* a logistics operation

All five Exceeds hires held a job where freight, documents or carriers moved or failed
because of them:

- **Rohan** — 3 years as Operations Executive at a CHA firm at JNPT, 180+ shipments/month
  of Bills of Lading, Shipping Bills and customs clearance.
- **Sunita** — 7 years of freight forwarding documentation, DGFT, ICEGATE EDI, two customs
  inspections closed without penalty.
- **Aditya** — 2 years of commercial operations at Jacaranda's JNPT terminal, working
  alongside terminal ops during peak, no account-manager layer.
- **Meghna** — 2.5 years at Coastline Freight on export documentation, including a 7pm
  customs hold she worked through the night before the client knew.
- **Lavanya** — 3 years of carrier allocation and exception management at Mahindra
  Logistics, 800+ shipments/month.

The three non-Exceeds hires have none of it. Vikram is HR-tech SaaS only. Rahul is
fintech and HR-tech marketing. Preetham integrated 3PL APIs from an e-commerce backend
team in Bengaluru but never carried operational consequence.

*Why this is not a JD requirement:* the PM JD asks for "genuine curiosity about how
operations work" and the SPM JD calls domain familiarity "a genuine advantage". Curiosity
and familiarity are not the pattern. The pattern is **having been accountable** — having
held the job where the freight was your problem. That distinction is what separates
Preetham (integrated with Delhivery and Bluedart) from Rohan (filed the Shipping Bill).

### Pattern 2 — Ran something with no senior counterpart above them

- Rohan: *"comfortable as the most senior engineer in the room"*, translating field
  requirements to spec *"without a product layer"*.
- Sunita: five years self-employed, *"owning processes from start to finish with limited
  oversight"*.
- Aditya: full sales cycle alone, *"no account manager layer between the client and
  execution"*, 8 of 14 accounts self-sourced.
- Meghna: owns QBRs, escalations and renewals across her whole book — *"no escalation to
  management in the last 14 months"*.
- Lavanya: *"sole PM"*; her engineering lead's review note reads *"she doesn't hedge"*.

Against that: Vikram *"supported senior PMs"* and sits inside a 4-person PM team.
Preetham is one of twelve on a platform team.

### Pattern 3 — Their record names something that went wrong

- **Lavanya** killed two of her own six shipped features on usage data, and wrote both the
  internal and customer-facing post-mortems after a 4-hour outage.
- **Aditya** documented a 4-month deal he lost, named his own misread of the economic
  buyer, and turned it into standard practice before account qualification.
- **Sunita** rebuilt the documentation workflow over a weekend when a vendor changed the
  export format without notice, and closed four compliance gaps before an inspection.
- **Meghna** raised an undocumented product limitation affecting four accounts and ran
  customer communication through a 6-week fix.
- **Rohan** cut P1 incidents 40% by introducing review and on-call after incidents.

Vikram, Rahul and Preetham present unbroken win narratives. Nothing was ever stopped,
lost or undone anywhere in their record.

### The rubric that came out of it

Five criteria per role. Weights total 100% for each role separately. The SPM weights
shift toward independence because the SPM bar is authority on direction, not autonomy
on tasks.

| Criterion | PM | SPM | Traceable to |
|---|---|---|---|
| Operational Accountability in Logistics | 25% | 20% | Pattern 1 — all five Exceeds hires |
| Ownership Without Cover | 20% | **30%** | Pattern 2 — Lavanya "sole PM", Sunita self-employed |
| Documented Reversal or Failure | 20% | 20% | Pattern 3 — Lavanya's killed features, Aditya's lost deal |
| Built the Missing Thing | 20% | 15% | Rohan's BoL module, Sunita's weekend rebuild, Meghna's onboarding framework |
| Absorbed Load Without Escalation | 15% | 15% | Meghna covering 8 accounts for 3 months, Rohan's 18-month surge |

Full text with scoring guidance: `rubric.txt`.

---

## 5. Build log — what was done, in order

### Step 1 — Got the source material
Downloaded all three Drive folders through the browser: 8 hire profiles (.docx),
2 job descriptions (.docx), 60 applications (.pdf). Extracted the docx text locally
so the profiles and JDs could be read end to end rather than skimmed.

### Step 2 — Derived the rubric before writing any code
No code existed at this point, deliberately. If the rubric is designed after the schema,
the schema shapes the rubric. Output: `rubric.txt`, 5 criteria per role, weights to 100%,
every criterion traceable to a named hire profile.

### Step 3 — Database
Supabase project `kargo-hiring` (ap-south-1). Three tables:

- **`rubric_criteria`** — one row per criterion per role. Seeded from `rubric.txt`.
  Scoring reads the rubric from the database, so changing a weight does not require a
  redeploy.
- **`candidates`** — `personal_details` (jsonb) holds name, email, phone, location and
  links. `cv_content` (text) holds the scrubbed body. These are separate columns
  *because they have different trust boundaries*: one may go to a model, one may not.
  Also holds the brief, the draft email, `email_sent_at` and the Resend id.
- **`scores`** — one row per candidate **per role**, with `total_score` and a `breakdown`
  jsonb array of `{criterion, score, weight, reason}`.

RLS is on for all three tables with **no anon policies**. The publishable key cannot read
candidate data. Every read goes through a server route using the service role key.

### Step 4 — The pipeline

**4a. Text extraction** — `unpdf` for PDF, `mammoth` for docx. Runs on the Node runtime.

**4b. The privacy boundary** — `lib/extract.ts`. Fully deterministic, no model call:
- email by regex, phone by regex with a plausibility check (10–13 digits, reject year
  ranges), name from the header block by heuristic with the filename as fallback,
  profile links by regex, city from a known list.
- Every occurrence of every identifier is replaced in the body with `[NAME]`, `[EMAIL]`,
  `[PHONE]`, `[LINK]`, and the contact header block is dropped entirely.
- `assertNoPii()` then re-scans the scrubbed body. **If anything survives, the row fails
  and nothing is sent to Gemini.** It is a gate, not a warning.

*Why this is not an AI step, despite the session's tool table suggesting Gemini for
extraction:* if a model does the separating, the personal details have already left the
building before they were separated. The privacy property you want is "the identifiers
never crossed the boundary", and only a local, deterministic step can give you that.

**4c. Scoring** — one Gemini Flash call per candidate scoring against **both** rubrics.
Structured output via `responseSchema`, temperature 0.2. Each criterion returns 0–10 plus
a one-sentence reason that must point at something specific in the CV. Weighted total is
computed in code, not by the model — `Σ (score/10 × weight)` → 0–100.

The prompt explicitly instructs the model to ignore the placeholder tokens and never
infer identity, gender, age, caste, religion or nationality.

*Why both rubrics for everyone:* Arjun's problem is not sorting applications into the
boxes candidates ticked. A weak PM applicant who is a strong SPM candidate is exactly the
signal he would never see on instinct. The dashboard flags it as "stronger as SPM".

**4d. Rank and draw the line** — `/api/finalize`. Ranks within the role applied for. Top 5
is above the line. This is recomputed on every run, because adding a CV can push someone
out.

**4e. Brief and draft email** — one Gemini call per candidate.
- Brief: exactly three sentences — who they are by what they have done, the single
  strongest piece of rubric evidence, and the question Arjun should ask in the interview.
- Email: invite above the line, rejection below. Written from the anonymised CV using the
  literal token `[NAME]`; the real name is substituted from Supabase **after** the model
  returns. The model never sees who it is writing to.
- A draft is regenerated only if it is missing or if its type flipped. A draft that has
  already been sent is never touched.

**4f. Send** — `/api/send`, one candidate, called only from the Confirm button. Marks
`email_sent_at` and stores the Resend id.

### Step 5 — The dashboard
Ranked cards, collapsed. Rank, name, location, a status chip (invite drafted / rejection
drafted / sent), and the score. A visual line marker after position 5. Open a card and
you get, side by side: the criterion breakdown with score, weight, bar and reason; the
cross-role score; the three-sentence brief; and the editable draft email with the Confirm
button.

No unnecessary design. It is an internal tool for one person at 11pm.

---

## 6. Data privacy — the three questions

**Q: What is the difference between the Gemini AI Studio free tier and the Gemini API
with billing enabled, with respect to your data?**

The free tier may use your inputs to improve Google's models. The billed API does not.
It is one configuration line and an entirely different treatment of the data. For a
system processing real candidates, billing must be enabled — not for the quota, for the
data terms.

**Q: What does the extraction step do that would make this DPDP-compliant in a real
deployment?**

It separates personal details from CV content at ingestion. Every AI call after that
point receives only content — no name, no email, no phone, no profile links. The
identifiers stay in Supabase and never enter Gemini. Under DPDP that matters because the
personal data never leaves the data fiduciary's control for processing by a third party;
what leaves is a description of work history that is not, on its own, identifying.

**Q: You have built a system that processes people who never applied to Kargo. What
follows from that?**

The 60 applications are real people who applied. But the *rubric* was derived from eight
employees who never consented to having their performance ratings used to build a hiring
filter. In a real deployment that is the exposure: the hires are the training signal, and
they were never asked. Two things follow — the derived rubric should be reviewed and
owned by a named person rather than treated as an output of the data, and the criteria
must be written in terms of observable work history (which they are) rather than
anything that could proxy for a protected characteristic.

---

## 7. What is left, and the definition of done

| Checkpoint | State |
|---|---|
| L4·1 Rubric | **Done.** `rubric.txt`, 5 criteria per role, 100% each, every criterion traceable to a hire profile. |
| L4·2 Project setup | **Done.** Schema live, rubric seeded, app builds clean. Awaiting service role + Gemini keys to deploy. |
| B·1 Upload and test | Pending. 3 test CVs (strong PM, weak SPM, ambiguous), then all 60. |
| B·2 Resend | Pending. Account, API key, env var, wire the Confirm button. |
| B·3 End-to-end | Pending. Upload → score → brief → draft → confirm → delivered, under 5 minutes. |

**Done when:** the full loop runs without error in under five minutes; all 60 rows are in
Supabase with scores against both rubrics; the top 5 per role have a brief and a draft
invite; everyone else has a draft rejection; clicking Confirm delivers a real email
carrying the candidate's real name, and the card marks as sent.
