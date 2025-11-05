# TODO progetto Interfacce HMI

## FATTO

+ Filtri reception [FATTO]
+ Realizzare QR funzionanti [FATTO]
+ migliorare pagina QR [FATTO]
+ migliorare login [FATTO]

## DA FARE

+ date picker [FATTO]
+ Badge verdi “Presente" [FATTO]
+ da quanto tempo è dentro [FATTO]
+ Excel migliorato con formattazione, colori, bold, date/time [FATTO]
+ Controllo anti-checkin multipli e in caso "vuoi fare check-out?" (rileva automaticamente(?)) [FATTO]
+ Fix Duration 1 hour late [FATTO]
+ CRUD manuale per reception [FATTO]

+ Checkout con qualsiasi qr con local storage o cookie server: uso entrambi: local storage con priorità (viene scritto in Summary.cshtml (openVisitId) e letto automaticamente in Index.cshtml per eseguire il checkout via API quando si scansiona un altro QR, affidabile perche non soggetto a samesite) e cookie di fallback. opzionale perche su mobile/scan spesso fallisce per SameSite, dominio/porta non corrispondenti o scanner che aprono in contesti isolati. [FATTO]

## EXTRA

+ scarica badge visitatore in galleria [FATTO]
+ ID nella sidebar [FATTO]
+ Notifiche chek-in reception (?)
+ Picchi orari per reception (?)
+ dati di giorni passati (?)
+ riepilogo dati inseriti prima di inviarli (?)

## INFRASTRUTTURA

+ Dashboard responsive touch-friendly
+ better UX/UI:
  + colori coerenti (ONIT(?)/Brand Fittizio)
  + soft animations (?)
  + accessibilità:
	+ form validi
	+ labels corrette
	+ focus corretti
	+ ...
+ add db columns (?)
+ clean code
+ modularità reception.js [FATTO]