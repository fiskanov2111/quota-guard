// Test fixture only. Never imported by the deployed application.
const nativeFetch=global.fetch;
const ids={teller:'11111111-1111-4111-8111-111111111111',checker:'22222222-2222-4222-8222-222222222222'};
let state=null,revision=0;
function fakeFetch(input,options={}){
  const url=new URL(typeof input==='string'?input:input.url);
  if(url.hostname!=='qg-test.supabase.co')return nativeFetch(input,options);
  const body=JSON.parse(options.body||'{}');const token=options.headers?.Authorization?.replace('Bearer ','');
  const role=token==='qa-teller'?'teller':token==='qa-checker'?'checker':null;
  const user=r=>({id:ids[r],email:r+'@example.test'});
  if(url.pathname==='/auth/v1/token'){
    const r=body.email==='teller@example.test'?'teller':body.email==='checker@example.test'?'checker':null;
    return Promise.resolve(r&&body.password==='qa-password'?Response.json({access_token:'qa-'+r,expires_in:3600,user:user(r)}):Response.json({error:'bad login'},{status:400}));
  }
  if(url.pathname==='/auth/v1/user')return Promise.resolve(role?Response.json(user(role)):Response.json({error:'invalid'},{status:401}));
  if(url.pathname==='/auth/v1/logout')return Promise.resolve(new Response(null,{status:204}));
  if(url.pathname==='/rest/v1/qg_members')return Promise.resolve(Response.json([{role:url.search.includes(ids.teller)?'teller':'checker'}]));
  if(url.pathname==='/rest/v1/rpc/qg_snapshot'){if(!state)state=structuredClone(body.p_seed);return Promise.resolve(Response.json({state,revision}));}
  if(url.pathname==='/rest/v1/rpc/qg_commit'){const valid=body.p_revision===revision;if(valid){state=structuredClone(body.p_state);revision++;}return Promise.resolve(Response.json(valid));}
  return Promise.resolve(Response.json({error:'unknown test endpoint'},{status:404}));
}
module.exports={fakeFetch,reset(){state=null;revision=0;}};
