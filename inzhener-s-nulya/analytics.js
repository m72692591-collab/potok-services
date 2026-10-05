(() => {
  const ATTR_KEYS=['src','utm_source','utm_medium','utm_campaign','utm_content','utm_term','yclid'];

  function currentSource(){
    const q=new URLSearchParams(location.search);
    for(const k of ['src','utm_campaign','utm_source','yclid']){
      const v=q.get(k);
      if(v)return String(v).slice(0,120);
    }
    try{
      const stored=JSON.parse(sessionStorage.getItem('engineerAttribution')||'{}');
      for(const k of ['src','utm_campaign','utm_source','yclid']){
        if(stored[k])return String(stored[k]).slice(0,120);
      }
    }catch{}
    return '';
  }

  function payload(event,data={}){
    return {
      event,
      path:location.pathname,
      source:data.source||currentSource(),
      product:data.product||'',
      referrer:document.referrer||''
    };
  }

  async function send(event,data={}){
    const body=JSON.stringify(payload(event,data));
    try{
      if(navigator.sendBeacon){
        const ok=navigator.sendBeacon('/api/engineer-support?channel=event',
          new Blob([body],{type:'application/json'}));
        if(!ok)throw new Error('beacon_failed');
      }else{
        fetch('/api/engineer-support?channel=event',{
          method:'POST',headers:{'content-type':'application/json'},body,keepalive:true
        }).catch(()=>{});
      }
    }catch{
      fetch('/api/engineer-support?channel=event',{
        method:'POST',headers:{'content-type':'application/json'},body,keepalive:true
      }).catch(()=>{});
    }
    try{
      const id=window.__ENGINEER_METRIKA_ID__;
      if(id&&typeof window.ym==='function')window.ym(id,'reachGoal',event,{product:data.product||'',source:data.source||currentSource()});
    }catch{}
  }

  window.engineerTrack=send;

  document.addEventListener('click',e=>{
    const el=e.target.closest('[data-track]');
    if(!el)return;
    send(el.dataset.track,{product:el.dataset.product||''});
  },{passive:true});

  fetch('/api/public-info').then(r=>r.json()).then(d=>{
    const id=String(d.yandexMetrikaId||'');
    if(!/^\d{4,12}$/.test(id))return;
    window.__ENGINEER_METRIKA_ID__=Number(id);
    window.ym=window.ym||function(){(window.ym.a=window.ym.a||[]).push(arguments)};
    window.ym.l=Date.now();
    const s=document.createElement('script');
    s.async=true;
    s.src='https://mc.yandex.ru/metrika/tag.js';
    s.onload=()=>window.ym(Number(id),'init',{
      clickmap:true,
      trackLinks:true,
      accurateTrackBounce:true,
      webvisor:false
    });
    document.head.appendChild(s);
  }).catch(()=>{});

  send('page_view');
})();