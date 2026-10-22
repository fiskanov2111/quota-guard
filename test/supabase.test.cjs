const {test}=require('node:test'),assert=require('node:assert/strict');
const {call}=require('../lib/supabase.cjs');
test('modern Supabase keys go on apikey; Authorization is reserved for user JWT',async()=>{
 const old={...process.env},native=global.fetch,requests=[];
 process.env.SUPABASE_URL='https://qg-test.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';process.env.SUPABASE_SECRET_KEY='sb_secret_test';
 global.fetch=async(url,options)=>{requests.push(options);return Response.json({ok:true});};
 try{await call('/rest/v1/qg_members');await call('/auth/v1/token',{method:'POST',auth:true,body:{}});await call('/auth/v1/user',{auth:true,token:'user-jwt'});assert.equal(requests[0].headers.apikey,'sb_secret_test');assert.equal(requests[0].headers.Authorization,undefined);assert.equal(requests[1].headers.apikey,'sb_publishable_test');assert.equal(requests[1].headers.Authorization,undefined);assert.equal(requests[2].headers.Authorization,'Bearer user-jwt');}
 finally{global.fetch=native;for(const key of ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY']){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}}
});
