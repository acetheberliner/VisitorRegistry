>*Laboratorio di interfacce uomo-macchina*  
>
>**Studente**: Tommaso Bagnolini – Matricola 0001071116 – <tommaso.bagnolini@studio.unibo.it><br>
>**Gruppo**: progetto svolto INTERAMENTE in forma individuale

# VisitorRegistry

## Prerequisiti

- .NET 8.0 SDK (o versione superiore)<br/>
  Download: https://dotnet.microsoft.com/download
- Clonare la repo e scaricare eventuali aggiornamenti tramite comando:```git pull```
3. Installare i node_modules tramite comando ```npm install``` nella directory ```/src/Template.Web```

## Configurazione Sistema

- Windows:<br/>
   - Nessuna configurazione aggiuntiva richiesta
   - QR code generation supportata nativamente
     
- Linux/Mac:<br/>
   - Assicurarsi che le librerie grafiche siano disponibili
   - Per QR generation: libreria System.Drawing compatibile

## Rete e Connettività

Per Test Desktop Only:<br/>
   - Nessuna configurazione particolare
   - Usare ```http://localhost:5178```

Per Test Mobile/QR Cross-Device:<br/>
   - Dispositivi sulla stessa rete locale
   - Firewall configurato per permettere connessioni sulla porta ```5178```
   - IP della macchina host

## Configurazione IP

Trovare il proprio IP locale:
   - Windows: ```ipconfig /all```
   - Mac/Linux: ```ipconfig getifaddr en0```<br/>
   
Modifica ```src/Template.Web/Properties/launchSettings.json``` sostituendo l'IP pre-impostato ```192.168.178.131``` con il proprio IP<br/>
Infine avviare l'applicazione

## Database

Database creato automaticamente al primo avvio
   - SQLite (incluso, nessuna installazione separata richiesta)
   - Percorso: ```src/Template.Web/visitorregistry.db```

## Dipendenze Gestite Automaticamente

- Entity Framework Core (SQLite provider)
- QRCoder (generazione QR)
- SignalR (real-time updates)
- Bootstrap (via CDN)

## Porte Utilizzate

- HTTP: 5178 (configurabile in ```launchSettings.json```)

## Comandi Rapidi
```
# Verifica .NET SDK
dotnet --version

# Compilazione progetto
dotnet build

# Avvio applicazione
dotnet run
```

## Note per il Testing Cross-Device

1. Stesso network WiFi: Tutti i dispositivi devono essere sulla stessa rete
2. Firewall: Potrebbe bloccare le connessioni, disabilitarlo temporaneamente per test

# Galleria
>Home reception
><img width="1875" height="917" alt="home" src="https://github.com/user-attachments/assets/009fd505-2bc8-4c20-beb5-25729a932dc4" />

>Reception detail of a visitor
><img width="1875" height="917" alt="detail" src="https://github.com/user-attachments/assets/19e9bd5b-0555-473a-8d88-6d18fc4e4edc" />

>Visitor manual creation modal
><img width="1875" height="917" alt="modale" src="https://github.com/user-attachments/assets/1c54684f-c41d-4383-89c9-28265b84068c" />

>QR Archive
><img width="1875" height="1097" alt="archivio" src="https://github.com/user-attachments/assets/a7f3cfff-5643-4a6b-86fc-790fed868a57" />

>Mobile version of QR Archive
><img width="382" height="682" alt="archivio_mobile" src="https://github.com/user-attachments/assets/2225df3e-6689-45cd-8203-cca80af86937" />

>Check-in screen
><img width="375" height="824" alt="checkin" src="https://github.com/user-attachments/assets/0ae13d30-e257-4bb5-a132-a3ad39947df1" />

>Summary after check-in
><img width="376" height="821" alt="summary" src="https://github.com/user-attachments/assets/75d14852-c1eb-4e5c-9eaf-166973e14eba" />

>Summary after check-out
><img width="374" height="715" alt="bye" src="https://github.com/user-attachments/assets/8b14efd2-af52-497c-8df0-a48bf7d3563e" />
