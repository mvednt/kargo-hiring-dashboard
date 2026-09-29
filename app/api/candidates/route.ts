import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/supabase";
import { personalise, SHORTLIST_SIZE } from "../../../lib/pipeline";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const supabase = db();
    const role = (req.nextUrl.searchParams.get("role") || "PM").toUpperCase() as "PM" | "SPM";

    const { data: cands, error } = await supabase
      .from("candidates")
      .select("*")
      .eq("applied_role", role);
    if (error) throw error;

    const ids = (cands || []).map((c: any) => c.id);
    const { data: scores } = ids.length
      ? await supabase.from("scores").select("*").in("candidate_id", ids)
      : { data: [] as any[] };

    const rows = (cands || [])
      .map((c: any) => {
        const primary = (scores || []).find((s: any) => s.candidate_id === c.id && s.role === role);
        const other = (scores || []).find((s: any) => s.candidate_id === c.id && s.role !== role);
        const name = c.personal_details?.name ?? null;
        return {
          id: c.id,
          file_name: c.file_name,
          name,
          email: c.personal_details?.email ?? null,
          phone: c.personal_details?.phone ?? null,
          location: c.personal_details?.location ?? null,
          applied_role: c.applied_role,
          status: c.status,
          error_message: c.error_message,
          score: Number(primary?.total_score ?? 0),
          breakdown: primary?.breakdown ?? [],
          other_role: other?.role ?? null,
          other_score: Number(other?.total_score ?? 0),
          other_breakdown: other?.breakdown ?? [],
          brief: c.interview_brief,
          email_type: c.draft_email_type,
          email_subject: personalise(c.draft_email_subject, name),
          email_body: personalise(c.draft_email_body, name),
          email_sent_at: c.email_sent_at,
          sent_to: c.sent_to ?? null,
        };
      })
      .sort((a, b) => b.score - a.score)
      .map((r, i) => ({ ...r, rank: i + 1, above_line: i < SHORTLIST_SIZE }));

    const counts = {
      total: rows.length,
      shortlisted: rows.filter((r) => r.above_line).length,
      drafted: rows.filter((r) => r.email_body).length,
      sent: rows.filter((r) => r.email_sent_at).length,
    };

    return NextResponse.json({ rows, counts, shortlist_size: SHORTLIST_SIZE });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
