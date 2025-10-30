export const modal = (function () {
  // globals
  const modalEl = document.getElementById('manualModal');
  const formEl = document.getElementById('manualForm');
  const idEl = document.getElementById('manualEditingId');
  const firstEl = document.getElementById('manualFirstName');
  const lastEl = document.getElementById('manualLastName');
  const emailEl = document.getElementById('manualEmail');
  const qrEl = document.getElementById('manualQr');
  const labelEl = document.getElementById('manualModalLabel');

  let bsModal = null;
  if (modalEl && typeof bootstrap !== 'undefined') {
    try { bsModal = new bootstrap.Modal(modalEl); } catch { bsModal = null; }
  }

  let submitHandler = null;
  if (formEl) {
    formEl.addEventListener('submit', function (e) {
      e.preventDefault();
      const payload = {
        FirstName: (firstEl && firstEl.value || '').trim(),
        LastName: (lastEl && lastEl.value || '').trim(),
        Email: (emailEl && emailEl.value || '').trim(),
        QrKey: (qrEl && qrEl.value || '').trim()
      };
      const editingId = (idEl && idEl.value) ? idEl.value : null;
      if (typeof submitHandler === 'function') submitHandler({ id: editingId, payload: payload });
    });
  }

  // apri modal per aggiunta
  function openForAdd() {
    if (formEl) formEl.reset();
    if (idEl) idEl.value = '';
    if (labelEl) labelEl.innerText = 'Aggiungi visitatore';
    show();
  }

  // apri modal per edit
  function openForEdit(id, data) {
    if (formEl) formEl.reset();
    if (idEl) idEl.value = id || '';
    if (firstEl) firstEl.value = data?.FirstName || data?.firstName || '';
    if (lastEl) lastEl.value = data?.LastName || data?.lastName || '';
    if (emailEl) emailEl.value = data?.Email || data?.email || '';
    if (qrEl) qrEl.value = data?.QrKey || data?.qrKey || '';
    if (labelEl) labelEl.innerText = 'Modifica visitatore';
    show();
  }

  // chiudi modal
  function close() {
    if (bsModal) bsModal.hide(); else if (modalEl) modalEl.style.display = 'none';
  }

  // mostra modal
  function show() {
    if (bsModal) bsModal.show(); else if (modalEl) modalEl.style.display = 'block';
  }

  // registra handler submit
  function onSubmit(fn) {
    submitHandler = fn;
  }

  return {
    openForAdd,
    openForEdit,
    close,
    onSubmit
  };
})();
export default modal;
