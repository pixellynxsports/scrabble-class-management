import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

function adminKey() {
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (!raw) throw new Error('Supabase secret keys are not configured.')
  const parsed = JSON.parse(raw)
  const key = parsed?.default
  if (!key) throw new Error('Supabase default secret key is not configured.')
  return key
}

async function sha256(text: string) {
  const bytes = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash)).map(x => x.toString(16).padStart(2, '0')).join('')
}

async function sendEmailReceipt(admin: any, order: any, path: string, file: File) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const recipient = Deno.env.get('PAYMENT_NOTIFICATION_EMAIL') || 'pixellynxsports@gmail.com'
  const sender = Deno.env.get('PAYMENT_NOTIFICATION_FROM') || 'onboarding@resend.dev'
  if (!apiKey) return { status: 'Not Configured' as const, error: 'RESEND_API_KEY is not configured.' }

  const { data: signed, error: signedError } = await admin.storage
    .from('order-payment-receipts')
    .createSignedUrl(path, 86400)
  if (signedError) throw signedError

  const amount = `RM${Number(order.total || 0).toFixed(2)}`
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#172033">
      <div style="padding:24px 0;border-bottom:1px solid #e4e7ec">
        <div style="font-size:12px;font-weight:800;letter-spacing:.08em;color:#175cd3">SCRABBLE CLASS MANAGEMENT</div>
        <h2 style="margin:8px 0 0">Payment Receipt Submitted</h2>
      </div>
      <div style="padding:24px 0">
        <p>A parent has submitted a payment receipt for an order. Please review the receipt and bank transaction before confirming payment.</p>
        <table style="width:100%;border-collapse:collapse;margin:18px 0">
          <tr><td style="padding:8px 0;color:#667085">Order ID</td><td style="padding:8px 0;font-weight:700">${order.order_id}</td></tr>
          <tr><td style="padding:8px 0;color:#667085">Customer</td><td style="padding:8px 0;font-weight:700">${order.customer_name || '-'}</td></tr>
          <tr><td style="padding:8px 0;color:#667085">Amount</td><td style="padding:8px 0;font-weight:700">${amount}</td></tr>
          <tr><td style="padding:8px 0;color:#667085">Receipt</td><td style="padding:8px 0">${file.name}</td></tr>
        </table>
        <a href="${signed.signedUrl}" style="display:inline-block;background:#172033;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">View Payment Receipt</a>
        <p style="margin-top:20px;font-size:12px;color:#667085">The receipt link is secure and expires after 24 hours. Payment is still awaiting teacher confirmation.</p>
      </div>
    </div>`

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: sender,
      to: [recipient],
      subject: `Payment Receipt Submitted: ${order.order_id}`,
      html
    })
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    console.error('Email notification failed', result)
    return { status: 'Failed' as const, error: result?.message || result?.error?.message || `Resend returned HTTP ${response.status}.` }
  }
  return { status: 'Sent' as const, error: '' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  try {
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Authentication required.' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = adminKey()
    const userClient = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const admin = createClient(supabaseUrl, serviceKey)

    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Your session has expired. Please sign in again.' }, 401)
    const userId = userData.user.id

    const { data: account, error: accountError } = await admin
      .from('parent_accounts')
      .select('user_id,active')
      .eq('user_id', userId)
      .maybeSingle()
    if (accountError) throw accountError
    if (!account || account.active === false) return json({ error: 'Parent account is not active.' }, 403)

    const form = await req.formData()
    const orderId = String(form.get('order_id') || '').trim()
    const file = form.get('receipt')
    if (!orderId) return json({ error: 'Order ID is required.' }, 400)
    if (!(file instanceof File)) return json({ error: 'Please select one payment receipt.' }, 400)
    if (file.size <= 0) return json({ error: 'The selected receipt is empty.' }, 400)
    if (file.size > 10 * 1024 * 1024) return json({ error: 'Receipt must be 10 MB or smaller.' }, 400)

    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
    if (!allowed.has(file.type)) return json({ error: 'Use JPG, PNG, WEBP or PDF for the receipt.' }, 400)

    const { data: links, error: linkError } = await admin
      .from('parent_students')
      .select('student_id')
      .eq('parent_user_id', userId)
    if (linkError) throw linkError
    const studentIds = (links || []).map(x => x.student_id).filter(Boolean)
    if (!studentIds.length) return json({ error: 'No student is linked to this parent account.' }, 403)

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('order_id,student_id,customer_name,total,payment_status,payment_proof_status,payment_receipt_path,payment_receipt_name')
      .eq('order_id', orderId)
      .maybeSingle()
    if (orderError) throw orderError
    if (!order) return json({ error: 'Order not found.' }, 404)
    if (!order.student_id || !studentIds.includes(order.student_id)) return json({ error: 'You are not allowed to submit proof for this order.' }, 403)
    if (String(order.payment_status || '').toLowerCase() === 'paid') return json({ error: 'This order is already marked Paid.' }, 409)
    const proofStatus = String(order.payment_proof_status || 'Not Submitted')
    if (proofStatus === 'Submitted') return json({ error: 'A payment receipt is already awaiting confirmation for this order.' }, 409)
    if (proofStatus === 'Verified') return json({ error: 'This order is already marked Paid.' }, 409)

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'receipt'
    const digest = await sha256(`${orderId}:${userId}:${Date.now()}:${safeName}`)
    const path = `${orderId}/${digest}_${safeName}`

    const { error: uploadError } = await admin.storage
      .from('order-payment-receipts')
      .upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) throw uploadError

    let notification
    try {
      notification = await sendEmailReceipt(admin, order, path, file)
    } catch (notificationError) {
      console.error('Receipt email exception', notificationError)
      notification = { status: 'Failed' as const, error: notificationError?.message || 'Email notification failed.' }
    }

    const previousPath = order.payment_receipt_path || ''
    const { error: updateError } = await admin
      .from('orders')
      .update({
        payment_proof_status: 'Submitted',
        payment_status: 'Unpaid',
        payment_receipt_path: path,
        payment_receipt_name: file.name,
        payment_receipt_mime_type: file.type,
        payment_receipt_submitted_at: new Date().toISOString(),
        payment_verified_at: null,
        payment_verified_by: null,
        payment_verification_notes: '',
        whatsapp_notification_status: notification.status
      })
      .eq('order_id', orderId)
    if (updateError) {
      await admin.storage.from('order-payment-receipts').remove([path])
      throw updateError
    }
    if (previousPath) await admin.storage.from('order-payment-receipts').remove([previousPath])

    return json({
      success: true,
      order_id: orderId,
      payment_proof_status: 'Submitted',
      notification_status: notification.status,
      notification_error: notification.error || null
    })
  } catch (error) {
    console.error(error)
    return json({ error: error?.message || 'Unable to submit the payment receipt.' }, 500)
  }
})
