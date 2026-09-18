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

function normalizePhone(value: string) {
  return value.replace(/[^0-9]/g, '')
}

async function sendWhatsAppReceipt(admin: any, order: any, path: string, file: File) {
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
  const recipientPhone = normalizePhone(Deno.env.get('WHATSAPP_RECIPIENT_PHONE') || '')
  const graphVersion = Deno.env.get('WHATSAPP_GRAPH_VERSION') || 'v23.0'
  if (!accessToken || !phoneNumberId || !recipientPhone) {
    return { status: 'Not Configured' as const, error: 'WhatsApp Cloud API secrets are not configured.' }
  }

  const { data: signed, error: signedError } = await admin.storage
    .from('order-payment-receipts')
    .createSignedUrl(path, 600)
  if (signedError) throw signedError

  const caption = `Payment receipt received\nOrder: ${order.order_id}\nCustomer: ${order.customer_name || '-'}\nAmount: RM${Number(order.total || 0).toFixed(2)}`
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: recipientPhone,
      type: 'document',
      document: {
        link: signed.signedUrl,
        caption,
        filename: file.name
      }
    })
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    console.error('WhatsApp notification failed', result)
    return { status: 'Failed' as const, error: result?.error?.message || `WhatsApp API returned HTTP ${response.status}.` }
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
    if (order.payment_receipt_path || String(order.payment_proof_status || '') === 'Submitted') {
      return json({ error: 'One payment receipt has already been submitted for this order.' }, 409)
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'receipt'
    const digest = await sha256(`${orderId}:${userId}:${Date.now()}:${safeName}`)
    const path = `${orderId}/${digest}_${safeName}`

    const { error: uploadError } = await admin.storage
      .from('order-payment-receipts')
      .upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) throw uploadError

    const whatsapp = await sendWhatsAppReceipt(admin, order, path, file)
    const { error: updateError } = await admin
      .from('orders')
      .update({
        payment_proof_status: 'Submitted',
        payment_receipt_path: path,
        payment_receipt_name: file.name,
        payment_receipt_mime_type: file.type,
        payment_receipt_submitted_at: new Date().toISOString(),
        whatsapp_notification_status: whatsapp.status
      })
      .eq('order_id', orderId)
    if (updateError) {
      await admin.storage.from('order-payment-receipts').remove([path])
      throw updateError
    }

    return json({ success: true, order_id: orderId, payment_proof_status: 'Submitted', whatsapp_notification_status: whatsapp.status, whatsapp_error: whatsapp.error || null })
  } catch (error) {
    console.error(error)
    return json({ error: error?.message || 'Unable to submit the payment receipt.' }, 500)
  }
})
