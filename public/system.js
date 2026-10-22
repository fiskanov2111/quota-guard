'use strict';
// Adapter for the shared system. The standalone demo remains /demo.html.
const system={shared:false,actor:null,busy:false,uncertain:new Map()};
const displaySignature=()=>data.updatedAt+'|'+data.reservations.filter(r=>r.status==='active'&&r.expiresAt>Date.now()).map(r=>r.id).join(',');
const originalRender=render,originalUnderlying=openUnderlying,originalReview=review,originalGuide=guide;
async function apiRequest(body){
  const response=await fetch('/api/gateway'+(body?'':'?op=state'),{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store'});
  const value=await response.json();
  if(!response.ok){const e=new Error(value.error||'Permintaan gagal.');e.status=response.status;if(response.status===401&&body?.action!=='login')showLogin('Sesi berakhir. Silakan masuk kembali.');throw e;}
  return value;
}
async function loadShared(){const value=await apiRequest();system.actor=value.actor;data=value.state;ui.role=value.actor.role;return value;}
async function mutate(action,payload){
  if(system.busy)throw new Error('Tunggu proses sebelumnya selesai.');
  const key=JSON.stringify({action,payload});
  const mutationId=system.uncertain.get(key)||(crypto.randomUUID?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join(''));system.uncertain.set(key,mutationId);system.busy=true;
  try{const value=await apiRequest({action,payload,mutationId});system.uncertain.delete(key);data=value.state;return value.result;}
  catch(e){if(e.status)system.uncertain.delete(key);throw e;}
  finally{system.busy=false;}
}
function showLogin(message=''){
  system.actor=null;
  document.body.classList.add('starting');
  if($('#dialog').open)closeDialog();
  let root=$('#system-login');if(!root){root=document.createElement('section');root.id='system-login';root.className='login-screen';document.body.append(root);}
  root.innerHTML=`<form id="login-form" class="login-card"><div class="login-brand">BRI <span>MONEY CHANGER</span></div><div class="eyebrow">QUOTA GUARD</div><h1>Masuk ke workspace</h1><p>Monitoring dan pengendalian pembelian valas tunai.<br>Gunakan akun Teller atau Pemeriksa yang telah didaftarkan.</p><label class="field">Email<input type="email" id="login-email" autocomplete="username" required maxlength="254"></label><label class="field">Password<input type="password" id="login-password" autocomplete="current-password" required maxlength="1024"></label><div id="login-error" class="login-error" role="alert">${esc(message)}</div><button class="btn primary full-width" id="login-submit" type="submit">Masuk ke Quota Guard →</button><small>Sistem demonstrasi · identitas, kurs, dan transaksi fiktif.</small></form>`;
  $('#login-form').onsubmit=async e=>{e.preventDefault();const b=$('#login-submit');b.disabled=true;$('#login-error').textContent='';try{await apiRequest({action:'login',email:$('#login-email').value.trim(),password:$('#login-password').value});await loadShared();root.remove();document.body.classList.remove('starting');render();}catch(err){$('#login-error').textContent=err.message;}finally{b.disabled=false;}};
}
render=function(){
  originalRender();if(!system.shared)return;
  system.displayed=displaySignature();
  ui.role=system.actor?.role||'teller';
  const role=$('#role');role.value=ui.role;role.disabled=true;for(const option of role.options)option.textContent=option.value==='teller'?'Teller':'Pemeriksa';
  $('.top-demo').textContent='SISTEM DEMO';$('#avatar').textContent=ui.role==='teller'?'TL':'PM';
  const demo=$('.demo-sidebar');demo.innerHTML='<span class="demo-dot"></span>Workspace bersama<p>Data fiktif tersimpan terpusat.<br>Hak akses sesuai akun masuk.</p><button class="sidebar-link" id="system-guide">Panduan penggunaan ↗</button>';$('#system-guide').onclick=guide;
  $('#reset-data').hidden=true;
  $('.app-footer').innerHTML='<span><span class="status-dot"></span>Data bersama · pembaruan berkala setiap 5 detik</span><span>Quota Guard · Sistem demonstrasi</span>';
  let account=$('#system-account');if(!account){account=document.createElement('div');account.id='system-account';account.className='system-account';$('.topbar-right').append(account);}
  account.innerHTML=`<span>${esc(system.actor?.email||'')}</span><button class="subtle-btn" id="system-logout">Keluar</button>`;
  $('#system-logout').onclick=async()=>{try{await apiRequest({action:'logout'});}catch{}system.actor=null;data=D.seed();showLogin();};
  $('#refresh-data')?.addEventListener('click',async()=>{try{await loadShared();render();toast('Data terpusat diperbarui.');}catch(e){toast(e.message);}});
  for(const id of ['switch-checker','switch-reviewer']){const el=$('#'+id);if(el)el.hidden=true;}
  const notice=$('.role-notice');if(notice&&ui.role==='teller')notice.innerHTML='Pengajuan menunggu akun Pemeriksa. Masuk menggunakan akun Pemeriksa di browser lain, atau keluar dan ganti akun.';
};
const localPersist=persist,localRefresh=refreshData,localAudit=audit,localSetRole=setRole;
persist=function(){if(!system.shared)localPersist();};
refreshData=function(){if(!system.shared)localRefresh();};
audit=function(...args){if(!system.shared)localAudit(...args);};
setRole=function(role){if(system.shared){ui.role=system.actor.role;render();toast('Peran mengikuti akun yang masuk.');}else localSetRole(role);};
const localProcess=processTx,localReserve=reserveCurrent,localBindReservations=bindReservations,localCancel=cancelTransaction;
processTx=async function(){if(!system.shared)return localProcess();const b=$('#process-tx');if(b)b.disabled=true;try{const tx=await mutate('post',{form:form()});ui.reservationId=null;render();success(tx);}catch(e){render();toast(e.message);}};
reserveCurrent=async function(){if(!system.shared)return localReserve();try{const r=await mutate('reserve',{form:form()});ui.reservationId=r.id;render();toast('Kuota dicadangkan pada database selama 10 menit.');}catch(e){toast(e.message);}};
bindReservations=function(){
  if(!system.shared)return localBindReservations();
  $('#demo-reserve')?.addEventListener('click',async()=>{try{await loadShared();const available=D.LIMIT_CENTS-D.accumulation(data.transactions,ui.personId,ui.month)-D.reservedAmount(data.reservations,ui.personId,ui.month);if(available<=0)throw new Error('Tidak ada kuota tersedia.');const f={...form(),branch:ui.branch==='sudirman'?'sriwijaya':'sudirman',currency:'USD',amount:Math.min(100000,available)/100};delete f.reservationId;await mutate('reserve',{form:f});render();toast('Pencadangan cabang lain telah dicatat pada database.');}catch(e){toast(e.message);}});
  $$('[data-resume-reservation]').forEach(b=>b.onclick=()=>{const r=data.reservations.find(r=>r.id===b.dataset.resumeReservation);if(system.actor.role!=='teller'||r?.createdBy!==system.actor.id){toast('Lanjutkan menggunakan akun teller pembuat pencadangan.');return;}if(!r||r.expiresAt<=Date.now()){toast('Pencadangan telah berakhir.');return;}const p=person(r.personId);Object.assign(ui,{...r.form,role:system.actor.role,view:'transaksi',query:p.identity,identityType:p.type,reservationId:r.id,amount:String(r.form.amount),verified:true});render();});
  $$('[data-release-reservation]').forEach(b=>b.onclick=()=>{const r=data.reservations.find(r=>r.id===b.dataset.releaseReservation);dialog('Lepas pencadangan kuota?','Kuota kembali tersedia setelah pencadangan dibatalkan.',`<p class="dialog-note">${esc(r.id)} · ${money(r.usdCents)}</p>`,`<button class="btn" data-close>Kembali</button><button class="btn primary" id="server-release">Lepas kuota</button>`);$('#server-release').onclick=async()=>{try{await mutate('release',{id:r.id});if(ui.reservationId===r.id)ui.reservationId=null;closeDialog();render();toast('Pencadangan telah dilepas.');}catch(e){toast(e.message);}};});
};
openUnderlying=function(){
  originalUnderlying();if(!system.shared||!$('#submit-underlying'))return;
  $('#submit-underlying').onclick=async()=>{const b=$('#submit-underlying');b.disabled=true;try{const doc={type:$('#doc-type').value,reference:$('#doc-reference').value.trim(),usdValue:Number($('#doc-value').value),name:$('#doc-name').value.trim(),filename:ui.doc?.filename};await mutate('request',{form:form(),doc});closeDialog();go('persetujuan');toast('Pengajuan tersimpan. Menunggu akun Pemeriksa.');}catch(e){$('#doc-error').innerHTML=`<div class="error-inline">${esc(e.message)}</div>`;}finally{b.disabled=false;}};
};
function replaceListener(id,callback){const old=$('#'+id);if(!old)return;const fresh=old.cloneNode(true);old.replaceWith(fresh);fresh.onclick=callback;return fresh;}
review=function(rid){
  originalReview(rid);if(!system.shared)return;
  const r=data.requests.find(v=>v.id===rid);
  const change=$('#switch-reviewer');if(change)change.hidden=true;
  replaceListener('approve-request',async()=>{const checks=$$('.checker-box').map(c=>c.checked),note=$('#review-note').value.trim();try{await mutate('approve',{id:rid,checks,note});closeDialog();render();toast('Persyaratan disetujui. Teller dapat melanjutkan.');review(rid);}catch(e){$('#review-error').innerHTML=`<div class="error-inline">${esc(e.message)}</div>`;}});
  replaceListener('reject-request',async()=>{try{await mutate('reject',{id:rid,note:$('#review-note').value.trim()});closeDialog();render();toast('Pengajuan ditolak.');}catch(e){$('#review-error').innerHTML=`<div class="error-inline">${esc(e.message)}</div>`;}});
  const resume=replaceListener('resume-request',()=>{if(system.actor.role!=='teller'){toast('Masuk dengan akun Teller untuk melanjutkan.');return;}const p=person(r.form.personId);Object.assign(ui,{...r.form,amount:String(r.form.amount),verified:true,role:system.actor.role,view:'transaksi',query:p.identity,identityType:p.type});closeDialog();go('transaksi');});
  if(resume&&system.actor.role!=='teller'){resume.disabled=true;resume.textContent='Menunggu diproses akun Teller';}
};
cancelTransaction=function(tid){
  if(!system.shared)return localCancel(tid);
  if(system.actor.role!=='checker'){toast('Pembatalan memerlukan akun Pemeriksa.');return;}
  dialog('Batalkan transaksi demo','Perubahan dicatat pada database dan jejak audit.',`<p class="dialog-note">${esc(tid)}</p><label class="field">Alasan pembatalan<textarea id="server-cancel-reason" maxlength="300"></textarea></label><div id="server-cancel-error"></div>`,`<button class="btn" data-close>Kembali</button><button class="btn danger" id="server-cancel">Batalkan transaksi</button>`);
  $('#server-cancel').onclick=async()=>{try{await mutate('cancel',{id:tid,reason:$('#server-cancel-reason').value.trim()});closeDialog();render();toast('Pembatalan tersimpan. Akumulasi telah diperbarui.');}catch(e){$('#server-cancel-error').textContent=e.message;}};
};
guide=function(){if(!system.shared)return originalGuide();dialog('Panduan workspace bersama','Alur Teller dan Pemeriksa menggunakan akun yang berbeda.',`<div class="guide-step"><span>1</span><div><h3>Masuk sebagai Teller</h3><p>Pilih skenario lintas cabang. Akumulasi USD8.000 dan pengajuan USD3.000 memerlukan underlying.</p></div></div><div class="guide-step"><span>2</span><div><h3>Ajukan dokumen contoh</h3><p>Gunakan nomor dokumen yang belum dialokasikan. Hanya metadata dokumen yang disimpan dalam versi demonstrasi.</p></div></div><div class="guide-step"><span>3</span><div><h3>Periksa menggunakan akun Pemeriksa</h3><p>Masuk dari browser/profil lain atau keluar dan ganti akun. Lengkapi checklist, kemudian setujui atau tolak.</p></div></div><div class="guide-step"><span>4</span><div><h3>Teller menyelesaikan transaksi</h3><p>Muat ulang data atau tunggu pembaruan. Lanjutkan pengajuan yang disetujui, lalu proses transaksi. Periksa riwayat dan jejak audit.</p></div></div><div class="demo-disclaimer">Sistem demonstrasi dengan data fiktif. Tidak terhubung ke sistem BRI atau pembukuan transaksi nyata.</div>`,`<button class="btn primary" data-close>Mulai</button>`);};
document.addEventListener('click',e=>{if(system.shared&&['reset-data','confirm-reset'].includes(e.target.closest('button')?.id)){e.stopImmediatePropagation();e.preventDefault();}},true);
(async()=>{
  try{const response=await fetch('/api/gateway?op=config',{cache:'no-store'});const cfg=await response.json();if(!response.ok)throw new Error(cfg.error||'Konfigurasi tidak dapat dimuat.');
    if(cfg.mode==='demo'){document.body.classList.remove('starting');const note=document.createElement('div');note.className='system-banner';note.textContent='Demo browser · untuk data bersama dan login, aktifkan konfigurasi sistem sesuai README.';$('.workspace').prepend(note);return;}
    system.shared=true;window.QG_SHARED=true;
    try{await loadShared();document.body.classList.remove('starting');render();}catch(e){showLogin(e.status===401?'':e.message);}
    setInterval(async()=>{if(!system.actor||system.busy||document.visibilityState==='hidden'||$('#dialog').open)return;try{await loadShared();const active=document.activeElement;const editing=active&&['INPUT','TEXTAREA','SELECT'].includes(active.tagName);if(!editing&&displaySignature()!==system.displayed)render();}catch(e){if(e.status!==401)toast('Pembaruan tertunda. Periksa koneksi sebelum melanjutkan.');}},5000);
  }catch(e){showLogin(e.message+' Buka /demo.html untuk demo mandiri.');$('#login-submit').disabled=true;}
})();
