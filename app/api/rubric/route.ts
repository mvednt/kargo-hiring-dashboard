import { NextResponse } from "next/server";
import { db } from "../../../lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { data, error } = await db().from("rubric_criteria").select("*").order("sort_order");
    if (error) throw error;
    const out: any = { PM: [], SPM: [] };
    for (const c of data || []) out[(c as any).role]?.push(c);
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
