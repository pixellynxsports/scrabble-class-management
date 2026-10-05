/* SCMS certificate business rules
 * Pure functions only. No DOM, Supabase or rendering dependencies.
 */
(function(){
  'use strict';
  const api=window.SCMSCertificateRules={};
  api.awardCode=function(type){
    const value=String(type||'').toLowerCase();
    if(value==='1st place')return '1ST';
    if(value==='2nd place')return '2ND';
    if(value==='3rd place')return '3RD';
    if(value.includes('most improved'))return 'MIP';
    if(value.includes('strategic player'))return 'SP';
    if(value.includes('fighting spirit'))return 'FS';
    if(value.includes('participation'))return 'PART';
    return 'AWD';
  };
  api.awardCaption=function(type,tournamentName){
    const value=String(type||'').toLowerCase();
    const label=value==='1st place'?'1st':value==='2nd place'?'2nd':value==='3rd place'?'3rd':value.includes('most improved')?'MIP':value.includes('strategic player')?'SP':value.includes('fighting spirit')?'FS':value.includes('participation')?'PART':'Award';
    return label+' in '+String(tournamentName||'Tournament');
  };
  api.certificateNumber=function(tournament,award){
    const year=String(tournament.event_date||new Date().toISOString()).slice(0,4);
    const tournamentKey=String(tournament.tournament_id||'').replace(/-/g,'').slice(0,8).toUpperCase()||'EVENT';
    return 'BSA-'+year+'-'+tournamentKey+'-'+api.awardCode(award.award_type);
  };
})();
