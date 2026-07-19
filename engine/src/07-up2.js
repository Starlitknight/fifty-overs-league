
/* ============================================================================
   FIFTY OVERS — v8 corrections (loads AFTER the v6/v7 patch, so these win)
   Addresses: draft layout back to full-skill cards + flags; orders align/no-icons/
   H-T toss/sortable pool; FTP player page; scorecard one-keeper + toss line;
   commentary "Bowler to Batsman :" prefix + FTP structure.
   ============================================================================ */
(function(){
  if(typeof document==='undefined')return;
  var foFlag=window.foFlag, foBT=window.foBT, foAbil=window.foAbil;

  /* ===================== #1 DRAFT: full-skill cards (image-2 layout) + flags ===================== */
  window.draftBlock=function(p,picked,afford,spent){
    var tals=(p.talents&&p.talents.length)?(' &nbsp;'+p.talents.map(foAbil).join(' ')):'';
    var bt=foBT(p);bt=bt?(' | '+bt):'';
    return '<div class="pblock draft-pblock'+(picked?' picked':'')+'">'+
      '<div class="hd" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'+
        '<span>'+foFlag(p.nat)+' <b style="font-size:13px">'+esc(p.name)+'</b>'+(p.keeper?' †':'')+'</span>'+
        '<span class="meta">'+prole(p.role)+' · age '+p.age+' · rating <b>'+p.rating+'</b></span>'+
        '<span style="flex:1"></span>'+
        '<span style="font-size:13px"><b>$'+p.fee.toLocaleString()+'</b></span>'+
        '<button class="'+(picked?'':'primary')+'" '+((!picked&&!afford)?'disabled title="over budget"':'')+' onclick="founderTake(\''+p.name.replace(/'/g,'&#39;')+'\')">'+(picked?'Drop':'Sign')+'</button>'+
      '</div>'+
      '<div class="meta">'+(p.hand==='R'?'Right':'Left')+' hand batsman'+bt+' · exp '+esc(p.expWord||p.exp)+tals+'</div>'+
      '<div class="cols">'+
        '<div>'+bar(aggBat(p),'Batting')+'<br>'+bar(aggBowl(p),'Bowling')+'<br>'+bar(aggKeep(p),'Keeping')+'</div>'+
        '<div>'+bar(aggEnd(p),'Endurance')+'<br>'+bar(aggTech(p),'Technique')+'<br>'+bar(S(p).power,'Power')+'</div>'+
        '<div>'+bar(aggField(p),'Fielding')+'</div>'+
      '</div></div>';
  };
  window.pgFounder=function(){
    var F=App.founder;if(!F||!F.pool){founderStart();return;}
    App._draftSort=App._draftSort||'fee';App._draftRole=App._draftRole||'all';
    var spent=founderSpent(),left=F.budget-spent;
    var rcls=function(p){return p.keeper?'wk':(p.role==='allRounder'?'ar':(p.bowlTypeFull!=='none'?'bowl':'bat'));};
    var list=F.pool.filter(function(p){return App._draftRole==='all'||rcls(p)===App._draftRole;});
    var keyf={fee:function(p){return -p.fee;},rating:function(p){return -p.rating;},bat:function(p){return -aggBat(p);},
      bowl:function(p){return -(p.bowlType?aggBowl(p):0);},power:function(p){return -p.skills.power;},
      field:function(p){return -aggField(p);},keep:function(p){return -p.skills.keeping;},age:function(p){return p.age;}}[App._draftSort]||function(p){return -p.fee;};
    list=list.slice().sort(function(a,b){return keyf(a)-keyf(b);});
    var c={bat:0,bowl:0,ar:0,wk:0};F.picked.forEach(function(p){var k=rcls(p);c[k]=(c[k]||0)+1;});
    var bowlOptions=F.picked.filter(function(p){return p.bowlTypeFull!=='none';}).length;
    var rf=function(t,lbl){return '<button class="chip '+(App._draftRole===t?'on':'')+'" onclick="App._draftRole=\''+t+'\';pgFounder()">'+lbl+'</button>';};
    var sf=function(t){return '<button class="chip '+(App._draftSort===t?'on':'')+'" onclick="App._draftSort=\''+t+'\';pgFounder()">'+t+'</button>';};
    var bench=F.picked.slice().sort(function(a,b){return b.rating-a.rating;});
    var squadRows=bench.length?bench.map(function(p){return '<div class="sqrow">'+foFlag(p.nat)+
      ' <span class="sqname">'+esc(p.name.split(' ').slice(-1)[0])+(p.keeper?' †':'')+'</span>'+
      '<span class="small sqrole">'+prole(p.role).split(' ')[0]+'</span>'+
      '<span class="small sqfee">$'+(p.fee/1000)+'k</span>'+
      '<a class="sqx" onclick="founderTake(\''+p.name.replace(/'/g,'&#39;')+'\')">✕</a></div>';}).join(''):'<div class="small" style="padding:8px;color:#999">Empty. Sign players and they appear here.</div>';
    var warn=[];if(c.wk<1)warn.push('no wicketkeeper');if(bowlOptions<5)warn.push(bowlOptions+'/5 bowling options');if(F.picked.length<11)warn.push(F.picked.length+'/11 players');
    var ready=F.picked.length>=11&&c.wk>=1&&bowlOptions>=5&&left>=0;
    var budgetPct=Math.max(0,Math.min(100,100*spent/F.budget));
    $('#page').innerHTML='<div class="crumb">'+esc(F.name)+' <span class="sep">&raquo;</span> Draft your squad</div>'+
      '<div class="grid2 draftgrid"><div class="col">'+
        '<div class="panel"><div class="pad" style="padding:6px 8px">'+
          '<div class="ctlrow" style="margin-bottom:4px"><span class="small" style="min-width:32px">Show</span>'+rf('all','All')+rf('bat','Batters')+rf('bowl','Bowlers')+rf('ar','All-rounders')+rf('wk','Keepers')+'</div>'+
          '<div class="ctlrow"><span class="small" style="min-width:32px">Sort</span>'+['fee','rating','bat','bowl','power','field','keep','age'].map(sf).join('')+'</div>'+
        '</div></div>'+
        list.map(function(p){return draftBlock(p,F.picked.indexOf(p)>=0,spent+p.fee<=F.budget,spent);}).join('')+
      '</div><div class="col draftside">'+
        '<div class="panel budgetcard"><div class="pad">'+
          '<div class="small">BUDGET REMAINING</div>'+
          '<div class="budgetbig" style="color:'+(left<0?'#a33328':'#1c5537')+'">$'+left.toLocaleString()+'</div>'+
          '<div class="budgetbar"><i style="width:'+budgetPct+'%"></i></div>'+
          '<div class="small" style="margin-top:3px">Spent $'+spent.toLocaleString()+' of $'+F.budget.toLocaleString()+'</div>'+
          '<div class="squadmeta"><span><b>'+F.picked.length+'</b> players <span class="small">(min 11, max 16)</span></span>'+
            '<span class="'+(c.wk>=1?'':'need')+'">'+c.wk+' WK</span><span class="'+(bowlOptions>=5?'':'need')+'">'+bowlOptions+' bowl</span>'+
            '<span>'+c.bat+' bat</span><span>'+c.ar+' all-r</span></div>'+
          '<button class="primary confirmbtn" '+(ready?'':'disabled')+' onclick="founderConfirm()">Confirm squad &amp; finish ▸</button>'+
          (warn.length?'<div class="warntxt" style="margin-top:4px;font-size:11px">Still need: '+warn.join(' · ')+'</div>':'<div class="oktxt" style="margin-top:4px;font-size:11px">Legal squad. Confirm when ready.</div>')+
        '</div></div>'+
        '<div class="panel"><h4>Your squad ('+F.picked.length+')</h4><div class="pad" style="padding:3px 5px;max-height:340px;overflow-y:auto">'+squadRows+'</div></div>'+
      '</div></div>';
  };

  /* ===================== #2/#3/#4 ORDERS: aligned, no icons, H/T toss, sortable pool ===================== */
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
      if(!App.orders.tossCall)App.orders.tossCall='H';           /* #3: never "ask me" */
      var v=compilePlan();
      var names=xi.map(function(p){return p.name;});
      var byName=function(n){return xi.find(function(p){return p.name===n;});};
      var dupes={};App.orders.batOrder.slice(0,11).forEach(function(n){dupes[n]=(dupes[n]||0)+1;});

      var details='<div class="panel fo-orders-details"><h4>Match details</h4><div class="pad"><div class="fo-detgrid">'+
        '<div><span class="lbl" title="The two clubs in this fixture">Fixture</span><b>'+esc(opp.home)+' v '+esc(opp.away)+'</b></div>'+
        '<div><span class="lbl" title="Where the match is played">Ground</span><b>'+esc(opp.ground)+'</b></div>'+
        '<div><span class="lbl" title="'+(typeof pitchTip==='function'?pitchTip(opp.pitch):'Surface type')+'">Pitch</span><b>'+esc(opp.pitch)+'</b></div>'+
        '<div><span class="lbl" title="'+(typeof wxTip==='function'?wxTip(opp.weather):'Forecast')+'">Weather</span><b>'+esc(opp.weather)+'</b></div>'+
        '</div></div></div>';

      /* #2 aligned grid rows, NO role icons */
      var batRows=Array.from({length:11},function(_,i){
        var nm=App.orders.batOrder[i];var p=byName(nm);
        return '<div class="fo-batrow2'+(dupes[nm]>1?' dup':'')+'">'+
          '<span class="bno">'+(i+1)+'</span>'+
          '<select onchange="App.orders.batOrder['+i+']=this.value;pgOrders()">'+names.map(function(n){return '<option '+(nm===n?'selected':'')+'>'+esc(n)+'</option>';}).join('')+'</select>'+
          '<span class="bskill" title="Batting skill">'+(p?word(aggBat(p)):'')+'</span>'+
          '<span class="bwk">'+(p&&p.keeper?'†':'')+'</span>'+
          '<label class="bopt" title="captain"><input type="radio" name="foc" '+(App.orders.captain===nm?'checked':'')+' onchange="App.orders.captain=\''+String(nm).replace(/'/g,'&#39;')+'\';pgOrders()"> C</label>'+
          '<label class="bopt" title="wicketkeeper"><input type="radio" name="fowk" '+(App.orders.keeper===nm?'checked':'')+' onchange="App.orders.keeper=\''+String(nm).replace(/'/g,'&#39;')+'\';pgOrders()"> WK</label>'+
          '</div>';
      }).join('');
      var dupWarn=Object.keys(dupes).some(function(k){return dupes[k]>1;})?'<div class="warntxt">⚠ Duplicate batter — fix before saving.</div>':'';

      var tactics='<div class="fo-tactics"><table style="border-collapse:collapse"><tr><th class="small" style="text-align:left;padding:2px 8px 2px 0">Phase</th><th class="small" style="text-align:left;padding:2px 8px 2px 0" title="How aggressively your batters play in each phase">Batting intent</th><th class="small" style="text-align:left;padding:2px 0" title="Field aggression when you bowl">Field setting</th></tr>'+
        ['pp','mid','death'].map(function(ph){var lbl={pp:'Powerplay 1–10',mid:'Middle 11–40',death:'Death 41–50'}[ph];
          return '<tr><td class="small" style="padding:2px 8px 2px 0">'+lbl+'</td>'+
            '<td style="padding:2px 8px 2px 0"><select onchange="App.orders.phaseIntent[\''+ph+'\']=+this.value">'+[[-1,'Defend'],[0,'Normal'],[1,'Attack'],[2,'Launch']].map(function(o){return '<option value="'+o[0]+'" '+(App.orders.phaseIntent[ph]===o[0]?'selected':'')+'>'+o[1]+'</option>';}).join('')+'</select></td>'+
            '<td style="padding:2px 0"><select onchange="App.orders.fieldPlan[\''+ph+'\']=this.value">'+[['bal','Balanced'],['att','Attacking'],['def','Defensive']].map(function(o){return '<option value="'+o[0]+'" '+(App.orders.fieldPlan[ph]===o[0]?'selected':'')+'>'+o[1]+'</option>';}).join('')+'</select></td></tr>';}).join('')+'</table>'+
        /* #3: manager sets Heads/Tails — no "ask me" */
        '<div class="fo-tacrow" style="margin-top:5px"><span class="small" title="You call the coin — no prompt mid-match">Toss call</span><select onchange="App.orders.tossCall=this.value">'+
          '<option value="H" '+(App.orders.tossCall==='H'?'selected':'')+'>Heads</option><option value="T" '+(App.orders.tossCall==='T'?'selected':'')+'>Tails</option></select>'+
          '<select onchange="App.orders.tossDecision=this.value"><option value="bat" '+(App.orders.tossDecision==='bat'?'selected':'')+'>Bat</option><option value="bowl" '+(App.orders.tossDecision==='bowl'?'selected':'')+'>Bowl</option></select></div></div>';

      var bowlEnds='<div class="fo-ends">'+['north','south'].map(function(end){var label=end==='north'?'End A (odd overs 1,3,5…)':'End B (even overs 2,4,6…)';
        return '<div class="fo-end"><div class="fo-end-h" title="Overs alternate between the two ends; a bowler can\'t bowl two in a row.">'+label+'</div>'+(typeof spellRowsHTML==='function'?spellRowsHTML(end):'')+'</div>';}).join('')+'</div>';

      /* #4 available players: toggle (tabs) + SORTABLE columns, NO icons */
      App._poolTab=App._poolTab||'all';App._poolSort=App._poolSort||'rat';App._poolDir=App._poolDir||1;
      var tabDef=[['all','All'],['bat','Batsmen'],['bowl','Bowlers'],['wk','Keepers']];
      var poolTabs=tabDef.map(function(td){return '<button class="fo-pooltab '+(App._poolTab===td[0]?'on':'')+'" onclick="App._poolTab=\''+td[0]+'\';pgOrders()">'+td[1]+'</button>';}).join('');
      var pool=t.players.filter(function(p){if(App._poolTab==='bat')return !p.bowlType&&!p.keeper;if(App._poolTab==='bowl')return !!p.bowlType;if(App._poolTab==='wk')return !!p.keeper;return true;});
      var sortKey={name:function(p){return p.name;},role:function(p){return prole(p.role);},rat:function(p){return -p.rating;},bat:function(p){return -aggBat(p);},bowl:function(p){return -(p.bowlType?aggBowl(p):0);},keep:function(p){return -(p.keeper?aggKeep(p):0);}}[App._poolSort]||function(p){return -p.rating;};
      pool=pool.slice().sort(function(a,b){var x=sortKey(a),y=sortKey(b);return (x<y?-1:x>y?1:0)*App._poolDir;});
      var sh=function(key,lbl,cls){var on=App._poolSort===key;return '<th class="'+(cls||'')+' fo-sorth'+(on?' on':'')+'" onclick="if(App._poolSort===\''+key+'\')App._poolDir*=-1;else{App._poolSort=\''+key+'\';App._poolDir=1;}pgOrders()">'+lbl+(on?(App._poolDir>0?' ▾':' ▴'):'')+'</th>';};
      var poolRows=pool.map(function(p){return '<tr><td>'+foFlag(p.nat)+' '+playerLink(p)+(p.keeper?' †':'')+'</td>'+
        '<td>'+prole(p.role)+'</td><td class="n">'+p.rating+'</td><td title="Batting skill">'+word(aggBat(p))+'</td>'+
        '<td title="Bowling skill">'+(p.bowlType?word(aggBowl(p)):'—')+'</td><td title="Keeping skill">'+(p.keeper?word(aggKeep(p)):'—')+'</td>'+
        '<td class="small">'+(foBT(p)||'—')+'</td></tr>';}).join('')||'<tr><td colspan=7 class="small">No players in this filter.</td></tr>';
      var pooltable='<div class="panel fo-pool"><h4>Available players</h4><div class="pad">'+
        '<div class="fo-pooltabs">'+poolTabs+'<span class="small" style="margin-left:auto;color:#888">click a column to sort</span></div>'+
        '<table><tr>'+sh('name','Name')+sh('role','Role')+sh('rat','Rat','n')+sh('bat','Bat')+sh('bowl','Bowl')+sh('keep','Keep')+'<th>Type</th></tr>'+poolRows+'</table></div></div>';

      var saveRow='<div class="ctlrow" style="margin-top:6px">'+
        '<button class="primary" onclick="App.orders.saved=true;App.defaults=JSON.parse(JSON.stringify(App.orders));if(App.pending){location.hash=\'#/match\'}else{pgOrders()}">Save orders'+(App.pending?' → match':'')+'</button>'+
        '<button onclick="suggestOrders&&suggestOrders()">Suggest all</button>'+
        '<button onclick="App.orders.batOrder=[];App.orders.spells={north:[],south:[]};App.orders.grid=null;App.orders.gridBowlers=null;pgOrders()">Clear</button>'+
        '<b class="'+(v.covered===50?'oktxt':'warntxt')+'" style="margin-left:auto">'+v.covered+' / 50 overs</b></div>'+
        (v.warns&&v.warns.length?('<div>'+v.warns.map(function(w){return '<div class="warntxt">⚠ '+esc(w)+'</div>';}).join('')+'</div>'):(v.covered===50?'<div class="oktxt">Bowling plan is legal.</div>':'<div class="small">Unassigned overs fall to the AI captain.</div>'))+
        (App.orders.saved?'<div class="oktxt">Orders saved.</div>':'');

      $('#page').innerHTML=crumb(opp.home+' v '+opp.away,'Orders')+details+
        '<div class="fo-orders-main">'+
          '<div class="panel fo-batpanel"><h4>Batting order &amp; tactics</h4><div class="pad">'+batRows+dupWarn+tactics+'</div></div>'+
          '<div class="panel fo-bowlpanel"><h4>Bowling orders</h4><div class="pad">'+
            '<div class="ctlrow" style="margin-bottom:5px"><button onclick="applyPreset&&applyPreset(\'best\')">Best five</button><button onclick="applyPreset&&applyPreset(\'pace\')">Pace-led</button><button onclick="applyPreset&&applyPreset(\'spin\')">Spin-led</button><label class="small"><input type="checkbox" '+(App.orders.showPT?'checked':'')+' onchange="App.orders.showPT=this.checked;pgOrders()"> show part-timers</label></div>'+
            bowlEnds+'</div></div>'+
        '</div>'+saveRow+pooltable;
    }catch(e){console.error('[pgOrders v8]',e);}
  };

  /* ===================== #5 PLAYER PAGE — FTP layout ===================== */
  function careerAgg(nm){
    var h=App.playerHist[nm]||[];var b={inns:0,runs:0,outs:0,hs:0,bf:0,h100:0,h50:0,s4:0,s6:0};
    var w={balls:0,runs:0,wkts:0,bestW:-1,bestR:0};
    h.forEach(function(e){
      if(e.bb>0||e.o){b.inns++;b.runs+=e.rr||0;b.outs+=e.o?1:0;b.bf+=e.bb||0;b.hs=Math.max(b.hs,e.rr||0);
        if((e.rr||0)>=100)b.h100++;else if((e.rr||0)>=50)b.h50++;b.s4+=e.s4||0;b.s6+=e.s6||0;}
      if(e.cb>0){w.balls+=e.cb;w.runs+=e.cr||0;w.wkts+=e.w||0;
        if((e.w||0)>w.bestW||((e.w||0)===w.bestW&&(e.cr||0)<w.bestR)){w.bestW=e.w||0;w.bestR=e.cr||0;}}
    });
    return {b:b,w:w};
  }
  window.pgPlayer=function(q){
    try{
      q=q||{};var hit=findPlayer(q.n||'');
      if(!hit){$('#page').innerHTML='<div class="panel"><div class="pad">Player not found.</div></div>';return;}
      var p=hit.p,team=hit.team;
      var allr=Math.round((aggBat(p)+aggBowl(p))/2*(aggBat(p)>40&&aggBowl(p)>40?1:0.4));
      var tal=(p.talents&&p.talents.length)?p.talents.map(foAbil).join(' '):'None';
      var btl=foBT(p)||'Does not bowl';
      var hist=(App.playerHist[p.name]||[]).slice(-6).reverse();
      var histRows=hist.length?hist.map(function(h){return '<tr><td>'+h.date+'</td><td>One Day</td><td>'+esc(h.teams)+'</td><td>'+esc(h.bat)+'</td><td>'+esc(h.bowl)+'</td><td>-</td></tr>';}).join(''):'<tr><td colspan=6 class="small">No recent matches yet.</td></tr>';
      var ca=careerAgg(p.name);var B=ca.b,W=ca.w;
      var batStat='<tr><td>One Day</td><td class="n">'+B.inns+'</td><td class="n">'+B.outs+'</td><td class="n">'+(B.inns-B.outs)+'</td><td class="n"><b>'+B.runs+'</b></td>'+
        '<td class="n">'+B.hs+'</td><td class="n">'+(B.outs?(B.runs/B.outs).toFixed(2):(B.runs?'—':'0'))+'</td><td class="n">'+B.bf+'</td><td class="n">'+(B.bf?(100*B.runs/B.bf).toFixed(1):'0')+'</td><td class="n">'+B.h100+'</td><td class="n">'+B.h50+'</td><td class="n">'+B.s4+'</td><td class="n">'+B.s6+'</td></tr>';
      var bowlStat='<tr><td>One Day</td><td class="n">'+W.balls+'</td><td class="n">'+W.runs+'</td><td class="n"><b>'+W.wkts+'</b></td>'+
        '<td class="n">'+(W.bestW>=0?W.bestW+'-'+W.bestR:'—')+'</td><td class="n">'+(W.wkts?(W.runs/W.wkts).toFixed(2):'—')+'</td><td class="n">'+(W.balls?(W.runs/(W.balls/6)).toFixed(2):'—')+'</td><td class="n">'+(W.wkts?(W.balls/W.wkts).toFixed(1):'—')+'</td></tr>';
      $('#page').innerHTML=crumb(team.name,p.name,'Details')+
        '<div class="grid2"><div class="col">'+
          '<div class="panel"><h4>Player info</h4><div class="pad">'+
            '<div class="ftp-pinfo-top">'+p.age+'y · <b>'+p.rating+'</b> rating · $'+(p.wage||0).toLocaleString()+' wage</div>'+
            '<div class="ftp-pinfo-hand">'+(p.hand==='R'?'Right':'Left')+' hand batsman | '+esc(btl)+'</div>'+
            '<table class="kv" style="margin-top:5px">'+
              '<tr><td>Talents</td><td>'+tal+'</td></tr>'+
              '<tr><td>Nationality</td><td>'+foFlag(p.nat)+' '+esc(p.nat)+'</td></tr>'+
              '<tr><td>Form</td><td>'+esc(p.formWord||'-')+'</td></tr>'+
              '<tr><td>Fatigue</td><td>'+esc(p.fatigue||'-')+'</td></tr>'+
              '<tr><td>Experience</td><td>'+esc(p.expWord||'')+' <span class="small">('+p.exp+')</span></td></tr>'+
              '<tr><td>Captaincy</td><td>'+word(p.capt||30)+'</td></tr></table></div></div>'+
        '</div><div class="col">'+
          '<div class="panel"><h4>Skills summary</h4><div class="pad">'+
            bar(aggBat(p),'Batsman')+'<br>'+bar(aggBowl(p),'Bowler')+'<br>'+bar(aggKeep(p),'Keeper')+'<br>'+bar(allr,'Allrounder')+'</div></div>'+
        '</div></div>'+
        '<div class="panel"><h4>Skills</h4><div class="pad"><div class="ftp-skills-2col">'+
          '<div>'+bar(aggBat(p),'Batting')+'<br>'+bar(aggBowl(p),'Bowling')+'<br>'+bar(aggKeep(p),'Keeping')+'<br>'+bar(aggField(p),'Fielding')+'</div>'+
          '<div>'+bar(aggEnd(p),'Endurance')+'<br>'+bar(aggTech(p),'Technique')+'<br>'+bar(S(p).power,'Power')+'</div></div>'+
          '<details class="adv"><summary>Advanced engine view</summary><table class="kv">'+
            ['vsPace','vsSpin','power','rotation','temperament','wicket','economy','discipline','moveTurn','variation','stamina','fielding','catching','keeping','stumping'].map(function(k){return '<tr><td>'+k+'</td><td>'+(S(p)[k]!=null?S(p)[k]:0)+' <span class="small">('+word(S(p)[k]||0)+')</span></td></tr>';}).join('')+
          '</table></details></div></div>'+
        '<div class="panel"><h4>Recent matches</h4><div class="pad"><table><tr><th>Date</th><th>Class</th><th>Teams</th><th>Batting</th><th>Bowling</th><th>Fielding</th></tr>'+histRows+'</table></div></div>'+
        '<div class="panel"><h4>Batting &amp; fielding</h4><div class="pad"><table><tr><th>Class</th><th class="n">Inns</th><th class="n">No</th><th class="n">Outs</th><th class="n">Runs</th><th class="n">HS</th><th class="n">Ave</th><th class="n">BF</th><th class="n">SR</th><th class="n">100</th><th class="n">50</th><th class="n">4s</th><th class="n">6s</th></tr>'+batStat+'</table></div></div>'+
        '<div class="panel"><h4>Bowling</h4><div class="pad"><table><tr><th>Class</th><th class="n">Balls</th><th class="n">Runs</th><th class="n">Wkts</th><th class="n">Best</th><th class="n">Ave</th><th class="n">Econ</th><th class="n">SR</th></tr>'+bowlStat+'</table></div></div>';
    }catch(e){console.error('[pgPlayer v8]',e);}
  };

  /* ===================== #6/#7 SCORECARD — one real keeper + toss line ===================== */
  function keeperFromDismissals(inn){
    if(!inn||!inn.bat)return null;var counts={};
    inn.bat.forEach(function(b){var o=b.out||'';
      var m=o.match(/†\s*([A-Za-z][A-Za-z.'\- ]+?)\s+b\s/)||o.match(/^st\s+†?\s*([A-Za-z][A-Za-z.'\- ]+?)\s+b\s/);
      if(m){var nm=m[1].trim();counts[nm]=(counts[nm]||0)+1;}});
    var best=null,bv=0;for(var k in counts)if(counts[k]>bv){bv=counts[k];best=k;}
    return best;
  }
  function tossLine(meta,innings){
    if(meta&&meta.toss)return esc(meta.toss);
    if(innings&&innings[0])return esc(innings[0].batTeam)+' batted first';
    return '';
  }
  window.pgScorecard=function(q){
    try{
      q=q||{};var innings,meta;
      if(q.i!==undefined&&App.results[+q.i]){var r=App.results[+q.i];innings=r.innings;meta=r;}
      else if(typeof M!=='undefined'&&M){innings=M.innings;meta={home:M.meta.home,away:M.meta.away,ground:M.meta.ground,pitch:M.pitch,weather:M.meta.weather,result:M.result||{text:'in progress'},toss:M.tossText||(App.tossState&&App.tossState.txt)};}
      if(!innings||!innings[0]){$('#page').innerHTML=crumb('Scorecard')+'<div class="panel"><div class="pad">No match selected.</div></div>';return;}
      var all=innings.filter(Boolean);
      var cards=all.map(function(inn,idx){
        var other=all[all.length===2?(1-idx):idx];  /* team's keeper kept in the OTHER innings */
        var keeperNm=keeperFromDismissals(other);
        var capNm=inn.captBatName||((typeof App!=='undefined'&&App.orders&&inn.batTeam===userTeam().name)?App.orders.captain:null);
        function mark(pl){var m='';if(capNm&&pl.name===capNm)m+=' <span class="fo-cap" title="captain">(c)</span>';
          if(keeperNm&&pl.name===keeperNm)m+=' <span class="fo-wk" title="kept wicket this match">†</span>';return m;}
        var bat=inn.bat.filter(function(b){return b.b>0||b.out;}).map(function(b){
          return '<tr><td class="fo-bat-nm">'+playerLink(b.p)+mark(b.p)+' <span class="small fo-hand">'+(b.p.hand==='L'?'LHB':'RHB')+'</span></td>'+
            '<td class="fo-out">'+esc(b.out||'not out')+'</td><td class="n"><b>'+b.r+'</b></td><td class="n">'+b.b+'</td><td class="n">'+b.f4+'</td><td class="n">'+b.f6+'</td><td class="n">'+(b.b?(100*b.r/b.b).toFixed(0):'-')+'</td></tr>';}).join('');
        var ex=inn.extras||{wd:0,nb:0,b:0,lb:0};
        var bowl=Object.values(inn.bowlers).sort(function(a,b){return b.w-a.w||a.r-b.r;}).map(function(rr){
          var type=(typeof shortBT==='function')?shortBT(rr.p):'';
          return '<tr><td class="fo-bat-nm">'+playerLink(rr.p)+' <span class="small fo-type" title="bowling type">'+esc(type)+'</span></td>'+
            '<td class="n">'+Math.floor(rr.b/6)+'.'+(rr.b%6)+'</td><td class="n">'+(rr.mdn||0)+'</td><td class="n">'+rr.r+'</td><td class="n"><b>'+rr.w+'</b></td><td class="n">'+(rr.b?(rr.r/(rr.b/6)).toFixed(2):'-')+'</td><td class="n">'+(rr.wd||0)+'</td><td class="n">'+(rr.nb||0)+'</td></tr>';}).join('');
        var fow=(inn.fow||[]).map(function(f){return f.w+'-'+f.sc+' ('+esc(f.who)+')';}).join(', ')||'-';
        return '<div class="panel"><h4>'+esc(inn.batTeam)+' — '+inn.runs+'/'+inn.wkts+' ('+Math.floor(inn.legal/6)+'.'+(inn.legal%6)+' ov)</h4><div class="pad">'+
          '<table class="fo-scorecard"><thead><tr><th>Batter</th><th>How out</th><th class="n">R</th><th class="n">B</th><th class="n">4s</th><th class="n">6s</th><th class="n">SR</th></tr></thead><tbody>'+bat+
          '<tr class="fo-extras"><td colspan="2">Extras <span class="small">(b '+ex.b+', lb '+ex.lb+', w '+ex.wd+', nb '+ex.nb+')</span></td><td class="n"><b>'+(ex.wd+ex.nb+ex.b+ex.lb)+'</b></td><td colspan="4"></td></tr>'+
          '<tr class="fo-total"><td colspan="2"><b>Total</b></td><td class="n"><b>'+inn.runs+'</b></td><td colspan="4" class="small">'+inn.wkts+' wkts, '+(inn.legal/6).toFixed(1)+' ov · RR '+(inn.legal?(inn.runs/(inn.legal/6)).toFixed(2):'0')+'</td></tr></tbody></table>'+
          '<table class="fo-bowling" style="margin-top:8px"><thead><tr><th>Bowler</th><th class="n">O</th><th class="n">M</th><th class="n">R</th><th class="n">W</th><th class="n">Econ</th><th class="n">Wd</th><th class="n">Nb</th></tr></thead><tbody>'+bowl+'</tbody></table>'+
          '<div class="small" style="margin-top:6px"><b>Fall:</b> '+fow+'</div></div></div>';
      }).join('');
      $('#page').innerHTML=crumb((meta.home||'')+' v '+(meta.away||''),'Scorecard')+
        '<div class="navsub"><b>'+esc(meta.result?meta.result.text:'')+'</b>'+(meta.ground?(' · '+esc(meta.ground)+' · '+esc(meta.pitch||'')+' pitch · '+esc(meta.weather||'')):'')+
        '<br><span class="fo-toss" title="Result of the coin toss">Toss: '+tossLine(meta,all)+'</span></div>'+cards;
    }catch(e){console.error('[pgScorecard v8]',e);}
  };

  /* ---- store toss text on the match + saved result (#7) ---- */
  if(typeof window.applyToss==='function'){var _applyToss=window.applyToss;
    window.applyToss=function(){_applyToss.apply(this,arguments);try{if(typeof M!=='undefined'&&M&&App.tossState&&App.tossState.txt)M.tossText=App.tossState.txt;}catch(e){}};}
  if(typeof window.saveMatch==='function'){var _saveMatch=window.saveMatch;
    window.saveMatch=function(m){var r=_saveMatch.apply(this,arguments);try{if(m&&m.tossText&&App.results&&App.results.length)App.results[App.results.length-1].toss=m.tossText;}catch(e){}return r;};}

  /* ===================== #8 COMMENTARY — "Bowler to Batsman :" + FTP structure ===================== */
  /* wrap apply() (a global fn) to tag each ball's log entry with bowler+striker — no probability change */
  if(typeof window.apply==='function'){var _apply=window.apply;
    window.apply=function(inn,out,d,sb,bowler,brec,over,intent,field,userBat){
      _apply.apply(this,arguments);
      try{var bw=bowler&&bowler.name, st=sb&&sb.p&&sb.p.name;
        if(typeof M!=='undefined'&&M&&M.log){for(var i=0;i<M.log.length;i++){if(!M.log[i].mile){if(!M.log[i].bowlerNm){M.log[i].bowlerNm=bw;M.log[i].strikerNm=st;}break;}}}
      }catch(e){}
    };
  }
  var last=function(n){return n?String(n).split(' ').slice(-1)[0]:'';};
  function wkt(o){return o&&o.charAt(0)==='w'&&o!=='wide';}
  function ftpRslt(o){
    if(o==='4')return '<span class="four">4</span>';
    if(o==='6')return '<span class="six">6</span>';
    if(wkt(o))return '<span class="wicket">W</span>';
    if(o==='wide')return '<span class="exb">wd</span>';
    if(o==='noball')return '<span class="exb">nb</span>';
    if(o==='bye'||o==='legbye')return '<span class="exb">b</span>';
    if(o==='dot'||!o)return '.';
    return String(o);
  }
  function abilize(t){var h=(typeof esc==='function')?esc(t||''):String(t||'');
    try{Object.keys(TALN).forEach(function(k){var nm=ptal(k);var re=new RegExp('\\b('+nm.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')\\b','ig');
      h=h.replace(re,'<span class="foabil" title="'+String(TALTIPS[k]||'').replace(/"/g,'&quot;')+'">$1</span>');});}catch(e){}
    return h;}
  window.ftpCommHTML=function(log,filter,limit){
    filter=filter||'all';
    var rows=(log||[]).filter(function(L){
      if(filter==='all')return true;
      if(filter==='wickets')return wkt(L.out)||/WICKET/i.test(L.txt||'');
      if(filter==='boundaries')return L.out==='4'||L.out==='6';
      if(filter==='overs')return L.mile||/End of over|DRINKS|Innings break/i.test(L.txt||'');
      if(filter==='highlights')return L.mile||wkt(L.out)||L.out==='4'||L.out==='6';
      return true;
    }).slice(0,limit||150).map(function(L){
      if(L.mile||/^End of over/i.test(L.txt||'')){
        return '<div class="oversummary-bottom"><div class="text">'+abilize(L.txt)+'</div><div class="clear"></div></div>';
      }
      var prefix=(L.bowlerNm&&L.strikerNm)?(esc(last(L.bowlerNm))+' to '+esc(last(L.strikerNm))+' : '):'';
      var rowcls=L.out==='4'?'four':L.out==='6'?'six':wkt(L.out)?'line wkt':'line';
      return '<div class="'+rowcls+'"><div class="del">'+esc(L.no||'')+'</div><div class="rslt">'+ftpRslt(L.out)+
        '</div><div class="text">'+prefix+abilize(L.txt)+'</div><div class="clear"></div></div>';
    }).join('');
    return rows||'<div class="line"><div class="text" style="padding-left:8px">No commentary matches this filter.</div><div class="clear"></div></div>';
  };

  /* refresh current view */
  try{if(typeof route==='function')route();if(typeof foDecorate==='function')setTimeout(foDecorate,10);}catch(e){console.error(e);}
})();

