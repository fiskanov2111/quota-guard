'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const handler=require('../api/gateway.js');
test('API demo config, missing-session and cross-origin rejection',async()=>{
  const prior={...process.env};const server=http.createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  try{
    delete process.env.SUPABASE_URL;delete process.env.SUPABASE_ANON_KEY;delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    let r=await fetch(base+'?op=config');assert.deepEqual(await r.json(),{mode:'demo'});
    process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_ANON_KEY='test';process.env.SUPABASE_SERVICE_ROLE_KEY='test';
    r=await fetch(base+'?op=state');assert.equal(r.status,401);
    r=await fetch(base,{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify({action:'post'})});assert.equal(r.status,403);
    r=await fetch(base,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({action:'post'})});assert.equal(r.status,401);
    r=await fetch(base,{method:'DELETE'});assert.equal(r.status,405);
  }finally{for(const key of ['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY']){if(prior[key]===undefined)delete process.env[key];else process.env[key]=prior[key];}await new Promise(r=>server.close(r));}
});
