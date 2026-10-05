/* SCMS Teacher STUDENTS module */
/* ===== STUDENTS ===== */
function setStudentSort(key){
  if(studentSortKey===key)studentSortDirection=studentSortDirection==='asc'?'desc':'asc';
  else{studentSortKey=key;studentSortDirection='asc';}
  renderStudents();
}
function studentSortValue(student,key,state){
  if(key==='id')return String(student['Student ID']||'').trim();
  if(key==='studentName')return String(student['Student Name']||'').trim();
  if(key==='normalTime'){
    const text=String(student['Normal Class Time']||'').trim().toUpperCase();
    const m=text.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/);
    if(!m)return Number.POSITIVE_INFINITY;
    let hour=Number(m[1]);const minute=Number(m[2]);if(m[3]==='PM'&&hour!==12)hour+=12;if(m[3]==='AM'&&hour===12)hour=0;
    return hour*60+minute;
  }
  if(key==='currentCycle')return Number(state.currentCycle)||0;
  if(key==='classes')return Number(state.progress)||0;
  if(key==='status'){
    const order={'Paid':1,'Almost Due':2,'Payment Due':3};
    return order[state.status]||99;
  }
  if(key==='enrollment'){
    const value=student['Registration Date'];
    const keyValue=attendanceDateKey(value);
    return keyValue?Date.parse(keyValue+'T00:00:00'):0;
  }
  return '';
}
function compareStudentValues(a,b,key,stateA,stateB){
  const av=studentSortValue(a,key,stateA),bv=studentSortValue(b,key,stateB);
  if(typeof av==='number'&&typeof bv==='number')return av-bv;
  return String(av).localeCompare(String(bv),undefined,{numeric:true,sensitivity:'base'});
}
function studentSortIndicator(key){
  if(studentSortKey!==key)return '';
  return studentSortDirection==='asc'?' ↑':' ↓';
}
function renderStudents(){
  const q=(document.getElementById('studentSearch')?.value||'').toLowerCase();
  const students=DATA.students
    .filter(s=>(studentView==='archived'?String(s.Active||'').toLowerCase()==='no':String(s.Active||'yes').toLowerCase()!=='no'))
    .filter(s=>Object.values(s).some(v=>String(v).toLowerCase().includes(q)));
  const prepared=students.map(s=>({s,state:paymentStateFor(s['Student ID'])}));
  prepared.sort((a,b)=>{
    const result=compareStudentValues(a.s,b.s,studentSortKey,a.state,b.state);
    return studentSortDirection==='asc'?result:-result;
  });
  const rows=prepared.map(({s,state})=>{
    const progress=state.progress;
    const currentCycle=state.currentCycle||1;
    const archived=String(s.Active||'').toLowerCase()==='no';
    const safeId=String(s['Student ID']).replace(/[^a-zA-Z0-9_-]/g,'_');
    const finalAction=archived?'Restore Student':'Archive Student';
    const finalFn=archived?'restoreStudent':'archiveStudent';
    const action=`<div class="student-action-wrap"><button class="student-action-trigger" type="button" aria-label="Student actions" aria-haspopup="true" onclick="toggleStudentActionMenu(event,'${esc(s['Student ID'])}')">⋮</button><div class="student-action-menu" id="studentActionMenu-${safeId}" role="menu"><button type="button" onclick="runStudentAction(event,editStudent,'${esc(s['Student ID'])}')">Edit Student</button><button type="button" onclick="runStudentAction(event,openTeacherParentPreview,'${esc(s['Student ID'])}')">View Parent Portal</button><button type="button" onclick="runStudentAction(event,generateParentLoginDetails,'${esc(s['Student ID'])}')">Generate Password &amp; Email</button><div class="student-action-divider"></div><button type="button" class="danger" onclick="runStudentAction(event,${finalFn},'${esc(s['Student ID'])}')">${finalAction}</button></div></div>`;
    return `<tr class="clickable" onclick="openStudent('${esc(s['Student ID'])}')"><td>${esc(s['Student ID'])}</td><td><b>${esc(s['Student Name'])}</b></td><td>${esc(s['Normal Class Time']||'')}</td><td>${currentCycle}</td><td>${progress} / 4</td><td>${badge(progress,state)}</td><td>${esc(formatDateClient(s['Registration Date']))}</td><td>${action}</td></tr>`;
  }).join('');
  document.getElementById('studentsBody').innerHTML=rows||'<tr><td colspan="8" class="empty">No students found.</td></tr>';
  const headers={id:'ID',studentName:'Student',normalTime:'Normal Time',currentCycle:'Current Cycle',classes:'Classes',status:'Status',enrollment:'Enrollment'};
  Object.entries(headers).forEach(([key,label])=>{
    const button=document.querySelector(`#students thead [data-student-sort="${key}"]`);
    if(!button)return;
    button.innerHTML=`${label}<span class="student-sort-indicator">${studentSortIndicator(key)}</span>`;
    button.setAttribute('aria-sort',studentSortKey===key?(studentSortDirection==='asc'?'ascending':'descending'):'none');
  });
}
async function archiveStudent(id){if(!(await appConfirm('Historical attendance, payment and order records will remain preserved.','Archive Student?')))return;try{DATA=await run('archiveStudent',id);renderAll()}catch(e){appNotify(e.message||e)}}
async function restoreStudent(id){try{DATA=await run('restoreStudent',id);renderAll()}catch(e){appNotify(e.message||e)}}
function renderProfile(id){if(document.getElementById('studentProfile').classList.contains('active'))openStudent(id)}
