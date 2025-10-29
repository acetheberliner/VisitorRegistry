import * as api from './api.js';
import * as render from './render.js';
import { startSignalR } from './signalr.js';

// selettori filtri e bottoni
const filterSearch = document.getElementById('filterSearch');
const filterStart = document.getElementById('filterStart');
const filterEnd = document.getElementById('filterEnd');
const filterPresent = document.getElementById('filterPresent');
const applyFiltersBtn = document.getElementById('applyFilters');
const clearFiltersBtn = document.getElementById('clearFilters');
const exportBtn = document.getElementById('exportBtn');
const exportBtn2 = document.getElementById('exportBtn2');

// costruisce parametri di filtro
function buildParams() {
  return {
    q: (filterSearch && filterSearch.value || '').trim(),
    start: filterStart && filterStart.value,
    end: filterEnd && filterEnd.value,
    presentOnly: filterPresent && filterPresent.checked
  };
}

// carica visite con filtri e renderizza
async function loadVisits() {
  try {
    const params = buildParams();
    const arr = await api.fetchVisits(params);
    const tbody = document.querySelector('#visits tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    for (let i=0;i<arr.length;i++) render.renderRow(arr[i]);
    render.updateStats();
  } catch(e){ console.error('loadVisits', e); }
}

// associa eventi ai bottoni
if (applyFiltersBtn) applyFiltersBtn.addEventListener('click', loadVisits);
if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', ()=>{ if (filterSearch) filterSearch.value=''; if(filterStart) filterStart.value=''; if(filterEnd) filterEnd.value=''; if(filterPresent) filterPresent.checked=false; loadVisits(); });
if (exportBtn) exportBtn.addEventListener('click', ()=> { window.location = api.exportUrl(buildParams()); });
if (exportBtn2) exportBtn2.addEventListener('click', ()=> { window.location = api.exportUrl(buildParams()); });

// carica dati iniziali e avvia signalR
loadVisits();
startSignalR();

// aggiorna controllo ID in dettaglio visita
document.addEventListener('click', ()=> setTimeout(()=>render.updateIdCheck(),50), true);
const tbody = document.querySelector('#visits tbody');
if (tbody && window.MutationObserver) { const mo = new MutationObserver(()=>render.updateIdCheck()); mo.observe(tbody,{ childList:true, subtree:true, attributes:true }); }
setInterval(()=>render.updateIdCheck(),1500);
document.addEventListener('DOMContentLoaded', ()=>render.updateIdCheck());
