(function (root) {
  'use strict';
  const LIMIT_CENTS=1000000;
  const currencies={USD:{rate:1,label:'Dolar AS'},EUR:{rate:1.1,label:'Euro'},SGD:{rate:.75,label:'Dolar Singapura'},JPY:{rate:.0067,label:'Yen Jepang'}};
  const branches={'arivai':'KC Palembang A. Rivai','sriwijaya':'KC Palembang Sriwijaya','sudirman':'KC Jakarta Sudirman','bandung':'KC Bandung Asia Afrika'};
  function toUsdCents(amount,currency){
    const n=Number(amount);
    if(!currencies[currency]||!Number.isFinite(n)||n<=0||n>1000000000)throw new Error('Masukkan nominal positif yang valid.');
    const cents=Math.round((n*currencies[currency].rate+Number.EPSILON)*100);
    if(cents<1)throw new Error('Nilai ekuivalen minimum adalah USD 0,01.');
    return cents;
  }
  function accumulation(txs,personId,month){return txs.filter(t=>t.personId===personId&&t.month===month&&t.status==='completed').reduce((a,t)=>a+t.usdCents,0);}
  function reservedAmount(reservations,personId,month,excludeId=null,now=Date.now()){
    return reservations.filter(r=>r.personId===personId&&r.month===month&&r.status==='active'&&r.id!==excludeId&&r.expiresAt>now).reduce((sum,r)=>sum+r.usdCents,0);
  }
  function evaluate(txs,personId,month,amount,currency,reservations=[],excludeId=null,now=Date.now()){
    const before=accumulation(txs,personId,month),incoming=toUsdCents(amount,currency),projected=before+incoming;
    const reserved=reservedAmount(reservations,personId,month,excludeId,now),committed=projected+reserved;
    return{before,incoming,projected,reserved,committed,remaining:Math.max(0,LIMIT_CENTS-before-reserved),over:projected>LIMIT_CENTS,blockedByReservation:projected<=LIMIT_CENTS&&committed>LIMIT_CENTS,excess:Math.max(0,projected-LIMIT_CENTS)};
  }
  function fingerprint(form){return [form.personId,form.month,form.branch,form.currency,Number(form.amount).toFixed(4)].join('|');}
  function matchingApproval(requests,form){return requests.find(r=>r.status==='approved'&&r.fingerprint===fingerprint(form));}
  function canPost(txs,requests,form,reservations=[],now=Date.now()){
    if(!form.verified)throw new Error('Verifikasi identitas terlebih dahulu.');
    if(!branches[form.branch])throw new Error('Cabang transaksi tidak valid.');
    if(!form.personId||!/^2026-(09|10|11)$/.test(form.month))throw new Error('Nasabah atau periode tidak valid.');
    if(form.reservationId&&!reservations.some(r=>r.id===form.reservationId&&r.status==='active'&&r.expiresAt>now&&r.fingerprint===fingerprint(form)))throw new Error('Pencadangan kedaluwarsa atau tidak sesuai pengajuan. Periksa kembali kuota.');
    const evaluation=evaluate(txs,form.personId,form.month,form.amount,form.currency,reservations,form.reservationId,now);
    const approval=matchingApproval(requests,form);
    if(evaluation.over&&!approval)throw new Error('Transaksi terkunci. Persetujuan underlying diperlukan.');
    if(evaluation.blockedByReservation&&!approval)throw new Error('Kuota sedang dicadangkan oleh transaksi lain. Tunggu penyelesaian atau pelepasan kuota.');
    return{evaluation,approval};
  }
  function postTransaction(state,form,id){
    if(state.transactions.some(t=>t.id===id))throw new Error('Referensi transaksi sudah diproses.');
    const {evaluation,approval}=canPost(state.transactions,state.requests,form,state.reservations||[]);
    const tx={id,personId:form.personId,month:form.month,branch:form.branch,currency:form.currency,amount:Number(form.amount),usdCents:evaluation.incoming,date:form.month+'-22',time:new Date().toLocaleTimeString('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit'}),status:'completed',underlying:!!approval,requestId:approval?.id||null,channel:form.channel||'WIC'};
    state.transactions.unshift(tx);if(approval)approval.status='settled';
    if(form.reservationId){const reservation=state.reservations.find(r=>r.id===form.reservationId);reservation.status='settled';}
    return tx;
  }
  function reserveQuota(state,form,id,now=Date.now()){
    if((state.reservations||[]).some(r=>r.id===id))throw new Error('Referensi pencadangan sudah digunakan.');
    const {evaluation}=canPost(state.transactions,state.requests,form,state.reservations||[],now);
    if(evaluation.over)throw new Error('Pencadangan kuota tanpa underlying tidak tersedia untuk pengajuan ini.');
    const reservation={id,personId:form.personId,month:form.month,branch:form.branch,usdCents:evaluation.incoming,fingerprint:fingerprint(form),form:{...form,reservationId:undefined},status:'active',expiresAt:now+10*60*1000};
    (state.reservations||(state.reservations=[])).push(reservation);return reservation;
  }
  function releaseReservation(state,id){const r=(state.reservations||[]).find(r=>r.id===id);if(!r||r.status!=='active')throw new Error('Pencadangan tidak aktif.');r.status='cancelled';return r;}
  function validateDocument(doc,incoming){
    if(!doc.type||!doc.reference?.trim()||!doc.filename)throw new Error('Lengkapi jenis, nomor, dan dokumen underlying.');
    if(!Number.isFinite(Number(doc.usdValue))||Math.round(Number(doc.usdValue)*100)<incoming)throw new Error('Nilai dokumen harus mencukupi seluruh pengajuan dalam simulasi ini.');
    return true;
  }
  function seed(){return{version:2,updatedAt:new Date().toISOString(),reservations:[],transactions:[
    {id:'QG-261002-001',personId:'dimas',month:'2026-10',branch:'arivai',currency:'USD',amount:5000,usdCents:500000,date:'2026-10-02',time:'09.14',status:'completed',underlying:false,channel:'WIC'},
    {id:'QG-261014-002',personId:'dimas',month:'2026-10',branch:'sudirman',currency:'SGD',amount:4000,usdCents:300000,date:'2026-10-14',time:'11.32',status:'completed',underlying:false,channel:'WIC'},
    {id:'QG-261006-003',personId:'nadia',month:'2026-10',branch:'sriwijaya',currency:'USD',amount:3000,usdCents:300000,date:'2026-10-06',time:'10.05',status:'completed',underlying:false,channel:'WIC'},
    {id:'QG-261005-004',personId:'bima',month:'2026-10',branch:'bandung',currency:'USD',amount:6000,usdCents:600000,date:'2026-10-05',time:'13.10',status:'completed',underlying:false,channel:'Pemilik rekening'},
    {id:'QG-261019-005',personId:'bima',month:'2026-10',branch:'arivai',currency:'USD',amount:4000,usdCents:400000,date:'2026-10-19',time:'09.38',status:'completed',underlying:false,channel:'WIC'},
    {id:'QG-261008-006',personId:'alex',month:'2026-10',branch:'sudirman',currency:'EUR',amount:2000,usdCents:220000,date:'2026-10-08',time:'14.02',status:'completed',underlying:false,channel:'WIC'},
    {id:'QG-260911-007',personId:'dimas',month:'2026-09',branch:'arivai',currency:'USD',amount:9000,usdCents:900000,date:'2026-09-11',time:'10.00',status:'completed',underlying:false,channel:'WIC'}
  ],requests:[],audit:[]};}
  const api={LIMIT_CENTS,currencies,branches,toUsdCents,accumulation,reservedAmount,evaluate,fingerprint,matchingApproval,canPost,postTransaction,reserveQuota,releaseReservation,validateDocument,seed};
  root.QuotaDomain=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
