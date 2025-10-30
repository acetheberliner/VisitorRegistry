import { renderRow } from './render.js';

// avvia SignalR e gestisce eventi
export function startSignalR(onNewVisit, onUpdateVisit) {
  if (typeof signalR === 'undefined') {
    console.warn('SignalR not available');
    return null;
  }
  const connection = new signalR.HubConnectionBuilder().withUrl('/templateHub').build();
  if (onNewVisit) connection.on('NewVisit', v => onNewVisit(v));
  if (onUpdateVisit) connection.on('UpdateVisit', v => onUpdateVisit(v));
  connection.start().catch(e => console.warn('SignalR start failed', e));
  return connection;
}
