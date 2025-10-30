import { basePath } from './utils.js';

// costruisce query string dai parametri
function buildQuery(params = {}) {
  const p = [];
  if (params.q) p.push('q=' + encodeURIComponent(params.q));
  if (params.start) p.push('start=' + encodeURIComponent(params.start));
  if (params.end) p.push('end=' + encodeURIComponent(params.end));
  if (params.presentOnly) p.push('presentOnly=true');
  return p.length ? ('?' + p.join('&')) : '';
}

// recupera elenco visite con filtri
export async function fetchVisits(params) {
  const qs = buildQuery(params);
  const res = await fetch(basePath() + 'api/visits' + qs, { credentials: 'same-origin' });
  if (!res.ok) throw new Error('fetchVisits failed ' + res.status + ' ' + await res.text().catch(()=>'')); 
  return res.json();
}

// crea nuova visita (manuale)
export async function createVisit(payload) {
  const res = await fetch(basePath() + 'api/visits', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (res.status === 409) {
    // conflitto gestito dal client
    const json = await res.json().catch(()=>null);
    return { status: 409, body: json };
  }
  if (!res.ok) throw new Error('createVisit failed ' + res.status + ' ' + await res.text().catch(()=>'')); 
  return { status: res.status, body: await res.json() };
}

// effettua checkout della visita
export async function checkoutVisit(id) {
  const res = await fetch(basePath() + 'api/visits/' + encodeURIComponent(id) + '/checkout', { method: 'POST', credentials: 'same-origin' });
  if (!res.ok) throw new Error('checkout failed ' + res.status + ' ' + await res.text().catch(()=>'')); 
  return res.json();
}

// aggiorna visita esistente (PUT)
export async function updateVisit(id, payload) {
  const res = await fetch(basePath() + 'api/visits/' + encodeURIComponent(id), { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) {
    const txt = await res.text().catch(()=>null);
    throw new Error(txt || res.status);
  }
  return res.json();
}

// elimina visita
export async function deleteVisit(id) {
  const res = await fetch(basePath() + 'api/visits/' + encodeURIComponent(id), { method: 'DELETE', credentials: 'same-origin' });
  if (!res.ok) {
    const txt = await res.text().catch(()=>null);
    throw new Error(txt || res.status);
  }
  return true;
}

export function exportUrl(params) {
  return basePath() + 'api/visits/export' + buildQuery(params);
}
