/* Scrabble Class Management shared utilities */
const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const isoDate=d=>{const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`};
const CLASS_START_DATE='2026-09-06';
function latestSunday(d=new Date()){const x=new Date(d);x.setHours(12,0,0,0);x.setDate(x.getDate()-x.getDay());const start=new Date(CLASS_START_DATE+'T12:00:00');return x<start?start:x}
function dbError(error){if(!error)return null;return new Error(error.message||'Supabase request failed.');}
function nextLocalId(prefix,items,key){let max=0;items.forEach(x=>{const m=String(x[key]||'').match(/(\d+)$/);if(m)max=Math.max(max,Number(m[1]));});return prefix+String(max+1).padStart(3,'0')}
/* ===== IN-APP NOTIFICATIONS ===== */
function ensureNotificationUI(){
  if(document.getElementById('scNotificationRoot'))return;
  const root=document.createElement('div');
  root.id='scNotificationRoot';
  root.className='sc-notification-root';
  root.setAttribute('aria-live','polite');
  document.body.appendChild(root);
  const modal=document.createElement('div');
  modal.id='scDialogRoot';
  modal.className='sc-dialog-root';
  modal.innerHTML='<div class="sc-dialog-backdrop"></div><div class="sc-dialog" role="dialog" aria-modal="true"><button class="sc-dialog-close" type="button" aria-label="Close">×</button><div class="sc-dialog-icon"></div><div class="sc-dialog-eyebrow"></div><h3 class="sc-dialog-title"></h3><p class="sc-dialog-message"></p><div class="sc-dialog-body"></div><div class="sc-dialog-actions"></div></div>';
  document.body.appendChild(modal);
  modal.querySelector('.sc-dialog-backdrop').onclick=()=>window.__scDialogResolve?.(false);
  modal.querySelector('.sc-dialog-close').onclick=()=>window.__scDialogResolve?.(false);
}
function appNotify(message,type='info',title=''){
  ensureNotificationUI();
  const root=document.getElementById('scNotificationRoot');
  const config={success:['✓','SUCCESS'],error:['!','ERROR'],warning:['!','ATTENTION'],info:['i','NOTICE']};
  const [icon,label]=config[type]||config.info;
  const item=document.createElement('div');
  item.className='sc-notification sc-notification-'+type;
  item.innerHTML='<div class="sc-notification-icon">'+icon+'</div><div class="sc-notification-copy"><div class="sc-notification-title">'+esc(title||label)+'</div><div class="sc-notification-message">'+esc(String(message||''))+'</div></div><button class="sc-notification-close" type="button" aria-label="Dismiss">×</button><div class="sc-notification-progress"></div>';
  root.appendChild(item);
  const close=()=>{item.classList.add('is-closing');setTimeout(()=>item.remove(),180)};
  item.querySelector('.sc-notification-close').onclick=close;
  setTimeout(close,5000);
}
function appConfirm(message,title='Confirm Action'){
  ensureNotificationUI();
  return new Promise(resolve=>{
    const modal=document.getElementById('scDialogRoot');
    const dialog=modal.querySelector('.sc-dialog');
    modal.querySelector('.sc-dialog-icon').textContent='?';
    modal.querySelector('.sc-dialog-eyebrow').textContent='CONFIRMATION';
    modal.querySelector('.sc-dialog-title').textContent=title;
    modal.querySelector('.sc-dialog-message').textContent=message;
    modal.querySelector('.sc-dialog-body').innerHTML='';
    modal.querySelector('.sc-dialog-actions').innerHTML='<button type="button" class="secondary sc-dialog-cancel">Cancel</button><button type="button" class="primary sc-dialog-confirm">Continue</button>';
    modal.classList.add('show');document.body.classList.add('sc-dialog-open');
    const finish=value=>{modal.classList.remove('show');document.body.classList.remove('sc-dialog-open');window.__scDialogResolve=null;resolve(value)};
    window.__scDialogResolve=finish;
    modal.querySelector('.sc-dialog-cancel').onclick=()=>finish(false);
    modal.querySelector('.sc-dialog-confirm').onclick=()=>finish(true);
    setTimeout(()=>modal.querySelector('.sc-dialog-confirm')?.focus(),20);
  });
}
function appPrompt(message,defaultValue='',title='Additional Information',placeholder='Enter details'){
  ensureNotificationUI();
  return new Promise(resolve=>{
    const modal=document.getElementById('scDialogRoot');
    modal.querySelector('.sc-dialog-icon').textContent='✎';
    modal.querySelector('.sc-dialog-eyebrow').textContent='INPUT REQUIRED';
    modal.querySelector('.sc-dialog-title').textContent=title;
    modal.querySelector('.sc-dialog-message').textContent=message;
    modal.querySelector('.sc-dialog-body').innerHTML='<input class="sc-dialog-input" type="text" placeholder="'+esc(placeholder)+'">';
    modal.querySelector('.sc-dialog-actions').innerHTML='<button type="button" class="secondary sc-dialog-cancel">Cancel</button><button type="button" class="primary sc-dialog-confirm">Continue</button>';
    const input=modal.querySelector('.sc-dialog-input');input.value=defaultValue;
    modal.classList.add('show');document.body.classList.add('sc-dialog-open');
    const finish=value=>{modal.classList.remove('show');document.body.classList.remove('sc-dialog-open');window.__scDialogResolve=null;resolve(value)};
    window.__scDialogResolve=finish;
    modal.querySelector('.sc-dialog-cancel').onclick=()=>finish(null);
    modal.querySelector('.sc-dialog-confirm').onclick=()=>finish(input.value);
    input.onkeydown=e=>{if(e.key==='Enter')finish(input.value);if(e.key==='Escape')finish(null)};
    setTimeout(()=>input.focus(),20);
  });
}
