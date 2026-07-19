
/* ============================================================================
   FIFTY OVERS — v9 corrections (loads LAST, wins over v6/v7/v8)
   1 dense club · 2 FTP over-summary · 3 live scorecard bowler type ·
   4 post-match tabs · 5 player skills emphasis · 6 recent-match links ·
   7 clean talents · 8 orders layout · 9 live ratings alignment
   ============================================================================ */
(function(){
  if(typeof document==='undefined')return;
  var foFlag=window.foFlag, foBT=window.foBT, foAbil=window.foAbil, foRoleImg=window.foRoleImg;
  function shortType(p){try{return (typeof shortBT==='function')?shortBT(p).toLowerCase():'';}catch(e){return '';}}
  function initial(nm){var parts=String(nm||'').split(' ');return parts.length>1?(parts[0][0]+'. '+parts.slice(-1)[0]):nm;}

  /* ===================== #1 CLUB — dense FTP-style dashboard ===================== */
  window.pgClub=function(){
    try{
      seasonInit();econInit();
      var t=userTeam();var S=App.season;var xi=pickXI(t);
      var rowsL=leagueRows();var pos=rowsL.findIndex(function(x){return x.nm===t.name;})+1;
      var mine=App.results.filter(function(r){return r.home===t.name||r.away===t.name;});
      var form=mine.slice(-6).map(function(r){var w=r.result.winner===t.name;var tie=!r.result.winner;var cls=tie?'d':(w?'w':'l');
        return '<span class="formpip '+cls+'" title="'+esc(r.result.text)+'">'+(tie?'T':(w?'W':'L'))+'</span>';}).join('')||'<span class="small">no matches yet</span>';
      var nf=(typeof nextFixture==='function')?nextFixture():null;
      // top performers
      var agg={};for(var nm in App.playerHist){var a={nm:nm,r:0,w:0,ct:0};App.playerHist[nm].forEach(function(h){a.r+=h.rr||0;a.w+=h.w||0;});
        var fp=findPlayer(nm);if(fp&&fp.team.name===t.name)agg[nm]=a;}
      var arr=Object.values(agg);var topR=arr.slice().sort(function(a,b){return b.r-a.r;})[0];var topW=arr.slice().sort(function(a,b){return b.w-a.w;})[0];
      var bank=(App.fin&&App.fin.bank)||0, wage=t.players.reduce(function(s,p){return s+(+p.wage||0);},0);
      var moodW=['furious','angry','unhappy','steady','pleased','delighted','euphoric'][Math.max(0,Math.min(6,t.mood==null?3:t.mood))];
      // upcoming fixtures (next 4)
      var ups=[];for(var r=S.round;r<S.schedule.length&&ups.length<4;r++){for(var fi=0;fi<S.schedule[r].length;fi++){var f=S.schedule[r][fi];
        if(f[0]!==App.teamIx&&f[1]!==App.teamIx)continue;if(S.played[fixtureKey(r,f)]!==undefined)continue;
        var home=GD.teams[f[0]];var opp=GD.teams[f[0]===App.teamIx?f[1]:f[0]];var d=new Date(2026,6,4);d.setDate(d.getDate()+7*r);
        ups.push('<tr><td>'+d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})+'</td><td>R'+(r+1)+'</td><td>'+(f[0]===App.teamIx?'vs':'@')+' '+esc(opp.name)+'</td><td class="small">'+esc(home.ground)+' ('+groundPitch(home.ground)+')</td></tr>');}}
      var last=mine.slice(-4).reverse().map(function(r){return '<tr class="rowlink" onclick="location.hash=\'#/scorecard?i='+r.ix+'\'"><td>'+r.date+'</td><td>'+esc(r.home)+' v '+esc(r.away)+'</td><td>'+esc(r.result.text)+'</td></tr>';}).join('')||'<tr><td colspan=3 class="small">No matches played yet.</td></tr>';
      var tbl=rowsL.map(function(x,i){return '<tr '+(x.nm===t.name?'class="myrow"':'')+'><td>'+(i+1)+'</td><td>'+(i===0?'🏆 ':'')+esc(x.nm)+'</td><td class="n">'+x.p+'</td><td class="n">'+x.w+'</td><td class="n">'+x.l+'</td><td class="n">'+(x.nrr>=0?'+':'')+x.nrr.toFixed(2)+'</td><td class="n"><b>'+x.pts+'</b></td></tr>';}).join('');
      var xiRows=xi.map(function(p,i){return '<tr><td>'+(i+1)+'</td><td>'+foFlag(p.nat)+' '+foRoleImg(p)+' '+playerLink(p)+(p.keeper?' †':'')+'</td><td>'+prole(p.role)+'</td><td class="n">'+p.rating+'</td></tr>';}).join('');
      var kpi=function(lbl,val,tip){return '<div class="kpi-card" title="'+(tip||'')+'"><span>'+lbl+'</span><b>'+val+'</b></div>';};
      var nextHtml=nf?('<div class="panel fo-nextpanel"><h4>Next match — '+(nf.isHome?'Home':'Away')+'</h4><div class="pad"><table class="kv">'+
        '<tr><td>Opponent</td><td><b>'+esc(nf.opp.name)+'</b></td></tr>'+
        '<tr><td>Date</td><td>'+nf.date.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})+'</td></tr>'+
        '<tr><td>Venue</td><td>'+esc(nf.venue)+'</td></tr>'+
        '<tr><td>Conditions</td><td><span title="'+(typeof pitchTip==='function'?pitchTip(nf.pitch):'')+'">'+esc(nf.pitch)+' pitch</span> · '+esc(nf.weather)+'</td></tr></table>'+
        '<div class="ctlrow" style="margin-top:6px"><button class="primary" onclick="location.hash=\'#/orders\'">Prepare orders ▸</button><button onclick="location.hash=\'#/matches\'">Round page</button></div></div></div>'):'';
      $('#page').innerHTML=crumb(t.name,'Club')+(typeof mpBanner==='function'?mpBanner():'')+
        '<div class="page-head"><div><div class="eyebrow">Club home</div><h1>'+esc(t.name)+'</h1><p class="small">Season '+(App.seasonNo||1)+' · Round '+Math.min(S.round+1,S.schedule.length)+' · <span id="clock"></span></p></div>'+
        '<div class="fo-form" title="Recent form (newest right)"><span class="small">Form</span> '+form+'</div></div>'+
        '<div class="kpi-grid">'+kpi('League position','<b>'+(pos>0?pos:'-')+'</b><span class="small"> / '+GD.teams.length+'</span>','Table position')+
          kpi('Points',(rowsL.find(function(x){return x.nm===t.name;})||{pts:0}).pts,'League points')+
          kpi('Bank','$'+bank.toLocaleString(),'Cash available')+
          kpi('Wage bill','$'+wage.toLocaleString(),'Weekly wages')+
          kpi('Supporters mood',moodW,'Fan mood drives gate income')+'</div>'+
        '<div class="page-grid-2"><div>'+
          nextHtml+
          '<div class="panel"><h4>Recent results</h4><div class="pad"><table><tr><th>Date</th><th>Match</th><th>Result</th></tr>'+last+'</table></div></div>'+
          '<div class="panel"><h4>Upcoming fixtures</h4><div class="pad"><table><tr><th>Date</th><th>Rd</th><th>Match</th><th>Ground</th></tr>'+(ups.join('')||'<tr><td colspan=4 class="small">Season complete.</td></tr>')+'</table></div></div>'+
          '<div class="fo-stars">'+
            '<div class="fo-star"><span class="eyebrow">Leading run-scorer</span><div>'+(topR&&topR.r?foFlag((findPlayer(topR.nm)||{p:{}}).p.nat)+' <b>'+esc(topR.nm)+'</b>':'<span class="small">—</span>')+'</div><div class="fo-star-n">'+((topR&&topR.r)||0)+'<span class="small"> runs</span></div></div>'+
            '<div class="fo-star"><span class="eyebrow">Leading wicket-taker</span><div>'+(topW&&topW.w?foFlag((findPlayer(topW.nm)||{p:{}}).p.nat)+' <b>'+esc(topW.nm)+'</b>':'<span class="small">—</span>')+'</div><div class="fo-star-n">'+((topW&&topW.w)||0)+'<span class="small"> wkts</span></div></div>'+
          '</div>'+
          ((App.news&&App.news.length)?('<div class="panel"><h4>Club news</h4><div class="pad">'+App.news.slice(0,6).map(function(n){return '<div class="bl small">'+esc(n)+'</div>';}).join('')+'</div></div>'):'')+
        '</div><div>'+
          '<div class="panel"><h4>League standings</h4><div class="pad"><table><tr><th>#</th><th>Club</th><th class="n">P</th><th class="n">W</th><th class="n">L</th><th class="n">NRR</th><th class="n">Pts</th></tr>'+tbl+'</table></div></div>'+
          '<div class="panel"><h4>Finances</h4><div class="pad"><table class="kv"><tr><td>Bank</td><td><b>$'+bank.toLocaleString()+'</b></td></tr><tr><td>Weekly wages</td><td>$'+wage.toLocaleString()+'</td></tr><tr><td>Ground</td><td>'+esc(t.ground)+' · '+(t.seats||0).toLocaleString()+' seats</td></tr><tr><td>Supporters</td><td>'+((t.supporters||0).toLocaleString())+' ('+moodW+')</td></tr></table><div class="small" style="margin-top:3px"><a href="#/office">Full ledger &amp; academies ▸</a></div></div></div>'+
          '<div class="panel"><h4>Likely XI</h4><div class="pad"><table><tr><th>#</th><th>Player</th><th>Role</th><th class="n">Rat</th></tr>'+xiRows+'</table></div></div>'+
        '</div></div>';
      var tick=function(){var el=document.getElementById('clock');if(!el)return false;el.textContent=new Date().toLocaleString('en-GB',{weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});return true;};
      tick();if(window.__clk)clearInterval(window.__clk);window.__clk=setInterval(function(){if(!tick())clearInterval(window.__clk);},1000);
    }catch(e){console.error('[pgClub v9]',e);}
  };

  /* ===================== #2 FTP over-summary (batsman + bowler line) ===================== */
  if(typeof window.apply==='function'){var _apply9=window.apply;
    window.apply=function(inn,out,d,sb,bowler,brec,over,intent,field,userBat){
      _apply9.apply(this,arguments);
      try{
        if(typeof M!=='undefined'&&M&&M.log&&inn&&inn.legal%6===0&&inn.legal>0){
          for(var i=0;i<M.log.length;i++){var L=M.log[i];
            if(L.mile&&/^End of over/i.test(L.txt||'')&&!L._top){L._top=true;
              var s1=inn.bat[inn.striker],s2=inn.bat[inn.nonstriker];var parts=[];
              if(s1&&!s1.out)parts.push('<strong>'+esc(initial(s1.p.name))+'</strong> '+s1.r+' ('+s1.b+'b)');
              if(s2&&!s2.out&&s2!==s1)parts.push('<strong>'+esc(initial(s2.p.name))+'</strong> '+s2.r+' ('+s2.b+'b)');
              if(bowler&&brec){var bt=shortType(bowler);parts.push('<strong>'+esc(initial(bowler.name))+(bt?' ('+bt+')':'')+'</strong> '+Math.floor(brec.b/6)+'-'+brec.r+'-'+brec.w);}
              L.oversumTop=parts.join(', ');break;}
          }
        }
      }catch(e){}
    };
  }

  /* ===================== shared renderers ===================== */
  function markerFns(inn){
    var other=null;
    var capNm=inn.captBatName||((typeof App!=='undefined'&&App.orders&&inn.batTeam===userTeam().name)?App.orders.captain:null);
    return {cap:capNm};
  }
  function keeperFromDismissals(inn){if(!inn||!inn.bat)return null;var counts={};
    inn.bat.forEach(function(b){var o=b.out||'';var m=o.match(/†\s*([A-Za-z][A-Za-z.'\- ]+?)\s+b\s/)||o.match(/^st\s+†?\s*([A-Za-z][A-Za-z.'\- ]+?)\s+b\s/);
      if(m){var nm=m[1].trim();counts[nm]=(counts[nm]||0)+1;}});
    var best=null,bv=0;for(var k in counts)if(counts[k]>bv){bv=counts[k];best=k;}return best;}
  window.foScorecardCards=function(innings){
    var all=innings.filter(Boolean);
    return all.map(function(inn,idx){
      var other=all[all.length===2?(1-idx):idx];var keeperNm=keeperFromDismissals(other);
      var capNm=markerFns(inn).cap;
      function mark(pl){var m='';if(capNm&&pl.name===capNm)m+=' <span class="fo-cap" title="captain">(c)</span>';if(keeperNm&&pl.name===keeperNm)m+=' <span class="fo-wk" title="kept wicket this match">†</span>';return m;}
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
  };
  function wormSVG(worm,innings,target){
    if(!worm||!worm[0])return '<div class="small">No over data.</div>';
    var all=worm.filter(Boolean);var mx=Math.max.apply(null,all.flatMap(function(w){return w.map(function(p){return p[1];});}).concat([target||0])) +10;
    var mo=Math.max.apply(null,all.flatMap(function(w){return w.map(function(p){return p[0];});}).concat([50]));
    function line(w,col){return '<polyline fill="none" stroke="'+col+'" stroke-width="1.8" points="'+w.map(function(p){return (30+p[0]/mo*440).toFixed(1)+','+(190-p[1]/mx*168).toFixed(1);}).join(' ')+'"/>'+
      w.filter(function(p,i){return i>0&&(p[2]||0)>(w[i-1][2]||0);}).map(function(p){return '<circle cx="'+(30+p[0]/mo*440).toFixed(1)+'" cy="'+(190-p[1]/mx*168).toFixed(1)+'" r="2.8" fill="#a33328"/>';}).join('');}
    return '<svg width="500" height="205" style="max-width:100%">'+
      '<line x1="30" y1="190" x2="490" y2="190" stroke="#ccc"/><line x1="30" y1="10" x2="30" y2="190" stroke="#ccc"/>'+
      (worm[0]?line(worm[0],'#2d6a8f'):'')+(worm[1]?line(worm[1],'#c8a13a'):'')+'</svg>'+
      '<div class="small"><span style="color:#2d6a8f">■</span> '+esc(innings[0]?innings[0].batTeam:'')+' &nbsp; <span style="color:#c8a13a">■</span> '+esc(innings[1]?innings[1].batTeam:'')+' &nbsp; ● wicket</div>';
  }
  function ordersRecap(innings){
    return innings.filter(Boolean).map(function(inn){
      var batOrder=inn.bat.map(function(b,i){return '<tr><td class="n">'+(i+1)+'</td><td>'+playerLink(b.p)+(b.p.keeper?' †':'')+'</td><td class="small">'+prole(b.p.role)+'</td></tr>';}).join('');
      var bowlUse=Object.values(inn.bowlers).sort(function(a,b){return b.b-a.b;}).map(function(rr){return '<tr><td>'+playerLink(rr.p)+' <span class="small">'+((typeof shortBT==='function')?shortBT(rr.p):'')+'</span></td><td class="n">'+(rr.b/6).toFixed(1)+' ov</td><td class="n">'+rr.w+'/'+rr.r+'</td></tr>';}).join('');
      return '<div class="panel"><h4>'+esc(inn.batTeam)+' — batting order</h4><div class="pad"><table><tr><th class="n">#</th><th>Player</th><th>Role</th></tr>'+batOrder+'</table></div></div>'+
        '<div class="panel"><h4>'+esc(inn.batTeam)+' — bowlers used (when fielding)</h4><div class="pad"><table><tr><th>Bowler</th><th class="n">Overs</th><th class="n">Figures</th></tr>'+bowlUse+'</table></div></div>';
    }).join('');
  }

  /* ===================== #4 SCORECARD PAGE — post-match tabs ===================== */
  window.pgScorecard=function(q){
    try{
      q=q||{};var innings,meta,rObj=null;
      if(q.i!==undefined&&App.results[+q.i]){rObj=App.results[+q.i];innings=rObj.innings;meta=rObj;}
      else if(typeof M!=='undefined'&&M){innings=M.innings;meta={home:M.meta.home,away:M.meta.away,ground:M.meta.ground,pitch:M.pitch,weather:M.meta.weather,result:M.result||{text:'in progress'},toss:M.tossText,worm:M.worm,log:M.log,innings:M.innings};rObj=meta;}
      if(!innings||!innings[0]){$('#page').innerHTML=crumb('Scorecard')+'<div class="panel"><div class="pad">No match selected.</div></div>';return;}
      var all=innings.filter(Boolean);
      App._scTab=App._scTab||'card';
      var tabs=[['card','Scorecard'],['comm','Commentary'],['ratings','Match ratings'],['worm','Worm'],['orders','Orders']];
      var tabBar='<div class="fo-sctabs">'+tabs.map(function(td){return '<button class="fo-sctab '+(App._scTab===td[0]?'on':'')+'" onclick="App._scTab=\''+td[0]+'\';pgScorecard('+(q.i!==undefined?'{i:'+(+q.i)+'}':'{}')+')">'+td[1]+'</button>';}).join('')+'</div>';
      var body='';
      if(App._scTab==='card')body=foScorecardCards(innings);
      else if(App._scTab==='comm')body='<div class="panel"><h4>Ball-by-ball commentary</h4><div class="pad"><div id="ftpcomm">'+((rObj&&rObj.log&&typeof ftpCommHTML==='function')?ftpCommHTML(rObj.log,'all',400):'<div class="small">No commentary stored for this match.</div>')+'</div></div></div>';
      else if(App._scTab==='ratings')body='<div class="panel"><h4>Match ratings</h4><div class="pad fo-ratingswrap">'+((typeof ratingsTable==='function')?ratingsTable({home:meta.home,away:meta.away,innings:innings,result:meta.result}):'-')+'</div></div>';
      else if(App._scTab==='worm')body='<div class="panel"><h4>Worm chart</h4><div class="pad">'+wormSVG(meta.worm||(rObj&&rObj.worm),all,all[1]?all[1].runs+1:0)+'</div></div>';
      else if(App._scTab==='orders')body=ordersRecap(innings);
      $('#page').innerHTML=crumb((meta.home||'')+' v '+(meta.away||''),'Scorecard')+
        '<div class="navsub"><b>'+esc(meta.result?meta.result.text:'')+'</b>'+(meta.ground?(' · '+esc(meta.ground)+' · '+esc(meta.pitch||'')+' pitch · '+esc(meta.weather||'')):'')+
        '<br><span class="fo-toss" title="Coin toss">Toss: '+(meta.toss?esc(meta.toss):(esc(all[0].batTeam)+' batted first'))+'</span></div>'+
        tabBar+'<div class="ftpskin">'+body+'</div>';
    }catch(e){console.error('[pgScorecard v9]',e);}
  };

  /* ===================== #3/#9 LIVE match: replace Scorecard + Ratings tab bodies ===================== */
  if(typeof window.renderMatch==='function'){var _rm9=window.renderMatch;
    window.renderMatch=function(){_rm9.apply(this,arguments);
      try{
        if(typeof M==='undefined'||!M||!M.innings)return;
        var body=document.querySelector('.ftp-match-body');if(!body)return;
        var tab=(typeof UI!=='undefined'&&UI.matchTab)||'';
        if(tab==='Match Ratings'){ /* clean aligned ratings */
          body.innerHTML='<div class="match-subpanel"><div class="panel"><h4>Match ratings</h4><div class="pad fo-ratingswrap">'+
            ratingsTable({home:M.meta.home,away:M.meta.away,innings:M.innings,result:M.result||{text:M.done?'':'in progress'}})+'</div></div></div>';
        } else if(tab==='Scorecard'){ /* rebuild with bowler type + markers */
          body.innerHTML='<div class="match-subpanel">'+foScorecardCards(M.innings)+'</div>';
        }
      }catch(e){console.error('[renderMatch v9]',e);}
    };
  }

  /* ===================== #2 commentary: two-line over summary ===================== */
  function wkt(o){return o&&o.charAt(0)==='w'&&o!=='wide';}
  function ftpRslt(o){if(o==='4')return '<span class="four">4</span>';if(o==='6')return '<span class="six">6</span>';
    if(wkt(o))return '<span class="wicket">W</span>';if(o==='wide')return '<span class="exb">wd</span>';if(o==='noball')return '<span class="exb">nb</span>';
    if(o==='bye'||o==='legbye')return '<span class="exb">b</span>';if(o==='dot'||!o)return '.';return String(o);}
  function abilize(t){var h=(typeof esc==='function')?esc(t||''):String(t||'');try{Object.keys(TALN).forEach(function(k){var nm=ptal(k);var re=new RegExp('\\b('+nm.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')\\b','ig');h=h.replace(re,'<span class="foabil" title="'+String(TALTIPS[k]||'').replace(/"/g,'&quot;')+'">$1</span>');});}catch(e){}return h;}
  window.ftpCommHTML=function(log,filter,limit){filter=filter||'all';
    var rows=(log||[]).filter(function(L){if(filter==='all')return true;
      if(filter==='wickets')return wkt(L.out)||/WICKET/i.test(L.txt||'');
      if(filter==='boundaries')return L.out==='4'||L.out==='6';
      if(filter==='overs')return L.mile||/End of over|DRINKS|Innings break/i.test(L.txt||'');
      if(filter==='highlights')return L.mile||wkt(L.out)||L.out==='4'||L.out==='6';return true;
    }).slice(0,limit||150).map(function(L){
      if(L.mile||/^End of over/i.test(L.txt||'')){
        var top=L.oversumTop?('<div class="oversummary-top"><div class="text">'+L.oversumTop+'</div><div class="clear"></div></div>'):'';
        return top+'<div class="oversummary-bottom"><div class="text">'+abilize(L.txt)+'</div><div class="clear"></div></div>';}
      var prefix=(L.bowlerNm&&L.strikerNm)?(esc(String(L.bowlerNm).split(' ').slice(-1)[0])+' to '+esc(String(L.strikerNm).split(' ').slice(-1)[0])+' : '):'';
      var rowcls=L.out==='4'?'four':L.out==='6'?'six':wkt(L.out)?'line wkt':'line';
      return '<div class="'+rowcls+'"><div class="del">'+esc(L.no||'')+'</div><div class="rslt">'+ftpRslt(L.out)+'</div><div class="text">'+prefix+abilize(L.txt)+'</div><div class="clear"></div></div>';
    }).join('');
    return rows||'<div class="line"><div class="text" style="padding-left:8px">No commentary matches this filter.</div><div class="clear"></div></div>';};

  /* ===================== #5/#6 PLAYER PAGE — bigger Skills + recent-match links ===================== */
  function careerAgg(nm){var h=App.playerHist[nm]||[];var b={inns:0,runs:0,outs:0,hs:0,bf:0,h100:0,h50:0,s4:0,s6:0};var w={balls:0,runs:0,wkts:0,bestW:-1,bestR:0};
    h.forEach(function(e){if(e.bb>0||e.o){b.inns++;b.runs+=e.rr||0;b.outs+=e.o?1:0;b.bf+=e.bb||0;b.hs=Math.max(b.hs,e.rr||0);if((e.rr||0)>=100)b.h100++;else if((e.rr||0)>=50)b.h50++;b.s4+=e.s4||0;b.s6+=e.s6||0;}
      if(e.cb>0){w.balls+=e.cb;w.runs+=e.cr||0;w.wkts+=e.w||0;if((e.w||0)>w.bestW||((e.w||0)===w.bestW&&(e.cr||0)<w.bestR)){w.bestW=e.w||0;w.bestR=e.cr||0;}}});
    return {b:b,w:w};}
  function matchIxFor(h){for(var i=App.results.length-1;i>=0;i--){var r=App.results[i];if(r.date===h.date&&(r.home+' v '+r.away)===h.teams)return i;}return -1;}
  window.pgPlayer=function(q){
    try{q=q||{};var hit=findPlayer(q.n||'');if(!hit){$('#page').innerHTML='<div class="panel"><div class="pad">Player not found.</div></div>';return;}
      var p=hit.p,team=hit.team;var allr=Math.round((aggBat(p)+aggBowl(p))/2*(aggBat(p)>40&&aggBowl(p)>40?1:0.4));
      var tal=(p.talents&&p.talents.length)?p.talents.map(foAbil).join(' '):'None';var btl=foBT(p)||'Does not bowl';
      var hist=(App.playerHist[p.name]||[]).slice(-6).reverse();
      var histRows=hist.length?hist.map(function(h){var ix=matchIxFor(h);var cell=ix>=0?'<a href="#/scorecard?i='+ix+'">'+esc(h.teams)+'</a>':esc(h.teams);
        return '<tr class="'+(ix>=0?'rowlink':'')+'"'+(ix>=0?' onclick="location.hash=\'#/scorecard?i='+ix+'\'"':'')+'><td>'+h.date+'</td><td>One Day</td><td>'+cell+'</td><td>'+esc(h.bat)+'</td><td>'+esc(h.bowl)+'</td><td>-</td></tr>';}).join(''):'<tr><td colspan=6 class="small">No recent matches yet.</td></tr>';
      var ca=careerAgg(p.name);var B=ca.b,W=ca.w;
      var batStat='<tr><td>One Day</td><td class="n">'+B.inns+'</td><td class="n">'+B.outs+'</td><td class="n">'+(B.inns-B.outs)+'</td><td class="n"><b>'+B.runs+'</b></td><td class="n">'+B.hs+'</td><td class="n">'+(B.outs?(B.runs/B.outs).toFixed(2):(B.runs?'—':'0'))+'</td><td class="n">'+B.bf+'</td><td class="n">'+(B.bf?(100*B.runs/B.bf).toFixed(1):'0')+'</td><td class="n">'+B.h100+'</td><td class="n">'+B.h50+'</td><td class="n">'+B.s4+'</td><td class="n">'+B.s6+'</td></tr>';
      var bowlStat='<tr><td>One Day</td><td class="n">'+W.balls+'</td><td class="n">'+W.runs+'</td><td class="n"><b>'+W.wkts+'</b></td><td class="n">'+(W.bestW>=0?W.bestW+'-'+W.bestR:'—')+'</td><td class="n">'+(W.wkts?(W.runs/W.wkts).toFixed(2):'—')+'</td><td class="n">'+(W.balls?(W.runs/(W.balls/6)).toFixed(2):'—')+'</td><td class="n">'+(W.wkts?(W.balls/W.wkts).toFixed(1):'—')+'</td></tr>';
      var bigbar=function(v,lbl){var col=v>=70?'#2c7a2c':v>=45?'#c8a13a':'#a33328';return '<div class="fo-bigskill"><span class="fo-bigskill-l">'+lbl+'</span><span class="fo-bigskill-bar"><i style="width:'+Math.max(2,Math.min(100,v))+'%;background:'+col+'"></i></span><span class="fo-bigskill-w" style="color:'+col+'">'+word(v)+'</span></div>';};
      $('#page').innerHTML=crumb(team.name,p.name,'Details')+
        '<div class="grid2"><div class="col">'+
          '<div class="panel"><h4>Player info</h4><div class="pad">'+
            '<div class="ftp-pinfo-top">'+p.age+'y · <b>'+p.rating+'</b> rating · $'+(p.wage||0).toLocaleString()+' wage</div>'+
            '<div class="ftp-pinfo-hand">'+(p.hand==='R'?'Right':'Left')+' hand batsman | '+esc(btl)+'</div>'+
            '<table class="kv" style="margin-top:5px"><tr><td>Talents</td><td>'+tal+'</td></tr><tr><td>Nationality</td><td>'+foFlag(p.nat)+' '+esc(p.nat)+'</td></tr><tr><td>Form</td><td>'+esc(p.formWord||'-')+'</td></tr><tr><td>Fatigue</td><td>'+esc(p.fatigue||'-')+'</td></tr><tr><td>Experience</td><td>'+esc(p.expWord||'')+' <span class="small">('+p.exp+')</span></td></tr><tr><td>Captaincy</td><td>'+word(p.capt||30)+'</td></tr></table></div></div>'+
        '</div><div class="col">'+
          '<div class="panel"><h4>Skills summary</h4><div class="pad">'+bar(aggBat(p),'Batsman')+'<br>'+bar(aggBowl(p),'Bowler')+'<br>'+bar(aggKeep(p),'Keeper')+'<br>'+bar(allr,'Allrounder')+'</div></div>'+
        '</div></div>'+
        '<div class="panel fo-skills-panel"><h4>★ Skills</h4><div class="pad"><div class="ftp-skills-2col">'+
          '<div>'+bigbar(aggBat(p),'Batting')+bigbar(aggBowl(p),'Bowling')+bigbar(aggKeep(p),'Keeping')+bigbar(aggField(p),'Fielding')+'</div>'+
          '<div>'+bigbar(aggEnd(p),'Endurance')+bigbar(aggTech(p),'Technique')+bigbar(S(p).power,'Power')+'</div></div>'+
          '<details class="adv"><summary>Advanced engine view</summary><table class="kv">'+['vsPace','vsSpin','power','rotation','temperament','wicket','economy','discipline','moveTurn','variation','stamina','fielding','catching','keeping','stumping'].map(function(k){return '<tr><td>'+k+'</td><td>'+(S(p)[k]!=null?S(p)[k]:0)+' <span class="small">('+word(S(p)[k]||0)+')</span></td></tr>';}).join('')+'</table></details></div></div>'+
        '<div class="panel"><h4>Recent matches</h4><div class="pad"><table><tr><th>Date</th><th>Class</th><th>Teams</th><th>Batting</th><th>Bowling</th><th>Fielding</th></tr>'+histRows+'</table></div></div>'+
        '<div class="panel"><h4>Batting &amp; fielding</h4><div class="pad"><table><tr><th>Class</th><th class="n">Inns</th><th class="n">No</th><th class="n">Outs</th><th class="n">Runs</th><th class="n">HS</th><th class="n">Ave</th><th class="n">BF</th><th class="n">SR</th><th class="n">100</th><th class="n">50</th><th class="n">4s</th><th class="n">6s</th></tr>'+batStat+'</table></div></div>'+
        '<div class="panel"><h4>Bowling</h4><div class="pad"><table><tr><th>Class</th><th class="n">Balls</th><th class="n">Runs</th><th class="n">Wkts</th><th class="n">Best</th><th class="n">Ave</th><th class="n">Econ</th><th class="n">SR</th></tr>'+bowlStat+'</table></div></div>';
    }catch(e){console.error('[pgPlayer v9]',e);}
  };

  /* ===================== #8 ORDERS — fix truncation + stacked ends ===================== */
  var _pgOrders8=window.pgOrders;
  window.pgOrders=function(){
    if(_pgOrders8)_pgOrders8();
    // v8 built the DOM; here we only need CSS to reflow (handled in fopatch3.css).
  };

  try{if(typeof route==='function')route();if(typeof foDecorate==='function')setTimeout(foDecorate,10);}catch(e){console.error(e);}
})();

