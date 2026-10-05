/* SCMS Automatic Tournament Certificates
 * Generates certificates from the fixed reusable certificate template.
 * Stores PDF + thumbnail in Supabase Storage and links each certificate
 * to the student's achievement record.
 */
(function(){
  'use strict';

  const CONFIG = {
    templatePath: 'assets/certificate-template.png',
    signaturePath: 'assets/certificate-signature.png',
    bucket: 'student-achievements',
    templateWidth: 1492,
    templateHeight: 1054
  };

  let templateImage = null;
  let signatureImage = null;

  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g,function(m){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
    });
  }

  function notify(message,type,title,options){
    if(typeof appNotify === 'function') appNotify(message,type||'info',title||'',options||{});
    else console.warn(message);
  }

  function awardCode(type){
    const value=String(type||'').toLowerCase();
    if(value==='1st place')return '1ST';
    if(value==='2nd place')return '2ND';
    if(value==='3rd place')return '3RD';
    if(value.includes('most improved'))return 'MIP';
    if(value.includes('strategic player'))return 'SP';
    if(value.includes('fighting spirit'))return 'FS';
    if(value.includes('participation'))return 'PART';
    return 'AWD';
  }

  function awardCaption(type,tournamentName){
    const value=String(type||'').toLowerCase();
    const label=value==='1st place'?'1st':value==='2nd place'?'2nd':value==='3rd place'?'3rd':value.includes('most improved')?'MIP':value.includes('strategic player')?'SP':value.includes('fighting spirit')?'FS':value.includes('participation')?'PART':'Award';
    return label+' in '+String(tournamentName||'Tournament');
  }

  function certificateNumber(tournament,award){
    const year=String(tournament.event_date||new Date().toISOString()).slice(0,4);
    const tournamentKey=String(tournament.tournament_id||'').replace(/-/g,'').slice(0,8).toUpperCase()||'EVENT';
    return 'BSA-'+year+'-'+tournamentKey+'-'+awardCode(award.award_type);
  }

  function loadImage(path){
    return new Promise(function(resolve,reject){
      const image=new Image();
      image.onload=function(){resolve(image);};
      image.onerror=function(){reject(new Error('Certificate asset could not be loaded: '+path));};
      image.src=path+'?v=20261005.1';
    });
  }

  async function ensureAssets(){
    if(!templateImage)templateImage=await loadImage(CONFIG.templatePath);
    if(!signatureImage){
      try{signatureImage=await loadImage(CONFIG.signaturePath);}catch(e){signatureImage=null;}
    }
  }

  function fitFont(ctx,text,maxWidth,startSize,family,weight){
    let size=startSize;
    ctx.font=(weight||'700')+' '+size+'px '+family;
    while(size>18&&ctx.measureText(text).width>maxWidth){
      size-=1;
      ctx.font=(weight||'700')+' '+size+'px '+family;
    }
    return size;
  }

  function drawCentered(ctx,text,x,y,maxWidth,size,color,family,weight){
    const fontFamily=family||'Georgia, Times New Roman, serif';
    const fontWeight=weight||'700';
    const actual=fitFont(ctx,text,maxWidth,size,fontFamily,fontWeight);
    ctx.font=fontWeight+' '+actual+'px '+fontFamily;
    ctx.fillStyle=color;
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillText(text,x,y);
  }

  function transparentSignatureSource(image){
    const c=document.createElement('canvas');
    c.width=image.naturalWidth||image.width;
    c.height=image.naturalHeight||image.height;
    const x=c.getContext('2d');
    x.drawImage(image,0,0);
    const data=x.getImageData(0,0,c.width,c.height);
    for(let i=0;i<data.data.length;i+=4){
      const r=data.data[i],g=data.data[i+1],b=data.data[i+2];
      if(r>242&&g>242&&b>242)data.data[i+3]=0;
    }
    x.putImageData(data,0,0);
    return c;
  }

  function drawSignature(ctx){
    if(!signatureImage)return;
    try{
      const source=transparentSignatureSource(signatureImage);
      const maxW=250,maxH=72;
      const ratio=Math.min(maxW/source.width,maxH/source.height);
      const w=source.width*ratio,h=source.height*ratio;
      ctx.drawImage(source,746-w/2,910-h/2,w,h);
    }catch(e){
      console.warn('Certificate signature overlay failed:',e);
    }
  }

  function drawCertificate(tournament,award){
    const canvas=document.createElement('canvas');
    canvas.width=CONFIG.templateWidth;
    canvas.height=CONFIG.templateHeight;
    const ctx=canvas.getContext('2d');
    ctx.drawImage(templateImage,0,0,canvas.width,canvas.height);

    const navy='#10264f';
    const gold='#9b5d00';

    const studentName=String(award.student_name||'');
    const title=String(award.title||award.award_type||'Achievement');
    const eventName=String(tournament.name||'Scrabble Tournament');
    const eventDate=String(tournament.event_date||'').slice(0,10);
    const certificateNo=String(award.certificate_number||certificateNumber(tournament,award));

    drawCentered(ctx,studentName,746,482,800,38,navy,'Georgia, Times New Roman, serif','700');
    drawCentered(ctx,title,746,600,700,50,'#f8d27a','Georgia, Times New Roman, serif','700');
    drawCentered(ctx,eventName,770,690,520,24,navy,'Georgia, Times New Roman, serif','700');
    drawCentered(ctx,eventDate?new Date(eventDate+'T12:00:00').toLocaleDateString(undefined,{day:'2-digit',month:'long',year:'numeric'}):'',770,731,520,22,navy,'Georgia, Times New Roman, serif','600');

    drawSignature(ctx);
    drawCentered(ctx,certificateNo,1255,976,250,13,navy,'Arial, Helvetica, sans-serif','600');

    return canvas;
  }

  async function canvasToBlob(canvas,type,quality){
    return new Promise(function(resolve,reject){
      canvas.toBlob(function(blob){blob?resolve(blob):reject(new Error('Unable to create certificate image.'));},type,quality);
    });
  }

  function safePath(value){
    return String(value||'').replace(/[^a-zA-Z0-9._-]+/g,'_');
  }

  async function uploadBlob(path,blob,contentType){
    const result=await supabaseClient.storage.from(CONFIG.bucket).upload(path,blob,{contentType:contentType,upsert:true,cacheControl:'31536000'});
    if(result.error)throw result.error;
    return path;
  }

  async function upsertAchievement(tournament,award,pdfPath,thumbnailPath){
    const payload={
      student_id:award.student_id,
      title:award.title,
      category:'Tournament Certificate',
      achievement_date:tournament.event_date,
      description:award.certificate_caption,
      file_path:pdfPath,
      file_name:(award.certificate_number||'Certificate')+'.pdf',
      file_type:'application/pdf',
      source_type:'tournament',
      source_id:String(award.award_id),
      certificate_number:award.certificate_number,
      certificate_status:'published',
      certificate_path:pdfPath,
      certificate_thumbnail_path:thumbnailPath,
      certificate_caption:award.certificate_caption
    };

    const existing=await supabaseClient.from('student_achievements').select('achievement_id').eq('source_type','tournament').eq('source_id',String(award.award_id)).maybeSingle();
    if(existing.error)throw existing.error;

    if(existing.data){
      const result=await supabaseClient.from('student_achievements').update(payload).eq('achievement_id',existing.data.achievement_id).select('achievement_id').single();
      if(result.error)throw result.error;
      return result.data;
    }

    const result=await supabaseClient.from('student_achievements').insert(payload).select('achievement_id').single();
    if(result.error)throw result.error;
    return result.data;
  }

  async function preview(tournament,award){
    if(!award||!award.student_id)throw new Error('No student is linked to this award.');
    await ensureAssets();
    const certificateNo=award.certificate_number||certificateNumber(tournament,award);
    const workingAward=Object.assign({},award,{title:award.title||award.award_type,certificate_number:certificateNo,certificate_caption:award.certificate_caption||awardCaption(award.award_type,tournament.name)});
    const canvas=drawCertificate(tournament,workingAward);
    return {imageData:canvas.toDataURL('image/jpeg',0.94),certificateNumber:certificateNo};
  }

  async function generateOne(tournament,award){
    if(!award||!award.student_id)return {skipped:true,reason:'No student linked'};
    await ensureAssets();

    const certificateNo=award.certificate_number||certificateNumber(tournament,award);
    const caption=award.certificate_caption||awardCaption(award.award_type,tournament.name);
    const workingAward=Object.assign({},award,{title:award.title||award.award_type,certificate_number:certificateNo,certificate_caption:caption});
    const canvas=drawCertificate(tournament,workingAward);

    if(!window.jspdf||!window.jspdf.jsPDF)throw new Error('PDF engine is unavailable. Refresh the page and try again.');
    const PDF=window.jspdf.jsPDF;
    const pdf=new PDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
    pdf.addImage(canvas.toDataURL('image/jpeg',0.94),'JPEG',0,0,297,210,undefined,'FAST');
    const pdfBlob=pdf.output('blob');
    const thumbnailCanvas=document.createElement('canvas');
    thumbnailCanvas.width=600;
    thumbnailCanvas.height=Math.round(600*CONFIG.templateHeight/CONFIG.templateWidth);
    thumbnailCanvas.getContext('2d').drawImage(canvas,0,0,thumbnailCanvas.width,thumbnailCanvas.height);
    const thumbnailBlob=await canvasToBlob(thumbnailCanvas,'image/jpeg',0.88);

    const base='certificates/'+safePath(tournament.tournament_id)+'/'+safePath(award.student_id)+'-'+safePath(awardCode(award.award_type));
    const pdfPath=base+'.pdf';
    const thumbnailPath=base+'.jpg';

    await uploadBlob(pdfPath,pdfBlob,'application/pdf');
    await uploadBlob(thumbnailPath,thumbnailBlob,'image/jpeg');

    const awardUpdate={
      certificate_path:pdfPath,
      certificate_number:certificateNo,
      certificate_status:'published',
      certificate_caption:caption,
      certificate_generated_at:new Date().toISOString()
    };
    const awardResult=await supabaseClient.from('tournament_awards').update(awardUpdate).eq('award_id',award.award_id);
    if(awardResult.error)throw awardResult.error;

    const achievement=await upsertAchievement(tournament,workingAward,pdfPath,thumbnailPath);
    if(achievement?.achievement_id){
      const linkResult=await supabaseClient.from('tournament_awards').update({achievement_id:achievement.achievement_id}).eq('award_id',award.award_id);
      if(linkResult.error)throw linkResult.error;
    }
    return {certificateNo:certificateNo,pdfPath:pdfPath,thumbnailPath:thumbnailPath,achievementId:achievement?.achievement_id||null};
  }

  async function generateForAwards(tournament,awards){
    const list=(awards||[]).filter(function(a){return a&&a.student_id;});
    if(!list.length)return {generated:0,failed:0};
    let generated=0,failed=0;
    for(const award of list){
      try{
        await generateOne(tournament,award);
        generated++;
      }catch(error){
        failed++;
        await supabaseClient.from('tournament_awards').update({certificate_status:'failed'}).eq('award_id',award.award_id);
        console.error('Certificate generation failed:',error);
      }
    }
    return {generated:generated,failed:failed};
  }

  async function generateTournament(tournament,awards){
    try{
      const result=await generateForAwards(tournament,awards);
      if(result.generated)notify(result.generated+' certificate'+(result.generated===1?'':'s')+' generated and linked to Parent Portal.','success','Certificates Generated',{variant:'registration'});
      if(result.failed)notify(result.failed+' certificate'+(result.failed===1?'':'s')+' failed. Open the tournament and retry generation.','error','Certificate Generation Incomplete',{variant:'critical'});
      return result;
    }catch(error){
      notify(error.message||String(error),'error','Certificates Not Generated',{variant:'critical'});
      return {generated:0,failed:awards?.length||0};
    }
  }

  async function retryFailed(tournamentId){
    const result=await supabaseClient.from('tournament_awards').select('*').eq('tournament_id',tournamentId).eq('certificate_status','failed');
    if(result.error)throw result.error;
    const tournamentResult=await supabaseClient.from('tournaments').select('*').eq('tournament_id',tournamentId).single();
    if(tournamentResult.error)throw tournamentResult.error;
    return generateTournament(tournamentResult.data,result.data||[]);
  }

  window.SCMSCertificates={
    preview:preview,
    generateForAwards:generateForAwards,
    generateTournament:generateTournament,
    retryFailed:retryFailed,
    awardCaption:awardCaption,
    awardCode:awardCode,
    certificateNumber:certificateNumber
  };
})();
