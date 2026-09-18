import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
function adminKey() {
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (!raw) throw new Error('Supabase secret keys are not configured.')
  const parsed = JSON.parse(raw)
  if (!parsed?.default) throw new Error('Supabase default secret key is not configured.')
  return parsed.default
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  try {
    const auth = req.headers.get('Authorization') || ''
    if (!auth.startsWith('Bearer ')) return json({ error: 'Authentication required.' }, 401)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const key = adminKey()
    const client = createClient(supabaseUrl, key, { global: { headers: { Authorization: auth } } })
    const admin = createClient(supabaseUrl, key)
    const { data: userData, error: userError } = await client.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Your session has expired. Please sign in again.' }, 401)
    const userId = userData.user.id
    const { data: account } = await admin.from('parent_accounts').select('user_id,active').eq('user_id', userId).maybeSingle()
    const { data: teacher } = await admin.rpc('is_teacher')
    const body = await req.json().catch(() => ({}))
    const orderId = String(body?.order_id || '').trim()
    if (!orderId) return json({ error: 'Order ID is required.' }, 400)
    const { data: order, error: orderError } = await admin.from('orders').select('order_id,student_id,payment_receipt_path,payment_receipt_name,payment_receipt_mime_type').eq('order_id', orderId).maybeSingle()
    if (orderError) throw orderError
    if (!order) return json({ error: 'Order not found.' }, 404)
    let allowed = !!teacher
    if (!allowed && account?.active !== false && account) {
      const { data: link } = await admin.from('parent_students').select('student_id').eq('parent_user_id', userId).eq('student_id', order.student_id).maybeSingle()
      allowed = !!link
    }
    if (!allowed) return json({ error: 'You are not allowed to view this receipt.' }, 403)
    if (!order.payment_receipt_path) return json({ error: 'No receipt has been submitted for this order.' }, 404)
    const { data: signed, error: signedError } = await admin.storage.from('order-payment-receipts').createSignedUrl(order.payment_receipt_path, 600)
    if (signedError) throw signedError
    return json({ success: true, url: signed.signedUrl, name: order.payment_receipt_name, mime_type: order.payment_receipt_mime_type })
  } catch (error) {
    console.error(error)
    return json({ error: error?.message || 'Unable to open the receipt.' }, 500)
  }
})
