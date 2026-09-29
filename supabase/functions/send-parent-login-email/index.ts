import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });

function keys() {
  const pub = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}").default;
  const secret = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default;
  if (!pub || !secret) throw new Error("Supabase server configuration is incomplete.");
  return { pub, secret };
}

function randomPassword(length = 12) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%";
  const all = upper + lower + digits + symbols;
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  const chars = [
    upper[values[0] % upper.length],
    lower[values[1] % lower.length],
    digits[values[2] % digits.length],
    symbols[values[3] % symbols.length]
  ];
  for (let i = chars.length; i < length; i++) chars.push(all[values[i] % all.length]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = values[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const { pub, secret } = keys();
    const authHeader = req.headers.get("Authorization") || "";

    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Please sign in as a teacher." }, 401);
    }

    const caller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      pub,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: callerData, error: callerError } = await caller.auth.getUser();

    if (callerError || !callerData.user) {
      return json({ error: "Your session has expired. Please sign in again." }, 401);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, secret);

    const { data: parentCheck, error: parentCheckError } = await admin
      .from("parent_accounts")
      .select("user_id")
      .eq("user_id", callerData.user.id)
      .maybeSingle();

    if (parentCheckError) throw parentCheckError;

    if (parentCheck) {
      return json({ error: "Parent accounts cannot generate teacher login details." }, 403);
    }

    const body = await req.json();
    const studentId = String(body.student_id || "").trim();

    if (!studentId) return json({ error: "Student ID is required." }, 400);

    const { data: link, error: linkError } = await admin
      .from("parent_students")
      .select("parent_user_id")
      .eq("student_id", studentId)
      .maybeSingle();

    if (linkError) throw linkError;
    if (!link) return json({ error: "No Parent Portal account is linked to this student." }, 404);

    const { data: account, error: accountError } = await admin
      .from("parent_accounts")
      .select("user_id,parent_name,email,active")
      .eq("user_id", link.parent_user_id)
      .maybeSingle();

    if (accountError) throw accountError;
    if (!account || account.active === false) {
      return json({ error: "No active Parent Portal account was found." }, 404);
    }

    const { data: children, error: childrenError } = await admin
      .from("parent_students")
      .select("student_id,students!inner(student_id,student_name)")
      .eq("parent_user_id", account.user_id);

    if (childrenError) throw childrenError;

    const childList = (children || []).map((row: any) => ({
      student_id: row.student_id,
      student_name: row.students?.student_name || row.student_id
    }));

    const password = randomPassword();

    const { error: passwordError } =
      await admin.auth.admin.updateUserById(account.user_id, { password });

    if (passwordError) throw passwordError;

    const { error: flagError } = await admin
      .from("parent_accounts")
      .update({
        must_change_password: true,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", account.user_id);

    if (flagError) throw flagError;

    return json({
      success: true,
      parent_name: account.parent_name,
      email: account.email,
      password,
      children: childList
    });
  } catch (error) {
    console.error("generate parent login details error", error);
    return json({
      error: error instanceof Error
        ? error.message
        : "Unable to generate parent login details."
    }, 500);
  }
});
