const token=String(process.env.TELEGRAM_BOT_TOKEN||'').trim();
const secret=String(process.env.TELEGRAM_WEBHOOK_SECRET||'').trim();
const site=String(process.env.APP_PUBLIC_URL||'').replace(/\/$/,'');
if(!token)throw new Error('TELEGRAM_BOT_TOKEN is required');
if(!site.startsWith('https://'))throw new Error('APP_PUBLIC_URL must be an https URL');
if(secret&&!/^[A-Za-z0-9_-]{1,256}$/.test(secret))throw new Error('TELEGRAM_WEBHOOK_SECRET has invalid characters');

async function call(method,body={}){
  const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(body)
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok||d.ok===false)throw new Error(`${method} failed: ${d.description||r.status}`);
  return d.result;
}

const me=await call('getMe');
const url=`${site}/api/telegram-webhook`;
await call('setWebhook',{
  url,
  secret_token:secret||undefined,
  allowed_updates:['message','callback_query'],
  drop_pending_updates:false
});
const info=await call('getWebhookInfo');
console.log(JSON.stringify({
  ok:true,
  botUsername:me.username,
  botUrl:`https://t.me/${me.username}`,
  webhookUrl:info.url,
  pendingUpdateCount:info.pending_update_count,
  lastErrorMessage:info.last_error_message||''
},null,2));
