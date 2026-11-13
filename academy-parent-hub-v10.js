/* Banting Scrabble Academy — Parent Hub V10
 * Presentation-only navigation and page compositions. All source data, permissions,
 * class fee rules, order / certificate actions and teacher-preview restrictions
 * continue to come from the existing application functions.
 */
(function () {
  'use strict';
  var root = document.getElementById('parentPortal');
  if (!root || typeof renderParentPortal !== 'function') return;

  var page = 'overview';
  var mounted = false;
  var mobileMenuOpen = false;
  var allPages = [
    ['overview', 'Overview', 'layout'],
    ['package', 'Current Package', 'layers'],
    ['attendance', 'Attendance', 'calendar'],
    ['payments', 'Payments', 'wallet'],
    ['orders', 'Orders', 'bag'],
    ['certificates', 'Certificates', 'award'],
    ['tournaments', 'Tournaments', 'trophy']
  ];
  var archivedPages = [
    ['overview', 'Overview', 'layout'],
    ['attendance', 'Attendance', 'calendar'],
    ['payments', 'Payments', 'wallet'],
    ['orders', 'Orders', 'bag'],
    ['history', 'Archived Student', 'archive']
  ];
  var icons = {
    layout:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    layers:'<path d="m12 2 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5M3 17l9 5 9-5"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-12 5 2 2 4-4"/>',
    wallet:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M16 15h2"/>',
    bag:'<path d="M6 7h12l2 14H4L6 7Zm3 0V5a3 3 0 0 1 6 0v2"/>',
    award:'<circle cx="12" cy="8" r="5"/><path d="m8.5 12-1.5 9 5-3 5 3-1.5-9"/>',
    trophy:'<path d="M8 21h8m-4-4v4M7 3h10v6a5 5 0 0 1-10 0V3ZM7 5H4v2a4 4 0 0 0 4 4m9-6h3v2a4 4 0 0 1-4 4"/>',
    archive:'<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v12h14V9M10 13h4"/>',
    chevron:'<path d="m9 18 6-6-6-6"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    check:'<path d="m5 12 5 5L20 7"/>',
    arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
    menu:'<path d="M4 7h16M4 12h16M4 17h16"/>'
  };
  function svg(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(icons[name]||icons.layout)+'</svg>';
  }
  function safe(value) { return esc(value == null ? '' : String(value)); }
  function cleanNum(value) { return Number(value)||0; }
  function money(value) { return 'RM'+cleanNum(value).toFixed(2); }
  function student() { return (PARENT_CONTEXT.students||[]).find(function(s){return String(s.student_id)===String(PARENT_CONTEXT.selectedStudentId);}); }
  function datasets() {
    var s = student();
    if (!s) return null;
    var sid = String(s.student_id);
    var archived = s.active===false;
    var attendance=(PARENT_CONTEXT.attendance||[]).filter(function(a){return String(a['Student ID'])===sid;}).sort(function(a,b){return attendanceDateKey(b.Date).localeCompare(attendanceDateKey(a.Date));});
    var payments=(PARENT_CONTEXT.payments||[]).filter(function(p){return String(p['Student ID'])===sid;}).sort(function(a,b){return new Date(b['Payment Date'])-new Date(a['Payment Date']);});
    var orders=(PARENT_CONTEXT.orders||[]).filter(function(o){return String(o['Student ID'])===sid&&(archived||!['yes','true'].includes(String(o.Archived||'').toLowerCase()));}).sort(function(a,b){return new Date(b['Order Date'])-new Date(a['Order Date']);});
    var achievements=(PARENT_CONTEXT.achievements||[]).filter(function(a){return String(a.student_id)===sid;});
    var present=attendance.filter(function(a){return a.Status==='Present';}).length;
    var absent=attendance.filter(function(a){return a.Status==='Absent';}).length;
    return {s:s,sid:sid,archived:archived,attendance:attendance,payments:payments,orders:orders,achievements:achievements,
      certs:parentCertificateRecords(sid),present:present,absent:absent,rate:attendance.length?Math.round(present/attendance.length*100):0,
      state:archived?null:parentPaymentState(sid)};
  }
  function header(title,subtitle,d) {
    return '<header class="ph10-heading"><div><div class="ph10-kicker">PARENT PORTAL <span>/</span> '+safe(title.toUpperCase())+'</div><h2>'+safe(title)+'</h2><p>'+safe(subtitle)+'</p></div>'+
      '<div class="ph10-student-mini">'+svg('user')+'<div><strong>'+safe(d.s.student_name)+'</strong><small>'+safe(d.sid)+' · '+safe(d.s.normal_class_time||'Class time not recorded')+'</small></div></div></header>';
  }
  function statusBadge(status) {
    var cls=status==='Paid'||status==='Present'?'present':status==='Almost Due'?'almost':status==='Payment Due'||status==='Unpaid'?'absent':'neutral';
    return '<span class="badge '+cls+'">'+safe(status)+'</span>';
  }
  function card(kicker,title,content,css) {
    return '<section class="ph10-card '+(css||'')+'"><div class="ph10-card-head"><div><span class="ph10-label">'+safe(kicker)+'</span><h3>'+safe(title)+'</h3></div></div>'+content+'</section>';
  }
  function stat(label,value,desc,kind) {
    return '<div class="ph10-stat '+(kind||'')+'"><small>'+safe(label)+'</small><strong>'+safe(value)+'</strong><span>'+safe(desc)+'</span></div>';
  }
  function empty(message) {return '<div class="ph10-empty">'+svg('layers')+'<span>'+safe(message)+'</span></div>';}
  function rowDate(a) { return safe(formatDateClient(a.Date)); }
  function rowsAttendance(list) {
    if(!list.length)return empty('No attendance records are available yet.');
    return '<div class="ph10-list">'+list.map(function(a){
      var status=a.Status==='Present'?'Present':a.Status==='Absent'?'Absent':'Not marked';
      return '<div class="ph10-list-row"><span class="ph10-list-icon '+(status==='Present'?'good':status==='Absent'?'bad':'')+'">'+svg(status==='Present'?'check':'calendar')+'</span><div class="ph10-list-copy"><strong>'+rowDate(a)+'</strong><small>'+safe(a['Actual Class Time']||'Time not recorded')+'</small></div>'+statusBadge(status)+'</div>';
    }).join('')+'</div>';
  }
  function rowsPayments(list){
    if(!list.length)return empty('No payment history has been recorded yet.');
    return '<div class="ph10-list">'+list.map(function(p){return '<div class="ph10-list-row"><span class="ph10-list-icon">'+svg('wallet')+'</span><div class="ph10-list-copy"><strong>Cycle '+safe(p['Cycle Number']||'-')+'</strong><small>'+safe(formatDateClient(p['Payment Date']))+' · '+safe(p['Classes Covered']||'Package payment')+'</small></div><div class="ph10-list-right"><strong>'+money(p.Amount)+'</strong>'+statusBadge(String(p.Status||'Not recorded'))+'</div></div>';}).join('')+'</div>';
  }
  function rowsOrders(list){
    if(!list.length)return empty('There are no orders to display.');
    return '<div class="ph10-list ph10-order-list">'+list.map(function(o){
      return '<button type="button" class="ph10-order-row" data-ph10-order="'+safe(o['Order ID'])+'"><span class="ph10-list-icon">'+svg('bag')+'</span><span class="ph10-list-copy"><strong>'+safe(o.Product||'Order')+'</strong><small>'+safe(o['Order ID'])+' · Qty '+safe(o.Quantity||1)+' · '+safe(formatDateClient(o['Order Date']))+'</small></span><span class="ph10-list-right"><strong>'+money(o.Total)+'</strong><small>'+safe(o['Order Status']||'Pending')+'</small></span>'+svg('chevron')+'</button>';
    }).join('')+'</div>';
  }
  function statusNotice(d) {
    if(d.archived)return '<div class="ph10-notice archived">'+svg('archive')+'<div><strong>Archived student</strong><span>Historical attendance, payments and order records are available to view.</span></div></div>';
    if(d.state.status==='Payment Due')return '<div class="ph10-notice due"><span class="ph10-notice-icon">!</span><div><strong>Package payment required</strong><span>The current four-class package is complete. The next package fee is RM50.</span></div>'+paymentAction(d.state)+'</div>';
    if(d.state.status==='Almost Due')return '<div class="ph10-notice amber">'+svg('clock')+'<div><strong>One class remaining</strong><span>The current package is at 3 of 4 attended classes.</span></div></div>';
    return '';
  }
  function overview(d) {
    var view='<section class="ph10-welcome"><div><span class="ph10-eyebrow-on-dark">STUDENT OVERVIEW</span><h3>'+safe(d.s.student_name)+'</h3><p>'+safe(d.sid)+' · '+safe(d.s.school||'School not recorded')+'</p><div class="ph10-welcome-badge">'+svg('calendar')+' '+safe(d.s.normal_class_time||'Class time not recorded')+'</div></div><div class="ph10-welcome-decor" aria-hidden="true">SC</div></section>';
    view+='<div class="ph10-stat-grid">'+(d.archived?[
      stat('Attendance records',d.attendance.length,'Historical records'),stat('Payments',d.payments.length,'Historical records'),
      stat('Orders',d.orders.length,'Historical records'),stat('Student status','Archived','Read-only information','warn')
    ].join(''):[
      stat('Package progress',d.state.progress+' / 4','Classes used'),stat('Attendance rate',d.rate+'%',d.present+' present · '+d.absent+' absent','teal'),
      stat('Current cycle',d.state.currentCycle,'Four-class package'),stat('Payment status',d.state.status,'Current package',d.state.status==='Paid'?'teal':'warn')
    ].join(''))+'</div>';
    view+=statusNotice(d);
    view+='<div class="ph10-two-col">';
    if(!d.archived){
      view+=card('CURRENT PACKAGE','Your class progress','<div class="ph10-progress-label"><strong>'+d.state.progress+' of 4 classes</strong>'+statusBadge(d.state.status)+'</div><div class="ph10-progress"><span style="width:'+Math.min(100,d.state.progress/4*100)+'%"></span></div><p class="ph10-card-sub">'+(4-d.state.progress)+' classes remaining in this package</p><button type="button" class="ph10-text-action" data-ph10-nav="package">View package '+svg('arrow')+'</button>','ph10-package-peek');
    }else {
      view+=card('HISTORICAL RECORDS','Archived student','<p class="ph10-card-sub">Current classes and live package updates are unavailable for archived students.</p><button type="button" class="ph10-text-action" data-ph10-nav="history">View archived details '+svg('arrow')+'</button>');
    }
    view+=card('RECENT ATTENDANCE','Latest class records',rowsAttendance(d.attendance.slice(0,3))+'<button type="button" class="ph10-text-action" data-ph10-nav="attendance">View all attendance '+svg('arrow')+'</button>')+'</div>';
    return view;
  }
  function paymentAction(st){
    return st.status==='Payment Due'
      ? parentPackagePaymentButton(st,'ph10-pay')
      : '<span class="ph10-payment-hint">No payment is due for this package.</span>';
  }
  function packagePage(d){
    var st=d.state;
    var tiles=Array.from({length:4},function(_,i){
      var a=st.classes[i];
      return '<div class="ph10-class-step '+(a?'done':'waiting')+'"><div class="ph10-step-index">'+(a?svg('check'):String(i+1))+'</div><strong>Class '+(i+1)+'</strong><small>'+(a?safe(formatDateClient(a.Date)):'Remaining slot')+'</small></div>';
    }).join('');
    var primary='<section class="ph10-card ph10-package-focus"><div class="ph10-card-head"><div><span class="ph10-label">FOUR-CLASS PACKAGE</span><h3>Current class package</h3></div>'+statusBadge(st.status)+'</div><div class="ph10-package-count"><strong>'+st.progress+' <span>/ 4</span></strong><small>classes attended in cycle '+safe(st.currentCycle)+'</small></div><div class="ph10-progress"><span style="width:'+Math.min(100,st.progress/4*100)+'%"></span></div><div class="ph10-class-steps">'+tiles+'</div></section>';
    var support=card('PACKAGE SUMMARY','Your current status','<div class="ph10-fact"><span>Current cycle</span><b>'+safe(st.currentCycle)+'</b></div><div class="ph10-fact"><span>Classes remaining</span><b>'+Math.max(0,4-st.progress)+'</b></div><div class="ph10-fact"><span>Package status</span>'+statusBadge(st.status)+'</div><div class="ph10-fact"><span>Last payment</span><b>'+(st.lastPayment?safe(formatDateClient(st.lastPayment['Payment Date'])):'Not recorded')+'</b></div><div class="ph10-card-bottom">'+paymentAction(st)+'</div>');
    return '<div class="ph10-package-layout">'+primary+support+'</div>'+statusNotice(d)+card('CLASS HISTORY','Completed classes in this package',rowsAttendance(st.classes));
  }
  function attendancePage(d){
    return '<div class="ph10-stat-grid three">'+stat('Recorded classes',d.attendance.length,'All available records')+stat('Present',d.present,'Attended classes','teal')+stat('Absent',d.absent,'Recorded absences','warn')+'</div>'+card('ATTENDANCE RECORDS','Class history',rowsAttendance(d.attendance));
  }
  function paymentsPage(d){
    var amount=d.payments.filter(function(p){return String(p.Status||'').toLowerCase()==='paid';}).reduce(function(sum,p){return sum+cleanNum(p.Amount);},0);
    var summary='<div class="ph10-stat-grid three">'+stat('Payment records',d.payments.length,'Recorded transactions')+stat('Total paid',money(amount),'Recorded paid amounts','teal')+stat('Latest payment',d.payments.length?safe(formatDateClient(d.payments[0]['Payment Date'])):'—','Most recent record')+'</div>';
    if(!d.archived){summary=statusNotice(d)+summary+card('CURRENT PACKAGE','Payment status','<div class="ph10-fact"><span>Current cycle</span><b>'+safe(d.state.currentCycle)+'</b></div><div class="ph10-fact"><span>Status</span>'+statusBadge(d.state.status)+'</div><div class="ph10-fact"><span>Package fee</span><b>RM50.00</b></div><div class="ph10-card-bottom">'+paymentAction(d.state)+'</div>');}
    return summary+card('PAYMENT RECORDS','Payment history',rowsPayments(d.payments));
  }
  function ordersPage(d){return '<div class="ph10-stat-grid three">'+stat('Total orders',d.orders.length,'Available records')+stat('Paid orders',d.orders.filter(function(o){return orderPaymentDisplay(o).label==='Paid';}).length,'Payment recorded','teal')+stat('Awaiting collection',d.orders.filter(function(o){return String(o['Collection Status']||'').toLowerCase()==='not collected';}).length,'Not yet collected')+'</div>'+card('ORDER RECORDS','My orders',rowsOrders(d.orders));}
  function certsPage(d){
    var certificates=d.certs;
    var others=d.achievements.filter(function(a){return !certificates.some(function(c){return String(c.achievement_id)===String(a.achievement_id);});});
    var html=card('CERTIFICATE LIBRARY','Certificates '+(certificates.length?'('+certificates.length+')':''),certificates.length?'<div class="ph10-certificate-grid">'+certificates.map(parentCertificateCard).join('')+'</div>':empty('Issued tournament certificates will appear here.'));
    if(others.length)html+=card('ACHIEVEMENTS','Other achievements','<div class="parent-achievement-list">'+renderParentAchievementRows(others)+'</div>');
    return html;
  }
  function tournamentsPage(d){
    var rendered=renderParentTournamentPanel(d.sid);
    return rendered?'<div class="ph10-tournaments">'+rendered+'</div>':card('TOURNAMENTS','Tournament activity',empty('Live and recently completed tournaments for this student will appear here when available.'));
  }
  function historyPage(d){
    var review=document.querySelector('#parentDashboard .archived-review-card');
    var note=document.querySelector('#parentDashboard .archived-parent-notice');
    var html='<div class="ph10-archive-content">'+statusNotice(d);
    if(note)html+=note.outerHTML;
    if(review)html+=review.outerHTML;
    html+='</div>';
    return html+card('HISTORICAL SUMMARY','Preserved records',
      '<div class="ph10-fact"><span>Attendance records</span><b>'+d.attendance.length+'</b></div>'+ 
      '<div class="ph10-fact"><span>Payment records</span><b>'+d.payments.length+'</b></div>'+ 
      '<div class="ph10-fact"><span>Order records</span><b>'+d.orders.length+'</b></div>');
  }
  function availablePages(d){return d&&d.archived?archivedPages:allPages;}
  function navItems(list,mobile){return list.map(function(entry){return '<button class="ph10-nav-button" type="button" data-ph10-nav="'+entry[0]+'" aria-current="'+(page===entry[0]?'page':'false')+'"><span class="ph10-nav-icon">'+svg(entry[2])+'</span><span>'+entry[1]+'</span></button>';}).join('');}
  function mount(){
    if(mounted)return;
    var shell=root.querySelector('.parent-shell');if(!shell)return;
    var frame=document.createElement('div'); frame.className='ph10-frame';
    var aside=document.createElement('aside');aside.className='ph10-side';
    aside.innerHTML='<div class="ph10-brand"><div class="ph10-mark" aria-hidden="true"><span>S</span><span>C</span></div><div><strong>SCRABBLE CLASS</strong><small>Parent Portal</small></div></div><div class="ph10-nav-label">PARENT WORKSPACE</div><nav id="ph10SidebarNav" aria-label="Parent pages"></nav><div class="ph10-side-footer"><strong>Banting Scrabble Academy</strong><span>Student information</span></div>';
    var work=document.createElement('div');work.className='ph10-work';
    shell.parentNode.insertBefore(frame,shell);frame.appendChild(aside);frame.appendChild(work);work.appendChild(shell);
    var content=document.createElement('main');content.id='parentHubV10Content';content.className='ph10-content';content.setAttribute('tabindex','-1');
    var dash=document.getElementById('parentDashboard');dash.parentNode.insertBefore(content,dash);
    var bottom=document.createElement('nav');bottom.id='ph10BottomNav';bottom.className='ph10-bottom-nav';bottom.setAttribute('aria-label','Parent mobile navigation');
    bottom.innerHTML='<div class="ph10-bottom-main"></div><div class="ph10-more-menu" id="ph10MoreMenu" hidden></div>';
    root.insertBefore(bottom,document.getElementById('parentDetailModal'));
    root.classList.add('ph10-installed');
    root.addEventListener('click',function(event){
      var target=event.target.closest('[data-ph10-nav]');
      if(target){event.preventDefault();go(target.getAttribute('data-ph10-nav'));return;}
      var order=event.target.closest('[data-ph10-order]');
      if(order){event.preventDefault();openOrder(order.getAttribute('data-ph10-order'));return;}
      if(event.target.closest('#ph10MoreToggle')){event.preventDefault();setMore(!mobileMenuOpen);return;}
      if(event.target.closest('#parentChildren .parent-child-tab')){
        if(page!=='overview')go('overview');
        return;
      }
      if(mobileMenuOpen&&!event.target.closest('#ph10MoreMenu'))setMore(false);
    });
    document.addEventListener('keydown',function(event){if(event.key==='Escape')setMore(false);});
    mounted=true;
  }
  function setMore(value){mobileMenuOpen=!!value;var menu=document.getElementById('ph10MoreMenu');var toggle=document.getElementById('ph10MoreToggle');if(menu)menu.hidden=!mobileMenuOpen;if(toggle)toggle.setAttribute('aria-expanded',mobileMenuOpen?'true':'false');}
  function navRefresh(d){
    var pages=availablePages(d);
    if(!pages.some(function(p){return p[0]===page;}))page='overview';
    var aside=document.getElementById('ph10SidebarNav');if(aside)aside.innerHTML=navItems(pages,false);
    var tabs=d&&d.archived?['overview','attendance','payments']:['overview','package','attendance','payments'];
    var displayed=pages.filter(function(p){return tabs.includes(p[0]);});
    var bottom=document.querySelector('.ph10-bottom-main');
    if(bottom)bottom.innerHTML=navItems(displayed,true)+'<button type="button" class="ph10-nav-button ph10-more-toggle" id="ph10MoreToggle" aria-label="More pages" aria-expanded="false"><span class="ph10-nav-icon">'+svg('menu')+'</span><span>More</span></button>';
    var remaining=pages.filter(function(p){return !tabs.includes(p[0]);});
    var more=document.getElementById('ph10MoreMenu');if(more){more.innerHTML=navItems(remaining,false);more.hidden=!mobileMenuOpen;}
    if(bottom)bottom.classList.toggle('ph10-more-current',remaining.some(function(p){return p[0]===page;}));
  }
  function go(destination){
    var d=datasets();if(!d)return;
    if(!availablePages(d).some(function(p){return p[0]===destination;}))return;
    page=destination;setMore(false);
    if(document.getElementById('parentDetailModal')&&!document.getElementById('parentDetailModal').classList.contains('hidden'))closeParentPanel();
    render();
    if(typeof window.scrollTo==='function')window.scrollTo({top:0,behavior:'auto'});
    var h=document.querySelector('#parentHubV10Content h2');if(h)h.setAttribute('tabindex','-1');
  }
  function openOrder(id){
    if(typeof openParentPanel==='function')openParentPanel('orders');
    if(typeof openParentOrderDetail==='function')openParentOrderDetail(id);
  }
  function render(){
    mount();
    var content=document.getElementById('parentHubV10Content');if(!content)return;
    var d=datasets();
    navRefresh(d);
    if(!d){content.innerHTML='<div class="ph10-card">'+empty('No student is linked to this parent account yet. Please contact the teacher.')+'</div>';return;}
    var descriptions={overview:'Your child’s important information, at a glance.',package:'Your current four-class package and attended sessions.',attendance:'Your child’s recorded class attendance.',payments:'Current status and payment history.',orders:'Order details and collection information.',certificates:'Certificates and achievement records.',tournaments:'Competition activity, standings and results.',history:'Historical information and review-request status.'};
    var pageName=availablePages(d).find(function(p){return p[0]===page;});
    var title=pageName?pageName[1]:'Overview';
    var panels=page==='overview'?overview(d):page==='package'&&!d.archived?packagePage(d):page==='attendance'?attendancePage(d):page==='payments'?paymentsPage(d):page==='orders'?ordersPage(d):page==='certificates'&&!d.archived?certsPage(d):page==='tournaments'&&!d.archived?tournamentsPage(d):page==='history'?historyPage(d):overview(d);
    content.innerHTML=header(title,descriptions[page]||'',d)+'<div class="ph10-page-content">'+panels+'</div>';
    if(page==='certificates')Promise.resolve(hydrateParentCertificateCards()).catch(function(){});
  }
  var oldRender=renderParentPortal;
  renderParentPortal=function(){
    var result=oldRender.apply(this,arguments);
    try{render();}catch(error){console.error('Parent Hub V10 view error',error);}
    return result;
  };
  window.parentHubV10={navigate:go,refresh:render,openOrder:openOrder};
  document.addEventListener('DOMContentLoaded',function(){mount();});
}());
