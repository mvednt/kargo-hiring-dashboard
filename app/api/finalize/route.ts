import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/supabase";
import { briefAndEmail, SHORTLIST_SIZE } from "../../../lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Recomputes the line and fills in anything missing.
 *
 * "Above the line" = top 5 by score within the role the candidate applied for.
 * Above the line gets a draft interview invite; below the line gets a draft
 * rejection. NOTHING IS SENT HERE. Checks 06 and 09 killed auto-send: a wrongly
 * rejected candidate never knows and never comes back, and no named person is
 * accountable for a decision the system made on its own. So the system drafts,
 * and Arjun confirms.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = db();
    const body = await req.json().catch(() => ({}));
    const limit = Number(body.limit ?? 12);

    const { data: cands, error } = await supabase
      .from("candidates")
      .select("id, applied_role, cv_content, personal_details, best_role, interview_brief, draft_email_body, draft_email_type, email_sent_at")
      .eq("status", "scored");
    if (error) throw error;

    const { data: allScores } = await supabase.from("scores").select("candidate_id, role, total_score, breakdown");
    const scoreOf = (id: string, role: string) =>
      (allScores || []).find((s: any) => s.candidate_id === id && s.role === role);

    // rank within the role the candidate actually applied for
    const ranked: Record<string, string[]> = { PM: [], SPM: [] };
    for (const role of ["PM", "SPM"] as const) {
      ranked[role] = (cands || [])
        .filter((c: any) => c.applied_role === role)
        .sort((a: any, b: any) => (scoreOf(b.id, role)?.total_score ?? 0) - (scoreOf(a.id, role)?.total_score ?? 0))
        .map((c: any) => c.id);
    }

    let generated = 0;
    const errors: any[] = [];

    for (const c of cands || []) {
      const role = c.applied_role as "PM" | "SPM";
      const rank = ranked[role].indexOf(c.id);
      const needType: "invite" | "rejection" = rank > -1 && rank < SHORTLIST_SIZE ? "invite" : "rejection";

      const needs = !c.interview_brief || !c.draft_email_body || c.draft_email_type !== needType;
      if (!needs) continue;
      // never rewrite a draft that has already gone out
      if (c.email_sent_at) continue;
      if (generated >= limit) continue;

      try {
        const s = scoreOf(c.id, role);
        const out = await briefAndEmail({
          cvContent: c.cv_content,
          role,
          emailType: needType,
          breakdown: (s?.breakdown as any) || [],
          total: Number(s?.total_score ?? 0),
        });
        await supabase
          .from("candidates")
          .update({
            interview_brief: out.brief,
            draft_email_subject: out.subject,
            draft_email_body: out.body,
            draft_email_type: needType,
          })
          .eq("id", c.id);
        generated++;
      } catch (e: any) {
        errors.push({ id: c.id, error: e.message ?? String(e) });
      }
    }

    const remaining = (cands || []).filter((c: any) => {
      const role = c.applied_role as "PM" | "SPM";
      const rank = ranked[role].indexOf(c.id);
      const needType = rank > -1 && rank < SHORTLIST_SIZE ? "invite" : "rejection";
      return !c.email_sent_at && (!c.interview_brief || !c.draft_email_body || c.draft_email_type !== needType);
    }).length;

    return NextResponse.json({ generated, remaining: Math.max(0, remaining - generated), errors });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
