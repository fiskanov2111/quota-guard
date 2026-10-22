const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {fakeFetch,reset}=require('./fake-supabase.cjs'),handler=require('../api/gateway.js');
test('HTTP login -> request -> checker approval -> teller post -> cancel using Auth/Data API contract',async()=>{
  const nativeFetch=global.fetch,old={...process.env};reset();
  process.env.SUPABASE_URL='https://qg-test.supabase.co';process.env.SUPABASE_ANON_KEY='test-anon';process.env.SUPABASE_SERVICE_ROLE_KEY='test-service';global.fetch=fakeFetch;
  const server=http.createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const send=(body,cookie)=>nativeFetch(base,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
  try{
    let r=await send({action:'login',email:'teller@example.test',password:'qa-password'});assert.equal(r.status,200);const tc=r.headers.get('set-cookie').split(';')[0];assert.match(r.headers.get('set-cookie'),/HttpOnly/);
    r=await send({action:'login',email:'checker@example.test',password:'qa-password'});const cc=r.headers.get('set-cookie').split(';')[0];
    const form={personId:'dimas',month:'2026-10',branch:'arivai',currency:'USD',amount:3000,verified:true};
    r=await send({action:'post',payload:{form},mutationId:'HTTP-BLOCKED'},tc);assert.equal(r.status,409);
    r=await send({action:'request',payload:{form,doc:{type:'invoice',reference:'HTTP-INV',usdValue:3000,name:'Andi Pratama',filename:'invoice.pdf'}},mutationId:'HTTP-REQUEST'},tc);const req=(await r.json()).result;assert.ok(req.id);
    r=await send({action:'approve',payload:{id:req.id,checks:[true,true,true,true]},mutationId:'HTTP-BAD-ROLE'},tc);assert.equal(r.status,403);
    r=await send({action:'approve',payload:{id:req.id,checks:[true,true,true,true]},mutationId:'HTTP-APPROVE'},cc);assert.equal(r.status,200);
    r=await send({action:'post',payload:{form},mutationId:'HTTP-POST'},tc);const posted=await r.json();assert.equal(r.status,200);assert.equal(posted.result.usdCents,300000);
    r=await send({action:'post',payload:{form},mutationId:'HTTP-POST'},tc);assert.equal((await r.json()).result.id,posted.result.id);
    r=await send({action:'cancel',payload:{id:posted.result.id,reason:'Koreksi'},mutationId:'HTTP-CANCEL'},cc);assert.equal(r.status,200);
    r=await nativeFetch(base+'?op=state',{headers:{Cookie:tc}});const value=await r.json();assert.equal(value.actor.role,'teller');assert.equal(value.state.transactions[0].status,'cancelled');assert.equal(value.state.audit.length,4);assert.equal(value.state.commands,undefined);
  }finally{global.fetch=nativeFetch;for(const key of ['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY']){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}await new Promise(r=>server.close(r));}
});
