// percorso base applicazione
export function basePath() {
  try { return (typeof APP_BASE !== 'undefined' && APP_BASE) ? APP_BASE.replace(/\/?$/, '/') : '/'; }
  catch (e) { return '/'; }
}

// selezione elemento
export function escapeHtml(s) {
  if (!s && s !== 0) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// selezione elemento
export function getField(o, a, b) { return (o && (o[a] !== undefined ? o[a] : o[b])) || ''; }

// format data 
export function formatDate(value) {
  if (!value) return '';
  const d = (value instanceof Date) ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

// parse data in UTC
export function parseDateFlexible(s) {
  if (!s) return null;
  if (s instanceof Date) return s;

  const str = String(s).trim();
  if (!str) return null;

  // se manca il fuso orario, aggiungi 'Z'
  const withZone = /Z|[+\-]\d{2}:?\d{2}$/.test(str) ? str : str + 'Z';
  const d = new Date(withZone);

  return isNaN(d) ? null : d;
}

// calcola durata
export function computeDurationMs(v) {
  if (!v) return 0;
  const rawIn = getField(v, 'CheckInTime', 'checkInTime');
  const inDt = parseDateFlexible(rawIn);
  if (!inDt) return 0;
  const rawOut = getField(v, 'CheckOutTime', 'checkOutTime');
  if (rawOut !== undefined && rawOut !== null && String(rawOut).trim() !== '') {
    const outDt = parseDateFlexible(rawOut);
    if (!outDt) return 0;
    return outDt.getTime() - inDt.getTime();
  }
  return Date.now() - inDt.getTime();
}

// formatta durata in stringa
export function formatDuration(ms) {
  if (!ms || ms < 0) return '0s';
  let total = Math.floor(ms/1000);
  const days = Math.floor(total/86400); total %= 86400;
  const hours = Math.floor(total/3600); total %= 3600;
  const mins = Math.floor(total/60); const secs = total % 60;
  const parts = [];
  if (days) parts.push(days + 'g');
  if (hours) parts.push(hours + 'h');
  if (mins) parts.push(mins + 'm');
  parts.push(secs + 's');
  return parts.join(' ');
}

// genera short code per visitatori
export function generateShortFromGuid(g) {
  try {
    const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const hex = String(g).replace(/[^0-9a-fA-F]/g,'');
    if (hex.length < 12) return String(g).substr(0,5).toUpperCase();
    let val = 0n;
    for (let i=0;i<12;i+=2) val = (val << 8n) | BigInt(parseInt(hex.substr(i,2),16));
    let sb = '';
    while (sb.length < 5) {
      const idx = Number(val % BigInt(alphabet.length));
      sb = alphabet[idx] + sb;
      val = val / BigInt(alphabet.length);
      if (val === 0n) val = BigInt(Date.now() & 0xFFFFFFFFFFFF);
    }
    return sb.substr(0,5);
  } catch (e) { return String(g).substr(0,5).toUpperCase(); }
}
