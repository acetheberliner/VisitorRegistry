document.addEventListener('DOMContentLoaded', function () {
    // elementi DOM principali (safe)
    var tableEl = document.getElementById('visits');
    var tableBody = tableEl ? tableEl.getElementsByTagName('tbody')[0] : null;
    if (!tableBody) console.warn('reception.js: tableBody non trovato (id="visits") - il rendering delle righe sarà disabilitato');

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
    var detailDurationEl = document.getElementById('detailDuration');

    // se manca l'elemento detailDuration lo creiamo e lo inseriamo prima di detailIn (robusto)
    if (!detailDurationEl) {
        try {
            var container = document.createElement('div');
            container.className = 'mb-1';
            container.innerHTML = '<small class="text-muted">Durata</small><div id="detailDuration">-</div>';
            var insertBeforeEl = document.getElementById('detailIn');
            if (insertBeforeEl && insertBeforeEl.parentElement) {
                insertBeforeEl.parentElement.insertBefore(container, insertBeforeEl);
            } else if (detailPane) {
                detailPane.insertBefore(container, detailPane.firstChild);
            }
            detailDurationEl = document.getElementById('detailDuration');
        } catch (e) {
            console.warn('Impossibile creare detailDuration element', e);
        }
    }

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
    var currentDetailVisit = null;
    var durationTimer = null;

    // helper base (semplici)
    function getField(o, a, b) { return (o && (o[a] !== undefined ? o[a] : o[b])) || ''; }

    // NEW: semplice escapeHtml (previene ReferenceError)
    function escapeHtml(s) {
        if (!s && s !== 0) return '';
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }

    // NEW: semplice formatDate (compatto, usa toLocaleString)
    function formatDate(value) {
        if (!value) return '';
        var d = (value instanceof Date) ? value : new Date(value);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleString();
    }

    // NEW: robust date parser: accetta Date, ISO, "gg/mm/aaaa hh:mm:ss" o "gg/mm/aaaa, hh:mm:ss"
    function parseDateFlexible(s) {
        if (!s) return null;
        if (s instanceof Date) return s;
        var str = String(s).trim();
        // try native parse first (ISO, RFC)
        var d = new Date(str);
        if (!isNaN(d.getTime())) return d;

        // helper to try regex-based construction
        function tryBuild(day, mon, yr, hh, mm, ss) {
            day = parseInt(day,10); mon = parseInt(mon,10)-1; yr = parseInt(yr,10);
            hh = parseInt(hh||'0',10); mm = parseInt(mm||'0',10); ss = parseInt(ss||'0',10);
            var dt = new Date(yr, mon, day, hh, mm, ss);
            return isNaN(dt.getTime()) ? null : dt;
        }

        // try "dd/mm/yyyy[ ,] hh:mm[:ss]"
        var m = str.match(/^\s*(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/);
        if (m) {
            var dt = tryBuild(m[1], m[2], m[3], m[4], m[5], m[6]);
            if (dt) return dt;
        }

        // try "mm/dd/yyyy" US style
        var m2 = str.match(/^\s*(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/);
        if (m2) {
            // assume first is month, second is day
            var dt2 = tryBuild(m2[2], m2[1], m2[3], m2[4], m2[5], m2[6]);
            if (dt2) return dt2;
        }

        // try without separators: "dd mm yyyy hh:mm:ss" etc
        var m3 = str.match(/^\s*(\d{1,2})\s+(\d{1,2})\s+(\d{4})[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/);
        if (m3) {
            var dt3 = tryBuild(m3[1], m3[2], m3[3], m3[4], m3[5], m3[6]);
            if (dt3) return dt3;
        }

        // try replacing comma and multiple spaces, then ISO-ish
        var alt = str.replace(',', '').replace(/\s+/g,' ');
        d = new Date(alt);
        if (!isNaN(d.getTime())) return d;

        // try append 'Z' (UTC) if looks like ISO without timezone
        if (/^\d{4}-\d{2}-\d{2}T/.test(str) && !/Z|[+\-]\d{2}:\d{2}$/.test(str)) {
            d = new Date(str + 'Z');
            if (!isNaN(d.getTime())) return d;
        }

        return null;
    }

    // nuova: calcola millisecondi di durata per un visit (checkOut-checkIn se presente, altrimenti now-checkIn)
    // usa caching su v.__ci e v.__co per evitare parsing ripetuti e problemi con date formattate localmente
    function computeDurationMs(v) {
        // Very simple: parse check-in; if missing return 0.
        // If checkout exists and parses, return checkout - checkin.
        // Otherwise return now - checkin.
        if (!v) return 0;
        var rawIn = getField(v, 'CheckInTime', 'checkInTime');
        var inDt = parseDateFlexible(rawIn);
        if (!inDt) return 0;

        var rawOut = getField(v, 'CheckOutTime', 'checkOutTime');
        if (rawOut !== undefined && rawOut !== null && String(rawOut).trim() !== '') {
            var outDt = parseDateFlexible(rawOut);
            if (!outDt) {
                // cannot parse checkout: treat as duration unavailable -> return 0
                return 0;
            }
            return outDt.getTime() - inDt.getTime();
        }

        return Date.now() - inDt.getTime();
    }

    // nuova: formatta ms in "Hh Mm Ss" compatto
    function formatDuration(ms) {
        if (!ms || ms < 0) return '0s';
        var total = Math.floor(ms / 1000);
        var days = Math.floor(total / 86400); total = total % 86400;
        var hours = Math.floor(total / 3600); total = total % 3600;
        var mins = Math.floor(total / 60);
        var secs = total % 60;
        var parts = [];
        if (days) parts.push(days + 'g');
        if (hours) parts.push(hours + 'h');
        if (mins) parts.push(mins + 'm');
        parts.push(secs + 's');
        return parts.join(' ');
    }

    // nuova: aggiorna il DOM della durata (chiamata ogni secondo se visitatore ancora presente)
    function updateDuration() {
        if (!currentDetailVisit) {
            if (detailDurationEl) detailDurationEl.innerText = '-';
            return;
        }
        var ms = computeDurationMs(currentDetailVisit);
        if (detailDurationEl) detailDurationEl.innerText = formatDuration(ms);
    }

    // nuova: ferma timer (ripristinata)
    function clearDurationTimer() {
        try {
            if (durationTimer) {
                clearInterval(durationTimer);
                durationTimer = null;
            }
        } catch (e) { console.warn('clearDurationTimer error', e); }
        currentDetailVisit = null;
        if (detailDurationEl) detailDurationEl.innerText = '-';
    }

    // quando si riapre il dettaglio da server o riga, puliamo eventuali cache obsolete
    function openDetail(id, v) {
        // stoppa il timer mentre si modifica
        clearDurationTimer();
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

        // pulizia cache e impostazione nuovo visit (assicurarsi di usare l'oggetto corrente)
        if (v) { delete v.__ci; delete v.__co; }
        currentDetailVisit = v;
        // aggiorna durata immediatamente
        updateDuration();
        // se non ha checkOut (ancora dentro) avvia timer; altrimenti rimane statico
        if (!parseDateFlexible(getField(v,'CheckOutTime','checkOutTime'))) {
            durationTimer = setInterval(updateDuration, 1000);
        }
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
        // stoppa il timer mentre si modifica
        clearDurationTimer();
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
                    clearDurationTimer();
                    updateStats();
                })
                .catch(function(err){ alert('Eliminazione fallita: ' + err.message); if (btn) btn.disabled = false; });
        } catch(e) { console.error(e); if (btn) btn.disabled = false; }
    }

    // query string builder semplice (RIAGGIUNTO - prima mancava => ReferenceError)
    function buildQuery() {
        var p = [];
        var q = (filterSearch && filterSearch.value || '').trim();
        if (q) p.push('q=' + encodeURIComponent(q));
        if (filterStart && filterStart.value) p.push('start=' + encodeURIComponent(filterStart.value));
        if (filterEnd && filterEnd.value) p.push('end=' + encodeURIComponent(filterEnd.value));
        if (filterPresent && filterPresent.checked) p.push('presentOnly=true');
        return p.length ? ('?' + p.join('&')) : '';
    }

    // rendering della riga (aggiungo log diagnostico)
    function renderRow(v) {
        if (!v) return;
        console.debug('renderRow', v && (v.Id || v.id));
        var id = getField(v,'Id','id') || getField(v,'id','Id');
        if (!id) return;
        var row = document.getElementById('v-' + id);
        var isNew = false;
        if (!row) {
            row = document.createElement('tr');
            row.id = 'v-' + id;
            if (tableBody) tableBody.insertBefore(row, tableBody.firstChild);
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
            // call openDetailFromRow to reconstruct visit object from the row
            actionsHtml += '<button class="btn btn-sm btn-success" onclick="openDetailFromRow(\'' + id + '\')">Presente</button>';
        }

        row.innerHTML = ''
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

    // load list from server (aggiungo log e dump risposta se non OK)
    function loadVisits() {
        try {
            console.debug('loadVisits: start');
            // stoppa timer durante il reload
            clearDurationTimer();
            var qs = buildQuery();
            var url = '/api/visits' + qs;
            console.debug('loadVisits: fetching', url);
            fetch(url, { credentials: 'same-origin' })
                .then(function(res){
                    console.debug('loadVisits: response status', res.status);
                    if (!res.ok) {
                        // tenta leggere il body per capire l'errore
                        return res.text().then(function(txt){
                            console.warn('loadVisits: non-ok response', res.status, txt);
                            return null;
                        });
                    }
                    return res.json();
                })
                .then(function(arr){
                    console.debug('loadVisits: parsed array length', arr && arr.length);
                    if (!arr) return;
                    if (!tableBody) return console.warn('loadVisits: tableBody missing, skipping render');
                    tableBody.innerHTML = '';
                    for (var i=0;i<arr.length;i++) renderRow(arr[i]);
                    updateStats();
                })
                .catch(function(err){ console.error('loadVisits: fetch error', err); });
        } catch(e) { console.error('loadVisits error', e); }
    }

    // update counters
    function updateStats() {
        var rows = tableBody.getElementsByTagName('tr');
        totalRecordsEl.innerText = rows.length;
        var present = 0;
        for (var i=0;i<rows.length;i++) {
            // checkout is in td[5] (0:QR,1:Email,2:First,3:Last,4:CheckIn,5:CheckOut,6:Actions)
            var usc = rows[i].getElementsByTagName('td')[5];
            if (!usc || !usc.innerText.trim()) present++;
        }
        presentNowEl.innerText = present;
        visitCountEl.innerText = 'Visitatori attualmente presenti: ' + present;
        var first = tableBody.getElementsByTagName('tr')[0];
        // last checkin is in td[4]
        lastCheckinEl.innerText = first ? (first.getElementsByTagName('td')[4].innerText || '-') : '-';
    }

    // NEW: reconstruct visit object from the row and open detail
    function openDetailFromRow(id) {
        var row = document.getElementById('v-' + id);
        if (!row) return;
        var cells = row.getElementsByTagName('td');
        var v = {
            Id: id,
            QrKey: cells[0] ? cells[0].innerText : '',
            Email: cells[1] ? cells[1].innerText : '',
            FirstName: cells[2] ? cells[2].innerText : '',
            LastName: cells[3] ? cells[3].innerText : '',
            CheckInTime: cells[4] ? cells[4].innerText : '',
            CheckOutTime: cells[5] ? cells[5].innerText : ''
        };
        openDetail(id, v);
    }

    // helpers
    function valueOf(o,a,b){ return getField(o,a,b); }

    // global error catcher per debug
    window.addEventListener('error', function (e) {
        console.error('Global error captured:', e.message, 'at', e.filename + ':' + e.lineno + ':' + e.colno);
    });

    loadVisits();
});
