(function(){
    document.querySelectorAll('.copy-link').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const url = btn.getAttribute('data-url');
            try {
                await navigator.clipboard.writeText(window.location.origin + url);
                btn.innerText = 'Copiato';
                setTimeout(() => btn.innerText = 'Copia link', 1400);
            } catch (err) {
                console.warn('Clipboard failed', err);
                alert('Copia non disponibile. URL: ' + (window.location.origin + url));
            }
        });
    });

    document.querySelectorAll('.debug-link').forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const dbg = link.getAttribute('data-url');
            if (!dbg) return;
            try {
                const res = await fetch(dbg, { credentials: 'same-origin' });
                const txt = await res.text();

                const m = txt.match(/https?:\/\/[^\s"'<>]+/i);
                if (m && m[0]) {
                    window.location.href = m[0];
                } else {
                    alert('URL di debug non trovato nella risposta.');
                }
            } catch (err) {
                console.error('Redirect debug failed', err);
                alert('Errore durante il redirect di debug.');
            }
        });
    });
})();