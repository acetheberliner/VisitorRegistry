// Entry module — orchestratore leggero che usa api/render/signalr modules

import * as api from './api.js';
import * as render from './render.js';
import { startSignalR } from './signalr.js';

// semplice gestione error banner
function showError(msg) {
  const el = document.getElementById('receptionError');
  if (!el) return;
  if (msg) { el.innerText = msg; el.classList.remove('d-none'); }
  else { el.classList.add('d-none'); el.innerText = ''; }
}

// handler usati da render
render.init({
  onCheckout: async (id) => {
    try {
      const updated = await api.checkoutVisit(id);
      render.renderRow(updated);
      render.openDetail(id, updated);
      showError(null);
    } catch (e) {
      console.error('checkout error', e);
      showError('Checkout fallito: ' + (e.message || e));
    }
  },
  onEdit: (id, dto) => {
    // populate modal using DOM-dervied data (getRowData) or DTO fallback
    const data = render.getRowData(id, dto);
    openManualModalForEdit(id, data);
  },
  onDelete: async (id) => {
    if (!confirm('Eliminare questa entry?')) return;
    try {
      await api.deleteVisit(id);
      const row = document.getElementById('v-' + id); if (row && row.parentNode) row.parentNode.removeChild(row);
      document.getElementById('detailPane')?.classList.add('d-none');
      document.getElementById('detailEmpty')?.classList.remove('d-none');
      render.updateStats();
      showError(null);
    } catch (e) {
      console.error('delete error', e);
      showError('Eliminazione fallita: ' + (e.message || e));
      alert('Eliminazione fallita: ' + (e.message || 'errore'));
    }
  }
});

// Modal helpers (Bootstrap if present)
const modalEl = document.getElementById('manualModal');
let bsModal = null;
if (modalEl && typeof bootstrap !== 'undefined') { try { bsModal = new bootstrap.Modal(modalEl); } catch { } }

function openManualModalForEdit(id, data) {
  document.getElementById('manualForm').reset();
  document.getElementById('manualEditingId').value = id || '';
  document.getElementById('manualFirstName').value = data?.FirstName || data?.firstName || '';
  document.getElementById('manualLastName').value = data?.LastName || data?.lastName || '';
  document.getElementById('manualEmail').value = data?.Email || data?.email || '';
  document.getElementById('manualQr').value = data?.QrKey || data?.qrKey || '';
  document.getElementById('manualModalLabel').innerText = id ? 'Modifica visitatore' : 'Aggiungi visitatore';
  showError(null);
  if (bsModal) bsModal.show(); else modalEl && (modalEl.style.display = 'block');
}
function openManualModalForAdd() {
  document.getElementById('manualForm').reset();
  document.getElementById('manualEditingId').value = '';
  document.getElementById('manualModalLabel').innerText = 'Aggiungi visitatore';
  showError(null);
  if (bsModal) bsModal.show(); else modalEl && (modalEl.style.display = 'block');
}
function closeManualModal() { if (bsModal) bsModal.hide(); else modalEl && (modalEl.style.display = 'none'); }

// form submit
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('manualForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('manualEditingId').value || null;
      const payload = {
        FirstName: document.getElementById('manualFirstName').value.trim(),
        LastName: document.getElementById('manualLastName').value.trim(),
        Email: (document.getElementById('manualEmail').value || '').trim(),
        QrKey: (document.getElementById('manualQr').value || '').trim()
      };
      try {
        if (id) {
          const updated = await api.updateVisit(id, payload);
          render.renderRow(updated);
          render.openDetail(id, updated);
          closeManualModal();
          showError(null);
        } else {
          const res = await api.createVisit(payload);
          if (res.status === 409) {
            alert(res.body?.message || 'Check-in duplicato: visita esistente.');
            if (res.body?.visit) { render.renderRow(res.body.visit); render.openDetail(res.body.visit.Id, res.body.visit); }
            showError(null);
          } else {
            render.renderRow(res.body);
            render.openDetail(res.body.Id, res.body);
            closeManualModal();
            showError(null);
          }
        }
      } catch (err) {
        console.error('manual submit error', err);
        showError('Operazione fallita: ' + (err.message || err));
        alert('Operazione fallita: ' + (err.message || 'errore'));
      }
    });
  }

  // bindings quick actions
  document.getElementById('addManualBtn')?.addEventListener('click', () => openManualModalForAdd());
  document.getElementById('applyFilters')?.addEventListener('click', loadAndRender);
  document.getElementById('clearFilters')?.addEventListener('click', () => { document.getElementById('filterSearch') && (document.getElementById('filterSearch').value = ''); document.getElementById('filterStart') && (document.getElementById('filterStart').value = ''); document.getElementById('filterEnd') && (document.getElementById('filterEnd').value = ''); document.getElementById('filterPresent') && (document.getElementById('filterPresent').checked = false); loadAndRender(); });
  document.getElementById('exportBtn')?.addEventListener('click', () => { location.href = api.exportUrl(buildQueryFromForm()); });
  document.getElementById('exportBtn2')?.addEventListener('click', () => { location.href = api.exportUrl(buildQueryFromForm()); });

  // initial load + SignalR
  loadAndRender();
  startSignalR(render.renderRow, render.renderRow);

  // idcheck updater
  setInterval(() => {
    try {
      const sel = document.querySelector('#visits tbody tr.selected');
      const idEl = document.getElementById('idcheck');
      if (!sel) { idEl && (idEl.innerText = '-'); } else { idEl && (idEl.innerText = sel.dataset.shortcode || sel.id.replace(/^v-/, '').substr(0, 5)); }
    } catch (e) { }
  }, 1500);
});

// helper query builder
function buildQueryFromForm() {
  const q = document.getElementById('filterSearch')?.value?.trim() || '';
  const start = document.getElementById('filterStart')?.value;
  const end = document.getElementById('filterEnd')?.value;
  const presentOnly = document.getElementById('filterPresent')?.checked;
  const p = []; if (q) p.push('q=' + encodeURIComponent(q)); if (start) p.push('start=' + encodeURIComponent(start)); if (end) p.push('end=' + encodeURIComponent(end)); if (presentOnly) p.push('presentOnly=true');
  return p.length ? ('?' + p.join('&')) : '';
}

async function loadAndRender() {
  try {
    showError(null);
    const qs = buildQueryFromForm();
    const arr = await api.fetchVisits({ q: document.getElementById('filterSearch')?.value?.trim(), start: document.getElementById('filterStart')?.value, end: document.getElementById('filterEnd')?.value, presentOnly: document.getElementById('filterPresent')?.checked });
    const tbody = document.querySelector('#visits tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (Array.isArray(arr) && arr.length === 0) {
      // ok: empty result
    }
    for (const it of arr) render.renderRow(it);
    render.updateStats();
    showError(null);
  } catch (e) {
    console.error('loadAndRender failed', e);
    showError('Errore caricamento visite: ' + (e.message || e));
    // keep current table to avoid "disappear"
  }
}
