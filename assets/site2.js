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
})();
