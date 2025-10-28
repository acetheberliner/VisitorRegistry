using Microsoft.AspNetCore.Authorization;
using System;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Mvc;
using System.Linq;
using Template.Services;
using Microsoft.EntityFrameworkCore;
using System.Threading.Tasks;
using ClosedXML.Excel;
using System.IO;
using Template.Services.Shared;

namespace Template.Web.Api
{
    [Route("api/visits")]
    [ApiController]
    [Authorize]
    public partial class VisitsApiController : ControllerBase
    {
        private readonly TemplateDbContext _db;
        private readonly ILogger<VisitsApiController> _logger;
        private readonly Template.Services.Shared.SharedService _sharedService;
        private readonly Template.Web.SignalR.IPublishDomainEvents _publisher;

        public VisitsApiController(TemplateDbContext db, ILogger<VisitsApiController> logger, Template.Services.Shared.SharedService sharedService, Template.Web.SignalR.IPublishDomainEvents publisher)
        {
            _db = db;
            _logger = logger;
            _sharedService = sharedService;
            _publisher = publisher;
        }

        // Helper: genera ShortCode di 5 caratteri da un Guid (caratteri A-Z0-9)
        private static string ShortFromGuid(Guid id)
        {
            const string alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            var bytes = id.ToByteArray();
            ulong val = 0;
            for (int i = 0; i < 6; i++) val = (val << 8) | bytes[i];
            var sb = new System.Text.StringBuilder();
            while (sb.Length < 5)
            {
                var idx = (int)(val % (ulong)alphabet.Length);
                sb.Insert(0, alphabet[idx]);
                val /= (ulong)alphabet.Length;
                if (val == 0) val = (ulong)(DateTime.UtcNow.Ticks & 0xFFFFFFFFFFFF);
            }
            return sb.ToString().Substring(0, 5);
        }

        // GET with filters/paging
        [HttpGet]
        [AllowAnonymous]
        public virtual async Task<IActionResult> Get([FromQuery] string q = null, [FromQuery] DateTime? start = null, [FromQuery] DateTime? end = null, [FromQuery] bool presentOnly = false, [FromQuery] int page = 1, [FromQuery] int pageSize = 100)
        {
            var query = _db.VisitRecords.AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(q))
            {
                var lower = q.ToLowerInvariant();
                query = query.Where(v =>
                    (v.Email ?? "").ToLower().Contains(lower) ||
                    (v.FirstName ?? "").ToLower().Contains(lower) ||
                    (v.LastName ?? "").ToLower().Contains(lower) ||
                    (v.QrKey ?? "").ToLower().Contains(lower));
            }

            if (start.HasValue)
                query = query.Where(v => v.CheckInTime >= start.Value);

            if (end.HasValue)
                query = query.Where(v => v.CheckInTime <= end.Value.AddDays(1).AddTicks(-1));

            if (presentOnly)
                query = query.Where(v => v.CheckOutTime == null);

            query = query.OrderByDescending(x => x.CheckInTime);

            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 1000);

            var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

            // restituisci DTO comprensivo di ShortCode
            var dto = items.Select(x => new
            {
                x.Id,
                ShortCode = ShortFromGuid(x.Id),
                x.QrKey,
                x.Email,
                x.FirstName,
                x.LastName,
                x.CheckInTime,
                x.CheckOutTime
            }).ToList();

            _logger?.LogInformation("/api/visits returning {Count} items (q={q}, start={start}, end={end}, presentOnly={presentOnly})", dto.Count, q, start, end, presentOnly);

            return Ok(dto);
        }

        // Export XLSX (uses same filters)
        [HttpGet("export")]
        [AllowAnonymous]
        public virtual async Task<IActionResult> Export([FromQuery] string q = null, [FromQuery] DateTime? start = null, [FromQuery] DateTime? end = null, [FromQuery] bool presentOnly = false)
        {
            try
            {
                var query = _db.VisitRecords.AsNoTracking().AsQueryable();

                if (!string.IsNullOrWhiteSpace(q))
                {
                    var lower = q.ToLowerInvariant();
                    query = query.Where(v =>
                        (v.Email ?? "").ToLower().Contains(lower) ||
                        (v.FirstName ?? "").ToLower().Contains(lower) ||
                        (v.LastName ?? "").ToLower().Contains(lower) ||
                        (v.QrKey ?? "").ToLower().Contains(lower));
                }

                if (start.HasValue)
                    query = query.Where(v => v.CheckInTime >= start.Value);

                if (end.HasValue)
                    query = query.Where(v => v.CheckInTime <= end.Value.AddDays(1).AddTicks(-1));

                if (presentOnly)
                    query = query.Where(v => v.CheckOutTime == null);

                var items = await query.OrderByDescending(x => x.CheckInTime).ToListAsync();

                using var wb = new XLWorkbook();
                var ws = wb.Worksheets.Add("Visits");

                // headers: mostriamo il codice breve invece del GUID
                var headers = new[] { "Codice", "QR", "E-mail", "Nome", "Cognome", "Check-in", "Check-out", "Durata visita" };
                for (int c = 0; c < headers.Length; c++) ws.Cell(1, c + 1).Value = headers[c];

                // helper durata (esistente)
                string FormatDuration(TimeSpan d)
                {
                    if (d.TotalSeconds < 1) return "0s";
                    var parts = new System.Collections.Generic.List<string>();
                    if (d.Days > 0) parts.Add($"{d.Days}d");
                    if (d.Hours > 0) parts.Add($"{d.Hours}h");
                    if (d.Minutes > 0) parts.Add($"{d.Minutes}m");
                    if (d.Seconds > 0) parts.Add($"{d.Seconds}s");
                    return string.Join(" ", parts);
                }

                for (int i = 0; i < items.Count; i++)
                {
                    var r = items[i];
                    var row = i + 2;

                    // usa ShortCode al posto di Guid per la colonna "Codice"
                    ws.Cell(row, 1).Value = ShortFromGuid(r.Id);
                    ws.Cell(row, 2).Value = r.QrKey;
                    ws.Cell(row, 3).Value = r.Email;
                    ws.Cell(row, 4).Value = r.FirstName;
                    ws.Cell(row, 5).Value = r.LastName;

                    if (r.CheckInTime != default)
                    {
                        ws.Cell(row, 6).Value = r.CheckInTime;
                        ws.Cell(row, 6).Style.DateFormat.Format = "dd/MM/yyyy HH:mm:ss";
                    }
                    else ws.Cell(row, 6).Value = "";

                    if (r.CheckOutTime != null)
                    {
                        ws.Cell(row, 7).Value = r.CheckOutTime;
                        ws.Cell(row, 7).Style.DateFormat.Format = "dd/MM/yyyy HH:mm:ss";
                    }
                    else ws.Cell(row, 7).Value = "";

                    if (r.CheckInTime != default)
                    {
                        var endDt = r.CheckOutTime ?? DateTime.UtcNow;
                        var dur = endDt - r.CheckInTime;
                        ws.Cell(row, 8).Value = FormatDuration(dur);
                    }
                    else
                    {
                        ws.Cell(row, 8).Value = "";
                    }
                }

                var usedRange = ws.Range(1, 1, items.Count + 1, headers.Length);
                var table = usedRange.CreateTable();
                table.Theme = XLTableTheme.None;
                table.ShowAutoFilter = true;

                var headerRange = ws.Range(1, 1, 1, headers.Length);
                headerRange.Style.Font.Bold = true;
                headerRange.Style.Font.FontSize = 11;
                headerRange.Style.Font.FontColor = XLColor.White;
                headerRange.Style.Fill.BackgroundColor = XLColor.FromHtml("#7E3434");
                headerRange.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                headerRange.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
                headerRange.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
                headerRange.Style.Border.OutsideBorderColor = XLColor.FromHtml("#FBCACA");

                // formattazione colonne
                ws.Column(1).Width = 40;   // ID Accesso
                ws.Column(2).Width = 18;   // QR
                ws.Column(3).Width = 30;   // E-mail
                ws.Column(4).Width = 14;   // Nome
                ws.Column(5).Width = 14;   // Cognome
                ws.Column(6).Width = 20;   // Check-in
                ws.Column(7).Width = 20;   // Check-out
                ws.Column(8).Width = 14;   // Durata visita

                // stile righe
                for (int i = 0; i < items.Count; i++)
                {
                    var r = items[i];
                    var row = i + 2;
                    var fullRow = ws.Range(row, 1, row, headers.Length);

                    // per ogni riga applica colore alternato
                    if (i % 2 == 0)
                        fullRow.Style.Fill.BackgroundColor = XLColor.FromHtml("#FDE8E8"); // lighter pink
                    else
                        fullRow.Style.Fill.BackgroundColor = XLColor.FromHtml("#FADCD9"); // slightly darker

                    fullRow.Style.Border.BottomBorder = XLBorderStyleValues.Hair;
                    fullRow.Style.Border.BottomBorderColor = XLColor.FromHtml("#F4C2C2");

                    // se ancora presente => sfondo verde (uso hex valido)
                    if (r.CheckOutTime == null)
                    {
                        fullRow.Style.Fill.BackgroundColor = XLColor.FromHtml("#9AEEA5"); // light green
                    }

                    // allineamento celle
                    ws.Cell(row, 1).Style.Font.Bold = true;
                    ws.Cell(row, 2).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                    ws.Cell(row, 6).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                    ws.Cell(row, 7).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                    ws.Cell(row, 8).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;
                }

                ws.Row(1).Height = 24;
                ws.SheetView.FreezeRows(1);
                ws.Columns().AdjustToContents();

                ws.PageSetup.SetRowsToRepeatAtTop(1, 1);

                wb.Properties.Title = "Visit Report";
                wb.Properties.Author = "VisitorRegistry";

                using var ms = new MemoryStream();
                wb.SaveAs(ms);
                ms.Seek(0, SeekOrigin.Begin);
                var fileName = $"visite-{DateTime.UtcNow:dd_MM_yyyy}.xlsx";
                return File(ms.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Export XLSX failed");
                return StatusCode(500, "Errore durante la generazione dell'export: " + ex.Message);
            }
        }

        // Checkout endpoint: marks CheckOutTime (if not present) and publishes UpdateVisitEvent
        [HttpPost("{id:guid}/checkout")]
        [AllowAnonymous]
        public virtual async Task<IActionResult> Checkout([FromRoute] Guid id)
        {
            var v = await _db.VisitRecords.FindAsync(id);
            if (v == null) return NotFound();

            if (v.CheckOutTime != null)
            {
                // return current state including ShortCode
                return Ok(new { v.Id, ShortCode = ShortFromGuid(v.Id), v.QrKey, v.Email, v.FirstName, v.LastName, v.CheckInTime, v.CheckOutTime });
            }

            v.CheckOutTime = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            var dto = new { v.Id, ShortCode = ShortFromGuid(v.Id), v.QrKey, v.Email, v.FirstName, v.LastName, v.CheckInTime, v.CheckOutTime };

            try
            {
                _publisher?.Publish(new Template.Web.SignalR.Hubs.Events.UpdateVisitEvent { IdGroup = Guid.Empty, VisitDto = dto });
            }
            catch { }

            return Ok(dto);
        }

        // Nuovo: crea una visita (controllo anti-multipli sulla stessa email o sullo stesso QrKey)
        // Body: { "QrKey": "...", "Email": "...", "FirstName": "...", "LastName": "..." }
        [HttpPost]
        [AllowAnonymous]
        public virtual async Task<IActionResult> Create([FromBody] CreateVisitRequest model)
        {
            if (model == null) return BadRequest("Payload mancante");

            // normalizza input
            var incomingEmail = string.IsNullOrWhiteSpace(model.Email) ? null : model.Email.Trim();
            var incomingEmailLower = incomingEmail?.ToLowerInvariant();
            var incomingQr = string.IsNullOrWhiteSpace(model.QrKey) ? null : model.QrKey.Trim();

            // Esegui controllo e inserimento in transazione serializable per essere atomici
            using (var tx = await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable))
            {
                // controllo email (case-insensitive) — fetch dei candidati e confronto in-memory robusto
                if (!string.IsNullOrWhiteSpace(incomingEmailLower))
                {
                    var openCandidates = await _db.VisitRecords.AsNoTracking()
                        .Where(v => v.CheckOutTime == null && v.Email != null)
                        .ToListAsync();

                    var existing = openCandidates.FirstOrDefault(v =>
                        string.Equals((v.Email ?? string.Empty).Trim(), incomingEmail, StringComparison.OrdinalIgnoreCase));

                    if (existing != null)
                    {
                        var existingDto = new
                        {
                            existing.Id,
                            ShortCode = ShortFromGuid(existing.Id),
                            existing.QrKey,
                            existing.Email,
                            existing.FirstName,
                            existing.LastName,
                            existing.CheckInTime,
                            existing.CheckOutTime
                        };
                        // non commit della transazione: rollback implicito alla dispose
                        return Conflict(new { message = "Hai già effettuato il check‑in", visit = existingDto });
                    }
                }

                // controllo per QrKey se fornito (unchanged; rileva se stesso QR già aperto)
                if (!string.IsNullOrWhiteSpace(incomingQr))
                {
                    var existingByQr = await _db.VisitRecords.AsNoTracking()
                        .Where(v => v.CheckOutTime == null && v.QrKey != null && v.QrKey == incomingQr)
                        .FirstOrDefaultAsync();

                    if (existingByQr != null)
                    {
                        var existingDto = new
                        {
                            existingByQr.Id,
                            ShortCode = ShortFromGuid(existingByQr.Id),
                            existingByQr.QrKey,
                            existingByQr.Email,
                            existingByQr.FirstName,
                            existingByQr.LastName,
                            existingByQr.CheckInTime,
                            existingByQr.CheckOutTime
                        };
                        return Conflict(new { message = "Hai già effettuato il check‑in (QR registrato)", visit = existingDto });
                    }
                }

                // Nessun duplicato trovato: creazione
                var visit = new VisitRecord
                {
                    Id = Guid.NewGuid(),
                    QrKey = model.QrKey,
                    Email = model.Email,
                    FirstName = model.FirstName,
                    LastName = model.LastName,
                    CheckInTime = DateTime.UtcNow,
                    CheckOutTime = null
                };

                _db.VisitRecords.Add(visit);
                await _db.SaveChangesAsync();

                // SQLite non supporta colonne calcolate PERSISTED:
                // popola EmailNorm manualmente per questa riga (LOWER(Email)) in modo da poter creare indice univoco filtrato in DB
                try
                {
                    var emailNorm = (visit.Email ?? string.Empty).Trim().ToLowerInvariant();
                    await _db.Database.ExecuteSqlRawAsync("UPDATE VisitRecords SET EmailNorm = {0} WHERE Id = {1}", emailNorm, visit.Id);
                }
                catch
                {
                    // best-effort: se la colonna EmailNorm non esiste o update fallisce, non interrompiamo la creazione
                }

                await tx.CommitAsync();

                var dto = new
                {
                    visit.Id,
                    ShortCode = ShortFromGuid(visit.Id),
                    visit.QrKey,
                    visit.Email,
                    visit.FirstName,
                    visit.LastName,
                    visit.CheckInTime,
                    visit.CheckOutTime
                };

                try { _publisher?.Publish(new Template.Web.SignalR.Hubs.Events.UpdateVisitEvent { IdGroup = Guid.Empty, VisitDto = dto }); } catch { }

                return CreatedAtAction(nameof(Get), new { id = visit.Id }, dto);
            }
        }

        // Nuovo (aggiornato): cerca visita aperta per email (utile per scanner QR/cliente)
        [HttpGet("by-email")]
        [AllowAnonymous]
        public virtual async Task<IActionResult> GetOpenByEmail([FromQuery] string email)
        {
            if (string.IsNullOrWhiteSpace(email)) return BadRequest("Parametro 'email' mancante");
            var emailTrim = email.Trim();

            // prendi tutti i record aperti con email non nulla e confronta in-memory per robustezza
            var openCandidates = await _db.VisitRecords.AsNoTracking()
                .Where(x => x.CheckOutTime == null && x.Email != null)
                .OrderByDescending(x => x.CheckInTime)
                .ToListAsync();

            var v = openCandidates.FirstOrDefault(x => string.Equals((x.Email ?? string.Empty).Trim(), emailTrim, StringComparison.OrdinalIgnoreCase));
            if (v == null) return NotFound();

            var dto = new
            {
                v.Id,
                ShortCode = ShortFromGuid(v.Id),
                v.QrKey,
                v.Email,
                v.FirstName,
                v.LastName,
                v.CheckInTime,
                v.CheckOutTime
            };
            return Ok(dto);
        }

        // Model semplice per la creazione (evita dipendenze esterne)
        public class CreateVisitRequest
        {
            public string QrKey { get; set; }
            public string Email { get; set; }
            public string FirstName { get; set; }
            public string LastName { get; set; }
        }
    }
}
