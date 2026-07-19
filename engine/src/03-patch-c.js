
(function(){
  if(typeof document==='undefined')return;
  try{document.body.classList.add('ftpskin');}catch(e){}

  /* ---- FTP commentary feed builder (reads engine M.log, no engine change) ---- */
  function wkt(o){return o&&o.charAt(0)==='w'&&o!=='wide'}
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
  function esc2(s){return (typeof esc==='function')?esc(s):String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
  function talentize(t){
    var h=esc2(t||'');
    ['SIX MACHINE','PARTNERSHIP BREAKER','New Ball Specialist','Golden Arm','Mystery Ball','Bouncer','Finisher','Lightning Hands','Rocket Arm','Safe Hands','Miser','Spin Killer','Pace Hunter','Fast Starter','Anchor','death specialist']
     .forEach(function(n){h=h.replace(new RegExp('('+n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig'),'<span class="talent-hit">$1</span>');});
    return h;
  }
  function ftpPass(L,f){
    f=f||'all'; var t=L.txt||'';
    if(f==='all')return true;
    if(f==='wickets')return wkt(L.out)||/WICKET|out for/i.test(t);
    if(f==='boundaries')return L.out==='4'||L.out==='6';
    if(f==='overs')return L.mile||/End of over|DRINKS|Innings break/i.test(t);
    if(f==='highlights')return L.mile||wkt(L.out)||L.out==='4'||L.out==='6'||/DROPPED|FIFTY|HUNDRED/i.test(t);
    if(f==='talents')return /machine|breaker|specialist|golden arm|mystery|bouncer|finisher|lightning|rocket arm|safe hands|miser|killer|hunter|starter|anchor/i.test(t);
    return true;
  }
  window.ftpCommHTML=function(log,filter,limit){
    var rows=(log||[]).filter(function(L){return ftpPass(L,filter)}).slice(0,limit||140).map(function(L){
      if(L.mile||/^End of over/i.test(L.txt||'')){
        return '<div class="oversummary-bottom"><div class="text">'+talentize(L.txt)+'</div><div class="clear"></div></div>';
      }
      var rowcls=L.out==='4'?'four':L.out==='6'?'six':wkt(L.out)?'line wkt':'line';
      return '<div class="'+rowcls+'"><div class="del">'+esc2(L.no||'')+'</div><div class="rslt">'+ftpRslt(L.out)+
             '</div><div class="text">'+talentize(L.txt)+'</div><div class="clear"></div></div>';
    }).join('');
    return rows||'<div class="line"><div class="text" style="padding-left:8px">No commentary matches this filter.</div><div class="clear"></div></div>';
  };

  /* swap the commentary feed to FTP structure after every match render (engine + shell untouched) */
  if(typeof renderMatch==='function'){
    var _rm=renderMatch;
    renderMatch=function(){
      _rm();
      try{
        if(typeof M==='undefined'||!M||!M.log)return;
        var feed=document.querySelector('.ftpskin .commfeed');
        if(feed){
          feed.id='ftpcomm';
          feed.classList.remove('commbig');
          feed.innerHTML=ftpCommHTML(M.log,(typeof UI!=='undefined'&&UI.commFilter)||'all',140);
        }
      }catch(e){console.error('[ftpskin comm]',e);}
    };
  }

  /* re-render current page under the skin */
  try{if(typeof route==='function')route();}catch(e){console.error(e);}
})();
