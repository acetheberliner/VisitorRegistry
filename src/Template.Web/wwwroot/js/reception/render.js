import { escapeHtml, formatDate, generateShortFromGuid, computeDurationMs, formatDuration } from './utils.js';

let handlers = {
  onCheckout: null,
  onEdit: null,
  onDelete: null
};

export function init(h) {
  handlers = Object.assign(handlers, h || {});
}

// legge dati da riga DOM o DTO fallback
export function getRowData(id, dto) {
  const row = document.getElementById('v-' + id);
  if (row) {
    try {
      const cells = row.getElementsByTagName('td');
      const qr = row.dataset && row.dataset.qr ? row.dataset.qr : (cells[0] ? cells[0].innerText.trim() : '');
      const email = cells[1] ? cells[1].innerText.trim() : '';
      const first = cells[2] ? cells[2].innerText.trim() : '';
      const last = cells[3] ? cells[3].innerText.trim() : '';
      return {
        Id: id,
        QrKey: qr,
        Email: email,
        FirstName: first,
        LastName: last,
        CheckInTime: (cells[4] ? cells[4].innerText.trim() : ''),
        CheckOutTime: (cells[5] ? cells[5].innerText.trim() : '')
      };
    } catch (e) { /* fallback */ }
  }
  // fallback to DTO if provided
  return dto || { Id: id };
}

export function renderRow(v) {
  if (!v) return;
  const id = v.Id || v.id;
  if (!id) return;
  let row = document.getElementById('v-' + id);
  if (!row) {
    row = document.createElement('tr');
    row.id = 'v-' + id;
    const tbody = document.querySelector('#visits tbody');
    if (tbody) tbody.insertBefore(row, tbody.firstChild);
  }
  const qr = escapeHtml(v.QrKey || v.qrKey || '');
  const email = escapeHtml(v.Email || v.email || '');
  const first = escapeHtml(v.FirstName || v.firstName || '');
  const last = escapeHtml(v.LastName || v.lastName || '');
  const cin = formatDate(v.CheckInTime || v.checkInTime);
  const cout = formatDate(v.CheckOutTime || v.checkOutTime);
  const short = v.ShortCode || v.shortCode || generateShortFromGuid(id);

  const qrHtml = `<div style="font-size:0.9rem;color:#6b7280">${qr}</div><div class="fw-bold">${short}</div>`;
  const actionsHtml = cout
    ? '<button class="btn btn-sm btn-outline-secondary" disabled>Uscito</button>'
    : `<button class="btn btn-sm btn-success js-present" data-id="${id}">Presente</button>`;

  row.innerHTML = ''
    + '<td>' + qrHtml + '</td>'
    + '<td>' + email + '</td>'
    + '<td>' + first + '</td>'
    + '<td>' + last + '</td>'
    + '<td>' + cin + '</td>'
    + '<td>' + cout + '</td>'
    + '<td>' + actionsHtml + '</td>';

  try { row.dataset.shortcode = short; row.dataset.qr = qr; } catch (e) { }

  // bindings
  row.onclick = function () { openDetail(id, v); };
  const presentBtn = row.querySelector('.js-present');
  if (presentBtn) presentBtn.addEventListener('click', function (ev) { ev.stopPropagation(); openDetail(id, v); });

  updateStats();
}

export function updateStats() {
  const tbody = document.querySelector('#visits tbody');
  if (!tbody) return;
  const rows = tbody.getElementsByTagName('tr');
  const totalRecordsEl = document.getElementById('totalRecords');
  if (totalRecordsEl) totalRecordsEl.innerText = rows.length;
  let present = 0;
  for (let i = 0; i < rows.length; i++) {
    const usc = rows[i].getElementsByTagName('td')[5];
    if (!usc || !usc.innerText.trim()) present++;
  }
  const presentNowEl = document.getElementById('presentNow'); if (presentNowEl) presentNowEl.innerText = present;
  const visitCountEl = document.getElementById('visitCount'); if (visitCountEl) visitCountEl.innerText = 'Visitatori attualmente presenti: ' + present;
  const first = tbody.getElementsByTagName('tr')[0]; const lastCheckinEl = document.getElementById('lastCheckin'); if (lastCheckinEl) lastCheckinEl.innerText = first ? (first.getElementsByTagName('td')[4].innerText || '-') : '-';
}

export function openDetail(id, v) {
  // v may be partial; ensure we use DTO if available, else try to reconstruct
  const dto = v || getRowData(id);
  // highlight selected row
  const rows = document.querySelectorAll('#visits tbody tr');
  rows.forEach(r => r.classList.remove('selected'));
  const rowEl = document.getElementById('v-' + id); if (rowEl) rowEl.classList.add('selected');

  const detailEmpty = document.getElementById('detailEmpty'); if (detailEmpty) detailEmpty.classList.add('d-none');
  const detailPane = document.getElementById('detailPane'); if (detailPane) detailPane.classList.remove('d-none');

  const detailName = document.getElementById('detailName'); if (detailName) detailName.innerText = (dto.FirstName || dto.firstName || '') + ' ' + (dto.LastName || dto.lastName || '');
  const detailEmail = document.getElementById('detailEmail'); if (detailEmail) detailEmail.innerText = dto.Email || dto.email || '-';
  const detailQr = document.getElementById('detailQr'); if (detailQr) detailQr.innerText = dto.QrKey || dto.qrKey || '-';
  const detailIn = document.getElementById('detailIn'); if (detailIn) detailIn.innerText = formatDate(dto.CheckInTime || dto.checkInTime);
  const detailOut = document.getElementById('detailOut'); if (detailOut) detailOut.innerText = formatDate(dto.CheckOutTime || dto.checkOutTime);
  try { document.getElementById('idcheck') && (document.getElementById('idcheck').innerText = dto.ShortCode || dto.shortCode || generateShortFromGuid(id)); } catch (e) { }

  // checkout button -> delegate to handler
  const checkoutBtn = document.getElementById('detailCheckoutBtn');
  if (checkoutBtn) {
    if (dto.CheckOutTime || dto.checkOutTime) { checkoutBtn.disabled = true; checkoutBtn.innerText = 'Uscita registrata'; }
    else {
      checkoutBtn.disabled = false; checkoutBtn.innerText = 'Check-out';
      checkoutBtn.onclick = function () { if (handlers.onCheckout) handlers.onCheckout(id); };
    }
  }

  // edit/delete buttons -> delegate
  const editBtn = document.getElementById('detailEditBtn');
  if (editBtn) editBtn.onclick = function () { if (handlers.onEdit) handlers.onEdit(id, dto); };

  const delBtn = document.getElementById('detailDeleteBtn');
  if (delBtn) delBtn.onclick = function () { if (handlers.onDelete) handlers.onDelete(id); };

  // duration live
  try { clearInterval(window.__reception_duration_timer); } catch { }
  if (!(dto.CheckOutTime || dto.checkOutTime)) {
    window.__reception_duration_timer = setInterval(function () {
      const ms = computeDurationMs(dto);
      const el = document.getElementById('detailDuration'); if (el) el.innerText = formatDuration(ms);
    }, 1000);
  } else {
    const el = document.getElementById('detailDuration'); if (el) el.innerText = formatDuration(computeDurationMs(dto));
  }
}
