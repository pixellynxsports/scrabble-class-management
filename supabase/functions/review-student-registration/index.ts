import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function keys() {
  const pub = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}").default;
  const secret = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default;
  if (!pub || !secret) throw new Error("Supabase server configuration is incomplete.");
  return { pub, secret };
}

async function sendMail(to: string, subject: string, html: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return;
  const from = Deno.env.get("PAYMENT_NOTIFICATION_FROM") || "onboarding@resend.dev";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html })
  });
  if (!res.ok) console.error("Registration approval email failed", await res.text());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const { pub, secret } = keys();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const callerHeader = req.headers.get("Authorization") || "";
    if (!callerHeader.startsWith("Bearer ")) return json({ error: "Teacher authentication required." }, 401);

    const caller = createClient(supabaseUrl, pub, { global: { headers: { Authorization: callerHeader } } });
    const { data: callerUser, error: callerError } = await caller.auth.getUser();
    if (callerError || !callerUser.user) return json({ error: "Your teacher session has expired." }, 401);

    const admin = createClient(supabaseUrl, secret);
    const { data: callerParent } = await admin.from("parent_accounts").select("user_id").eq("user_id", callerUser.user.id).maybeSingle();
    if (callerParent) return json({ error: "Parent accounts cannot review registrations." }, 403);

    const body = await req.json();
    const registrationId = Number(body.registration_id);
    const action = body.action === "reject" ? "reject" : "approve";
    const rejectionReason = String(body.rejection_reason || "").trim();
    if (!Number.isInteger(registrationId) || registrationId < 1) return json({ error: "Registration ID is required." }, 400);

    const { data: registration, error: regError } = await admin.from("student_registrations").select("*").eq("registration_id", registrationId).maybeSingle();
    if (regError) throw regError;
    if (!registration) return json({ error: "Registration not found." }, 404);
    if (registration.status !== "Pending Review") return json({ error: "This registration has already been processed." }, 409);

    if (action === "reject") {
      if (!rejectionReason) return json({ error: "Enter a rejection reason." }, 400);
      const { error } = await admin.from("student_registrations").update({
        status: "Rejected",
        rejection_reason: rejectionReason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: callerUser.user.id
      }).eq("registration_id", registrationId).eq("status", "Pending Review");
      if (error) throw error;
      await sendMail(registration.parent_email, "Banting Scrabble Academy Registration Update", `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><h2>Registration Update</h2><p>Dear ${registration.parent_name},</p><p>The registration for <strong>${registration.student_name}</strong> needs attention.</p><p><strong>Reason:</strong> ${rejectionReason}</p><p>Please contact the teacher if you need help correcting the registration.</p></div>`);
      return json({ success: true, status: "Rejected" });
    }

    const { data: existingStudent } = await admin.from("students").select("student_id").ilike("student_name", registration.student_name).eq("email", registration.parent_email).limit(1).maybeSingle();
    if (existingStudent) return json({ error: "A matching student record already exists. Please review the registration before approving it." }, 409);

    const { data: studentIdData, error: idError } = await admin.rpc("next_student_id_for_registration");
    if (idError) throw idError;
    const studentId = String(studentIdData);

    const studentRow = {
      student_id: studentId,
      student_name: registration.student_name,
      school: registration.school || "",
      age: registration.age,
      scrabble_experience: registration.scrabble_experience || "",
      parent_guardian: registration.parent_name,
      whatsapp: registration.parent_whatsapp || "",
      emergency_contact: "",
      normal_class_time: registration.preferred_class_time,
      email: registration.parent_email,
      registration_date: new Date().toISOString().slice(0,10),
      active: true,
      commitment_confirmed: "No"
    };

    const { error: studentError } = await admin.from("students").insert(studentRow);
    if (studentError) throw studentError;

    if (registration.registration_type === "new_parent") {
      const { error: parentError } = await admin.from("parent_accounts").insert({
        user_id: registration.parent_user_id,
        parent_name: registration.parent_name,
        email: registration.parent_email,
        whatsapp: registration.parent_whatsapp || "",
        active: true,
        must_change_password: false
      });
      if (parentError) {
        await admin.from("students").delete().eq("student_id", studentId);
        throw parentError;
      }
    }

    const { error: linkError } = await admin.from("parent_students").insert({
      parent_user_id: registration.parent_user_id,
      student_id: studentId
    });
    if (linkError) {
      await admin.from("students").delete().eq("student_id", studentId);
      if (registration.registration_type === "new_parent") await admin.from("parent_accounts").delete().eq("user_id", registration.parent_user_id);
      throw linkError;
    }

    const { error: updateError } = await admin.from("student_registrations").update({
      status: "Approved",
      student_id: studentId,
      reviewed_at: new Date().toISOString(),
      reviewed_by: callerUser.user.id,
      rejection_reason: null
    }).eq("registration_id", registrationId).eq("status", "Pending Review");
    if (updateError) {
      await admin.from("parent_students").delete().eq("parent_user_id", registration.parent_user_id).eq("student_id", studentId);
      await admin.from("students").delete().eq("student_id", studentId);
      if (registration.registration_type === "new_parent") await admin.from("parent_accounts").delete().eq("user_id", registration.parent_user_id);
      throw updateError;
    }

    await sendMail(registration.parent_email, "Banting Scrabble Academy Registration Approved", `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><h2>Registration Approved</h2><p>Dear ${registration.parent_name},</p><p>Your registration for <strong>${registration.student_name}</strong> has been approved.</p><p><strong>Student ID:</strong> ${studentId}</p><p>You can now sign in to the Parent Portal using your registered email and password.</p></div>`);
    return json({ success: true, status: "Approved", student_id: studentId });
  } catch (error) {
    console.error("review-student-registration error", error);
    return json({ error: error instanceof Error ? error.message : "Unable to process the registration." }, 500);
  }
});
