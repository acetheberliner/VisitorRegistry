(function () {
    function basePath() {
        try { return (typeof APP_BASE !== 'undefined' && APP_BASE) ? APP_BASE.replace(/\/?$/, '/') : '/'; }
        catch (e) { return '/'; }
    }

    function formatDateIsoToLocal(iso) {
        try { return new Date(iso).toLocaleString(); } catch { return iso || '-'; }
    }

    // Riquadro dettagli
    (function populateVisitInfo() {
        try {
            var receipt = document.getElementById('receiptCard');
            var infoBox = document.getElementById('visitInfoBox');
            if (!receipt || !infoBox) return;

            var visitId = receipt.dataset && receipt.dataset.visitId ? receipt.dataset.visitId : null;
            if (!visitId) return;

            // richiesta GET -> /api/visits?q={guid} (il servizio supporta ricerca per guid)
            fetch(basePath() + 'api/visits?q=' + encodeURIComponent(visitId), { credentials: 'same-origin' })
                .then(function (res) { if (!res.ok) return null; return res.json(); })
                .then(function (arr) {
                    if (!arr || !Array.isArray(arr) || arr.length === 0) { infoBox.classList.add('d-none'); return; }
                    // trova la visita corrispondente (primo elemento)
                    var v = arr[0];
                    // costruisci html con le info principali
                    var html = '';
                    html += '<div class="line"><strong>Nome:</strong> ' + (v.FirstName || v.firstName || '-') + '</div>';
                    html += '<div class="line"><strong>Cognome:</strong> ' + (v.LastName || v.lastName || '-') + '</div>';
                    html += '<div class="line"><strong>Email:</strong> ' + (v.Email || v.email || '-') + '</div>';
                    html += '<div class="line"><strong>Ingresso:</strong> ' + formatDateIsoToLocal(v.CheckInTime || v.checkInTime) + '</div>';
                    infoBox.innerHTML = html;
                    infoBox.classList.remove('d-none');
                })
                .catch(function (err) { console.warn('fetch visit info failed', err); infoBox.classList.add('d-none'); });
        } catch (e) { /* ignore */ }
    })();

    // Gestione download ricevuta
    (function attachDownload() {
        var btn = document.getElementById('downloadReceiptBtn');
        var card = document.getElementById('receiptCard');
        if (!btn || !card || typeof html2canvas === 'undefined') return;

        btn.addEventListener('click', function () {
            var origDisplay = btn.style.display;
            btn.style.display = 'none';

            // disabilita scroll pagina
            var origHtmlOverflow = document.documentElement.style.overflow;
            var origBodyOverflow = document.body.style.overflow;
            document.documentElement.style.overflow = 'hidden';
            document.body.style.overflow = 'hidden';

            var scale = Math.max(1, window.devicePixelRatio || 1);
            html2canvas(card, { scale: scale, useCORS: true, backgroundColor: '#ffffff' })
                .then(function (canvas) {
                    canvas.toBlob(function (blob) {
                        var visitId = card.dataset && card.dataset.visitId ? card.dataset.visitId : '';
                        var filename = 'ricevuta-' + (visitId ? visitId.substring(0,8) : 'visit') + '.png';
                        var a = document.createElement('a');
                        a.href = URL.createObjectURL(blob);
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                    }, 'image/png');
                })
                .catch(function (err) {
                    console.error('Errore generazione immagine ricevuta', err);
                    alert('Errore durante la generazione della ricevuta.');
                })
                .finally(function () {
                    // ripristina scroll e bottone
                    document.documentElement.style.overflow = origHtmlOverflow;
                    document.body.style.overflow = origBodyOverflow;
                    btn.style.display = origDisplay;
                });
        });
    })();
})();

// Download ricevuta come immagine
(function () {
    var btn = document.getElementById('downloadReceiptBtn');
    if (!btn) return;

    function filenameSafe(s) { return String(s || 'receipt').replace(/[^a-z0-9_\-]/gi, '_').toLowerCase(); }

    btn.addEventListener('click', function () {
        var card = document.getElementById('receiptCard');
        if (!card) { alert('Elemento ricevuta non trovato.'); return; }

        var orig = btn.style.display;
        btn.style.display = 'none';
        var scale = Math.max(1, window.devicePixelRatio || 1);

        html2canvas(card, { scale: scale, useCORS: true, backgroundColor: '#ffffff' })
            .then(function (canvas) {
                try {
                    var idText = document.getElementById('shortCode') ? document.getElementById('shortCode').innerText : '';
                    var fname = 'ricevuta-' + filenameSafe(idText) + '.png';
                    canvas.toBlob(function (blob) {
                        var a = document.createElement('a');
                        a.href = URL.createObjectURL(blob);
                        a.download = fname;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                    }, 'image/png');
                } finally { btn.style.display = orig; }
            })
            .catch(function (err) { btn.style.display = orig; console.error('Errore generazione immagine ricevuta', err); alert('Errore generazione ricevuta.'); });
    });
})();

// Salvataggio/rimozione openVisitId in localStorage per abilitare checkout automatico
(function () {
    try {
        var receipt = document.getElementById('receiptCard');
        if (!receipt) return;

        var visitId = receipt.dataset && receipt.dataset.visitId ? receipt.dataset.visitId : null;
        var checkedOut = receipt.dataset && receipt.dataset.checkedout ? (receipt.dataset.checkedout === 'true') : false;

        if (checkedOut) {
            try { localStorage.removeItem('openVisitId'); } catch (e) {}
            return;
        }

        if (visitId) {
            try { localStorage.setItem('openVisitId', visitId); } catch (e) {}
        }
    } catch (e) {
        console.warn('localStorage sync failed', e);
    }
})();
