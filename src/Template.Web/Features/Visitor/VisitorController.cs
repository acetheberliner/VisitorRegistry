using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System;
using System.Threading.Tasks;
using Template.Services.Shared;
using Template.Web.SignalR;
using Template.Web.SignalR.Hubs.Events;

namespace Template.Web.Features.Visitor
{
    public partial class VisitorController : Controller
    {
        private readonly SharedService _sharedService;
        private readonly IPublishDomainEvents _publisher;
        private readonly ILogger<VisitorController> _logger;

        public VisitorController(SharedService sharedService, IPublishDomainEvents publisher, ILogger<VisitorController> logger)
        {
            _sharedService = sharedService;
            _publisher = publisher;
            _logger = logger;
        }

        // Controlla se il dispositivo ha un openVisitId (cookie) e, se presente, tenta checkout automatico
        [HttpGet]
        public virtual async Task<IActionResult> Index(string q = null)
        {
            try
            {
                if (Request.Cookies.TryGetValue("openVisitId", out var cookieVal) && Guid.TryParse(cookieVal, out var visitId))
                {
                    _logger.LogInformation("Cookie openVisitId ricevuto: {cookie}", cookieVal);
                    var visit = await _sharedService.Query(new VisitByQrQuery { QrKey = string.Empty });
                    if (visit != null && visit.CheckOutTime == null)
                    {
                        var checkout = await _sharedService.Handle(new CheckoutVisitCommand { Id = visitId });
                        if (checkout != null && checkout.CheckOutTime != null)
                        {
                            // rimuove cookie e notifica via SignalR (best-effort)
                            try { Response.Cookies.Delete("openVisitId", new Microsoft.AspNetCore.Http.CookieOptions { Path = "/" }); } catch {}
                            try { await _publisher.Publish(new UpdateVisitEvent { IdGroup = Guid.Empty, VisitDto = checkout }); } catch {}
                            _logger.LogInformation("Checkout automatico eseguito: ID={id}", visitId);
                            return RedirectToAction("Summary", new { id = checkout.Id, checkedOut = true });
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Errore durante il tentativo di checkout automatico");
            }

            _logger.LogInformation("Mostra form check-in per QR={q}", q);
            return View(new VisitorFormModel { QrKey = q });
        }

        // Gestisce il POST del form: crea o riusa visita; imposta cookie openVisitId come fallback per lo stesso dispositivo
        [HttpPost]
        public virtual async Task<IActionResult> Index(VisitorFormModel model)
        {
            if (!ModelState.IsValid) { _logger.LogInformation("POST /Visitor model non valido"); return View(model); }

            _logger.LogInformation("Ricevuto check-in: {first} {last} ({email}) QR={qr}", model.FirstName, model.LastName, model.Email, model.QrKey);

            var result = await _sharedService.Handle(new AddOrUpdateVisitCommand
            {
                QrKey = model.QrKey,
                Email = model.Email,
                FirstName = model.FirstName,
                LastName = model.LastName
            });

            // Se è una visita esistente (IsExisting), reindirizza subito alla summary senza modificare cookie
            if (result != null && result.IsExisting)
            {
                if (result.CheckOutTime == null)
                {
                    try
                    {
                        var opts = new Microsoft.AspNetCore.Http.CookieOptions { Expires = DateTimeOffset.UtcNow.AddDays(1), HttpOnly = false, Path = "/", SameSite = Microsoft.AspNetCore.Http.SameSiteMode.Lax, Secure = false };
                        Response.Cookies.Append("openVisitId", result.Id.ToString(), opts);
                        _logger.LogInformation("Cookie openVisitId impostato (existing): {id}", result.Id);
                    }
                    catch (Exception ex) { _logger.LogWarning(ex, "Impossibile impostare cookie openVisitId (existing)"); }
                }
                return RedirectToAction("Summary", new { id = result.Id, existing = true });
            }
            
            // Log dell'operazione
            _logger.LogInformation("Check-in registrato: ID={id}, Nome={first}, Cognome={last}, Email={email}, QR={qr}", result.Id, result.FirstName, result.LastName, result.Email, result.QrKey);

            // Altrimenti, imposta cookie e reindirizza alla summary
            if (result.CheckOutTime == null)
            {
                try
                {
                    var opts = new Microsoft.AspNetCore.Http.CookieOptions { Expires = DateTimeOffset.UtcNow.AddDays(1), HttpOnly = false, Path = "/", SameSite = Microsoft.AspNetCore.Http.SameSiteMode.Lax, Secure = false };
                    Response.Cookies.Append("openVisitId", result.Id.ToString(), opts);
                    _logger.LogInformation("Cookie openVisitId impostato: {id}", result.Id);
                }
                catch (Exception ex) { _logger.LogWarning(ex, "Impossibile impostare cookie openVisitId"); }
            }
            else
            {
                try { Response.Cookies.Delete("openVisitId", new Microsoft.AspNetCore.Http.CookieOptions { Path = "/" }); } catch {}
            }

            return RedirectToAction("Summary", new { id = result.Id });
        }

        // Mostra la summary (utilizzata anche dal client)
        [HttpGet]
        public virtual async Task<IActionResult> Summary(Guid id)
        {
            var v = await _sharedService.Query(new VisitByQrQuery { QrKey = string.Empty });
            // For simplicity return a basic view with id shown
            return View(new VisitorSummaryModel { Id = id });
        }
    }

    // Modelli di view (in-file per semplicità)
    public class VisitorFormModel
    {
        public string QrKey { get; set; }
        public string Email { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
    }

    public class VisitorSummaryModel { public Guid Id { get; set; } }
}
