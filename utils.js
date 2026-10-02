/* Scrabble Class Management shared utilities */
const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const isoDate=d=>{const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`};
const CLASS_START_DATE='2026-09-06';
function latestSunday(d=new Date()){const x=new Date(d);x.setHours(12,0,0,0);x.setDate(x.getDate()-x.getDay());const start=new Date(CLASS_START_DATE+'T12:00:00');return x<start?start:x}
function dbError(error){if(!error)return null;return new Error(error.message||'Supabase request failed.');}
function nextLocalId(prefix,items,key){let max=0;items.forEach(x=>{const m=String(x[key]||'').match(/(\d+)$/);if(m)max=Math.max(max,Number(m[1]));});return prefix+String(max+1).padStart(3,'0')}