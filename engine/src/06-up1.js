
/* ============================================================================
   FIFTY OVERS — 18-item UI upgrade  (presentation only, engine untouched)
   Appended AFTER all existing code so these overrides win.
   Assets (window.FO_ROLEIMG / window.FO_FLAG) are injected just above this.
   ============================================================================ */
(function(){
  if(typeof document==='undefined')return;
  var ROLEIMG=window.FO_ROLEIMG||{}, FLAG=window.FO_FLAG||{};

  /* ---------- asset helpers ---------- */
  var NORM={England:'ENG',Australia:'AUS',India:'IND',Pakistan:'PAK','Sri Lanka':'SRI',
    'New Zealand':'NZ','South Africa':'SAF',Netherlands:'NED','West Indies':'WI',
    Afghanistan:'AFG',Ireland:'IRE',Zimbabwe:'ZIM',Canada:'CAN',USA:'USA',Kenya:'KEN',
    Nepal:'NEP',Namibia:'NAM',Oman:'OMA',Scotland:'SCO',Bangladesh:'BAN',UAE:'UAE'};
  function foFlag(nat){var c=NORM[nat]||nat;var d=FLAG[c]||FLAG[nat];
    return d?'<img class="foflag" src="'+d+'" alt="'+c+'" title="'+c+'">':'';}
  function foRoleImg(p){var k=(typeof roleClass==='function')?roleClass(p):'bat';
    var d=ROLEIMG[k]||ROLEIMG.bat;var lbl={bat:'Batter',bowl:'Bowler',ar:'All-rounder',wk:'Wicketkeeper'}[k]||'Player';
    return d?'<img class="foric" src="'+d+'" alt="'+lbl+'" title="'+lbl+'">':'';}
  function foBT(p){return (!p||!p.btLabel||p.btLabel==='Does not bowl')?'':p.btLabel;}
  function foHand(p){return p&&p.hand==='L'?'LHB':'RHB';}
  window.foFlag=foFlag;window.foRoleImg=foRoleImg;window.foBT=foBT;
  window.foPoolSort=function(key,numeric){
    if(App._poolSort===key){App._poolDir=-App._poolDir;}
    else{App._poolSort=key;App._poolDir=numeric?-1:1;}
    pgOrders();
  };

  /* ability tooltip map (display name -> what it does) */
  var ABIL={};
  try{Object.keys(TALN).forEach(function(t){ABIL[ptal(t).toLowerCase()]=TALTIPS[t]||'';});}catch(e){}
  function foAbil(t){var name=(typeof ptal==='function')?ptal(t):t;var d=(typeof TALTIPS!=='undefined'&&TALTIPS[t])||'';
    return '<span class="foabil" title="'+String(d).replace(/"/g,'&quot;')+'">'+name+'</span>';}
  window.foAbil=foAbil;

  /* ================= #8 commentary: FTP "Bowler to Batsman :" prefix (text only) ============ */
  if(typeof window.comm==='function'){
    var _comm=window.comm;
    window.comm=function(inn,out,rb,sb,bowler,intent,field){
      var base=_comm.apply(this,arguments);
      try{
        var bwl=bowler&&bowler.name?bowler.name.split(' ').slice(-1)[0]:'';
        var bat=sb&&sb.p?sb.p.name.split(' ').slice(-1)[0]:'';
        if(bwl&&bat)return bwl+' to '+bat+' : '+base;
      }catch(e){}
      return base;
    };
  }
  /* ================= #7 capture toss text onto saved results ============ */
  if(typeof window.saveMatch==='function'){
    var _saveMatch=window.saveMatch;
    window.saveMatch=function(m){
      var r=_saveMatch.apply(this,arguments);
      try{if(r&&!r.toss){r.toss=(m&&m.meta&&m.meta.tossText)||(App.tossState&&App.tossState.txt)||null;}}catch(e){}
      return r;
    };
  }
  function foCommIntro(){
    try{
      if(typeof M==='undefined'||!M||!M.meta)return '';
      var m=M.meta;var crowd='a good crowd';
      try{var ht=GD.teams.find(function(t){return t.name===m.home;});if(ht&&typeof attendance==='function')crowd=attendance(ht).toLocaleString()+' spectators';}catch(e){}
      var toss=(App.tossState&&App.tossState.txt)||'';
      return '<div class="fo-comm-intro">A crowd of '+crowd+' has gathered at '+esc(m.ground)+' for '+esc(m.home)+' v '+esc(m.away)+
        ', with '+esc(m.weather||'Sunny')+' conditions and a '+esc(M.pitch)+' pitch. '+(toss?esc(toss)+' ':'')+
        'The players are ready — let battle commence.</div>';
    }catch(e){return '';}
  }
  window.foCommIntro=foCommIntro;

  /* ================= #6 role icons -> uploaded PNGs ================= */
  window.foRoleIcon=function(p){return foRoleImg(p);};

  /* v5's playerLink/playerMini already inject a role icon; strip it so each render
     places exactly ONE icon (fixes the double-cricket-icon on the squad page). */
  window.playerLink=function(p){return '<a href="#/player?n='+encodeURIComponent(p.name)+'" title="'+esc(playerTip(p))+'">'+esc(p.name)+'</a>';};
  window.playerMini=function(p){return '<span class="player-hoverable" title="'+esc(playerTip(p))+'">'+esc(p.name)+'</span>';};

  /* ================= #5/#6 squad Summary block (flag + role PNG) ================= */
  var _summaryBlock=window.summaryBlock;
  window.summaryBlock=function(p){
    var tr=(typeof ensureTraining==='function')?ensureTraining(p):null;
    var trainSel='';
    if(typeof window.FO_TRAIN_PROGS==='object'){
      var progs=Object.keys(window.FO_TRAIN_PROGS);
      trainSel='<select onchange="setTrain(\''+(p.name.replace(/'/g,"&#39;"))+'\',this.value)" style="font-size:10px">'+
        progs.map(function(k){return '<option '+(((tr&&tr.program)||p.trainFocus)===k?'selected':'')+'>'+k+'</option>';}).join('')+'</select>';
    }else{
      trainSel='<select onchange="setTrain(\''+(p.name.replace(/'/g,"&#39;"))+'\',this.value)" style="font-size:10px">'+
        ['none','Batting','Power','Rotation','Bowling','Discipline','Fielding','Keeping','Endurance','Rest']
        .map(function(k){return '<option '+(p.trainFocus===k?'selected':'')+'>'+k+'</option>';}).join('')+'</select>';
    }
    var tals=(p.talents&&p.talents.length)?(' &nbsp;'+p.talents.map(foAbil).join(' ')):'';
    var btline=foBT(p);btline=btline?(' | '+btline):'';
    return '<div class="pblock fo-pblock"><div class="hd">'+foFlag(p.nat)+' '+foRoleImg(p)+' '+playerLink(p)+
      (p.__y?' <span class="tag talent">U20</span> <button style="font-size:9px;padding:1px 5px" onclick="promoteYouth(App.teamIx,&quot;'+esc(p.name)+'&quot;)">promote</button>':'')+
      ' <span class="meta">('+esc(p.nat)+') · '+prole(p.role)+' · age '+p.age+' · rating <b>'+p.rating+'</b></span></div>'+
      '<div class="meta">'+(p.hand==='R'?'Right':'Left')+' hand batsman'+btline+' · form '+esc(p.formWord)+' · fatigue '+esc(p.fatigue)+tals+'</div>'+
      '<div class="cols"><div>'+bar(aggBat(p),'Batting')+'<br>'+bar(aggBowl(p),'Bowling')+'<br>'+bar(aggKeep(p),'Keeping')+'</div>'+
      '<div>'+bar(aggEnd(p),'Endurance')+'<br>'+bar(aggTech(p),'Technique')+'<br>'+bar(S(p).power,'Power')+'</div>'+
      '<div>'+bar(aggField(p),'Fielding')+'<br><span class="sklbl">Training</span> '+trainSel+'</div></div></div>';
  };

  /* ================= #3 draft tilt-with-a-floor by identity ================= */
  var _genDraftPool=window.genDraftPool;
  window.genDraftPool=function(seedStr){
    var pool=_genDraftPool(seedStr);
    try{
      var ident=(App&&App.founder&&App.founder.identity)||store('fo_identity')||'Balanced XI';
      var favBat=false,favPace=false,favSpin=false,favWK=false,favBowl=false,youth=false,money=false;
      if(ident==='Batting Machine')favBat=true;
      else if(ident==='Pace Battery')favPace=favBowl=true;
      else if(ident==='Spin Trap'){favSpin=favBowl=true;favWK=true;}
      else if(ident==='Youth Project')youth=true;
      else if(ident==='Moneyball Squad')money=true;
      // Balanced XI: no tilt.
      var isPace=function(p){return ['seamFast','seamFastMedium','seamMedium'].includes(p.bowlTypeFull);};
      var isSpin=function(p){return ['wristSpin','fingerSpin'].includes(p.bowlTypeFull);};
      var cls=function(p){return p.keeper?'wk':(p.role==='allRounder'?'ar':(p.bowlTypeFull&&p.bowlTypeFull!=='none'?'bowl':'bat'));};
      var bump=function(p,keys,amt){keys.forEach(function(k){if(p.skills[k]!=null)p.skills[k]=Math.min(96,Math.round(p.skills[k]*amt));});jsDerive(p);
        p.fee=Math.round((p.fee||20000)*(1+(amt-1)*0.9)/1000)*1000;};
      pool.forEach(function(p){
        var c=cls(p);
        // TILT ONLY BUFFS the favoured area -> other areas keep their existing floor (no nerf = no fabricated weakness)
        if(favBat&&(c==='bat'||c==='wk'))bump(p,['vsPace','vsSpin','rotation','power','temperament'],1.07);
        if(favPace&&isPace(p))bump(p,['wicket','economy','moveTurn','discipline'],1.08);
        if(favSpin&&isSpin(p))bump(p,['wicket','economy','variation','moveTurn'],1.08);
        if(favWK&&c==='wk')bump(p,['keeping','stumping','catching'],1.07);
        if(youth){ // cheaper, younger skew: nudge fees down, keep skills
          if(p.age<=24){p.fee=Math.round(p.fee*0.86/1000)*1000;}
        }
        if(money){ // undervalue role players: small fee discount for talented specialists
          if((p.talents&&p.talents.length)&&c!=='ar')p.fee=Math.round(p.fee*0.9/1000)*1000;
        }
      });
    }catch(e){console.error('[draft tilt]',e);}
    return pool;
  };

  /* ================= #1 draft card: full-width detailed layout (image-2) + flags ============ */
  var _draftBlock=window.draftBlock;
  window.draftBlock=function(p,picked,afford,spent){
    try{
      var btl=foBT(p);var btline=btl?(' | '+btl):'';
      var tal=(p.talents&&p.talents.length)?(' &nbsp;'+p.talents.map(foAbil).join(' ')):'';
      return '<div class="pblock fo-draftcard'+(picked?' picked':'')+'">'+
        '<div class="hd" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'+
          '<span>'+foFlag(p.nat)+' <b style="font-size:14px">'+esc(p.name)+'</b>'+(p.keeper?' †':'')+'</span>'+
          '<span class="meta">'+prole(p.role)+' · age '+p.age+' · rating <b>'+p.rating+'</b></span>'+
          '<span style="flex:1"></span>'+
          '<span style="font-size:14px"><b>$'+p.fee.toLocaleString()+'</b></span>'+
          '<button class="'+(picked?'':'primary')+'" '+((!picked&&!afford)?'disabled title="over budget"':'')+' onclick="founderTake(\''+p.name.replace(/'/g,'&#39;')+'\')">'+(picked?'Drop':'Sign')+'</button>'+
        '</div>'+
        '<div class="meta">'+(p.hand==='R'?'Right':'Left')+' hand batsman'+btline+' · exp '+esc(p.expWord||p.exp)+tal+'</div>'+
        '<div class="cols">'+
          '<div>'+bar(aggBat(p),'Batting')+'<br>'+bar(aggBowl(p),'Bowling')+'<br>'+bar(aggKeep(p),'Keeping')+'</div>'+
          '<div>'+bar(aggEnd(p),'Endurance')+'<br>'+bar(aggTech(p),'Technique')+'<br>'+bar(S(p).power,'Power')+'</div>'+
          '<div>'+bar(aggField(p),'Fielding')+'</div>'+
        '</div></div>';
    }catch(e){return _draftBlock?_draftBlock(p,picked,afford,spent):'';}
  };

  /* ================= #7 Club page — richer, "addictive" dashboard ================= */
  var _pgClub=window.pgClub;
  window.pgClub=function(){
    try{
      seasonInit();
      var t=userTeam();var S=App.season;var xi=pickXI(t);
      var rowsL=leagueRows();var pos=rowsL.findIndex(function(x){return x.nm===t.name;})+1;
      // form guide (last 5 user league/cup results)
      var mine=App.results.filter(function(r){return r.home===t.name||r.away===t.name;}).slice(-5);
      var form=mine.map(function(r){var w=r.result.winner===t.name;var tie=!r.result.winner;
        var cls=tie?'d':(w?'w':'l');var lt=tie?'T':(w?'W':'L');
        return '<span class="formpip '+cls+'" title="'+esc(r.result.text)+'">'+lt+'</span>';}).join('')||'<span class="small">no matches yet</span>';
      // next fixture
      var nf=(typeof nextFixture==='function')?nextFixture():null;
      // top performers this season
      var runs=[],wkts=[];
      for(var nm in App.playerHist){var a={nm:nm,r:0,w:0};App.playerHist[nm].forEach(function(h){a.r+=h.rr||0;a.w+=h.w||0;});
        var fp=findPlayer(nm);if(fp&&fp.team.name===t.name){runs.push(a);wkts.push(a);}}
      runs.sort(function(a,b){return b.r-a.r;});wkts.sort(function(a,b){return b.w-a.w;});
      var topR=runs[0],topW=wkts[0];
      econInit();
      var bank=(App.fin&&App.fin.bank)||0, wage=(typeof t.players!=='undefined')?t.players.reduce(function(s,p){return s+(+p.wage||0);},0):0;
      var moodW=['furious','angry','unhappy','steady','pleased','delighted','euphoric'][Math.max(0,Math.min(6,t.mood==null?3:t.mood))];
      var tbl=rowsL.map(function(x,i){return '<tr '+(x.nm===t.name?'class="myrow"':'')+'><td>'+(i+1)+'</td><td>'+(i===0?'🏆 ':'')+esc(x.nm)+'</td><td class="n">'+x.p+'</td><td class="n">'+x.w+'</td><td class="n">'+x.l+'</td><td class="n">'+(x.nrr>=0?'+':'')+x.nrr.toFixed(2)+'</td><td class="n"><b>'+x.pts+'</b></td></tr>';}).join('');
      var last=App.results.slice(-4).reverse().map(function(r){return '<tr class="rowlink" onclick="location.hash=\'#/scorecard?i='+r.ix+'\'"><td>'+r.date+'</td><td>'+esc(r.home)+' v '+esc(r.away)+'</td><td>'+esc(r.result.text)+'</td></tr>';}).join('')||'<tr><td colspan=3 class="small">No matches played yet.</td></tr>';
      var xiRows=xi.map(function(p,i){return '<tr><td>'+(i+1)+'</td><td>'+foFlag(p.nat)+' '+foRoleImg(p)+' '+playerLink(p)+(p.keeper?' †':'')+'</td><td>'+prole(p.role)+'</td><td class="n">'+p.rating+'</td></tr>';}).join('');
      var kpi=function(lbl,val,tip){return '<div class="kpi-card" title="'+(tip||'')+'"><span>'+lbl+'</span><b>'+val+'</b></div>';};
      var nextHtml=nf?('<div class="fo-next"><div class="fo-next-l"><div class="eyebrow">Next match · '+(nf.isHome?'HOME':'AWAY')+'</div>'+
          '<div class="fo-next-opp">'+foFlag(nf.opp.nat||'')+' vs '+esc(nf.opp.name)+'</div>'+
          '<div class="small">'+nf.date.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})+' · '+esc(nf.venue)+' · <span title="'+(typeof pitchTip==='function'?pitchTip(nf.pitch):'')+'">'+esc(nf.pitch)+' pitch</span> · '+esc(nf.weather)+'</div></div>'+
          '<div class="fo-next-r"><button class="primary big" onclick="location.hash=\'#/orders\'">Prepare orders ▸</button> <button onclick="location.hash=\'#/matches\'">Round page</button></div></div>'):'';
      $('#page').innerHTML=crumb(t.name,'Club')+(typeof mpBanner==='function'?mpBanner():'')+
        '<div class="page-head"><div><div class="eyebrow">Club home</div><h1>'+esc(t.name)+'</h1><p class="small">Season '+(App.seasonNo||1)+' · Round '+Math.min(S.round+1,S.schedule.length)+' · <span id="clock"></span></p></div>'+
        '<div class="fo-form" title="Recent results (newest right)"><span class="small">Form</span> '+form+'</div></div>'+
        '<div class="kpi-grid">'+kpi('League position','<b>'+(pos>0?pos:'-')+'</b><span class="small"> / '+GD.teams.length+'</span>','Where you sit in the table')+
          kpi('Points',(rowsL.find(function(x){return x.nm===t.name;})||{pts:0}).pts,'League points (2 per win)')+
          kpi('Bank','$'+bank.toLocaleString(),'Cash available')+
          kpi('Wage bill','$'+wage.toLocaleString(),'Total weekly player wages')+
          kpi('Supporters mood',moodW,'Happier fans mean bigger gates')+'</div>'+
        nextHtml+
        '<div class="page-grid-2"><div>'+
          (topR||topW?('<div class="fo-stars">'+
            (topR?'<div class="fo-star"><span class="eyebrow">Leading run-scorer</span><div>'+foFlag((findPlayer(topR.nm)||{p:{}}).p.nat)+' <b>'+esc(topR.nm)+'</b></div><div class="fo-star-n">'+topR.r+'<span class="small"> runs</span></div></div>':'')+
            (topW?'<div class="fo-star"><span class="eyebrow">Leading wicket-taker</span><div>'+foFlag((findPlayer(topW.nm)||{p:{}}).p.nat)+' <b>'+esc(topW.nm)+'</b></div><div class="fo-star-n">'+topW.w+'<span class="small"> wkts</span></div></div>':'')+
          '</div>'):'')+
          '<div class="panel"><h4>Recent results</h4><div class="pad"><table><tr><th>Date</th><th>Match</th><th>Result</th></tr>'+last+'</table></div></div>'+
          ((App.news&&App.news.length)?('<div class="panel"><h4>Club news</h4><div class="pad">'+App.news.slice(0,5).map(function(n){return '<div class="bl small">'+esc(n)+'</div>';}).join('')+'</div></div>'):'')+
        '</div><div>'+
          '<div class="panel"><h4>League standings</h4><div class="pad"><table><tr><th>#</th><th>Club</th><th class="n">P</th><th class="n">W</th><th class="n">L</th><th class="n">NRR</th><th class="n">Pts</th></tr>'+tbl+'</table></div></div>'+
          '<div class="panel"><h4>Likely XI</h4><div class="pad"><table><tr><th>#</th><th>Player</th><th>Role</th><th class="n">Rat</th></tr>'+xiRows+'</table></div></div>'+
        '</div></div>';
      var tick=function(){var el=document.getElementById('clock');if(!el)return false;
        el.textContent=new Date().toLocaleString('en-GB',{weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});return true;};
      tick();if(window.__clk)clearInterval(window.__clk);window.__clk=setInterval(function(){if(!tick())clearInterval(window.__clk);},1000);
    }catch(e){console.error('[pgClub]',e);if(_pgClub)_pgClub();}
  };

  /* ================= #8/#15/#16 Orders — details up, working pool tabs, skill words, no over-strip ============ */
  var _pgOrders=window.pgOrders;
  window.pgOrders=function(){
    try{
      var t=userTeam();
      var opp=App.pending?App.pending:{home:t.name,away:'(no fixture)',ground:t.ground,pitch:'balanced',weather:'-',date:(typeof simDate==='function'?simDate():'')};
      var xi=pickXI(t);
      if(!App.orders.batOrder.length)App.orders.batOrder=xi.map(function(p){return p.name;});
      if(!App.orders.captain)App.orders.captain=xi.slice().sort(function(a,b){return (b.capt||0)-(a.capt||0);})[0].name;
      if(!App.orders.keeper||!xi.some(function(p){return p.name===App.orders.keeper;}))App.orders.keeper=(xi.find(function(p){return p.keeper;})||xi[0]).name;
      if(!App.orders.spells)App.orders.spells={north:[],south:[]};
      if(!App.orders.phaseIntent)App.orders.phaseIntent={pp:0,mid:0,death:1};
      if(!App.orders.fieldPlan)App.orders.fieldPlan={pp:'bal',mid:'bal',death:'att'};
      if(App.orders.tossCall!=='H'&&App.orders.tossCall!=='T')App.orders.tossCall='H'; // item 3: never prompt
      var v=compilePlan();
      var names=xi.map(function(p){return p.name;});
      var byName=function(n){return xi.find(function(p){return p.name===n;});};
      var dupes={};App.orders.batOrder.slice(0,11).forEach(function(n){dupes[n]=(dupes[n]||0)+1;});

      // MATCH DETAILS — moved to the very top
      var details='<div class="panel fo-orders-details"><h4>Match details</h4><div class="pad"><div class="fo-detgrid">'+
        '<div><span class="lbl" title="The two clubs in this fixture">Fixture</span><b>'+esc(opp.home)+' v '+esc(opp.away)+'</b></div>'+
        '<div><span class="lbl" title="Where the match is played">Ground</span><b>'+esc(opp.ground)+'</b></div>'+
        '<div><span class="lbl" title="'+(typeof pitchTip==='function'?pitchTip(opp.pitch):'Surface type')+'">Pitch</span><b>'+esc(opp.pitch)+'</b></div>'+
        '<div><span class="lbl" title="'+(typeof wxTip==='function'?wxTip(opp.weather):'Forecast')+'">Weather</span><b>'+esc(opp.weather)+'</b></div>'+
        '</div></div></div>';

      // BATTING ORDER — grid-aligned, no icons (item 2)
      var batRows=Array.from({length:11},function(_,i){
        var nm=App.orders.batOrder[i];var p=byName(nm);
        return '<div class="fo-batrow'+(dupes[nm]>1?' dup':'')+'">'+
          '<span class="bno">'+(i+1)+'</span>'+
          '<select onchange="App.orders.batOrder['+i+']=this.value;pgOrders()">'+names.map(function(n){return '<option '+(nm===n?'selected':'')+'>'+esc(n)+'</option>';}).join('')+'</select>'+
          '<span class="fo-batskill" title="Batting skill">'+(p?word(aggBat(p)):'')+(p&&p.keeper?' <span class="fo-wk" title="wicketkeeper">†</span>':'')+'</span>'+
          '<label class="fo-cwk" title="captain"><input type="radio" name="foc" '+(App.orders.captain===nm?'checked':'')+' onchange="App.orders.captain=\''+String(nm).replace(/'/g,'&#39;')+'\';pgOrders()"> C</label>'+
          '<label class="fo-cwk" title="wicketkeeper"><input type="radio" name="fowk" '+(App.orders.keeper===nm?'checked':'')+' onchange="App.orders.keeper=\''+String(nm).replace(/'/g,'&#39;')+'\';pgOrders()"> WK</label>'+
          '</div>';
      }).join('');
      var dupWarn=Object.keys(dupes).some(function(k){return dupes[k]>1;})?'<div class="warntxt">⚠ Duplicate batter in the order — fix before saving.</div>':'';
      var tactics='<div class="fo-tactics"><table style="border-collapse:collapse"><tr><th class="small" style="text-align:left;padding:2px 8px 2px 0">Phase</th><th class="small" style="text-align:left;padding:2px 8px 2px 0" title="How aggressively your batters play in each phase">Batting intent</th><th class="small" style="text-align:left;padding:2px 0" title="Field aggression when you are bowling">Field setting</th></tr>'+
        ['pp','mid','death'].map(function(ph){var lbl={pp:'Powerplay 1–10',mid:'Middle 11–40',death:'Death 41–50'}[ph];
          return '<tr><td class="small" style="padding:2px 8px 2px 0">'+lbl+'</td>'+
            '<td style="padding:2px 8px 2px 0"><select onchange="App.orders.phaseIntent[\''+ph+'\']=+this.value">'+[[-1,'Defend'],[0,'Normal'],[1,'Attack'],[2,'Launch']].map(function(o){return '<option value="'+o[0]+'" '+(App.orders.phaseIntent[ph]===o[0]?'selected':'')+'>'+o[1]+'</option>';}).join('')+'</select></td>'+
            '<td style="padding:2px 0"><select onchange="App.orders.fieldPlan[\''+ph+'\']=this.value">'+[['bal','Balanced'],['att','Attacking'],['def','Defensive']].map(function(o){return '<option value="'+o[0]+'" '+(App.orders.fieldPlan[ph]===o[0]?'selected':'')+'>'+o[1]+'</option>';}).join('')+'</select></td></tr>';}).join('')+'</table>'+
        '<div class="fo-tacrow" style="margin-top:5px"><span class="small" title="Your toss call — set it here, no prompt at the match">Toss call</span><select onchange="App.orders.tossCall=this.value"><option value="H" '+(App.orders.tossCall!=='T'?'selected':'')+'>Heads</option><option value="T" '+(App.orders.tossCall==='T'?'selected':'')+'>Tails</option></select>'+
        '<select onchange="App.orders.tossDecision=this.value"><option value="bat" '+(App.orders.tossDecision==='bat'?'selected':'')+'>Bat</option><option value="bowl" '+(App.orders.tossDecision==='bowl'?'selected':'')+'>Bowl</option></select></div></div>';

      // BOWLING (two ends) — no meaningless over-number strip (#15). Uses existing spellRowsHTML.
      var bowlEnds='<div class="fo-ends">'+
        ['north','south'].map(function(end){var label=end==='north'?'End A (odd overs 1,3,5…)':'End B (even overs 2,4,6…)';
          return '<div class="fo-end"><div class="fo-end-h" title="A bowler cannot bowl two overs in a row, so overs alternate between the two ends.">'+label+'</div>'+
            (typeof spellRowsHTML==='function'?spellRowsHTML(end):'')+'</div>';}).join('')+'</div>';

      // AVAILABLE PLAYERS — toggle (tabs) + sort (item 4), skill words, no icons
      App._poolTab=App._poolTab||'all';
      App._poolSort=App._poolSort||'rating';App._poolDir=App._poolDir||-1;
      var tabDef=[['all','All'],['bat','Batsmen'],['bowl','Bowlers'],['wk','Keepers']];
      var poolTabs=tabDef.map(function(td){return '<button class="fo-pooltab '+(App._poolTab===td[0]?'on':'')+'" onclick="App._poolTab=\''+td[0]+'\';pgOrders()">'+td[1]+'</button>';}).join('');
      var pool=t.players.filter(function(p){
        if(App._poolTab==='bat')return !p.bowlType&&!p.keeper;
        if(App._poolTab==='bowl')return !!p.bowlType;
        if(App._poolTab==='wk')return !!p.keeper;
        return true;});
      var sortF={name:function(p){return p.name.toLowerCase();},role:function(p){return prole(p.role);},
        rating:function(p){return p.rating;},bat:function(p){return aggBat(p);},
        bowl:function(p){return p.bowlType?aggBowl(p):-1;},keep:function(p){return p.keeper?aggKeep(p):-1;},
        age:function(p){return p.age;}}[App._poolSort]||function(p){return p.rating;};
      pool=pool.slice().sort(function(a,b){var x=sortF(a),y=sortF(b);return (x<y?-1:x>y?1:0)*App._poolDir;});
      var SH=function(key,lbl,numeric){var on=App._poolSort===key;
        return '<th class="'+(numeric?'n ':'')+'fo-sorth'+(on?' on':'')+'" onclick="foPoolSort(\''+key+'\','+(numeric?1:0)+')" title="Click to sort">'+lbl+(on?(App._poolDir<0?' ▾':' ▴'):'')+'</th>';};
      var poolRows=pool.map(function(p){return '<tr><td>'+foFlag(p.nat)+' '+playerLink(p)+(p.keeper?' <span class="fo-wk">†</span>':'')+'</td>'+
        '<td>'+prole(p.role)+'</td><td class="n">'+p.rating+'</td>'+
        '<td title="Batting skill">'+word(aggBat(p))+'</td>'+
        '<td title="Bowling skill">'+(p.bowlType?word(aggBowl(p)):'—')+'</td>'+
        '<td title="Keeping skill">'+(p.keeper?word(aggKeep(p)):'—')+'</td>'+
        '<td class="small">'+(foBT(p)||'—')+'</td></tr>';}).join('')||'<tr><td colspan=7 class="small">No players in this filter.</td></tr>';
      var pooltable='<div class="panel fo-pool"><h4>Available players</h4><div class="pad">'+
        '<div class="fo-pooltabs">'+poolTabs+'<span class="small" style="margin-left:auto;align-self:center">click a column to sort</span></div>'+
        '<table><tr>'+SH('name','Name')+SH('role','Role')+SH('rating','Rat',1)+SH('bat','Bat',1)+SH('bowl','Bowl',1)+SH('keep','Keep',1)+'<th>Type</th></tr>'+poolRows+'</table></div></div>';

      var saveRow='<div class="ctlrow" style="margin-top:6px">'+
        '<button class="primary" onclick="App.orders.saved=true;App.defaults=JSON.parse(JSON.stringify(App.orders));if(App.pending){location.hash=\'#/match\'}else{pgOrders()}">Save orders'+(App.pending?' → match':'')+'</button>'+
        '<button onclick="suggestOrders&&suggestOrders()">Suggest all</button>'+
        '<button onclick="App.orders.batOrder=[];App.orders.spells={north:[],south:[]};App.orders.grid=null;App.orders.gridBowlers=null;pgOrders()">Clear</button>'+
        '<b class="'+(v.covered===50?'oktxt':'warntxt')+'" style="margin-left:auto">'+v.covered+' / 50 overs</b></div>'+
        (v.warns&&v.warns.length?('<div>'+v.warns.map(function(w){return '<div class="warntxt">⚠ '+esc(w)+'</div>';}).join('')+'</div>'):(v.covered===50?'<div class="oktxt">Bowling plan is legal.</div>':'<div class="small">Unassigned overs fall to the AI captain.</div>'))+
        (App.orders.saved?'<div class="oktxt">Orders saved.</div>':'');

      $('#page').innerHTML=crumb(opp.home+' v '+opp.away,'Orders')+
        details+
        '<div class="fo-orders-main">'+
          '<div class="panel fo-batpanel"><h4>Batting order &amp; tactics</h4><div class="pad">'+batRows+dupWarn+tactics+'</div></div>'+
          '<div class="panel fo-bowlpanel"><h4>Bowling orders</h4><div class="pad">'+
            '<div class="ctlrow" style="margin-bottom:5px"><button onclick="applyPreset&&applyPreset(\'best\')">Best five</button><button onclick="applyPreset&&applyPreset(\'pace\')">Pace-led</button><button onclick="applyPreset&&applyPreset(\'spin\')">Spin-led</button><label class="small"><input type="checkbox" '+(App.orders.showPT?'checked':'')+' onchange="App.orders.showPT=this.checked;pgOrders()"> show part-timers</label></div>'+
            bowlEnds+'</div></div>'+
        '</div>'+
        saveRow+
        pooltable;
    }catch(e){console.error('[pgOrders]',e);if(_pgOrders)_pgOrders();}
  };

  /* ================= #10 Scorecard — aligned, bowler type, captain(c)/keeper(†), LHB/RHB ============ */
  var _pgScorecard=window.pgScorecard;
  window.pgScorecard=function(q){
    try{
      q=q||{};
      var innings,meta;
      if(q.i!==undefined&&App.results[+q.i]){var r=App.results[+q.i];innings=r.innings;meta=r;}
      else if(typeof M!=='undefined'&&M){innings=M.innings;meta={home:M.meta.home,away:M.meta.away,ground:M.meta.ground,pitch:M.pitch,weather:M.meta.weather,result:M.result||{text:'in progress'},worm:M.worm};}
      if(!innings||!innings[0]){$('#page').innerHTML=crumb('Scorecard')+'<div class="panel"><div class="pad">No match selected. See <a href="#/matches">Matches</a>.</div></div>';return;}
      var capName=(typeof App!=='undefined'&&App.orders&&App.orders.captain)||null;
      // item 6: the ONE keeper who actually manned the stumps for teamName.
      // When teamName fields, they appear as bowlTeam in the other innings whose bxi has exactly one keeper flag set.
      function actualKeeper(teamName){
        for(var i=0;i<innings.length;i++){var inn=innings[i];
          if(inn&&inn.bowlTeam===teamName&&inn.bxi){var k=inn.bxi.find(function(p){return p.keeper;});if(k)return k.name;}}
        // fallback (e.g. in-progress first innings): user orders, else best keeper-role batter
        try{if(teamName===userTeam().name&&App.orders&&App.orders.keeper)return App.orders.keeper;}catch(e){}
        var team=GD.teams.find(function(t){return t.name===teamName;});
        if(team){var ks=team.players.filter(function(p){return p.keeper;}).sort(function(a,b){return b.bat-a.bat;});if(ks[0])return ks[0].name;}
        return null;
      }
      function markers(inn,p){
        var m='';
        var cap=inn.captBatName||(inn.batTeam===((App.orders&&userTeam().name))?capName:null);
        if(cap&&p.name===cap)m+=' <span class="fo-cap" title="captain">(c)</span>';
        if(p.name===actualKeeper(inn.batTeam))m+=' <span class="fo-wk" title="wicketkeeper">†</span>';
        return m;
      }
      var cards=innings.filter(Boolean).map(function(inn){
        var bat=inn.bat.filter(function(b){return b.b>0||b.out;}).map(function(b){
          return '<tr><td class="fo-bat-nm">'+playerLink(b.p)+markers(inn,b.p)+' <span class="small fo-hand">'+foHand(b.p)+'</span></td>'+
            '<td class="fo-out">'+esc(b.out||'not out')+'</td>'+
            '<td class="n"><b>'+b.r+'</b></td><td class="n">'+b.b+'</td><td class="n">'+b.f4+'</td><td class="n">'+b.f6+'</td><td class="n">'+(b.b?(100*b.r/b.b).toFixed(0):'-')+'</td></tr>';}).join('');
        var ex=inn.extras||{wd:0,nb:0,b:0,lb:0};
        var bowl=Object.values(inn.bowlers).sort(function(a,b){return b.w-a.w||a.r-b.r;}).map(function(rr){
          var type=(typeof shortBT==='function')?shortBT(rr.p):'';
          return '<tr><td class="fo-bat-nm">'+playerLink(rr.p)+' <span class="small fo-type" title="bowling type">'+esc(type)+'</span></td>'+
            '<td class="n">'+Math.floor(rr.b/6)+'.'+(rr.b%6)+'</td><td class="n">'+(rr.mdn||0)+'</td><td class="n">'+rr.r+'</td><td class="n"><b>'+rr.w+'</b></td>'+
            '<td class="n">'+(rr.b?(rr.r/(rr.b/6)).toFixed(2):'-')+'</td><td class="n">'+(rr.wd||0)+'</td><td class="n">'+(rr.nb||0)+'</td></tr>';}).join('');
        var fow=(inn.fow||[]).map(function(f){return f.w+'-'+f.sc+' ('+esc(f.who)+')';}).join(', ')||'-';
        return '<div class="panel"><h4>'+esc(inn.batTeam)+' — '+inn.runs+'/'+inn.wkts+' ('+Math.floor(inn.legal/6)+'.'+(inn.legal%6)+' ov)</h4><div class="pad">'+
          '<table class="fo-scorecard"><thead><tr><th>Batter</th><th>How out</th><th class="n">R</th><th class="n">B</th><th class="n">4s</th><th class="n">6s</th><th class="n">SR</th></tr></thead><tbody>'+bat+
          '<tr class="fo-extras"><td colspan="2">Extras <span class="small">(b '+ex.b+', lb '+ex.lb+', w '+ex.wd+', nb '+ex.nb+')</span></td><td class="n"><b>'+(ex.wd+ex.nb+ex.b+ex.lb)+'</b></td><td colspan="4"></td></tr>'+
          '<tr class="fo-total"><td colspan="2"><b>Total</b></td><td class="n"><b>'+inn.runs+'</b></td><td colspan="4" class="small">'+inn.wkts+' wkts, '+(inn.legal/6).toFixed(1)+' ov · RR '+(inn.legal?(inn.runs/(inn.legal/6)).toFixed(2):'0')+'</td></tr></tbody></table>'+
          '<table class="fo-bowling" style="margin-top:8px"><thead><tr><th>Bowler</th><th class="n">O</th><th class="n">M</th><th class="n">R</th><th class="n">W</th><th class="n">Econ</th><th class="n">Wd</th><th class="n">Nb</th></tr></thead><tbody>'+bowl+'</tbody></table>'+
          '<div class="small" style="margin-top:6px"><b>Fall:</b> '+fow+'</div></div></div>';
      }).join('');
      var tossTxt=meta.toss||(innings[0]?(esc(innings[0].batTeam)+' batted first'):'');
      $('#page').innerHTML=crumb((meta.home||'')+' v '+(meta.away||''),'Scorecard')+
        '<div class="navsub"><b>'+esc(meta.result?meta.result.text:'')+'</b>'+(meta.ground?(' · '+esc(meta.ground)+' · '+esc(meta.pitch||'')+' pitch · '+esc(meta.weather||'')):'')+'</div>'+
        (tossTxt?'<div class="fo-toss small">Toss: '+esc(tossTxt)+'</div>':'')+cards;
    }catch(e){console.error('[pgScorecard]',e);if(_pgScorecard)_pgScorecard(q);}
  };

  /* ================= #5 Player page — FTP "Details" layout ============ */
  var _pgPlayer=window.pgPlayer;
  window.pgPlayer=function(q){
    try{
      q=q||{};var hit=findPlayer(q.n||'');
      if(!hit){$('#page').innerHTML='<div class="panel"><div class="pad">Player not found.</div></div>';return;}
      var p=hit.p,team=hit.team;
      var allr=Math.round((aggBat(p)+aggBowl(p))/2*(aggBat(p)>40&&aggBowl(p)>40?1:0.4));
      var btl=foBT(p);
      var tal=(p.talents&&p.talents.length)?p.talents.map(foAbil).join(' '):'<span class="small">None</span>';
      // ---- career aggregation from match history ----
      var H=App.playerHist[p.name]||[];
      var bat={mat:0,inns:0,no:0,runs:0,balls:0,hs:0,outs:0,s4:0,s6:0,f50:0,f100:0};
      var bwl={mat:0,balls:0,runs:0,w:0,bestW:0,bestR:9999,f5:0};
      H.forEach(function(h){
        if(h.bb>0||h.o){bat.inns++;bat.runs+=h.rr||0;bat.balls+=h.bb||0;if(!h.o)bat.no++;bat.hs=Math.max(bat.hs,h.rr||0);bat.outs+=h.o?1:0;bat.s4+=h.s4||0;bat.s6+=h.s6||0;if((h.rr||0)>=50&&(h.rr||0)<100)bat.f50++;if((h.rr||0)>=100)bat.f100++;}
        if(h.cb>0){bwl.balls+=h.cb||0;bwl.runs+=h.cr||0;bwl.w+=h.w||0;if((h.w||0)>bwl.bestW||((h.w||0)===bwl.bestW&&(h.cr||0)<bwl.bestR)){bwl.bestW=h.w||0;bwl.bestR=h.cr||0;}if((h.w||0)>=5)bwl.f5++;}
      });
      var mat=H.length;bat.mat=mat;bwl.mat=mat;
      var ave=bat.outs?(bat.runs/bat.outs).toFixed(1):(bat.runs?'∞':'-');
      var sr=bat.balls?(100*bat.runs/bat.balls).toFixed(1):'-';
      var bave=bwl.w?(bwl.runs/bwl.w).toFixed(1):'-';var econ=bwl.balls?(bwl.runs/(bwl.balls/6)).toFixed(2):'-';var bsr=bwl.w?(bwl.balls/bwl.w).toFixed(1):'-';
      var best=bwl.bestW?(bwl.bestW+'-'+bwl.bestR):'-';
      var recent=H.slice(-6).reverse();
      var recentRows=recent.length?recent.map(function(h){return '<tr><td>'+esc(h.date)+'</td><td>OD</td><td>'+esc(h.teams)+'</td><td>'+esc(h.bat)+'</td><td>'+esc(h.bowl)+'</td><td>'+(h.o?'':'')+'</td></tr>';}).join(''):'<tr><td colspan=6 class="small">No matches yet.</td></tr>';
      var wageDisc=(p.wage||0);
      var trainSel='';try{var progs=(typeof window.FO_TRAIN_PROGS==='object')?Object.keys(window.FO_TRAIN_PROGS):['none','Batting','Bowling','Fielding','Keeping','Endurance','Rest'];var cur=(p.training&&p.training.program)||p.trainFocus||'none';trainSel='<select onchange="setTrain(\''+p.name.replace(/'/g,'&#39;')+'\',this.value)">'+progs.map(function(k){return '<option '+(cur===k?'selected':'')+'>'+k+'</option>';}).join('')+'</select>';}catch(e){}
      $('#page').innerHTML=crumb(team.name,p.name,'Details')+
      '<div class="fo-pl-grid">'+
        '<div class="fo-pl-main">'+
          // top row: Player Info + Skills Summary
          '<div class="fo-pl-two">'+
            '<div class="panel"><h4>Player info</h4><div class="pad fo-pinfo">'+
              '<div class="fo-pinfo-top">'+p.age+'y · <b>'+p.rating+'</b> rating · $'+wageDisc.toLocaleString()+' wage</div>'+
              '<div class="fo-pinfo-hand">'+(p.hand==='R'?'Right':'Left')+' hand batsman &nbsp;|&nbsp; '+(btl||'does not bowl')+'</div>'+
              '<table class="kv fo-pinfo-kv">'+
                '<tr><td>Talents</td><td>'+tal+'</td></tr>'+
                '<tr><td>Nationality</td><td>'+foFlag(p.nat)+' '+esc(p.nat)+'</td></tr>'+
                '<tr><td>Role</td><td>'+prole(p.role)+'</td></tr>'+
                '<tr><td>Form</td><td>'+esc(p.formWord||'-')+'</td></tr>'+
                '<tr><td>Fatigue</td><td>'+esc(p.fatigue||'-')+'</td></tr>'+
                '<tr><td>Experience</td><td>'+esc(p.expWord||'')+' <span class="small">('+p.exp+')</span></td></tr>'+
                '<tr><td>Captaincy</td><td>'+word(p.capt||30)+'</td></tr>'+
              '</table></div></div>'+
            '<div class="panel"><h4>Skills summary</h4><div class="pad">'+
              bar(aggBat(p),'Batsman')+'<br>'+bar(aggBowl(p),'Bowler')+'<br>'+bar(aggKeep(p),'Keeper')+'<br>'+bar(allr,'Allrounder')+
              '<div class="small" style="margin-top:6px;color:#888">Notes: '+(p.talents&&p.talents.length?'carries '+p.talents.length+' talent'+(p.talents.length>1?'s':''):'no special talents')+'.</div>'+
            '</div></div>'+
          '</div>'+
          // skills panel (two columns like FTP)
          '<div class="panel"><h4>Skills</h4><div class="pad fo-pl-skills">'+
            '<div>'+bar(aggBat(p),'Batting')+'<br>'+bar(aggBowl(p),'Bowling')+'<br>'+bar(aggKeep(p),'Keeping')+'<br>'+bar(aggField(p),'Fielding')+'</div>'+
            '<div>'+bar(aggEnd(p),'Endurance')+'<br>'+bar(aggTech(p),'Technique')+'<br>'+bar(S(p).power,'Power')+'</div>'+
            '<div class="fo-pl-adv"><details class="adv"><summary>Advanced engine view</summary><table class="kv">'+
              ['vsPace','vsSpin','power','rotation','temperament','wicket','economy','discipline','moveTurn','variation','stamina','fielding','catching','keeping','stumping'].map(function(k){return '<tr><td>'+k+'</td><td>'+(S(p)[k]!=null?S(p)[k]:0)+' <span class="small">('+word(S(p)[k]||0)+')</span></td></tr>';}).join('')+
            '</table></details></div>'+
          '</div></div>'+
          // recent matches
          '<div class="panel"><h4>Recent matches</h4><div class="pad"><table><tr><th>Date</th><th>Class</th><th>Teams</th><th>Batting</th><th>Bowling</th><th>Fielding</th></tr>'+recentRows+'</table></div></div>'+
          // career stats (FTP-style League & Cup)
          '<div class="panel"><h4>Career — One Day</h4><div class="pad">'+
            '<div class="small" style="margin:2px 0 3px"><b>Batting</b></div>'+
            '<table><tr><th>Class</th><th class="n">Mat</th><th class="n">Inns</th><th class="n">NO</th><th class="n">Runs</th><th class="n">HS</th><th class="n">Ave</th><th class="n">SR</th><th class="n">100</th><th class="n">50</th><th class="n">4s</th><th class="n">6s</th></tr>'+
            '<tr><td>One Day</td><td class="n">'+bat.mat+'</td><td class="n">'+bat.inns+'</td><td class="n">'+bat.no+'</td><td class="n"><b>'+bat.runs+'</b></td><td class="n">'+bat.hs+'</td><td class="n">'+ave+'</td><td class="n">'+sr+'</td><td class="n">'+bat.f100+'</td><td class="n">'+bat.f50+'</td><td class="n">'+bat.s4+'</td><td class="n">'+bat.s6+'</td></tr></table>'+
            '<div class="small" style="margin:6px 0 3px"><b>Bowling &amp; Fielding</b></div>'+
            '<table><tr><th>Class</th><th class="n">Mat</th><th class="n">Balls</th><th class="n">Runs</th><th class="n">Wkts</th><th class="n">Best</th><th class="n">Ave</th><th class="n">Econ</th><th class="n">SR</th><th class="n">5WI</th></tr>'+
            '<tr><td>One Day</td><td class="n">'+bwl.mat+'</td><td class="n">'+bwl.balls+'</td><td class="n">'+bwl.runs+'</td><td class="n"><b>'+bwl.w+'</b></td><td class="n">'+best+'</td><td class="n">'+bave+'</td><td class="n">'+econ+'</td><td class="n">'+bsr+'</td><td class="n">'+bwl.f5+'</td></tr></table>'+
          '</div></div>'+
        '</div>'+
        // right sidebar (FTP Links / Training)
        '<div class="fo-pl-side">'+
          '<div class="panel"><h4>Links</h4><div class="pad fo-pl-links">'+
            '<a href="#/squad">Back to squad</a><a href="#/stats">Season stats</a>'+
          '</div></div>'+
          (team.name===((typeof userTeam==='function')?userTeam().name:'')?('<div class="panel"><h4>Training</h4><div class="pad">'+trainSel+'<div class="small" style="margin-top:4px">Applied at the end of each round.</div></div></div>'):'')+
        '</div>'+
      '</div>';
    }catch(e){console.error('[pgPlayer]',e);if(_pgPlayer)_pgPlayer(q);}
  };

  /* ================= #11/#17 Match centre: worm off scoreboard + LHB/RHB + bowler type ============ */
  if(typeof window.renderMatch==='function'){
    var _renderMatch=window.renderMatch;
    window.renderMatch=function(){
      _renderMatch.apply(this,arguments);
      try{
        // #17 remove worm graphic from the live scoreboard (keep the Worm tab)
        document.querySelectorAll('.mc-score svg, .fo-scoreboard svg, .scoreboard svg').forEach(function(s){
          // only kill small inline worms inside the scoreboard panel, not tab charts
          s.style.display='none';
        });
        // #11 annotate striker/non-striker hand + bowler type onto the scoreboard
        if(typeof M!=='undefined'&&M&&!M.done&&M.innings&&M.innings[M.inns]){
          var inn=M.innings[M.inns];
          var s1=inn.bat[inn.striker],s2=inn.bat[inn.nonstriker];
          var bw=inn.bxi.find(function(p){return p.name===inn.curBowlerName;});
          var host=document.querySelector('.mc-score .pad')||document.querySelector('.fo-scoreboard .pad');
          if(host&&!host.querySelector('.fo-handinfo')){
            var el=document.createElement('div');el.className='fo-handinfo small';
            var bits=[];
            if(s1)bits.push('* '+esc(s1.p.name)+' <span class="fo-hand">'+foHand(s1.p)+'</span>');
            if(s2&&!s2.out)bits.push(esc(s2.p.name)+' <span class="fo-hand">'+foHand(s2.p)+'</span>');
            if(bw)bits.push('bowling: '+esc(bw.name)+' <span class="fo-type">'+((typeof shortBT==='function')?esc(shortBT(bw)):'')+'</span>');
            el.innerHTML=bits.join(' · ');
            host.appendChild(el);
          }
        }
        // #8 prepend the FTP-style match intro to the commentary feed
        var fc=document.getElementById('ftpcomm');
        if(fc&&!fc.querySelector('.fo-comm-intro')){var intro=foCommIntro();if(intro)fc.insertAdjacentHTML('afterbegin',intro);}
        foDecorate();
      }catch(e){console.error('[renderMatch wrap]',e);}
    };
  }

  /* ================= #12 commentary ability tooltips + #5 flags + #16 sweep (post-render) ============ */
  function foAbilizeNode(node){
    if(!node||node.dataset.foab)return;node.dataset.foab='1';
    var html=node.innerHTML;var changed=false;
    Object.keys(ABIL).forEach(function(name){
      if(!name)return;
      var re=new RegExp('\\b('+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')\\b','ig');
      if(re.test(html)){changed=true;html=html.replace(re,'<span class="foabil" title="'+String(ABIL[name]).replace(/"/g,'&quot;')+'">$1</span>');}
    });
    if(changed)node.innerHTML=html;
  }
  function foDecorate(){
    try{
      // flags on any remaining natpills we can resolve
      document.querySelectorAll('.natpill:not([data-fo])').forEach(function(el){
        var code=el.textContent.trim();var d=FLAG[code]||FLAG[NORM[code]];
        if(d){el.dataset.fo='1';el.style.cssText='background:none;border:none;padding:0;min-width:0';el.innerHTML='<img class="foflag" src="'+d+'" title="'+code+'">';}
      });
      // ability tooltips inside commentary feeds
      document.querySelectorAll('.commfeed .bl:not([data-foab]), #ftpcomm .text:not([data-foab])').forEach(foAbilizeNode);
      // #16 sweep any stray "Does not bowl" text nodes in kv tables we didn't rebuild
      document.querySelectorAll('.kv td, .meta').forEach(function(el){
        if(el.childElementCount===0&&/Does not bowl/.test(el.textContent)){el.textContent=el.textContent.replace(/\s*·?\s*Does not bowl/,'').replace(/Does not bowl/,'—');}
      });
    }catch(e){}
  }
  window.foDecorate=foDecorate;

  /* run decoration after every route */
  if(typeof window.route==='function'){
    var _route=window.route;
    window.route=function(){_route.apply(this,arguments);setTimeout(foDecorate,0);};
  }
  window.addEventListener('hashchange',function(){setTimeout(foDecorate,30);});

  /* initial paint */
  try{if(typeof route==='function')route();setTimeout(foDecorate,10);}catch(e){console.error(e);}
})();

