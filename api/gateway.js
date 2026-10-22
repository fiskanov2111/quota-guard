'use strict';
const {config,call,store,member}=require('../lib/supabase.cjs');
const {AppError,execute,publicState}=require('../lib/engine.cjs');
function cookie(req,token,maxAge){const secure=!!process.env.VERCEL||req.headers['x-forwarded-proto']==='https';return 'qg_session='+encodeURIComponent(token)+'; HttpOnly; SameSite=Strict; Path=/; Max-Age='+maxAge+(secure?'; Secure':'');}
function readToken(req){const match=(req.headers.cookie||'').match(/(?:^|;\s*)qg_session=([^;]+)/);try{return match?decodeURIComponent(match[1]):'';}catch{return '';}}
function sameOrigin(req){
  const host=req.headers.host;const proto=process.env.VERCEL?'https':(req.headers['x-forwarded-proto']||'http');
  const expected=process.env.APP_ORIGIN||proto+'://'+host;
  if(!req.headers.origin||req.headers.origin!==expected)throw new AppError('Origin permintaan tidak diizinkan.',403);
}
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
  const send=(status,data)=>{res.statusCode=status;res.end(JSON.stringify(data));};
  try{
    const c=config();
    if(req.method==='GET'){
      const op=new URL(req.url,'http://localhost').searchParams.get('op');
      if(op==='config')return send(200,{mode:c.shared?'shared':'demo'});
      if(!c.shared)throw new AppError('Mode sistem belum diaktifkan.',503);
      const token=readToken(req);if(!token)throw new AppError('Silakan masuk terlebih dahulu.',401);
      const user=await call('/auth/v1/user',{token,auth:true}),actor=await member(user);
      const snapshot=await store.read();return send(200,{actor,state:publicState(snapshot.state)});
    }
    if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return send(405,{error:'Metode tidak diizinkan.'});}
    sameOrigin(req);
    if(!String(req.headers['content-type']||'').startsWith('application/json'))throw new AppError('Gunakan format JSON.',415);
    let body=req.body;if(typeof body==='string')body=JSON.parse(body);
    if(!body){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>20000)throw new AppError('Permintaan terlalu besar.',413);}body=JSON.parse(raw||'{}');}
    if(JSON.stringify(body).length>20000)throw new AppError('Permintaan terlalu besar.',413);
    if(!c.shared)throw new AppError('Mode sistem belum diaktifkan.',503);
    if(body.action==='login'){
      if(typeof body.email!=='string'||body.email.length>254||typeof body.password!=='string'||body.password.length>1024)throw new AppError('Isi email dan password yang valid.');
      const session=await call('/auth/v1/token?grant_type=password',{method:'POST',auth:true,body:{email:body.email,password:body.password}});
      const actor=await member(session.user);res.setHeader('Set-Cookie',cookie(req,session.access_token,session.expires_in||3600));return send(200,{actor});
    }
    const token=readToken(req);if(!token)throw new AppError('Silakan masuk terlebih dahulu.',401);
    const user=await call('/auth/v1/user',{token,auth:true}),actor=await member(user);
    if(body.action==='logout'){
      res.setHeader('Set-Cookie',cookie(req,'',0));await call('/auth/v1/logout',{method:'POST',token,auth:true});return send(200,{ok:true});
    }
    return send(200,await execute(store,actor,body.action,body.payload||{},body.mutationId));
  }catch(error){const status=error instanceof AppError?error.status:400;send(status,{error:error instanceof AppError?error.message:(error.name==='TimeoutError'?'Server tidak merespons. Coba lagi.':'Permintaan gagal diproses. Periksa data atau konfigurasi sistem.')});}
};
