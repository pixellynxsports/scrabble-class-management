/* Scrabble Class Management, Supabase online version */
let DATA={students:[],attendance:[],payments:[],orders:[],config:{fee:50,classesPerCycle:4,classTimes:['10:30 AM','2:00 PM']}};
let orderTab='Scrabble Set';let currentProfileId='';let studentView='active';let selectedOrderIds=new Set();
const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const isoDate=d=>{const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`};
const CLASS_START_DATE='2026-09-06';
function latestSunday(d=new Date()){const x=new Date(d);x.setHours(12,0,0,0);x.setDate(x.getDate()-x.getDay());const start=new Date(CLASS_START_DATE+'T12:00:00');return x<start?start:x}
const supabaseClient=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY);
let authReady=false;
let loginMode='teacher';
let currentUserRole='teacher';
let PARENT_CONTEXT={account:null,students:[]};
let parentEntryNoticeShown=false;
let parentNoticeTimer=null;
let authInitialised=false;
const parentPaymentReturn=new URLSearchParams(window.location.search).get('payment_return')==='1';
let parentPaymentProcessing=false;
let parentPaymentReturnHandled=false;
function dbError(error){if(!error)return null;return new Error(error.message||'Supabase request failed.');}
function nextLocalId(prefix,items,key){let max=0;items.forEach(x=>{const m=String(x[key]||'').match(/(\d+)$/);if(m)max=Math.max(max,Number(m[1]));});return prefix+String(max+1).padStart(3,'0')}
function studentFromDb(r){return {'Student ID':r.student_id,'Student Name':r.student_name,'School':r.school||'','Age':r.age??'','Scrabble Experience':r.scrabble_experience||'','Parent / Guardian':r.parent_guardian||'','WhatsApp':r.whatsapp||'','Emergency Contact':r.emergency_contact||'','Normal Class Time':r.normal_class_time||'','Email':r.email||'','Registration Date':r.registration_date||'','Active':r.active===false?'No':'Yes','Commitment Confirmed':r.commitment_confirmed||'No','Google Form Row':r.google_form_row??'','Form Source Hash':r.form_source_hash||''}}
function attendanceFromDb(r){return {'Attendance ID':r.attendance_id,'Student ID':r.student_id,'Date':r.attendance_date,'Actual Class Time':r.actual_class_time||'','Status':r.status,'Notes':r.notes||'','Created':r.created_at||'','Updated':r.updated_at||''}}
function paymentFromDb(r){return {'Payment ID':r.payment_id,'Student ID':r.student_id,'Cycle Number':r.cycle_number,'Amount':r.amount,'Payment Date':r.payment_date,'Classes Covered':r.classes_covered||'','Status':r.status,'Notes':r.notes||'','Attendance IDs Covered':r.attendance_ids_covered||'','Payment Type':r.payment_type||'','Prepaid':r.prepaid||''}}
function orderFromDb(r){return {'Order ID':r.order_id,'Student ID':r.student_id||'','Customer Name':r.customer_name||'','Phone':r.phone||'','Product':r.product||'','Size':r.size||'','Quantity':r.quantity||1,'Unit Price':r.unit_price||0,'Total':r.total||0,'Interest':r.interest||'Yes','Order Status':r.order_status||'Pending Order','Payment Status':r.payment_status||'Unpaid','Payment Proof Status':r.payment_proof_status||'Not Submitted','Payment Receipt Path':r.payment_receipt_path||'','Payment Receipt Name':r.payment_receipt_name||'','Payment Receipt Mime Type':r.payment_receipt_mime_type||'','Payment Receipt Submitted At':r.payment_receipt_submitted_at||'','Payment Verified At':r.payment_verified_at||'','Payment Verified By':r.payment_verified_by||'','Payment Verification Notes':r.payment_verification_notes||'','WhatsApp Notification Status':r.whatsapp_notification_status||'Not Sent','Collection Status':r.collection_status||'Not Collected','Order Date':r.order_date||'','Notes':r.notes||'','Source':r.source||'','Google Form Row':r.google_form_row??'','Archived':r.archived===true?'Yes':'No','Form Source Hash':r.form_source_hash||''}}
async function loadRemoteData(){
  const [s,a,p,o,settings]=await Promise.all([
    supabaseClient.from('students').select('*').order('student_name'),
    supabaseClient.from('attendance').select('*').order('attendance_date',{ascending:false}),
    supabaseClient.from('payments').select('*').order('payment_date',{ascending:false}),
    supabaseClient.from('orders').select('*').order('order_date',{ascending:false}),
    supabaseClient.from('settings').select('*')
  ]);
  for(const result of [s,a,p,o,settings]){if(result.error)throw dbError(result.error)}
  const cfg={fee:50,classesPerCycle:4,classTimes:['10:30 AM','2:00 PM']};
  settings.data?.forEach(x=>{if(x.setting==='fee')cfg.fee=Number(x.value)||50;if(x.setting==='classesPerCycle')cfg.classesPerCycle=Number(x.value)||4;if(x.setting==='classTimes'){try{const v=JSON.parse(x.value);if(Array.isArray(v)&&v.length)cfg.classTimes=v}catch(e){}}});
  return {students:(s.data||[]).map(studentFromDb),attendance:(a.data||[]).map(attendanceFromDb),payments:(p.data||[]).map(paymentFromDb),orders:(o.data||[]).map(orderFromDb),config:cfg};
}
async function refreshOnline(silent=false){if(currentUserRole==='parent'){await loadParentPortal();return;}try{DATA=await loadRemoteData();document.getElementById('connection').textContent='● Online';document.getElementById('connection').classList.remove('off');renderAll();if(!silent)alert('Online data refreshed.')}catch(e){document.getElementById('connection').textContent='● Connection error';document.getElementById('connection').classList.add('off');if(!silent)alert(e.message||e);throw e}}
async function getCurrentParentAccount(){const {data,error}=await supabaseClient.auth.getUser();if(error)throw dbError(error);const uid=data.user?.id;if(!uid)throw new Error('Your session has expired. Please sign in again.');const {data:account,error:accountError}=await supabaseClient.from('parent_accounts').select('user_id,parent_name,email,whatsapp,active').eq('user_id',uid).maybeSingle();if(accountError)throw dbError(accountError);return account;}
async function loadParentPortal(){const account=await getCurrentParentAccount();if(!account)throw new Error('This account is not registered as a parent account.');if(account.active===false)throw new Error('This parent account is inactive. Please contact the teacher.');const {data:links,error:linkError}=await supabaseClient.from('parent_students').select('student_id').eq('parent_user_id',account.user_id);if(linkError)throw dbError(linkError);const ids=(links||[]).map(x=>x.student_id).filter(Boolean);let students=[],attendance=[],payments=[],orders=[];if(ids.length){const [s,a,p,o]=await Promise.all([supabaseClient.from('students').select('student_id,student_name,school,age,scrabble_experience,parent_guardian,whatsapp,normal_class_time,email,registration_date,active').in('student_id',ids).order('student_name'),supabaseClient.from('attendance').select('*').in('student_id',ids).order('attendance_date',{ascending:false}),supabaseClient.from('payments').select('*').in('student_id',ids).order('payment_date',{ascending:false}),supabaseClient.from('orders').select('*').in('student_id',ids).eq('archived',false).order('order_date',{ascending:false})]);for(const result of [s,a,p,o]){if(result.error)throw dbError(result.error)}students=s.data||[];attendance=(a.data||[]).map(attendanceFromDb);payments=(p.data||[]).map(paymentFromDb);orders=(o.data||[]).map(orderFromDb);}PARENT_CONTEXT={account,students,attendance,payments,orders,selectedStudentId:ids[0]||''};renderParentPortal();setConnection('● Online',false);if(parentPaymentReturn&&!parentPaymentReturnHandled&&!parentPaymentProcessing){parentPaymentReturnHandled=true;checkReturnedPayment();}}
function calculatePaymentState(payments,attendance,sid){
  const paid=payments
    .filter(p=>String(p['Student ID'])===String(sid)&&String(p.Status||'').toLowerCase()==='paid')
    .sort((a,b)=>(Number(a['Cycle Number'])||0)-(Number(b['Cycle Number'])||0));
  const present=attendance
    .filter(a=>String(a['Student ID'])===String(sid)&&a.Status==='Present')
    .sort((a,b)=>attendanceDateKey(a.Date).localeCompare(attendanceDateKey(b.Date)));

  const initialPayment=paid.find(p=>
    String(p['Payment Type']||'').toLowerCase()==='initial 4-class package' ||
    String(p.Prepaid||'').toLowerCase()==='yes'
  )||null;
  const initialCycle=Number(initialPayment?.['Cycle Number'])||1;
  const covered=new Set();

  // The imported initial package has no attendance IDs. Its first four
  // Present records therefore belong to the prepaid package.
  if(initialPayment){
    present.slice(0,4).forEach(a=>{
      const id=String(a['Attendance ID']||'');
      if(id)covered.add(id);
    });
  }

  // Later paid cycles identify the attendance records they cover.
  paid.forEach(p=>String(p['Attendance IDs Covered']||'')
    .split(',').map(x=>x.trim()).filter(Boolean)
    .forEach(id=>covered.add(id)));

  const latestPayment=paid[paid.length-1]||null;
  const latestCycle=Number(latestPayment?.['Cycle Number'])||initialCycle;

  // While the initial prepaid package is active, its first four Present
  // records form the current package.
  if(initialPayment && latestCycle===initialCycle){
    const classes=present.slice(0,4);
    const progress=classes.length;
    return {
      classes,
      progress,
      status:progress>=4?'Payment Due':progress===3?'Almost Due':'Paid',
      coveredIds:covered,
      currentCycle:initialCycle,
      paid,
      activePrepaid:progress<4,
      lastPayment:latestPayment
    };
  }

  // For later cycles, Present records not covered by a paid payment belong
  // to the current package. A completed package therefore reaches 4 / 4 and
  // shows Payment Due until the next payment covers those four records.
  const currentClasses=present.filter(a=>!covered.has(String(a['Attendance ID']||'')));
  const classes=currentClasses.slice(0,4);
  const progress=classes.length;
  const status=progress>=4?'Payment Due':progress===3?'Almost Due':'Paid';

  return {
    classes,
    progress,
    status,
    coveredIds:covered,
    currentCycle:latestCycle,
    paid,
    activePrepaid:false,
    lastPayment:latestPayment
  };
}
function parentPaymentState(sid){
  return calculatePaymentState(PARENT_CONTEXT.payments,PARENT_CONTEXT.attendance,sid);
}
function parentStatusBadge(state){const cls=state.status==='Payment Due'?'absent':state.status==='Almost Due'?'almost':'present';return `<span class="badge ${cls}">${esc(state.status)}</span>`}
function selectParentChild(id){PARENT_CONTEXT.selectedStudentId=String(id);renderParentPortal();}
function parentPackagePaymentButton(state,extraClass=''){
  const active=state.status==='Payment Due';
  return `<button class="parent-pay-btn ${active?'active':'ghost'} ${extraClass}" ${active?`onclick="openParentClassPayment()"`:'disabled'}>Pay</button>`;
}
function renderActionRequired(state){
  const box=document.getElementById('parentActionRequired');
  if(!box)return;
  if(state.status==='Payment Due'){
    box.innerHTML=`<div class="action-required action-due"><div class="action-icon">!</div><div class="action-copy"><div class="eyebrow">ACTION REQUIRED</div><h3>Your 4-class package is complete.</h3><p>Please make payment for the next 4-class package.</p></div><div class="action-side"><strong>RM50</strong>${parentPackagePaymentButton(state,'action-pay')}</div></div>`;
    box.classList.remove('hidden');
    if(parentNoticeTimer){clearTimeout(parentNoticeTimer);parentNoticeTimer=null;}
    return;
  }
  if(parentEntryNoticeShown){box.innerHTML=`<div class="action-required action-ok"><div class="action-icon">✓</div><div class="action-copy"><div class="eyebrow">STATUS</div><h3>Everything up to date</h3></div></div>`;box.classList.remove('hidden');parentEntryNoticeShown=false;if(parentNoticeTimer)clearTimeout(parentNoticeTimer);parentNoticeTimer=setTimeout(()=>box.classList.add('hidden'),10000);}
  else box.classList.add('hidden');
}
function openParentPanel(type){
  const modal=document.getElementById('parentDetailModal');
  const body=document.getElementById('parentDetailBody');
  if(!modal||!body)return;
  const s=PARENT_CONTEXT.students.find(x=>String(x.student_id)===String(PARENT_CONTEXT.selectedStudentId));
  if(!s)return;
  const sid=String(s.student_id);
  const attendance=PARENT_CONTEXT.attendance.filter(a=>String(a['Student ID'])===sid).sort((a,b)=>attendanceDateKey(b.Date).localeCompare(attendanceDateKey(a.Date)));
  const payments=PARENT_CONTEXT.payments.filter(p=>String(p['Student ID'])===sid).sort((a,b)=>new Date(b['Payment Date'])-new Date(a['Payment Date']));
  const orders=PARENT_CONTEXT.orders.filter(o=>String(o['Student ID'])===sid&&!['yes','true'].includes(String(o.Archived||'').toLowerCase())).sort((a,b)=>new Date(b['Order Date'])-new Date(a['Order Date']));
  const state=parentPaymentState(sid);
  let title='',eyebrow='',content='';
  if(type==='package'){
    title='Current Package';eyebrow='4-CLASS PACKAGE';
    const rows=state.classes.map((a,i)=>`<div class="detail-list-row"><div class="detail-index">${i+1}</div><div class="detail-main"><b>${esc(formatDateClient(a.Date))}</b><small>${esc(a['Actual Class Time']||'Class time not recorded')}</small></div><span class="badge present">Present</span></div>`).join('')||'<div class="empty">No Present classes in the current package yet.</div>';
    content=`<div class="detail-summary-grid"><div><small>Current Cycle</small><strong>${esc(state.currentCycle)}</strong></div><div><small>Classes Used</small><strong>${state.progress} / 4</strong></div><div><small>Remaining</small><strong>${Math.max(0,4-state.progress)}</strong></div><div><small>Status</small>${parentStatusBadge(state)}</div></div><div class="parent-progress large"><div style="width:${Math.min(100,state.progress/4*100)}%"></div></div><div class="detail-section-head"><h3>Classes in this package</h3>${parentPackagePaymentButton(state)}</div><div class="detail-list">${rows}</div>`;
  }else if(type==='attendance'){
    title='Attendance History';eyebrow='ATTENDANCE';
    const present=attendance.filter(a=>a.Status==='Present').length, absent=attendance.filter(a=>a.Status==='Absent').length;
    content=`<div class="detail-summary-grid"><div><small>Total Records</small><strong>${attendance.length}</strong></div><div><small>Present</small><strong>${present}</strong></div><div><small>Absent</small><strong>${absent}</strong></div><div><small>Attendance Rate</small><strong>${attendance.length?Math.round(present/attendance.length*100):0}%</strong></div></div><div class="detail-list">${attendance.map(a=>`<div class="detail-list-row"><div class="detail-main"><b>${esc(formatDateClient(a.Date))}</b><small>${esc(a['Actual Class Time']||'')}</small></div>${a.Status==='Present'?'<span class="badge present">Present</span>':a.Status==='Absent'?'<span class="badge absent">Absent</span>':'<span class="badge neutral">Not marked</span>'}</div>`).join('')||'<div class="empty">No attendance records yet.</div>'}</div>`;
  }else if(type==='payments'){
    title='Payment History';eyebrow='PAYMENTS';
    content=`<div class="detail-list">${payments.map(p=>`<div class="detail-list-row payment-detail-row"><div class="detail-main"><b>Cycle ${esc(p['Cycle Number']||'-')}</b><small>${esc(formatDateClient(p['Payment Date']))} · ${esc(p['Classes Covered']||'')}</small></div><div class="detail-right"><strong>RM${esc(p.Amount||0)}</strong><span class="badge ${String(p.Status||'').toLowerCase()==='paid'?'paid':'absent'}">${esc(p.Status||'')}</span></div></div>`).join('')||'<div class="empty">No payment records yet.</div>'}</div>`;
  }else if(type==='orders'){
    title='My Orders';eyebrow='ORDERS';
    content=`<div class="detail-list">${orders.map(o=>`<button class="order-detail-row" onclick="openParentOrderDetail('${esc(o['Order ID'])}')"><div class="detail-main"><b>${esc(o.Product||'Order')}</b><small>${o.Product==='T Shirt'?`Size ${esc(o.Size||'-')} · `:''}Qty ${esc(o.Quantity||1)} · ${esc(formatDateClient(o['Order Date']))}</small></div><div class="detail-right"><strong>RM${esc(o.Total||0)}</strong><span class="badge ${String(o['Payment Status']||'').toLowerCase()==='paid'?'paid':'absent'}">${esc(o['Payment Status']||'')}</span></div><span class="detail-chevron">›</span></button>`).join('')||'<div class="empty">No orders recorded.</div>'}</div>`;
  }
  document.getElementById('parentDetailEyebrow').textContent=eyebrow;document.getElementById('parentDetailTitle').textContent=title;body.innerHTML=content;modal.classList.remove('hidden');document.body.classList.add('modal-open');
}
function closeParentPanel(){document.getElementById('parentDetailModal')?.classList.add('hidden');document.body.classList.remove('modal-open');}
async function openParentClassPayment(){
  const body=document.getElementById('parentDetailBody');
  if(!body)return;
  const s=PARENT_CONTEXT.students.find(x=>String(x.student_id)===String(PARENT_CONTEXT.selectedStudentId));
  if(!s)return;
  const state=parentPaymentState(s.student_id);
  if(state.status!=='Payment Due' || parentPaymentProcessing)return;
  document.getElementById('parentDetailEyebrow').textContent='CLASS PACKAGE PAYMENT';
  document.getElementById('parentDetailTitle').textContent='Pay RM50';
  body.innerHTML=`<div class="payment-gateway-card">
    <div class="payment-gateway-icon">RM</div>
    <div><h3>4-class package payment</h3>
    <p>Student: <strong>${esc(s.student_name)}</strong></p>
    <p>Your current package is complete. The next package fee is RM50.</p></div>
    <div class="payment-method-row"><span>Payment method</span><strong>FPX · Online Banking</strong></div>
    <div class="payment-order-summary">
      <div><span>Current cycle</span><strong>${esc(state.currentCycle)}</strong></div>
      <div><span>Classes completed</span><strong>${state.progress} / 4</strong></div>
      <div><span>Amount</span><strong>RM50</strong></div>
    </div>
    <div class="payment-gateway-note">You will be taken to the secure Billplz payment page to choose your bank and complete the FPX payment.</div>
    <button class="primary payment-proceed-btn" id="parentRealPayButton" onclick="startParentClassPayment()">Continue to secure payment</button>
    <div class="payment-security-note">Your Billplz payment is processed on the secure Billplz payment page. Your bank credentials are never entered into this portal.</div>
  </div>`;
  document.getElementById('parentDetailModal')?.classList.remove('hidden');
  document.body.classList.add('modal-open');
}

async function startParentClassPayment(){
  if(parentPaymentProcessing)return;
  const s=PARENT_CONTEXT.students.find(x=>String(x.student_id)===String(PARENT_CONTEXT.selectedStudentId));
  if(!s)return;
  const state=parentPaymentState(s.student_id);
  if(state.status!=='Payment Due')return;

  const button=document.getElementById('parentRealPayButton');
  parentPaymentProcessing=true;
  if(button){button.disabled=true;button.textContent='Creating secure payment...';}

  try{
    const redirectUrl=window.location.origin+window.location.pathname+'?payment_return=1';
    const {data,error}=await supabaseClient.functions.invoke('create-class-payment',{
      body:{student_id:String(s.student_id),redirect_url:redirectUrl}
    });
    if(error)throw new Error(error.message||'Unable to start the payment.');
    if(!data?.success || !data?.bill_url)throw new Error(data?.error||'Billplz did not return a payment link.');
    window.location.assign(data.bill_url);
  }catch(e){
    parentPaymentProcessing=false;
    if(button){button.disabled=false;button.textContent='Continue to secure payment';}
    alert(e.message||'Unable to start the payment. Please try again.');
  }
}

function showPaymentReturnNotice(){
  if(!parentPaymentReturn)return;
  const box=document.getElementById('parentActionRequired');
  if(!box)return;
  box.innerHTML=`<div class="action-required action-payment-return"><div class="action-icon">✓</div><div class="action-copy"><div class="eyebrow">PAYMENT RETURNED</div><h3>We are checking your payment.</h3><p>Billplz has returned you to the Parent Portal. Your payment status will update after the secure confirmation reaches our system.</p></div></div>`;
  box.classList.remove('hidden');
}

async function checkReturnedPayment(){
  if(!parentPaymentReturn || currentUserRole!=='parent')return;
  showPaymentReturnNotice();
  for(let i=0;i<4;i++){
    await new Promise(resolve=>setTimeout(resolve,1500));
    try{await loadParentPortal();}catch(e){console.error('Payment return refresh failed',e);}
    const s=PARENT_CONTEXT.students.find(x=>String(x.student_id)===String(PARENT_CONTEXT.selectedStudentId));
    if(s && parentPaymentState(s.student_id).status!=='Payment Due')break;
  }
  try{history.replaceState({},document.title,window.location.pathname);}catch(e){}
}
function orderPaymentDisplay(order){
  const proof=String(order?.['Payment Proof Status']||'Not Submitted');
  const paid=String(order?.['Payment Status']||'').toLowerCase()==='paid';
  if(paid||proof==='Verified')return {label:'Paid',badge:'paid'};
  if(proof==='Submitted')return {label:'Awaiting Confirmation',badge:'almost'};
  return {label:'Unpaid',badge:'absent'};
}

function openParentOrderDetail(id){
  const order=PARENT_CONTEXT.orders.find(o=>String(o['Order ID'])===String(id));if(!order)return;
  document.getElementById('parentDetailEyebrow').textContent='ORDER DETAILS';document.getElementById('parentDetailTitle').textContent=order.Product||'Order';
  const proof=String(order['Payment Proof Status']||'Not Submitted');
  const payment=orderPaymentDisplay(order);
  const proofBadge=proof==='Submitted'?'<span class="badge almost">Proof Submitted</span>':proof==='Verified'?'<span class="badge paid">Verified</span>':proof==='Rejected'?'<span class="badge absent">Rejected</span>':'<span class="badge neutral">Not Submitted</span>';
  const paymentArea=payment.label==='Paid'?'<div class="payment-confirmed">✓ Payment received and verified</div>':proof==='Submitted'?`<div class="payment-proof-pending"><b>Payment proof submitted</b><small>Your receipt has been received. Payment is awaiting teacher confirmation.</small>${order['Payment Receipt Name']?`<div class="subtle">${esc(order['Payment Receipt Name'])}</div>`:''}</div>`:proof==='Rejected'?`<div class="payment-proof-pending rejected"><b>Payment proof was rejected</b><small>Please submit a new receipt after checking your payment details.</small>${order['Payment Verification Notes']?`<div class="subtle">Reason: ${esc(order['Payment Verification Notes'])}</div>`:''}<button class="primary" style="margin-top:12px" onclick="showOrderQr('${esc(order['Order ID'])}')">Submit New Receipt</button></div>`:`<div class="order-pay-area"><div><b>Payment required</b><small>Scan the Pixel Lynx Sports Enterprise DuitNow QR, then upload one payment receipt.</small></div><button class="primary" onclick="showOrderQr('${esc(order['Order ID'])}')">Pay</button></div>`;
  document.getElementById('parentDetailBody').innerHTML=`<div class="order-detail-card"><div class="detail-summary-grid order-summary"><div><small>Order ID</small><strong>${esc(order['Order ID'])}</strong></div><div><small>Total</small><strong>RM${esc(order.Total||0)}</strong></div><div><small>Payment</small><span class="badge ${payment.badge}">${esc(payment.label)}</span></div><div><small>Payment Proof</small>${proofBadge}</div></div><div class="order-info-grid"><div><small>Product</small><b>${esc(order.Product||'-')}</b></div><div><small>Size</small><b>${order.Product==='T Shirt'?esc(order.Size||'-'):'-'}</b></div><div><small>Quantity</small><b>${esc(order.Quantity||1)}</b></div><div><small>Unit Price</small><b>RM${esc(order['Unit Price']||0)}</b></div><div><small>Order Date</small><b>${esc(formatDateClient(order['Order Date']))}</b></div><div><small>Order Status</small><b>${esc(order['Order Status']||'-')}</b></div></div>${paymentArea}</div>`;
}

function showOrderQr(orderId){
  const order=PARENT_CONTEXT.orders.find(o=>String(o['Order ID'])===String(orderId));if(!order)return;
  document.getElementById('parentDetailEyebrow').textContent='ORDER PAYMENT';document.getElementById('parentDetailTitle').textContent='DuitNow QR Payment';
  document.getElementById('parentDetailBody').innerHTML=`<div class="qr-payment-card"><h3>Pay your order</h3><p>Scan the QR code below to make payment to <strong>Pixel Lynx Sports Enterprise</strong>.</p><div class="qr-order-amount">Order ${esc(order['Order ID'])} · <b>RM${esc(order.Total||0)}</b></div><img src="assets/pixel-lynx-duitnow-qr.jpeg" alt="Pixel Lynx Sports Enterprise DuitNow QR"><div class="qr-note">After payment, choose your bank receipt below. Upload one receipt, then click <strong>Complete Payment</strong>. Payment stays pending until the teacher verifies the bank transaction.</div><div class="receipt-upload-box"><label for="orderReceiptInput"><b>Upload payment receipt</b><span>One receipt only · JPG, PNG, WEBP or PDF · up to 10 MB</span></label><input id="orderReceiptInput" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onchange="prepareOrderReceipt()"><button class="primary complete-payment-btn" id="completeOrderPaymentBtn" type="button" disabled onclick="submitOrderReceipt('${esc(order['Order ID'])}')">Complete Payment</button><div id="orderReceiptStatus" class="subtle"></div></div></div>`;
}

function prepareOrderReceipt(){
  const input=document.getElementById('orderReceiptInput');const button=document.getElementById('completeOrderPaymentBtn');const status=document.getElementById('orderReceiptStatus');const file=input?.files?.[0];
  if(!file){if(button)button.disabled=true;if(status)status.textContent='';return;}
  if(file.size>10*1024*1024){alert('Receipt must be 10 MB or smaller.');input.value='';if(button)button.disabled=true;return;}
  const allowed=['image/jpeg','image/png','image/webp','application/pdf'];if(!allowed.includes(file.type)){alert('Use JPG, PNG, WEBP or PDF for the receipt.');input.value='';if(button)button.disabled=true;return;}
  if(button)button.disabled=false;if(status)status.textContent=`Selected: ${file.name}`;
}

async function submitOrderReceipt(orderId){
  const input=document.getElementById('orderReceiptInput');const button=document.getElementById('completeOrderPaymentBtn');const status=document.getElementById('orderReceiptStatus');const file=input?.files?.[0];if(!file)return;
  if(file.size>10*1024*1024){alert('Receipt must be 10 MB or smaller.');input.value='';if(button)button.disabled=true;return;}
  const allowed=['image/jpeg','image/png','image/webp','application/pdf'];if(!allowed.includes(file.type)){alert('Use JPG, PNG, WEBP or PDF for the receipt.');input.value='';if(button)button.disabled=true;return;}
  if(button){button.disabled=true;button.textContent='Submitting...';}if(input)input.disabled=true;if(status)status.textContent='Uploading receipt and submitting payment proof...';
  try{
    const form=new FormData();form.append('order_id',String(orderId));form.append('receipt',file,file.name);
    const {data,error}=await supabaseClient.functions.invoke('submit-order-payment-proof',{body:form});
    if(error)throw new Error(error.message||'Unable to submit the receipt.');
    if(!data?.success)throw new Error(data?.error||'Unable to submit the receipt.');
    await loadParentPortal();
    const fresh=PARENT_CONTEXT.orders.find(o=>String(o['Order ID'])===String(orderId));
    if(fresh)openParentOrderDetail(orderId);
  }catch(e){if(status)status.textContent='';if(input)input.disabled=false;if(button){button.disabled=false;button.textContent='Complete Payment';}alert(e.message||'Unable to submit the receipt.');}
}
function renderParentPortal(){
  document.querySelector('.app')?.classList.add('hidden');document.getElementById('parentPortal')?.classList.remove('hidden');
  const account=PARENT_CONTEXT.account||{};const welcome=document.getElementById('parentWelcome');if(welcome)welcome.textContent=`Welcome, ${account.parent_name||'Parent'}.`;
  const selector=document.getElementById('parentChildren'),dashboard=document.getElementById('parentDashboard');if(!selector||!dashboard)return;
  if(!PARENT_CONTEXT.students.length){selector.innerHTML='';dashboard.innerHTML='<div class="parent-card"><div class="empty">No student is linked to this parent account yet. Please contact the teacher.</div></div>';return;}
  if(!PARENT_CONTEXT.students.some(s=>String(s.student_id)===String(PARENT_CONTEXT.selectedStudentId)))PARENT_CONTEXT.selectedStudentId=PARENT_CONTEXT.students[0].student_id;
  selector.innerHTML=`<div class="parent-card"><div class="eyebrow">MY CHILDREN</div><h2>Select a child</h2><div class="parent-child-tabs">${PARENT_CONTEXT.students.map(s=>{const active=String(s.student_id)===String(PARENT_CONTEXT.selectedStudentId);return `<button class="parent-child-tab ${active?'active':''}" onclick="selectParentChild('${esc(s.student_id)}')"><span>${esc(s.student_name)}</span><small>${esc(s.student_id)} · ${esc(s.normal_class_time||'Class time not recorded')}</small></button>`}).join('')}</div></div>`;
  const s=PARENT_CONTEXT.students.find(x=>String(x.student_id)===String(PARENT_CONTEXT.selectedStudentId));if(!s){dashboard.innerHTML='';return;}
  const sid=String(s.student_id);const attendance=PARENT_CONTEXT.attendance.filter(a=>String(a['Student ID'])===sid).sort((a,b)=>attendanceDateKey(b.Date).localeCompare(attendanceDateKey(a.Date)));const payments=PARENT_CONTEXT.payments.filter(p=>String(p['Student ID'])===sid).sort((a,b)=>new Date(b['Payment Date'])-new Date(a['Payment Date']));const orders=PARENT_CONTEXT.orders.filter(o=>String(o['Student ID'])===sid&&!['yes','true'].includes(String(o.Archived||'').toLowerCase())).sort((a,b)=>new Date(b['Order Date'])-new Date(a['Order Date']));const state=parentPaymentState(sid);const present=attendance.filter(a=>a.Status==='Present').length;const absent=attendance.filter(a=>a.Status==='Absent').length;const attendanceRate=attendance.length?Math.round(present/attendance.length*100):0;const progressWidth=Math.min(100,Math.round(state.progress/4*100));
  const packageClasses=state.classes.slice(0,4).map((a,i)=>`<div class="parent-package-row"><span class="package-number">${i+1}</span><div><b>${esc(formatDateClient(a.Date))}</b><small>${esc(a['Actual Class Time']||'')}</small></div><span class="badge present">Present</span></div>`).join('')||'<div class="empty">No Present classes in the current package yet.</div>';
  dashboard.innerHTML=`<div id="parentActionRequired"></div><div class="parent-hero"><div><div class="eyebrow">MY CHILD</div><h2>${esc(s.student_name)}</h2><p>${esc(sid)} · ${esc(s.normal_class_time||'Class time not recorded')}</p></div><span class="badge blue">${esc(s.school||'School not recorded')}</span></div><div class="parent-metrics"><div class="parent-metric"><span>CLASSES USED</span><strong>${state.progress} / 4</strong><small>${esc(state.status)}</small></div><div class="parent-metric"><span>ATTENDANCE</span><strong>${attendanceRate}%</strong><small>${present} Present · ${absent} Absent</small></div><div class="parent-metric"><span>CURRENT CYCLE</span><strong>${esc(state.currentCycle)}</strong><small>4-class package</small></div><div class="parent-metric"><span>LAST PAYMENT</span><strong>${state.lastPayment?esc(formatDateClient(state.lastPayment['Payment Date'])):'-'}</strong><small>${state.lastPayment?'Payment recorded':'No payment recorded'}</small></div></div><button class="parent-card parent-click-card" onclick="openParentPanel('package')"><div class="section-head"><div><div class="eyebrow">CURRENT PACKAGE</div><h3>4-class package</h3></div>${parentStatusBadge(state)}</div><div class="parent-progress"><div style="width:${progressWidth}%"></div></div><div class="progress-labels"><span>${state.progress} of 4 classes used</span><span>${Math.max(0,4-state.progress)} remaining</span></div><div class="parent-package-list">${packageClasses}</div></button><div class="parent-two-col"><button class="parent-card parent-click-card" onclick="openParentPanel('attendance')"><div class="section-head"><div><div class="eyebrow">ATTENDANCE</div><h3>Attendance History</h3></div><span class="badge blue">${attendance.length} record${attendance.length===1?'':'s'}</span></div><div class="parent-list">${attendance.slice(0,8).map(a=>`<div class="parent-list-row"><div><b>${esc(formatDateClient(a.Date))}</b><small>${esc(a['Actual Class Time']||'')}</small></div>${a.Status==='Present'?'<span class="badge present">Present</span>':a.Status==='Absent'?'<span class="badge absent">Absent</span>':'<span class="badge neutral">Not marked</span>'}</div>`).join('')||'<div class="empty">No attendance records yet.</div>'}</div><div class="card-arrow">›</div></button><button class="parent-card parent-click-card" onclick="openParentPanel('payments')"><div class="section-head"><div><div class="eyebrow">PAYMENTS</div><h3>Payment History</h3></div><span class="badge blue">${payments.length} record${payments.length===1?'':'s'}</span></div><div class="parent-list">${payments.slice(0,6).map(p=>`<div class="parent-list-row"><div><b>Cycle ${esc(p['Cycle Number'])}</b><small>${esc(formatDateClient(p['Payment Date']))} · ${esc(p['Classes Covered']||'')}</small></div><div><strong>RM${esc(p.Amount||0)}</strong><span class="badge paid">${esc(p.Status||'')}</span></div></div>`).join('')||'<div class="empty">No payment records yet.</div>'}</div><div class="card-arrow">›</div></button></div><button class="parent-card parent-click-card" onclick="openParentPanel('orders')"><div class="section-head"><div><div class="eyebrow">ORDERS</div><h3>My Orders</h3></div><span class="badge blue">${orders.length} order${orders.length===1?'':'s'}</span></div><div class="parent-list">${orders.slice(0,8).map(o=>`<div class="parent-list-row"><div><b>${esc(o.Product||'Order')}</b><small>${o.Product==='T Shirt'?`Size ${esc(o.Size||'-')} · `:''}Qty ${esc(o.Quantity||1)} · ${esc(formatDateClient(o['Order Date']))}</small></div><div class="parent-order-status"><span>${esc(o['Order Status']||'')}</span><small>${esc(orderPaymentDisplay(o).label)} · ${esc(o['Collection Status']||'')}</small></div></div>`).join('')||'<div class="empty">No orders recorded.</div>'}<div class="card-arrow">›</div></div></button>`;
  renderActionRequired(state);
}

function hideParentPortal(){document.getElementById('parentPortal')?.classList.add('hidden');document.querySelector('.app')?.classList.remove('hidden');}
async function run(fn,...args){
  if(!authReady)throw new Error('Please sign in first.');
  switch(fn){
    case 'getData': return loadRemoteData();
    case 'saveAttendance': {const r=args[0];const sid=String(r.studentId||'').trim();const date=String(r.date||'').slice(0,10);const status=String(r.status||'').trim();if(!sid||!date)throw new Error('Student and attendance date are required.');if(!['Present','Absent'].includes(status))throw new Error('Status must be Present or Absent.');const student=DATA.students.find(s=>String(s['Student ID'])===sid);if(!student)throw new Error('Student not found.');if(String(student.Active||'Yes').toLowerCase()==='no')throw new Error('Archived students cannot receive new attendance records.');const actual=status==='Present'?String(r.classTime||'').trim():'';if(status==='Present'&&!DATA.config.classTimes.includes(actual))throw new Error('Invalid class time.');const payload={student_id:sid,attendance_date:date,actual_class_time:actual,status,notes:String(r.notes||'')};if(r.attendanceId){const {error}=await supabaseClient.from('attendance').update(payload).eq('attendance_id',String(r.attendanceId));if(error)throw dbError(error)}else{payload.attendance_id=nextLocalId('ATT',DATA.attendance,'Attendance ID');const {error}=await supabaseClient.from('attendance').upsert(payload,{onConflict:'student_id,attendance_date'});if(error)throw dbError(error)}return {ok:true,action:'saved'};}
    case 'resetAttendance': {const {error}=await supabaseClient.from('attendance').delete().eq('student_id',String(args[0])).eq('attendance_date',String(args[1]).slice(0,10));if(error)throw dbError(error);return loadRemoteData();}
    case 'markPaymentReceived': {const sid=String(args[0]);const amount=Number(args[1]||50);if(amount!==50)throw new Error('Payment amount must be RM50.');const state=paymentStateFor(sid);if(state.progress!==4||state.status!=='Payment Due')throw new Error('This student has not reached 4 attended classes yet.');const ids=state.classes.map(a=>String(a['Attendance ID']));const cycle=Math.max(0,...DATA.payments.filter(p=>String(p['Student ID'])===sid&&String(p.Status||'').toLowerCase()==='paid').map(p=>Number(p['Cycle Number'])||0))+1;const paymentId=nextLocalId('PAY',DATA.payments,'Payment ID');const payload={payment_id:paymentId,student_id:sid,cycle_number:cycle,amount:50,payment_date:String(args[2]||isoDate(new Date())).slice(0,10),classes_covered:state.classes.map(a=>formatDateClient(a.Date)).join(', '),status:'Paid',notes:'',attendance_ids_covered:ids.join(','),payment_type:'Regular 4-Class Package',prepaid:'No'};const {error}=await supabaseClient.from('payments').insert(payload);if(error)throw dbError(error);return loadRemoteData();}
    case 'voidPayment': {const id=String(args[0]);const p=DATA.payments.find(x=>String(x['Payment ID'])===id);if(!p)throw new Error('Payment not found.');if(String(p.Status||'').toLowerCase()!=='paid')throw new Error('Only a Paid payment can be voided.');const notes=(p.Notes?String(p.Notes)+' | ':'')+'Voided on '+new Date().toLocaleString();const {error}=await supabaseClient.from('payments').update({status:'Void',notes}).eq('payment_id',id);if(error)throw dbError(error);return loadRemoteData();}
    case 'saveOrder': {const r=args[0];const product=String(r.product||'').trim();if(!['Scrabble Set','T Shirt'].includes(product))throw new Error('Choose Scrabble Set or T Shirt.');let sid=String(r.studentId||'').trim(),customer=String(r.customerName||'').trim(),phone=String(r.phone||'').trim();if(sid){const st=DATA.students.find(x=>String(x['Student ID'])===sid);if(!st)throw new Error('Selected student was not found.');if(!customer)customer=String(st['Student Name']||'');if(!phone)phone=String(st.WhatsApp||'')}if(!customer)throw new Error('Customer name is required.');const quantity=Math.max(1,Math.floor(Number(r.quantity)||1)),unitPrice=Math.max(0,Number(r.unitPrice)||0);if(product==='T Shirt'&&!String(r.size||'').trim())throw new Error('T Shirt size is required.');const orderStatus=String(r.orderStatus||'Pending Order'),paymentStatus=String(r.paymentStatus||'Unpaid'),collectionStatus=String(r.collectionStatus||'Not Collected');if(!['Pending Order','Pending Payment','Processing','Order Done'].includes(orderStatus))throw new Error('Invalid Order Status.');if(!['Unpaid','Paid'].includes(paymentStatus))throw new Error('Invalid Payment Status.');if(!['Not Collected','Collected'].includes(collectionStatus))throw new Error('Invalid Collection Status.');const payload={student_id:sid||null,customer_name:customer,phone,product,size:product==='T Shirt'?String(r.size||'').trim():'',quantity,unit_price:unitPrice,total:quantity*unitPrice,interest:'Yes',order_status:orderStatus,payment_status:paymentStatus,collection_status:collectionStatus,order_date:String(r.orderDate||isoDate(new Date())).slice(0,10),notes:String(r.notes||'')};if(r.orderId){const {error}=await supabaseClient.from('orders').update(payload).eq('order_id',String(r.orderId));if(error)throw dbError(error)}else{payload.order_id=nextLocalId('ORD',DATA.orders,'Order ID');payload.source='Manual';payload.archived=false;payload.form_source_hash='MANUAL';const {error}=await supabaseClient.from('orders').insert(payload);if(error)throw dbError(error)}return loadRemoteData();}
    case 'updateOrderStatus': {const id=String(args[0]),field=String(args[1]),value=String(args[2]);const map={'Order Status':'order_status','Payment Status':'payment_status','Collection Status':'collection_status'};const allowed={'Order Status':['Pending Order','Pending Payment','Processing','Order Done'],'Payment Status':['Unpaid','Paid'],'Collection Status':['Not Collected','Collected']};if(!map[field]||!allowed[field]?.includes(value))throw new Error('Invalid order status.');if(field==='Payment Status'){const current=orderRecord(id);if(current&&['Submitted','Verified'].includes(String(current['Payment Proof Status']||'')))throw new Error('Payment status is controlled by the payment proof actions.');}const {error}=await supabaseClient.from('orders').update({[map[field]]:value}).eq('order_id',id);if(error)throw dbError(error);return loadRemoteData();}
    case 'verifyOrderPaymentProof': {const id=String(args[0]);const note=String(args[1]||'').trim();const {data:current,error:readError}=await supabaseClient.from('orders').select('payment_proof_status,payment_status,order_status').eq('order_id',id).maybeSingle();if(readError)throw dbError(readError);if(!current)throw new Error('Order not found.');if(String(current.payment_proof_status||'')!=='Submitted')throw new Error('Only a submitted payment proof can be confirmed.');const {data:userData}=await supabaseClient.auth.getUser();const {error}=await supabaseClient.from('orders').update({payment_proof_status:'Verified',payment_status:'Paid',order_status:'Processing',payment_verified_at:new Date().toISOString(),payment_verified_by:userData.user?.id||null,payment_verification_notes:note}).eq('order_id',id);if(error)throw dbError(error);return loadRemoteData();}
    case 'rejectOrderPaymentProof': {const id=String(args[0]);const note=String(args[1]||'').trim();if(!note)throw new Error('Please enter a reason for rejecting the receipt.');const {data:current,error:readError}=await supabaseClient.from('orders').select('payment_proof_status').eq('order_id',id).maybeSingle();if(readError)throw dbError(readError);if(!current)throw new Error('Order not found.');if(String(current.payment_proof_status||'')!=='Submitted')throw new Error('Only a submitted payment proof can be rejected.');const {error}=await supabaseClient.from('orders').update({payment_proof_status:'Rejected',payment_status:'Unpaid',order_status:'Pending Payment',payment_verified_at:null,payment_verified_by:null,payment_verification_notes:note}).eq('order_id',id);if(error)throw dbError(error);return loadRemoteData();}
    case 'openOrderReceipt': {const id=String(args[0]);const {data,error}=await supabaseClient.functions.invoke('get-order-payment-receipt',{body:{order_id:id}});if(error)throw new Error(error.message||'Unable to open receipt.');if(!data?.url)throw new Error(data?.error||'Receipt is unavailable.');window.open(data.url,'_blank','noopener');return data;}
    case 'archiveOrder': case 'restoreOrder': {const id=String(args[0]);const {error}=await supabaseClient.from('orders').update({archived:fn==='archiveOrder'}).eq('order_id',id);if(error)throw dbError(error);return loadRemoteData();}
    case 'bulkArchiveOrders': case 'bulkRestoreOrders': {const ids=(Array.isArray(args[0])?args[0]:[]).map(String).filter(Boolean);if(!ids.length)return loadRemoteData();const {error}=await supabaseClient.from('orders').update({archived:fn==='bulkArchiveOrders'}).in('order_id',ids);if(error)throw dbError(error);return loadRemoteData();}
    case 'archiveStudent': case 'restoreStudent': {const id=String(args[0]);const {error}=await supabaseClient.from('students').update({active:fn==='restoreStudent'}).eq('student_id',id);if(error)throw dbError(error);return loadRemoteData();}
    case 'getStudentDetail': {const sid=String(args[0]);const d=await loadRemoteData();const student=d.students.find(s=>String(s['Student ID'])===sid);if(!student)throw new Error('Student not found.');return {student,attendance:d.attendance.filter(a=>String(a['Student ID'])===sid),payments:d.payments.filter(p=>String(p['Student ID'])===sid),orders:d.orders.filter(o=>String(o['Student ID'])===sid),paymentStatus:paymentStateFor(sid)};}
    case 'saveStudent': {const r=args[0];const name=String(r.studentName||'').trim();if(!name)throw new Error('Student name is required.');const normal=String(r.normalClassTime||'').trim();if(!['10:30 AM','2:00 PM'].includes(normal))throw new Error('Choose 10:30 AM or 2:00 PM.');const email=String(r.email||'').trim(),phone=String(r.whatsapp||'').trim();if(email&&DATA.students.some(s=>String(s.Email||'').trim().toLowerCase()===email.toLowerCase()))throw new Error('A student with this email already exists.');if(phone&&DATA.students.some(s=>String(s.WhatsApp||'').trim()===phone))throw new Error('A student with this WhatsApp number already exists.');const id=nextLocalId('SC',DATA.students,'Student ID');const row={student_id:id,student_name:name,school:String(r.school||'').trim(),age:Number.isFinite(Number(r.age))&&String(r.age).trim()!==''?Number(r.age):null,scrabble_experience:String(r.experience||'').trim(),parent_guardian:String(r.parentGuardian||'').trim(),whatsapp:phone,emergency_contact:String(r.emergency||'').trim(),normal_class_time:normal,email,registration_date:String(r.registrationDate||isoDate(new Date())).slice(0,10),active:true,commitment_confirmed:r.commitment?'Yes':'No',google_form_row:null,form_source_hash:'MANUAL'};const {error:studentError}=await supabaseClient.from('students').insert(row);if(studentError)throw dbError(studentError);const paymentId=nextLocalId('PAY',DATA.payments,'Payment ID');const {error:paymentError}=await supabaseClient.from('payments').insert({payment_id:paymentId,student_id:id,cycle_number:1,amount:50,payment_date:row.registration_date,classes_covered:'First 4 classes (prepaid)',status:'Paid',notes:'Initial 4-class payment received',attendance_ids_covered:'',payment_type:'Initial 4-Class Package',prepaid:'Yes'});if(paymentError){throw dbError(paymentError)}return loadRemoteData();}
    case 'updateStudent': {const r=args[0]||{};const id=String(r.studentId||'').trim();if(!id)throw new Error('Student ID is required.');const existing=DATA.students.find(s=>String(s['Student ID'])===id);if(!existing)throw new Error('Student not found.');const name=String(r.studentName||'').trim();if(!name)throw new Error('Student name is required.');const normal=String(r.normalClassTime||'').trim();if(!['10:30 AM','2:00 PM'].includes(normal))throw new Error('Choose 10:30 AM or 2:00 PM.');const email=String(r.email||'').trim(),phone=String(r.whatsapp||'').trim();const duplicateEmail=DATA.students.find(s=>String(s['Student ID'])!==id&&email&&String(s.Email||'').trim().toLowerCase()===email.toLowerCase());if(duplicateEmail)throw new Error('A student with this email already exists.');const duplicatePhone=DATA.students.find(s=>String(s['Student ID'])!==id&&phone&&String(s.WhatsApp||'').trim()===phone);if(duplicatePhone)throw new Error('A student with this WhatsApp number already exists.');const payload={student_name:name,school:String(r.school||'').trim(),age:Number.isFinite(Number(r.age))&&String(r.age).trim()!==''?Number(r.age):null,scrabble_experience:String(r.experience||'').trim(),parent_guardian:String(r.parentGuardian||'').trim(),whatsapp:phone,emergency_contact:String(r.emergency||'').trim(),normal_class_time:normal,email,registration_date:String(r.registrationDate||existing['Registration Date']||isoDate(new Date())).slice(0,10),commitment_confirmed:r.commitment?'Yes':'No'};const {error}=await supabaseClient.from('students').update(payload).eq('student_id',id);if(error)throw dbError(error);return loadRemoteData();}
    case 'createFullBackup': {const data=await loadRemoteData();const payload={...data,exportedAt:new Date().toISOString(),note:'Scrabble Class Management Supabase backup'};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='Scrabble_Class_Supabase_Backup_'+isoDate(new Date())+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return {ok:true,fileName:a.download};}
    case 'syncNewStudents': case 'syncFormOrders': return loadRemoteData();
    default: throw new Error('Online action not supported: '+fn);
  }
}
function setConnection(text,off=false){const el=document.getElementById('connection');if(!el)return;el.textContent=text;el.classList.toggle('off',off)}
function showBoot(){document.getElementById('bootScreen')?.classList.remove('hidden')}
function hideBoot(){document.getElementById('bootScreen')?.classList.add('hidden')}
function showLogin(message=''){document.getElementById('loginScreen')?.classList.remove('hidden');const msg=document.getElementById('loginMessage');if(msg)msg.textContent=message;setConnection('● Sign in required',true)}
function hideLogin(){document.getElementById('loginScreen')?.classList.add('hidden')}
function setLoginMode(mode){loginMode=mode==='parent'?'parent':'teacher';const teacher=document.getElementById('teacherLoginMode'),parent=document.getElementById('parentLoginMode'),eyebrow=document.getElementById('loginEyebrow'),title=document.getElementById('loginTitle'),subtitle=document.getElementById('loginSubtitle'),button=document.getElementById('loginButton'),email=document.getElementById('loginEmail'),password=document.getElementById('loginPassword'),msg=document.getElementById('loginMessage');teacher?.classList.toggle('active',loginMode==='teacher');parent?.classList.toggle('active',loginMode==='parent');if(loginMode==='parent'){eyebrow.textContent='PARENT PORTAL';title.textContent='Welcome back';subtitle.textContent="Sign in to view your child's class records.";button.querySelector('span')?.replaceChildren(document.createTextNode('Parent Sign In'));email.placeholder='Parent email';password.placeholder='Enter your password';}else{eyebrow.textContent='TEACHER PORTAL';title.textContent='Welcome back';subtitle.textContent='Sign in to access your online class records.';button.querySelector('span')?.replaceChildren(document.createTextNode('Sign In'));email.placeholder='Your login email';password.placeholder='Enter your password';}msg.textContent='';}
async function signIn(){const email=document.getElementById('loginEmail').value.trim(),password=document.getElementById('loginPassword').value;const button=document.getElementById('loginButton');const msg=document.getElementById('loginMessage');if(!email||!password){msg.textContent='Enter your email and password.';return}button.disabled=true;msg.textContent='Signing in...';try{const {error}=await supabaseClient.auth.signInWithPassword({email,password});if(error)throw dbError(error);const user=(await supabaseClient.auth.getUser()).data.user;const {data:parentAccount,error:parentError}=await supabaseClient.from('parent_accounts').select('user_id,parent_name,active').eq('user_id',user.id).maybeSingle();if(parentError)throw dbError(parentError);const isParent=!!parentAccount;if(loginMode==='parent'){if(!isParent){await supabaseClient.auth.signOut();throw new Error('This account is not registered as a parent account. Please use Teacher Login.')}if(parentAccount.active===false){await supabaseClient.auth.signOut();throw new Error('This parent account is inactive. Please contact the teacher.')}}else{if(isParent){await supabaseClient.auth.signOut();throw new Error('This is a Parent account. Please use Parent Login.')}}msg.textContent='';}catch(e){msg.textContent=e.message||'Sign in failed.'}finally{button.disabled=false}}
async function signOut(){await supabaseClient.auth.signOut();authReady=false;currentUserRole='teacher';PARENT_CONTEXT={account:null,students:[]};hideParentPortal();showLogin('You have signed out.');}
async function enterSession(session){
  showBoot();

  if(!session){
    authReady=false;
    currentUserRole='teacher';
    PARENT_CONTEXT={account:null,students:[]};
    hideParentPortal();
    hideBoot();
    showLogin();
    return;
  }

  authReady=true;
  setConnection('● Loading...',false);

  try{
    // Always determine the portal from the authenticated Supabase account.
    // This survives refresh and does not depend on the login-mode button.
    const account=await getCurrentParentAccount();

    if(account){
      if(account.active===false){
        await supabaseClient.auth.signOut();
        currentUserRole='teacher';
        PARENT_CONTEXT={account:null,students:[]};
        hideParentPortal();
        hideBoot();
        showLogin('This parent account is inactive. Please contact the teacher.');
        return;
      }

      currentUserRole='parent';
      parentEntryNoticeShown=true;
      hideLogin();
      await loadParentPortal();
      hideBoot();
      return;
    }

    // No parent_accounts record means this is the Teacher Portal account.
    currentUserRole='teacher';
    hideParentPortal();
    hideLogin();
    DATA=await loadRemoteData();
    setConnection('● Online',false);
    renderAll();
    hideBoot();

  }catch(e){
    currentUserRole='teacher';
    PARENT_CONTEXT={account:null,students:[]};
    hideParentPortal();
    await supabaseClient.auth.signOut();
    hideBoot();
    showLogin((loginMode==='parent'?'Parent login failed: ':'Online database connection failed: ')+(e.message||e));
  }
}

async function initSupabaseAuth(){
  showBoot();
  supabaseClient.auth.onAuthStateChange((_event,session)=>{
    if(!authInitialised)return;
    setTimeout(()=>enterSession(session),0);
  });

  const {data,error}=await supabaseClient.auth.getSession();
  if(error){
    authInitialised=true;
    hideBoot();
    showLogin(error.message);
    return;
  }

  await enterSession(data.session);
  authInitialised=true;
}

function page(name){document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));const target=document.getElementById(name);if(!target)return;target.classList.add('active');document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active'));const navName=name==='studentProfile'?'students':name;[...document.querySelectorAll('.nav')].find(x=>x.textContent.toLowerCase()===navName)?.classList.add('active');document.getElementById('title').textContent=name==='studentProfile'?'Student Profile':name[0].toUpperCase()+name.slice(1);if(name==='attendance')renderAttendance();if(name==='students')renderStudents();if(name==='payments')renderPayments();if(name==='orders')renderOrders();if(name==='reports')renderReports()}
function renderAll(){document.querySelector('.app')?.classList.remove('hidden');document.getElementById('today').textContent=formatDateClient(isoDate(latestSunday()));document.getElementById('rStudents').textContent=DATA.students.length;renderHome();renderAttendance();renderStudents();renderPayments();renderOrders();renderReports();if(currentProfileId&&document.getElementById('studentProfile')?.classList.contains('active'))renderProfile(currentProfileId)}
function paymentStateFor(sid){return calculatePaymentState(DATA.payments,DATA.attendance,sid);}

function cycleFor(sid){return paymentStateFor(sid).progress}
function statusFor(c){return c>=4?'Payment Due':c===3?'Almost Due':'In Cycle'}
function badge(c,state){const s=state?.status||statusFor(c);const cls=s==='Payment Due'?'absent':s==='Almost Due'?'almost':'present';return `<span class="badge ${cls}">${s}</span>`}
function activeStudents(){return DATA.students.filter(s=>String(s.Active||'yes').toLowerCase()!=='no')}
function selectedAttendanceDate(){const value=document.getElementById('attDate')?.value;return value&&value>=CLASS_START_DATE?value:isoDate(latestSunday())}
function attendanceDateKey(value){if(!value)return '';const text=String(value);if(/^\d{4}-\d{2}-\d{2}$/.test(text))return text;const date=new Date(value);if(isNaN(date.getTime()))return text.slice(0,10);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function attendanceForDate(date){return DATA.attendance.filter(a=>attendanceDateKey(a.Date)===date)}
function studentButton(studentId,name,extraClass=''){const student=DATA.students.find(s=>String(s['Student ID'])===String(studentId));const attendance=attendanceForDate(selectedAttendanceDate()).find(a=>String(a['Student ID'])===String(studentId)&&a.Status==='Present');const visualClass=extraClass==='normal-attendance'&&student&&attendance&&student['Normal Class Time']!==attendance['Actual Class Time']?'other-attendance':extraClass;return `<div class="att-row ${visualClass}"><button class="linkbtn" onclick="openStudent('${esc(studentId)}')">${esc(name)}</button></div>`}
function formatDateClient(v){if(!v)return '';const d=new Date(v);return isNaN(d)?String(v):d.toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'})}
function renderHome(){const date=selectedAttendanceDate();document.getElementById('today').textContent=formatDateClient(date);const students=activeStudents();const attendance=attendanceForDate(date);const byId=new Map(students.map(s=>[String(s['Student ID']),s]));const absentById=new Map();['10:30 AM','2:00 PM'].forEach(time=>{const id=time==='10:30 AM'?'1030':'1400';const panelStudents=students.filter(s=>String(s['Normal Class Time'])===time);const records=new Map(attendance.filter(a=>byId.has(String(a['Student ID']))).map(a=>[String(a['Student ID']),a]));let present=0,other=0,absent=0;panelStudents.forEach(s=>{const a=records.get(String(s['Student ID']));if(!a)return;if(a.Status==='Absent'){absent++;absentById.set(String(s['Student ID']),s);return}if(a.Status==='Present'){if(String(a['Actual Class Time'])===time)present++;else other++}});document.getElementById('c'+id).textContent=panelStudents.length+' students';document.getElementById('p'+id).textContent=present;document.getElementById('a'+id).textContent=absent;document.getElementById('o'+id).textContent=other});attendance.forEach(a=>{if(a.Status==='Absent'){const s=byId.get(String(a['Student ID']));if(s)absentById.set(String(a['Student ID']),s)}});const absentStudents=[...absentById.values()].sort((a,b)=>String(a['Student Name']).localeCompare(String(b['Student Name'])));document.getElementById('homeAbsentCount').textContent=absentStudents.length;document.getElementById('homeAbsentStudents').innerHTML=absentStudents.map(s=>studentButton(s['Student ID'],s['Student Name'],'absent-attendance')).join('')||'<div class="empty">No absent students.</div>';const cycles=students.map(s=>cycleFor(s['Student ID']));const activeOrders=DATA.orders.filter(o=>String(o.Archived||'').toLowerCase()!=='yes');const pendingOrders=activeOrders.filter(o=>['Pending Order','Pending Payment'].includes(String(o['Order Status']||''))).length;const unpaidOrders=activeOrders.filter(o=>String(o['Payment Status']||'').toLowerCase()==='unpaid').length;const actionBox=document.getElementById('homeActionRequired');if(actionBox){const due=cycles.filter(x=>x>=4).length;const items=[];if(due)items.push(`<button class="action-item" onclick="page('payments')"><span><b>${due}</b> package payment${due===1?'':'s'} due</span><span>›</span></button>`);if(pendingOrders)items.push(`<button class="action-item" onclick="page('orders')"><span><b>${pendingOrders}</b> order${pendingOrders===1?'':'s'} need attention</span><span>›</span></button>`);if(unpaidOrders&&unpaidOrders!==pendingOrders)items.push(`<button class="action-item" onclick="page('orders')"><span><b>${unpaidOrders}</b> unpaid order${unpaidOrders===1?'':'s'}</span><span>›</span></button>`);actionBox.innerHTML=items.length?items.join(''):'<div class="action-ok-row"><span>Everything is up to date</span></div>';}}
	function setHomeDate(delta){let d=new Date(selectedAttendanceDate()+'T12:00:00');if(delta===0)d=latestSunday();else d.setDate(d.getDate()+delta);if(d.getDay()!==0)d=latestSunday(d);document.getElementById('attDate').value=isoDate(d);renderHome()}
function setAttDate(delta){let d=new Date(selectedAttendanceDate()+'T12:00:00');if(delta===0)d=latestSunday();else d.setDate(d.getDate()+delta);if(d.getDay()!==0)d=latestSunday(d);document.getElementById('attDate').value=isoDate(d);renderAttendance();renderHome()}
function openAttendance(time){page('attendance');document.getElementById('attDate').value=isoDate(latestSunday());renderAttendance()}
function renderAttendance(){const date=selectedAttendanceDate();document.getElementById('attDate').value=date;const students=activeStudents().sort((a,b)=>{const ta=a['Normal Class Time']||'99';const tb=b['Normal Class Time']||'99';return ta.localeCompare(tb)||String(a['Student Name']).localeCompare(String(b['Student Name']))});const marked=students.filter(s=>DATA.attendance.some(a=>String(a['Student ID'])===String(s['Student ID'])&&String(a.Date).slice(0,10)===date)).length;document.getElementById('attSummary').textContent=marked+' / '+students.length+' marked';document.getElementById('attContent').innerHTML=`<div class="panel"><div class="scroll"><table><thead><tr><th>Student</th><th>Normal Class</th><th>Actual Class</th><th>Status</th><th>Attendance</th></tr></thead><tbody>${students.map(s=>attendanceRow(s,date)).join('')||'<tr><td colspan="5" class="empty">No active students registered.</td></tr>'}</tbody></table></div></div>`}
function viewAttendanceList(time){page('attendance');document.getElementById('attDate').value=selectedAttendanceDate();renderAttendance()}
function attendanceRow(s,date){const a=DATA.attendance.find(x=>String(x['Student ID'])===String(s['Student ID'])&&attendanceDateKey(x.Date)===date);const status=a?.Status||'Not marked';const time=a?.['Actual Class Time']||'';return `<tr><td><button class="linkbtn" onclick="openStudent('${esc(s['Student ID'])}')">${esc(s['Student Name'])}</button><div class="subtle">${esc(s['Student ID'])}</div></td><td>${esc(s['Normal Class Time']||'')}</td><td>${esc(time||'-')}</td><td>${status==='Present'?'<span class="badge present">Present</span>':status==='Absent'?'<span class="badge absent">Absent</span>':'<span class="badge neutral">Not marked</span>'}</td><td><div class="att-actions"><button class="att-btn ${status==='Present'&&time==='10:30 AM'?'selected':''}" onclick="setAttendance('${esc(s['Student ID'])}','${date}','10:30 AM','Present')">10:30 AM</button><button class="att-btn ${status==='Present'&&time==='2:00 PM'?'selected':''}" onclick="setAttendance('${esc(s['Student ID'])}','${date}','2:00 PM','Present')">2:00 PM</button><button class="att-btn absent ${status==='Absent'?'selected':''}" onclick="setAttendance('${esc(s['Student ID'])}','${date}','', 'Absent')">Absent</button><button class="att-btn" onclick="resetAttendanceAction('${esc(s['Student ID'])}','${date}')">Reset</button></div></td></tr>`}
async function setAttendance(studentId,date,classTime,status){const existing=DATA.attendance.find(a=>String(a['Student ID'])===String(studentId)&&attendanceDateKey(a.Date)===date);try{await run('saveAttendance',{attendanceId:existing?.['Attendance ID']||'',studentId,date,classTime,status,notes:''});DATA=await run('getData');renderAll()}catch(e){alert(e.message||e)}}
async function resetAttendanceAction(studentId,date){try{DATA=await run('resetAttendance',studentId,date);renderAll()}catch(e){alert(e.message||e)}}
function setStudentView(view){studentView=view;document.getElementById('activeStudentsBtn')?.classList.toggle('active',view==='active');document.getElementById('archivedStudentsBtn')?.classList.toggle('active',view==='archived');renderStudents()}
function renderStudents(){const q=(document.getElementById('studentSearch')?.value||'').toLowerCase();const rows=DATA.students.filter(s=>(studentView==='archived'?String(s.Active||'').toLowerCase()==='no':String(s.Active||'yes').toLowerCase()!=='no')).filter(s=>Object.values(s).some(v=>String(v).toLowerCase().includes(q))).sort((a,b)=>String(a['Student Name']).localeCompare(String(b['Student Name']))).map(s=>{const c=cycleFor(s['Student ID']);const archived=String(s.Active||'').toLowerCase()==='no';const action=archived?`<button class="secondary" onclick="event.stopPropagation();editStudent('${esc(s['Student ID'])}')">Edit</button><button class="secondary" onclick="event.stopPropagation();restoreStudent('${esc(s['Student ID'])}')">Restore</button>`:`<button class="secondary" onclick="event.stopPropagation();editStudent('${esc(s['Student ID'])}')">Edit</button><button class="secondary" onclick="event.stopPropagation();archiveStudent('${esc(s['Student ID'])}')">Archive</button>`;return `<tr class="clickable" onclick="openStudent('${esc(s['Student ID'])}')"><td>${esc(s['Student ID'])}</td><td><b>${esc(s['Student Name'])}</b></td><td>${esc(s.School||'')}</td><td>${esc(s['Normal Class Time']||'')}</td><td>${c} / 4</td><td>${badge(c)}</td><td>${esc(formatDateClient(s['Registration Date']))}</td><td><div class="actions inline-actions">${action}</div></td></tr>`}).join('');document.getElementById('studentsBody').innerHTML=rows||'<tr><td colspan="8" class="empty">No students found.</td></tr>'}
async function archiveStudent(id){if(!confirm('Archive this student? Historical records will be preserved.'))return;try{DATA=await run('archiveStudent',id);renderAll()}catch(e){alert(e.message||e)}}
async function restoreStudent(id){try{DATA=await run('restoreStudent',id);renderAll()}catch(e){alert(e.message||e)}}
function renderProfile(id){if(document.getElementById('studentProfile').classList.contains('active'))openStudent(id)}
function renderPayments(){const active=activeStudents();const states=active.map(s=>({s,state:paymentStateFor(s['Student ID'])}));const due=states.filter(x=>x.state.progress===4&&x.state.status==='Payment Due');const almost=states.filter(x=>x.state.progress===3&&x.state.status==='Almost Due');document.getElementById('payDueCount').textContent=due.length;document.getElementById('payAlmostCount').textContent=almost.length;document.getElementById('payHistoryCount').textContent=DATA.payments.filter(p=>String(p.Status||'').toLowerCase()==='paid').length;document.getElementById('dueBadge').textContent=due.length;document.getElementById('paymentStudentCount').textContent=active.length;document.getElementById('paymentStudents').innerHTML=states.map(({s,state})=>{const cycle=state.currentCycle||1;const amount=state.activePrepaid?'RM50':state.progress===4?'RM50':'-';const action=state.progress===4&&state.status==='Payment Due'?`<button class="primary" onclick="pay('${esc(s['Student ID'])}')">Record Payment</button>`:'<span class="badge paid">Paid</span>';return `<tr><td><button class="linkbtn" onclick="openStudent('${esc(s['Student ID'])}')">${esc(s['Student Name'])}</button></td><td>${esc(s['Student ID'])}</td><td>${cycle}</td><td>${state.progress} / 4</td><td>${badge(state.progress,state)}</td><td>${amount}</td><td>${esc(state.lastPayment?formatDateClient(state.lastPayment['Payment Date']):'-')}</td><td>${action}</td></tr>`}).join('')||'<tr><td colspan="8" class="empty">No active students.</td></tr>';document.getElementById('paymentsDue').innerHTML=due.map(({s})=>`<div class="pay-row"><div><button class="linkbtn" onclick="openStudent('${esc(s['Student ID'])}')">${esc(s['Student Name'])}</button><div class="subtle">${esc(s['Student ID'])} · 4 / 4 attended</div></div><b>RM50</b><button class="primary" onclick="pay('${esc(s['Student ID'])}')">Record Payment</button></div>`).join('')||'<div class="empty">No payments due.</div>';document.getElementById('paymentsAlmost').innerHTML=almost.map(({s})=>`<div class="pay-row"><div><button class="linkbtn" onclick="openStudent('${esc(s['Student ID'])}')">${esc(s['Student Name'])}</button><div class="subtle">${esc(s['Student ID'])} · 3 / 4 attended</div></div><span class="badge almost">Almost Due</span><button class="secondary" onclick="openStudent('${esc(s['Student ID'])}')">View</button></div>`).join('')||'<div class="empty">No students are almost due.</div>';const rows=[...DATA.payments].sort((a,b)=>new Date(b['Payment Date'])-new Date(a['Payment Date'])).map(p=>{const st=DATA.students.find(x=>String(x['Student ID'])===String(p['Student ID']));return `<tr><td><button class="linkbtn" onclick="openStudent('${esc(p['Student ID'])}')">${esc(st?.['Student Name']||p['Student ID'])}</button></td><td>${esc(p['Cycle Number'])}</td><td>RM${esc(p.Amount)}</td><td>${esc(formatDateClient(p['Payment Date']))}</td><td>${String(p.Status||'').toLowerCase()==='paid'?'<span class="badge paid">Paid</span>':'<span class="badge absent">'+esc(p.Status||'')+'</span>'}</td><td>${esc(p['Classes Covered']||'')}</td></tr>`}).join('');document.getElementById('paymentsHistory').innerHTML=rows||'<tr><td colspan="6" class="empty">No payments recorded.</td></tr>'}

async function pay(id){if(!confirm('Confirm RM50 payment received? This payment will cover the oldest 4 unpaid Present classes.'))return;try{DATA=await run('markPaymentReceived',id,50,isoDate(new Date()));renderAll()}catch(e){alert(e.message||e)}}
function setOrderTab(product){orderTab=product;selectedOrderIds.clear();document.getElementById('tabSets').classList.toggle('active',product==='Scrabble Set');document.getElementById('tabShirts').classList.toggle('active',product==='T Shirt');document.getElementById('orderTitle').textContent=product==='Scrabble Set'?'Scrabble Sets':'T Shirts';renderOrders()}
function studentName(id){return DATA.students.find(s=>String(s['Student ID'])===String(id))?.['Student Name']||id}
async function changeOrder(id,field,value){try{DATA=await run('updateOrderStatus',id,field,value);renderOrders()}catch(e){alert(e.message||e)}}
function editOrder(id){const o=DATA.orders.find(x=>String(x['Order ID'])===String(id));if(!o)return;showOrderForm(o)}
function toggleOrderCustomer(){const other=document.getElementById('oType').value==='other';document.getElementById('studentBox').style.display=other?'none':'block';document.getElementById('otherBox').style.display=other?'block':'none'}
const reportsRenderer=renderReports;renderReports=function(){const reportHead=document.querySelector('#reports #reportStudents')?.closest('table')?.querySelector('thead');if(reportHead)reportHead.innerHTML='<tr><th>Student</th><th>ID</th><th>Normal Class</th><th>Present</th><th>Absent</th><th>Payment Status</th><th>Orders</th></tr>';reportsRenderer()}
let orderView='active';let currentOrderId='';
function setOrderView(view){orderView=view;selectedOrderIds.clear();renderOrders()}
function toggleOrderSelection(id,checked){if(checked)selectedOrderIds.add(String(id));else selectedOrderIds.delete(String(id));updateOrderBulkBar()}
function toggleAllOrders(checked){const q=(document.getElementById('orderSearch')?.value||'').toLowerCase();const visible=DATA.orders.filter(o=>(orderView==='archived'?String(o.Archived||'').toLowerCase()==='yes':String(o.Archived||'no').toLowerCase()!=='yes')).filter(o=>o.Product===orderTab&&Object.values(o).some(v=>String(v).toLowerCase().includes(q)));visible.forEach(o=>checked?selectedOrderIds.add(String(o['Order ID'])):selectedOrderIds.delete(String(o['Order ID'])));renderOrders()}
function updateOrderBulkBar(){const count=selectedOrderIds.size;const label=document.getElementById('orderSelectedCount');const action=document.getElementById('orderBulkAction');if(label)label.textContent=count?`${count} selected`:'';if(action){action.textContent=orderView==='archived'?'Restore Selected':'Archive Selected';action.disabled=count===0;action.classList.toggle('disabled',count===0)}}
function renderOrders(){const q=(document.getElementById('orderSearch')?.value||'').toLowerCase();const visible=DATA.orders.filter(o=>(orderView==='archived'?String(o.Archived||'').toLowerCase()==='yes':String(o.Archived||'no').toLowerCase()!=='yes'));const rows=visible.filter(o=>o.Product===orderTab&&Object.values(o).some(v=>String(v).toLowerCase().includes(q))).sort((a,b)=>new Date(b['Order Date'])-new Date(a['Order Date']));const awaiting=visible.filter(o=>String(o['Payment Proof Status']||'')==='Submitted'&&String(o['Payment Status']||'').toLowerCase()!=='paid').length;const unpaid=visible.filter(o=>String(o['Payment Status']||'').toLowerCase()!=='paid'&&String(o['Payment Proof Status']||'')!=='Submitted').length;const processing=visible.filter(o=>o['Order Status']==='Processing').length;const done=visible.filter(o=>o['Order Status']==='Order Done').length;const summary=document.getElementById('orderSummaryCards');if(summary)summary.innerHTML=`<div class="order-stat"><span>AWAITING CONFIRMATION</span><strong>${awaiting}</strong></div><div class="order-stat"><span>AWAITING PAYMENT</span><strong>${unpaid}</strong></div><div class="order-stat"><span>PROCESSING</span><strong>${processing}</strong></div><div class="order-stat"><span>ORDER DONE</span><strong>${done}</strong></div>`;const rowIds=new Set(rows.map(o=>String(o['Order ID'])));selectedOrderIds=new Set([...selectedOrderIds].filter(id=>rowIds.has(String(id))));document.getElementById('orderCount').textContent=rows.length;const title=document.getElementById('orderTitle');if(title)title.textContent=(orderTab==='T Shirt'?'T Shirts':'Scrabble Sets')+(orderView==='archived'?' · Archived':'');const body=document.getElementById('ordersBody');const allSelected=rows.length>0&&rows.every(o=>selectedOrderIds.has(String(o['Order ID'])));body.innerHTML=rows.map(o=>{const archived=String(o.Archived||'').toLowerCase()==='yes';const size=orderTab==='T Shirt'?esc(o.Size||''):'-';const checked=selectedOrderIds.has(String(o['Order ID']))?'checked':'';return `<tr><td><input class="order-select" type="checkbox" ${checked} aria-label="Select order ${esc(o['Order ID'])}" onchange="toggleOrderSelection('${esc(o['Order ID'])}',this.checked)"></td><td>${esc(o['Order ID'])}</td><td><b>${esc(o['Customer Name']||'')}</b></td><td>${o['Student ID']?`<button class="linkbtn" onclick="openStudent('${esc(o['Student ID'])}')">${esc(studentName(o['Student ID']))}</button>`:'Non student'}</td><td>${size}</td><td>${esc(o.Quantity||1)}</td><td>RM${esc(o.Total||0)}</td><td>${esc(o['Order Status']||'')}</td><td>${esc(String(o['Payment Proof Status']||'')==='Submitted'&&String(o['Payment Status']||'').toLowerCase()!=='paid'?'Awaiting Confirmation':o['Payment Status']||'')}</td><td>${esc(o['Collection Status']||'')}</td><td>${esc(formatDateClient(o['Order Date']))}</td><td><button class="secondary" onclick="openOrder('${esc(o['Order ID'])}')">View / Manage</button></td></tr>`}).join('')||'<tr><td colspan="12" class="empty">No orders in this view.</td></tr>';const toolbar=document.querySelector('#orders .toolbar');if(toolbar){let active=document.getElementById('orderViewActive');if(!active){active=document.createElement('button');active.id='orderViewActive';active.className='secondary';active.textContent='Active Orders';active.onclick=()=>setOrderView('active');toolbar.insertBefore(active,toolbar.lastElementChild)}let archivedBtn=document.getElementById('orderViewArchived');if(!archivedBtn){archivedBtn=document.createElement('button');archivedBtn.id='orderViewArchived';archivedBtn.className='secondary';archivedBtn.textContent='Archived Orders';archivedBtn.onclick=()=>setOrderView('archived');toolbar.insertBefore(archivedBtn,toolbar.lastElementChild)}}const selectAll=document.getElementById('orderSelectAll');if(selectAll){selectAll.checked=allSelected;selectAll.indeterminate=rows.length>0&&!allSelected&&rows.some(o=>selectedOrderIds.has(String(o['Order ID'])))}updateOrderBulkBar()}
async function bulkArchiveRestoreOrders(){const ids=[...selectedOrderIds];if(!ids.length)return;const action=orderView==='archived'?'restore':'archive';const verb=action==='archive'?'Archive':'Restore';const message=action==='archive'?`Archive ${ids.length} selected order${ids.length===1?'':'s'}?\n\nThe orders will stay in the database and be hidden from the respective Parent Portal.`:`Restore ${ids.length} selected order${ids.length===1?'':'s'}?\n\nThe orders will become visible again in the respective Parent Portal.`;if(!confirm(message))return;try{DATA=await run(action==='archive'?'bulkArchiveOrders':'bulkRestoreOrders',ids);selectedOrderIds.clear();renderOrders();}catch(e){alert(e.message||e)}}
function orderRecord(id){return DATA.orders.find(o=>String(o['Order ID'])===String(id))}
function renderOrderDashboard(order){
  const student=order&&order['Student ID']?DATA.students.find(s=>String(s['Student ID'])===String(order['Student ID'])):null;
  const size=order.Product==='T Shirt'?`<label>Size</label><input id="dSize" value="${esc(order.Size||'')}">`:'';
  const proof=String(order['Payment Proof Status']||'Not Submitted');
  const payment=orderPaymentDisplay(order);
  const orderStatus=String(order['Order Status']||'Pending Order');
  const proofBlock=order['Payment Receipt Path']?`<div class="order-proof-panel"><div class="row"><div><div class="eyebrow">PAYMENT PROOF</div><h3 style="margin:4px 0">${esc(order['Payment Receipt Name']||'Receipt')}</h3></div><span class="badge ${proof==='Verified'?'paid':proof==='Rejected'?'absent':'almost'}">${esc(proof)}</span></div><div class="inline-actions" style="margin-top:12px"><button class="secondary" onclick="openOrderReceipt('${esc(order['Order ID'])}')">View Receipt</button>${proof==='Submitted'?`<button class="primary" onclick="verifyOrderPayment('${esc(order['Order ID'])}')">Confirm Payment</button><button class="secondary" onclick="rejectOrderPayment('${esc(order['Order ID'])}')">Reject Proof</button>`:''}</div>${order['Payment Verification Notes']?`<div class="subtle" style="margin-top:10px">${esc(order['Payment Verification Notes'])}</div>`:''}</div>`:`<div class="order-proof-panel"><div class="eyebrow">PAYMENT PROOF</div><p class="subtle">No payment receipt has been submitted yet.</p></div>`;
  const paymentControl=proof==='Submitted'?`<select id="dPaymentStatus" disabled><option selected>Awaiting Confirmation</option></select>`:proof==='Verified'?`<select id="dPaymentStatus" disabled><option selected>Paid</option></select>`:`<select id="dPaymentStatus"><option ${order['Payment Status']==='Unpaid'?'selected':''}>Unpaid</option><option ${order['Payment Status']==='Paid'?'selected':''}>Paid</option></select>`;
  const statusOptions=['Pending Order','Pending Payment','Processing','Order Done'];
  const statusSelect=statusOptions.map(v=>`<option ${orderStatus===v?'selected':''}>${v}</option>`).join('');
  const statusControl=proof==='Submitted'?`<select id="dOrderStatus" disabled><option selected>Awaiting Confirmation</option></select>`:proof==='Rejected'?`<select id="dOrderStatus" disabled><option selected>Pending Payment</option></select>`:`<select id="dOrderStatus">${statusSelect}</select>`;
  const verifiedAt=order['Payment Verified At']?formatDateClient(order['Payment Verified At']):'';
  const collectionLabel=String(order['Collection Status']||'Not Collected');
  document.getElementById('orderDashboardContent').innerHTML=`<div class="order-dashboard-shell"><div class="order-dashboard-head panel"><div><div class="eyebrow">ORDER ${esc(order['Order ID'])}</div><div class="profile-title">${esc(order['Customer Name']||'')}</div><div class="subtle">${esc(order.Product||'Order')} · ${esc(formatDateClient(order['Order Date']))}</div></div><div class="order-head-badges"><span class="badge ${payment.badge}">${esc(payment.label)}</span><span class="badge ${orderStatus==='Order Done'?'paid':orderStatus==='Processing'?'blue':'neutral'}">${esc(orderStatus)}</span></div></div><div class="order-status-grid"><div class="order-status-card"><small>PAYMENT</small><strong>${esc(payment.label)}</strong><span>${proof==='Verified'?'Verified proof':proof==='Submitted'?'Receipt submitted':'No receipt submitted'}</span></div><div class="order-status-card"><small>ORDER STATUS</small><strong>${esc(orderStatus)}</strong><span>${collectionLabel==='Collected'?'Collected':'Not collected'}</span></div><div class="order-status-card"><small>COLLECTION</small><strong>${esc(collectionLabel)}</strong><span>${order['Collection Status']==='Collected'?'Order handed over':'Awaiting collection'}</span></div><div class="order-status-card"><small>PAYMENT PROOF</small><strong>${esc(proof)}</strong><span>${verifiedAt?`Verified ${esc(verifiedAt)}`:'Review required'}</span></div></div><div class="grid"><div class="panel"><div class="section-title" style="margin-top:0">Customer</div><div class="profile-grid order-customer-grid"><div class="info"><small>Customer Name</small><b>${esc(order['Customer Name']||'')}</b></div><div class="info"><small>Student ID</small><b>${esc(order['Student ID']||'Non student')}</b></div><div class="info"><small>Phone</small><b>${esc(order.Phone||'')}</b></div><div class="info"><small>Email</small><b>${esc(student?.Email||'-')}</b></div></div></div>${proofBlock}</div><div class="panel"><div class="section-title" style="margin-top:0">Order Management</div><div class="form"><label>Product</label><select id="dProduct"><option ${order.Product==='Scrabble Set'?'selected':''}>Scrabble Set</option><option ${order.Product==='T Shirt'?'selected':''}>T Shirt</option></select>${size}<div class="formgrid"><div><label>Quantity</label><input id="dQty" type="number" min="1" value="${esc(order.Quantity||1)}"></div><div><label>Unit Price</label><input id="dPrice" type="number" min="0" step="0.01" value="${esc(order['Unit Price']||0)}"></div></div><div class="formgrid"><div><label>Order Status</label>${statusControl}</div><div><label>Payment</label>${paymentControl}</div></div><div class="formgrid"><div><label>Collection Status</label><select id="dCollectionStatus"><option ${order['Collection Status']==='Not Collected'?'selected':''}>Not Collected</option><option ${order['Collection Status']==='Collected'?'selected':''}>Collected</option></select></div><div><label>Order Date</label><input id="dDate" type="date" value="${esc(String(order['Order Date']||'').slice(0,10))}"></div></div><label>Notes</label><textarea id="dNotes">${esc(order.Notes||'')}</textarea><div class="actions"><button class="primary" onclick="saveOrderDashboard('${esc(order['Order ID'])}')">Save Order</button></div></div></div></div>`;
}

async function openOrderReceipt(id){try{await run('openOrderReceipt',id)}catch(e){alert(e.message||e)}}
async function verifyOrderPayment(id){const note=prompt('Optional verification note:','Payment checked in bank account.');if(note===null)return;try{DATA=await run('verifyOrderPaymentProof',id,note);openOrder(id)}catch(e){alert(e.message||e)}}
async function rejectOrderPayment(id){const note=prompt('Reason for rejecting the receipt:','Receipt does not match the bank transaction.');if(note===null)return;try{DATA=await run('rejectOrderPaymentProof',id,note);openOrder(id)}catch(e){alert(e.message||e)}}
function openOrder(id){const order=orderRecord(id);if(!order)return;currentOrderId=id;page('orderDashboard');renderOrderDashboard(order)}
async function saveOrderDashboard(id){const order=orderRecord(id);if(!order)return;const product=document.getElementById('dProduct').value;const size=document.getElementById('dSize')?.value||'';if(product==='T Shirt'&&!size.trim())return alert('T Shirt size is required.');const proof=String(order['Payment Proof Status']||'Not Submitted');const storedPayment=String(order['Payment Status']||'Unpaid');const paymentSelect=document.getElementById('dPaymentStatus');const paymentStatus=proof==='Submitted'?'Unpaid':proof==='Verified'?'Paid':(paymentSelect?.value||storedPayment);const orderStatus=proof==='Submitted'?'Pending Payment':proof==='Rejected'?'Pending Payment':(document.getElementById('dOrderStatus')?.value||order['Order Status']||'Pending Order');try{DATA=await run('saveOrder',{orderId:id,studentId:order['Student ID'],customerName:order['Customer Name'],phone:order.Phone,product,size,quantity:Number(document.getElementById('dQty').value),unitPrice:Number(document.getElementById('dPrice').value),orderStatus,paymentStatus,collectionStatus:document.getElementById('dCollectionStatus').value,orderDate:document.getElementById('dDate').value,notes:document.getElementById('dNotes').value});openOrder(id)}catch(e){alert(e.message||e)}}
async function archiveOrderAction(id){if(!confirm('Archive this order? It will remain in history.'))return;try{DATA=await run('archiveOrder',id);renderOrders()}catch(e){alert(e.message||e)}}
async function restoreOrderAction(id){try{DATA=await run('restoreOrder',id);renderOrders()}catch(e){alert(e.message||e)}}
function showOrderForm(existing){const students=DATA.students.filter(s=>String(s.Active||'yes').toLowerCase()!=='no').map(s=>`<option value="${esc(s['Student ID'])}" ${existing&&String(existing['Student ID'])===String(s['Student ID'])?'selected':''}>${esc(s['Student Name'])} (${esc(s['Student ID'])})</option>`).join('');const nonStudent=existing&&!existing['Student ID'];showModal(`<h2>${existing?'Edit':'Add'} Order</h2><div class="form"><label>Customer type</label><select id="oType" onchange="toggleOrderCustomer()"><option value="student" ${!nonStudent?'selected':''}>Student</option><option value="other" ${nonStudent?'selected':''}>Non student</option></select><div id="studentBox" style="display:${nonStudent?'none':'block'}"><label>Student</label><select id="oStudent"><option value="">Choose student</option>${students}</select></div><div id="otherBox" style="display:${nonStudent?'block':'none'}"><label>Customer name</label><input id="oName" value="${esc(existing?.['Customer Name']||'')}"><label>Phone</label><input id="oPhone" value="${esc(existing?.Phone||'')}"></div><label>Product</label><select id="oProduct" onchange="toggleOrderProduct()"><option ${orderTab==='Scrabble Set'?'selected':''}>Scrabble Set</option><option ${orderTab==='T Shirt'?'selected':''}>T Shirt</option></select><div id="oSizeBox" style="display:${orderTab==='T Shirt'?'block':'none'}"><label>Size</label><input id="oSize" value="${esc(existing?.Size||'')}"></div><label>Quantity</label><input id="oQty" type="number" min="1" value="${esc(existing?.Quantity||1)}"><label>Unit Price</label><input id="oPrice" type="number" min="0" step="0.01" value="${esc(existing?.['Unit Price']||0)}"><label>Order Status</label><select id="oStatus"><option ${!existing||existing['Order Status']==='Pending Order'?'selected':''}>Pending Order</option><option ${existing?.['Order Status']==='Pending Payment'?'selected':''}>Pending Payment</option><option ${existing?.['Order Status']==='Processing'?'selected':''}>Processing</option><option ${existing?.['Order Status']==='Order Done'?'selected':''}>Order Done</option></select><label>Payment</label><select id="oPayment"><option ${!existing||existing['Payment Status']==='Unpaid'?'selected':''}>Unpaid</option><option ${existing?.['Payment Status']==='Paid'?'selected':''}>Paid</option></select><label>Collection</label><select id="oCollection"><option ${!existing||existing['Collection Status']==='Not Collected'?'selected':''}>Not Collected</option><option ${existing?.['Collection Status']==='Collected'?'selected':''}>Collected</option></select><label>Order Date</label><input id="oDate" type="date" value="${esc(existing?String(existing['Order Date']).slice(0,10):isoDate(new Date()))}"><label>Notes</label><textarea id="oNotes">${esc(existing?.Notes||'')}</textarea><div class="actions"><button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" onclick="saveOrderForm('${esc(existing?.['Order ID']||'')}')">Save</button></div></div>`)}
function toggleOrderProduct(){document.getElementById('oSizeBox').style.display=document.getElementById('oProduct').value==='T Shirt'?'block':'none'}
async function saveOrderForm(orderId){const other=document.getElementById('oType').value==='other';const studentId=other?'':document.getElementById('oStudent').value;const product=document.getElementById('oProduct').value;const size=document.getElementById('oSize')?.value||'';if(!other&&!studentId)return alert('Choose a student or select Non student.');if(other&&!document.getElementById('oName').value.trim())return alert('Customer name is required.');if(product==='T Shirt'&&!size.trim())return alert('T Shirt size is required.');try{DATA=await run('saveOrder',{orderId,studentId,customerName:other?document.getElementById('oName').value:'',phone:other?document.getElementById('oPhone').value:'',product,size,quantity:Number(document.getElementById('oQty').value),unitPrice:Number(document.getElementById('oPrice').value),orderStatus:document.getElementById('oStatus').value,paymentStatus:document.getElementById('oPayment').value,collectionStatus:document.getElementById('oCollection').value,orderDate:document.getElementById('oDate').value,notes:document.getElementById('oNotes').value});closeModal();renderAll()}catch(e){alert(e.message||e)}}
function showModal(html){document.getElementById('modalContent').innerHTML=html;document.getElementById('modal').classList.add('show')}
function closeModal(){document.getElementById('modal').classList.remove('show')}
async function syncNow(){try{await refreshOnline(false)}catch(e){}}
async function createBackup(){const button=document.getElementById('backupButton');if(button)button.disabled=true;try{const result=await run('createFullBackup');alert('Local backup downloaded: '+result.fileName)}catch(e){alert(e.message||e)}finally{if(button)button.disabled=false}}
const backupButton=document.createElement('button');backupButton.id='backupButton';backupButton.className='secondary';backupButton.textContent='Backup & Export';backupButton.onclick=createBackup;document.querySelector('#reports .toolbar')?.appendChild(backupButton);
async function voidPaymentAction(paymentId){if(!confirm('Void this payment? The payment history will remain and its four attendance records will become uncovered.'))return;try{DATA=await run('voidPayment',paymentId);renderAll()}catch(e){alert(e.message||e)}}
let profileReturnPage='students';
function openStudent(id){currentProfileId=String(id);profileReturnPage='students';page('studentProfile');document.getElementById('profileBack').textContent='← Back to Students';document.getElementById('profileBack').onclick=()=>page('students');document.getElementById('profileContent').innerHTML='<div class="panel">Loading student profile...</div>';run('getStudentDetail',String(id)).then(renderProfileData).catch(e=>{document.getElementById('profileContent').innerHTML='<div class="panel"><h3>Unable to load profile</h3><p>'+esc(e.message||e)+'</p></div>'})}
function openStudentFromReport(id){currentProfileId=String(id);profileReturnPage='reports';page('studentProfile');document.getElementById('profileBack').textContent='← Back to Reports';document.getElementById('profileBack').onclick=()=>page('reports');document.getElementById('profileContent').innerHTML='<div class="panel">Loading student profile...</div>';run('getStudentDetail',String(id)).then(renderProfileData).catch(e=>{document.getElementById('profileContent').innerHTML='<div class="panel"><h3>Unable to load profile</h3><p>'+esc(e.message||e)+'</p></div>'})}
function renderProfileData(d){
  const s=d.student||{};
  const attendance=[...(d.attendance||[])].sort((a,b)=>new Date(b.Date)-new Date(a.Date));
  const payments=[...(d.payments||[])].sort((a,b)=>new Date(b['Payment Date'])-new Date(a['Payment Date']));
  const orders=[...(d.orders||[])].sort((a,b)=>new Date(b['Order Date'])-new Date(a['Order Date']));
  const present=attendance.filter(a=>a.Status==='Present').length;
  const absent=attendance.filter(a=>a.Status==='Absent').length;
  const paymentState=d.paymentStatus||{};
  const cycle=Number(paymentState.progress ?? 0);
  const status=paymentState.status||statusFor(cycle);
  const currentCycle=Number(paymentState.currentCycle||1);
  const active=String(s.Active||'Yes').toLowerCase()!=='no';
  const commitment=String(s['Commitment Confirmed']||'').toLowerCase()==='yes';
  document.getElementById('profileContent').innerHTML=`
    <div class="profile-hero panel">
      <div class="profile-hero-main">
        <div class="profile-avatar">${esc(String(s['Student Name']||'?').trim().charAt(0).toUpperCase())}</div>
        <div><div class="eyebrow">STUDENT PROFILE · ${esc(s['Student ID']||'')}</div><h2 class="profile-name">${esc(s['Student Name']||'')}</h2><div class="profile-meta">${esc(s.School||'School not recorded')} <span>·</span> ${esc(s['Normal Class Time']||'Class time not set')}</div></div>
      </div>
      <div class="profile-hero-actions"><span class="status-pill ${active?'status-active':'status-archived'}"><span class="status-dot"></span>${active?'Active':'Archived'}</span><button class="primary" onclick="editStudent('${esc(s['Student ID'])}')">Edit Details</button></div>
    </div>

    <div class="profile-kpis">
      <div class="profile-kpi"><span>ATTENDANCE</span><strong>${present}</strong><small>Present records</small></div>
      <div class="profile-kpi"><span>ABSENCES</span><strong>${absent}</strong><small>Absent records</small></div>
      <div class="profile-kpi"><span>PACKAGE</span><strong>${cycle} / 4</strong><small>${esc(status)}</small></div>
      <div class="profile-kpi"><span>ORDERS</span><strong>${orders.length}</strong><small>Linked orders</small></div>
    </div>

    <div class="profile-section-title"><div><div class="eyebrow">RECORD</div><h3>Student Information</h3></div><span class="profile-section-note">ID ${esc(s['Student ID']||'')}</span></div>
    <div class="profile-info-grid">
      <div class="profile-info-card"><span>Student ID</span><strong>${esc(s['Student ID']||'-')}</strong></div>
      <div class="profile-info-card"><span>Student Name</span><strong>${esc(s['Student Name']||'-')}</strong></div>
      <div class="profile-info-card"><span>School</span><strong>${esc(s.School||'-')}</strong></div>
      <div class="profile-info-card"><span>Age</span><strong>${esc(s.Age||'-')}</strong></div>
      <div class="profile-info-card"><span>Scrabble Experience</span><strong>${esc(s['Scrabble Experience']||'-')}</strong></div>
      <div class="profile-info-card"><span>Normal Class</span><strong>${esc(s['Normal Class Time']||'-')}</strong></div>
      <div class="profile-info-card"><span>Registration Date</span><strong>${esc(formatDateClient(s['Registration Date'])||'-')}</strong></div>
      <div class="profile-info-card"><span>Programme Commitment</span><strong class="${commitment?'success':'warning'}">${commitment?'Confirmed':'Not confirmed'}</strong></div>
    </div>

    <div class="profile-section-title"><div><div class="eyebrow">CONTACT</div><h3>Parent / Guardian</h3></div></div>
    <div class="profile-contact-grid">
      <div class="profile-contact-card"><span>Parent / Guardian</span><strong>${esc(s['Parent / Guardian']||'-')}</strong></div>
      <div class="profile-contact-card"><span>WhatsApp</span><strong>${esc(s.WhatsApp||'-')}</strong></div>
      <div class="profile-contact-card"><span>Emergency Contact</span><strong>${esc(s['Emergency Contact']||'-')}</strong></div>
      <div class="profile-contact-card"><span>Email</span><strong>${esc(s.Email||'-')}</strong></div>
    </div>

    <div class="profile-section-title"><div><div class="eyebrow">HISTORY</div><h3>Attendance</h3></div><span class="profile-section-note">${attendance.length} record${attendance.length===1?'':'s'}</span></div>
    <div class="panel profile-table-panel scroll"><table><thead><tr><th>Date</th><th>Normal Class</th><th>Actual Class</th><th>Status</th><th>Notes</th></tr></thead><tbody>${attendance.map(a=>`<tr><td>${esc(formatDateClient(a.Date))}</td><td>${esc(s['Normal Class Time']||'-')}</td><td>${esc(a['Actual Class Time']||'-')}</td><td>${a.Status==='Present'?'<span class="badge present">Present</span>':'<span class="badge absent">Absent</span>'}</td><td>${esc(a.Notes||'')}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">No attendance records.</td></tr>'}</tbody></table></div>

    <div class="profile-section-title"><div><div class="eyebrow">FINANCIAL</div><h3>Payment Cycle</h3></div><span class="profile-section-note">Cycle ${currentCycle}</span></div>
    <div class="profile-payment-card panel"><div class="profile-payment-top"><div><span class="profile-payment-label">Current package progress</span><strong>${cycle} / 4 classes</strong></div><span class="badge ${cycle===4?'absent':cycle===3?'almost':'present'}">${esc(status)}</span></div><div class="profile-progress"><div style="width:${Math.min(100,cycle/4*100)}%"></div></div></div>
    <div class="panel profile-table-panel scroll"><table><thead><tr><th>Payment ID</th><th>Cycle</th><th>Amount</th><th>Payment Date</th><th>Classes Covered</th><th>Status</th><th>Notes</th></tr></thead><tbody>${payments.map(p=>`<tr><td>${esc(p['Payment ID']||'')}</td><td>${esc(p['Cycle Number']||'')}</td><td>RM${esc(p.Amount||0)}</td><td>${esc(formatDateClient(p['Payment Date']))}</td><td>${esc(p['Classes Covered']||'')}</td><td>${String(p.Status||'').toLowerCase()==='paid'?'<span class="badge paid">Paid</span>':'<span class="badge absent">'+esc(p.Status||'')+'</span>'}</td><td>${esc(p.Notes||'')}</td></tr>`).join('')||'<tr><td colspan="7" class="empty">No payment records.</td></tr>'}</tbody></table></div>

    <div class="profile-section-title"><div><div class="eyebrow">ORDERS</div><h3>Linked Orders</h3></div><span class="profile-section-note">${orders.length} order${orders.length===1?'':'s'}</span></div>
    <div class="panel profile-table-panel scroll"><table><thead><tr><th>Order ID</th><th>Product</th><th>Size</th><th>Qty</th><th>Total</th><th>Order Status</th><th>Payment</th><th>Collection</th><th>Date</th></tr></thead><tbody>${orders.map(o=>`<tr><td><button class="linkbtn" onclick="openOrder('${esc(o['Order ID'])}')">${esc(o['Order ID'])}</button></td><td>${esc(o.Product||'')}</td><td>${o.Product==='T Shirt'?esc(o.Size||''):'-'}</td><td>${esc(o.Quantity||1)}</td><td>RM${esc(o.Total||0)}</td><td>${esc(o['Order Status']||'')}</td><td>${esc(String(o['Payment Proof Status']||'')==='Submitted'?'Awaiting Confirmation':o['Payment Status']||'')}</td><td>${esc(o['Collection Status']||'')}</td><td>${esc(formatDateClient(o['Order Date']))}</td></tr>`).join('')||'<tr><td colspan="9" class="empty">No linked orders.</td></tr>'}</tbody></table></div>`;
}
function renderReports(){const month=document.getElementById('reportMonth').value||`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;document.getElementById('reportMonth').value=month;const inMonth=value=>String(value||'').slice(0,7)===month;const active=activeStudents();const attendance=DATA.attendance.filter(a=>inMonth(a.Date));const present=attendance.filter(a=>a.Status==='Present');const absent=attendance.filter(a=>a.Status==='Absent');const payments=DATA.payments.filter(p=>inMonth(p['Payment Date']));const paidPayments=payments.filter(p=>String(p.Status||'').toLowerCase()==='paid');const voidPayments=payments.filter(p=>String(p.Status||'').toLowerCase()==='void');const orders=DATA.orders.filter(o=>inMonth(o['Order Date']));const activeOrders=orders.filter(o=>String(o.Archived||'').toLowerCase()!=='yes');document.getElementById('rStudents').textContent=active.length;document.getElementById('rPresent').textContent=present.length;document.getElementById('rPayments').textContent=paidPayments.length;const studentRows=DATA.students.map(s=>{const sid=String(s['Student ID']);const sa=attendance.filter(a=>String(a['Student ID'])===sid);const so=activeOrders.filter(o=>String(o['Student ID'])===sid);const c=cycleFor(sid);const archived=String(s.Active||'').toLowerCase()==='no';return `<tr class="clickable" onclick="openStudentFromReport('${esc(sid)}')"><td><b>${esc(s['Student Name'])}</b>${archived?' <span class="badge absent">Archived</span>':''}</td><td>${esc(sid)}</td><td>${esc(s['Normal Class Time']||'-')}</td><td>${sa.filter(a=>a.Status==='Present').length}</td><td>${sa.filter(a=>a.Status==='Absent').length}</td><td>${badge(c)}</td><td>${so.length}</td></tr>`}).join('');document.getElementById('reportStudents').innerHTML=studentRows||'<tr><td colspan="7" class="empty">No students.</td></tr>';document.getElementById('attendanceSummary').innerHTML=`<p><b>${present.length}</b> Present</p><p><b>${absent.length}</b> Absent</p><p><b>${attendance.length}</b> attendance records</p><p>Selected month: <b>${esc(month)}</b></p>`;const statusCount=status=>activeOrders.filter(o=>o['Order Status']===status).length;const orderSets=activeOrders.filter(o=>o.Product==='Scrabble Set').length;const orderShirts=activeOrders.filter(o=>o.Product==='T Shirt').length;const paidAmount=paidPayments.reduce((sum,p)=>sum+(Number(p.Amount)||0),0);const voidAmount=voidPayments.reduce((sum,p)=>sum+(Number(p.Amount)||0),0);document.getElementById('orderSummary').innerHTML=`<p><b>${activeOrders.length}</b> active orders (${orderSets} Scrabble Sets, ${orderShirts} T Shirts)</p><p>Pending Order: <b>${statusCount('Pending Order')}</b></p><p>Pending Payment: <b>${statusCount('Pending Payment')}</b></p><p>Processing: <b>${statusCount('Processing')}</b></p><p>Order Done: <b>${statusCount('Order Done')}</b></p><p>Paid: <b>${activeOrders.filter(o=>o['Payment Status']==='Paid').length}</b> · Unpaid: <b>${activeOrders.filter(o=>o['Payment Status']==='Unpaid').length}</b></p><p>Not Collected: <b>${activeOrders.filter(o=>o['Collection Status']==='Not Collected').length}</b> · Collected: <b>${activeOrders.filter(o=>o['Collection Status']==='Collected').length}</b></p><p>Payments: <b>${paidPayments.length}</b> paid, RM${paidAmount} · Void: <b>${voidPayments.length}</b>, RM${voidAmount}</p>`}
function decoratePaymentHistory(){const table=document.querySelector('#paymentsHistory')?.closest('table');if(!table)return;const header=table.querySelector('thead tr');if(header&&!header.querySelector('[data-payment-action-header]')){const th=document.createElement('th');th.textContent='Action';th.dataset.paymentActionHeader='true';header.appendChild(th)}const rows=[...table.querySelectorAll('tbody tr')];const payments=[...DATA.payments].sort((a,b)=>new Date(b['Payment Date'])-new Date(a['Payment Date']));rows.forEach((row,index)=>{if(row.dataset.paymentActions)return;row.dataset.paymentActions='true';const payment=payments[index];const cell=document.createElement('td');if(payment&&String(payment.Status||'').toLowerCase()==='paid'){const button=document.createElement('button');button.className='secondary';button.textContent='Void Payment';button.onclick=()=>voidPaymentAction(String(payment['Payment ID']||''));cell.appendChild(button)}else cell.textContent='-';row.appendChild(cell)})}
const paymentHistoryObserver=new MutationObserver(decoratePaymentHistory);paymentHistoryObserver.observe(document.getElementById('paymentsHistory'),{childList:true});
document.getElementById('attDate').value=isoDate(latestSunday());document.getElementById('attDate').addEventListener('change',()=>{renderAttendance();renderHome()});document.getElementById('reportMonth').value=`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;


function showStudentForm(){
  showModal(`<div class="student-form-modal">
    <div class="student-form-header"><div><div class="eyebrow">STUDENT MANAGEMENT</div><h2>Add New Student</h2><p>Register a student and assign the initial four class package.</p></div><button class="modal-close" onclick="closeModal()" aria-label="Close">×</button></div>
    <div class="form-section"><div class="form-section-heading"><span>01</span><div><h3>Student Information</h3><p>Core student details and Scrabble experience.</p></div></div>
      <div class="formgrid"><div><label>Student Name <em>*</em></label><input id="sName" required placeholder="Full name"></div><div><label>School</label><input id="sSchool" placeholder="School name"></div></div>
      <div class="formgrid"><div><label>Age</label><input id="sAge" type="number" min="1" max="18" placeholder="Age"></div><div><label>Scrabble Experience</label><select id="sExperience"><option value="">Choose experience</option><option>Never played before</option><option>Beginner.</option><option>Intermediate.</option></select></div></div>
    </div>
    <div class="form-section"><div class="form-section-heading"><span>02</span><div><h3>Class & Registration</h3><p>Set the student's regular class and registration date.</p></div></div>
      <div class="formgrid"><div><label>Normal Class Time <em>*</em></label><select id="sClass"><option value="">Choose class</option><option>10:30 AM</option><option>2:00 PM</option></select></div><div><label>Registration Date</label><input id="sDate" type="date" value="${isoDate(new Date())}"></div></div>
    </div>
    <div class="form-section"><div class="form-section-heading"><span>03</span><div><h3>Parent / Guardian</h3><p>Primary contact and emergency information.</p></div></div>
      <div class="formgrid"><div><label>Parent / Guardian</label><input id="sParent" placeholder="Parent or guardian name"></div><div><label>Email</label><input id="sEmail" type="email" placeholder="Parent / guardian email"></div></div>
      <div class="formgrid"><div><label>WhatsApp Number</label><input id="sWhatsApp" placeholder="Phone / WhatsApp"></div><div><label>Emergency Contact</label><input id="sEmergency" placeholder="Emergency phone number"></div></div>
    </div>
    <div class="form-section commitment-section"><div class="form-section-heading"><span>04</span><div><h3>Programme Confirmation</h3><p>Record the parent or guardian's programme commitment.</p></div></div><label class="commitment-check"><input id="sCommitment" type="checkbox"><span>Parent / guardian confirms the programme attendance, limited seating and photo use commitments.</span></label></div>
    <div class="form-actions"><button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" onclick="saveStudentForm()">Create Student</button></div>
  </div>`);
}

async function saveStudentForm(){
  const record={studentName:document.getElementById('sName').value,school:document.getElementById('sSchool').value,age:document.getElementById('sAge').value,experience:document.getElementById('sExperience').value,parentGuardian:document.getElementById('sParent').value,whatsapp:document.getElementById('sWhatsApp').value,emergency:document.getElementById('sEmergency').value,normalClassTime:document.getElementById('sClass').value,email:document.getElementById('sEmail').value,registrationDate:document.getElementById('sDate').value,commitment:document.getElementById('sCommitment').checked};
  if(!String(record.studentName).trim())return alert('Student name is required.');
  if(!record.normalClassTime)return alert('Choose the normal class time.');
  try{DATA=await run('saveStudent',record);closeModal();page('students');renderAll();alert('Student added successfully. Student ID: '+nextAddedStudentId(record));}catch(e){alert(e.message||e)}
}
function nextAddedStudentId(record){const matches=DATA.students.filter(s=>String(s['Student Name']).trim()===String(record.studentName).trim());return matches.length?matches[matches.length-1]['Student ID']:''}

function editStudent(id){
  const s=DATA.students.find(x=>String(x['Student ID'])===String(id));
  if(!s)return alert('Student not found.');
  const active=String(s.Active||'Yes').toLowerCase()!=='no';
  showModal(`<div class="student-form-modal edit-student-modal">
    <div class="student-form-header"><div><div class="eyebrow">STUDENT RECORD · ${esc(s['Student ID'])}</div><h2>Edit Student Details</h2><p>Update selected information for this existing student record.</p></div><button class="modal-close" onclick="closeModal()" aria-label="Close">×</button></div>
    <div class="edit-identity-strip"><div><span>Student ID</span><strong>${esc(s['Student ID'])}</strong></div><div><span>Record status</span><strong class="${active?'success':'danger-text'}">${active?'Active':'Archived'}</strong></div><div><span>Registered</span><strong>${esc(formatDateClient(s['Registration Date'])||'-')}</strong></div></div>
    <div class="form-section"><div class="form-section-heading"><span>01</span><div><h3>Student Details</h3><p>Identity and programme information.</p></div></div>
      <div class="formgrid"><div><label>Student Name <em>*</em></label><input id="eName" required value="${esc(s['Student Name']||'')}"></div><div><label>School</label><input id="eSchool" value="${esc(s.School||'')}"></div></div>
      <div class="formgrid"><div><label>Age</label><input id="eAge" type="number" min="1" max="18" value="${esc(s.Age||'')}"></div><div><label>Scrabble Experience</label><select id="eExperience"><option value="">Choose experience</option><option ${s['Scrabble Experience']==='Never played before'?'selected':''}>Never played before</option><option ${s['Scrabble Experience']==='Beginner.'?'selected':''}>Beginner.</option><option ${s['Scrabble Experience']==='Intermediate.'?'selected':''}>Intermediate.</option></select></div></div>
    </div>
    <div class="form-section"><div class="form-section-heading"><span>02</span><div><h3>Class Placement</h3><p>Manage the student's regular class assignment.</p></div></div>
      <div class="formgrid"><div><label>Normal Class Time <em>*</em></label><select id="eClass"><option ${s['Normal Class Time']==='10:30 AM'?'selected':''}>10:30 AM</option><option ${s['Normal Class Time']==='2:00 PM'?'selected':''}>2:00 PM</option></select></div><div><label>Registration Date</label><input id="eDate" type="date" value="${esc(String(s['Registration Date']||'').slice(0,10))}"></div></div>
    </div>
    <div class="form-section"><div class="form-section-heading"><span>03</span><div><h3>Parent / Guardian</h3><p>Keep contact details current for programme communication.</p></div></div>
      <div class="formgrid"><div><label>Parent / Guardian</label><input id="eParent" value="${esc(s['Parent / Guardian']||'')}"></div><div><label>Email</label><input id="eEmail" type="email" value="${esc(s.Email||'')}"></div></div>
      <div class="formgrid"><div><label>WhatsApp Number</label><input id="eWhatsApp" value="${esc(s.WhatsApp||'')}"></div><div><label>Emergency Contact</label><input id="eEmergency" value="${esc(s['Emergency Contact']||'')}"></div></div>
    </div>
    <div class="form-section commitment-section"><div class="form-section-heading"><span>04</span><div><h3>Programme Confirmation</h3><p>Review the recorded parent or guardian commitment.</p></div></div><label class="commitment-check"><input id="eCommitment" type="checkbox" ${String(s['Commitment Confirmed']||'').toLowerCase()==='yes'?'checked':''}><span>Parent / guardian confirms the programme attendance, limited seating and photo use commitments.</span></label></div>
    <div class="form-actions"><button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" onclick="saveEditStudentForm('${esc(s['Student ID'])}')">Save Changes</button></div>
  </div>`);
}

async function saveEditStudentForm(id){
  const record={studentId:id,studentName:document.getElementById('eName').value,school:document.getElementById('eSchool').value,age:document.getElementById('eAge').value,experience:document.getElementById('eExperience').value,parentGuardian:document.getElementById('eParent').value,whatsapp:document.getElementById('eWhatsApp').value,emergency:document.getElementById('eEmergency').value,normalClassTime:document.getElementById('eClass').value,email:document.getElementById('eEmail').value,registrationDate:document.getElementById('eDate').value,commitment:document.getElementById('eCommitment').checked};
  if(!String(record.studentName).trim())return alert('Student name is required.');
  if(!record.normalClassTime)return alert('Choose the normal class time.');
  try{DATA=await run('updateStudent',record);closeModal();renderAll();if(document.getElementById('studentProfile')?.classList.contains('active'))openStudent(id);alert('Student information updated successfully.');}catch(e){alert(e.message||e)}
}
