/* SCMS Tournament Management
 * Challonge-inspired tournament control, integrated with the existing Teacher Portal.
 * Intentionally isolated from attendance, payments, orders, registration and login.
 */
(function(){
  'use strict';

  const state={tournaments:[],students:[],selected:null,players:[],rounds:[],matches:[],awards:[],standings:[],view:'overview',roundFocus:null,loaded:false,loading:false};

  const FORMAT_LABELS={
    single_elimination:'Single Elimination',
    double_elimination:'Double Elimination',
    round_robin:'Round Robin',
    swiss:'Swiss',
    free_for_all:'Free For All',
    leaderboard:'Leaderboard'
  };

  function escT(value){return String(value==null?'':value).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});}
  function notifyT(message,type,title,options){if(typeof appNotify==='function')appNotify(message,type||'info',title||'',options||{});else console.warn(message);}
  function confirmT(message,title){if(typeof appConfirm==='function')return appConfirm(message,title||'Confirm Action','TOURNAMENT');return Promise.resolve(window.confirm(message));}
  function root(){return document.getElementById('tournamentContent');}
  function formatLabel(value){return FORMAT_LABELS[value]||String(value||'').replace(/_/g,' ');}
  function dateLabel(value){if(!value)return 'Date not set';const d=new Date(String(value).length===10?value+'T12:00:00':value);return Number.isNaN(d.getTime())?String(value):d.toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'});}
  function statusClass(status){return {draft:'tournament-status-draft',ready:'tournament-status-ready',active:'tournament-status-active',completed:'tournament-status-completed',archived:'tournament-status-archived'}[status]||'tournament-status-draft';}
  function statusLabel(status){return String(status||'draft').replace(/^./,function(x){return x.toUpperCase();});}

  async function loadTournaments(){
    state.loading=true;
    try{
      const results=await Promise.all([
        supabaseClient.from('tournaments').select('*').order('event_date',{ascending:false}).order('created_at',{ascending:false}),
        supabaseClient.from('students').select('student_id,student_name,school,active,normal_class_time').eq('active',true).order('student_name')
      ]);
      if(results[0].error)throw results[0].error;
      if(results[1].error)throw results[1].error;
      state.tournaments=results[0].data||[];
      state.students=results[1].data||[];
      state.loaded=true;
      renderHome();
    }catch(error){
      state.loaded=false;
      const message=error&&error.message?error.message:String(error);
      if(/relation .*tournaments.*does not exist|could not find the table/i.test(message))renderSetupRequired();
      else renderError(message);
    }finally{state.loading=false;}
  }

  function renderSetupRequired(){
    const el=root();if(!el)return;
    el.innerHTML='<div class="tournament-setup-card"><div class="tournament-setup-icon">!</div><div><div class="eyebrow">TOURNAMENT DATABASE</div><h2>One setup step is required</h2><p>The Tournament module is installed in the website, but its Supabase database migration has not been run yet.</p><p class="subtle">Run <strong>sql/20261003_tournaments.sql</strong> once in the Supabase SQL Editor. Existing SCMS features are unaffected.</p></div></div>';
  }
  function renderError(message){
    const el=root();if(!el)return;
    el.innerHTML='<div class="tournament-setup-card"><div class="tournament-setup-icon error">!</div><div><div class="eyebrow">TOURNAMENT</div><h2>Unable to load tournaments</h2><p>'+escT(message)+'</p><button class="secondary" type="button" onclick="SCMSTournament.refresh()">Try Again</button></div></div>';
  }

  function statCard(label,value,sub,extra){return '<div class="tournament-stat-card '+escT(extra||'')+'"><span>'+escT(label)+'</span><strong>'+escT(value)+'</strong><small>'+escT(sub)+'</small></div>';}
  function emptyList(text){return '<div class="tournament-empty-list">'+escT(text)+'</div>';}

  function tournamentCard(t){
    return '<button class="tournament-list-card" type="button" onclick="SCMSTournament.open(\''+escT(t.tournament_id)+'\')"><span class="tournament-card-mark">'+(t.status==='active'?'●':'T')+'</span><span class="tournament-card-copy"><strong>'+escT(t.name)+'</strong><small>'+escT(formatLabel(t.format))+' · '+escT(dateLabel(t.event_date))+'</small></span><span class="tournament-card-status '+statusClass(t.status)+'">'+escT(statusLabel(t.status))+'</span><span class="tournament-card-arrow">›</span></button>';
  }

  function activeCard(t){
    return '<div class="tournament-active-card"><div class="tournament-active-glow"></div><div class="tournament-active-copy"><div class="eyebrow">● ACTIVE TOURNAMENT</div><h2>'+escT(t.name)+'</h2><p>'+escT(formatLabel(t.format))+' · '+escT(dateLabel(t.event_date))+'</p></div><div class="tournament-active-meta"><strong>'+escT(t.current_round||0)+' / '+escT(t.rounds_total||'-')+'</strong><span>Current Round</span></div><button class="primary" type="button" onclick="SCMSTournament.open(\''+escT(t.tournament_id)+'\')">Open Tournament</button></div>';
  }

  function renderHome(){
    const el=root();if(!el)return;
    const active=state.tournaments.find(function(t){return t.status==='active';});
    const drafts=state.tournaments.filter(function(t){return ['draft','ready'].includes(t.status);});
    const completed=state.tournaments.filter(function(t){return ['completed','archived'].includes(t.status);});
    el.innerHTML='<div class="tournament-page-head"><div><div class="eyebrow">COMPETITION MANAGEMENT</div><h2>Tournaments</h2><p>Create, run, score and archive your Scrabble tournaments from one workspace.</p></div><button class="primary" type="button" onclick="SCMSTournament.create()">＋ Create Tournament</button></div>'+
      '<div class="tournament-stat-grid">'+statCard('ACTIVE',active?'1':'0','Tournament in progress',active?'active':'')+statCard('DRAFTS',String(drafts.length),'Ready to configure','')+statCard('COMPLETED',String(completed.length),'Tournament history','')+statCard('TOTAL',String(state.tournaments.length),'All tournament records','')+'</div>'+
      (active?activeCard(active):'<div class="tournament-empty-active"><div class="tournament-empty-icon">◎</div><div><div class="eyebrow">NO ACTIVE TOURNAMENT</div><h3>Ready for your next competition?</h3><p>Create a tournament, choose your players manually, set the format and start when you are ready.</p></div><button class="secondary" type="button" onclick="SCMSTournament.create()">Create Tournament</button></div>')+
      '<div class="tournament-section-head"><div><div class="eyebrow">WORKSPACE</div><h3>Draft & Ready</h3></div><span class="badge blue">'+drafts.length+'</span></div><div class="tournament-list">'+(drafts.map(tournamentCard).join('')||emptyList('No draft tournaments.'))+'</div>'+
      '<div class="tournament-section-head"><div><div class="eyebrow">HISTORY</div><h3>Completed & Archived</h3></div><span class="badge blue">'+completed.length+'</span></div><div class="tournament-list">'+(completed.slice(0,12).map(tournamentCard).join('')||emptyList('No completed tournaments yet.'))+'</div>';
  }

  async function open(id){
    const tournament=state.tournaments.find(function(t){return String(t.tournament_id)===String(id);});
    if(!tournament)return;
    state.selected=tournament;state.view='overview';state.roundFocus=null;
    try{await loadTournamentData(id);renderWorkspace();}catch(error){notifyT(error.message||String(error),'error','Tournament Could Not Open',{variant:'critical'});}
  }

  async function loadTournamentData(id){
    const results=await Promise.all([
      supabaseClient.from('tournament_players').select('*').eq('tournament_id',id).order('seed'),
      supabaseClient.from('tournament_rounds').select('*').eq('tournament_id',id).order('round_number'),
      supabaseClient.from('tournament_matches').select('*').eq('tournament_id',id).order('round_number').order('match_number'),
      supabaseClient.from('tournament_awards').select('*').eq('tournament_id',id).order('rank')
    ]);
    for(const r of results){if(r.error)throw r.error;}
    state.players=results[0].data||[];state.rounds=results[1].data||[];state.matches=results[2].data||[];state.awards=results[3].data||[];state.standings=calculateStandings();
  }

  function workspaceTabs(){return ['overview','pairings','standings','players','rounds','settings'].map(function(tab){return '<button type="button" class="tournament-tab '+(state.view===tab?'active':'')+'" onclick="SCMSTournament.tab(\''+tab+'\')">'+tab[0].toUpperCase()+tab.slice(1)+'</button>';}).join('');}

  function renderWorkspace(){
    const el=root();if(!el||!state.selected)return;
    const t=state.selected;
    el.innerHTML='<div class="tournament-workspace-head"><button class="secondary tournament-back" type="button" onclick="SCMSTournament.back()">← Tournaments</button><div class="tournament-workspace-title"><div><div class="eyebrow">'+escT(statusLabel(t.status))+' · '+escT(formatLabel(t.format))+'</div><h2>'+escT(t.name)+'</h2><p>'+escT(dateLabel(t.event_date))+(t.start_time?' · '+escT(t.start_time):'')+'</p></div><span class="tournament-big-status '+statusClass(t.status)+'">'+escT(statusLabel(t.status))+'</span></div></div><div class="tournament-tabs">'+workspaceTabs()+'</div><div class="tournament-workspace-body">'+renderTabContent()+'</div>';
  }

  function renderTabContent(){if(state.view==='pairings')return renderPairings();if(state.view==='standings')return renderStandings();if(state.view==='players')return renderPlayers();if(state.view==='rounds')return renderRounds();if(state.view==='settings')return renderSettings();return renderOverview();}

  function controlButtons(t){
    if(t.status==='draft'||t.status==='ready')return '<button class="secondary" type="button" onclick="SCMSTournament.editParticipants()">Manage Participants</button><button class="secondary" type="button" onclick="SCMSTournament.seedParticipants()">Seed Players</button><button class="primary" type="button" onclick="SCMSTournament.start()">Start Tournament</button>';
    if(t.status==='active')return '<button class="secondary" type="button" onclick="SCMSTournament.tab(\'pairings\')">Open Pairings</button><button class="primary" type="button" onclick="SCMSTournament.finish()">End Tournament</button>';
    if(t.status==='completed')return '<button class="secondary" type="button" onclick="SCMSTournament.reopen()">Reopen</button><button class="primary" type="button" onclick="SCMSTournament.archive()">Archive Tournament</button>';
    return '<button class="secondary" type="button" onclick="SCMSTournament.reopen()">Reopen Tournament</button>';
  }

  function overviewNext(t){
    if(t.status==='draft'||t.status==='ready')return '<div class="tournament-step-row"><span>1</span><div><b>Confirm participants</b><small>Only students you explicitly select will be entered.</small></div></div><div class="tournament-step-row"><span>2</span><div><b>Start the tournament</b><small>The system creates the first round and pairings.</small></div></div>';
    if(t.status==='active')return '<div class="tournament-step-row"><span>1</span><div><b>Report results</b><small>Enter each completed Scrabble score.</small></div></div><div class="tournament-step-row"><span>2</span><div><b>Generate the next round</b><small>Pairings update from the selected format.</small></div></div><div class="tournament-step-row"><span>3</span><div><b>Finalize awards</b><small>Placement is automatic; special awards are teacher-selected.</small></div></div>';
    return '<div class="tournament-step-row"><span>✓</span><div><b>Final results preserved</b><small>Participants, rounds, scores, rankings and awards remain attached to this tournament.</small></div></div>';
  }

  function awardMiniList(){
    const map={};state.awards.forEach(function(a){map[a.award_type]=a;});
    const names=['1st Place','2nd Place','3rd Place','Most Improved Player Award','Strategic Player Award','Fighting Spirit Award'];
    return '<div class="tournament-award-mini">'+names.map(function(name){const a=map[name];return '<div><span>'+escT(name)+'</span><b>'+escT(a?a.student_name||'Recorded':'Pending')+'</b></div>';}).join('')+'</div>';
  }

  function renderOverview(){
    const t=state.selected,completed=state.matches.filter(function(m){return m.status==='completed';}).length,total=state.matches.length,leader=state.standings[0];
    return '<div class="tournament-overview-grid"><div class="tournament-overview-main"><div class="tournament-hero-panel"><div><div class="eyebrow">TOURNAMENT CONTROL</div><h3>'+escT(t.name)+'</h3><p>'+escT(t.description||'Scrabble tournament workspace')+'</p></div><div class="tournament-control-actions">'+controlButtons(t)+'</div></div><div class="tournament-work-metrics">'+statCard('PLAYERS',String(state.players.length),'Selected manually','')+statCard('MATCHES',String(total),String(completed)+' completed','')+statCard('OPEN',String(total-completed),'Awaiting results','')+statCard('LEADER',leader?leader.display_name:'—','Current ranking','')+'</div><div class="panel tournament-next-panel"><div class="row"><div><div class="eyebrow">NEXT ACTION</div><h3>'+((t.status==='draft'||t.status==='ready')?'Prepare the participant list.':t.status==='active'?'Continue reporting match results.':'Review the final tournament record.')+'</h3></div></div><div class="tournament-next-copy">'+overviewNext(t)+'</div></div></div><div class="tournament-overview-side"><div class="panel"><div class="eyebrow">FORMAT</div><h3>'+escT(formatLabel(t.format))+'</h3><div class="tournament-detail-lines"><div><span>Rounds</span><b>'+escT(t.rounds_total||'Auto')+'</b></div><div><span>Current</span><b>'+escT(t.current_round||0)+'</b></div><div><span>Players</span><b>'+escT(state.players.length)+'</b></div></div></div><div class="panel"><div class="eyebrow">FINAL AWARDS</div><h3>Placement & Special Awards</h3><p class="subtle">1st, 2nd and 3rd follow the final ranking. The three special awards are selected by you.</p>'+awardMiniList()+'</div></div></div>'+
      (t.status==='completed'||t.status==='archived'?specialAwardForm():'');
  }

  function playerName(id){const p=state.players.find(function(x){return String(x.player_id)===String(id);});return p?p.display_name:(id?'Unknown player':'BYE');}

  function renderPairings(){
    const currentRound=Number(state.selected?.current_round||1);
    const matches=state.matches.filter(function(m){return Number(m.round_number)===currentRound;});
    if(!matches.length)return '<div class="panel tournament-empty-panel"><div class="eyebrow">LIVE PAIRINGS</div><h3>No live round is available</h3><p class="subtle">Start the tournament or finish the previous round to generate the next pairings.</p></div>';
    const completed=matches.filter(function(m){return m.status==='completed';}).length;
    const allComplete=completed===matches.length;
    const roundRecord=state.rounds.find(function(r){return Number(r.round_number)===currentRound;});
    const finished=roundRecord&&roundRecord.status==='completed';
    return '<div class="tournament-live-head"><div><div class="eyebrow">LIVE ROUND</div><h3>Round '+escT(currentRound)+'</h3><p>Only the current round is shown here. Completed rounds are available in the Rounds panel.</p></div><div class="tournament-live-actions"><span class="badge '+(allComplete?'present':'almost')+'">'+completed+'/'+matches.length+' complete</span><button class="primary" type="button" '+(!allComplete?'disabled':'')+' onclick="SCMSTournament.finishRound()">'+(currentRound>=Number(state.selected.rounds_total||1)?'Finish Final Round':'Finish Round')+' →</button></div></div>'+
      '<div class="panel tournament-round-panel live-round-panel"><div class="tournament-match-list">'+matches.map(matchCard).join('')+'</div></div>'+
      (allComplete?'<div class="tournament-finish-hint"><strong>Round ready to finish.</strong><span>Review all results above, then click Finish Round. The next round will be created only after you confirm. The next live round will open automatically in Pairings.</span></div>':'');
  }

  function matchCard(m){
    const p1=playerName(m.player1_id),p2=playerName(m.player2_id),completed=m.status==='completed',winner=m.winner_player_id?String(m.winner_player_id):'';
    const action=completed?'<button class="secondary small" type="button" onclick="SCMSTournament.score(\''+escT(m.match_id)+'\')">Edit Result</button>':m.player1_id&&m.player2_id?'<button class="secondary" type="button" onclick="SCMSTournament.score(\''+escT(m.match_id)+'\')">Report Score</button>':'<span class="badge blue">BYE</span>';
    return '<div class="tournament-match-card '+(completed?'is-complete':'')+'"><div class="tournament-match-number">#'+escT(m.match_number)+'</div><div class="tournament-match-players"><div class="'+(winner&&winner===String(m.player1_id)?'winner':'')+'"><span>'+escT(p1)+'</span><b>'+(m.player1_score==null?'—':escT(m.player1_score))+'</b></div><div class="tournament-vs">VS</div><div class="'+(winner&&winner===String(m.player2_id)?'winner':'')+'"><span>'+escT(p2)+'</span><b>'+(m.player2_score==null?'—':escT(m.player2_score))+'</b></div></div><div class="tournament-match-side">'+(m.table_label?'<small>'+escT(m.table_label)+'</small>':'')+action+'</div></div>';
  }

  function calculateStandings(){
    const map={};
    state.players.forEach(function(p){map[p.player_id]={player_id:p.player_id,student_id:p.student_id,display_name:p.display_name,seed:Number(p.seed)||999,wins:0,losses:0,ties:0,points:0,score_for:0,score_against:0,score_diff:0};});
    state.matches.filter(function(m){return m.status==='completed';}).forEach(function(m){
      const a=map[m.player1_id],b=map[m.player2_id],sa=Number(m.player1_score),sb=Number(m.player2_score);
      if(a&&Number.isFinite(sa))a.score_for+=sa;
      if(a&&Number.isFinite(sb))a.score_against+=sb;
      if(b&&Number.isFinite(sb))b.score_for+=sb;
      if(b&&Number.isFinite(sa))b.score_against+=sa;
      if(!m.winner_player_id){if(a)a.ties++;if(b)b.ties++;return;}
      const w=map[m.winner_player_id],l=w&&String(w.player_id)===String(m.player1_id)?b:a;
      if(w){w.wins++;w.points+=1;}
      if(l)l.losses++;
    });
    Object.values(map).forEach(function(p){p.score_diff=p.score_for-p.score_against;});
    return Object.values(map).sort(function(a,b){return b.points-a.points||b.wins-a.wins||b.score_diff-a.score_diff||a.seed-b.seed||a.display_name.localeCompare(b.display_name);});
  }

  function renderStandings(){
    const rows=calculateStandings();
    return '<div class="panel"><div class="tournament-table-head"><div><div class="eyebrow">LIVE RANKING</div><h3>Standings</h3><p class="subtle">Wins, losses, ties, points and score differential are recalculated from recorded results.</p></div><span class="badge blue">'+rows.length+' players</span></div><div class="scroll"><table class="tournament-table"><thead><tr><th>Rank</th><th>Player</th><th>W</th><th>L</th><th>T</th><th>Points</th><th>Score Diff</th></tr></thead><tbody>'+rows.map(function(p,i){return '<tr><td><strong>'+(i+1)+'</strong></td><td><strong>'+escT(p.display_name)+'</strong><small>'+escT(p.student_id)+'</small></td><td>'+p.wins+'</td><td>'+p.losses+'</td><td>'+p.ties+'</td><td>'+p.points+'</td><td>'+(p.score_diff>=0?'+':'')+p.score_diff+'</td></tr>';}).join('')+'</tbody></table></div></div>';
  }

  function renderPlayers(){
    return '<div class="panel"><div class="tournament-table-head"><div><div class="eyebrow">PARTICIPANTS</div><h3>Selected Players</h3><p class="subtle">Participants are chosen manually from your SCMS student list.</p></div><span class="badge blue">'+state.players.length+' selected</span></div><div class="scroll"><table class="tournament-table"><thead><tr><th>Seed</th><th>Player</th><th>Status</th><th>Record</th><th>Action</th></tr></thead><tbody>'+state.players.map(function(p){const standing=state.standings.find(function(x){return String(x.player_id)===String(p.player_id);})||{};return '<tr><td><strong>'+escT(p.seed)+'</strong></td><td><strong>'+escT(p.display_name)+'</strong><small>'+escT(p.student_id)+'</small></td><td><span class="badge blue">'+escT(p.status||'active')+'</span></td><td>'+(standing.wins||0)+'W · '+(standing.losses||0)+'L</td><td>'+((state.selected.status==='draft'||state.selected.status==='ready')?'<button class="secondary small" type="button" onclick="SCMSTournament.removePlayer(\''+escT(p.player_id)+'\')">Remove</button>':'—')+'</td></tr>';}).join('')+'</tbody></table></div></div>';
  }

  function renderRounds(){
    if(!state.rounds.length)return '<div class="panel"><div class="empty">No rounds yet.</div></div>';
    const selectedRound=state.roundFocus?Number(state.roundFocus):null;
    const cards=state.rounds.map(function(r){
      const matches=state.matches.filter(function(m){return Number(m.round_number)===Number(r.round_number);});
      const done=matches.filter(function(m){return m.status==='completed';}).length;
      const isLive=Number(r.round_number)===Number(state.selected.current_round)&&state.selected.status==='active';
      return '<button type="button" class="tournament-round-summary '+(selectedRound===Number(r.round_number)?'selected':'')+'" onclick="SCMSTournament.viewRound('+Number(r.round_number)+')"><div class="row"><div><div class="eyebrow">ROUND '+escT(r.round_number)+'</div><h3>'+escT(isLive?'Live Round':statusLabel(r.status))+'</h3></div><span class="badge '+(r.status==='completed'?'present':isLive?'blue':'neutral')+'">'+(r.status==='completed'?'Completed':isLive?'Live':'Scheduled')+'</span></div><div class="tournament-round-summary-stat"><strong>'+done+'/'+matches.length+'</strong><span>matches complete</span></div><small>'+escT(r.created_at?dateLabel(r.created_at.slice(0,10)):'')+'</small></button>';
    }).join('');
    let detail='';
    if(selectedRound){
      const r=state.rounds.find(function(x){return Number(x.round_number)===selectedRound;});
      const matches=state.matches.filter(function(m){return Number(m.round_number)===selectedRound;});
      const completed=r&&r.status==='completed';
      detail='<div class="panel tournament-round-detail"><div class="tournament-round-detail-head"><div><div class="eyebrow">'+(completed?'VIEWING MODE':'ROUND DETAIL')+'</div><h3>Round '+escT(selectedRound)+'</h3><p class="subtle">'+(completed?'This round is complete. Review or edit any recorded result.':'This is the current round. Use Pairings for live match control.')+'</p></div><button class="secondary" type="button" onclick="SCMSTournament.clearRoundView()">Back to Rounds</button></div><div class="tournament-viewing-banner">'+(completed?'🔒 Completed round · No pairing actions are available here.':'● Live round · Match actions are managed from Pairings.')+'</div><div class="tournament-match-list">'+matches.map(matchCard).join('')+'</div></div>';
    }
    return '<div class="tournament-rounds-head"><div><div class="eyebrow">ROUND HISTORY</div><h3>Rounds</h3><p class="subtle">Select any round to inspect its complete record. Completed rounds open in viewing mode.</p></div></div><div class="tournament-round-grid">'+cards+'</div>'+detail;
  }

  function renderSettings(){
    const t=state.selected;
    const completed=state.matches.filter(function(m){return m.status==='completed';}).length;
    const total=state.matches.length;
    const locked=!['draft','ready'].includes(t.status);
    return '<div class="tournament-settings-shell">'+
      '<div class="tournament-settings-hero"><div><div class="eyebrow">TOURNAMENT CONTROL CENTER</div><h3>'+escT(t.name)+'</h3><p>Manage the competition identity, format rules and record protection from one place.</p></div><span class="tournament-big-status '+statusClass(t.status)+'">'+escT(statusLabel(t.status))+'</span></div>'+
      '<div class="tournament-settings-grid premium">'+
        '<div class="tournament-setting-card"><span>Competition</span><b>'+escT(t.name)+'</b><small>Official tournament name</small></div>'+
        '<div class="tournament-setting-card"><span>Format</span><b>'+escT(formatLabel(t.format))+'</b><small>Pairing engine</small></div>'+
        '<div class="tournament-setting-card"><span>Schedule</span><b>'+escT(dateLabel(t.event_date))+'</b><small>'+(t.start_time?escT(t.start_time):'Start time not set')+'</small></div>'+
        '<div class="tournament-setting-card"><span>Round Plan</span><b>'+escT(t.rounds_total||'Auto')+'</b><small>Maximum scheduled rounds</small></div>'+
      '</div>'+
      '<div class="tournament-settings-columns">'+
        '<div class="panel tournament-settings-section"><div class="eyebrow">LIVE RECORD</div><h3>Competition Status</h3><div class="tournament-settings-lines"><div><span>Current round</span><strong>'+escT(t.current_round||0)+'</strong></div><div><span>Players</span><strong>'+escT(state.players.length)+'</strong></div><div><span>Results recorded</span><strong>'+completed+' / '+total+'</strong></div><div><span>Rounds completed</span><strong>'+state.rounds.filter(function(r){return r.status==='completed';}).length+'</strong></div></div></div>'+
        '<div class="panel tournament-settings-section"><div class="eyebrow">RULES</div><h3>Scoring & Pairing</h3><div class="tournament-rule-list"><div><span>Game</span><strong>Scrabble</strong></div><div><span>Result</span><strong>Higher score wins</strong></div><div><span>Tie</span><strong>Recorded as tie</strong></div><div><span>Participant mode</span><strong>Manual selection</strong></div></div></div>'+
      '</div>'+
      '<div class="panel tournament-settings-section tournament-settings-note"><div class="eyebrow">RECORD SAFETY</div><h3>'+(locked?'Protected tournament record':'Editable setup')+'</h3><p>'+(locked?'The competition identity and format are preserved once play has started. Match results remain editable so corrections can be made without losing the tournament history.':'You can edit the tournament setup before starting the first round.')+'</p>'+(locked?'':'<button class="primary" type="button" onclick="SCMSTournament.editTournament()">Edit Tournament Setup</button>')+
      (t.status==='active'?'<div class="tournament-danger-zone"><div><div class="eyebrow">EMERGENCY CONTROL</div><h4>End Tournament Immediately</h4><p>Stops the competition now and preserves all results already recorded. Unfinished matches remain incomplete.</p></div><button class="danger" type="button" onclick="SCMSTournament.immediateEnd()">End Immediately</button></div>':'')+
      (t.status==='completed'&&t.settings&&t.settings.ended_early?'<div class="tournament-danger-zone delete-zone"><div><div class="eyebrow">PERMANENT ACTION</div><h4>Delete Ended Tournament</h4><p>Permanently removes this tournament and its tournament records. This cannot be undone.</p></div><button class="danger" type="button" onclick="SCMSTournament.deleteTournament()">Delete Tournament</button></div>':'')+
      '</div>'+
    '</div>';
  }

  function tab(name){state.view=name;if(name!=='rounds')state.roundFocus=null;renderWorkspace();}
  function viewRound(roundNumber){state.view='rounds';state.roundFocus=Number(roundNumber);renderWorkspace();}
  function clearRoundView(){state.roundFocus=null;renderWorkspace();}

  function showModal(html){
    const modal=document.getElementById('modal'),content=document.getElementById('modalContent');
    if(!modal||!content)return;
    content.innerHTML=html;modal.classList.add('show');
  }
  function closeModal(){const modal=document.getElementById('modal'),content=document.getElementById('modalContent');if(modal)modal.classList.remove('show');if(content)content.innerHTML='';}

  function create(){
    const defaultDate=new Date().toISOString().slice(0,10);
    showModal('<div class="tournament-create-modal">'+
      '<div class="tournament-create-hero">'+
        '<div class="tournament-create-icon">T</div>'+
        '<div class="tournament-create-heading"><div class="eyebrow">TOURNAMENT SETUP</div><h2>Create Tournament</h2><p>Build your competition, choose the players and prepare the event before you start the first round.</p></div>'+
        '<button class="tournament-modal-close" type="button" aria-label="Close" onclick="SCMSTournament.closeModal()">×</button>'+
      '</div>'+
      '<form id="tournamentCreateForm" class="tournament-form tournament-create-form">'+
        '<section class="tournament-form-section">'+
          '<div class="tournament-form-section-head"><span>01</span><div><strong>Competition details</strong><small>Give the tournament its identity and schedule.</small></div></div>'+
          '<div class="tournament-form-grid">'+
            '<div class="tournament-field full"><label for="tName">Tournament Name</label><input id="tName" required placeholder="October Friendly Scrabble Tournament"></div>'+
            '<div class="tournament-field"><label for="tDate">Event Date</label><input id="tDate" type="date" value="'+defaultDate+'" required></div>'+
            '<div class="tournament-field"><label for="tTime">Start Time</label><input id="tTime" type="time" value="10:00"></div>'+
          '</div>'+
        '</section>'+
        '<section class="tournament-form-section">'+
          '<div class="tournament-form-section-head"><span>02</span><div><strong>Competition format</strong><small>Choose how rounds and pairings will be managed.</small></div></div>'+
          '<div class="tournament-format-grid">'+
            '<label class="tournament-format-option selected"><input type="radio" name="tFormatChoice" value="swiss" checked onchange="document.getElementById(\'tFormat\').value=this.value;SCMSTournament.formatChanged();"><span class="tournament-format-icon">S</span><span><b>Swiss</b><small>Players continue across rounds without elimination.</small></span></label>'+
            '<label class="tournament-format-option"><input type="radio" name="tFormatChoice" value="round_robin" onchange="document.getElementById(\'tFormat\').value=this.value;SCMSTournament.formatChanged();"><span class="tournament-format-icon">R</span><span><b>Round Robin</b><small>Players meet across a complete round schedule.</small></span></label>'+
            '<label class="tournament-format-option"><input type="radio" name="tFormatChoice" value="single_elimination" onchange="document.getElementById(\'tFormat\').value=this.value;SCMSTournament.formatChanged();"><span class="tournament-format-icon">E</span><span><b>Single Elimination</b><small>Players progress through a knockout bracket.</small></span></label>'+
          '</div>'+
          '<select id="tFormat" class="tournament-format-hidden" aria-hidden="true"><option value="swiss">Swiss</option><option value="round_robin">Round Robin</option><option value="single_elimination">Single Elimination</option></select>'+
          '<div class="tournament-round-setting"><div><label for="tRounds">Number of Rounds</label><small>How many rounds should be scheduled?</small></div><input id="tRounds" type="number" min="1" max="20" value="5"></div>'+
        '</section>'+
        '<section class="tournament-form-section">'+
          '<div class="tournament-form-section-head"><span>03</span><div><strong>Participants</strong><small>Select exactly which SCMS students will compete.</small></div><span class="badge blue" id="selectedPlayerCount">0 selected</span></div>'+
          '<div class="tournament-participant-builder tournament-participant-builder-new">'+
            '<div class="tournament-participant-toolbar"><div class="tournament-search-wrap"><span>⌕</span><input id="participantSearch" class="search grow" placeholder="Search student name or ID" oninput="SCMSTournament.filterParticipants()"></div><button type="button" class="secondary" onclick="SCMSTournament.selectAllParticipants()">Select All</button><button type="button" class="secondary" onclick="SCMSTournament.clearParticipants()">Clear</button></div>'+
            '<div id="participantChecklist" class="tournament-participant-list">'+participantChecklist('')+'</div>'+
          '</div>'+
        '</section>'+
        '<section class="tournament-form-section">'+
          '<div class="tournament-form-section-head"><span>04</span><div><strong>Event note</strong><small>Optional information for your tournament record.</small></div></div>'+
          '<div class="tournament-field"><label for="tDescription">Description</label><textarea id="tDescription" placeholder="Friendly monthly Scrabble tournament"></textarea></div>'+
        '</section>'+
        '<div class="tournament-form-footer tournament-create-footer"><div class="tournament-footer-note"><span>●</span><div><strong>Draft first, start when ready</strong><small>You can manage participants and seeding before the tournament begins.</small></div></div><div class="tournament-footer-actions"><button type="button" class="secondary" onclick="SCMSTournament.closeModal()">Cancel</button><button class="primary" type="submit">Create Tournament <span>→</span></button></div></div>'+
      '</form>'+
    '</div>');
    document.querySelectorAll('input[name="tFormatChoice"]').forEach(function(input){input.addEventListener('change',function(){document.querySelectorAll('.tournament-format-option').forEach(function(option){option.classList.toggle('selected',option.querySelector('input').checked);});});});
    document.getElementById('tournamentCreateForm').onsubmit=function(e){e.preventDefault();saveCreate();};
  }

  function participantChecklist(filter){
    const f=String(filter||'').toLowerCase();
    return state.students.filter(function(s){return !f||String(s.student_name||'').toLowerCase().includes(f)||String(s.student_id||'').toLowerCase().includes(f);}).map(function(s){return '<label class="tournament-participant-option"><input type="checkbox" value="'+escT(s.student_id)+'"><span><strong>'+escT(s.student_name)+'</strong><small>'+escT(s.student_id)+' · '+escT(s.normal_class_time||'Class time not recorded')+'</small></span></label>';}).join('')||'<div class="empty">No matching active students.</div>';
  }

  function filterParticipants(){
    const input=document.getElementById('participantSearch'),list=document.getElementById('participantChecklist');if(!input||!list)return;
    const selected=[...document.querySelectorAll('#participantChecklist input:checked')].map(function(x){return x.value;});
    list.innerHTML=participantChecklist(input.value);
    selected.forEach(function(id){const box=[...list.querySelectorAll('input')].find(function(x){return x.value===id;});if(box)box.checked=true;});
    updateSelectedCount();
  }
  function updateSelectedCount(){const count=document.getElementById('selectedPlayerCount');if(count)count.textContent=document.querySelectorAll('#participantChecklist input:checked').length+' selected';}
  function selectAllParticipants(){document.querySelectorAll('#participantChecklist input').forEach(function(x){x.checked=true;});updateSelectedCount();}
  function clearParticipants(){document.querySelectorAll('#participantChecklist input').forEach(function(x){x.checked=false;});updateSelectedCount();}
  function formatChanged(){const format=document.getElementById('tFormat')?.value,rounds=document.getElementById('tRounds');if(!rounds)return;if(format==='round_robin')rounds.value=Math.max(1,state.students.length-1);else if(format==='single_elimination')rounds.value=1;else if(format==='free_for_all')rounds.value=1;else rounds.value=5;}

  async function saveCreate(){
    const ids=[...document.querySelectorAll('#participantChecklist input:checked')].map(function(x){return x.value;});
    if(ids.length<2){notifyT('Select at least two students before creating a tournament.','warning','Participants');return;}
    const name=document.getElementById('tName').value.trim();if(!name){notifyT('Enter a tournament name.','warning','Tournament Name');return;}
    const format=document.getElementById('tFormat').value,rounds=Math.max(1,Number(document.getElementById('tRounds').value)||1),selectedStudents=state.students.filter(function(s){return ids.includes(String(s.student_id));});
    try{
      const user=await supabaseClient.auth.getUser();
      const payload={name:name,description:document.getElementById('tDescription').value.trim(),event_date:document.getElementById('tDate').value,start_time:document.getElementById('tTime').value||null,game:'Scrabble',format:format,status:'draft',rounds_total:rounds,current_round:0,settings:{scoring:'Scrabble points',tie_breaks:['Wins','Points','Score Differential'],participants:'manual'},created_by:user.data.user?.id||null};
      const result=await supabaseClient.from('tournaments').insert(payload).select().single();if(result.error)throw result.error;
      const rows=selectedStudents.map(function(s,i){return {tournament_id:result.data.tournament_id,student_id:String(s.student_id),display_name:s.student_name,seed:i+1,status:'active'};});
      const players=await supabaseClient.from('tournament_players').insert(rows);
      if(players.error){await supabaseClient.from('tournaments').delete().eq('tournament_id',result.data.tournament_id);throw players.error;}
      closeModal();await loadTournaments();notifyT('Tournament created with '+ids.length+' manually selected participants.','success','Tournament Created',{variant:'registration'});open(result.data.tournament_id);
    }catch(error){notifyT(error.message||String(error),'error','Tournament Not Created',{variant:'critical'});}
  }

  async function editParticipants(){
    if(!state.selected||!['draft','ready'].includes(state.selected.status))return;
    const current=new Set(state.players.map(function(p){return String(p.student_id);}));
    showModal('<div class="tournament-modal-head"><div><div class="eyebrow">PARTICIPANT MANAGEMENT</div><h2>Manage Participants</h2><p>Only the students you tick will remain in this tournament.</p></div><button class="parent-close-button" type="button" onclick="SCMSTournament.closeModal()">×</button></div><div class="tournament-participant-builder"><div class="tournament-participant-toolbar"><input id="participantSearch" class="search grow" placeholder="Search student name or ID" oninput="SCMSTournament.filterParticipants()"><button type="button" class="secondary" onclick="SCMSTournament.selectAllParticipants()">Select All</button><button type="button" class="secondary" onclick="SCMSTournament.clearParticipants()">Clear All</button></div><div id="participantChecklist" class="tournament-participant-list">'+participantChecklist('')+'</div></div><div class="tournament-form-footer"><button type="button" class="secondary" onclick="SCMSTournament.closeModal()">Cancel</button><button class="primary" type="button" onclick="SCMSTournament.saveParticipants()">Save Participants</button></div>');
    document.querySelectorAll('#participantChecklist input').forEach(function(box){if(current.has(box.value))box.checked=true;});updateSelectedCount();
  }

  
  function seedParticipants(){
    if(!state.selected||!['draft','ready'].includes(state.selected.status))return;
    const rows=state.players.slice().sort(function(a,b){return Number(a.seed)-Number(b.seed);});
    showModal('<div class="tournament-modal-head"><div><div class="eyebrow">SEEDING</div><h2>Arrange Seed Order</h2><p>Seed 1 is the first seed. Use the arrows to place players exactly where you want them before the tournament starts.</p></div><button class="parent-close-button" type="button" onclick="SCMSTournament.closeModal()">×</button></div><div id="seedList" class="tournament-seed-list">'+rows.map(function(p,i){return seedRow(p,i);}).join('')+'</div><div class="tournament-form-footer"><button type="button" class="secondary" onclick="SCMSTournament.closeModal()">Cancel</button><button class="primary" type="button" onclick="SCMSTournament.saveSeeding()">Save Seeding</button></div>');
  }
  function seedRow(p,index){
    return '<div class="tournament-seed-row" data-seed-player="'+escT(p.player_id)+'"><span class="tournament-seed-number">'+(index+1)+'</span><strong>'+escT(p.display_name)+'</strong><small>'+escT(p.student_id)+'</small><div><button type="button" class="secondary small" '+(index===0?'disabled':'')+' onclick="SCMSTournament.moveSeed('+index+',-1)">↑</button><button type="button" class="secondary small" '+(index===state.players.length-1?'disabled':'')+' onclick="SCMSTournament.moveSeed('+index+',1)">↓</button></div></div>';
  }
  function moveSeed(index,direction){
    const list=[...document.querySelectorAll('[data-seed-player]')];
    const target=index+direction;if(target<0||target>=list.length)return;
    if(direction<0)list[index].parentNode.insertBefore(list[index],list[target]);else list[index].parentNode.insertBefore(list[target],list[index]);
    [...document.querySelectorAll('[data-seed-player]')].forEach(function(row,i){row.querySelector('.tournament-seed-number').textContent=i+1;row.querySelectorAll('button').forEach(function(btn){btn.disabled=false;});});
  }
  async function saveSeeding(){
    try{
      const rows=[...document.querySelectorAll('[data-seed-player]')];
      for(let i=0;i<rows.length;i++){const result=await supabaseClient.from('tournament_players').update({seed:i+1}).eq('player_id',rows[i].getAttribute('data-seed-player'));if(result.error)throw result.error;}
      closeModal();await open(state.selected.tournament_id);notifyT('Seed order saved. Pairings will use this order.','success','Seeding Saved');
    }catch(error){notifyT(error.message||String(error),'error','Seeding Not Saved',{variant:'critical'});}
  }

async function saveParticipants(){
    const ids=[...document.querySelectorAll('#participantChecklist input:checked')].map(function(x){return x.value;});
    if(ids.length<2){notifyT('At least two participants are required.','warning','Participants');return;}
    try{
      const del=await supabaseClient.from('tournament_players').delete().eq('tournament_id',state.selected.tournament_id);if(del.error)throw del.error;
      const rows=state.students.filter(function(s){return ids.includes(String(s.student_id));}).map(function(s,i){return {tournament_id:state.selected.tournament_id,student_id:String(s.student_id),display_name:s.student_name,seed:i+1,status:'active'};});
      const result=await supabaseClient.from('tournament_players').insert(rows);if(result.error)throw result.error;
      closeModal();await open(state.selected.tournament_id);notifyT('Participants updated.','success','Participants Saved');
    }catch(error){notifyT(error.message||String(error),'error','Participants Not Saved',{variant:'critical'});}
  }

  async function removePlayer(id){
    if(!state.selected||!['draft','ready'].includes(state.selected.status))return;
    if(!(await confirmT('Remove this student from the tournament participant list?','Remove Participant')))return;
    const result=await supabaseClient.from('tournament_players').delete().eq('player_id',id);
    if(result.error){notifyT(result.error.message,'error','Participant Not Removed',{variant:'critical'});return;}
    await open(state.selected.tournament_id);
  }

  function previousOpponentSet(){
    const set=new Set();
    state.matches.forEach(function(m){if(m.player1_id&&m.player2_id){set.add(String(m.player1_id)+'|'+String(m.player2_id));set.add(String(m.player2_id)+'|'+String(m.player1_id));}});
    return set;
  }

  function swissPairs(roundNumber,players){
    if(roundNumber===1){
      const half=Math.ceil(players.length/2),top=players.slice(0,half),bottom=players.slice(half),pairs=[];
      for(let i=0;i<top.length;i++)pairs.push({players:[top[i].player_id,bottom[i]?.player_id||null]});
      return pairs;
    }
    const standings=calculateStandings(),previous=previousOpponentSet();
    const sorted=standings.map(function(s){return state.players.find(function(p){return String(p.player_id)===String(s.player_id);});}).filter(Boolean),pairs=[];
    while(sorted.length){
      const a=sorted.shift();let index=sorted.findIndex(function(x){return !previous.has(String(a.player_id)+'|'+String(x.player_id));});
      if(index<0)index=0;
      const b=sorted.splice(index,1)[0];pairs.push({players:[a.player_id,b?b.player_id:null]});
    }
    return pairs;
  }

  function roundRobinPairs(roundNumber,players){
    let list=players.map(function(p){return p.player_id;});if(list.length%2)list.push(null);
    const n=list.length,rounds=n-1,r=Number(roundNumber)-1;if(r>=rounds)return [];
    for(let i=0;i<r;i++){const fixed=list[0],rest=list.slice(1),last=rest.pop();rest.unshift(last);list=[fixed].concat(rest);}
    const pairs=[];for(let i=0;i<n/2;i++)pairs.push({players:[list[i],list[n-1-i]]});return pairs;
  }

  function eliminationPairsFromWinners(winners){
    const pairs=[];for(let i=0;i<winners.length;i+=2)pairs.push({players:[winners[i]||null,winners[i+1]||null]});return pairs;
  }

  function generatePairs(roundNumber){
    const players=state.players.slice().sort(function(a,b){return Number(a.seed)-Number(b.seed);});
    if(state.selected.format==='round_robin')return roundRobinPairs(roundNumber,players);
    if(state.selected.format==='free_for_all')return roundNumber===1?[{players:players.map(function(p){return p.player_id;})}]:[];
    if(state.selected.format==='leaderboard')return [];
    if(state.selected.format==='single_elimination'){
      if(roundNumber===1){
        const size=Math.pow(2,Math.ceil(Math.log2(players.length))),seeded=players.slice();while(seeded.length<size)seeded.push(null);
        const pairs=[];for(let i=0;i<size/2;i++)pairs.push({players:[seeded[i]?.player_id||null,seeded[size-1-i]?.player_id||null]});return pairs;
      }
      const prior=state.matches.filter(function(m){return Number(m.round_number)===Number(roundNumber)-1&&m.status==='completed';});
      return eliminationPairsFromWinners(prior.map(function(m){return m.winner_player_id;}).filter(Boolean));
    }
    return swissPairs(roundNumber,players);
  }

  async function createRoundAndMatches(roundNumber,pairs){
    const roundResult=await supabaseClient.from('tournament_rounds').insert({tournament_id:state.selected.tournament_id,round_number:roundNumber,status:'active'}).select().single();if(roundResult.error)throw roundResult.error;
    const rows=pairs.map(function(pair,i){const a=pair.players[0]||null,b=pair.players[1]||null;return {tournament_id:state.selected.tournament_id,round_id:roundResult.data.round_id,round_number:roundNumber,match_number:i+1,player1_id:a,player2_id:b,status:a&&b?'open':'completed',winner_player_id:a&&!b?a:null,player1_score:a&&!b?0:null,player2_score:b&&!a?0:null,table_label:'Table '+String(i+1).padStart(2,'0')};});
    if(rows.length){const result=await supabaseClient.from('tournament_matches').insert(rows);if(result.error)throw result.error;}
  }

  async function start(){
    const t=state.selected;if(!t||!['draft','ready'].includes(t.status))return;
    if(state.players.length<2){notifyT('Add at least two participants before starting.','warning','Tournament Not Ready');return;}
    if(state.tournaments.some(function(x){return x.status==='active'&&String(x.tournament_id)!==String(t.tournament_id);})){notifyT('Another tournament is already active. End or archive it before starting a new one.','warning','Active Tournament Exists');return;}
    if(!(await confirmT('Start the tournament now? Pairings will be generated from the selected format and participants.','Start Tournament')))return;
    try{
      const upd=await supabaseClient.from('tournaments').update({status:'active',started_at:new Date().toISOString(),current_round:1}).eq('tournament_id',t.tournament_id);if(upd.error)throw upd.error;
      const pairs=generatePairs(1);if(t.format==='leaderboard'){await supabaseClient.from('tournament_rounds').insert({tournament_id:t.tournament_id,round_number:1,status:'active'});}else await createRoundAndMatches(1,pairs);
      await loadTournaments();await open(t.tournament_id);notifyT('Tournament is now active and Round 1 is ready.','success','Tournament Started',{variant:'registration'});
    }catch(error){notifyT(error.message||String(error),'error','Tournament Could Not Start',{variant:'critical'});}
  }

  async function score(matchId){
    const m=state.matches.find(function(x){return String(x.match_id)===String(matchId);});if(!m)return;
    const editing=m.status==='completed';
    showModal('<div class="tournament-modal-head"><div><div class="eyebrow">'+(editing?'EDIT RECORDED RESULT':'REPORT RESULT')+'</div><h2>Match #'+escT(m.match_number)+'</h2><p>Round '+escT(m.round_number)+' · '+escT(m.table_label||'Table')+(editing?' · Existing result':'')+'</p></div><button class="parent-close-button" type="button" onclick="SCMSTournament.closeModal()">×</button></div><form id="tScoreForm" class="tournament-score-form"><div class="tournament-score-grid"><div><span>'+escT(playerName(m.player1_id))+'</span><input id="score1" type="number" min="0" step="1" required value="'+escT(m.player1_score==null?'':m.player1_score)+'" placeholder="0"></div><div class="tournament-score-vs">VS</div><div><span>'+escT(playerName(m.player2_id))+'</span><input id="score2" type="number" min="0" step="1" required value="'+escT(m.player2_score==null?'':m.player2_score)+'" placeholder="0"></div></div><p class="subtle">'+(editing?'You can correct this recorded result. The tournament record will be recalculated from the saved scores.':'The higher Scrabble score wins. Equal scores are recorded as a tie.')+'</p><div class="tournament-form-footer"><button type="button" class="secondary" onclick="SCMSTournament.closeModal()">Cancel</button><button class="primary" type="submit">'+(editing?'Save Correction':'Save Result')+'</button></div></form>');
    document.getElementById('tScoreForm').onsubmit=function(e){e.preventDefault();saveScore(m);};
  }

  async function saveScore(m){
    const s1=Number(document.getElementById('score1').value),s2=Number(document.getElementById('score2').value);if(!Number.isFinite(s1)||!Number.isFinite(s2)){notifyT('Enter both scores.','warning','Score Required');return;}
    const winner=s1>s2?m.player1_id:s2>s1?m.player2_id:null;
    const result=await supabaseClient.from('tournament_matches').update({player1_score:s1,player2_score:s2,winner_player_id:winner,status:'completed'}).eq('match_id',m.match_id);if(result.error){notifyT(result.error.message,'error','Result Not Saved',{variant:'critical'});return;}
    closeModal();
    await loadTournamentData(state.selected.tournament_id);
    state.view='pairings';state.roundFocus=null;renderWorkspace();
    notifyT(m.status==='completed'?'Recorded result corrected.':'Result recorded. Finish the round when all matches are complete.','success',m.status==='completed'?'Result Updated':'Result Recorded',{variant:'payment'});
  }

  async function finalizeRoundIfReady(roundNumber){
    const result=await supabaseClient.from('tournament_matches').select('*').eq('tournament_id',state.selected.tournament_id).eq('round_number',roundNumber);if(result.error)throw result.error;
    const current=result.data||[];if(!current.length||current.some(function(m){return m.status!=='completed';}))return false;
    const update=await supabaseClient.from('tournament_rounds').update({status:'completed',completed_at:new Date().toISOString()}).eq('tournament_id',state.selected.tournament_id).eq('round_number',roundNumber);if(update.error)throw update.error;
    return true;
  }

  async function finishRound(){
    const t=state.selected;if(!t||t.status!=='active')return;
    const roundNumber=Number(t.current_round||1);
    await loadTournamentData(t.tournament_id);
    const current=state.matches.filter(function(m){return Number(m.round_number)===roundNumber;});
    if(!current.length){notifyT('There are no matches in the current round.','warning','Round Not Ready');return;}
    if(current.some(function(m){return m.status!=='completed';})){notifyT('Complete every match in the live round before finishing it.','warning','Matches Still Open');return;}
    const roundRecord=state.rounds.find(function(r){return Number(r.round_number)===roundNumber;});
    if(!(await confirmT('Finish Round '+roundNumber+'? The round will be locked as complete and the next round will be created only after this confirmation.','Finish Round')))return;
    try{
      const roundResult=await finalizeRoundIfReady(roundNumber);
      const nextRound=roundNumber+1;
      if(nextRound<=Number(t.rounds_total||1)){
        let nextExists=state.rounds.some(function(r){return Number(r.round_number)===nextRound;});
        if(!nextExists){
          const pairs=generatePairs(nextRound);
          if(!pairs.length)throw new Error('The pairing engine did not produce the next round. Please check the tournament format and completed results.');
          await createRoundAndMatches(nextRound,pairs);
          nextExists=true;
        }
        if(nextExists){
          const upd=await supabaseClient.from('tournaments').update({current_round:nextRound}).eq('tournament_id',t.tournament_id);
          if(upd.error)throw upd.error;
        }
        await loadTournaments();
        const freshTournament=state.tournaments.find(function(x){return String(x.tournament_id)===String(t.tournament_id);});
        if(!freshTournament)throw new Error('The tournament could not be refreshed after finishing the round.');
        state.selected=freshTournament;
        await loadTournamentData(t.tournament_id);
        state.view='pairings';state.roundFocus=null;renderWorkspace();
        notifyT('Round '+roundNumber+' is complete. Round '+nextRound+' is now live.','success','Next Round Ready',{variant:'registration'});
      }else{
        await loadTournaments();await loadTournamentData(t.tournament_id);
        state.view='pairings';state.roundFocus=null;renderWorkspace();
        notifyT('Final round completed. Review the final standings, then end the tournament.','success','Final Round Complete',{variant:'registration'});
      }
    }catch(error){notifyT(error.message||String(error),'error','Round Could Not Finish',{variant:'critical'});}
  }

  async function immediateEnd(){
    const t=state.selected;if(!t||t.status!=='active')return;
    await loadTournamentData(t.tournament_id);
    const completedMatches=state.matches.filter(function(m){return m.status==='completed';}).length;
    if(!(await confirmT('End this tournament immediately? The current results will be preserved, unfinished matches will remain incomplete, and the tournament will be marked as ended early. A Delete Tournament option will then become available.','Immediate End Tournament')))return;
    try{
      const standings=calculateStandings();
      for(let i=0;i<standings.length;i++){
        const p=standings[i];
        const upd=await supabaseClient.from('tournament_players').update({final_rank:i+1,wins:p.wins,losses:p.losses,ties:p.ties,points:p.points,score_for:p.score_for,score_against:p.score_against}).eq('player_id',p.player_id);
        if(upd.error)throw upd.error;
      }
      const settings=Object.assign({},t.settings||{},{ended_early:true,ended_early_at:new Date().toISOString()});
      const upd=await supabaseClient.from('tournaments').update({status:'completed',completed_at:new Date().toISOString(),settings:settings}).eq('tournament_id',t.tournament_id);
      if(upd.error)throw upd.error;
      await loadTournaments();await open(t.tournament_id);
      notifyT('Tournament ended immediately. '+completedMatches+' recorded matches were preserved.','success','Tournament Ended Early',{variant:'critical'});
    }catch(error){notifyT(error.message||String(error),'error','Immediate End Failed',{variant:'critical'});}
  }

  async function deleteTournament(){
    const t=state.selected;if(!t||t.status!=='completed'||!(t.settings&&t.settings.ended_early))return;
    if(!(await confirmT('Permanently delete this ended tournament and all of its tournament records? This cannot be undone. Student records outside this tournament will not be deleted.','Delete Tournament')))return;
    try{
      const awardIds=(state.awards||[]).map(function(a){return String(a.award_id);});
      if(awardIds.length){
        const ach=await supabaseClient.from('student_achievements').delete().eq('source_type','tournament').in('source_id',awardIds);
        if(ach.error&&!/relation .*student_achievements.*does not exist|could not find the table/i.test(ach.error.message||''))throw ach.error;
      }
      const result=await supabaseClient.from('tournaments').delete().eq('tournament_id',t.tournament_id);
      if(result.error)throw result.error;
      state.selected=null;state.players=[];state.rounds=[];state.matches=[];state.awards=[];state.standings=[];
      await loadTournaments();
      notifyT('The ended tournament and its tournament records were permanently deleted.','success','Tournament Deleted');
    }catch(error){notifyT(error.message||String(error),'error','Tournament Could Not Be Deleted',{variant:'critical'});}
  }

  async function finish(){
    const t=state.selected;if(!t||t.status!=='active')return;
    const incomplete=state.matches.filter(function(m){return m.status!=='completed';});if(incomplete.length){notifyT('Complete all open matches before ending the tournament.','warning','Matches Still Open');return;}
    if(!(await confirmT('End this tournament and lock the final ranking? You can reopen it later if a result needs correction.','End Tournament')))return;
    try{
      await loadTournamentData(t.tournament_id);const standings=calculateStandings();
      for(let i=0;i<standings.length;i++){
        const p=standings[i];const upd=await supabaseClient.from('tournament_players').update({final_rank:i+1,wins:p.wins,losses:p.losses,ties:p.ties,points:p.points,score_for:p.score_for,score_against:p.score_against}).eq('player_id',p.player_id);if(upd.error)throw upd.error;
      }
      const upd=await supabaseClient.from('tournaments').update({status:'completed',completed_at:new Date().toISOString()}).eq('tournament_id',t.tournament_id);if(upd.error)throw upd.error;
      await createPlacementAwards(standings);
      await loadTournaments();await open(t.tournament_id);notifyT('Final ranking recorded. Choose the three special awards when you are ready.','success','Tournament Completed',{variant:'registration'});
    }catch(error){notifyT(error.message||String(error),'error','Tournament Could Not End',{variant:'critical'});}
  }

  async function createPlacementAwards(standings){
    const top=standings.slice(0,3),names=['1st Place','2nd Place','3rd Place'];
    const rows=top.map(function(p,i){return {tournament_id:state.selected.tournament_id,student_id:p.student_id,student_name:p.display_name,award_type:names[i],rank:i+1,title:names[i],certificate_path:null};});
    if(rows.length){const result=await supabaseClient.from('tournament_awards').upsert(rows,{onConflict:'tournament_id,award_type'});if(result.error)throw result.error;}
    await loadTournamentData(state.selected.tournament_id);await syncAwardsToAchievements();
  }

  async function syncAwardsToAchievements(){
    for(const award of state.awards){
      if(!award.student_id)continue;
      const existing=await supabaseClient.from('student_achievements').select('achievement_id').eq('source_type','tournament').eq('source_id',String(award.award_id)).maybeSingle();
      if(existing.error)continue;
      const achievementPayload={student_id:award.student_id,title:award.title,category:'Tournament',achievement_date:state.selected.event_date,description:state.selected.name+' · '+award.title+(award.certificate_path?'':' · Certificate template pending'),file_path:award.certificate_path||null,file_name:award.certificate_path?award.title+'.pdf':null,file_type:award.certificate_path?'application/pdf':null,source_type:'tournament',source_id:String(award.award_id)};
      if(existing.error)continue;
      if(existing.data){const update=await supabaseClient.from('student_achievements').update(achievementPayload).eq('achievement_id',existing.data.achievement_id);if(update.error)console.warn('Tournament achievement record was not updated:',update.error);continue;}
      const result=await supabaseClient.from('student_achievements').insert(achievementPayload);
      if(result.error)console.warn('Tournament achievement record was not created:',result.error);
    }
  }

  function specialAwardForm(){
    const map={};state.awards.forEach(function(a){map[a.award_type]=a;});
    const options=state.standings.map(function(p){return '<option value="'+escT(p.student_id)+'">'+escT(p.display_name)+' ('+escT(p.student_id)+')</option>';}).join('');
    const awards=['Most Improved Player Award','Strategic Player Award','Fighting Spirit Award'];
    return '<div class="panel tournament-special-awards"><div class="eyebrow">TEACHER SELECTED</div><h3>Special Awards</h3><p class="subtle">You choose the student for each award. The system never decides these awards automatically.</p><div class="special-award-grid">'+awards.map(function(name){const selected=map[name]?map[name].student_id:'';return '<label><span>'+escT(name)+'</span><select data-special-award="'+escT(name)+'"><option value="">Not selected</option>'+options+'</select><small>'+(selected?'Currently selected: '+escT(map[name].student_name||selected):'Choose when ready')+'</small></label>';}).join('')+'</div><button class="primary" type="button" onclick="SCMSTournament.saveSpecialAwards()">Save Special Awards</button></div>';
  }

  async function saveSpecialAwards(){
    try{
      const controls=[...document.querySelectorAll('[data-special-award]')];
      for(const control of controls){
        const awardType=control.getAttribute('data-special-award'),studentId=control.value;
        if(!studentId){const existingAward=await supabaseClient.from('tournament_awards').select('award_id').eq('tournament_id',state.selected.tournament_id).eq('award_type',awardType).maybeSingle();if(existingAward.error)throw existingAward.error;if(existingAward.data){await supabaseClient.from('student_achievements').delete().eq('source_type','tournament').eq('source_id',String(existingAward.data.award_id));}const del=await supabaseClient.from('tournament_awards').delete().eq('tournament_id',state.selected.tournament_id).eq('award_type',awardType);if(del.error)throw del.error;continue;}
        const student=state.standings.find(function(p){return String(p.student_id)===String(studentId);});
        const result=await supabaseClient.from('tournament_awards').upsert({tournament_id:state.selected.tournament_id,student_id:studentId,student_name:student?student.display_name:studentId,award_type:awardType,rank:null,title:awardType,certificate_path:null},{onConflict:'tournament_id,award_type'});if(result.error)throw result.error;
      }
      await loadTournamentData(state.selected.tournament_id);await syncAwardsToAchievements();renderWorkspace();notifyT('Special awards saved and recorded in the student achievement system. Certificate files will use your supplied templates.','success','Awards Saved',{variant:'registration'});
    }catch(error){notifyT(error.message||String(error),'error','Awards Not Saved',{variant:'critical'});}
  }

  async function archive(){
    if(!state.selected||state.selected.status!=='completed')return;
    if(!(await confirmT('Archive this completed tournament? It will remain available in Tournament History.','Archive Tournament')))return;
    const result=await supabaseClient.from('tournaments').update({status:'archived',archived_at:new Date().toISOString()}).eq('tournament_id',state.selected.tournament_id);if(result.error){notifyT(result.error.message,'error','Archive Failed',{variant:'critical'});return;}
    await loadTournaments();await open(state.selected.tournament_id);notifyT('Tournament archived and preserved in history.','success','Tournament Archived');
  }

  async function reopen(){
    if(!state.selected||!['completed','archived'].includes(state.selected.status))return;
    if(!(await confirmT('Reopen this tournament for result corrections? Final ranking and generated achievement records can change after you finalize it again.','Reopen Tournament')))return;
    const result=await supabaseClient.from('tournaments').update({status:'active',completed_at:null,archived_at:null}).eq('tournament_id',state.selected.tournament_id);if(result.error){notifyT(result.error.message,'error','Reopen Failed',{variant:'critical'});return;}
    await loadTournaments();await open(state.selected.tournament_id);notifyT('Tournament reopened. Correct the relevant results, then end it again.','info','Tournament Reopened');
  }

  function editTournament(){
    const t=state.selected;if(!t||!['draft','ready'].includes(t.status))return;
    showModal('<div class="tournament-modal-head"><div><div class="eyebrow">TOURNAMENT SETUP</div><h2>Edit Tournament Setup</h2><p>Update the competition details before the first round begins.</p></div><button class="parent-close-button" type="button" onclick="SCMSTournament.closeModal()">×</button></div><form id="editTournamentForm" class="tournament-edit-form"><div class="tournament-form-grid"><div class="tournament-field full"><label>Tournament Name</label><input id="eName" required value="'+escT(t.name)+'"></div><div class="tournament-field"><label>Event Date</label><input id="eDate" type="date" required value="'+escT(t.event_date||'')+'"></div><div class="tournament-field"><label>Start Time</label><input id="eTime" type="time" value="'+escT(t.start_time||'')+'"></div><div class="tournament-field full"><label>Description</label><textarea id="eDescription">'+escT(t.description||'')+'</textarea></div></div><div class="tournament-form-footer"><button type="button" class="secondary" onclick="SCMSTournament.closeModal()">Cancel</button><button class="primary" type="submit">Save Changes</button></div></form>');
    document.getElementById('editTournamentForm').onsubmit=async function(e){e.preventDefault();try{const result=await supabaseClient.from('tournaments').update({name:document.getElementById('eName').value.trim(),event_date:document.getElementById('eDate').value,start_time:document.getElementById('eTime').value||null,description:document.getElementById('eDescription').value.trim()}).eq('tournament_id',t.tournament_id);if(result.error)throw result.error;closeModal();await loadTournaments();await open(t.tournament_id);notifyT('Tournament setup updated.','success','Settings Saved');}catch(error){notifyT(error.message||String(error),'error','Settings Not Saved',{variant:'critical'});}};
  }
  function back(){state.selected=null;state.players=[];state.rounds=[];state.matches=[];state.awards=[];renderHome();}
  async function refresh(){await loadTournaments();if(state.selected)await open(state.selected.tournament_id);}

  window.SCMSTournament={init:async function(){await loadTournaments();},refresh:refresh,create:create,open:open,back:back,tab:tab,viewRound:viewRound,clearRoundView:clearRoundView,closeModal:closeModal,formatChanged:formatChanged,filterParticipants:filterParticipants,selectAllParticipants:selectAllParticipants,clearParticipants:clearParticipants,saveParticipants:saveParticipants,editParticipants:editParticipants,seedParticipants:seedParticipants,moveSeed:moveSeed,saveSeeding:saveSeeding,removePlayer:removePlayer,start:start,score:score,finish:finish,finishRound:finishRound,immediateEnd:immediateEnd,deleteTournament:deleteTournament,saveSpecialAwards:saveSpecialAwards,archive:archive,reopen:reopen,editTournament:editTournament};

  const originalPage=window.page;
  window.page=function(name){originalPage(name);if(name==='tournament'){const title=document.getElementById('title');if(title)title.textContent='Tournament';SCMSTournament.init();}};
  document.addEventListener('change',function(e){if(e.target&&e.target.matches('#participantChecklist input'))updateSelectedCount();});
})();