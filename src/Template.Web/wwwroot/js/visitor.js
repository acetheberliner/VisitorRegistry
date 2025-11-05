// Client-side for visitor check-in: post to API and handle 409 (already checked-in)

(function () {
    // helper basePath (usa APP_BASE se definito)
    function basePath() {
        try { return (typeof APP_BASE !== 'undefined' && APP_BASE) ? APP_BASE.replace(/\/?$/, '/') : '/'; }
        catch (e) { return '/'; }
    }

    // helper per leggere valore input by name
    function val(form, name) {
        var el = form.querySelector('[name="' + name + '"]');
        return el ? el.value.trim() : '';
    }

    // mostra messaggio inline sopra il form
    function showInlineMessage(container, html, level) {
        level = level || 'info';
        var el = container.querySelector('.visitor-message');
        if (!el) {
            el = document.createElement('div');
            el.className = 'visitor-message mb-3';
            container.insertBefore(el, container.firstChild);
        }
        el.innerHTML = html;
        el.style.color = (level === 'error') ? '#b91c1c' : '#0b69a3';
    }

    document.addEventListener('DOMContentLoaded', function () {
        // Auto-checkout robusto: supporta GUID o shortCode (fallback)
        (function () {
            try {
                var urlParams = new URLSearchParams(window.location.search || '');
                if (urlParams.get('force') === 'true') return;

                var raw = null;
                try { raw = localStorage.getItem('openVisitId'); } catch (e) { raw = null; }
                if (!raw) { console.debug('auto-checkout: nessun openVisitId in localStorage'); return; }

                console.debug('auto-checkout: trovato openVisitId=', raw);

                function isShortCode(s) { return /^[0-9A-Z]{1,5}$/i.test(s); }

                function doCheckoutByGuid(guid) {
                    console.debug('auto-checkout: tentativo checkout GUID', guid);
                    fetch(basePath() + 'api/visits/' + encodeURIComponent(guid) + '/checkout', {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: { 'Accept': 'application/json' }
                    })
                    .then(function (res) {
                        if (!res.ok) {
                            console.warn('auto-checkout: checkout response not ok', res.status);
                            if (res.status === 404) { try { localStorage.removeItem('openVisitId'); } catch (e) {} }
                            return null;
                        }
                        return res.json();
                    })
                    .then(function (dto) {
                        if (!dto) return;
                        try { localStorage.removeItem('openVisitId'); } catch (e) {}
                        window.location.href = basePath() + 'Visitor/Summary?id=' + encodeURIComponent(dto.Id) + '&checkedOut=true';
                    })
                    .catch(function (err) {
                        console.warn('auto-checkout error', err);
                    });
                }

                if (isShortCode(raw)) {
                    // risolvi lo ShortCode a GUID tramite la ricerca
                    console.debug('auto-checkout: raw sembra shortCode, risolvo via API', raw);
                    fetch(basePath() + 'api/visits?q=' + encodeURIComponent(raw), { credentials: 'same-origin' })
                        .then(function (res) {
                            if (!res.ok) { console.warn('auto-checkout: resolve failed', res.status); try { localStorage.removeItem('openVisitId'); } catch (e) {} return null; }
                            return res.json();
                        })
                        .then(function (arr) {
                            if (!arr || !Array.isArray(arr) || arr.length === 0) { try { localStorage.removeItem('openVisitId'); } catch (e) {} return; }
                            var code = raw.toUpperCase();
                            var found = arr.find(function (v) {
                                var sc = (v.ShortCode || v.shortCode || '').toUpperCase();
                                return sc.indexOf(code) !== -1;
                            });
                            if (found && (found.Id || found.id)) doCheckoutByGuid(found.Id || found.id);
                            else try { localStorage.removeItem('openVisitId'); } catch (e) {}
                        })
                        .catch(function (err) { console.warn('auto-checkout resolve error', err); });
                } else {
                    // presunto GUID
                    doCheckoutByGuid(raw);
                }
            } catch (e) { console.warn('auto-checkout init failed', e); }
        })();

        var form = document.getElementById('visitorForm');
        if (!form) return;

        var cardBody = form.closest('.card-body') || form.parentElement;

        form.addEventListener('submit', function (ev) {
            ev.preventDefault();

            // semplice validazione client
            var first = val(form, 'FirstName');
            var last = val(form, 'LastName');
            var email = val(form, 'Email');
            var qr = val(form, 'QrKey');

            if (!first || !last) {
                showInlineMessage(cardBody, 'Compila nome e cognome.', 'error');
                return;
            }

            var payload = { QrKey: qr || null, Email: email || null, FirstName: first, LastName: last };

            // disabilita pulsante submit durante richiesta
            var submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) { submitBtn.disabled = true; submitBtn.dataset.orig = submitBtn.innerText; submitBtn.innerText = '⏳'; }

            fetch(basePath() + 'api/visits', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
                .then(async function (res) {
                    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = submitBtn.dataset.orig || 'Conferma ingresso'; }

                    if (res.status === 201 || res.status === 200) {
                        // creazione OK: server ritorna DTO con Id
                        var dto = await res.json();
                        // redirect a pagina summary server-side (se il controller la supporta)
                        var id = dto && (dto.Id || dto.id);
                        if (id) {
                            window.location.href = basePath() + 'Visitor/Summary?id=' + encodeURIComponent(id);
                            return;
                        } else {
                            // fallback: mostra messaggio di conferma con codice corto
                            var sc = dto && (dto.ShortCode || dto.shortCode);
                            showInlineMessage(cardBody, 'Check-in registrato. Codice: <strong>' + (sc || '-') + '</strong>');
                            return;
                        }
                    } else if (res.status === 409) {
                        // già registrato: server fornisce { message, visit }
                        var payload409 = await res.json().catch(function () { return null; });
                        var visit = null;
                        if (payload409) {
                            // payload potrebbe essere { message: "...", visit: {...} } o direttamente { visit: ... }
                            visit = payload409.visit || payload409;
                        }
                        var existingId = visit && (visit.Id || visit.id);
                        var shortCode = visit && (visit.ShortCode || visit.shortCode);

                        // preferiamo redirect alla pagina summary della visita esistente (se disponibile)
                        if (existingId) {
                            window.location.href = basePath() + 'Visitor/Summary?id=' + encodeURIComponent(existingId);
                            return;
                        }

                        // altrimenti mostriamo messaggio inline con shortCode (se presente)
                        var msg = (payload409 && payload409.message) ? payload409.message : 'Sei già registrato.';
                        if (shortCode) msg += '<br/>Codice visita: <strong>' + shortCode + '</strong>';
                        showInlineMessage(cardBody, msg, 'info');
                        return;
                    } else {
                        // altri errori -> mostra testo
                        var txt = await res.text().catch(function () { return ''; });
                        showInlineMessage(cardBody, 'Errore server: ' + (res.status || '') + ' ' + txt, 'error');
                    }
                })
                .catch(function (err) {
                    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = submitBtn.dataset.orig || 'Conferma ingresso'; }
                    console.error(err);
                    showInlineMessage(cardBody, 'Errore di rete durante invio dati. Riprovare.', 'error');
                });
        });
    });
})();