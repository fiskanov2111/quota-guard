'use strict';
const {randomUUID, createHash} = require('node:crypto');
const D = require('../public/domain.js');
const people = {dimas:'Andi Pratama',nadia:'Nadia Putri',bima:'Bima Saputra',alex:'Alex Morgan'};
class AppError extends Error { constructor(message,status=400){super(message);this.status=status;} }
const text=(v,max=300)=>typeof v==='string'&&v.trim().length<=max?v.trim():'';
const requireRole=(actor,role)=>{if(actor.role!==role)throw new AppError('Peran ini tidak memiliki kewenangan untuk tindakan tersebut.',403);};
function cleanForm(input={}){
  if(!people[input.personId])throw new AppError('Identitas demo tidak ditemukan.');
  const f={personId:input.personId,month:input.month,branch:input.branch,currency:input.currency,amount:Number(input.amount),verified:input.verified===true,channel:input.personId==='bima'?'Pemilik rekening':'WIC'};
  if(input.reservationId)f.reservationId=text(input.reservationId,100);
  // Validate independently of values sent by the browser.
  if(!f.verified)throw new AppError('Verifikasi identitas terlebih dahulu.');
  if(!D.branches[f.branch])throw new AppError('Cabang transaksi tidak valid.');
  if(!/^2026-(09|10|11)$/.test(f.month))throw new AppError('Periode simulasi tidak valid.');
  D.toUsdCents(f.amount,f.currency);
  return f;
}
function appendAudit(state,actor,title,detail,now){
  state.audit.unshift({id:'AUD-'+randomUUID(),title,detail,role:actor.role==='system'?'Sistem':actor.role==='checker'?'Pemeriksa':'Teller',actorId:actor.id,actorEmail:actor.email,time:new Date(now).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'}),at:new Date(now).toISOString()});
}
function publicState(state){const {commands,...rest}=state;return rest;}
function applyAction(state,actor,action,payload={},mutationId,now=Date.now()){
  if(!actor?.id||!['teller','checker'].includes(actor.role))throw new AppError('Akses pengguna belum ditetapkan.',403);
  if(typeof mutationId!=='string'||!/^[-a-zA-Z0-9]{8,100}$/.test(mutationId))throw new AppError('Referensi permintaan tidak valid.');
  const hash=createHash('sha256').update(JSON.stringify({actor:actor.id,action,payload})).digest('hex');
  state.commands=state.commands||{};
  const previous=state.commands[mutationId];
  if(previous){if(previous.hash!==hash)throw new AppError('Referensi dipakai untuk tindakan berbeda.',409);return previous.result;}
  if(Object.keys(state.commands).length>=2000)throw new AppError('Kapasitas dataset demonstrasi tercapai. Siapkan dataset baru melalui pengelola database.',409);
  const expires=state.reservations.filter(r=>r.status==='active'&&r.expiresAt<=now);
  expires.forEach(r=>r.status='expired');
  if(expires.length)appendAudit(state,{id:'system',role:'system',email:'Sistem'},'Pencadangan kedaluwarsa',expires.length+' pencadangan dilepas.',now);
  let result;
  const newId=p=>p+'-'+randomUUID();
  if(action==='post'){
    requireRole(actor,'teller');const f=cleanForm(payload.form);
    if(f.reservationId){const r=state.reservations.find(r=>r.id===f.reservationId);if(r&&r.createdBy!==actor.id)throw new AppError('Pencadangan dimiliki teller lain.',403);}
    result=D.postTransaction(state,f,newId('QG'));
    result.createdBy=actor.id;result.at=new Date(now).toISOString();
    appendAudit(state,actor,'Transaksi selesai',people[f.personId]+' · '+result.currency+' '+result.amount+' · '+D.branches[f.branch],now);
  }else if(action==='reserve'){
    requireRole(actor,'teller');const f=cleanForm(payload.form);delete f.reservationId;
    result=D.reserveQuota(state,f,newId('HOLD'),now);result.createdBy=actor.id;
    appendAudit(state,actor,'Kuota dicadangkan',people[f.personId]+' · USD '+result.usdCents/100+' · '+D.branches[f.branch],now);
  }else if(action==='release'){
    const r=state.reservations.find(r=>r.id===payload.id);
    if(!r)throw new AppError('Pencadangan tidak ditemukan.',404);
    if(actor.role!=='checker'&&r.createdBy!==actor.id)throw new AppError('Pencadangan dimiliki teller lain.',403);
    result=D.releaseReservation(state,r.id);appendAudit(state,actor,'Pencadangan dilepas',r.id,now);
  }else if(action==='request'){
    requireRole(actor,'teller');const f=cleanForm(payload.form),v=D.toUsdCents(f.amount,f.currency),raw=payload.doc||{};
    const doc={type:text(raw.type,30),reference:text(raw.reference,70),usdValue:Number(raw.usdValue),name:text(raw.name,100),filename:text(raw.filename,160)};
    if(!['invoice','education','travel','other'].includes(doc.type)||!doc.name)throw new AppError('Dokumen tidak lengkap.');
    D.validateDocument(doc,v);
    if(!/\.(pdf|jpe?g|png)$/i.test(doc.filename))throw new AppError('Nama file harus PDF, JPG, atau PNG.');
    if(state.requests.some(r=>['pending','approved','settled'].includes(r.status)&&r.doc.reference.toLowerCase()===doc.reference.toLowerCase()))throw new AppError('Nomor dokumen sudah dialokasikan pada pengajuan lain.',409);
    result={id:newId('REQ'),form:f,fingerprint:D.fingerprint(f),doc,status:'pending',created:new Date(now).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'}),createdBy:actor.id,usdCents:v};
    state.requests.unshift(result);appendAudit(state,actor,'Underlying diajukan',people[f.personId]+' · '+doc.reference,now);
  }else if(action==='approve'||action==='reject'){
    requireRole(actor,'checker');const r=state.requests.find(r=>r.id===payload.id);
    if(!r)throw new AppError('Pengajuan tidak ditemukan.',404);
    if(r.status!=='pending')throw new AppError('Pengajuan telah diputuskan.',409);
    if(r.createdBy===actor.id)throw new AppError('Pembuat tidak dapat menyetujui pengajuannya sendiri.',403);
    const note=text(payload.note);
    if(action==='approve'){
      if(!Array.isArray(payload.checks)||payload.checks.length!==4||!payload.checks.every(v=>v===true))throw new AppError('Lengkapi seluruh checklist pemeriksa.');
      D.validateDocument(r.doc,r.usdCents);
      if(r.doc.name.toLowerCase()!==people[r.form.personId].toLowerCase())throw new AppError('Nama dokumen tidak sesuai identitas.');
    }else if(!note)throw new AppError('Isi alasan penolakan.');
    r.status=action==='approve'?'approved':'rejected';r.note=note;r.verifiedAt=new Date(now).toISOString();r.reviewedBy=actor.id;result=r;
    appendAudit(state,actor,action==='approve'?'Underlying disetujui':'Underlying ditolak',r.id+' · '+note,now);
  }else if(action==='cancel'){
    requireRole(actor,'checker');const tx=state.transactions.find(t=>t.id===payload.id),reason=text(payload.reason);
    if(!tx)throw new AppError('Transaksi tidak ditemukan.',404);
    if(tx.status!=='completed')throw new AppError('Transaksi telah dibatalkan.',409);
    if(!reason)throw new AppError('Isi alasan pembatalan.');
    tx.status='cancelled';tx.cancelReason=reason;tx.cancelledBy=actor.id;result=tx;
    appendAudit(state,actor,'Transaksi dibatalkan',tx.id+' · '+reason,now);
  }else throw new AppError('Tindakan tidak dikenal.');
  state.updatedAt=new Date(now).toISOString();state.commands[mutationId]={hash,result:structuredClone(result)};
  return result;
}
async function execute(store,actor,action,payload,mutationId){
  // Every conflict reloads state and reevaluates quota; no process-local lock.
  for(let attempt=0;attempt<12;attempt++){
    const snapshot=await store.read();const state=structuredClone(snapshot.state);
    let result;
    try{result=applyAction(state,actor,action,payload,mutationId);}catch(error){if(error instanceof AppError)throw error;throw new AppError(error.message,409);}
    if(await store.commit(snapshot.revision,state))return{state:publicState(state),result};
  }
  throw new AppError('Data sedang berubah. Muat ulang lalu coba kembali.',409);
}
module.exports={AppError,applyAction,execute,publicState,cleanForm};
