import test from 'node:test';
import assert from 'node:assert/strict';
import { engineerMaxReply, engineerMaxSecret, ensureEngineerMaxWebhook } from '../api/_engineer-max.js';

test('MAX bot_started produces welcome and paid buttons',()=>{
  const r=engineerMaxReply({
    update_type:'bot_started',
    payload:'eng_vk_max_launch',
    user:{user_id:123,is_bot:false}
  });
  assert.equal(r.userId,123);
  assert.match(r.text,/Инженер с нуля/);
  const raw=JSON.stringify(r.attachments);
  assert.match(raw,/buy=starter/);
  assert.match(raw,/max_eng_vk_max_launch/);
});

test('MAX ordinary question reuses engineering support KB',()=>{
  const r=engineerMaxReply({
    update_type:'message_created',
    message:{sender:{user_id:321,is_bot:false},body:{text:'Сколько стоит AutoCAD?'}}
  });
  assert.equal(r.userId,321);
  assert.match(r.text,/1 990 ₽/);
});

test('MAX secret derives from existing order secret',()=>{
  const a=engineerMaxSecret({ORDER_HMAC_SECRET:'x'.repeat(48)});
  assert.match(a,/^[A-Za-z0-9_-]{5,256}$/);
  assert.equal(a,engineerMaxSecret({ORDER_HMAC_SECRET:'x'.repeat(48)}));
});

test('MAX readiness can configure webhook after identity check',async()=>{
  const env={ORDER_HMAC_SECRET:'x'.repeat(48),ENGINEER_MAX_BOT_TOKEN:'secret-token'};
  const calls=[];
  const fetchImpl=async(url,opts={})=>{
    calls.push({url,opts});
    if(url.endsWith('/me'))return{ok:true,json:async()=>({user_id:1,username:'id640100982708_bot',is_bot:true,description:'Инженер с нуля',avatar_url:'https://example.test/a.png',commands:[]})};
    if(url.endsWith('/me/commands')&&opts.method==='PATCH')
      return{ok:true,json:async()=>({success:true})};
    if(url.endsWith('/subscriptions')&&(!opts.method||opts.method==='GET'))
      return{ok:true,json:async()=>[]};
    if(url.endsWith('/subscriptions')&&opts.method==='POST')
      return{ok:true,json:async()=>({success:true})};
    throw new Error('unexpected');
  };
  const req={headers:{host:'example.test','x-forwarded-proto':'https'}};
  const r=await ensureEngineerMaxWebhook(req,{env,fetchImpl});
  assert.equal(r.identityVerified,true);
  assert.equal(r.webhookMatchesExpected,true);
  assert.equal(r.autoConfigured,true);
  assert.equal(r.commandsConfigured,true);
  assert.equal(r.commandsAutoConfigured,true);
  assert.equal(r.profileDescriptionConfigured,true);
  assert.equal(r.profileAvatarConfigured,true);
  assert.equal(r.botUrl,'https://max.ru/id640100982708_bot');
});
