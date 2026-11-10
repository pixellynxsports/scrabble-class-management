import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function serverKeys() {
  const publishable = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}").default;
  const secret = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default;
  if (!publishable || !secret) {
    throw new Error("Supabase server keys are not configured.");
  }
  return { publishable, secret };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const authorization = req.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) {
      return json({ error: "Teacher authentication is required." }, 401);
    }

    const { publishable, secret } = serverKeys();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) throw new Error("Supabase URL is not configured.");

    const caller = createClient(supabaseUrl, publishable, {
      global: { headers: { Authorization: authorization } }
    });
    const { data: userData, error: userError } = await caller.auth.getUser();
    if (userError || !userData.user) {
      return json({ error: "Your session has expired. Please sign in again." }, 401);
    }

    // Reuse the existing database teacher-role function. Parent accounts and
    // all other non-teacher users are denied before the admin client runs.
    const { data: isTeacher, error: roleError } = await caller.rpc("is_teacher");
    if (roleError) throw roleError;
    if (isTeacher !== true) {
      return json({ error: "Only an authorised teacher can delete orders." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.order_id || "").trim();
    if (!orderId) return json({ error: "Order ID is required." }, 400);

    const admin = createClient(supabaseUrl, secret);
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("order_id,payment_status,payment_proof_status,payment_receipt_path")
      .eq("order_id", orderId)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return json({ error: "Order not found. Refresh the Orders page and try again." }, 404);

    const paymentStatus = String(order.payment_status || "").trim().toLowerCase();
    const proofStatus = String(order.payment_proof_status || "").trim().toLowerCase();
    if (paymentStatus === "paid" || proofStatus === "verified") {
      return json({
        error: "This order has a paid or verified payment. Archive the order instead of deleting it."
      }, 409);
    }

    const { error: deleteError } = await admin
      .from("orders")
      .delete()
      .eq("order_id", orderId);
    if (deleteError) throw deleteError;

    // Remove the private receipt after the database row has been deleted.
    // Surface a cleanup warning if Storage rejects the removal.
    let receiptCleanupWarning = "";
    if (order.payment_receipt_path) {
      const { error: storageError } = await admin.storage
        .from("order-payment-receipts")
        .remove([order.payment_receipt_path]);
      if (storageError) {
        console.error("Order receipt cleanup failed", storageError);
        receiptCleanupWarning = storageError.message || "Private receipt cleanup failed.";
      }
    }

    return json({
      success: true,
      order_id: orderId,
      receipt_deleted: !receiptCleanupWarning,
      receipt_cleanup_warning: receiptCleanupWarning
    });
  } catch (error) {
    console.error("delete-order error", error);
    return json({
      error: error instanceof Error ? error.message : "Unable to delete the order."
    }, 500);
  }
});
