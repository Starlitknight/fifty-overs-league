
(function(){
  // v11 visible-fix patch: uses lexical globals directly (App/M), not window.App/window.M.
  var FO11_FAT=['rested','revived','energetic','passable','satisfactory','moderate','weary','listless','exhausted','shattered','clinically dead'];
  var FO11_FIELD={att:'Attacking',bal:'Balanced',def:'Defensive'};
  var FO11_INTENT={'-1':'Defensive','0':'Normal','1':'Attacking','2':'Launch'};
  var FO11_PHASE={pp:'Powerplay 1-10',mid:'Middle 11-40',death:'Death 41-50'};
  function titleCase(s){s=String(s==null?'':s);return s.replace(/\b(green|dry|slow|cracked|flat|balanced|twoPaced|two paced|sunny|cloudy|overcast|humid|windy|hot|misty|chilly|rainy)\b/g,function(m){if(/^twoPaced$/i.test(m)||/^two paced$/i.test(m))return 'Two-Paced';return m.charAt(0).toUpperCase()+m.slice(1).toLowerCase();});}
  function shortName(p){var n=typeof p==='string'?p:(p&&p.name)||'';var a=String(n).trim().split(/\s+/);return a.length>1?(a[0].charAt(0)+'. '+a.slice(1).join(' ')):n;}
  function esc11(s){return (typeof esc==='function'?esc(String(s==null?'':s)):String(s==null?'':s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];}));}
  function allPlayers(){var out=[];try{(GD.teams||[]).forEach(function(t){out=out.concat(t.players||[],t.youth||[]);});}catch(e){}return out;}
  function nameMap(){var m={};allPlayers().forEach(function(p){m[p.name]=shortName(p);});return m;}
  function decorateConditions(root){root=root||document.getElementById('page')||document.body;if(!root)return;var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null);var n;while(n=w.nextNode()){var old=n.nodeValue,nu=titleCase(old);if(nu!==old)n.nodeValue=nu;}}
  function shortenScorecardNames(){if(!/^#\/(scorecard|match|commentary)/.test(location.hash))return;var m=nameMap();document.querySelectorAll('.ftp-scorecard a,.ftp-bowling a,table a').forEach(function(a){var t=a.textContent.trim();if(m[t])a.textContent=m[t];});document.querySelectorAll('.ftp-scorecard td,.ftp-bowling td').forEach(function(td){var txt=td.textContent.trim();Object.keys(m).forEach(function(full){if(txt.indexOf(full)>=0)td.textContent=td.textContent.replaceAll(full,m[full]);});});
    // dismissal columns ("c X b Y", "c & b Y", "st †X b Y", "run out (X)") + fall-of-wickets in the fo-* scorecard
    document.querySelectorAll('.fo-scorecard td.fo-out').forEach(function(td){var txt=td.textContent;Object.keys(m).forEach(function(full){if(txt.indexOf(full)>=0)txt=txt.replaceAll(full,m[full]);});if(txt!==td.textContent)td.textContent=txt;});
    document.querySelectorAll('.fo-scorecard .small,.panel .small').forEach(function(el){if(!/^\s*Fall:/.test(el.textContent))return;var w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,null),n;while(n=w.nextNode()){var t=n.nodeValue;Object.keys(m).forEach(function(full){if(t.indexOf(full)>=0)t=t.replaceAll(full,m[full]);});if(t!==n.nodeValue)n.nodeValue=t;}});}
  function decorateAll(){decorateConditions();shortenScorecardNames();}
  // upgrade any old save if user already has one under the v11 key
  function officialFatigueWord(n){n=+n||0;return n>=96?'clinically dead':n>=88?'shattered':n>=78?'exhausted':n>=68?'listless':n>=56?'weary':n>=44?'moderate':n>=34?'satisfactory':n>=24?'passable':n>=14?'energetic':n>=5?'revived':'rested';}
  try{fatWordOf=function(n){return officialFatigueWord(n);};fatSync=function(p){if(!p)return;if(p.fatN==null){var f=String(p.fatigue||'rested').toLowerCase();p.fatN=({rested:0,revived:8,energetic:18,passable:28,satisfactory:38,moderate:50,weary:62,listless:72,exhausted:82,shattered:91,'clinically dead':99})[f]||0;}p.fatWord=officialFatigueWord(p.fatN);p.fatigue=p.fatWord;};}catch(e){}
  // Improve auto bowling: no 10-over spells; seam new ball; spinners held for middle overs where possible.
  function isPace11(p){return (typeof typeClass==='function'?typeClass(p&&p.bowlType):'')==='pace';}
  function isSpin11(p){return (typeof typeClass==='function'?typeClass(p&&p.bowlType):'')==='spin';}
  function buildPlan11(kind){var t=userTeam(),xi=pickXI(t);var bs=xi.filter(function(p){return p.bowlType&&!isPT(p);});if(bs.length<5)bs=xi.filter(function(p){return p.bowlType;});bs.sort(function(a,b){return ((b.threat||0)+(b.control||0))-((a.threat||0)+(a.control||0));});bs=bs.slice(0,5);if(bs.length<5)return null;var counts={},plan=new Array(51).fill(null),lastEnd={1:null,0:null},spellEnd={1:0,0:0};bs.forEach(function(p){counts[p.name]=0;});function phase(ov){return ov<=10?'new':(ov>=41?'death':'mid');}
    function score(p,ph,ov){var v=(p.threat||0)*.62+(p.control||0)*.58; if(ph==='new'){v+=isPace11(p)?28:-36;if((p.talents||[]).includes('newBallSpecialist'))v+=8;} if(ph==='mid'){v+=isSpin11(p)?(kind==='spin'?28:14):0;} if(ph==='death'){v+=(p.control||0)*.25+(p.threat||0)*.15+((p.talents||[]).includes('deathSpecialist')?14:0); if(isSpin11(p)&&p.control<72)v-=10;} if(kind==='pace'&&isPace11(p))v+=8; if(kind==='spin'&&isSpin11(p)&&ph!=='new')v+=10; v-=Math.max(0,counts[p.name]-7)*10; return v;}
    // TEMPLATE PLAN: five bowlers, two 5-over spells each, opposite ends, provably legal.
    // Slot rotation (O=odd/north block, E=even/south block, each block = 5 overs):
    //   s1: O1(1-9)   + E3(22-30)   — new ball, returns mid
    //   s2: E1(2-10)  + O4(31-39)   — new ball, returns late-mid
    //   s3: O2(11-19) + E4(32-40)   — pure middle
    //   s4: E2(12-20) + O5(41-49)   — middle + death
    //   s5: O3(21-29) + E5(42-50)   — middle + death (closes the innings)
    // No slot's two blocks overlap in time at opposite ends, so no bowler can ever
    // bowl consecutive overs; every spell is exactly 5 overs; everyone bowls 10.
    var rem=bs.slice();
    function takeBest(scFn){rem.sort(function(a,b){return scFn(b)-scFn(a);});return rem.shift();}
    var s1=takeBest(function(p){return score(p,'new',1);});
    var s2=takeBest(function(p){return score(p,'new',3);});
    var s5=takeBest(function(p){return score(p,'death',45);});
    var s4=takeBest(function(p){return score(p,'death',43);});
    var s3=rem[0];
    function block(startOv,nm){for(var k=0;k<5;k++){var o=startOv+2*k;plan[o]=nm;counts[nm]++;}}
    block(1,s1.name);block(22,s1.name);
    block(2,s2.name);block(31,s2.name);
    block(11,s3.name);block(32,s3.name);
    block(12,s4.name);block(41,s4.name);
    block(21,s5.name);block(42,s5.name);
    return {plan:plan,bs:bs,counts:counts};}
  applyPreset=function(kind){var built=buildPlan11(kind||'best');if(!built){alert('Need at least five bowlers in the XI.');return;}App.orders.grid=new Array(51).fill(null);for(var o=1;o<=50;o++)App.orders.grid[o]=built.plan[o];App.orders.gridBowlers=built.bs.map(function(p){return p.name;});gridToSpells();compilePlan();pgOrders();setTimeout(function(){var bp=document.querySelector('.fo-bowlpanel .pad,.panel .pad');decorateAll();},0);};
  suggestOrders=function(){var t=userTeam(),xi=pickXI(t);App.orders.batOrder=xi.map(function(p){return p.name;});App.orders.captain=(xi.slice().sort(function(a,b){return ((b.capt||50)+(b.exp||50)*.35)-((a.capt||50)+(a.exp||50)*.35);})[0]||xi[0]).name;App.orders.keeper=(xi.find(function(p){return p.keeper;})||xi.slice().sort(function(a,b){return (b.keeping||0)-(a.keeping||0);})[0]||xi[0]).name;if(!App.orders.phaseIntent)App.orders.phaseIntent={pp:0,mid:0,death:1};if(!App.orders.fieldPlan)App.orders.fieldPlan={pp:'att',mid:'bal',death:'def'};applyPreset('best');};
  // Engine nudges using existing context: spin new-ball penalty, left/right batting penalty to bowler, captaincy/fielding boost.
  if(typeof ballDist==='function'&&!ballDist.__fo11fixed){var _bd=ballDist;ballDist=function(bat,bowl,ph,faced,intent,rrDef,pitch,field,over,ctx){var d=_bd.apply(this,arguments),tc=(typeof typeClass==='function'?typeClass(bowl&&bowl.bowlType):'');function mul(k,x){if(d[k]!=null)d[k]*=x;} if(tc==='spin'&&over<10){mul('dot',.985);mul('1',1.006);mul('2',1.006);mul('4',1.015);mul('6',1.010);['wB','wC','wLBW','wST'].forEach(function(k){mul(k,.97);});}
      if(ctx&&ctx.mixed){mul('dot',.985);mul('1',1.012);mul('2',1.015);mul('3',1.015);['wB','wC','wLBW','wST'].forEach(function(k){mul(k,.97);});}
      if(ctx){var cap=((+ctx.captBowl||50)-50)/50, fld=((+ctx.fieldAvg||55)-55)/55, boost=Math.max(-.012,Math.min(.022,cap*.013+fld*.010));mul('dot',1+boost);mul('4',1-boost*.55);mul('6',1-boost*.45);mul('wRO',1+Math.max(0,boost*.65));}
      var tot=0;Object.keys(d).forEach(function(k){d[k]=Math.max(0,d[k]);tot+=d[k];});Object.keys(d).forEach(function(k){d[k]/=tot||1;});return d;};ballDist.__fo11fixed=true;}
  // Background simulation continues after leaving match page.
  if(!window.__fo11_background_tick){window.__fo11_background_tick=setInterval(function(){try{if(typeof M==='undefined'||!M||M.done||!M.innings)return;if(window.__ap)return;doBall();if(/^#\/match/.test(location.hash)&&typeof renderMatch==='function')renderMatch();}catch(e){console.warn('[v11 background sim]',e);}},1400);}
  // Orders tactic compact table: actual v10 heading is "Tactics - set now...".
  function compactOrders(){if(!/^#\/orders/.test(location.hash))return;if(!App.orders.phaseIntent)App.orders.phaseIntent={pp:0,mid:0,death:1};if(!App.orders.fieldPlan)App.orders.fieldPlan={pp:'att',mid:'bal',death:'def'};var h=[].slice.call(document.querySelectorAll('.panel h4')).find(function(x){return /Tactics - set now|Batting tactics/i.test(x.textContent||'');});if(!h)return;var pad=h.parentNode.querySelector('.pad');if(!pad||pad.dataset.fo11compact)return;pad.dataset.fo11compact='1';function intent(ph){return '<select onchange="App.orders.phaseIntent[\''+ph+'\']=+this.value">'+[-1,0,1,2].map(function(v){return '<option value="'+v+'" '+(+App.orders.phaseIntent[ph]===v?'selected':'')+'>'+FO11_INTENT[String(v)]+'</option>';}).join('')+'</select>';}function field(ph){return '<select onchange="App.orders.fieldPlan[\''+ph+'\']=this.value">'+['att','bal','def'].map(function(v){return '<option value="'+v+'" '+(App.orders.fieldPlan[ph]===v?'selected':'')+'>'+FO11_FIELD[v]+'</option>';}).join('')+'</select>';}pad.innerHTML='<table><tr><th>Phase</th><th>Batting intent</th><th>Field setting</th></tr>'+['pp','mid','death'].map(function(ph){return '<tr><td><b>'+FO11_PHASE[ph]+'</b></td><td>'+intent(ph)+'</td><td>'+field(ph)+'</td></tr>';}).join('')+'</table><div class="small">Batting intent and bowling field setting are side by side to save space.</div>';}
  // Full post-match commentary with filters.
  function passComm(L,f){f=f||'all';var out=L&&L.out,txt=(L&&L.txt)||'';var wk=(typeof isWkt==='function'&&isWkt(out));if(f==='all')return true;if(f==='wickets')return wk;if(f==='boundaries')return out==='4'||out==='6';if(f==='overs')return !!L.mile;if(f==='talents')return /Specialist|Killer|Hunter|Starter|Arm|Hands|Anchor|Miser|Machine|Breaker|Bouncer|Mystery|Golden|talent|ability/i.test(txt);if(f==='fielding')return /catch|dropped|run out|stump|field|misfield|Rocket Arm|Lightning Hands|Safe Hands/i.test(txt);if(f==='highlights')return wk||out==='4'||out==='6'||L.mile||passComm(L,'talents')||passComm(L,'fielding');return true;}
  function commLine(L){var out=L.out||'',cls=out==='4'?'four':out==='6'?'six':(typeof isWkt==='function'&&isWkt(out)?'W':'');var bg=(typeof isWkt==='function'&&isWkt(out))?'background:#fbe9e7;':(out==='6'?'background:#fdf6df;':(out==='4'?'background:#eef4fa;':''));var txt=(typeof abilize==='function'?abilize(L.txt||''):esc11(L.txt||''));return '<div class="bl '+(L.mile?'mile ':'')+(passComm(L,'talents')?'ability-row':'')+'" style="'+bg+'"><b class="'+cls+'">'+esc11(L.no||'')+'</b> '+txt+'</div>';}
  pgCommentary=function(q){var ix=+(q&&q.i!=null?q.i:-1),r=App.results[ix];if(!r||!r.log){document.getElementById('page').innerHTML=crumb('Commentary')+'<div class="panel"><div class="pad">Pick a match from <a href="#/reports">Reports</a>.</div></div>';return;}var filter=App._fo11CommFilter||'all';var opts=[['all','All'],['highlights','Highlights'],['wickets','Wickets'],['boundaries','Boundaries'],['overs','Over summaries'],['talents','Triggered abilities'],['fielding','Fielding']].map(function(x){return '<option value="'+x[0]+'" '+(filter===x[0]?'selected':'')+'>'+x[1]+'</option>';}).join('');var rows=(r.log||[]).slice().reverse().filter(function(L){return passComm(L,filter);}).map(commLine).join('')||'<span class="small">No commentary matches this filter.</span>';document.getElementById('page').innerHTML=crumb(r.home+' v '+r.away,'Commentary')+'<div class="navsub"><b>'+esc11(r.result&&r.result.text||'Match complete')+'</b> · <a href="#/scorecard?i='+ix+'">scorecard</a> · <a href="#/reports?i='+ix+'">report</a> <span class="comm-filter">Display <select onchange="App._fo11CommFilter=this.value;route()">'+opts+'</select></span></div><div class="panel"><h4>Full commentary</h4><div class="pad commfeed commbig" style="max-height:none;overflow:visible">'+rows+'</div></div>';decorateAll();};
  // Wrap page renderers so changes are visible immediately.
  var _route=route;route=function(){_route.apply(this,arguments);setTimeout(function(){compactOrders();decorateAll();},20);};
  var _pgOrders=pgOrders;pgOrders=function(){_pgOrders.apply(this,arguments);setTimeout(function(){compactOrders();decorateAll();},20);};
  var _pgScore=pgScorecard;pgScorecard=function(q){_pgScore(q||{});setTimeout(decorateAll,20);};
  if(typeof renderMatch==='function'){var _rm=renderMatch;renderMatch=function(){_rm.apply(this,arguments);setTimeout(decorateAll,20);};}
  setInterval(decorateAll,1200);
  try{route();decorateAll();}catch(e){console.warn('[v11 visible fix init]',e);}
})();
