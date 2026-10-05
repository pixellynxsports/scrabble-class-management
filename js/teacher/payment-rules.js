/* SCMS payment business rules */
(function(){
  'use strict';
/* ===== PAYMENT DOMAIN ===== */
let paymentStateCache=new Map();
let paymentStateCachePayments=null;
let paymentStateCacheAttendance=null;
function calculatePaymentState(payments,attendance,sid){
  if(paymentStateCachePayments!==payments||paymentStateCacheAttendance!==attendance){
    paymentStateCache=new Map();
    paymentStateCachePayments=payments;
    paymentStateCacheAttendance=attendance;
  }
  const cacheKey=String(sid);
  const cached=paymentStateCache.get(cacheKey);
  if(cached)return cached;
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

  // A student with no recorded payment has not started a paid package.
  // Do not label a newly approved student as Paid simply because they have
  // zero classes. Payment is required before the first cycle becomes active.
  if(!paid.length){
    const result={
      classes:[],
      progress:0,
      status:'Payment Due',
      coveredIds:covered,
      currentCycle:1,
      paid:[],
      activePrepaid:false,
      lastPayment:null
    };
    paymentStateCache.set(cacheKey,result);
    return result;
  }

  // While the initial prepaid package is active, its first four Present
  // records form the current package.
  if(initialPayment && latestCycle===initialCycle){
    const classes=present.slice(0,4);
    const progress=classes.length;
    const result={
      classes,
      progress,
      status:progress>=4?'Payment Due':progress===3?'Almost Due':'Paid',
      coveredIds:covered,
      currentCycle:initialCycle,
      paid,
      activePrepaid:progress<4,
      lastPayment:latestPayment
    };
    paymentStateCache.set(cacheKey,result);
    return result;
  }

  // For later cycles, Present records not covered by a paid payment belong
  // to the current package. A completed package therefore reaches 4 / 4 and
  // shows Payment Due until the next payment covers those four records.
  const currentClasses=present.filter(a=>!covered.has(String(a['Attendance ID']||'')));
  const classes=currentClasses.slice(0,4);
  const progress=classes.length;
  const status=progress>=4?'Payment Due':progress===3?'Almost Due':'Paid';

  const result={
    classes,
    progress,
    status,
    coveredIds:covered,
    currentCycle:latestCycle,
    paid,
    activePrepaid:false,
    lastPayment:latestPayment
  };
  paymentStateCache.set(cacheKey,result);
  return result;
}

  window.SCMSPaymentRules={calculatePaymentState:calculatePaymentState};
})();
