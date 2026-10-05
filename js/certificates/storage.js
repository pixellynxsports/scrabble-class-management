/* SCMS certificate storage service */
(function(){
  'use strict';
  const bucket='student-achievements';
  function safePath(value){return String(value||'').replace(/[^a-zA-Z0-9._-]+/g,'_')}
  async function upload(path,blob,contentType){const result=await supabaseClient.storage.from(bucket).upload(path,blob,{contentType:contentType,upsert:true,cacheControl:'31536000'});if(result.error)throw result.error;return path}
  async function upsertAchievement(tournament,award,pdfPath,thumbnailPath){const payload={student_id:award.student_id,title:award.title,category:'Tournament Certificate',achievement_date:tournament.event_date,description:award.certificate_caption,file_path:pdfPath,file_name:(award.certificate_number||'Certificate')+'.pdf',file_type:'application/pdf',source_type:'tournament',source_id:String(award.award_id),certificate_number:award.certificate_number,certificate_status:'published',certificate_path:pdfPath,certificate_thumbnail_path:thumbnailPath,certificate_caption:award.certificate_caption};const existing=await supabaseClient.from('student_achievements').select('achievement_id').eq('source_type','tournament').eq('source_id',String(award.award_id)).maybeSingle();if(existing.error)throw existing.error;if(existing.data){const result=await supabaseClient.from('student_achievements').update(payload).eq('achievement_id',existing.data.achievement_id).select('achievement_id').single();if(result.error)throw result.error;return result.data}const result=await supabaseClient.from('student_achievements').insert(payload).select('achievement_id').single();if(result.error)throw result.error;return result.data}
  window.SCMSCertificateStorage={upload:upload,upsertAchievement:upsertAchievement,safePath:safePath};
})();
