import { escapeHtml, getField, formatDate, computeDurationMs, formatDuration, generateShortFromGuid, parseDateFlexible } from './utils.js';
import * as api from './api.js';

// selettori elementi UI
const selectors = {
  tableBody: '#visits tbody',
  presentNow: '#presentNow',
  lastCheckin: '#lastCheckin',
  totalRecords: '#totalRecords',
  visitCount: '#visitCount',
  detailPane: '#detailPane',
  detailEmpty: '#detailEmpty',
  detailName: '#detailName',
  detailEmail: '#detailEmail',
  detailQr: '#detailQr',
  detailIn: '#detailIn',
  detailOut: '#detailOut',
  detailDuration: '#detailDuration',
  idcheck: '#idcheck',
  detailCheckoutBtn: '#detailCheckoutBtn'
};

function el(sel) { return document.querySelector(sel); }
function elAll(sel) { return Array.from(document.querySelectorAll(sel)); }

let currentDetailVisit = null;
let durationTimer = null;

// aggiorna statistiche
export function updateStats() {
  const tbody = document.querySelector(selectors.tableBody);
  if (!tbody) return;
  const rows = tbody.getElementsByTagName('tr');
  el(selectors.totalRecords).innerText = rows.length;
  let present = 0;
  for (let i=0;i<rows.length;i++){
    const usc = rows[i].getElementsByTagName('td')[5];
    if (!usc || !usc.innerText.trim()) present++;
  }
  el(selectors.presentNow).innerText = present;
  el(selectors.visitCount).innerText = 'Visitatori attualmente presenti: ' + present;
  const first = tbody.getElementsByTagName('tr')[0];
  el(selectors.lastCheckin).innerText = first ? (first.getElementsByTagName('td')[4].innerText || '-') : '-';
}

// aggiorna durata in dettaglio visita
function updateDuration() {
  if (!currentDetailVisit) { if (el(selectors.detailDuration)) el(selectors.detailDuration).innerText = '-'; return; }
  const ms = computeDurationMs(currentDetailVisit);
  if (el(selectors.detailDuration)) el(selectors.detailDuration).innerText = formatDuration(ms);
}

// pulisce timer durata
function clearDurationTimer() {
  if (durationTimer) { clearInterval(durationTimer); durationTimer = null; }
  currentDetailVisit = null;
  if (el(selectors.detailDuration)) el(selectors.detailDuration).innerText = '-';
}

// renderizza riga entry tabella visita
export function renderRow(v) {
  if (!v) return;
  const id = getField(v,'Id','id') || getField(v,'id','Id');
  if (!id) return;
  let row = document.getElementById('v-' + id);
  if (!row) {
    row = document.createElement('tr'); row.id = 'v-' + id;
    const tbody = document.querySelector(selectors.tableBody);
    if (tbody) tbody.insertBefore(row, tbody.firstChild);
  }
  const qr = escapeHtml(getField(v,'QrKey','qrKey'));
  const email = escapeHtml(getField(v,'Email','email'));
  const first = escapeHtml(getField(v,'FirstName','firstName'));
  const last = escapeHtml(getField(v,'LastName','lastName'));
  const cin = formatDate(getField(v,'CheckInTime','checkInTime'));
  const cout = formatDate(getField(v,'CheckOutTime','checkOutTime'));
  const short = getField(v,'ShortCode','shortCode') || generateShortFromGuid(id);

  const qrHtml = '<div style="font-size:0.9rem;color:#6b7280">'+qr+'</div><div class="fw-bold">'+short+'</div>';
  const actionsHtml = cout ? '<button class="btn btn-sm btn-outline-secondary" disabled>Uscito</button>' : '<button class="btn btn-sm btn-success" onclick="window.__reception.openDetailFromRow(\''+id+'\')">Presente</button>';

  row.innerHTML = ''
    + '<td>' + qrHtml + '</td>'
    + '<td>' + email + '</td>'
    + '<td>' + first + '</td>'
    + '<td>' + last + '</td>'
    + '<td>' + cin + '</td>'
    + '<td>' + cout + '</td>'
    + '<td>' + actionsHtml + '</td>';

  try { row.dataset.shortcode = short; row.dataset.qr = qr; } catch(e){}
  row.onclick = function(){ openDetail(id, v); };
  updateStats();
}

// apre dettaglio visita
export function openDetail(id, v){
  clearDurationTimer();
  const rows = document.querySelectorAll('#visits tbody tr'); rows.forEach(r=>r.classList.remove('selected'));
  const r = document.getElementById('v-'+id); if (r) r.classList.add('selected');
  const detailEmpty = el(selectors.detailEmpty), detailPane = el(selectors.detailPane);
  if (detailEmpty) detailEmpty.classList.add('d-none'); if (detailPane) detailPane.classList.remove('d-none');

  // popola dettaglio
  if (el(selectors.detailName)) el(selectors.detailName).innerText = getField(v,'FirstName','firstName') + ' ' + getField(v,'LastName','lastName');
  if (el(selectors.detailEmail)) el(selectors.detailEmail).innerText = getField(v,'Email','email');
  if (el(selectors.detailQr)) el(selectors.detailQr).innerText = getField(v,'QrKey','qrKey');
  if (el(selectors.detailIn)) el(selectors.detailIn).innerText = formatDate(getField(v,'CheckInTime','checkInTime'));
  if (el(selectors.detailOut)) el(selectors.detailOut).innerText = formatDate(getField(v,'CheckOutTime','checkOutTime'));

  try {
    const idCheckEl = el(selectors.idcheck);
    const shortFromDto = getField(v,'ShortCode','shortCode');
    const shortVal = shortFromDto || generateShortFromGuid(id);
    if (idCheckEl) idCheckEl.innerText = shortVal;
  } catch(e){}

  const checkoutBtn = el(selectors.detailCheckoutBtn);
  if (checkoutBtn) {
    if (getField(v,'CheckOutTime','checkOutTime')) { checkoutBtn.disabled = true; checkoutBtn.innerText = 'Uscita registrata'; }
    else { checkoutBtn.disabled = false; checkoutBtn.innerText = 'Check-out'; checkoutBtn.onclick = async ()=>{ try { checkoutBtn.disabled = true; checkoutBtn.innerText='⏳'; const updated = await api.checkoutVisit(id); renderRow(updated); openDetail(id, updated); } catch(e){ console.error(e); checkoutBtn.disabled=false; checkoutBtn.innerText='Check-out'; } }; }
  }

  if (v){ delete v.__ci; delete v.__co; }
  currentDetailVisit = v;
  updateDuration();
  if (!parseDateFlexible(getField(v,'CheckOutTime','checkOutTime'))) durationTimer = setInterval(updateDuration,1000);
}

// apre modalità modifica in dettaglio visita NON ANCORA ATTIVA
export async function openEditInDetail(id, v){
  clearDurationTimer();
  if (el(selectors.detailName)) el(selectors.detailName).innerHTML = '<input id="edit-first" class="form-control form-control-sm" value="'+escapeHtml(getField(v,'FirstName','firstName'))+'" />';
  if (el(selectors.detailEmail)) el(selectors.detailEmail).innerHTML = '<input id="edit-email" class="form-control form-control-sm" value="'+escapeHtml(getField(v,'Email','email'))+'" />';
  if (el(selectors.detailQr)) el(selectors.detailQr).innerHTML = '<input id="edit-qr" class="form-control form-control-sm" value="'+escapeHtml(getField(v,'QrKey','qrKey'))+'" />';
  const checkoutBtn = el(selectors.detailCheckoutBtn); if (checkoutBtn) checkoutBtn.style.display='none';
  const actions = checkoutBtn ? checkoutBtn.parentElement : null;
  if (actions) {
    const save = document.createElement('button'); save.className='btn btn-success btn-sm'; save.innerText='Salva';
    save.onclick = async function(){
      const payload = { FirstName: document.getElementById('edit-first').value, Email: document.getElementById('edit-email').value, QrKey: document.getElementById('edit-qr').value };
      try { const updated = await api.putVisit(id, payload); renderRow(updated); openDetail(id, updated); } catch(e){ alert('Salvataggio fallito: '+e.message); }
      finally { if (checkoutBtn) checkoutBtn.style.display=''; actions.querySelectorAll('.btn').forEach(b=>{ if(b.innerText==='Salva' || b.innerText==='Annulla') actions.removeChild(b); }); }
    };
    const cancel = document.createElement('button'); cancel.className='btn btn-outline-secondary btn-sm'; cancel.innerText='Annulla';
    cancel.onclick = ()=>{ loadVisits(); };
    actions.appendChild(save); actions.appendChild(cancel);
  }
}

// elimina visita NON ANCORA ATTIVA 
export async function deleteVisit(id, btn) {
  if (!confirm('Eliminare questa entry?')) return;
  try {
    if (btn) btn.disabled = true;
    await api.deleteVisit(id);
    const row = document.getElementById('v-'+id); if (row && row.parentNode) row.parentNode.removeChild(row);
    const detailPane = el(selectors.detailPane), detailEmpty = el(selectors.detailEmpty);
    if (detailPane) detailPane.classList.add('d-none'); if (detailEmpty) detailEmpty.classList.remove('d-none');
    clearDurationTimer(); updateStats();
  } catch(e){ alert('Eliminazione fallita: ' + e.message); if (btn) btn.disabled=false; }
}

// aggiorna controllo ID in dettaglio visita
export function updateIdCheck() {
  try {
    const idEl = el(selectors.idcheck);
    if (!idEl) return;
    const detailPaneLocal = el(selectors.detailPane);
    if (!detailPaneLocal || detailPaneLocal.classList.contains('d-none')) { idEl.innerText='-'; return; }
    const sel = document.querySelector('#visits tbody tr.selected');
    let idText = '-';
    if (sel) {
      if (sel.dataset && sel.dataset.shortcode) idText = sel.dataset.shortcode;
      else { const rid = sel.id ? sel.id.replace(/^v-/, '') : ''; idText = rid ? generateShortFromGuid(rid) : '-'; }
    } else {
      const detailId = document.querySelector('[data-visit-id]');
      if (detailId && detailId.dataset && detailId.dataset.visitId) idText = detailId.dataset.visitId;
    }
    idEl.innerText = idText;
  } catch(e){ console.error('updateIdCheck error', e); }
}

window.__reception = window.__reception || {};
window.__reception.openDetailFromRow = function(id){ document.getElementById('v-'+id)?.click(); };
