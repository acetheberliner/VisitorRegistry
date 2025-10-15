// client-side form validation to enforce Nome/Cognome before submit
(function () {
    const form = document.getElementById('visitorForm');
    if (!form) return;

    const first = form.querySelector('[name="FirstName"], [asp-for="FirstName"]') || form.querySelector('input[asp-for="FirstName"]');
    const last = form.querySelector('[name="LastName"], [asp-for="LastName"]') || form.querySelector('input[asp-for="LastName"]');

    function setInvalid(el, msgElId, show) {
        if (!el) return;
        const msg = document.getElementById(msgElId);
        if (show) {
            el.classList.add('is-invalid');
            if (msg) msg.style.display = 'block';
        } else {
            el.classList.remove('is-invalid');
            if (msg) msg.style.display = 'none';
        }
    }

    form.addEventListener('submit', function (e) {
        let invalid = false;
        const firstVal = first && first.value ? first.value.trim() : '';
        const lastVal = last && last.value ? last.value.trim() : '';

        if (!firstVal) {
            setInvalid(first, 'err-firstName', true);
            invalid = true;
        } else {
            setInvalid(first, 'err-firstName', false);
        }

        if (!lastVal) {
            setInvalid(last, 'err-lastName', true);
            invalid = true;
        } else {
            setInvalid(last, 'err-lastName', false);
        }

        if (invalid) {
            e.preventDefault();
            // focus first invalid field
            ((first && !firstVal) ? first : (last && !lastVal) ? last : first).focus?.();
        }
    });

    // clear error on input
    [first, last].forEach(el => {
        if (!el) return;
        el.addEventListener('input', () => {
            if (el.value.trim()) {
                if (el === first) setInvalid(first, 'err-firstName', false);
                if (el === last) setInvalid(last, 'err-lastName', false);
            }
        });
    });
})();