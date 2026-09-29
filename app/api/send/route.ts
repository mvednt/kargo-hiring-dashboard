import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/supabase";
import { personalise } from "../../../lib/pipeline";
import { Resend } from "resend";

export const runtime = "nodejs";

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * The only place an email leaves the building. It is reachable exactly one way:
 * Arjun clicking Confirm on a candidate card. There is no scheduler, no batch
 * send, no "send all". That is the boundary checks 06 and 09 drew.
 */
export async function POST(req: NextRequest) {
  try {
    const { id, subject, body, to } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const supabase = db();
    const { data: c, error } = await supabase.from("candidates").select("*").eq("id", id).single();
    if (error || !c) return NextResponse.json({ error: "candidate not found" }, { status: 404 });
    if (c.email_sent_at) return NextResponse.json({ error: "already sent" }, { status: 409 });

    const name = c.personal_details?.name ?? null;
    const candidateEmail: string | null = c.personal_details?.email ?? null;
    const requested = typeof to === "string" ? to.trim() : "";

    // Safety valve for the build phase. SEND_OVERRIDE_TO redirects the DEFAULT
    // recipient to a test inbox so a hiring rejection cannot reach a stranger by
    // accident. But if Arjun types an address himself, that is a deliberate act
    // by the person accountable for the send, so his choice wins over the valve.
    const override = process.env.SEND_OVERRIDE_TO;

    let recipient: string;
    let redirected = false;

    if (requested && requested !== candidateEmail) {
      if (!EMAIL_OK.test(requested))
        return NextResponse.json({ error: `"${requested}" is not a valid email address` }, { status: 400 });
      recipient = requested;
    } else {
      if (!candidateEmail)
        return NextResponse.json(
          { error: "No email address on this candidate — type one into the To field" },
          { status: 400 }
        );
      recipient = override || candidateEmail;
      redirected = !!override && override !== candidateEmail;
    }

    const baseSubject = personalise(subject || c.draft_email_subject, name);
    const finalSubject = redirected ? `[TEST -> ${candidateEmail}] ${baseSubject}` : baseSubject;
    const finalBody = personalise(body || c.draft_email_body, name);

    const key = process.env.RESEND_API_KEY;
    if (!key) return NextResponse.json({ error: "RESEND_API_KEY not set" }, { status: 500 });

    const resend = new Resend(key);
    const { data: sent, error: sendErr } = await resend.emails.send({
      from: process.env.RESEND_FROM || "Kargo Hiring <onboarding@resend.dev>",
      to: [recipient],
      subject: finalSubject,
      text: finalBody,
    });
    if (sendErr) return NextResponse.json({ error: sendErr.message || String(sendErr) }, { status: 502 });

    await supabase
      .from("candidates")
      .update({
        email_sent_at: new Date().toISOString(),
        resend_id: sent?.id ?? null,
        sent_to: recipient,
        draft_email_subject: baseSubject,
        draft_email_body: finalBody,
        status: "sent",
      })
      .eq("id", id);

    return NextResponse.json({
      ok: true,
      to: recipient,
      redirected,
      intended: candidateEmail,
      id: sent?.id,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
