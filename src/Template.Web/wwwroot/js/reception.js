// elements
const tbody = document.querySelector('#visits tbody');
const presentNowEl = document.getElementById('presentNow');
const lastCheckinEl = document.getElementById('lastCheckin');
const totalRecordsEl = document.getElementById('totalRecords');
const visitCountEl = document.getElementById('visitCount');
const detailPane = document.getElementById('detailPane');
const detailEmpty = document.getElementById('detailEmpty');
const detailName = document.getElementById('detailName');
const detailEmail = document.getElementById('detailEmail');
const detailQr = document.getElementById('detailQr');
const detailIn = document.getElementById('detailIn');
const detailOut = document.getElementById('detailOut');
const detailCheckoutBtn = document.getElementById('detailCheckoutBtn');

// filters
const filterSearch = document.getElementById('filterSearch');
const filterStart = document.getElementById('filterStart');
const filterEnd = document.getElementById('filterEnd');
const filterPresent = document.getElementById('filterPresent');
const applyFiltersBtn = document.getElementById('applyFilters');
const clearFiltersBtn = document.getElementById('clearFilters');
const exportBtn = document.getElementById('exportBtn');
const exportBtn2 = document.getElementById('exportBtn2');

let selectedId = null;

// SignalR
const conn = new signalR.HubConnectionBuilder().withUrl('/templateHub').build();
conn.on('NewVisit', v => addOrUpdateRow(v));
conn.on('UpdateVisit', v => addOrUpdateRow(v));

conn.start().then(() => {
    console.debug('SignalR connected');
}).catch(e => {
    console.warn('SignalR connection failed', e);
});

function val(o,a,b){ return (o&& (o[a] ?? o[b])) ?? ''; }
function fmt(d){ if(!d) return ''; const dt=new Date(d); return isNaN(dt.getTime())? '': dt.toLocaleString(); }

function buildQueryParams() {
    const params = new URLSearchParams();
    const q = filterSearch.value.trim();
    if (q) params.set('q', q);
    if (filterStart.value) params.set('start', filterStart.value);
    if (filterEnd.value) params.set('end', filterEnd.value);
    if (filterPresent.checked) params.set('presentOnly', 'true');
    return params.toString();
}

applyFiltersBtn?.addEventListener('click', () => loadExistingVisits());
clearFiltersBtn?.addEventListener('click', () => {
    filterSearch.value=''; filterStart.value=''; filterEnd.value=''; filterPresent.checked=false;
    loadExistingVisits();
});
exportBtn?.addEventListener('click', () => { const qs=buildQueryParams(); window.location = '/api/visits/export' + (qs? '?' + qs : ''); });
exportBtn2?.addEventListener('click', () => { const qs=buildQueryParams(); window.location = '/api/visits/export' + (qs? '?' + qs : ''); });

// global error handler to catch JS errors that may stop handlers
window.addEventListener('error', (e) => {
    console.error('Global error:', e.message, 'at', e.filename + ':' + e.lineno + ':' + e.colno);
});

function rowClickHandler(id, v){
    console.debug('[UI] rowClickHandler selected id=', id);
    selectedId = id;
    document.querySelectorAll('#visits tbody tr').forEach(tr => tr.classList.remove('selected'));
    const tr = document.getElementById('v-' + id);
    if(tr) tr.classList.add('selected');

    detailEmpty.classList.add('d-none');
    detailPane.classList.remove('d-none');
    detailName.innerText = `${val(v,'FirstName','firstName')} ${val(v,'LastName','lastName')}`;
    detailEmail.innerText = val(v,'Email','email');
    detailQr.innerText = val(v,'QrKey','qrKey');
    detailIn.innerText = fmt(val(v,'CheckInTime','checkInTime'));
    detailOut.innerText = fmt(val(v,'CheckOutTime','checkOutTime'));

    if (val(v,'CheckOutTime','checkOutTime')) {
        detailCheckoutBtn.disabled = true;
        detailCheckoutBtn.innerText = 'Uscita registrata';
    } else {
        detailCheckoutBtn.disabled = false;
        detailCheckoutBtn.innerText = 'Segna uscita';
        detailCheckoutBtn.onclick = () => checkoutVisit(id, detailCheckoutBtn);
    }

    // bind edit / delete in detail pane (these elements exist in the page)
    const detailEditBtn = document.getElementById('detailEditBtn');
    const detailDeleteBtn = document.getElementById('detailDeleteBtn');
    if(detailEditBtn) detailEditBtn.onclick = () => openEditInDetail(id, v);
    if(detailDeleteBtn) detailDeleteBtn.onclick = () => deleteVisit(id, detailDeleteBtn);
}

function addOrUpdateRow(v) {
    if (!v) return;
    const id = val(v,'Id','id') || val(v,'id','Id');
    if(!id) return;
    let tr = document.getElementById('v-' + id);
    const isNew = !tr;
    if (isNew) {
        tr = document.createElement('tr');
        tr.id = 'v-' + id;
        tbody.prepend(tr);
    }
    const QrKey = val(v,'QrKey','qrKey');
    const Email = val(v,'Email','email');
    const FirstName = val(v,'FirstName','firstName');
    const LastName = val(v,'LastName','lastName');
    const CheckInTime = val(v,'CheckInTime','checkInTime');
    const CheckOutTime = val(v,'CheckOutTime','checkOutTime');

    tr.innerHTML = `
        <td style="min-width:220px">${id}</td>
        <td>${QrKey}</td>
        <td>${Email}</td>
        <td>${FirstName}</td>
        <td>${LastName}</td>
        <td>${fmt(CheckInTime)}</td>
        <td>${fmt(CheckOutTime)}</td>
        <td>
            ${ CheckOutTime ? 
                '<button class="btn btn-sm btn-outline-secondary" disabled>Uscito</button>' :
                `<button class="btn btn-sm btn-danger" onclick="checkoutVisit('${id}', this)">Segna uscita</button>`
            }
        </td>
    `;

    tr.onclick = () => rowClickHandler(id, v);

    updateStats();
}

async function checkoutVisit(id, btnEl) {
    try {
        btnEl.disabled = true;
        btnEl.innerText = '⏳';
        const res = await fetch(`/api/visits/${id}/checkout`, { method: 'POST', credentials: 'same-origin' });
        if (!res.ok) {
            console.warn('Checkout failed', res.status);
            btnEl.disabled = false;
            return;
        }
        const updated = await res.json();
        addOrUpdateRow(updated);
        if(selectedId === id) rowClickHandler(id, updated);
    } catch (e) {
        console.error(e);
    }
}

async function loadExistingVisits() {
    try {
        const qs = buildQueryParams();
        const url = '/api/visits' + (qs ? '?' + qs : '');
        console.debug('[Reception] loadExistingVisits ->', url);
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) {
            console.warn('Failed to load persisted visits', res.status);
            return;
        }
        const arr = await res.json();
        tbody.innerHTML = '';
        if (Array.isArray(arr)) {
            for (let i = 0; i < arr.length; i++) addOrUpdateRow(arr[i]);
        }
        updateStats();
    } catch (e) {
        console.error(e);
    }
}

function updateStats() {
    const rows = Array.from(document.querySelectorAll('#visits tbody tr'));
    totalRecordsEl.innerText = rows.length;
    const present = rows.reduce((acc, tr) => {
        const usc = tr.querySelectorAll('td')[6]?.innerText?.trim();
        return acc + (usc ? 0 : 1);
    }, 0);
    presentNowEl.innerText = present;
    visitCountEl.innerText = `Visitatori attualmente presenti: ${present}`;
    const firstRow = rows[0];
    if (firstRow) {
        const lastIn = firstRow.querySelectorAll('td')[5]?.innerText || '';
        lastCheckinEl.innerText = lastIn;
    } else {
        lastCheckinEl.innerText = '-';
    }
    document.getElementById('detailEmpty').classList.toggle('d-none', rows.length > 0 && selectedId);
}

// open inline edit in detail pane
function openEditInDetail(id, v){
    selectedId = id;
    detailEmpty.classList.add('d-none');
    detailPane.classList.remove('d-none');
    detailName.innerHTML = `<input id="edit-first" class="form-control form-control-sm" value="${escapeHtml(valueOf(v,'FirstName','firstName'))}" />`;
    detailEmail.innerHTML = `<input id="edit-email" class="form-control form-control-sm" value="${escapeHtml(valueOf(v,'Email','email'))}" />`;
    detailQr.innerHTML = `<input id="edit-qr" class="form-control form-control-sm" value="${escapeHtml(valueOf(v,'QrKey','qrKey'))}" />`;
    // hide checkout while editing
    detailCheckoutBtn.style.display = 'none';
    // add save / cancel
    const save = document.createElement('button'); save.className='btn btn-success btn-sm'; save.innerText='Salva';
    save.onclick = async () => await saveEdits(id);
    const cancel = document.createElement('button'); cancel.className='btn btn-outline-secondary btn-sm'; cancel.innerText='Annulla';
    cancel.onclick = () => { loadExistingVisits(); };
    const actions = detailCheckoutBtn.parentElement;
    actions.appendChild(save);
    actions.appendChild(cancel);
}

// send PUT to update
async function saveEdits(id){
    try{
        console.debug('[API] saveEdits id=', id);
        const payload = {
            FirstName: document.getElementById('edit-first')?.value || '',
            Email: document.getElementById('edit-email')?.value || '',
            QrKey: document.getElementById('edit-qr')?.value || ''
        };
        const url = '/api/visits/' + encodeURIComponent(id);
        console.debug('[API] PUT', url, payload);
        const res = await fetch(url, { method:'PUT', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        console.debug('[API] PUT response', res.status);
        if(!res.ok){ const body = await res.text().catch(()=>null); alert('Salvataggio fallito: ' + (body || res.status)); return; }
        const updated = await res.json();
        addOrUpdateRow(updated);
        rowClickHandler(id, updated);
    }catch(e){ console.error(e); alert('Errore salvataggio'); }
    finally{
        detailCheckoutBtn.style.display = '';
        const actions = detailCheckoutBtn.parentElement;
        Array.from(actions.querySelectorAll('button')).forEach(b => { if(b.innerText === 'Salva' || b.innerText === 'Annulla') b.remove(); });
    }
}

// send DELETE to remove
async function deleteVisit(id, btn){
    if(!confirm('Eliminare questa entry?')) return;
    try{
        console.debug('[API] deleteVisit id=', id);
        btn.disabled = true;
        const url = '/api/visits/' + encodeURIComponent(id);
        console.debug('[API] DELETE', url);
        const res = await fetch(url, { method:'DELETE', credentials:'same-origin' });
        console.debug('[API] DELETE response', res.status);
        if(!res.ok){ const body = await res.text().catch(()=>null); console.warn('[API] DELETE failed', res.status, body); alert('Eliminazione fallita: ' + (body || res.status)); btn.disabled=false; return; }
        const tr = document.getElementById('v-' + id); if(tr) tr.remove();
        if(selectedId === id){ selectedId = null; detailPane.classList.add('d-none'); detailEmpty.classList.remove('d-none'); }
        updateStats();
    }catch(e){ console.error(e); alert('Errore eliminazione'); if(btn) btn.disabled=false; }
}

function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function valueOf(o,a,b){ return (o && (o[a] ?? o[b])) ?? ''; }

loadExistingVisits();
