'use strict';
const D=require('../public/domain.js');
const {AppError}=require('./engine.cjs');
function config(){
  const url=(process.env.SUPABASE_URL||'').replace(/\/$/,'');
  const anon=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||'',service=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'';
  const count=[url,anon,service].filter(Boolean).length;
  if(count&&count!==3)throw new AppError('Konfigurasi sistem belum lengkap. Isi tiga environment variable Supabase.',503);
  if(count&&!/^https:\/\/[^/]+$/.test(url))throw new AppError('SUPABASE_URL harus berupa origin HTTPS.',503);
  return{url,anon,service,shared:count===3};
}
async function call(path,{method='GET',body,token,auth=false}={}){
  const c=config(),key=auth?c.anon:c.service;
  const headers={apikey:key,'Content-Type':'application/json'};
  if(token)headers.Authorization='Bearer '+token;
  else if(!key.startsWith('sb_'))headers.Authorization='Bearer '+key;
  const res=await fetch(c.url+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
  const raw=await res.text();let data;try{data=raw?JSON.parse(raw):null;}catch{data=null;}
  if(!res.ok){if(auth)throw new AppError(res.status===429?'Terlalu banyak percobaan masuk. Coba lagi nanti.':'Sesi tidak valid atau email/password tidak sesuai.',res.status===429?429:401);throw new AppError('Database belum siap atau tidak dapat diakses. Periksa schema dan konfigurasi server.',503);}
  return data;
}
const store={
  async read(){return call('/rest/v1/rpc/qg_snapshot',{method:'POST',body:{p_seed:D.seed()}});},
  async commit(revision,state){return call('/rest/v1/rpc/qg_commit',{method:'POST',body:{p_revision:revision,p_state:state}});}
};
async function member(user){
  if(!user?.id||!/^[-a-f0-9]{36}$/i.test(user.id))throw new AppError('Identitas sesi tidak valid.',401);
  const rows=await call('/rest/v1/qg_members?user_id=eq.'+encodeURIComponent(user.id)+'&select=role');
  if(!rows?.[0]||!['teller','checker'].includes(rows[0].role))throw new AppError('Pengguna belum diberi peran oleh pengelola.',403);
  return{id:user.id,email:user.email,role:rows[0].role};
}
module.exports={config,call,store,member};
