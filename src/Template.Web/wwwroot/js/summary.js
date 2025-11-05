// Download ricevuta come immagine (usa html2canvas caricato via CDN)
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

// Salvataggio/rimozione openVisitId in localStorage per auto-checkout client
(function () {
    try {
        // Riprendiamo l'ID dal visitor
        var id = document.getElementById('shortCode') ? document.getElementById('shortCode').innerText : null;
        
        // se shortCode (id) presente e la pagina è summary, allora è checkin o checkout
        if (!id) { try { localStorage.removeItem('openVisitId'); } catch (e) {} return; }

        // Salva l'ID del check‑in per permettere il checkout automatico su successiva scansione
        try { localStorage.setItem('openVisitId', id); } catch (e) {}
    } catch (e) { /* localStorage non disponibile */ }
})();
