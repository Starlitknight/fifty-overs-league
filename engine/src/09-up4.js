
/* ============================================================================
   FIFTY OVERS — v10 (loads LAST; wins over patches 1-3)
   1 club header band+icon · 2 stat-table alignment · 3 single-colour skills ·
   4 skill hover ladders · 5 match intro pinned in commentary · 6 talents filter ·
   7/8 equal score/details boxes + filler · 9 bowling over-grid · 10 squad grid
   wage header · 11 em-dash sweep · 12 bot calibration · 13 fatigue spectrum ·
   14 orders condition tooltips · 15 Lineups tab · 16 live capt/wk · 17 full feed
   ============================================================================ */
(function(){
  if(typeof document==='undefined')return;
  var foFlag=window.foFlag, foBT=window.foBT, foAbil=window.foAbil, foRoleImg=window.foRoleImg;
  var CLUBIMG=window.FO_CLUBIMG||'';
  var FATLADX=['rested','revived','energetic','passable','satisfactory','moderate','weary','listless','exhausted','shattered','clinically dead'];

  /* ============ #13 FATIGUE SPECTRUM (layer around the engine; engine math untouched) ============ */
  function fatWordOf(n){n=+n||0;return n>=96?'clinically dead':n>=88?'shattered':n>=78?'exhausted':n>=68?'listless':n>=56?'weary':n>=44?'moderate':n>=34?'satisfactory':n>=24?'passable':n>=14?'energetic':n>=5?'revived':'rested';}
  function fatSync(p){if(p.fatN==null){var f=String(p.fatigue||'rested').toLowerCase();p.fatN=({rested:0,revived:8,energetic:18,passable:28,satisfactory:38,moderate:50,weary:62,listless:72,exhausted:82,shattered:91,'clinically dead':99})[f]||0;}p.fatWord=fatWordOf(p.fatN);p.fatigue=p.fatWord;}
  window.foFatSyncAll=function(){try{for(var i=0;i<GD.teams.length;i++){var t=GD.teams[i];
    (t.players||[]).concat(t.youth||[]).forEach(function(p){fatSync(p);if(!p.formWord)p.formWord=(typeof FORMW!=='undefined'?FORMW[p.formIx==null?3:p.formIx]:'steady');});}}catch(e){}};
  /* accumulate at match save: workload-based, captain surcharge */
  if(typeof window.saveMatch==='function'){var _sv10=window.saveMatch;
    window.saveMatch=function(m){
      var r=_sv10.apply(this,arguments);
      try{
        var caps={};m.innings.forEach(function(inn){if(!inn)return;if(inn.captBatName)caps[inn.captBatName]=1;if(inn.captBowlName)caps[inn.captBowlName]=1;});
        m.innings.forEach(function(inn){if(!inn)return;
          inn.bat.forEach(function(b){if(!(b.b>0||b.out))return;var pl=findPlayer(b.p.name);if(!pl)return;var p=pl.p;
            if(p.fatN==null)fatSync(p);
            p.fatN=Math.min(100,p.fatN + 4 + b.b*0.16 + (p.keeper?4:0) + (caps[p.name]?4:0));fatSync(p);});
          for(var k in inn.bowlers){var br=inn.bowlers[k];var pl2=findPlayer(k);if(!pl2)continue;var p2=pl2.p;
            if(p2.fatN==null)fatSync(p2);
            p2.fatN=Math.min(100,p2.fatN + 3 + br.b*0.32 + (caps[k]?4:0));fatSync(p2);}
        });
      }catch(e){console.error('[fatN accumulate]',e);}
      return r;
    };
  }
  /* recover a little each completed round: young players faster, old slower */
  if(typeof window.completeRound==='function'){var _cr10=window.completeRound;
    window.completeRound=function(){
      var out=_cr10.apply(this,arguments);
      try{for(var i=0;i<GD.teams.length;i++){var t=GD.teams[i];
        (t.players||[]).concat(t.youth||[]).forEach(function(p){
          if(p.fatN==null){fatSync(p);return;}
          var rec=14+(p.age<=22?7:p.age<=27?4:p.age<=31?1:-3);
          if(p.trainFocus==='Rest'||(p.training&&p.training.intensity==='Rest'))rec+=12;
          p.fatN=Math.max(0,p.fatN-rec);fatSync(p);});}}catch(e){}
      return out;
    };
  }

  /* ============ #12 BOT CALIBRATION: bots land at ~1800-2200 avg player rating ============ */
  window.foCalibrateBots=function(force){
    try{
      if(!GD.teams.some(function(t){return t.founded;}))return 'no founded club yet';
      var done=0;
      for(var i=0;i<GD.teams.length;i++){
        var t=GD.teams[i];
        if(i===App.teamIx||t.founded)continue;
        if(t._botCal&&!force)continue;
        var target=1800+((i*89)%401);      /* 1800-2200, varied per club */
        for(var pass=0;pass<4;pass++){
          var avg=t.players.reduce(function(s,p){return s+(p.rating||0);},0)/Math.max(1,t.players.length);
          var f=Math.max(0.55,Math.min(1.45,target/Math.max(1,avg)));
          if(Math.abs(f-1)<0.03)break;
          var sf=Math.pow(f,0.85);         /* skills->rating is superlinear-ish; damp */
          t.players.forEach(function(p){for(var k in p.skills)p.skills[k]=Math.max(4,Math.min(96,Math.round(p.skills[k]*sf)));jsDerive(p);});
        }
        t._botCal=1;done++;
      }
      if(typeof saveGame==='function')saveGame(false);
      return 'calibrated '+done+' bot clubs';
    }catch(e){console.error('[botCal]',e);return 'ERR';}
  };
  if(typeof window.founderConfirm==='function'){var _fc10=window.founderConfirm;
    window.founderConfirm=function(){var out=_fc10.apply(this,arguments);try{foCalibrateBots();foFatSyncAll();}catch(e){}return out;};}
  setTimeout(function(){try{foCalibrateBots();foFatSyncAll();}catch(e){}},400);

  /* ============ #5 match intro as pinned commentary entries (and kill the banner panel) ============ */
  function introText(){
    try{
      econInit();
      var homeT=GD.teams.find(function(x){return x.name===M.meta.home;});
      var crowd=homeT?attendance(homeT,M.meta.weather,'normal').toLocaleString():'a good crowd';
      var inn=M.innings[M.inns];
      if(M.inns===0)return 'A crowd of '+crowd+' has gathered at '+M.meta.ground+' for '+M.meta.home+' v '+M.meta.away+', with '+(M.meta.weather||'Sunny')+' conditions and a '+M.pitch+' pitch. '+(M.tossText||(App.tossState&&App.tossState.txt)||'')+' The players are ready - let battle commence.';
      return 'THE CHASE BEGINS. '+inn.batTeam+' need '+M.target+' to win. '+inn.bat[inn.striker].p.name+' and '+inn.bat[inn.nonstriker].p.name+' walk out under pressure.';
    }catch(e){return M.inns===0?'Play begins.':'The chase begins.';}
  }
  function logIntro(){
    try{
      if(typeof M==='undefined'||!M||!M.innings[M.inns])return;
      M._introDone=M._introDone||{};
      if(M._introDone[M.inns])return;
      M._introDone[M.inns]=1;
      M.log.unshift({no:'',out:'▶',txt:introText(),d:null,inn:M.inns,mile:true,intro:true});
    }catch(e){}
  }
  if(typeof window.applyToss==='function'){var _at10=window.applyToss;
    window.applyToss=function(){_at10.apply(this,arguments);logIntro();};}
  if(typeof window.endInnings==='function'){var _ei10=window.endInnings;
    window.endInnings=function(){_ei10.apply(this,arguments);if(typeof M!=='undefined'&&M&&!M.done)logIntro();};}

  /* ============ #6/#17 commentary: talents filter + full feed + intro styling ============ */
  function wkt(o){return o&&o.charAt(0)==='w'&&o!=='wide';}
  function ftpRslt(o){if(o==='4')return '<span class="four">4</span>';if(o==='6')return '<span class="six">6</span>';
    if(wkt(o))return '<span class="wicket">W</span>';if(o==='wide')return '<span class="exb">wd</span>';if(o==='noball')return '<span class="exb">nb</span>';
    if(o==='bye'||o==='legbye')return '<span class="exb">b</span>';if(o==='dot'||!o)return '.';return String(o);}
  var TALRE=null;
  function talRe(){if(TALRE)return TALRE;try{var names=Object.keys(TALN).map(function(k){return ptal(k).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');});
    TALRE=new RegExp('\\b('+names.join('|')+')\\b','i');}catch(e){TALRE=/SIX MACHINE|Golden Arm|Partnership Breaker|Specialist|Mystery|Bouncer|Lightning|Rocket|Safe Hands|Miser|Anchor|Finisher/i;}return TALRE;}
  function abilize(t){var h=(typeof esc==='function')?esc(t||''):String(t||'');
    try{Object.keys(TALN).forEach(function(k){var nm=ptal(k);var re=new RegExp('\\b('+nm.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')\\b','ig');
      h=h.replace(re,'<span class="foabil" title="'+String(TALTIPS[k]||'').replace(/"/g,'&quot;')+'">$1</span>');});}catch(e){}return h;}
  window.ftpCommHTML=function(log,filter,limit){filter=filter||'all';
    var rows=(log||[]).filter(function(L){
      if(L.intro)return true;                                    /* intro always shown, pinned at its innings' bottom */
      if(filter==='all')return true;
      if(filter==='wickets')return wkt(L.out)||/WICKET/i.test(L.txt||'');
      if(filter==='boundaries')return L.out==='4'||L.out==='6';
      if(filter==='overs')return L.mile||/End of over|DRINKS|Innings break/i.test(L.txt||'');
      if(filter==='highlights')return L.mile||wkt(L.out)||L.out==='4'||L.out==='6';
      if(filter==='talents')return talRe().test(L.txt||'');      /* #6: Ability triggers now works */
      return true;
    }).slice(0,limit||3000).map(function(L){
      if(L.intro)return '<div class="fo-introline"><div class="text">'+abilize(L.txt)+'</div><div class="clear"></div></div>';
      if(L.mile||/^End of over/i.test(L.txt||'')){
        var top=L.oversumTop?('<div class="oversummary-top"><div class="text">'+L.oversumTop+'</div><div class="clear"></div></div>'):'';
        return top+'<div class="oversummary-bottom"><div class="text">'+abilize(L.txt)+'</div><div class="clear"></div></div>';}
      var preRaw=(L.bowlerNm&&L.strikerNm)?(String(L.bowlerNm).split(' ').slice(-1)[0]+' to '+String(L.strikerNm).split(' ').slice(-1)[0]+' : '):'';
      var prefix=(preRaw&&String(L.txt||'').indexOf(preRaw)!==0)?(esc(String(L.bowlerNm).split(' ').slice(-1)[0])+' to '+esc(String(L.strikerNm).split(' ').slice(-1)[0])+' : '):'';
      var rowcls=L.out==='4'?'four':L.out==='6'?'six':wkt(L.out)?'line wkt':'line';
      return '<div class="'+rowcls+'"><div class="del">'+esc(L.no||'')+'</div><div class="rslt">'+ftpRslt(L.out)+'</div><div class="text">'+prefix+abilize(L.txt)+'</div><div class="clear"></div></div>';
    }).join('');
    return rows||'<div class="line"><div class="text" style="padding-left:8px">No commentary matches this filter.</div><div class="clear"></div></div>';};

  /* ============ #16 live capt/wk: keeper fallback = the designated keeper of the fielding XI ============ */
  function keeperFromDismissals(inn){if(!inn||!inn.bat)return null;var counts={};
    inn.bat.forEach(function(b){var o=b.out||'';var m=o.match(/†\s*([A-Za-z][A-Za-z.'\- ]+?)\s+b\s/)||o.match(/^st\s+†?\s*([A-Za-z][A-Za-z.'\- ]+?)\s+b\s/);
      if(m){var nm=m[1].trim();counts[nm]=(counts[nm]||0)+1;}});
    var best=null,bv=0;for(var k in counts)if(counts[k]>bv){bv=counts[k];best=k;}return best;}
  window.foScorecardCards=function(innings){
    var all=innings.filter(Boolean);
    return all.map(function(inn,idx){
      var other=(all.length===2)?all[1-idx]:null;
      var keeperNm=null;
      if(other){keeperNm=keeperFromDismissals(other)||((other.bxi||[]).find(function(p){return p.keeper;})||{}).name;}
      else{ /* live 1st innings: batting side's own designated keeper */
        keeperNm=(((inn.xi||[]).find(function(p){return p.keeper;}))||((inn.bat||[]).map(function(b){return b.p;}).find(function(p){return p.keeper;}))||{}).name;
      }
      var capNm=inn.captBatName||((typeof App!=='undefined'&&App.orders&&inn.batTeam===userTeam().name)?App.orders.captain:null);
      function mark(pl){var m='';if(capNm&&pl.name===capNm)m+=' <span class="fo-cap" title="captain">(c)</span>';if(keeperNm&&pl.name===keeperNm)m+=' <span class="fo-wk" title="wicketkeeper">†</span>';return m;}
      var bat=inn.bat.filter(function(b){return b.b>0||b.out;}).map(function(b){
        return '<tr><td class="fo-bat-nm">'+playerLink(b.p)+mark(b.p)+' <span class="small fo-hand">'+(b.p.hand==='L'?'LHB':'RHB')+'</span></td>'+
          '<td class="fo-out">'+esc(b.out||'not out')+'</td><td class="n"><b>'+b.r+'</b></td><td class="n">'+b.b+'</td><td class="n">'+b.f4+'</td><td class="n">'+b.f6+'</td><td class="n">'+(b.b?(100*b.r/b.b).toFixed(0):'-')+'</td></tr>';}).join('');
      var ex=inn.extras||{wd:0,nb:0,b:0,lb:0};
      var bowl=Object.values(inn.bowlers).sort(function(a,b){return b.w-a.w||a.r-b.r;}).map(function(rr){
        var type=(typeof shortBT==='function')?shortBT(rr.p):'';
        return '<tr><td class="fo-bat-nm">'+playerLink(rr.p)+' <span class="small fo-type" title="bowling type">'+esc(type)+'</span></td>'+
          '<td class="n">'+Math.floor(rr.b/6)+'.'+(rr.b%6)+'</td><td class="n">'+(rr.mdn||0)+'</td><td class="n">'+rr.r+'</td><td class="n"><b>'+rr.w+'</b></td><td class="n">'+(rr.b?(rr.r/(rr.b/6)).toFixed(2):'-')+'</td><td class="n">'+(rr.wd||0)+'</td><td class="n">'+(rr.nb||0)+'</td></tr>';}).join('');
      var fow=(inn.fow||[]).map(function(f){return f.w+'-'+f.sc+' ('+esc(f.who)+')';}).join(', ')||'-';
      return '<div class="panel"><h4>'+esc(inn.batTeam)+' - '+inn.runs+'/'+inn.wkts+' ('+Math.floor(inn.legal/6)+'.'+(inn.legal%6)+' ov)</h4><div class="pad">'+
        '<table class="fo-scorecard"><thead><tr><th>Batter</th><th>How out</th><th class="n">R</th><th class="n">B</th><th class="n">4s</th><th class="n">6s</th><th class="n">SR</th></tr></thead><tbody>'+bat+
        '<tr class="fo-extras"><td colspan="2">Extras <span class="small">(b '+ex.b+', lb '+ex.lb+', w '+ex.wd+', nb '+ex.nb+')</span></td><td class="n"><b>'+(ex.wd+ex.nb+ex.b+ex.lb)+'</b></td><td colspan="4"></td></tr>'+
        '<tr class="fo-total"><td colspan="2"><b>Total</b></td><td class="n"><b>'+inn.runs+'</b></td><td colspan="4" class="small">'+inn.wkts+' wkts, '+(inn.legal/6).toFixed(1)+' ov · RR '+(inn.legal?(inn.runs/(inn.legal/6)).toFixed(2):'0')+'</td></tr></tbody></table>'+
        '<table class="fo-bowling" style="margin-top:8px"><thead><tr><th>Bowler</th><th class="n">O</th><th class="n">M</th><th class="n">R</th><th class="n">W</th><th class="n">Econ</th><th class="n">Wd</th><th class="n">Nb</th></tr></thead><tbody>'+bowl+'</tbody></table>'+
        '<div class="small" style="margin-top:6px"><b>Fall:</b> '+fow+'</div></div></div>';
    }).join('');
  };

  /* ============ #15 Lineups tab body ============ */
  function lineupsHTML(){
    var inn0=M.innings[0]||M.innings[M.inns];if(!inn0)return '<div class="small">No lineups yet.</div>';
    var inn1=M.innings[1];
    function side(name,xi,capN,wkFromXi){
      var wkN=(xi.find(function(p){return p.keeper;})||{}).name;
      var rows=xi.map(function(p,i){var m='';if(capN&&p.name===capN)m+=' <span class="fo-cap">(c)</span>';if(p.name===wkN)m+=' <span class="fo-wk">†</span>';
        return '<tr><td class="n">'+(i+1)+'</td><td>'+foFlag(p.nat)+' '+playerLink(p)+m+'</td><td class="small">'+prole(p.role)+'</td><td class="small">'+((p.hand==='L')?'LHB':'RHB')+(foBT(p)?' · '+foBT(p):'')+'</td></tr>';}).join('');
      return '<div class="panel"><h4>'+esc(name)+'</h4><div class="pad"><table><tr><th class="n">#</th><th>Player</th><th>Role</th><th>Bat / Bowl</th></tr>'+rows+'</table></div></div>';
    }
    var a=side(inn0.batTeam,inn0.xi,inn0.captBatName);
    var b=side(inn0.bowlTeam,inn0.bxi,inn0.captBowlName);
    return '<div class="fo-lineups">'+a+b+'</div>';
  }

  /* ============ #7/#8/#15/#17 live match wrapper ============ */
  if(typeof window.renderMatch==='function'){var _rm10=window.renderMatch;
    window.renderMatch=function(){
      _rm10.apply(this,arguments);
      try{
        if(typeof M==='undefined'||!M)return;
        /* #5: kill the old start banner panel */
        document.querySelectorAll('#page .panel').forEach(function(pn){var b=pn.querySelector('.pad b');
          if(b&&/^(PLAY BEGINS|THE CHASE BEGINS)/.test(b.textContent))pn.remove();});
        /* #15: inject Lineups link into the Links sidebar */
        var links=document.querySelector('.ftp-match-links');
        if(links&&!links.querySelector('[data-fo-lineups]')){
          var a=document.createElement('a');a.textContent='Lineups';a.dataset.foLineups='1';
          a.className=(typeof UI!=='undefined'&&UI.matchTab==='Lineups')?'on':'';
          a.onclick=function(){UI.matchTab='Lineups';renderMatch();};
          links.appendChild(a);
        }
        if(links){links.querySelectorAll('a').forEach(function(x){x.classList.toggle('on',x.textContent.trim()===((typeof UI!=='undefined'&&UI.matchTab)||'Commentary'));});}
        var body=document.querySelector('.ftp-match-body');
        var tab=(typeof UI!=='undefined'&&UI.matchTab)||'';
        if(body&&tab==='Lineups')body.innerHTML='<div class="match-subpanel">'+lineupsHTML()+'</div>';
        /* #17: re-render feed with full history (scrollable) */
        var feed=document.getElementById('ftpcomm');
        if(feed&&M.log)feed.innerHTML=ftpCommHTML(M.log,(typeof UI!=='undefined'&&UI.commFilter)||'all',5000);
        /* #7: fill the details gap with crowd + club icon */
        var det=document.querySelector('.mc-details .pad table.kv');
        if(det&&!det.querySelector('[data-fo-crowd]')){
          var homeT=GD.teams.find(function(x){return x.name===M.meta.home;});
          var crowd=homeT?attendance(homeT,M.meta.weather,'normal').toLocaleString():'-';
          var tr=document.createElement('tr');tr.innerHTML='<td data-fo-crowd>Crowd</td><td>'+crowd+' spectators</td>';
          det.appendChild(tr);
        }
        var detPad=document.querySelector('.mc-details .pad');
        if(detPad&&CLUBIMG&&!detPad.querySelector('.fo-detart')){
          var img=document.createElement('div');img.className='fo-detart';img.innerHTML='<img src="'+CLUBIMG+'" alt="">';
          detPad.appendChild(img);
        }
      }catch(e){console.error('[renderMatch v10]',e);}
    };
  }

  /* ============ #1 CLUB header band with icon ============ */
  if(typeof window.pgClub==='function'){var _pc10=window.pgClub;
    window.pgClub=function(){
      _pc10.apply(this,arguments);
      try{
        var head=document.querySelector('#page .page-head');
        if(head&&CLUBIMG&&!head.classList.contains('fo-clubband')){
          head.classList.add('fo-clubband');
          var img=document.createElement('img');img.className='fo-clubcrest';img.src=CLUBIMG;img.alt='';
          head.insertBefore(img,head.firstChild);
        }
      }catch(e){}
    };
  }

  /* ============ #2/#3/#4 PLAYER PAGE (single-colour bars, hover ladders, aligned stat tables, fatWord) ============ */
  function careerAgg(nm){var h=App.playerHist[nm]||[];var b={inns:0,runs:0,outs:0,hs:0,bf:0,h100:0,h50:0,s4:0,s6:0};var w={balls:0,runs:0,wkts:0,bestW:-1,bestR:0};
    h.forEach(function(e){if(e.bb>0||e.o){b.inns++;b.runs+=e.rr||0;b.outs+=e.o?1:0;b.bf+=e.bb||0;b.hs=Math.max(b.hs,e.rr||0);if((e.rr||0)>=100)b.h100++;else if((e.rr||0)>=50)b.h50++;b.s4+=e.s4||0;b.s6+=e.s6||0;}
      if(e.cb>0){w.balls+=e.cb;w.runs+=e.cr||0;w.wkts+=e.w||0;if((e.w||0)>w.bestW||((e.w||0)===w.bestW&&(e.cr||0)<w.bestR)){w.bestW=e.w||0;w.bestR=e.cr||0;}}});
    return {b:b,w:w};}
  function matchIxFor(h){for(var i=App.results.length-1;i>=0;i--){var r=App.results[i];if(r.date===h.date&&(r.home+' v '+r.away)===h.teams)return i;}return -1;}
  window.pgPlayer=function(q){
    try{
      q=q||{};var hit=findPlayer(q.n||'');if(!hit){$('#page').innerHTML='<div class="panel"><div class="pad">Player not found.</div></div>';return;}
      var p=hit.p,team=hit.team;fatSync(p);
      var allr=Math.round((aggBat(p)+aggBowl(p))/2*(aggBat(p)>40&&aggBowl(p)>40?1:0.4));
      var tal=(p.talents&&p.talents.length)?p.talents.map(foAbil).join(' '):'None';var btl=foBT(p)||'Does not bowl';
      var LADT=(typeof SKILLTIP!=='undefined')?SKILLTIP:'Skill ladder';
      var bigbar=function(v,lbl){return '<div class="fo-bigskill" title="'+lbl+': '+word(v)+' (rank '+(wIx(v)+1)+' of 16)\n'+LADT+'">'+
        '<span class="fo-bigskill-l">'+lbl+'</span><span class="fo-bigskill-bar"><i style="width:'+Math.max(2,Math.min(100,v))+'%"></i></span>'+
        '<span class="fo-bigskill-w">'+word(v)+'</span></div>';};
      var hist=(App.playerHist[p.name]||[]).slice(-6).reverse();
      var histRows=hist.length?hist.map(function(h){var ix=matchIxFor(h);var cell=ix>=0?'<a href="#/scorecard?i='+ix+'">'+esc(h.teams)+'</a>':esc(h.teams);
        return '<tr class="'+(ix>=0?'rowlink':'')+'"'+(ix>=0?' onclick="location.hash=\'#/scorecard?i='+ix+'\'"':'')+'><td>'+h.date+'</td><td>One Day</td><td>'+cell+'</td><td>'+esc(h.bat)+'</td><td>'+esc(h.bowl)+'</td><td>-</td></tr>';}).join(''):'<tr><td colspan=6 class="small">No recent matches yet.</td></tr>';
      var ca=careerAgg(p.name);var B=ca.b,W=ca.w;
      var batStat='<tr><td>One Day</td><td class="n">'+B.inns+'</td><td class="n">'+(B.inns-B.outs)+'</td><td class="n"><b>'+B.runs+'</b></td><td class="n">'+B.hs+'</td><td class="n">'+(B.outs?(B.runs/B.outs).toFixed(2):(B.runs?'-':'0'))+'</td><td class="n">'+B.bf+'</td><td class="n">'+(B.bf?(100*B.runs/B.bf).toFixed(1):'0')+'</td><td class="n">'+B.h100+'</td><td class="n">'+B.h50+'</td><td class="n">'+B.s4+'</td><td class="n">'+B.s6+'</td></tr>';
      var bowlStat='<tr><td>One Day</td><td class="n">'+W.balls+'</td><td class="n">'+W.runs+'</td><td class="n"><b>'+W.wkts+'</b></td><td class="n">'+(W.bestW>=0?W.bestW+'-'+W.bestR:'-')+'</td><td class="n">'+(W.wkts?(W.runs/W.wkts).toFixed(2):'-')+'</td><td class="n">'+(W.balls?(W.runs/(W.balls/6)).toFixed(2):'-')+'</td><td class="n">'+(W.wkts?(W.balls/W.wkts).toFixed(1):'-')+'</td></tr>';
      var FT=(typeof FATTIP!=='undefined')?FATTIP:'Fatigue ladder';var FRM=(typeof FORMTIP!=='undefined')?FORMTIP:'Form ladder';var EXT=(typeof EXPTIP!=='undefined')?EXPTIP:'Experience ladder';
      $('#page').innerHTML=crumb(team.name,p.name,'Details')+
        '<div class="grid2"><div class="col">'+
          '<div class="panel"><h4>Player info</h4><div class="pad">'+
            '<div class="ftp-pinfo-top">'+p.age+'y · <b title="Overall rating from all skills">'+p.rating+'</b> rating · $'+(p.wage||0).toLocaleString()+' wage</div>'+
            '<div class="ftp-pinfo-hand">'+(p.hand==='R'?'Right':'Left')+' hand batsman | '+esc(btl)+'</div>'+
            '<table class="kv" style="margin-top:5px">'+
              '<tr><td title="Special abilities that trigger in matches">Talents</td><td>'+tal+'</td></tr>'+
              '<tr><td>Nationality</td><td>'+foFlag(p.nat)+' '+esc(p.nat)+'</td></tr>'+
              '<tr><td title="'+FRM+'">Form</td><td title="'+FRM+'">'+esc(p.formWord||'-')+'</td></tr>'+
              '<tr><td title="'+FT+'">Fatigue</td><td title="'+FT+'">'+esc(p.fatWord||p.fatigue||'-')+'</td></tr>'+
              '<tr><td title="'+EXT+'">Experience</td><td title="'+EXT+'">'+esc(p.expWord||'')+' <span class="small">('+p.exp+')</span></td></tr>'+
              '<tr><td title="Leadership: better captains squeeze dots in the field and steady the batting">Captaincy</td><td title="'+LADT+'">'+word(p.capt||30)+'</td></tr></table></div></div>'+
        '</div><div class="col">'+
          '<div class="panel"><h4>Skills summary</h4><div class="pad">'+
            bigbarMini(aggBat(p),'Batsman',LADT)+bigbarMini(aggBowl(p),'Bowler',LADT)+bigbarMini(aggKeep(p),'Keeper',LADT)+bigbarMini(allr,'Allrounder',LADT)+'</div></div>'+
        '</div></div>'+
        '<div class="panel fo-skills-panel"><h4>Skills</h4><div class="pad"><div class="ftp-skills-2col">'+
          '<div>'+bigbar(aggBat(p),'Batting')+bigbar(aggBowl(p),'Bowling')+bigbar(aggKeep(p),'Keeping')+bigbar(aggField(p),'Fielding')+'</div>'+
          '<div>'+bigbar(aggEnd(p),'Endurance')+bigbar(aggTech(p),'Technique')+bigbar(S(p).power,'Power')+'</div></div>'+
          '<details class="adv"><summary>Advanced engine view</summary><table class="kv">'+['vsPace','vsSpin','power','rotation','temperament','wicket','economy','discipline','moveTurn','variation','stamina','fielding','catching','keeping','stumping'].map(function(k){return '<tr><td title="'+LADT+'">'+k+'</td><td>'+(S(p)[k]!=null?S(p)[k]:0)+' <span class="small">('+word(S(p)[k]||0)+')</span></td></tr>';}).join('')+'</table></details></div></div>'+
        '<div class="panel"><h4>Recent matches</h4><div class="pad"><table><tr><th>Date</th><th>Class</th><th>Teams</th><th>Batting</th><th>Bowling</th><th>Fielding</th></tr>'+histRows+'</table></div></div>'+
        '<div class="panel"><h4>Batting &amp; fielding</h4><div class="pad"><table class="fo-stattbl"><colgroup><col style="width:15%"><col span="11"></colgroup><tr><th>Class</th><th class="n" title="Innings batted">Inns</th><th class="n" title="Not outs">NO</th><th class="n">Runs</th><th class="n" title="Highest score">HS</th><th class="n" title="Runs per dismissal">Ave</th><th class="n" title="Balls faced">BF</th><th class="n" title="Runs per 100 balls">SR</th><th class="n">100</th><th class="n">50</th><th class="n">4s</th><th class="n">6s</th></tr>'+batStat+'</table></div></div>'+
        '<div class="panel"><h4>Bowling</h4><div class="pad"><table class="fo-stattbl"><colgroup><col style="width:15%"><col span="7"></colgroup><tr><th>Class</th><th class="n">Balls</th><th class="n">Runs</th><th class="n">Wkts</th><th class="n" title="Best figures">Best</th><th class="n" title="Runs per wicket">Ave</th><th class="n" title="Runs per over">Econ</th><th class="n" title="Balls per wicket">SR</th></tr>'+bowlStat+'</table></div></div>';
    }catch(e){console.error('[pgPlayer v10]',e);}
  };
  function bigbarMini(v,lbl,LADT){return '<div class="fo-bigskill fo-bigskill-sm" title="'+lbl+': '+word(v)+' (rank '+(wIx(v)+1)+' of 16)\n'+LADT+'"><span class="fo-bigskill-l">'+lbl+'</span><span class="fo-bigskill-bar"><i style="width:'+Math.max(2,Math.min(100,v))+'%"></i></span><span class="fo-bigskill-w">'+word(v)+'</span></div>';}

  /* ============ #10 squad Overall Grid: add Wage header + fatigue spectrum + form fallback ============ */
  window.gridTable=function(ps){
    if(squadView.key&&GRIDKEYS[squadView.key]){var f=GRIDKEYS[squadView.key];
      ps=ps.slice().sort(function(a,b){var x=f(a),y=f(b);return (x<y?-1:x>y?1:0)*squadView.dir;});}
    var H=function(k){return '<th style="cursor:pointer" title="'+(TIPS[k]||k)+' - click to sort" onclick="gridSort(\''+k+'\')">'+k+(squadView.key===k?(squadView.dir<0?' \u25BC':' \u25B2'):'')+'</th>';};
    return '<div class="panel"><h4>Overall grid <span style="font-weight:normal;font-size:9px">click a column to sort</span></h4><div class="pad"><table class="fo-gridtbl">'+
    '<tr>'+['Player','Age','Nat','BT','End','Bat','Bowl','Tech','Power','Keep','Field'].map(H).join('')+'<th>Capt</th>'+['Exp','Fatg','Form','Wage'].map(H).join('')+H('Rating')+'</tr>'+
    ps.map(function(p){fatSync(p);if(!p.formWord)p.formWord=(typeof FORMW!=='undefined'?FORMW[p.formIx==null?3:p.formIx]:'steady');
      return '<tr><td>'+foRoleImg(p)+' '+playerLink(p)+'</td><td class="n">'+p.age+'</td><td>'+foFlag(p.nat)+'</td><td>'+esc(shortBT(p))+'</td>'+
      '<td>'+abbr(aggEnd(p))+'</td><td>'+abbr(aggBat(p))+'</td><td>'+abbr(aggBowl(p))+'</td><td>'+abbr(aggTech(p))+'</td><td>'+abbr(S(p).power)+'</td><td>'+abbr(aggKeep(p))+'</td><td>'+abbr(aggField(p))+'</td>'+
      '<td>'+abbr(p.capt||30)+'</td><td>'+esc(p.expWord||p.exp)+'</td><td title="'+((typeof FATTIP!=='undefined')?FATTIP:'')+'">'+esc(p.fatWord||p.fatigue)+'</td><td>'+esc(p.formWord)+'</td><td class="n">$'+(p.wage||0).toLocaleString()+'</td><td class="n">'+p.rating+'</td></tr>';}).join('')+
    '</table></div></div>';
  };

  /* ============ #9 BOWLING ORDERS: intuitive click-grid replaces spell forms ============ */
  var _pgOrders10=window.pgOrders;
  window.pgOrders=function(){
    _pgOrders10.apply(this,arguments);
    try{
      var bp=document.querySelector('.fo-bowlpanel .pad');if(!bp)return;
      gridState();
      var t=userTeam();
      var allBowlers=t.players.filter(function(p){return p.bowlType&&(App.orders.showPT||!isPT(p));});
      var gb=App.orders.gridBowlers;
      var counts={};for(var o=1;o<=50;o++){var n=App.orders.grid[o];if(n)counts[n]=(counts[n]||0)+1;}
      var assigned=Object.keys(counts).reduce(function(a,k){return a+counts[k];},0);
      var gridRows=gb.map(function(nm,i){
        var p=t.players.find(function(x){return x.name===nm;});
        var col=BOWLCOLS[i%7];var cells='';
        for(var o=1;o<=50;o++){var owner=App.orders.grid[o];var mine=owner===nm&&nm;var other=owner&&owner!==nm;
          cells+='<span class="fo-gcell" onclick="gridClick(\''+String(nm).replace(/'/g,'&#39;')+'\','+o+');" title="over '+o+(owner?' - '+esc(owner):'')+'" style="cursor:'+(nm?'pointer':'default')+';border-color:'+(mine?col:'#d5d5d5')+';background:'+(mine?col:(other?'#efefef':'#fff'))+';color:'+(mine?'#fff':(other?'#bbb':'#889'))+'">'+o+'</span>';}
        var n=counts[nm]||0;
        return '<div class="fo-gridrow"><div class="fo-gridside">'+
          '<select onchange="gridBowlerSet('+i+',this.value)"><option value="">- pick bowler -</option>'+allBowlers.map(function(b){return '<option '+(nm===b.name?'selected':'')+' value="'+esc(b.name)+'">'+esc(b.name)+' ('+esc(shortBT(b))+')</option>';}).join('')+'</select>'+
          '<div class="small" style="margin-top:2px">'+(p?word(aggBowl(p))+' · ':'')+'<b class="'+(n>10?'warntxt':'')+'">'+n+' ov</b>'+(n>10?' over limit!':'')+(nm?' <a onclick="gridClearRow('+i+')" style="cursor:pointer">clear</a>':'')+'</div></div>'+
          '<div class="fo-gridcells">'+cells+'</div></div>';
      }).join('');
      bp.innerHTML='<div class="ctlrow" style="margin-bottom:5px">'+
        '<button onclick="applyPreset&&applyPreset(\'best\');gridFromCompiled&&gridFromCompiled()">Best five</button>'+
        '<button onclick="applyPreset&&applyPreset(\'pace\');gridFromCompiled&&gridFromCompiled()">Pace-led</button>'+
        '<button onclick="applyPreset&&applyPreset(\'spin\');gridFromCompiled&&gridFromCompiled()">Spin-led</button>'+
        '<button onclick="gridAddRow&&gridAddRow()">+ Add bowler</button>'+
        '<label class="small"><input type="checkbox" '+(App.orders.showPT?'checked':'')+' onchange="App.orders.showPT=this.checked;pgOrders()"> show part-timers</label>'+
        '<b class="'+(assigned===50?'oktxt':'warntxt')+'" style="margin-left:auto">'+assigned+' / 50 overs</b></div>'+
        gridRows+
        '<div class="small" style="margin-top:5px">Click an over number to give it to that bowler; click again to unassign; clicking an over another bowler owns steals it. Odd and even overs alternate ends automatically, and no bowler can bowl two overs in a row.</div>';
      /* #14: capitalized conditions with effect tooltips */
      document.querySelectorAll('.fo-detgrid b').forEach(function(b){
        var v=b.textContent.trim();
        if(/^(balanced|flat|green|dry|slow|cracked|twoPaced)$/i.test(v)){b.title=(typeof pitchTip==='function')?pitchTip(v):'';b.textContent=v.charAt(0).toUpperCase()+v.slice(1);}
        else if(typeof WXTIP!=='undefined'&&WXTIP[v.charAt(0).toUpperCase()+v.slice(1).toLowerCase()]){var W=v.charAt(0).toUpperCase()+v.slice(1).toLowerCase();b.title=WXTIP[W];b.textContent=W;}
      });
    }catch(e){console.error('[pgOrders v10]',e);}
  };

  /* ============ #11 em-dash sweep + fatWord in decorated text ============ */
  var _dec=window.foDecorate;
  window.foDecorate=function(){
    if(_dec)_dec();
    try{
      var page=document.getElementById('page');if(!page)return;
      var walker=document.createTreeWalker(page,4 /*TEXT*/,null,false);var node;
      while((node=walker.nextNode())){if(node.nodeValue&&node.nodeValue.indexOf('\u2014')>=0)node.nodeValue=node.nodeValue.replace(/\u2014/g,'-');}
    }catch(e){}
  };

  try{if(typeof route==='function')route();setTimeout(function(){if(typeof foDecorate==='function')foDecorate();},20);}catch(e){console.error(e);}
})();

