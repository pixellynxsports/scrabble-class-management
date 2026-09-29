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
  const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject, html }) });
  if (!res.ok) console.error("Registration email failed", await res.text());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const { pub, secret } = keys();
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, secret);
    const body = await req.json();
    const type = body.registration_type === "existing_parent" ? "existing_parent" : "new_parent";
    const parentName = String(body.parent_name || "").trim();
    const email = String(body.parent_email || "").trim().toLowerCase();
    const whatsapp = String(body.parent_whatsapp || "").trim();
    const emergency = String(body.emergency_contact || "").trim();
    const studentName = String(body.student_name || "").trim();
    const school = String(body.school || "").trim();
    const age = body.age ? Number(body.age) : null;
    const experience = String(body.scrabble_experience || "").trim();
    const classTime = String(body.preferred_class_time || "").trim();
    if (!parentName || !email || !studentName || !classTime) return json({ error: "Please complete all required fields." }, 400);
    if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
    if (age !== null && (!Number.isInteger(age) || age < 1 || age > 18)) return json({ error: "Enter a valid student age." }, 400);
    let parentUserId = null;
    if (type === "new_parent") {
      const password = String(body.password || "");
      if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) return json({ error: "Use at least 8 characters with uppercase, lowercase and a number." }, 400);
      const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { account_type: "pending_parent" }, user_metadata: { parent_name: parentName } });
      if (createError || !created.user) return json({ error: createError?.message || "Unable to create the parent account." }, 400);
      parentUserId = created.user.id;
    } else {
      const authHeader = req.headers.get("Authorization") || "";
      if (!authHeader.startsWith("Bearer ")) return json({ error: "Please sign in to your existing Parent account first." }, 401);
      const caller = createClient(Deno.env.get("SUPABASE_URL")!, pub, { global: { headers: { Authorization: authHeader } } });
      const { data: userData, error: userError } = await caller.auth.getUser();
      if (userError || !userData.user) return json({ error: "Your Parent session has expired. Please sign in again." }, 401);
      parentUserId = userData.user.id;
      const { data: account, error: accountError } = await admin.from("parent_accounts").select("user_id,parent_name,email,whatsapp,active").eq("user_id", parentUserId).maybeSingle();
      if (accountError) throw accountError;
      if (!account || account.active === false) return json({ error: "This is not an active Parent account." }, 403);
      if (email !== String(account.email || "").toLowerCase()) return json({ error: "Use the email belonging to your existing Parent account." }, 400);
    }
    const { data: pending, error: pendingError } = await admin.from("student_registrations").select("registration_id").eq("parent_user_id", parentUserId).eq("status", "Pending Review");
    if (pendingError) throw pendingError;
    if ((pending || []).length >= 5) return json({ error: "You already have several registrations waiting for review." }, 429);
    const { data: registration, error: registrationError } = await admin.from("student_registrations").insert({ registration_type: type, parent_user_id: parentUserId, parent_name: parentName, parent_email: email, parent_whatsapp: whatsapp || null, emergency_contact: emergency || null, student_name: studentName, school: school || null, age, scrabble_experience: experience || null, preferred_class_time: classTime }).select("registration_id,status").single();
    if (registrationError) { if (type === "new_parent" && parentUserId) await admin.auth.admin.deleteUser(parentUserId); throw registrationError; }
    await sendMail(email, "Banting Scrabble Academy Registration Received", `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><h2>Registration Received</h2><p>Dear ${parentName},</p><p>Your registration for <strong>${studentName}</strong> has been received and is pending teacher review.</p><p>Status: <strong>Pending Review</strong></p></div>`);
    return json({ success: true, registration_id: registration.registration_id, status: registration.status });
  } catch (error) {
    console.error("submit-student-registration error", error);
    return json({ error: error instanceof Error ? error.message : "Unable to submit the registration." }, 500);
  }
});
