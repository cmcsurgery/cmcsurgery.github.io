// cmcsurgery: 휴대폰 메뉴, 맨 위로 버튼, 하위 탭 위치 (2026-11-24)
(function(){
  document.documentElement.classList.add('js');
  var t=document.querySelector('.hdr-toggle');
  if(t){t.addEventListener('click',function(){var o=document.body.classList.toggle('menu-open');t.setAttribute('aria-expanded',o?'true':'false');});}
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&document.body.classList.contains('menu-open')){document.body.classList.remove('menu-open');if(t){t.setAttribute('aria-expanded','false');t.focus();}}});
  var up=document.querySelector('.to-top');
  if(up){var f=function(){up.classList.toggle('show',window.scrollY>400);};window.addEventListener('scroll',f,{passive:true});f();}
  var cur=document.querySelector('.sub-tabs [aria-current="page"]');
  if(cur){var p=cur.parentElement;if(p.scrollWidth>p.clientWidth){p.scrollLeft=Math.max(0,cur.offsetLeft-24);}}
  var tl=document.querySelector('.year-tabs');
  if(tl){
    var yt=[].slice.call(tl.querySelectorAll('[role="tab"]'));
    var sel=function(id,focus){yt.forEach(function(t){var on=t.getAttribute('aria-controls')===id;t.setAttribute('aria-selected',on?'true':'false');t.tabIndex=on?0:-1;var p=document.getElementById(t.getAttribute('aria-controls'));if(p){p.hidden=!on;}if(on&&focus){t.focus();}});};
    yt.forEach(function(t,i){
      t.addEventListener('click',function(){var id=t.getAttribute('aria-controls');sel(id);if(history.replaceState){history.replaceState(null,'','#'+id);}});
      t.addEventListener('keydown',function(e){if(e.key==='ArrowRight'||e.key==='ArrowLeft'){var n=yt[(i+(e.key==='ArrowRight'?1:yt.length-1))%yt.length];sel(n.getAttribute('aria-controls'),true);e.preventDefault();}});
    });
    var h=decodeURIComponent(location.hash.slice(1));
    var tg=h?document.getElementById(h):null,pn=tg&&tg.closest?tg.closest('.year-panel'):null;
    sel(pn?pn.id:(yt.some(function(t){return t.getAttribute('aria-controls')===h;})?h:yt[0].getAttribute('aria-controls')));
    if(pn&&tg!==pn){setTimeout(function(){tg.scrollIntoView();},0);}
    document.addEventListener('click',function(ev){var a=ev.target.closest?ev.target.closest('a[href^="#"]'):null;if(!a)return;var id=decodeURIComponent(a.getAttribute('href').slice(1));var t2=document.getElementById(id);var p2=t2&&t2.closest?t2.closest('.year-panel'):null;if(p2&&p2.hidden){sel(p2.id);}});
    window.addEventListener('hashchange',function(){var h2=decodeURIComponent(location.hash.slice(1));if(yt.some(function(t){return t.getAttribute('aria-controls')===h2;})){sel(h2);}});
  }
})();
