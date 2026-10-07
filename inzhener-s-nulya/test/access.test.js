import test from 'node:test';
import assert from 'node:assert/strict';
import { engineerMaxAccess,maxAccessInput } from '../api/_engineer-max-access.js';
const msg=(text,id=1,chat='dialog')=>({update_type:'message_created',message:{sender:{user_id:id},recipient:{chat_type:chat},body:{text}}});
function fixture({session={lastOrderId:'new-unpaid'},orders=[{orderId:'old-paid'}],states={'old-paid':{state:'paid'},'new-unpaid':{state:'pending'}}}={}){
 const calls=[],health=[];let saved;return {calls,health,get saved(){return saved;},run:update=>engineerMaxAccess(update,{loadSession:async()=>session,findOrders:async id=>{assert.equal(id,1);return orders;},deliver:async(id,args)=>{calls.push({id,args});const result=states[id];if(result instanceof Error)throw result;return result||{state:'failed'};},saveSession:async(id,data)=>saved=data,record:async row=>health.push(row)})};
}
test('new unpaid checkout does not hide earlier paid purchase',async()=>{
 const f=fixture();const r=await f.run(msg('/access'));assert.match(r.text,/ZIP/);assert.equal(f.calls[0].id,'old-paid');assert.equal(f.calls[0].args.userId,1);assert.equal(f.calls[0].args.force,true);assert.deepEqual(f.saved.paidOrderIds,['old-paid']);assert.equal(f.health[0].result,'delivered');assert.equal(f.calls.length,1);
});
test('remembered paid order works when checkout was reset',async()=>{
 const f=fixture({orders:[],session:{phase:'idle',paidOrderIds:['old-paid']}});assert.match((await f.run(msg('/ACCESS@se13638142_1_bot'))).text,/ZIP/);
});
test('group commands cannot request private files',async()=>{const f=fixture();assert.equal(await f.run(msg('/access',1,'chat')),null);assert.equal(f.calls.length,0);});
test('pending and wrong-owner orders never claim successful delivery',async()=>{
 const f=fixture({orders:[],states:{'new-unpaid':{state:'pending'}}});assert.match((await f.run(msg('/access'))).text,/пока не подтвердил/);assert.equal(f.health[0].result,'pending');
 const e=new Error('order_owner_mismatch');const g=fixture({states:{'old-paid':e,'new-unpaid':e}});assert.doesNotMatch((await g.run(msg('/access'))).text,/отправлены ZIP/);assert.equal(g.health[0].stage,'ownership');
});
test('delivery failure produces a visible explanation and redacted diagnostic',async()=>{
 const e=new Error('secret provider response');e.deliveryStage='receipt';const f=fixture({states:{'old-paid':e}});const r=await f.run(msg('/access'));assert.match(r.text,/чека/);assert.doesNotMatch(r.text,/secret/);assert.deepEqual(f.health,[{result:'error',stage:'receipt'}]);
});
test('signed old order link retains proof; arbitrary site is rejected',async()=>{
 const f=fixture({states:{legacy:{state:'paid'}}});await f.run(msg('https://inzhener-s-nulya.vercel.app/order.html?orderId=legacy&product=starter&token=signed'));assert.equal(f.calls[0].args.accessToken,'signed');assert.equal(f.calls[0].args.productCode,'starter');assert.equal(f.calls[0].args.force,false);
 assert.equal(maxAccessInput(msg('https://evil.example/order.html?orderId=legacy')),null);
});
test('storage failure is explained without losing a successful delivery',async()=>{
 const r=await engineerMaxAccess(msg('/access'),{loadSession:async()=>({lastOrderId:'paid'}),findOrders:async()=>[],deliver:async()=>({state:'paid'}),saveSession:async()=>{throw new Error('storage');}});assert.match(r.text,/Материалы отправлены/);
});
