// elementi DOM principali
var tableBody = document.getElementById('visits').getElementsByTagName('tbody')[0];
var presentNowEl = document.getElementById('presentNow');
var lastCheckinEl = document.getElementById('lastCheckin');
var totalRecordsEl = document.getElementById('totalRecords');
var visitCountEl = document.getElementById('visitCount');

var detailPane = document.getElementById('detailPane');
var detailEmpty = document.getElementById('detailEmpty');
var detailName = document.getElementById('detailName');
var detailEmail = document.getElementById('detailEmail');
var detailQr = document.getElementById('detailQr');
var detailIn = document.getElementById('detailIn');
var detailOut = document.getElementById('detailOut');
var detailCheckoutBtn = document.getElementById('detailCheckoutBtn');

// filtri & bottoni
var filterSearch = document.getElementById('filterSearch');
var filterStart = document.getElementById('filterStart');
var filterEnd = document.getElementById('filterEnd');
var filterPresent = document.getElementById('filterPresent');
var applyFiltersBtn = document.getElementById('applyFilters');
var clearFiltersBtn = document.getElementById('clearFilters');
var exportBtn = document.getElementById('exportBtn');
var exportBtn2 = document.getElementById('exportBtn2');

var selectedId = null;

// helper base (semplici)
function getField(o, a, b) { return (o && (o[a] !== undefined ? o[a] : o[b])) || ''; }
function formatDate(value) {
    if (!value) return '';
    var d = new Date(value);
    return isNaN(d.getTime()) ? '' : d.toLocaleString();
}
function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// query string builder semplice
function buildQuery() {
    var p = [];
    var q = (filterSearch && filterSearch.value || '').trim();
    if (q) p.push('q=' + encodeURIComponent(q));
    if (filterStart && filterStart.value) p.push('start=' + encodeURIComponent(filterStart.value));
    if (filterEnd && filterEnd.value) p.push('end=' + encodeURIComponent(filterEnd.value));
    if (filterPresent && filterPresent.checked) p.push('presentOnly=true');
    return p.length ? ('?' + p.join('&')) : '';
}

// SignalR (rimane identico nel comportamento)
var connection = new signalR.HubConnectionBuilder().withUrl('/templateHub').build();
connection.on('NewVisit', function(v){ renderRow(v); });
connection.on('UpdateVisit', function(v){ renderRow(v); });
connection.start().then(function(){ console.debug('SignalR connected'); }).catch(function(e){ console.warn('SignalR failed', e); });

// attach eventi bottoni
if (applyFiltersBtn) applyFiltersBtn.addEventListener('click', loadVisits);
if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', function(){ if (filterSearch) filterSearch.value=''; if(filterStart) filterStart.value=''; if(filterEnd) filterEnd.value=''; if(filterPresent) filterPresent.checked=false; loadVisits(); });
if (exportBtn) exportBtn.addEventListener('click', function(){ window.location = '/api/visits/export' + buildQuery(); });
if (exportBtn2) exportBtn2.addEventListener('click', function(){ window.location = '/api/visits/export' + buildQuery(); });

// rendering della riga (semplice, sovrascrive innerHTML)
function renderRow(v) {
    if (!v) return;
    var id = getField(v,'Id','id') || getField(v,'id','Id');
    if (!id) return;
    var row = document.getElementById('v-' + id);
    var isNew = false;
    if (!row) {
        row = document.createElement('tr');
        row.id = 'v-' + id;
        tableBody.insertBefore(row, tableBody.firstChild);
        isNew = true;
    }
    var qr = escapeHtml(getField(v,'QrKey','qrKey'));
    var email = escapeHtml(getField(v,'Email','email'));
    var first = escapeHtml(getField(v,'FirstName','firstName'));
    var last = escapeHtml(getField(v,'LastName','lastName'));
    var cin = formatDate(getField(v,'CheckInTime','checkInTime'));
    var cout = formatDate(getField(v,'CheckOutTime','checkOutTime'));

    var actionsHtml = '';
    if (cout) {
        actionsHtml += '<button class="btn btn-sm btn-outline-secondary" disabled>Uscito</button>';
    } else {
        actionsHtml += '<button class="btn btn-sm btn-danger" onclick="checkoutVisit(\'' + id + '\', this)">Segna uscita</button>';
    }

    row.innerHTML = ''
        + '<td style="min-width:220px">' + id + '</td>'
        + '<td>' + qr + '</td>'
        + '<td>' + email + '</td>'
        + '<td>' + first + '</td>'
        + '<td>' + last + '</td>'
        + '<td>' + cin + '</td>'
        + '<td>' + cout + '</td>'
        + '<td>' + actionsHtml + '</td>';

    // bind click per dettaglio (usa i dati ricevuti)
    row.onclick = function(){ openDetail(id, v); };

    updateStats();
}

// apre pannello dettaglio dai dati (non fa fetch)
function openDetail(id, v) {
    selectedId = id;
    var rows = document.querySelectorAll('#visits tbody tr');
    for (var i=0;i<rows.length;i++) rows[i].classList.remove('selected');
    var r = document.getElementById('v-' + id);
    if (r) r.classList.add('selected');

    if (detailEmpty) detailEmpty.classList.add('d-none');
    if (detailPane) detailPane.classList.remove('d-none');

    if (detailName) detailName.innerText = getField(v,'FirstName','firstName') + ' ' + getField(v,'LastName','lastName');
    if (detailEmail) detailEmail.innerText = getField(v,'Email','email');
    if (detailQr) detailQr.innerText = getField(v,'QrKey','qrKey');
    if (detailIn) detailIn.innerText = formatDate(getField(v,'CheckInTime','checkInTime'));
    if (detailOut) detailOut.innerText = formatDate(getField(v,'CheckOutTime','checkOutTime'));

    if (detailCheckoutBtn) {
        if (getField(v,'CheckOutTime','checkOutTime')) {
            detailCheckoutBtn.disabled = true; detailCheckoutBtn.innerText = 'Uscita registrata';
        } else {
            detailCheckoutBtn.disabled = false; detailCheckoutBtn.innerText = 'Segna uscita';
            detailCheckoutBtn.onclick = function(){ checkoutVisit(id, detailCheckoutBtn); };
        }
    }
    // bind edit/delete in pane
    var editBtn = document.getElementById('detailEditBtn');
    var deleteBtn = document.getElementById('detailDeleteBtn');
    if (editBtn) editBtn.onclick = function(){ openEditInDetail(id, v); };
    if (deleteBtn) deleteBtn.onclick = function(){ deleteVisit(id, deleteBtn); };
}

// called by row buttons
function openRowEdit(id) {
    var row = document.getElementById('v-' + id);
    if (!row) return;
    var cells = row.getElementsByTagName('td');
    var v = {
        Id: id,
        QrKey: cells[1] ? cells[1].innerText : '',
        Email: cells[2] ? cells[2].innerText : '',
        FirstName: cells[3] ? cells[3].innerText : '',
        LastName: cells[4] ? cells[4].innerText : '',
        CheckInTime: cells[5] ? cells[5].innerText : '',
        CheckOutTime: cells[6] ? cells[6].innerText : ''
    };
    openEditInDetail(id, v);
}

// checkout (POST)
function checkoutVisit(id, btn) {
    try {
        if (btn) { btn.disabled = true; btn.innerText = '⏳'; }
        fetch('/api/visits/' + encodeURIComponent(id) + '/checkout', { method: 'POST', credentials: 'same-origin' })
            .then(function(res){
                if (!res.ok) {
                    console.warn('checkout failed', res.status);
                    if (btn) { btn.disabled = false; }
                    return null;
                }
                return res.json();
            })
            .then(function(updated){
                if (updated) renderRow(updated);
            })
            .catch(function(err){ console.error(err); if (btn) btn.disabled=false; });
    } catch(e) { console.error(e); if (btn) btn.disabled=false; }
}

// edit in detail pane
function openEditInDetail(id, v){
    selectedId = id;
    if (detailEmpty) detailEmpty.classList.add('d-none');
    if (detailPane) detailPane.classList.remove('d-none');
    if (detailName) detailName.innerHTML = '<input id="edit-first" class="form-control form-control-sm" value="' + escapeHtml(getField(v,'FirstName','firstName')) + '" />';
    if (detailEmail) detailEmail.innerHTML = '<input id="edit-email" class="form-control form-control-sm" value="' + escapeHtml(getField(v,'Email','email')) + '" />';
    if (detailQr) detailQr.innerHTML = '<input id="edit-qr" class="form-control form-control-sm" value="' + escapeHtml(getField(v,'QrKey','qrKey')) + '" />';
    if (detailCheckoutBtn) detailCheckoutBtn.style.display = 'none';

    var actions = detailCheckoutBtn ? detailCheckoutBtn.parentElement : null;
    if (actions) {
        var save = document.createElement('button'); save.className='btn btn-success btn-sm'; save.innerText='Salva';
        save.onclick = function(){ saveEdits(id); };
        var cancel = document.createElement('button'); cancel.className='btn btn-outline-secondary btn-sm'; cancel.innerText='Annulla';
        cancel.onclick = function(){ loadVisits(); };
        actions.appendChild(save); actions.appendChild(cancel);
    }
}

// save edits (PUT)
function saveEdits(id) {
    try {
        var first = document.getElementById('edit-first') ? document.getElementById('edit-first').value : '';
        var email = document.getElementById('edit-email') ? document.getElementById('edit-email').value : '';
        var qr = document.getElementById('edit-qr') ? document.getElementById('edit-qr').value : '';
        var payload = { FirstName: first, Email: email, QrKey: qr };

        fetch('/api/visits/' + encodeURIComponent(id), {
            method: 'PUT',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(function(res){
            if (!res.ok) return res.text().then(function(t){ throw new Error(t || res.status); });
            return res.json();
        })
        .then(function(updated){
            renderRow(updated);
            openDetail(id, updated);
        })
        .catch(function(err){ alert('Salvataggio fallito: ' + err.message); })
        .finally(function(){
            if (detailCheckoutBtn) detailCheckoutBtn.style.display = '';
            var actions = detailCheckoutBtn ? detailCheckoutBtn.parentElement : null;
            if (actions) {
                var btns = actions.getElementsByTagName('button');
                for (var i = btns.length-1; i >=0; i--) {
                    if (btns[i].innerText === 'Salva' || btns[i].innerText === 'Annulla') actions.removeChild(btns[i]);
                }
            }
        });
    } catch(e) { console.error(e); alert('Errore salvataggio'); }
}

// delete (DELETE)
function deleteVisit(id, btn) {
    if (!confirm('Eliminare questa entry?')) return;
    try {
        if (btn) btn.disabled = true;
        fetch('/api/visits/' + encodeURIComponent(id), { method: 'DELETE', credentials: 'same-origin' })
            .then(function(res){
                if (!res.ok) return res.text().then(function(t){ throw new Error(t || res.status); });
                var row = document.getElementById('v-' + id);
                if (row && row.parentNode) row.parentNode.removeChild(row);
                if (selectedId === id) { selectedId = null; if (detailPane) detailPane.classList.add('d-none'); if (detailEmpty) detailEmpty.classList.remove('d-none'); }
                updateStats();
            })
            .catch(function(err){ alert('Eliminazione fallita: ' + err.message); if (btn) btn.disabled = false; });
    } catch(e) { console.error(e); if (btn) btn.disabled = false; }
}

// load list from server
function loadVisits() {
    try {
        var qs = buildQuery();
        var url = '/api/visits' + qs;
        fetch(url, { credentials: 'same-origin' })
            .then(function(res){
                if (!res.ok) { console.warn('Failed to load visits', res.status); return null; }
                return res.json();
            })
            .then(function(arr){
                if (!arr) return;
                tableBody.innerHTML = '';
                for (var i=0;i<arr.length;i++) renderRow(arr[i]);
                updateStats();
            })
            .catch(function(err){ console.error(err); });
    } catch(e) { console.error(e); }
}

// update counters
function updateStats() {
    var rows = tableBody.getElementsByTagName('tr');
    totalRecordsEl.innerText = rows.length;
    var present = 0;
    for (var i=0;i<rows.length;i++) {
        var usc = rows[i].getElementsByTagName('td')[6];
        if (!usc || !usc.innerText.trim()) present++;
    }
    presentNowEl.innerText = present;
    visitCountEl.innerText = 'Visitatori attualmente presenti: ' + present;
    var first = tableBody.getElementsByTagName('tr')[0];
    lastCheckinEl.innerText = first ? (first.getElementsByTagName('td')[5].innerText || '-') : '-';
}

// helpers
function valueOf(o,a,b){ return getField(o,a,b); }

loadVisits();
