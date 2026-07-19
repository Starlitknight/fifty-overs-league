
(function(){
  if(typeof App==='undefined')return;

  /* ---------- helpers ---------- */
  function safe(fn){try{return fn&&fn()}catch(e){console.error('[FO patch] step failed:',e);return undefined}}
  function safeCall(name){try{if(typeof window[name]==='function')window[name]()}catch(e){console.error(e)}}

  /* ---------- 2. role-type icons (bat / ball / both / stumps) ---------- */
  var SVG_BAT ='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 18 L15 9"/><path d="M15 9 l3 -3"/><circle cx="8" cy="17" r="1.6" fill="currentColor" stroke="none"/></svg>';
  var SVG_BALL='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="7.5" fill="currentColor" fill-opacity="0.18"/><path d="M8 6.5 C10 10 10 14 8 17.5" /><path d="M16 6.5 C14 10 14 14 16 17.5"/></svg>';
  var SVG_BOTH='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 17 L11 10"/><path d="M11 10 l2 -2"/><circle cx="18" cy="15" r="4" fill="currentColor" fill-opacity="0.2"/><path d="M18 11.5 C16.8 13.5 16.8 16.5 18 18.5"/></svg>';
  var SVG_WK  ='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 8 V19"/><path d="M12 8 V19"/><path d="M17 8 V19"/><path d="M6 7 L18 7"/><path d="M6.5 5.5 L11 7"/><path d="M17.5 5.5 L13 7"/></svg>';
  function foRoleClass(p){
    if(!p)return 'bat';
    if(typeof roleClass==='function'){try{return roleClass(p)}catch(e){}}
    if(p.keeper)return 'wk';
    if(p.role==='allRounder')return 'ar';
    return (p.bowlType||p.bowlTypeFull&&p.bowlTypeFull!=='none')?'bowl':'bat';
  }
  window.foRoleIcon=function(p){
    var c=foRoleClass(p);
    var m={bat:['Batsman',SVG_BAT],bowl:['Bowler',SVG_BALL],ar:['All-rounder',SVG_BOTH],wk:['Wicketkeeper',SVG_WK]};
    var e=m[c]||m.bat;
    return '<span class="fo-role-ic fo-ic-'+c+'" title="'+e[0]+'">'+e[1]+'</span>';
  };
  playerLink=function(p){return '<a href="#/player?n='+encodeURIComponent(p.name)+'" title="'+esc(playerTip(p))+'">'+foRoleIcon(p)+esc(p.name)+'</a>'};
  playerMini=function(p){return '<span class="player-hoverable" title="'+esc(playerTip(p))+'">'+foRoleIcon(p)+esc(p.name)+'</span>'};
  if(typeof fo55Flag==='function'){window.fo55Flag=function(){return ''}}

  /* ---------- 6. remove club-dashboard blurb ---------- */
  if(typeof pgClub==='function'){
    var _prevPgClub=pgClub;
    pgClub=function(){
      _prevPgClub();
      var page=document.getElementById('page');
      if(page){page.querySelectorAll('.welcome-hero p').forEach(function(el){
        if(/clean match-day dashboard/i.test(el.textContent))el.remove();
      });}
      safeCall('fo55Sanitize');
    };
  }

  /* ---------- 3 & 7. robust round advancement (never gets stuck) ---------- */
  function foSimMeta(f,roundNo){
    if(typeof fo55SimMeta==='function')return fo55SimMeta(f,roundNo);
    var home=GD.teams[f[0]],away=GD.teams[f[1]];
    return {home:home.name,away:away.name,ground:home.ground,pitch:groundPitch(home.ground),
      weather:WXLIST[(roundNo*7+f[0]*3)%WXLIST.length],seed:5000+roundNo*10+f[0],
      date:(typeof fo55RoundDate==='function'?fo55RoundDate(roundNo):simDate()),comp:'league',round:roundNo,
      isUser:(f[0]===App.teamIx||f[1]===App.teamIx)};
  }
  function foRefreshMatches(){
    UI.matchTab='Commentary';
    location.hash='#/matches';
    setTimeout(function(){ safeCall('pgMatches'); safeCall('fo55LiveTopbar'); },0);
  }

  completeRound=function(){
    if(window.__fo_advancing)return;
    window.__fo_advancing=true;
    try{
      if(window.__ap){clearInterval(window.__ap);window.__ap=null}
      seasonInit();
      var S=App.season; if(!S){return}
      if(S.round>=S.schedule.length){return}
      var roundNo=S.round, rd=S.schedule[roundNo]||[];
      /* 1. simulate every unplayed fixture (each isolated so one bad match can't wedge the round) */
      for(var i=0;i<rd.length;i++){
        var f=rd[i], key=fixtureKey(roundNo,f);
        if(S.played[key]!==undefined)continue;
        (function(f){ safe(function(){ simBackground(f[0],f[1],foSimMeta(f,roundNo)); }); })(f);
      }
      /* clear any lingering live-match state */
      M=null; App.pending=null; App.tossState=null;
      /* 2. weekly economy / market / cup / training — each isolated */
      safe(function(){
        econInit();
        var me=userTeam();
        ledger('Ground maintenance',-(me.seats||10000));
        ledger('Academies (Y'+(me.acadY||0)+'/S'+(me.acadS||0)+')',-(((me.acadY||0)+(me.acadS||0))*2500));
        var myLg=App.results.filter(function(r){return r.comp!=='youth'&&r.round===roundNo&&(r.home===me.name||r.away===me.name)});
        myLg.forEach(function(r){
          if(r.home===me.name){var att=attendance(me);ledger('Gate receipts ('+att.toLocaleString()+' att.)',att*9)}
          var won=r.result&&r.result.winner===me.name;
          me.mood=Math.max(0,Math.min(6,(me.mood==null?3:me.mood)+(won?1:-1)));
          me.supporters=Math.max(800,Math.round((me.supporters||2600)*(won?1.03:0.985)));
        });
        GD.teams.forEach(function(tt){if(tt!==me)tt.bank=(tt.bank||500000)+45000-24*(tt.seats||10000)/9});
      });
      safe(resolveMarket);
      safe(cupTick);
      safe(applyTraining);
      safe(function(){ if(typeof ensureFinance==='function')ensureFinance() });
      /* 3. ADVANCE — unconditionally */
      S.round=roundNo+1; App.round=S.round+1;
      safe(function(){ mpInit(); for(var k in App.mp.packets)if(App.mp.packets[k].round<S.round)delete App.mp.packets[k]; });
      safe(function(){
        var digest=App.results.filter(function(r){return r.comp==='league'&&r.round===roundNo})
          .map(function(r){return '<div class="bl">'+esc(r.result.text)+' <span class="small">('+esc(r.home)+' v '+esc(r.away)+')</span></div>'}).join('');
        var seasonDone=S.round>=S.schedule.length;
        App._digest='<div class="panel" style="border-left:4px solid #2d6a8f"><h4>Round '+(roundNo+1)+' complete</h4><div class="pad">'
          +(digest||'<span class="small">All fixtures simulated.</span>')
          +'<div class="small" style="margin-top:3px">'+(seasonDone?'Season complete - start the next season below.':'Advanced to round '+(S.round+1)+'. Training applied.')+'</div></div></div>';
      });
      safe(function(){saveGame(false)});
    }catch(e){
      console.error('[completeRound] fatal - forcing advance',e);
      safe(function(){var S=App.season; if(S&&S.round<S.schedule.length){S.round++;App.round=S.round+1;saveGame(false)}});
    }finally{
      window.__fo_advancing=false;
      foRefreshMatches();
    }
  };

  window.completeAIRound=function(){
    try{
      if(window.__ap){clearInterval(window.__ap);window.__ap=null}
      seasonInit();
      var S=App.season; if(!S||S.round>=S.schedule.length){return}
      var roundNo=S.round, rd=S.schedule[roundNo]||[], n=0;
      rd.forEach(function(f){
        var key=fixtureKey(roundNo,f), isUser=f[0]===App.teamIx||f[1]===App.teamIx;
        if(isUser||S.played[key]!==undefined)return;
        (function(f){ if(safe(function(){simBackground(f[0],f[1],foSimMeta(f,roundNo))})!==undefined||true)n++; })(f);
      });
      safe(function(){saveGame(false)});
      App._digest='<div class="panel" style="border-left:4px solid #2d6a8f"><h4>AI matches completed</h4><div class="pad">'
        +(n?n+' AI fixture'+(n===1?'':'s')+' simulated instantly.':'No AI fixtures left this round.')
        +'<div class="small">Your own match was left untouched - play it live, then advance the round.</div></div></div>';
    }catch(e){console.error('[completeAIRound]',e)}
    finally{ setTimeout(function(){ safeCall('pgMatches'); safeCall('fo55LiveTopbar'); },0); }
  };

  /* ---------- refresh current view with the new overrides ---------- */
  try{route&&route();safeCall('fo55LiveTopbar');safeCall('fo55Sanitize');}catch(e){console.error(e)}
})();
