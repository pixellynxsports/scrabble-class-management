/* SCMS Parent Portal UI and interaction module */
function parentPaymentState(sid){
  return calculatePaymentState(PARENT_CONTEXT.payments,PARENT_CONTEXT.attendance,sid);
}
function parentStatusBadge(state){const cls=state.status==='Payment Due'?'absent':state.status==='Almost Due'?'almost':'present';return `<span class="badge ${cls}">${esc(state.status)}</span>`}
function selectParentChild(id){PARENT_CONTEXT.selectedStudentId=String(id);renderParentPortal();}
function parentPackagePaymentButton(state,extraClass=''){
  const active=state.status==='Payment Due';
  if(teacherPreviewMode)return `<button class="parent-pay-btn ghost ${extraClass}" disabled>Preview Only</button>`;
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
    appNotify(e.message||'Unable to start the payment. Please try again.');
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
  if(teacherPreviewMode){appNotify('Teacher Preview is read only.');return;}
  const order=PARENT_CONTEXT.orders.find(o=>String(o['Order ID'])===String(orderId));if(!order)return;
  document.getElementById('parentDetailEyebrow').textContent='ORDER PAYMENT';document.getElementById('parentDetailTitle').textContent='DuitNow QR Payment';
  document.getElementById('parentDetailBody').innerHTML=`<div class="qr-payment-card"><h3>Pay your order</h3><p>Scan the QR code below to make payment to <strong>Pixel Lynx Sports Enterprise</strong>.</p><div class="qr-order-amount">Order ${esc(order['Order ID'])} · <b>RM${esc(order.Total||0)}</b></div><img src="assets/pixel-lynx-duitnow-qr.jpeg" alt="Pixel Lynx Sports Enterprise DuitNow QR"><div class="qr-note">After payment, choose your bank receipt below. Upload one receipt, then click <strong>Complete Payment</strong>. Payment stays pending until the teacher verifies the bank transaction.</div><div class="receipt-upload-box"><label for="orderReceiptInput"><b>Upload payment receipt</b><span>One receipt only · JPG, PNG, WEBP or PDF · up to 10 MB</span></label><input id="orderReceiptInput" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onchange="prepareOrderReceipt()"><button class="primary complete-payment-btn" id="completeOrderPaymentBtn" type="button" disabled onclick="submitOrderReceipt('${esc(order['Order ID'])}')">Complete Payment</button><div id="orderReceiptStatus" class="subtle"></div></div></div>`;
}

function prepareOrderReceipt(){
  const input=document.getElementById('orderReceiptInput');const button=document.getElementById('completeOrderPaymentBtn');const status=document.getElementById('orderReceiptStatus');const file=input?.files?.[0];
  if(!file){if(button)button.disabled=true;if(status)status.textContent='';return;}
  if(file.size>10*1024*1024){appNotify('Receipt must be 10 MB or smaller.');input.value='';if(button)button.disabled=true;return;}
  const allowed=['image/jpeg','image/png','image/webp','application/pdf'];if(!allowed.includes(file.type)){appNotify('Use JPG, PNG, WEBP or PDF for the receipt.');input.value='';if(button)button.disabled=true;return;}
  if(button)button.disabled=false;if(status)status.textContent=`Selected: ${file.name}`;
}

async function submitOrderReceipt(orderId){
  const input=document.getElementById('orderReceiptInput');const button=document.getElementById('completeOrderPaymentBtn');const status=document.getElementById('orderReceiptStatus');const file=input?.files?.[0];if(!file)return;
  if(file.size>10*1024*1024){appNotify('Receipt must be 10 MB or smaller.');input.value='';if(button)button.disabled=true;return;}
  const allowed=['image/jpeg','image/png','image/webp','application/pdf'];if(!allowed.includes(file.type)){appNotify('Use JPG, PNG, WEBP or PDF for the receipt.');input.value='';if(button)button.disabled=true;return;}
  if(button){button.disabled=true;button.textContent='Submitting...';}if(input)input.disabled=true;if(status)status.textContent='Uploading receipt and submitting payment proof...';
  try{
    const form=new FormData();form.append('order_id',String(orderId));form.append('receipt',file,file.name);
    const {data,error}=await supabaseClient.functions.invoke('submit-order-payment-proof',{body:form});
    if(error)throw new Error(error.message||'Unable to submit the receipt.');
    if(!data?.success)throw new Error(data?.error||'Unable to submit the receipt.');
    await loadParentPortal();
    const fresh=PARENT_CONTEXT.orders.find(o=>String(o['Order ID'])===String(orderId));
    if(fresh)openParentOrderDetail(orderId);
  }catch(e){if(status)status.textContent='';if(input)input.disabled=false;if(button){button.disabled=false;button.textContent='Complete Payment';}appNotify(e.message||'Unable to submit the receipt.');}
}
/* ===== PARENT PORTAL UI ===== */
function parentCertificateRecords(studentId){
  return (PARENT_CONTEXT.achievements||[])
    .filter(function(a){
      return String(a.student_id)===String(studentId)&&
        String(a.source_type||'')==='tournament'&&
        String(a.certificate_path||a.file_path||'').length>0;
    })
    .sort(function(a,b){
      const da=new Date(a.achievement_date||0).getTime();
      const db=new Date(b.achievement_date||0).getTime();
      return db-da;
    });
}

function parentCertificateMonthLabel(value){
  const d=new Date(value||0);
  if(Number.isNaN(d.getTime()))return 'Other Certificates';
  return d.toLocaleDateString(undefined,{month:'long',year:'numeric'});
}

function parentCertificateCard(a){
  const path=a.certificate_path||a.file_path||'';
  const title=a.certificate_caption||a.title||'Certificate';
  return '<article class="parent-certificate-grid-card">'+
    '<button class="parent-certificate-grid-preview" type="button" data-certificate-path="'+esc(path)+'" data-certificate-title="'+esc(title)+'" onclick="openParentCertificate(this.dataset.certificatePath,this.dataset.certificateTitle)" aria-label="View '+esc(title)+'">'+
      '<span class="parent-certificate-grid-thumb-wrap"><img class="parent-certificate-grid-thumb" data-certificate-thumb="'+esc(a.certificate_thumbnail_path||'')+'" alt="Certificate preview"></span>'+
    '</button>'+
    '<div class="parent-certificate-grid-info">'+
      '<strong>'+esc(title)+'</strong>'+
      '<small>'+esc(formatDateClient(a.achievement_date))+'</small>'+
      '<div class="parent-certificate-grid-actions">'+
        '<button class="secondary small" type="button" data-certificate-path="'+esc(path)+'" data-certificate-title="'+esc(title)+'" onclick="openParentCertificate(this.dataset.certificatePath,this.dataset.certificateTitle)">View</button>'+
        '<button class="secondary small" type="button" data-certificate-path="'+esc(path)+'" data-certificate-title="'+esc(title)+'" onclick="downloadParentCertificate(this.dataset.certificatePath,this.dataset.certificateTitle)">Download</button>'+
      '</div>'+
    '</div>'+
  '</article>';
}

function renderParentAchievementRows(achievements){
  return achievements.map(a=>{
    const isCertificate=String(a.source_type||'')==='tournament'&&String(a.certificate_path||a.file_path||'').length>0;
    if(isCertificate)return parentCertificateCard(a);
    const fileButton=a.file_path?'<button class="secondary" type="button" onclick=\'downloadAchievement('+JSON.stringify(a.file_path)+','+JSON.stringify(a.file_name||'Achievement')+')\'>Download</button>':'';
    return '<div class="parent-achievement-row"><div class="parent-achievement-icon">'+(a.file_path?'↗':'★')+'</div><div class="parent-achievement-copy"><strong>'+esc(a.title)+'</strong><small>'+esc(a.category||'Achievement')+' · '+esc(formatDateClient(a.achievement_date))+'</small>'+(a.description?'<p>'+esc(a.description)+'</p>':'')+'</div>'+fileButton+'</div>';
  }).join('')||'<div class="achievement-parent-empty">No achievement records have been added yet.</div>';
}

function renderParentCertificateDashboardSection(certificates){
  if(!certificates.length){
    return '<section class="parent-card parent-certificates-dashboard"><div class="section-head"><div><div class="eyebrow">CERTIFICATES</div><h3>Certificates</h3></div><span class="badge blue">0 certificates</span></div><div class="parent-certificates-empty"><div class="parent-certificates-empty-icon">C</div><strong>No certificates yet</strong><span>Certificates earned through tournaments will appear here.</span></div></section>';
  }
  const latest=certificates[0];
  const path=latest.certificate_path||latest.file_path||'';
  const title=latest.certificate_caption||latest.title||'Certificate';
  return '<section class="parent-card parent-certificates-dashboard">'+
    '<div class="section-head"><div><div class="eyebrow">CERTIFICATES</div><h3>Latest Certificate</h3><p class="parent-certificates-section-subtitle">Your most recently issued tournament certificate.</p></div><span class="badge blue">'+certificates.length+' certificate'+(certificates.length===1?'':'s')+'</span></div>'+
    '<div class="parent-latest-certificate">'+
      '<button class="parent-latest-certificate-preview" type="button" data-certificate-path="'+esc(path)+'" data-certificate-title="'+esc(title)+'" onclick="openParentCertificate(this.dataset.certificatePath,this.dataset.certificateTitle)" aria-label="View latest certificate"><span class="parent-latest-certificate-thumb-wrap"><img class="parent-latest-certificate-thumb" data-certificate-thumb="'+esc(latest.certificate_thumbnail_path||'')+'" alt="Latest certificate preview"></span></button>'+
      '<div class="parent-latest-certificate-info"><span class="eyebrow">MOST RECENT</span><h4>'+esc(title)+'</h4><p>'+esc(formatDateClient(latest.achievement_date))+' · '+esc(latest.certificate_number||'Certificate')+'</p><div class="parent-latest-certificate-actions"><button class="secondary small" type="button" data-certificate-path="'+esc(path)+'" data-certificate-title="'+esc(title)+'" onclick="openParentCertificate(this.dataset.certificatePath,this.dataset.certificateTitle)">View Certificate</button><button class="primary small" type="button" onclick="openParentCertificates()">View All Certificates</button></div></div>'+
    '</div>'+
  '</section>';
}

function renderParentCertificatesPage(studentId){
  const s=PARENT_CONTEXT.students.find(function(x){return String(x.student_id)===String(studentId);});
  const certificates=parentCertificateRecords(studentId);
  const groups={};
  certificates.forEach(function(a){
    const key=parentCertificateMonthLabel(a.achievement_date);
    if(!groups[key])groups[key]=[];
    groups[key].push(a);
  });
  const months=Object.keys(groups).sort(function(a,b){
    const da=new Date(groups[a][0].achievement_date||0).getTime();
    const db=new Date(groups[b][0].achievement_date||0).getTime();
    return db-da;
  });
  const monthSections=months.map(function(month){
    const cards=groups[month].map(parentCertificateCard).join('');
    return '<section class="parent-certificate-month"><div class="parent-certificate-month-head"><div><div class="eyebrow">CERTIFICATES</div><h2>'+esc(month)+'</h2></div><span>'+groups[month].length+' certificate'+(groups[month].length===1?'':'s')+'</span></div><div class="parent-certificate-grid">'+cards+'</div></section>';
  }).join('');
  const name=s?.student_name||'Student';
  return '<div class="parent-certificates-page">'+
    '<div class="parent-certificates-page-head"><div><button class="parent-certificates-back" type="button" onclick="closeParentCertificates()">← Back to Parent Portal</button><div class="eyebrow">CERTIFICATE LIBRARY</div><h2>'+esc(name)+' · Certificates</h2><p>All tournament certificates are stored here, with the newest certificates shown first.</p></div><span class="badge blue">'+certificates.length+' total</span></div>'+
    (certificates.length?monthSections:'<div class="parent-certificates-empty page-empty"><div class="parent-certificates-empty-icon">C</div><strong>No certificates yet</strong><span>Certificates earned through tournaments will appear here.</span></div>')+
  '</div>';
}

function openParentCertificates(){
  const dashboard=document.getElementById('parentDashboard');
  const selector=document.getElementById('parentChildren');
  if(!dashboard)return;
  const sid=String(PARENT_CONTEXT.selectedStudentId||'');
  if(selector)selector.classList.add('hidden');
  dashboard.classList.add('parent-certificates-mode');
  dashboard.innerHTML=renderParentCertificatesPage(sid);
  hydrateParentCertificateCards();
  window.scrollTo({top:0,behavior:'smooth'});
}

function closeParentCertificates(){
  const selector=document.getElementById('parentChildren');
  const dashboard=document.getElementById('parentDashboard');
  if(selector)selector.classList.remove('hidden');
  if(dashboard)dashboard.classList.remove('parent-certificates-mode');
  renderParentPortal();
  window.scrollTo({top:0,behavior:'smooth'});
}


async function hydrateParentCertificateCards(){
  const nodes=[...document.querySelectorAll('[data-certificate-thumb]')];
  for(const img of nodes){
    const path=img.getAttribute('data-certificate-thumb');
    if(!path){img.closest('.parent-certificate-thumb-wrap')?.classList.add('empty');continue;}
    try{
      const result=await supabaseClient.storage.from('student-achievements').createSignedUrl(path,600);
      if(result.error||!result.data?.signedUrl)throw result.error||new Error('Preview unavailable');
      img.src=result.data.signedUrl;
    }catch(error){
      img.removeAttribute('src');
      img.closest('.parent-certificate-thumb-wrap')?.classList.add('empty');
    }
  }
}

async function getParentCertificateUrl(path){
  const result=await supabaseClient.storage.from('student-achievements').createSignedUrl(path,600);
  if(result.error)throw result.error;
  if(!result.data?.signedUrl)throw new Error('Certificate is unavailable.');
  return result.data.signedUrl;
}
async function openParentCertificate(path,title){
  if(!path)return;
  try{
    const url=await getParentCertificateUrl(path);
    window.open(url,'_blank','noopener');
  }catch(error){
    appNotify(error.message||'Certificate is unavailable.','error','Certificate Unavailable');
  }
}
async function downloadParentCertificate(path,title){
  if(!path)return;
  try{
    const url=await getParentCertificateUrl(path);
    const response=await fetch(url);
    if(!response.ok)throw new Error('Certificate download failed.');
    const blob=await response.blob();
    const objectUrl=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=objectUrl;
    a.download=(String(title||'Certificate').replace(/[^a-zA-Z0-9._-]+/g,'_')||'Certificate')+'.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);
  }catch(error){
    appNotify(error.message||'Certificate download failed.','error','Certificate Download Failed');
  }
}

function renderTeacherAchievementPanel(achievements,studentId){
  const rows=achievements.map(a=>{
    const fileButton=a.file_path?'<button class="secondary" type="button" onclick=\'downloadAchievement('+JSON.stringify(a.file_path)+','+JSON.stringify(a.file_name||'Achievement')+')\'>Download</button>':'';
    const description=a.description?'<p>'+esc(a.description)+'</p>':'';
    const fileName=a.file_name?'<small class="achievement-file-name">'+esc(a.file_name)+'</small>':'';
    return '<div class="achievement-record"><div class="achievement-record-main"><div class="achievement-record-icon">'+(a.file_path?'↗':'★')+'</div><div><div class="achievement-record-title">'+esc(a.title)+'</div><div class="achievement-record-meta">'+esc(a.category||'Achievement')+' · '+esc(formatDateClient(a.achievement_date))+'</div>'+description+fileName+'</div></div><div class="achievement-record-actions">'+fileButton+'<button class="secondary danger-button" type="button" onclick="deleteAchievementRecord(\''+esc(a.achievement_id)+'\',\''+esc(studentId)+'\')">Delete</button></div></div>';
  }).join('')||'<div class="achievement-record-empty">No achievement records have been added for this student yet.</div>';
  return '<div class="profile-section-title"><div><div class="eyebrow">ACHIEVEMENTS</div><h3>Achievements &amp; Records</h3></div><span class="profile-section-note">'+achievements.length+' record'+(achievements.length===1?'':'s')+'</span></div><div class="profile-achievement-manager panel"><div class="achievement-manager-form"><div class="achievement-manager-heading"><div><strong>Add achievement record</strong><small>Store tournament records, certificates, awards or other student achievements.</small></div></div><div class="achievement-form-grid"><div><label>Title</label><input id="achievementTitle" type="text" placeholder="e.g. October Friendly Tournament"></div><div><label>Category</label><select id="achievementCategory"><option>Friendly Tournament</option><option>Certificate</option><option>Award</option><option>Competition</option><option>Achievement</option><option>Other</option></select></div><div><label>Date</label><input id="achievementDate" type="date" value="'+isoDate(new Date())+'"></div><div class="full"><label>Description</label><textarea id="achievementDescription" rows="2" placeholder="Optional notes about this achievement"></textarea></div><div class="full"><label>Attachment <span class="subtle">Optional · PDF, JPG, PNG, WEBP or DOCX · Max 10 MB</span></label><input id="achievementFile" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,application/pdf,image/jpeg,image/png,image/webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document"></div></div><div class="achievement-form-actions"><button class="primary" type="button" onclick="saveAchievementRecord(\''+esc(studentId)+'\')">Save Achievement</button></div></div><div class="achievement-record-list">'+rows+'</div></div>';
}
function parentTournamentFormatLabel(value){return ({single_elimination:'Single Elimination',double_elimination:'Double Elimination',round_robin:'Round Robin',swiss:'Swiss',free_for_all:'Free For All',leaderboard:'Leaderboard'}[value]||String(value||'').replace(/_/g,' '));}
function parentLocalDateKey(value){
  if(!value)return '';
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return String(value).slice(0,10);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function parentTournamentVisible(t){
  if(!t)return false;
  if(t.status==='active')return true;
  if(!['completed','archived'].includes(t.status)||!t.completed_at)return false;
  return parentLocalDateKey(t.completed_at)===parentLocalDateKey(new Date());
}
function parentTournamentForStudent(t,sid){
  return (t.players||[]).some(p=>String(p.student_id)===String(sid));
}
function parentTournamentStandings(t){
  const map={};
  (t.players||[]).forEach(p=>{
    map[p.player_id]={player_id:p.player_id,student_id:p.student_id,display_name:p.display_name,seed:Number(p.seed)||999,wins:0,losses:0,ties:0,points:0,score_for:0,score_against:0,score_diff:0,final_rank:p.final_rank};
  });
  (t.matches||[]).filter(m=>m.status==='completed').forEach(m=>{
    const a=map[m.player1_id],b=map[m.player2_id],sa=Number(m.player1_score),sb=Number(m.player2_score);
    if(a&&Number.isFinite(sa))a.score_for+=sa;
    if(a&&Number.isFinite(sb))a.score_against+=sb;
    if(b&&Number.isFinite(sb))b.score_for+=sb;
    if(b&&Number.isFinite(sa))b.score_against+=sa;
    if(!m.winner_player_id){if(a)a.ties++;if(b)b.ties++;return;}
    const w=map[m.winner_player_id],l=w&&String(w.player_id)===String(m.player1_id)?b:a;
    if(w){w.wins++;w.points+=1;}
    if(l)l.losses++;
  });
  const rows=Object.values(map);
  rows.forEach(p=>{p.score_diff=p.score_for-p.score_against;});
  rows.sort((a,b)=>
    (t.status==='completed'||t.status==='archived'
      ?(Number(a.final_rank)||999)-(Number(b.final_rank)||999)
      :b.points-a.points||b.wins-a.wins||b.score_diff-a.score_diff||a.seed-b.seed||a.display_name.localeCompare(b.display_name)
    )
  );
  return rows;
}

function parentTournamentOpponentName(t,m,sid){
  const player=(t.players||[]).find(p=>String(p.student_id)===String(sid));
  if(!player)return '';
  const opponentId=String(m.player1_id)===String(player.player_id)?m.player2_id:m.player1_id;
  const opponent=(t.players||[]).find(p=>String(p.player_id)===String(opponentId));
  return opponent?.display_name||'BYE';
}
function renderParentTournamentPanel(sid){
  const visible=(PARENT_CONTEXT.tournaments||[]).filter(t=>parentTournamentVisible(t)&&parentTournamentForStudent(t,sid));
  if(!visible.length)return '';
  return visible.map(t=>{
    const active=t.status==='active';
    const rows=parentTournamentStandings(t);
    const player=(t.players||[]).find(p=>String(p.student_id)===String(sid));
    const currentRound=Number(t.current_round||1);
    const currentMatches=(t.matches||[]).filter(m=>Number(m.round_number)===currentRound);
    const studentMatch=currentMatches.find(m=>String(m.player1_id)===String(player?.player_id)||String(m.player2_id)===String(player?.player_id));
    const completed=(t.matches||[]).filter(m=>m.status==='completed').length;
    const awards=(t.awards||[]).filter(a=>a.student_id);
    const podium=rows.slice(0,3).map((p,i)=>'<div class="parent-tournament-podium-place '+(i===0?'first':i===1?'second':'third')+'"><span>'+['1st','2nd','3rd'][i]+'</span><strong>'+esc(p.display_name)+'</strong><small>'+esc(String(p.points))+' pts</small></div>').join('');
    const standings=rows.map((p,i)=>'<tr class="'+(String(p.student_id)===String(sid)?'self':'')+'"><td><strong>'+esc(String(i+1))+'</strong></td><td><strong>'+esc(p.display_name)+'</strong></td><td>'+p.wins+'</td><td>'+p.losses+'</td><td>'+p.ties+'</td><td><strong>'+p.points+'</strong></td><td>'+(p.score_diff>=0?'+':'')+p.score_diff+'</td></tr>').join('');
    const pairings=currentMatches.map(m=>{
      const mine=String(m.player1_id)===String(player?.player_id)||String(m.player2_id)===String(player?.player_id);
      return '<div class="parent-tournament-match '+(mine?'mine':'')+'"><div><span>Match '+esc(m.match_number)+'</span><strong>'+esc((t.players||[]).find(p=>String(p.player_id)===String(m.player1_id))?.display_name||'BYE')+'</strong><small>vs</small><strong>'+esc((t.players||[]).find(p=>String(p.player_id)===String(m.player2_id))?.display_name||'BYE')+'</strong></div><div class="parent-tournament-score">'+(m.status==='completed'?esc(String(m.player1_score??0))+' : '+esc(String(m.player2_score??0)):'LIVE')+'</div></div>';
    }).join('')||'<div class="empty">No live pairings are available right now.</div>';
    const rounds=(t.rounds||[]).map(r=>'<div class="parent-tournament-round"><span>Round '+esc(r.round_number)+'</span><strong>'+esc(r.status==='completed'?'Completed':'Live')+'</strong><small>'+((t.matches||[]).filter(m=>Number(m.round_number)===Number(r.round_number)&&m.status==='completed').length)+' results</small></div>').join('');
    if(active){
      return '<section class="parent-tournament-live parent-card"><div class="parent-tournament-header"><div><div class="parent-tournament-kicker"><span class="live-dot"></span> LIVE NOW</div><h2>'+esc(t.name)+'</h2><p>'+esc(parentTournamentFormatLabel(t.format))+' · '+esc(t.settings?.category||'Open')+' · Round '+esc(currentRound)+' of '+esc(t.rounds_total||t.rounds?.length||'?')+'</p></div><div class="parent-tournament-live-mark"><span>LIVE</span><small>Read only</small></div></div><div class="parent-tournament-live-grid"><div><div class="parent-tournament-section-head"><h3>Live Pairings</h3><span>'+completed+'/'+(t.matches||[]).length+' results</span></div><div class="parent-tournament-matches">'+pairings+'</div></div><div><div class="parent-tournament-section-head"><h3>Live Standings</h3><span>'+rows.length+' players</span></div><div class="scroll"><table class="parent-tournament-table"><thead><tr><th>#</th><th>Player</th><th>W</th><th>L</th><th>T</th><th>Pts</th><th>Diff</th></tr></thead><tbody>'+standings+'</tbody></table></div></div></div><div class="parent-tournament-rounds"><div class="parent-tournament-section-head"><h3>Rounds</h3><span>Read only</span></div>'+rounds+'</div></section>';
    }
    const awardCards=awards.map(a=>'<div class="parent-tournament-award"><span>'+esc(a.award_type==='1st Place'?'1st':a.award_type==='2nd Place'?'2nd':a.award_type==='3rd Place'?'3rd':a.award_type.includes('Most Improved')?'MIP':a.award_type.includes('Strategic Player')?'SP':a.award_type.includes('Fighting Spirit')?'FS':a.award_type)+'</span><strong>'+esc(a.student_name||'Award recipient')+'</strong></div>').join('');
    return '<section class="parent-tournament-complete parent-card"><div class="parent-tournament-completion-hero"><div><div class="parent-tournament-kicker">TOURNAMENT COMPLETE</div><h2>'+esc(t.name)+'</h2><p>'+esc(parentTournamentFormatLabel(t.format))+' · '+esc(t.settings?.category||'Open')+' · Completed '+esc(formatDateClient(t.completed_at))+'</p></div><div class="parent-complete-badge">FINAL</div></div><div class="parent-tournament-celebration"><span>FINAL RESULTS</span><h3>Congratulations to all players</h3><p>The official podium, final standings and special awards are preserved for today.</p></div><div class="parent-tournament-podium">'+podium+'</div><div class="parent-tournament-final-grid"><div><div class="parent-tournament-section-head"><h3>Final Standings</h3><span>'+rows.length+' players</span></div><div class="scroll"><table class="parent-tournament-table"><thead><tr><th>#</th><th>Player</th><th>W</th><th>L</th><th>T</th><th>Pts</th><th>Diff</th></tr></thead><tbody>'+standings+'</tbody></table></div></div><div><div class="parent-tournament-section-head"><h3>Special Awards</h3></div><div class="parent-tournament-awards">'+(awardCards||'<div class="empty">Special awards have not been recorded yet.</div>')+'</div></div></div></section>';
  }).join('');
}
function scheduleParentTournamentExpiry(){
  if(parentTournamentExpiryTimer){clearTimeout(parentTournamentExpiryTimer);parentTournamentExpiryTimer=null;}
  if(parentTournamentRefreshTimer){clearTimeout(parentTournamentRefreshTimer);parentTournamentRefreshTimer=null;}
  const now=new Date();
  const next=new Date(now);
  next.setHours(24,0,5,0);
  parentTournamentExpiryTimer=setTimeout(()=>{renderParentPortal();scheduleParentTournamentExpiry();},Math.max(1000,next.getTime()-now.getTime()));
  if(currentUserRole==='parent'&&(PARENT_CONTEXT.tournaments||[]).some(t=>t.status==='active')){
    parentTournamentRefreshTimer=setTimeout(()=>{if(currentUserRole==='parent')loadParentPortal().catch(()=>{});},20000);
  }
}
function renderParentPortal(){
  document.querySelector('.app')?.classList.add('hidden');document.getElementById('parentPortal')?.classList.remove('hidden');
  const account=PARENT_CONTEXT.account||{};const welcome=document.getElementById('parentWelcome');if(welcome)welcome.textContent=`Welcome, ${account.parent_name||'Parent'}.`;
  const selector=document.getElementById('parentChildren'),dashboard=document.getElementById('parentDashboard');if(!selector||!dashboard)return;
  if(!PARENT_CONTEXT.students.length){selector.innerHTML='';dashboard.innerHTML='<div class="parent-card"><div class="empty">No student is linked to this parent account yet. Please contact the teacher.</div></div>';return;}
  if(!PARENT_CONTEXT.students.some(s=>String(s.student_id)===String(PARENT_CONTEXT.selectedStudentId)))PARENT_CONTEXT.selectedStudentId=PARENT_CONTEXT.students[0].student_id;
  selector.innerHTML=`<div class="parent-card"><div class="eyebrow">MY CHILDREN</div><h2>Select a child</h2><div class="parent-child-tabs">${PARENT_CONTEXT.students.map(s=>{const active=String(s.student_id)===String(PARENT_CONTEXT.selectedStudentId);return `<button class="parent-child-tab ${active?'active':''}" onclick="selectParentChild('${esc(s.student_id)}')"><span>${esc(s.student_name)}</span><small>${esc(s.student_id)} · ${esc(s.normal_class_time||'Class time not recorded')}</small></button>`}).join('')}</div></div>`;
  const s=PARENT_CONTEXT.students.find(x=>String(x.student_id)===String(PARENT_CONTEXT.selectedStudentId));if(!s){dashboard.innerHTML='';return;}
  const sid=String(s.student_id);const achievements=(PARENT_CONTEXT.achievements||[]).filter(a=>String(a.student_id)===sid).sort((a,b)=>new Date(b.achievement_date)-new Date(a.achievement_date));const attendance=PARENT_CONTEXT.attendance.filter(a=>String(a['Student ID'])===sid).sort((a,b)=>attendanceDateKey(b.Date).localeCompare(attendanceDateKey(a.Date)));const payments=PARENT_CONTEXT.payments.filter(p=>String(p['Student ID'])===sid).sort((a,b)=>new Date(b['Payment Date'])-new Date(a['Payment Date']));const orders=PARENT_CONTEXT.orders.filter(o=>String(o['Student ID'])===sid&&!['yes','true'].includes(String(o.Archived||'').toLowerCase())).sort((a,b)=>new Date(b['Order Date'])-new Date(a['Order Date']));const state=parentPaymentState(sid);const present=attendance.filter(a=>a.Status==='Present').length;const absent=attendance.filter(a=>a.Status==='Absent').length;const attendanceRate=attendance.length?Math.round(present/attendance.length*100):0;const progressWidth=Math.min(100,Math.round(state.progress/4*100));
  const packageClasses=state.classes.slice(0,4).map((a,i)=>`<div class="parent-package-row"><span class="package-number">${i+1}</span><div><b>${esc(formatDateClient(a.Date))}</b><small>${esc(a['Actual Class Time']||'')}</small></div><span class="badge present">Present</span></div>`).join('')||'<div class="empty">No Present classes in the current package yet.</div>';
  const tournamentPanel=renderParentTournamentPanel(sid);
  const certificates=parentCertificateRecords(sid);
  dashboard.innerHTML=`<div id="parentActionRequired"></div>${tournamentPanel}<div class="parent-hero"><div><div class="eyebrow">MY CHILD</div><h2>${esc(s.student_name)}</h2><p>${esc(sid)} · ${esc(s.normal_class_time||'Class time not recorded')}</p></div><span class="badge blue">${esc(s.school||'School not recorded')}</span></div>${renderParentCertificateDashboardSection(certificates)}<div class="parent-metrics"><div class="parent-metric"><span>CLASSES USED</span><strong>${state.progress} / 4</strong><small>${esc(state.status)}</small></div><div class="parent-metric"><span>ATTENDANCE</span><strong>${attendanceRate}%</strong><small>${present} Present · ${absent} Absent</small></div><div class="parent-metric"><span>CURRENT CYCLE</span><strong>${esc(state.currentCycle)}</strong><small>4-class package</small></div><div class="parent-metric"><span>LAST PAYMENT</span><strong>${state.lastPayment?esc(formatDateClient(state.lastPayment['Payment Date'])):'-'}</strong><small>${state.lastPayment?'Payment recorded':'No payment recorded'}</small></div></div><button class="parent-card parent-click-card" onclick="openParentPanel('package')"><div class="section-head"><div><div class="eyebrow">CURRENT PACKAGE</div><h3>4-class package</h3></div>${parentStatusBadge(state)}</div><div class="parent-progress"><div style="width:${progressWidth}%"></div></div><div class="progress-labels"><span>${state.progress} of 4 classes used</span><span>${Math.max(0,4-state.progress)} remaining</span></div><div class="parent-package-list">${packageClasses}</div></button><div class="parent-two-col"><button class="parent-card parent-click-card" onclick="openParentPanel('attendance')"><div class="section-head"><div><div class="eyebrow">ATTENDANCE</div><h3>Attendance History</h3></div><span class="badge blue">${attendance.length} record${attendance.length===1?'':'s'}</span></div><div class="parent-list">${attendance.slice(0,8).map(a=>`<div class="parent-list-row"><div><b>${esc(formatDateClient(a.Date))}</b><small>${esc(a['Actual Class Time']||'')}</small></div>${a.Status==='Present'?'<span class="badge present">Present</span>':a.Status==='Absent'?'<span class="badge absent">Absent</span>':'<span class="badge neutral">Not marked</span>'}</div>`).join('')||'<div class="empty">No attendance records yet.</div>'}</div><div class="card-arrow">›</div></button><button class="parent-card parent-click-card" onclick="openParentPanel('payments')"><div class="section-head"><div><div class="eyebrow">PAYMENTS</div><h3>Payment History</h3></div><span class="badge blue">${payments.length} record${payments.length===1?'':'s'}</span></div><div class="parent-list">${payments.slice(0,6).map(p=>`<div class="parent-list-row"><div><b>Cycle ${esc(p['Cycle Number'])}</b><small>${esc(formatDateClient(p['Payment Date']))} · ${esc(p['Classes Covered']||'')}</small></div><div><strong>RM${esc(p.Amount||0)}</strong><span class="badge paid">${esc(p.Status||'')}</span></div></div>`).join('')||'<div class="empty">No payment records yet.</div>'}</div><div class="card-arrow">›</div></button></div><button class="parent-card parent-click-card" onclick="openParentPanel('orders')"><div class="section-head"><div><div class="eyebrow">ORDERS</div><h3>My Orders</h3></div><span class="badge blue">${orders.length} order${orders.length===1?'':'s'}</span></div><div class="parent-list">${orders.slice(0,8).map(o=>`<div class="parent-list-row"><div><b>${esc(o.Product||'Order')}</b><small>${o.Product==='T Shirt'?`Size ${esc(o.Size||'-')} · `:''}Qty ${esc(o.Quantity||1)} · ${esc(formatDateClient(o['Order Date']))}</small></div><div class="parent-order-status"><span>${esc(o['Order Status']||'')}</span><small>${esc(orderPaymentDisplay(o).label)} · ${esc(o['Collection Status']||'')}</small></div></div>`).join('')||'<div class="empty">No orders recorded.</div>'}<div class="card-arrow">›</div></div></button>`;
  renderActionRequired(state);
  hydrateParentCertificateCards();
  scheduleParentTournamentExpiry();
}

async function openTeacherParentPreview(studentId){
  const sid=String(studentId||'').trim();
  const teacherStudent=DATA.students.find(
    s=>String(s['Student ID'])===sid
  );

  if(!teacherStudent){
    appNotify('Student not found.');
    return;
  }

  try{
    teacherPreviewPreviousPage=
      document.querySelector('.page.active')?.id||'students';

    let account=null;
    let childIds=[sid];

    const {
      data:link,
      error:linkError
    }=await supabaseClient
      .from('parent_students')
      .select('parent_user_id')
      .eq('student_id',sid)
      .maybeSingle();

    if(linkError)throw dbError(linkError);

    if(link?.parent_user_id){
      const {
        data:parentAccount,
        error:parentError
      }=await supabaseClient
        .from('parent_accounts')
        .select('user_id,parent_name,email,whatsapp,active')
        .eq('user_id',link.parent_user_id)
        .maybeSingle();

      if(parentError)throw dbError(parentError);

      account=parentAccount||null;

      const {
        data:links,
        error:childrenError
      }=await supabaseClient
        .from('parent_students')
        .select('student_id')
        .eq('parent_user_id',link.parent_user_id);

      if(childrenError)throw dbError(childrenError);

      childIds=(links||[])
        .map(x=>String(x.student_id))
        .filter(Boolean);
    }

    const students=DATA.students
      .filter(s=>childIds.includes(String(s['Student ID'])))
      .map(s=>({
        student_id:s['Student ID'],
        student_name:s['Student Name'],
        school:s.School||'',
        age:s.Age||'',
        scrabble_experience:s['Scrabble Experience']||'',
        parent_guardian:s['Parent / Guardian']||'',
        whatsapp:s.WhatsApp||'',
        normal_class_time:s['Normal Class Time']||'',
        email:s.Email||'',
        registration_date:s['Registration Date']||'',
        active:String(s.Active||'Yes').toLowerCase()!=='no'
      }));

    if(!students.length){
      students.push({
        student_id:teacherStudent['Student ID'],
        student_name:teacherStudent['Student Name'],
        school:teacherStudent.School||'',
        age:teacherStudent.Age||'',
        scrabble_experience:teacherStudent['Scrabble Experience']||'',
        parent_guardian:teacherStudent['Parent / Guardian']||'',
        whatsapp:teacherStudent.WhatsApp||'',
        normal_class_time:teacherStudent['Normal Class Time']||'',
        email:teacherStudent.Email||'',
        registration_date:teacherStudent['Registration Date']||'',
        active:String(teacherStudent.Active||'Yes').toLowerCase()!=='no'
      });
    }

    PARENT_CONTEXT={
      account:account||{
        parent_name:teacherStudent['Parent / Guardian']||'Parent',
        email:teacherStudent.Email||'',
        active:true
      },
      students,
      attendance:DATA.attendance.filter(
        a=>childIds.includes(String(a['Student ID']))
      ),
      payments:DATA.payments.filter(
        p=>childIds.includes(String(p['Student ID']))
      ),
      orders:DATA.orders.filter(
        o=>childIds.includes(String(o['Student ID'])) &&
        !['yes','true'].includes(String(o.Archived||'').toLowerCase())
      ),
      achievements:[],
      selectedStudentId:sid
    };

    teacherPreviewMode=true;

    document
      .querySelectorAll('.page')
      .forEach(x=>x.classList.remove('active'));

    renderParentPortal();

    loadAchievementsSafely(childIds).then(records=>{
      if(!teacherPreviewMode)return;
      PARENT_CONTEXT.achievements=records;
      renderParentPortal();
      const banner=document.getElementById('teacherPreviewBanner');
      if(banner)banner.classList.remove('hidden');
    }).catch(()=>{});

    const banner=document.getElementById('teacherPreviewBanner');
    if(banner)banner.classList.remove('hidden');

    const previewText=document.getElementById('teacherPreviewText');
    if(previewText){
      previewText.textContent=
        `Viewing ${teacherStudent['Student Name']} and the children linked to this parent account.`;
    }

    const exit=document.getElementById('parentPortalExitButton');
    if(exit)exit.textContent='Back to Teacher Portal';

  }catch(error){
    appNotify(error?.message||'Unable to open Teacher Preview.');
  }
}

function closeTeacherParentPreview(){
  if(!teacherPreviewMode)return;
  teacherPreviewMode=false;
  closeParentPanel();
  document.getElementById('teacherPreviewBanner')?.classList.add('hidden');
  const exit=document.getElementById('parentPortalExitButton');
  if(exit)exit.textContent='Sign Out';
  hideParentPortal();
  page(teacherPreviewPreviousPage||'students');
}

function hideParentPortal(){document.getElementById('parentPortal')?.classList.add('hidden');document.querySelector('.app')?.classList.remove('hidden');}
