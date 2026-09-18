import { createClient } from "npm:@supabase/supabase-js@2";

const BILLPLZ_SECRET_KEY = Deno.env.get("BILLPLZ_SECRET_KEY");
const BILLPLZ_COLLECTION_ID = "jwwusiot";
const BILLPLZ_BASE_URL = "https://www.billplz.com/api/v3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getSupabaseKeys() {
  const publishableRaw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  const secretRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!publishableRaw || !secretRaw) throw new Error("Supabase server configuration is incomplete.");
  return {
    publishable: JSON.parse(publishableRaw).default,
    secret: JSON.parse(secretRaw).default,
  };
}

async function getPaymentState(admin: ReturnType<typeof createClient>, studentId: string) {
  const [{ data: payments, error: paymentError }, { data: attendance, error: attendanceError }] = await Promise.all([
    admin.from("payments").select("payment_id,student_id,cycle_number,amount,payment_date,classes_covered,status,attendance_ids_covered,payment_type,prepaid").eq("student_id", studentId).order("cycle_number", { ascending: true }),
    admin.from("attendance").select("attendance_id,student_id,attendance_date,actual_class_time,status").eq("student_id", studentId).eq("status", "Present").order("attendance_date", { ascending: true }),
  ]);

  if (paymentError) throw paymentError;
  if (attendanceError) throw attendanceError;

  const paid = (payments || []).filter((p) => String(p.status || "").toLowerCase() === "paid");
  const present = attendance || [];
  const initialPayment = paid.find((p) =>
    String(p.payment_type || "").toLowerCase() === "initial 4-class package" ||
    String(p.prepaid || "").toLowerCase() === "yes"
  ) || null;
  const initialCycle = Number(initialPayment?.cycle_number) || 1;
  const covered = new Set<string>();

  if (initialPayment) {
    present.slice(0, 4).forEach((a) => covered.add(String(a.attendance_id || "")));
  }

  for (const p of paid) {
    String(p.attendance_ids_covered || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .forEach((id) => covered.add(id));
  }

  const latestPayment = paid[paid.length - 1] || null;
  const latestCycle = Number(latestPayment?.cycle_number) || initialCycle;

  if (initialPayment && latestCycle === initialCycle) {
    const classes = present.slice(0, 4);
    return { progress: classes.length, currentCycle: initialCycle, classes, paid };
  }

  const classes = present.filter((a) => !covered.has(String(a.attendance_id || ""))).slice(0, 4);
  return { progress: classes.length, currentCycle: latestCycle, classes, paid };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    if (!BILLPLZ_SECRET_KEY) return json({ error: "Billplz Secret Key is not configured." }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Missing authentication." }, 401);

    const accessToken = authHeader.substring(7);
    const { publishable, secret } = getSupabaseKeys();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, publishable);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, secret);

    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !user) return json({ error: "Invalid or expired login session." }, 401);

    const body = await req.json();
    const studentId = String(body.student_id || "").trim();
    const requestedRedirectUrl = String(body.redirect_url || "").trim();
    if (!studentId) return json({ error: "Student ID is required." }, 400);

    const { data: parentAccount, error: parentError } = await supabase
      .from("parent_accounts")
      .select("user_id,parent_name,email,whatsapp,active")
      .eq("user_id", user.id)
      .maybeSingle();
    if (parentError) return json({ error: parentError.message }, 500);
    if (!parentAccount) return json({ error: "This account is not registered as a parent account." }, 403);
    if (parentAccount.active === false) return json({ error: "This parent account is inactive." }, 403);

    const { data: link, error: linkError } = await supabase
      .from("parent_students")
      .select("student_id")
      .eq("parent_user_id", user.id)
      .eq("student_id", studentId)
      .maybeSingle();
    if (linkError) return json({ error: linkError.message }, 500);
    if (!link) return json({ error: "You are not authorised to pay for this student." }, 403);

    const { data: student, error: studentError } = await admin
      .from("students")
      .select("student_id,student_name,email,whatsapp,active")
      .eq("student_id", studentId)
      .maybeSingle();
    if (studentError) return json({ error: studentError.message }, 500);
    if (!student) return json({ error: "Student not found." }, 404);
    if (student.active === false) return json({ error: "This student is inactive." }, 400);

    const state = await getPaymentState(admin, studentId);
    if (state.progress < 4) {
      return json({ error: "The current 4-class package is not yet complete." }, 409);
    }

    const nextCycle = Number(state.currentCycle || 0) + 1;
    const requestKey = `${studentId}:cycle:${nextCycle}`;

    const { data: existingRequest } = await admin
      .from("payment_requests")
      .select("request_key,bill_id,bill_url,status,cycle_number,amount")
      .eq("request_key", requestKey)
      .maybeSingle();

    if (existingRequest?.status === "Pending" && existingRequest.bill_url) {
      return json({
        success: true,
        existing: true,
        bill_id: existingRequest.bill_id,
        bill_url: existingRequest.bill_url,
        amount: Number(existingRequest.amount),
        cycle_number: existingRequest.cycle_number,
      });
    }

    if (existingRequest?.status === "Paid") {
      return json({ error: "This package has already been paid." }, 409);
    }

    if (existingRequest?.status === "Failed") {
      const { error: resetError } = await admin
        .from("payment_requests")
        .update({ status: "Pending", bill_id: null, bill_url: null, error_message: null, transaction_id: null, paid_at: null })
        .eq("request_key", requestKey);
      if (resetError) return json({ error: resetError.message }, 500);
    } else if (!existingRequest) {
      const { error: insertError } = await admin
        .from("payment_requests")
        .insert({ request_key: requestKey, student_id: studentId, cycle_number: nextCycle, amount: 50, status: "Pending" });
      if (insertError) {
        const { data: raced } = await admin
          .from("payment_requests")
          .select("bill_id,bill_url,status,cycle_number,amount")
          .eq("request_key", requestKey)
          .maybeSingle();
        if (raced?.status === "Pending" && raced.bill_url) {
          return json({ success: true, existing: true, bill_id: raced.bill_id, bill_url: raced.bill_url, amount: Number(raced.amount), cycle_number: raced.cycle_number });
        }
        return json({ error: insertError.message }, 500);
      }
    }

    const email = student.email || parentAccount.email || "";
    const mobile = student.whatsapp || parentAccount.whatsapp || "";
    if (!email && !mobile) return json({ error: "A parent email or mobile number is required for payment." }, 400);

    const form = new URLSearchParams();
    form.set("collection_id", BILLPLZ_COLLECTION_ID);
    form.set("name", student.student_name);
    form.set("amount", "5000");
    form.set("description", `Scrabble Class Package - ${studentId} - Cycle ${nextCycle}`);
    form.set("callback_url", `${Deno.env.get("SUPABASE_URL")}/functions/v1/billplz-callback`);
    form.set("reference_1_label", "Student ID");
    form.set("reference_1", studentId);
    form.set("reference_2_label", "Cycle");
    form.set("reference_2", String(nextCycle));
    if (requestedRedirectUrl) {
      try {
        const redirect = new URL(requestedRedirectUrl);
        const origin = new URL(req.headers.get("origin") || "");
        if (redirect.origin === origin.origin) form.set("redirect_url", requestedRedirectUrl);
      } catch {
        // Ignore malformed or cross-origin redirect URLs.
      }
    }
    if (email) form.set("email", email);
    if (mobile) form.set("mobile", mobile);

    const basicAuth = btoa(`${BILLPLZ_SECRET_KEY}:`);
    const response = await fetch(`${BILLPLZ_BASE_URL}/bills`, {
      method: "POST",
      headers: { Authorization: `Basic ${basicAuth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    const bill = await response.json();
    if (!response.ok) {
      await admin.from("payment_requests").update({ status: "Failed", error_message: JSON.stringify(bill) }).eq("request_key", requestKey);
      console.error("Billplz create bill error", bill);
      return json({ error: bill?.error?.message || bill?.error || bill?.message || "Billplz failed to create the payment bill." }, 502);
    }

    const { error: updateError } = await admin
      .from("payment_requests")
      .update({ bill_id: bill.id, bill_url: bill.url, status: "Pending", error_message: null })
      .eq("request_key", requestKey);
    if (updateError) return json({ error: "Payment was created but could not be linked safely. Please contact the teacher before trying again." }, 500);

    return json({ success: true, bill_id: bill.id, bill_url: bill.url, amount: 50, currency: "MYR", student_id: studentId, cycle_number: nextCycle });
  } catch (error) {
    console.error("create-class-payment error", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected server error." }, 500);
  }
});
