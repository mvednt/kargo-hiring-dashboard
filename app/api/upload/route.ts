import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/supabase";
import { fileToText, separatePii, assertNoPii } from "../../../lib/extract";
import { loadRubric, scoreCandidate } from "../../../lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const role = String(form.get("role") || "").toUpperCase();
    if (role !== "PM" && role !== "SPM")
      return NextResponse.json({ error: "role must be PM or SPM" }, { status: 400 });

    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (!files.length) return NextResponse.json({ error: "no files" }, { status: 400 });

    const rubric = await loadRubric();
    const supabase = db();
    const results: any[] = [];

    for (const file of files) {
      try {
        const buf = Buffer.from(await file.arrayBuffer());

        // 1. text out of the file
        const raw = await fileToText(buf, file.name);
        if (!raw.trim()) throw new Error("No text could be extracted");

        // 2. THE PRIVACY BOUNDARY — deterministic, no model involved
        const { personal_details, cv_content } = separatePii(raw, file.name);
        const leaks = assertNoPii(cv_content, personal_details);
        if (leaks.length) throw new Error(`PII still present in body: ${leaks.join(", ")}`);

        const { data: row, error: insErr } = await supabase
          .from("candidates")
          .insert({
            file_name: file.name,
            applied_role: role,
            personal_details,
            cv_content,
            status: "scoring",
          })
          .select()
          .single();
        if (insErr) throw insErr;

        // 3. score against BOTH rubrics
        const scored = await scoreCandidate(cv_content, rubric);

        await supabase.from("scores").upsert(
          [
            { candidate_id: row.id, role: "PM", total_score: scored.PM.total, breakdown: scored.PM.breakdown },
            { candidate_id: row.id, role: "SPM", total_score: scored.SPM.total, breakdown: scored.SPM.breakdown },
          ],
          { onConflict: "candidate_id,role" }
        );

        const best = scored.PM.total >= scored.SPM.total ? "PM" : "SPM";
        await supabase
          .from("candidates")
          .update({
            best_role: best,
            best_score: best === "PM" ? scored.PM.total : scored.SPM.total,
            status: "scored",
          })
          .eq("id", row.id);

        results.push({
          file: file.name,
          id: row.id,
          name: personal_details.name,
          pm: scored.PM.total,
          spm: scored.SPM.total,
          ok: true,
        });
      } catch (e: any) {
        results.push({ file: file.name, ok: false, error: e.message ?? String(e) });
      }
    }

    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
