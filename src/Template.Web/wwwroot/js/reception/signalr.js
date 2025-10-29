import { renderRow } from './render.js';

// avvia SignalR e gestisce eventi
export function startSignalR() {
  if (typeof signalR === 'undefined') {
    console.warn('SignalR non disponibile');
    return null;
  }
  const connection = new signalR.HubConnectionBuilder().withUrl('/templateHub').build();
  connection.on('NewVisit', v => renderRow(v));
  connection.on('UpdateVisit', v => renderRow(v));
  connection.start().catch(e => console.warn('SignalR avvio fallito', e));
  return connection;
}
