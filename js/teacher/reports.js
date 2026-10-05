/* SCMS Teacher REPORTS module */
/* ===== REPORTS ===== */
function getReportPeriod(){
  const mode=document.getElementById('reportRange')?.value||'month';
  const month=document.getElementById('reportMonth')?.value||`2026-${String(new Date().getMonth()+1).padStart(2,'0')}`;
  const [y,m]=month.split('-').map(Number);
  let start=`${y}-${String(m).padStart(2,'0')}-01`;
  let end=`${y}-${String(m).padStart(2,'0')}-31`;
  if(mode==='lastMonth'){
    const d=new Date(y,m-2,1); const ey=d.getFullYear(),em=d.getMonth()+1;
    start=`${ey}-${String(em).padStart(2,'0')}-01`;
    end=new Date(ey,em,0).toISOString().slice(0,10);
  }else if(mode==='quarter'){
    const qm=Math.floor((m-1)/3)*3+1;
    start=`${y}-${String(qm).padStart(2,'0')}-01`;
    end=new Date(y,qm+2,0).toISOString().slice(0,10);
  }else if(mode==='year'){
    start=`${y}-01-01`; end=`${y}-12-31`;
  }else if(mode==='custom'){
    start=document.getElementById('reportStartDate')?.value||start;
    end=document.getElementById('reportEndDate')?.value||end;
  }else{
    end=new Date(y,m,0).toISOString().slice(0,10);
  }
  if(start>end)[start,end]=[end,start];
  return {mode,month,start,end,label:mode==='custom'?`${start} to ${end}`:mode==='year'?String(y):mode==='quarter'?`Q${Math.floor((m-1)/3)+1} ${y}`:mode==='lastMonth'?new Date(y,m-2,1).toLocaleDateString('en-MY',{month:'long',year:'numeric'}):new Date(y,m-1,1).toLocaleDateString('en-MY',{month:'long',year:'numeric'})};
}
function setReportRange(){
  const mode=document.getElementById('reportRange')?.value||'month';
  document.getElementById('reportCustomRange')?.classList.toggle('hidden',mode!=='custom');
  renderReports();
}
function renderReports(){
  const period=getReportPeriod();
  const {month,start,end}=period;
  document.getElementById('reportMonth').value=month;
  const inRange=value=>{const v=String(value||'').slice(0,10);return v>=start&&v<=end;};
  const active=activeStudents();
  const attendance=DATA.attendance.filter(a=>inRange(a.Date));
  const present=attendance.filter(a=>a.Status==='Present');
  const absent=attendance.filter(a=>a.Status==='Absent');
  const marked=present.length+absent.length;
  const attendanceRate=marked?Math.round(present.length/marked*100):0;
  const payments=DATA.payments.filter(p=>inRange(p['Payment Date']));
  const paidPayments=payments.filter(p=>String(p.Status||'').toLowerCase()==='paid');
  const orders=DATA.orders.filter(o=>inRange(o['Order Date'])&&String(o.Archived||'').toLowerCase()!=='yes');
  const paidAmount=paidPayments.reduce((sum,p)=>sum+(Number(p.Amount)||0),0);
  const orderRevenue=orders.reduce((sum,o)=>sum+(Number(o.Total)||0),0);
  const states=active.map(s=>({s,state:paymentStateFor(s['Student ID'])}));
  const due=states.filter(x=>x.state.status==='Payment Due');
  const almost=states.filter(x=>x.state.status==='Almost Due');
  const lowAttendance=active.filter(s=>{
    const sa=attendance.filter(a=>String(a['Student ID'])===String(s['Student ID']));
    const m=sa.filter(a=>['Present','Absent'].includes(a.Status));
    return m.length>=2&&sa.filter(a=>a.Status==='Present').length/m.length<.75;
  });
  const pendingOrders=orders.filter(o=>['Pending Order','Pending Payment','Processing'].includes(o['Order Status'])).length;
  document.getElementById('rStudents').textContent=active.length;
  document.getElementById('rAttendanceRate').textContent=attendanceRate+'%';
  document.getElementById('rAttendanceDetail').textContent=present.length+' present of '+marked+' marked';
  document.getElementById('rPaymentRevenue').textContent='RM'+paidAmount.toFixed(2);
  document.getElementById('rPayments').textContent=paidPayments.length+' paid payments';
  document.getElementById('rOrderRevenue').textContent='RM'+orderRevenue.toFixed(2);
  document.getElementById('rOrderCount').textContent=orders.length+' active orders';
  document.getElementById('rMonthBadge').textContent=period.label;
  document.getElementById('rPaymentBadge').textContent=due.length+' due';
  document.getElementById('rOrderBadge').textContent=orders.length;
  document.getElementById('rStudentBadge').textContent=active.length;
  const attention=[
    {count:due.length,label:'Payment due',action:"page('payments')",cls:'danger'},
    {count:almost.length,label:'Almost due',action:"page('payments')",cls:'warning'},
    {count:lowAttendance.length,label:'Low attendance',action:"page('attendance')",cls:'warning'},
    {count:pendingOrders,label:'Pending orders',action:"page('orders')",cls:'info'}
  ].filter(x=>x.count>0);
  document.getElementById('rAttentionCount').textContent=attention.reduce((n,x)=>n+x.count,0);
  document.getElementById('rNeedsAttention').innerHTML=attention.length?attention.map(x=>`<button class="attention-card ${x.cls}" onclick="${x.action}"><strong>${x.count}</strong><span>${esc(x.label)}</span><b>View →</b></button>`).join(''):'<div class="attention-clear"><strong>✓</strong><span>Nothing needs attention right now.</span></div>';
  document.getElementById('attendanceSummary').innerHTML=`<div class="report-stat-row"><span>Present</span><strong>${present.length}</strong></div><div class="report-stat-row"><span>Absent</span><strong>${absent.length}</strong></div><div class="report-stat-row"><span>Marked</span><strong>${marked}</strong></div><div class="report-progress"><div style="width:${attendanceRate}%"></div></div><div class="subtle">${attendanceRate}% attendance rate for marked records.</div>`;
  const paymentDueValue=due.length*50;
  document.getElementById('paymentSummary').innerHTML=`<div class="report-stat-row"><span>Paid packages</span><strong>${paidPayments.length}</strong></div><div class="report-stat-row"><span>Collected</span><strong>RM${paidAmount.toFixed(2)}</strong></div><div class="report-stat-row"><span>Payment due</span><strong>${due.length}</strong></div><div class="report-stat-row"><span>Potential due value</span><strong>RM${paymentDueValue.toFixed(2)}</strong></div><div class="report-stat-row"><span>Almost due</span><strong>${almost.length}</strong></div>`;
  const buckets=[0,0,0,0,0];
  states.forEach(x=>buckets[Math.min(4,Math.max(0,Number(x.state.progress)||0))]++);
  document.getElementById('packageSummary').innerHTML=buckets.map((n,i)=>`<div class="package-bar"><div class="package-label"><span>${i} / 4 classes</span><strong>${n}</strong></div><div class="package-track"><div style="width:${active.length?Math.round(n/active.length*100):0}%"></div></div></div>`).join('');
  const statusCount=status=>orders.filter(o=>o['Order Status']===status).length;
  const orderSets=orders.filter(o=>o.Product==='Scrabble Set').reduce((n,o)=>n+(Number(o.Quantity)||1),0);
  const orderShirts=orders.filter(o=>o.Product==='T Shirt').reduce((n,o)=>n+(Number(o.Quantity)||1),0);
  document.getElementById('orderSummary').innerHTML=`<div class="report-stat-row"><span>Scrabble Sets</span><strong>${orderSets}</strong></div><div class="report-stat-row"><span>T Shirts</span><strong>${orderShirts}</strong></div><div class="report-stat-row"><span>Pending / Processing</span><strong>${pendingOrders}</strong></div><div class="report-stat-row"><span>Order Done</span><strong>${statusCount('Order Done')}</strong></div><div class="report-stat-row"><span>Collected</span><strong>${orders.filter(o=>o['Collection Status']==='Collected').length}</strong></div><div class="report-stat-row"><span>Sales value</span><strong>RM${orderRevenue.toFixed(2)}</strong></div>`;
  document.getElementById('reportSnapshot').innerHTML=`<div class="report-stat-row"><span>Attendance records</span><strong>${attendance.length}</strong></div><div class="report-stat-row"><span>New payment records</span><strong>${payments.length}</strong></div><div class="report-stat-row"><span>Orders placed</span><strong>${orders.length}</strong></div><div class="report-stat-row"><span>Students needing payment</span><strong>${due.length}</strong></div>`;
  const studentRows=active.map(s=>{
    const sid=String(s['Student ID']);
    const sa=attendance.filter(a=>String(a['Student ID'])===sid);
    const so=orders.filter(o=>String(o['Student ID'])===sid);
    const state=paymentStateFor(sid);
    const sp=sa.filter(a=>['Present','Absent'].includes(a.Status)).length;
    const sr=sp?Math.round(sa.filter(a=>a.Status==='Present').length/sp*100):0;
    return `<tr class="clickable report-student-row" data-student-name="${esc(String(s['Student Name']).toLowerCase())}" data-student-id="${esc(sid.toLowerCase())}" data-attendance="${sr}" data-payment-status="${esc(state.status)}" onclick="openStudentFromReport('${esc(sid)}')"><td><b>${esc(s['Student Name'])}</b></td><td>${esc(sid)}</td><td>${esc(s['Normal Class Time']||'-')}</td><td><span class="badge present">${sa.filter(a=>a.Status==='Present').length}</span></td><td><span class="badge absent">${sa.filter(a=>a.Status==='Absent').length}</span></td><td>${esc(state.currentCycle)}</td><td>${esc(state.progress)} / 4</td><td>${so.length}</td></tr>`;
  }).join('');
  document.getElementById('reportStudents').innerHTML=studentRows||'<tr><td colspan="8" class="empty">No active students.</td></tr>';

  const shiftMonth=(ym,delta)=>{
    const [y,m]=ym.split('-').map(Number);
    const d=new Date(y,m-1+delta,1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  };
  const monthLabel=ym=>{
    const [y,m]=ym.split('-').map(Number);
    return new Date(y,m-1,1).toLocaleDateString('en-MY',{month:'short',year:'2-digit'});
  };
  const trendMonths=Array.from({length:6},(_,i)=>shiftMonth(month,-5+i));
  const trend=trendMonths.map(m=>{
    const a=DATA.attendance.filter(x=>String(x.Date||'').slice(0,7)===m);
    const p=a.filter(x=>x.Status==='Present').length;
    const md=a.filter(x=>['Present','Absent'].includes(x.Status)).length;
    const ps=DATA.payments.filter(x=>String(x['Payment Date']||'').slice(0,7)===m&&String(x.Status||'').toLowerCase()==='paid');
    const os=DATA.orders.filter(x=>String(x['Order Date']||'').slice(0,7)===m&&String(x.Archived||'').toLowerCase()!=='yes');
    return {m,p,rate:md?Math.round(p/md*100):0,payment:ps.reduce((n,x)=>n+(Number(x.Amount)||0),0),orders:os.reduce((n,x)=>n+(Number(x.Total)||0),0)};
  });
  const maxMoney=Math.max(1,...trend.map(x=>Math.max(x.payment,x.orders)));
  document.getElementById('reportMonthlyTrend').innerHTML=trend.map(x=>`<div class="trend-row"><div class="trend-label"><strong>${monthLabel(x.m)}</strong><span>${x.rate}% attendance</span></div><div class="trend-bars"><div class="trend-track"><div class="trend-payment" style="width:${Math.round(x.payment/maxMoney*100)}%"></div><div class="trend-orders" style="width:${Math.round(x.orders/maxMoney*100)}%"></div></div><small>RM${x.payment.toFixed(0)} payments · RM${x.orders.toFixed(0)} orders</small></div></div>`).join('')||'<div class="empty">No monthly data.</div>';

  const classTimes=[...new Set(active.map(s=>s['Normal Class Time']).filter(Boolean))];
  document.getElementById('rClassTimeBadge').textContent=classTimes.length+' sections';
  const classRows=classTimes.map(time=>{
    const ids=new Set(active.filter(s=>s['Normal Class Time']===time).map(s=>String(s['Student ID'])));
    const a=attendance.filter(x=>ids.has(String(x['Student ID'])));
    const p=a.filter(x=>x.Status==='Present').length;
    const md=a.filter(x=>['Present','Absent'].includes(x.Status)).length;
    return {time,count:ids.size,p,rate:md?Math.round(p/md*100):0};
  });
  document.getElementById('reportClassTimes').innerHTML=classRows.length?classRows.map(x=>`<div class="report-bar-row"><div class="row"><span>${esc(x.time)}</span><strong>${x.rate}%</strong></div><div class="report-bar-track"><div style="width:${x.rate}%"></div></div><small>${x.p} present · ${x.count} active students</small></div>`).join(''):'<div class="empty">No class sections configured.</div>';

  const growthRows=active.map(s=>{
    const sid=String(s['Student ID']);
    const sa=attendance.filter(a=>String(a['Student ID'])===sid);
    const p=sa.filter(a=>a.Status==='Present').length;
    const md=sa.filter(a=>['Present','Absent'].includes(a.Status)).length;
    return {name:s['Student Name'],sid,p,abs:sa.filter(a=>a.Status==='Absent').length,rate:md?Math.round(p/md*100):0};
  }).sort((a,b)=>b.rate-a.rate||b.p-a.p||String(a.name).localeCompare(String(b.name)));
  document.getElementById('reportStudentGrowth').innerHTML=growthRows.length?growthRows.map(x=>`<button class="student-growth-card" onclick="openStudentFromReport('${esc(x.sid)}')"><div class="student-growth-head"><span>${esc(x.name)}</span><strong>${x.rate}%</strong></div><div class="report-bar-track"><div style="width:${x.rate}%"></div></div><small>${x.p} present · ${x.abs} absent</small></button>`).join(''):'<div class="empty">No active students.</div>';
}
