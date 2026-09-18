import { createClient } from "npm:@supabase/supabase-js@2";

const BILLPLZ_X_SIGNATURE_KEY = Deno.env.get("BILLPLZ_X_SIGNATURE_KEY");
const BILLPLZ_COLLECTION_ID = "jwwusiot";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function hex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

function buildSignatureSource(params: Record<string, string>) {
  return Object.keys(params)
    .filter((key) => key !== "x_signature")
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map((key) => `${key}${params[key]}`)
    .join("|");
}

function isPaid(value: string | undefined) {
  return value === "true" || value === "1" || value === "paid";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!BILLPLZ_X_SIGNATURE_KEY) return json({ error: "Billplz X Signature key is not configured." }, 500);

  try {
    const form = await req.formData();
    const params: Record<string, string> = {};
    for (const [key, value] of form.entries()) params[key] = String(value ?? "");

    const signature = params.x_signature || "";
    if (!signature) return json({ error: "Missing X Signature." }, 400);

    const calculated = await hmacSha256(BILLPLZ_X_SIGNATURE_KEY, buildSignatureSource(params));
    if (calculated.toLowerCase() !== signature.toLowerCase()) return json({ error: "Invalid X Signature." }, 401);

    const billId = params.id || "";
    const collectionId = params.collection_id || "";
    const paid = isPaid(params.paid);
    const state = params.state || "";
    const amount = Number(params.amount || 0);
    const paidAmount = Number(params.paid_amount || 0);
    const transactionId = params.transaction_id || null;

    if (!billId) return json({ error: "Missing Bill ID." }, 400);
    if (collectionId !== BILLPLZ_COLLECTION_ID) return json({ error: "Unexpected Billplz collection." }, 400);

    const secretRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
    if (!secretRaw) return json({ error: "Supabase server key is not configured." }, 500);
    const secretKey = JSON.parse(secretRaw).default;
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, secretKey);

    const { data: request, error: requestError } = await admin
      .from("payment_requests")
      .select("request_key,bill_id,student_id,cycle_number,amount,status")
      .eq("bill_id", billId)
      .maybeSingle();

    if (requestError) return json({ error: requestError.message }, 500);
    if (!request) {
      console.error("Billplz callback received for unknown bill", billId);
      return json({ error: "Unknown Billplz bill." }, 500);
    }

    if (Number(request.amount) !== 50) {
      await admin.from("payment_requests").update({ status: "Failed", error_message: `Unexpected request amount: ${request.amount}` }).eq("bill_id", billId);
      return json({ error: "Unexpected payment request amount." }, 400);
    }

    if (request.status === "Paid") {
      return json({ success: true, processed: true, duplicate: true, payment_id: billId });
    }

    if (!paid || state !== "paid") {
      await admin.from("payment_requests").update({ status: "Failed", transaction_id: transactionId }).eq("bill_id", billId);
      return json({ success: true, processed: false, reason: "Payment not completed." });
    }

    if (amount !== 5000 || (paidAmount !== 0 && paidAmount !== 5000)) {
      await admin.from("payment_requests").update({ status: "Failed", error_message: `Unexpected amount: ${amount}/${paidAmount}` }).eq("bill_id", billId);
      return json({ error: "Unexpected payment amount." }, 400);
    }

    const { data: student, error: studentError } = await admin
      .from("students")
      .select("student_id,active")
      .eq("student_id", request.student_id)
      .maybeSingle();
    if (studentError) return json({ error: studentError.message }, 500);
    if (!student) return json({ error: "Student not found." }, 404);

    const { data: existingPayment } = await admin
      .from("payments")
      .select("payment_id")
      .eq("payment_id", billId)
      .maybeSingle();

    if (existingPayment) {
      await admin.from("payment_requests").update({ status: "Paid", transaction_id: transactionId, paid_at: new Date().toISOString() }).eq("bill_id", billId);
      return json({ success: true, processed: true, duplicate: true, payment_id: billId });
    }

    const paidAt = params.paid_at ? new Date(params.paid_at) : new Date();
    const paymentDate = Number.isNaN(paidAt.getTime()) ? new Date().toISOString().slice(0, 10) : paidAt.toISOString().slice(0, 10);

    const { error: insertError } = await admin.from("payments").insert({
      payment_id: billId,
      student_id: request.student_id,
      cycle_number: request.cycle_number,
      amount: 50,
      payment_date: paymentDate,
      classes_covered: "Next 4 classes",
      status: "Paid",
      notes: `Billplz payment received. Bill ID: ${billId}${transactionId ? ` · Transaction: ${transactionId}` : ""}`,
      attendance_ids_covered: "",
      payment_type: "4-Class Package",
      prepaid: "Yes",
    });

    if (insertError) {
      const { data: duplicateAfterRace } = await admin.from("payments").select("payment_id").eq("payment_id", billId).maybeSingle();
      if (!duplicateAfterRace) {
        console.error("Payment insert failed", insertError);
        return json({ error: "Payment could not be recorded." }, 500);
      }
    }

    await admin.from("payment_requests").update({ status: "Paid", transaction_id: transactionId, paid_at: new Date().toISOString(), error_message: null }).eq("bill_id", billId);

    return json({ success: true, processed: true, payment_id: billId, student_id: request.student_id, cycle_number: request.cycle_number, amount: 50 });
  } catch (error) {
    console.error("billplz-callback error", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected server error." }, 500);
  }
});
