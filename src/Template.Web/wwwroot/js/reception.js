document.addEventListener('DOMContentLoaded', function () {
	// elementi DOM principali (safe)
	var tableEl = document.getElementById('visits');
	var tableBody = tableEl ? tableEl.getElementsByTagName('tbody')[0] : null;
	if (!tableBody) console.warn('reception.js: tableBody non trovato (id="visits")');

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

	// crea detailDuration se non esiste (compatibilità)
	if (!detailDurationEl) {
		try {
			var container = document.createElement('div');
			container.className = 'mb-1';
			container.innerHTML = '<small class="text-muted">Durata</small><div id="detailDuration">-</div>';
			var insertBeforeEl = document.getElementById('detailIn');
			if (insertBeforeEl && insertBeforeEl.parentElement) insertBeforeEl.parentElement.insertBefore(container, insertBeforeEl);
			else if (detailPane) detailPane.insertBefore(container, detailPane.firstChild);
			detailDurationEl = document.getElementById('detailDuration');
		} catch (e) { console.warn('Impossibile creare detailDuration element', e); }
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

	// helper per ottenere base URL (fallback a '')
	function basePath() {
		try { return (typeof APP_BASE !== 'undefined' && APP_BASE) ? APP_BASE.replace(/\/?$/, '/') : '/'; }
		catch (e) { return '/'; }
	}

	// bind bottoni (semplice)
	if (applyFiltersBtn) applyFiltersBtn.addEventListener('click', loadVisits);
	if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', function () {
		if (filterSearch) filterSearch.value = '';
		if (filterStart) filterStart.value = '';
		if (filterEnd) filterEnd.value = '';
		if (filterPresent) filterPresent.checked = false;
		loadVisits();
	});
	if (exportBtn) exportBtn.addEventListener('click', function () { window.location = basePath() + 'api/visits/export' + buildQuery(); });
	if (exportBtn2) exportBtn2.addEventListener('click', function () { window.location = basePath() + 'api/visits/export' + buildQuery(); });

	var selectedId = null;
	var currentDetailVisit = null;
	var durationTimer = null;

	// --- helper minimi ---
	function getField(o, a, b) { return (o && (o[a] !== undefined ? o[a] : o[b])) || ''; }
	function escapeHtml(s) { if (!s && s !== 0) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
	function formatDate(value) { if (!value) return ''; var d = (value instanceof Date) ? value : new Date(value); if (isNaN(d.getTime())) return ''; return d.toLocaleString(); }

	// parser (ISO o dd/mm/yyyy hh:mm[:ss])
	function parseDateFlexible(s) {
		if (!s) return null;
		if (s instanceof Date) return s;
		var str = String(s).trim();

		var isoNoZone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(str);
		if (isoNoZone) {
			var dUtc = new Date(str + 'Z'); // formato UTC
			if (!isNaN(dUtc.getTime())) return dUtc;
		}

		var d = new Date(str);
		if (!isNaN(d.getTime())) return d;

		// dd/mm/yyyy hh:mm(:ss) pattern
		function build(day, mon, yr, hh, mm, ss) {
			day = parseInt(day, 10); mon = parseInt(mon, 10) - 1; yr = parseInt(yr, 10);
			hh = parseInt(hh || '0', 10); mm = parseInt(mm || '0', 10); ss = parseInt(ss || '0', 10);
			var dt = new Date(yr, mon, day, hh, mm, ss);
			return isNaN(dt.getTime()) ? null : dt;
		}
		var m = str.match(/^\s*(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/);
		if (m) { var dt = build(m[1], m[2], m[3], m[4], m[5], m[6]); if (dt) return dt; }

		// rimuove virgole e spazi multipli
		var alt = str.replace(',', '').replace(/\s+/g, ' ');
		d = new Date(alt); if (!isNaN(d.getTime())) return d;

		if (/^\d{4}-\d{2}-\d{2}T/.test(str) && !/Z|[+\-]\d{2}:\d{2}$/.test(str)) {
			d = new Date(str + 'Z');
			if (!isNaN(d.getTime())) return d;
		}

		return null;
	}

	// calcola durata: checkout-checkin se presente, altrimenti now-checkin
	function computeDurationMs(v) {
		if (!v) return 0;
		var rawIn = getField(v, 'CheckInTime', 'checkInTime');
		var inDt = parseDateFlexible(rawIn);
		if (!inDt) return 0;
		var rawOut = getField(v, 'CheckOutTime', 'checkOutTime');
		if (rawOut !== undefined && rawOut !== null && String(rawOut).trim() !== '') {
			var outDt = parseDateFlexible(rawOut);
			if (!outDt) return 0;
			return outDt.getTime() - inDt.getTime();
		}
		return Date.now() - inDt.getTime();
	}

	// formato compatto durata
	function formatDuration(ms) {
		if (!ms || ms < 0) return '0s';
		var total = Math.floor(ms / 1000);
		var days = Math.floor(total / 86400); total %= 86400;
		var hours = Math.floor(total / 3600); total %= 3600;
		var mins = Math.floor(total / 60); var secs = total % 60;
		var parts = [];
		if (days) parts.push(days + 'g');
		if (hours) parts.push(hours + 'h');
		if (mins) parts.push(mins + 'm');
		parts.push(secs + 's');
		return parts.join(' ');
	}

	// aggiorna il DOM della durata (live)
	function updateDuration() {
		if (!currentDetailVisit) { if (detailDurationEl) detailDurationEl.innerText = '-'; return; }
		var ms = computeDurationMs(currentDetailVisit);
		if (detailDurationEl) detailDurationEl.innerText = formatDuration(ms);
	}

	// ferma timer durata
	function clearDurationTimer() {
		if (durationTimer) { clearInterval(durationTimer); durationTimer = null; }
		currentDetailVisit = null;
		if (detailDurationEl) detailDurationEl.innerText = '-';
	}

	// SignalR
	var connection = new signalR.HubConnectionBuilder().withUrl('/templateHub').build();
	connection.on('NewVisit', function (v) { renderRow(v); });
	connection.on('UpdateVisit', function (v) { renderRow(v); });
	connection.start().catch(function (e) { /* non fatale */ });

	// apre pannello dettaglio (usa i dati forniti)
	function openDetail(id, v) {
		clearDurationTimer();
		selectedId = id;
		var rows = document.querySelectorAll('#visits tbody tr'); for (var i = 0; i < rows.length; i++) rows[i].classList.remove('selected');
		var r = document.getElementById('v-' + id); if (r) r.classList.add('selected');
		if (detailEmpty) detailEmpty.classList.add('d-none'); if (detailPane) detailPane.classList.remove('d-none');

		if (detailName) detailName.innerText = getField(v, 'FirstName', 'firstName') + ' ' + getField(v, 'LastName', 'lastName');
		if (detailEmail) detailEmail.innerText = getField(v, 'Email', 'email');
		if (detailQr) detailQr.innerText = getField(v, 'QrKey', 'qrKey');
		if (detailIn) detailIn.innerText = formatDate(getField(v, 'CheckInTime', 'checkInTime'));
		if (detailOut) detailOut.innerText = formatDate(getField(v, 'CheckOutTime', 'checkOutTime'));

		// Aggiorna l'ID check-in nel pannello dettaglio usando ShortCode (preferito) o fallback da GUID
		try {
			var idCheckEl = document.getElementById('idcheck');
			var shortFromDto = getField(v, 'ShortCode', 'shortCode');
			var shortVal = shortFromDto || generateShortFromGuid(id);
			if (idCheckEl) idCheckEl.innerText = shortVal;
		} catch (e) { /* ignore */ }

		if (detailCheckoutBtn) {
			if (getField(v, 'CheckOutTime', 'checkOutTime')) detailCheckoutBtn.disabled = true, detailCheckoutBtn.innerText = 'Uscita registrata';
			else { detailCheckoutBtn.disabled = false; detailCheckoutBtn.innerText = 'Segna uscita'; detailCheckoutBtn.onclick = function () { checkoutVisit(id, detailCheckoutBtn); }; }
		}

		var editBtn = document.getElementById('detailEditBtn'); var deleteBtn = document.getElementById('detailDeleteBtn');
		if (editBtn) editBtn.onclick = function () { openEditInDetail(id, v); };
		if (deleteBtn) deleteBtn.onclick = function () { deleteVisit(id, deleteBtn); };

		if (v) { delete v.__ci; delete v.__co; }
		currentDetailVisit = v;
		updateDuration();
		if (!parseDateFlexible(getField(v, 'CheckOutTime', 'checkOutTime'))) durationTimer = setInterval(updateDuration, 1000);
	}

	// open edit from row (ricostruisce oggetto semplice)
	function openRowEdit(id) {
		var row = document.getElementById('v-' + id); if (!row) return;
		var cells = row.getElementsByTagName('td');
		var v = { Id: id, QrKey: cells[0] ? cells[0].innerText : '', Email: cells[1] ? cells[1].innerText : '', FirstName: cells[2] ? cells[2].innerText : '', LastName: cells[3] ? cells[3].innerText : '', CheckInTime: cells[4] ? cells[4].innerText : '', CheckOutTime: cells[5] ? cells[5].innerText : '' };
		openEditInDetail(id, v);
	}

	// checkout (POST)
	function checkoutVisit(id, btn) {
		try {
			if (btn) { btn.disabled = true; btn.innerText = '⏳'; }
			fetch(basePath() + 'api/visits/' + encodeURIComponent(id) + '/checkout', { method: 'POST', credentials: 'same-origin' })
				.then(function (res) { if (!res.ok) { if (btn) btn.disabled = false; return null; } return res.json(); })
				.then(function (updated) { if (updated) renderRow(updated); })
				.catch(function (err) { if (btn) btn.disabled = false; });
		} catch (e) { if (btn) btn.disabled = false; }
	}

	// open edit in detail pane
	function openEditInDetail(id, v) {
		clearDurationTimer();
		selectedId = id;
		if (detailEmpty) detailEmpty.classList.add('d-none'); if (detailPane) detailPane.classList.remove('d-none');
		if (detailName) detailName.innerHTML = '<input id="edit-first" class="form-control form-control-sm" value="' + escapeHtml(getField(v, 'FirstName', 'firstName')) + '" />';
		if (detailEmail) detailEmail.innerHTML = '<input id="edit-email" class="form-control form-control-sm" value="' + escapeHtml(getField(v, 'Email', 'email')) + '" />';
		if (detailQr) detailQr.innerHTML = '<input id="edit-qr" class="form-control form-control-sm" value="' + escapeHtml(getField(v, 'QrKey', 'qrKey')) + '" />';
		if (detailCheckoutBtn) detailCheckoutBtn.style.display = 'none';

		var actions = detailCheckoutBtn ? detailCheckoutBtn.parentElement : null;
		if (actions) {
			var save = document.createElement('button'); save.className = 'btn btn-success btn-sm'; save.innerText = 'Salva'; save.onclick = function () { saveEdits(id); };
			var cancel = document.createElement('button'); cancel.className = 'btn btn-outline-secondary btn-sm'; cancel.innerText = 'Annulla'; cancel.onclick = function () { loadVisits(); };
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
			fetch(basePath() + 'api/visits/' + encodeURIComponent(id), { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
				.then(function (res) { if (!res.ok) return res.text().then(function (t) { throw new Error(t || res.status); }); return res.json(); })
				.then(function (updated) { renderRow(updated); openDetail(id, updated); })
				.catch(function (err) { alert('Salvataggio fallito: ' + err.message); })
				.finally(function () {
					if (detailCheckoutBtn) detailCheckoutBtn.style.display = '';
					var actions = detailCheckoutBtn ? detailCheckoutBtn.parentElement : null;
					if (actions) {
						var btns = actions.getElementsByTagName('button');
						for (var i = btns.length - 1; i >= 0; i--) if (btns[i].innerText === 'Salva' || btns[i].innerText === 'Annulla') actions.removeChild(btns[i]);
					}
				});
		} catch (e) { alert('Errore salvataggio'); }
	}

	// delete (DELETE)
	function deleteVisit(id, btn) {
		if (!confirm('Eliminare questa entry?')) return;
		try {
			if (btn) btn.disabled = true;
			fetch(basePath() + 'api/visits/' + encodeURIComponent(id), { method: 'DELETE', credentials: 'same-origin' })
				.then(function (res) {
					if (!res.ok) return res.text().then(function (t) { throw new Error(t || res.status); });
					var row = document.getElementById('v-' + id); if (row && row.parentNode) row.parentNode.removeChild(row);
					if (selectedId === id) { selectedId = null; if (detailPane) detailPane.classList.add('d-none'); if (detailEmpty) detailEmpty.classList.remove('d-none'); }
					clearDurationTimer(); updateStats();
				})
				.catch(function (err) { alert('Eliminazione fallita: ' + err.message); if (btn) btn.disabled = false; });
		} catch (e) { if (btn) btn.disabled = false; }
	}

	// query builder compatto
	function buildQuery() {
		var p = []; var q = (filterSearch && filterSearch.value || '').trim(); if (q) p.push('q=' + encodeURIComponent(q));
		if (filterStart && filterStart.value) p.push('start=' + encodeURIComponent(filterStart.value));
		if (filterEnd && filterEnd.value) p.push('end=' + encodeURIComponent(filterEnd.value));
		if (filterPresent && filterPresent.checked) p.push('presentOnly=true');
		return p.length ? ('?' + p.join('&')) : '';
	}

	// genera ShortCode client-side da GUID (fallback)
	function generateShortFromGuid(g) {
		try {
			var alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
			var hex = String(g).replace(/[^0-9a-fA-F]/g, '');
			// se non è un guid, ritorna parte iniziale
			if (hex.length < 12) return (g + '').toString().substring(0, 5).toUpperCase();
			// prendi primi 6 byte
			var val = 0n;
			for (var i = 0; i < 12; i += 2) {
				val = (val << 8n) | BigInt(parseInt(hex.substr(i, 2), 16));
			}
			var sb = '';
			while (sb.length < 5) {
				var idx = Number(val % BigInt(alphabet.length));
				sb = alphabet[idx] + sb;
				val = val / BigInt(alphabet.length);
				if (val === 0n) val = BigInt(Date.now() & 0xFFFFFFFFFFFF);
			}
			return sb.substr(0, 5);
		} catch (e) { return (String(g)).substr(0, 5).toUpperCase(); }
	}

	// rendering della riga (modificata per mostrare ShortCode se presente)
	function renderRow(v) {
		if (!v) return;
		var id = getField(v, 'Id', 'id') || getField(v, 'id', 'Id');
		if (!id) return;
		var row = document.getElementById('v-' + id);
		if (!row) {
			row = document.createElement('tr');
			row.id = 'v-' + id;
			if (tableBody) tableBody.insertBefore(row, tableBody.firstChild);
		}
		var qr = escapeHtml(getField(v, 'QrKey', 'qrKey'));
		var email = escapeHtml(getField(v, 'Email', 'email'));
		var first = escapeHtml(getField(v, 'FirstName', 'firstName'));
		var last = escapeHtml(getField(v, 'LastName', 'lastName'));
		var cin = formatDate(getField(v, 'CheckInTime', 'checkInTime'));
		var cout = formatDate(getField(v, 'CheckOutTime', 'checkOutTime'));

		// short code: preferisci ShortCode, altrimenti fallback dal GUID
		var short = getField(v, 'ShortCode', 'shortCode') || generateShortFromGuid(id);

		// mostro il codice breve come piccolo badge sotto il QR; mantiene il QR nella stessa cella
		var qrHtml = '<div style="font-size:0.9rem;color:#6b7280">' + escapeHtml(qr) + '</div><div class="fw-bold">' + escapeHtml(short) + '</div>';

		var actionsHtml = '';
		if (cout) actionsHtml += '<button class="btn btn-sm btn-outline-secondary" disabled>Uscito</button>'; else actionsHtml += '<button class="btn btn-sm btn-success" onclick="openDetailFromRow(\'' + id + '\')">Presente</button>';

		row.innerHTML = ''
			+ '<td>' + qrHtml + '</td>'
			+ '<td>' + email + '</td>'
			+ '<td>' + first + '</td>'
			+ '<td>' + last + '</td>'
			+ '<td>' + cin + '</td>'
			+ '<td>' + cout + '</td>'
			+ '<td>' + actionsHtml + '</td>';

		// espone i valori utili come data attributes (usati da updateIdCheck)
		try { row.dataset.shortcode = short; row.dataset.qr = qr; } catch (e) { /* ignore */ }

		row.onclick = function () { openDetail(id, v); };

		updateStats();
	}

	// load list dal server
	function loadVisits() {
		clearDurationTimer();
		var qs = buildQuery(); var url = '/api/visits' + qs;
		// usa basePath() per compatibilità con PathBase
		fetch(basePath() + 'api/visits' + qs, { credentials: 'same-origin' })
			.then(function (res) { if (!res.ok) return res.text().then(function (txt) { console.warn('loadVisits failed', res.status, txt); return null; }); return res.json(); })
			.then(function (arr) { if (!arr) return; if (!tableBody) return; tableBody.innerHTML = ''; for (var i = 0; i < arr.length; i++) renderRow(arr[i]); updateStats(); })
			.catch(function (err) { console.error('loadVisits error', err); });
	}

	// update counters
	function updateStats() {
		if (!tableBody) return;
		var rows = tableBody.getElementsByTagName('tr'); totalRecordsEl.innerText = rows.length;
		var present = 0; for (var i = 0; i < rows.length; i++) { var usc = rows[i].getElementsByTagName('td')[5]; if (!usc || !usc.innerText.trim()) present++; }
		presentNowEl.innerText = present; visitCountEl.innerText = 'Visitatori attualmente presenti: ' + present;
		var first = tableBody.getElementsByTagName('tr')[0]; lastCheckinEl.innerText = first ? (first.getElementsByTagName('td')[4].innerText || '-') : '-';
	}
	
	// start
	loadVisits();

	// --- NEW: updateIdCheck moved here (was previously inline in Index.cshtml) ---
	function updateIdCheck() {
		try {
			var idEl = document.getElementById('idcheck');
			if (!idEl) return;

			// se il pannello dettaglio è nascosto esci
			var detailPaneLocal = document.getElementById('detailPane');
			if (!detailPaneLocal || detailPaneLocal.classList.contains('d-none')) {
				idEl.innerText = '-';
				return;
			}

			// prova a trovare la riga selezionata
			var sel = document.querySelector('#visits tbody tr.selected');
			var idText = '-';

			if (sel) {
				// usa data-shortcode (preso da renderRow) invece di innerText per evitare che venga mostrato anche il QR
				if (sel.dataset && sel.dataset.shortcode) idText = sel.dataset.shortcode;
				else {
					// fallback: genera dal GUID se non presente
					var rid = sel.id ? sel.id.replace(/^v-/, '') : '';
					idText = rid ? generateShortFromGuid(rid) : '-';
				}
			} else {
				// fallback: cerca nella UI di dettaglio se è presente un elemento con shortcode o id
				var detailId = document.querySelector('[data-visit-id]');
				if (detailId && detailId.dataset && detailId.dataset.visitId) {
					idText = detailId.dataset.visitId;
				}
			}

			idEl.innerText = idText;
		} catch (e) {
			console.error('updateIdCheck error', e);
		}
	}

	// reagisci ai click (la selezione delle righe probabilmente avviene su click)
	document.addEventListener('click', function () { setTimeout(updateIdCheck, 50); }, true);

	// osserva cambi nel tbody (es. righe ricaricate/ricostruite da JS)
	if (tableBody && window.MutationObserver) {
		var mo_local = new MutationObserver(function () { updateIdCheck(); });
		mo_local.observe(tableBody, { childList: true, subtree: true, attributes: true });
	}

	// fallback periodico (non invasivo) per assicurare aggiornamento quando necessario
	setInterval(updateIdCheck, 1500);

	// esegui subito una prima volta dopo il caricamento iniziale
	document.addEventListener('DOMContentLoaded', updateIdCheck);
	updateIdCheck();
});
