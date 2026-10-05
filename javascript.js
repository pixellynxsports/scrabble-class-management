/* Scrabble Class Management, Supabase online version */
let DATA={students:[],attendance:[],payments:[],orders:[],achievements:[],config:{fee:50,classesPerCycle:4,classTimes:['10:30 AM','2:00 PM']}};
let orderTab='Scrabble Set';let currentProfileId='';let studentView='active';let selectedOrderIds=new Set();let studentSortKey='studentName';let studentSortDirection='asc';
const supabaseClient=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY);\nwindow.__scSupabaseClient=supabaseClient;
let authReady=false;
let loginMode='teacher';
let currentUserRole='teacher';SCMSStateSync.auth(authReady,currentUserRole);
let PARENT_CONTEXT={account:null,students:[],achievements:[],tournaments:[]};
let teacherPreviewMode=false;
let teacherPreviewPreviousPage='students';
let parentEntryNoticeShown=false;
let parentNoticeTimer=null;
let parentTournamentExpiryTimer=null;
let parentTournamentRefreshTimer=null;
let passwordChangeInProgress=false;
let authInitialised=false;
const parentPaymentReturn=new URLSearchParams(window.location.search).get('payment_return')==='1';
let parentPaymentProcessing=false;
let parentPaymentReturnHandled=false;
async function loadAchievementsSafely(studentIds=null){
  try{
    let query=supabaseClient.from('student_achievements').select('*').order('achievement_date',{ascending:false});
    if(Array.isArray(studentIds)&&studentIds.length)query=query.in('student_id',studentIds);
    const {data,error}=await query;
    if(error){
      console.warn('Achievements are temporarily unavailable:',error);
      return [];
    }
    return data||[];
  }catch(error){
    console.warn('Achievements are temporarily unavailable:',error);
    return [];
  }
}
async function loadRemoteData(){
  return SCMSDataService.loadTeacherData();
}
async function refreshOnline(silent=false){if(currentUserRole==='parent'){await loadParentPortal();return;}try{DATA=await loadRemoteData();SCMSStateSync.teacherData(DATA);document.getElementById('connection').textContent='● Online';document.getElementById('connection').classList.remove('off');renderAll();if(!silent)appNotify('Online data refreshed.')}catch(e){document.getElementById('connection').textContent='● Connection error';document.getElementById('connection').classList.add('off');if(!silent)appNotify(e.message||e);throw e}}
async function getCurrentParentAccount(){return SCMSDataService.getCurrentParentAccount();}
async function loadParentPortal(){
  const account=await getCurrentParentAccount();
  if(!account)throw new Error('This account is not registered as a parent account.');
  if(account.active===false)throw new Error('This parent account is inactive. Please contact the teacher.');
  const {data:links,error:linkError}=await supabaseClient.from('parent_students').select('student_id').eq('parent_user_id',account.user_id);
  if(linkError)throw dbError(linkError);
  const ids=(links||[]).map(x=>x.student_id).filter(Boolean);
  let students=[],attendance=[],payments=[],orders=[],tournaments=[];
  if(ids.length){
    const [s,a,p,o,t]=await Promise.all([
      supabaseClient.from('students').select('student_id,student_name,school,age,scrabble_experience,parent_guardian,whatsapp,normal_class_time,email,registration_date,active').in('student_id',ids).order('student_name'),
      supabaseClient.from('attendance').select('*').in('student_id',ids).order('attendance_date',{ascending:false}),
      supabaseClient.from('payments').select('*').in('student_id',ids).order('payment_date',{ascending:false}),
      supabaseClient.from('orders').select('*').in('student_id',ids).eq('archived',false).order('order_date',{ascending:false}),
      supabaseClient.from('tournaments').select('*').order('event_date',{ascending:false}).order('created_at',{ascending:false})
    ]);
    for(const result of [s,a,p,o,t]){if(result.error)throw dbError(result.error);}
    students=s.data||[];
    attendance=(a.data||[]).map(attendanceFromDb);
    payments=(p.data||[]).map(paymentFromDb);
    orders=(o.data||[]).map(orderFromDb);
    const visibleTournamentIds=(t.data||[]).map(x=>x.tournament_id).filter(Boolean);
    if(visibleTournamentIds.length){
      const {data:players,error:playerError}=await supabaseClient.from('tournament_players').select('*').in('tournament_id',visibleTournamentIds).in('student_id',ids);
      if(playerError)throw dbError(playerError);
      const playerTournamentIds=[...(players||[])].map(x=>x.tournament_id).filter(Boolean);
      if(playerTournamentIds.length){
        const [r,m,w]=await Promise.all([
          supabaseClient.from('tournament_rounds').select('*').in('tournament_id',playerTournamentIds).order('round_number'),
          supabaseClient.from('tournament_matches').select('*').in('tournament_id',playerTournamentIds).order('round_number').order('match_number'),
          supabaseClient.from('tournament_awards').select('*').in('tournament_id',playerTournamentIds).order('rank')
        ]);
        for(const result of [r,m,w]){if(result.error)throw dbError(result.error);}
        const byId={};
        (t.data||[]).filter(x=>playerTournamentIds.includes(x.tournament_id)).forEach(x=>byId[x.tournament_id]={...x,players:[],rounds:[],matches:[],awards:[]});
        (players||[]).forEach(x=>byId[x.tournament_id]?.players.push(x));
        (r.data||[]).forEach(x=>byId[x.tournament_id]?.rounds.push(x));
        (m.data||[]).forEach(x=>byId[x.tournament_id]?.matches.push(x));
        (w.data||[]).forEach(x=>byId[x.tournament_id]?.awards.push(x));
        tournaments=Object.values(byId);
      }
    }
  }
  PARENT_CONTEXT={account,students,attendance,payments,orders,achievements:[],tournaments,selectedStudentId:ids[0]||''};
  renderParentPortal();
  setConnection('● Online',false);
  if(ids.length){
    loadAchievementsSafely(ids).then(records=>{PARENT_CONTEXT.achievements=records;renderParentPortal();}).catch(()=>{});
  }
  if(parentPaymentReturn&&!parentPaymentReturnHandled&&!parentPaymentProcessing){parentPaymentReturnHandled=true;checkReturnedPayment();}
}
const calculatePaymentState=window.SCMSPaymentRules.calculatePaymentState;
async function run(fn,...args){
  if(!authReady)throw new Error('Please sign in first.');
  switch(fn){
    case 'getData': return loadRemoteData();
    case 'saveAttendance': {const r=args[0];const sid=String(r.studentId||'').trim();const date=String(r.date||'').slice(0,10);const status=String(r.status||'').trim();if(!sid||!date)throw new Error('Student and attendance date are required.');if(!['Present','Absent'].includes(status))throw new Error('Status must be Present or Absent.');const student=DATA.students.find(s=>String(s['Student ID'])===sid);if(!student)throw new Error('Student not found.');if(String(student.Active||'Yes').toLowerCase()==='no')throw new Error('Archived students cannot receive new attendance records.');const actual=status==='Present'?String(r.classTime||'').trim():'';if(status==='Present'&&!DATA.config.classTimes.includes(actual))throw new Error('Invalid class time.');const payload={student_id:sid,attendance_date:date,actual_class_time:actual,status,notes:String(r.notes||'')};if(r.attendanceId){const {error}=await supabaseClient.from('attendance').update(payload).eq('attendance_id',String(r.attendanceId));if(error)throw dbError(error)}else{payload.attendance_id=nextLocalId('ATT',DATA.attendance,'Attendance ID');const {error}=await supabaseClient.from('attendance').upsert(payload,{onConflict:'student_id,attendance_date'});if(error)throw dbError(error)}return {ok:true,action:'saved'};}
    case 'resetAttendance': {const {error}=await supabaseClient.from('attendance').delete().eq('student_id',String(args[0])).eq('attendance_date',String(args[1]).slice(0,10));if(error)throw dbError(error);return loadRemoteData();}
    case 'markPaymentReceived': {
 const sid=String(args[0]);const amount=Number(args[1]||50);
 if(amount!==50)throw new Error('Payment amount must be RM50.');
 const state=paymentStateFor(sid);
 const firstPayment=isNewUnpaidStudent(state);
 if(!firstPayment&&(state.progress!==4||state.status!=='Payment Due'))throw new Error('This student has not reached 4 attended classes yet.');
 const ids=firstPayment?[]:state.classes.map(a=>String(a['Attendance ID']));
 const cycle=Math.max(0,...DATA.payments.filter(p=>String(p['Student ID'])===sid&&String(p.Status||'').toLowerCase()==='paid').map(p=>Number(p['Cycle Number'])||0))+1;
 const paymentId=nextLocalId('PAY',DATA.payments,'Payment ID');
 const payload={payment_id:paymentId,student_id:sid,cycle_number:cycle,amount:50,payment_date:String(args[2]||isoDate(new Date())).slice(0,10),classes_covered:firstPayment?'':state.classes.map(a=>formatDateClient(a.Date)).join(', '),status:'Paid',notes:firstPayment?'First month fee / registration payment':'',attendance_ids_covered:ids.join(','),payment_type:firstPayment?'First Month Fee':'Regular 4-Class Package',prepaid:'No'};
 const {error}=await supabaseClient.from('payments').insert(payload);if(error)throw dbError(error);return loadRemoteData();
}
    case 'voidPayment': {const id=String(args[0]);const p=DATA.payments.find(x=>String(x['Payment ID'])===id);if(!p)throw new Error('Payment not found.');if(String(p.Status||'').toLowerCase()!=='paid')throw new Error('Only a Paid payment can be voided.');const notes=(p.Notes?String(p.Notes)+' | ':'')+'Voided on '+new Date().toLocaleString();const {error}=await supabaseClient.from('payments').update({status:'Void',notes}).eq('payment_id',id);if(error)throw dbError(error);return loadRemoteData();}
    case 'saveOrder': {const r=args[0];const product=String(r.product||'').trim();if(!['Scrabble Set','T Shirt'].includes(product))throw new Error('Choose Scrabble Set or T Shirt.');let sid=String(r.studentId||'').trim(),customer=String(r.customerName||'').trim(),phone=String(r.phone||'').trim();if(sid){const st=DATA.students.find(x=>String(x['Student ID'])===sid);if(!st)throw new Error('Selected student was not found.');if(!customer)customer=String(st['Student Name']||'');if(!phone)phone=String(st.WhatsApp||'')}if(!customer)throw new Error('Customer name is required.');const quantity=Math.max(1,Math.floor(Number(r.quantity)||1)),unitPrice=Math.max(0,Number(r.unitPrice)||0);if(product==='T Shirt'&&!String(r.size||'').trim())throw new Error('T Shirt size is required.');const orderStatus=String(r.orderStatus||'Pending Order'),paymentStatus=String(r.paymentStatus||'Unpaid'),collectionStatus=String(r.collectionStatus||'Not Collected');if(!['Pending Order','Pending Payment','Processing','Order Done'].includes(orderStatus))throw new Error('Invalid Order Status.');if(!['Unpaid','Paid'].includes(paymentStatus))throw new Error('Invalid Payment Status.');if(!['Not Collected','Collected'].includes(collectionStatus))throw new Error('Invalid Collection Status.');const payload={student_id:sid||null,customer_name:customer,phone,product,size:product==='T Shirt'?String(r.size||'').trim():'',quantity,unit_price:unitPrice,total:quantity*unitPrice,interest:'Yes',order_status:orderStatus,payment_status:paymentStatus,collection_status:collectionStatus,order_date:String(r.orderDate||isoDate(new Date())).slice(0,10),notes:String(r.notes||'')};if(r.orderId){const {error}=await supabaseClient.from('orders').update(payload).eq('order_id',String(r.orderId));if(error)throw dbError(error)}else{payload.order_id=nextLocalId('ORD',DATA.orders,'Order ID');payload.source='Manual';payload.archived=false;payload.form_source_hash='MANUAL';const {error}=await supabaseClient.from('orders').insert(payload);if(error)throw dbError(error)}return loadRemoteData();}
    case 'updateOrderStatus': {const id=String(args[0]),field=String(args[1]),value=String(args[2]);const map={'Order Status':'order_status','Payment Status':'payment_status','Collection Status':'collection_status'};const allowed={'Order Status':['Pending Order','Pending Payment','Processing','Order Done'],'Payment Status':['Unpaid','Paid'],'Collection Status':['Not Collected','Collected']};if(!map[field]||!allowed[field]?.includes(value))throw new Error('Invalid order status.');if(field==='Payment Status'){const current=orderRecord(id);if(current&&['Submitted','Verified'].includes(String(current['Payment Proof Status']||'')))throw new Error('Payment status is controlled by the payment proof actions.');}const {error}=await supabaseClient.from('orders').update({[map[field]]:value}).eq('order_id',id);if(error)throw dbError(error);return loadRemoteData();}
    case 'verifyOrderPaymentProof': {const id=String(args[0]);const note=String(args[1]||'').trim();const {data:current,error:readError}=await supabaseClient.from('orders').select('payment_proof_status,payment_status,order_status').eq('order_id',id).maybeSingle();if(readError)throw dbError(readError);if(!current)throw new Error('Order not found.');if(String(current.payment_proof_status||'')!=='Submitted')throw new Error('Only a submitted payment proof can be confirmed.');const {data:userData}=await supabaseClient.auth.getUser();const {error}=await supabaseClient.from('orders').update({payment_proof_status:'Verified',payment_status:'Paid',order_status:'Processing',payment_verified_at:new Date().toISOString(),payment_verified_by:userData.user?.id||null,payment_verification_notes:note}).eq('order_id',id);if(error)throw dbError(error);return loadRemoteData();}
    case 'rejectOrderPaymentProof': {const id=String(args[0]);const note=String(args[1]||'').trim();if(!note)throw new Error('Please enter a reason for rejecting the receipt.');const {data:current,error:readError}=await supabaseClient.from('orders').select('payment_proof_status').eq('order_id',id).maybeSingle();if(readError)throw dbError(readError);if(!current)throw new Error('Order not found.');if(String(current.payment_proof_status||'')!=='Submitted')throw new Error('Only a submitted payment proof can be rejected.');const {error}=await supabaseClient.from('orders').update({payment_proof_status:'Rejected',payment_status:'Unpaid',order_status:'Pending Payment',payment_verified_at:null,payment_verified_by:null,payment_verification_notes:note}).eq('order_id',id);if(error)throw dbError(error);return loadRemoteData();}
    case 'openOrderReceipt': {const id=String(args[0]);const {data,error}=await supabaseClient.functions.invoke('get-order-payment-receipt',{body:{order_id:id}});if(error)throw new Error(error.message||'Unable to open receipt.');if(!data?.url)throw new Error(data?.error||'Receipt is unavailable.');window.open(data.url,'_blank','noopener');return data;}
    case 'archiveOrder': case 'restoreOrder': {const id=String(args[0]);const {error}=await supabaseClient.from('orders').update({archived:fn==='archiveOrder'}).eq('order_id',id);if(error)throw dbError(error);return loadRemoteData();}
    case 'bulkArchiveOrders': case 'bulkRestoreOrders': {const ids=(Array.isArray(args[0])?args[0]:[]).map(String).filter(Boolean);if(!ids.length)return loadRemoteData();const {error}=await supabaseClient.from('orders').update({archived:fn==='bulkArchiveOrders'}).in('order_id',ids);if(error)throw dbError(error);return loadRemoteData();}
    case 'archiveStudent': case 'restoreStudent': {const id=String(args[0]);const {error}=await supabaseClient.from('students').update({active:fn==='restoreStudent'}).eq('student_id',id);if(error)throw dbError(error);return loadRemoteData();}
    case 'getStudentDetail': {const sid=String(args[0]);const d=await loadRemoteData();const student=d.students.find(s=>String(s['Student ID'])===sid);if(!student)throw new Error('Student not found.');const achievements=await loadAchievementsSafely([sid]);return {student,attendance:d.attendance.filter(a=>String(a['Student ID'])===sid),payments:d.payments.filter(p=>String(p['Student ID'])===sid),orders:d.orders.filter(o=>String(o['Student ID'])===sid),achievements,paymentStatus:paymentStateFor(sid)};}
    case 'saveAchievement': {const r=args[0]||{};const sid=String(r.studentId||'').trim();const title=String(r.title||'').trim();if(!sid||!title)throw new Error('Student and achievement title are required.');const student=DATA.students.find(s=>String(s['Student ID'])===sid);if(!student)throw new Error('Student not found.');const user=(await supabaseClient.auth.getUser()).data.user;const payload={student_id:sid,title,category:String(r.category||'Achievement').trim()||'Achievement',achievement_date:String(r.achievementDate||isoDate(new Date())).slice(0,10),description:String(r.description||'').trim(),created_by:user?.id||null};let uploadedPath='';const file=r.file;if(file){if(file.size>10*1024*1024)throw new Error('Attachment must be 10 MB or smaller.');const allowed=['application/pdf','image/jpeg','image/png','image/webp','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];if(file.type&&!allowed.includes(file.type))throw new Error('Use PDF, JPG, PNG, WEBP or DOCX for the attachment.');const cleanName=String(file.name||'attachment').replace(/[^a-zA-Z0-9._-]+/g,'_').slice(-120);uploadedPath=sid+'/'+crypto.randomUUID()+'-'+cleanName;const {error:uploadError}=await supabaseClient.storage.from('student-achievements').upload(uploadedPath,file,{contentType:file.type||'application/octet-stream',upsert:false});if(uploadError)throw dbError(uploadError);payload.file_path=uploadedPath;payload.file_name=file.name||cleanName;payload.file_type=file.type||'';payload.file_size=file.size||0;}const {error}=await supabaseClient.from('student_achievements').insert(payload);if(error){if(uploadedPath)await supabaseClient.storage.from('student-achievements').remove([uploadedPath]);throw dbError(error);}return loadRemoteData();}
    case 'deleteAchievement': {const id=String(args[0]||'');const {data:record,error:readError}=await supabaseClient.from('student_achievements').select('achievement_id,student_id,file_path').eq('achievement_id',id).maybeSingle();if(readError)throw dbError(readError);if(!record)throw new Error('Achievement record not found.');if(record.file_path){const {error:fileError}=await supabaseClient.storage.from('student-achievements').remove([record.file_path]);if(fileError)throw dbError(fileError);}const {error}=await supabaseClient.from('student_achievements').delete().eq('achievement_id',id);if(error)throw dbError(error);return loadRemoteData();}
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
async function signIn(){const email=document.getElementById('loginEmail').value.trim(),password=document.getElementById('loginPassword').value;const button=document.getElementById('loginButton');const msg=document.getElementById('loginMessage');if(!email||!password){msg.textContent='Enter your email and password.';return}button.disabled=true;msg.textContent='Signing in...';try{const {error}=await supabaseClient.auth.signInWithPassword({email,password});if(error)throw dbError(error);const user=(await supabaseClient.auth.getUser()).data.user;const {data:parentAccount,error:parentError}=await supabaseClient.from('parent_accounts').select('user_id,parent_name,active,must_change_password').eq('user_id',user.id).maybeSingle();if(parentError)throw dbError(parentError);const isParent=!!parentAccount;if(loginMode==='parent'){if(!isParent){await supabaseClient.auth.signOut();throw new Error('This account is not registered as a parent account. Please use Teacher Login.')}if(parentAccount.active===false){await supabaseClient.auth.signOut();throw new Error('This parent account is inactive. Please contact the teacher.')}}else{if(isParent){await supabaseClient.auth.signOut();throw new Error('This is a Parent account. Please use Parent Login.')}}msg.textContent='';}catch(e){msg.textContent=e.message||'Sign in failed.'}finally{button.disabled=false}}
function showPasswordChangeScreen(message=''){document.getElementById('passwordChangeScreen')?.classList.remove('hidden');document.getElementById('parentPortal')?.classList.add('hidden');document.querySelector('.app')?.classList.add('hidden');const msg=document.getElementById('passwordChangeMessage');if(msg)msg.textContent=message;const a=document.getElementById('newPassword');const b=document.getElementById('confirmNewPassword');if(a)a.focus();}
function hidePasswordChangeScreen(){document.getElementById('passwordChangeScreen')?.classList.add('hidden');}
function validateParentPassword(value){return value.length>=8&&/[A-Z]/.test(value)&&/[a-z]/.test(value)&&/[0-9]/.test(value);}
async function changeParentPassword(){if(passwordChangeInProgress)return;const newPassword=document.getElementById('newPassword')?.value||'',confirmPassword=document.getElementById('confirmNewPassword')?.value||'',button=document.getElementById('changePasswordButton'),msg=document.getElementById('passwordChangeMessage');if(!validateParentPassword(newPassword)){msg.textContent='Use at least 8 characters with uppercase, lowercase and a number.';return}if(newPassword!==confirmPassword){msg.textContent='The passwords do not match.';return}passwordChangeInProgress=true;if(button)button.disabled=true;msg.textContent='Updating password...';try{const {data,error}=await supabaseClient.auth.updateUser({password:newPassword,user_metadata:{must_change_password:false}});if(error)throw dbError(error);const uid=data.user?.id;if(!uid)throw new Error('Your session has expired. Please sign in again.');const {error:dbUpdateError}=await supabaseClient.rpc('complete_parent_first_login');if(dbUpdateError)throw dbError(dbUpdateError);msg.textContent='Password updated successfully.';document.getElementById('newPassword').value='';document.getElementById('confirmNewPassword').value='';await new Promise(resolve=>setTimeout(resolve,700));hidePasswordChangeScreen();await loadParentPortal();hideBoot();}catch(e){msg.textContent=e.message||'Unable to update your password.';}finally{passwordChangeInProgress=false;if(button)button.disabled=false;}}
async function signOut(){if(teacherPreviewMode){closeTeacherParentPreview();return;}await supabaseClient.auth.signOut();authReady=false;currentUserRole='teacher';PARENT_CONTEXT={account:null,students:[],achievements:[],tournaments:[]};hidePasswordChangeScreen();hideParentPortal();showLogin('You have signed out.');}
async function enterSession(session){
  showBoot();

  if(!session){
    authReady=false;
    currentUserRole='teacher';
    PARENT_CONTEXT={account:null,students:[],tournaments:[]};
    hideParentPortal();
    hidePasswordChangeScreen();
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
        PARENT_CONTEXT={account:null,students:[],tournaments:[]};
        hideParentPortal();
        hidePasswordChangeScreen();
        hideBoot();
        showLogin('This parent account is inactive. Please contact the teacher.');
        return;
      }

      currentUserRole='parent';
      parentEntryNoticeShown=true;
      if(account.must_change_password===true){
        hideLogin();
        hideParentPortal();
        showPasswordChangeScreen();
        hideBoot();
        return;
      }
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
    PARENT_CONTEXT={account:null,students:[],tournaments:[]};
    hideParentPortal();
    hidePasswordChangeScreen();
    try{await supabaseClient.auth.signOut();}catch(_){}
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
  window.__scAuthStartupDone=true;
}


/* ===== NAVIGATION & PAGE RENDERING ===== */
function page(name){document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));const target=document.getElementById(name);if(!target)return;target.classList.add('active');document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active'));const navName=name==='studentProfile'?'students':name;[...document.querySelectorAll('.nav')].find(x=>x.querySelector('.nav-icon + span')?.textContent.trim().toLowerCase()===navName)?.classList.add('active');document.getElementById('title').textContent=name==='studentProfile'?'Student Profile':name==='orderDashboard'?'Order Dashboard':name[0].toUpperCase()+name.slice(1);if(name==='attendance')renderAttendance();if(name==='students')renderStudents();if(name==='payments')renderPayments();if(name==='orders')renderOrders();if(name==='reports')renderReports()}
function renderAll(){document.querySelector('.app')?.classList.remove('hidden');document.getElementById('today').textContent=formatDateClient(isoDate(latestSunday()));document.getElementById('rStudents').textContent=DATA.students.length;renderHome();const active=document.querySelector('.page.active')?.id||'overview';if(active==='attendance')renderAttendance();else if(active==='students')renderStudents();else if(active==='payments')renderPayments();else if(active==='orders')renderOrders();else if(active==='reports')renderReports();else if(active==='studentProfile'&&currentProfileId)renderProfile(currentProfileId)}
function paymentStateFor(sid){return calculatePaymentState(DATA.payments,DATA.attendance,sid);}

function cycleFor(sid){return paymentStateFor(sid).progress}
function statusFor(c){return c>=4?'Payment Due':c===3?'Almost Due':'In Cycle'}
function isNewUnpaidStudent(state){return !!state&&!state.paid?.length&&Number(state.progress||0)===0}
function badge(c,state){const s=state?.status||statusFor(c);if(isNewUnpaidStudent(state))return '<span class="badge new-student">New Student · Payment Due</span>';const cls=s==='Payment Due'?'absent':s==='Almost Due'?'almost':'present';return `<span class="badge ${cls}">${s}</span>`}
function activeStudents(){return DATA.students.filter(s=>String(s.Active||'yes').toLowerCase()!=='no')}
function selectedAttendanceDate(){const value=document.getElementById('attDate')?.value;return value&&value>=CLASS_START_DATE?value:isoDate(latestSunday())}
const attendanceDateKey=window.SCMSAttendanceRules.attendanceDateKey;
const registrationDateKey=window.SCMSAttendanceRules.registrationDateKey;
function attendanceForDate(date){return DATA.attendance.filter(a=>attendanceDateKey(a.Date)===date)}
function studentButton(studentId,name,extraClass=''){const student=DATA.students.find(s=>String(s['Student ID'])===String(studentId));const attendance=attendanceForDate(selectedAttendanceDate()).find(a=>String(a['Student ID'])===String(studentId)&&a.Status==='Present');const visualClass=extraClass==='normal-attendance'&&student&&attendance&&student['Normal Class Time']!==attendance['Actual Class Time']?'other-attendance':extraClass;return `<div class="att-row ${visualClass}"><button class="linkbtn" onclick="openStudent('${esc(studentId)}')">${esc(name)}</button></div>`}
function formatDateClient(v){if(!v)return '';const d=new Date(v);return isNaN(d)?String(v):d.toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'})}
function filterReportStudents(){
  const query=String(document.getElementById('reportStudentSearch')?.value||'').trim().toLowerCase();
  const filter=document.getElementById('reportPerformanceFilter')?.value||'all';
  document.querySelectorAll('#reportStudents .report-student-row').forEach(row=>{
    const matchesText=!query||row.dataset.studentName.includes(query)||row.dataset.studentId.includes(query);
    const rate=Number(row.dataset.attendance||0);
    const status=row.dataset.paymentStatus||'';
    const matchesFilter=filter==='all'||(filter==='attendance'&&rate>=75)||(filter==='low'&&rate<75)||(filter==='due'&&status==='Payment Due');
    row.style.display=matchesText&&matchesFilter?'':'none';
  });
}

function exportReportCsv(){
  const period=getReportPeriod();
  const {start,end}=period;
  const active=activeStudents();
  const inRange=value=>{const v=String(value||'').slice(0,10);return v>=start&&v<=end;};
  const attendance=DATA.attendance.filter(a=>inRange(a.Date));
  const orders=DATA.orders.filter(o=>inRange(o['Order Date'])&&String(o.Archived||'').toLowerCase()!=='yes');
  const rows=active.map(s=>{
    const sid=String(s['Student ID']);
    const sa=attendance.filter(a=>String(a['Student ID'])===sid);
    const state=paymentStateFor(sid);
    const so=orders.filter(o=>String(o['Student ID'])===sid);
    return [s['Student Name'],sid,s['Normal Class Time']||'',sa.filter(a=>a.Status==='Present').length,sa.filter(a=>a.Status==='Absent').length,state.currentCycle,state.progress+'/4',so.length];
  });
  const csv=[['Student','ID','Normal Time','Present','Absent','Cycle','Package','Orders'],...rows].map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`scrabble-report-${start}-to-${end}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
function printReport(){window.print();}

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
  if(!String(record.studentName).trim())return appNotify('Student name is required.');
  if(!record.normalClassTime)return appNotify('Choose the normal class time.');
  try{DATA=await run('saveStudent',record);closeModal();page('students');renderAll();appNotify('Student added successfully. Student ID: '+nextAddedStudentId(record));}catch(e){appNotify(e.message||e)}
}
function nextAddedStudentId(record){const matches=DATA.students.filter(s=>String(s['Student Name']).trim()===String(record.studentName).trim());return matches.length?matches[matches.length-1]['Student ID']:''}

function editStudent(id){
  const s=DATA.students.find(x=>String(x['Student ID'])===String(id));
  if(!s)return appNotify('Student not found.');
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
  if(!String(record.studentName).trim())return appNotify('Student name is required.');
  if(!record.normalClassTime)return appNotify('Choose the normal class time.');
  try{DATA=await run('updateStudent',record);closeModal();renderAll();if(document.getElementById('studentProfile')?.classList.contains('active'))openStudent(id);appNotify('Student information updated successfully.');}catch(e){appNotify(e.message||e)}
}
