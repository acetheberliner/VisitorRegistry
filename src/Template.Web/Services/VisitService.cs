using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Text.RegularExpressions;
using Template.Services; // VisitRecord, TemplateDbContext
using Template.Services.Shared;
using Template.Web.Models;

namespace Template.Web.Services
{
    // Servizio per la gestione delle visite
    public class VisitService
    {
        private readonly TemplateDbContext _db;
        private readonly ILogger _logger;
        private readonly Template.Web.SignalR.IPublishDomainEvents _publisher;

        // Costruttore
        public VisitService(TemplateDbContext db, ILogger logger, Template.Web.SignalR.IPublishDomainEvents publisher)
        {
            _db = db;
            _logger = logger;
            _publisher = publisher;
        }

        // Genera un codice corto da 5 caratteri
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

        // Mappa VisitRecord a VisitDto
        private VisitDto MapToDto(VisitRecord v) => new VisitDto
        {
            Id = v.Id,
            ShortCode = ShortFromGuid(v.Id),
            QrKey = v.QrKey,
            Email = v.Email,
            FirstName = v.FirstName,
            LastName = v.LastName,
            CheckInTime = v.CheckInTime,
            CheckOutTime = v.CheckOutTime
        };

        // lista paginata
        public async Task<List<VisitDto>> GetVisitsAsync(string q, DateTime? start, DateTime? end, bool presentOnly, int page, int pageSize)
        {
            // riconosciamo se la query è un ShortCode o un candidato shortcode (1-5 caratteri alfanumerici)
            var trimmedQ = string.IsNullOrWhiteSpace(q) ? string.Empty : q.Trim();
            bool isExactGuid = Guid.TryParse(trimmedQ, out var parsedGuid);
            bool isShortCodeCandidate = Regex.IsMatch(trimmedQ, @"^[0-9A-Z]{1,5}$", RegexOptions.IgnoreCase);

            var query = _db.VisitRecords.AsNoTracking().AsQueryable();

            // Se la query è un GUID esatto, filtriamo per Id (più efficiente)
            if (isExactGuid)
            {
                query = query.Where(v => v.Id == parsedGuid);
            }
            // se non è ShortCode candidate, possiamo applicare il filtro 'q' direttamente in SQL (più efficiente)
            else if (!isShortCodeCandidate && !string.IsNullOrWhiteSpace(trimmedQ))
            {
                var lower = trimmedQ.ToLowerInvariant();
                query = query.Where(v =>
                    (v.Email ?? "").ToLower().Contains(lower) ||
                    (v.FirstName ?? "").ToLower().Contains(lower) ||
                    (v.LastName ?? "").ToLower().Contains(lower) ||
                    (v.QrKey ?? "").ToLower().Contains(lower));
            }

            // applichiamo filtri di data e presenti
            // Normalizziamo gli estremi:
            // - se sono specificati start+end -> intervallo [start.Date .. end.Date endOfDay]
            // - se è specificato solo start -> consideriamo la singola giornata start.Date
            // - se è specificato solo end -> consideriamo la singola giornata end.Date
            DateTime? startRange = null;
            DateTime? endRange = null;
            if (start.HasValue && end.HasValue)
            {
                startRange = start.Value.Date;
                endRange = end.Value.Date.AddDays(1).AddTicks(-1);
            }
            else if (start.HasValue)
            {
                startRange = start.Value.Date;
                endRange = start.Value.Date.AddDays(1).AddTicks(-1);
            }
            else if (end.HasValue)
            {
                startRange = end.Value.Date;
                endRange = end.Value.Date.AddDays(1).AddTicks(-1);
            }

            if (startRange.HasValue && endRange.HasValue)
            {
                // record la cui entrata O uscita rientrano nell'intervallo [startRange, endRange]
                query = query.Where(v =>
                    (v.CheckInTime >= startRange.Value && v.CheckInTime <= endRange.Value) ||
                    (v.CheckOutTime != null && v.CheckOutTime >= startRange.Value && v.CheckOutTime <= endRange.Value));
            }

            // se la query è un candidato shortCode (1-5 chars alfanumerici) filtriamo in memoria per ShortCode (Contains)
            if (isShortCodeCandidate)
            {
                // prendi i record candidati (dopo avere applicato date/presentOnly), mappa e filtra in memoria con Contains per partial match
                var items = await query.OrderByDescending(x => x.CheckInTime).ToListAsync();
                var code = trimmedQ.ToUpperInvariant();
                var dtos = items.Select(x => MapToDto(x))
                                .Where(d => (d.ShortCode ?? string.Empty).ToUpperInvariant().Contains(code))
                                .ToList();

                // applica paginazione in memoria
                page = Math.Max(1, page);
                pageSize = Math.Clamp(pageSize, 1, 1000);
                return dtos.Skip((page - 1) * pageSize).Take(pageSize).ToList();
            }
            else
            {
                // normale percorso: DB -> pagina -> mappa DTO
                query = query.OrderByDescending(x => x.CheckInTime);
                page = Math.Max(1, page);
                pageSize = Math.Clamp(pageSize, 1, 1000);
                var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
                return items.Select(x => MapToDto(x)).ToList();
            }
        }

        // lista completa
        public async Task<List<VisitDto>> GetVisitsListAsync(string q, DateTime? start, DateTime? end, bool presentOnly)
        {
            var trimmedQ = string.IsNullOrWhiteSpace(q) ? string.Empty : q.Trim();
            bool isExactGuid = Guid.TryParse(trimmedQ, out var parsedGuid);
            bool isShortCodeCandidate = Regex.IsMatch(trimmedQ, @"^[0-9A-Z]{1,5}$", RegexOptions.IgnoreCase);
            var query = _db.VisitRecords.AsNoTracking().AsQueryable();

            // GUID exact
            if (isExactGuid)
            {
                query = query.Where(v => v.Id == parsedGuid);
            }
            else if (!isShortCodeCandidate && !string.IsNullOrWhiteSpace(trimmedQ))
            {
                var lower = trimmedQ.ToLowerInvariant();
                query = query.Where(v =>
                    (v.Email ?? "").ToLower().Contains(lower) ||
                    (v.FirstName ?? "").ToLower().Contains(lower) ||
                    (v.LastName ?? "").ToLower().Contains(lower) ||
                    (v.QrKey ?? "").ToLower().Contains(lower));
            }

            // Normalizziamo gli estremi per la lista completa (come sopra)
            DateTime? sRange = null;
            DateTime? eRange = null;
            if (start.HasValue && end.HasValue)
            {
                sRange = start.Value.Date;
                eRange = end.Value.Date.AddDays(1).AddTicks(-1);
            }
            else if (start.HasValue)
            {
                sRange = start.Value.Date;
                eRange = start.Value.Date.AddDays(1).AddTicks(-1);
            }
            else if (end.HasValue)
            {
                sRange = end.Value.Date;
                eRange = end.Value.Date.AddDays(1).AddTicks(-1);
            }

            if (sRange.HasValue && eRange.HasValue)
            {
                query = query.Where(v =>
                    (v.CheckInTime >= sRange.Value && v.CheckInTime <= eRange.Value) ||
                    (v.CheckOutTime != null && v.CheckOutTime >= sRange.Value && v.CheckOutTime <= eRange.Value));
            }

            var items = await query.OrderByDescending(x => x.CheckInTime).ToListAsync();
            var dtos = items.Select(x => MapToDto(x)).ToList();

            if (isShortCodeCandidate)
            {
                var code = trimmedQ.ToUpperInvariant();
                return dtos.Where(d => (d.ShortCode ?? string.Empty).ToUpperInvariant().Contains(code)).ToList();
            }

            return dtos;
        }

        // Checkout
        public async Task<VisitDto> CheckoutAsync(Guid id)
        {
            var v = await _db.VisitRecords.FindAsync(id);
            if (v == null) return null;
            if (v.CheckOutTime != null) return MapToDto(v);
            v.CheckOutTime = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            var dto = MapToDto(v);
            try { _publisher?.Publish(new Template.Web.SignalR.Hubs.Events.UpdateVisitEvent { IdGroup = Guid.Empty, VisitDto = dto }); } catch { }
            return dto;
        }

        // Modifica
        public async Task<VisitDto> UpdateAsync(Guid id, Template.Web.Models.UpdateVisitRequest model)
        {
            var v = await _db.VisitRecords.FindAsync(id);
            if (v == null) return null;
            if (model.Email != null) v.Email = model.Email;
            if (model.FirstName != null) v.FirstName = model.FirstName;
            if (model.LastName != null) v.LastName = model.LastName;
            if (model.QrKey != null) v.QrKey = model.QrKey;
            await _db.SaveChangesAsync();
            var dto = MapToDto(v);
            try { _publisher?.Publish(new Template.Web.SignalR.Hubs.Events.UpdateVisitEvent { IdGroup = Guid.Empty, VisitDto = dto }); } catch { }
            return dto;
        }

        // Cancellazione
        public async Task<VisitDto> DeleteAsync(Guid id)
        {
            var v = await _db.VisitRecords.FindAsync(id);
            if (v == null) return null;

            var dto = MapToDto(v);

            _db.VisitRecords.Remove(v);
            await _db.SaveChangesAsync();

            // Event (best-effort): notify clients that a visit was removed/updated
            try { _publisher?.Publish(new Template.Web.SignalR.Hubs.Events.UpdateVisitEvent { IdGroup = Guid.Empty, VisitDto = dto }); } catch { }

            return dto;
        }

        // Creazione manuale
        public async Task<VisitCreateResult> CreateAsync(Template.Web.Models.CreateVisitRequest model)
        {
            // normalize
            var incomingEmail = string.IsNullOrWhiteSpace(model.Email) ? null : model.Email.Trim();
            var incomingEmailLower = incomingEmail?.ToLowerInvariant();
            var incomingQr = string.IsNullOrWhiteSpace(model.QrKey) ? null : model.QrKey.Trim();

            using (var tx = await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable))
            {
                if (!string.IsNullOrWhiteSpace(incomingEmailLower))
                {
                    var existing = await _db.VisitRecords.AsNoTracking()
                        .Where(v => v.CheckOutTime == null && v.Email != null && v.Email.ToLower() == incomingEmailLower)
                        .OrderByDescending(v => v.CheckInTime)
                        .FirstOrDefaultAsync();
                    if (existing != null)
                    {
                        var existingDto = MapToDto(existing);
                        return new VisitCreateResult { IsConflict = true, Message = "Hai già effettuato il check‑in", ExistingVisit = existingDto, Visit = null };
                    }
                }

                if (!string.IsNullOrWhiteSpace(incomingQr))
                {
                    var existingByQr = await _db.VisitRecords.AsNoTracking()
                        .Where(v => v.CheckOutTime == null && v.QrKey != null && v.QrKey == incomingQr)
                        .FirstOrDefaultAsync();
                    if (existingByQr != null)
                    {
                        var existingDto = MapToDto(existingByQr);
                        return new VisitCreateResult { IsConflict = true, Message = "Hai già effettuato il check‑in (QR registrato)", ExistingVisit = existingDto, Visit = null };
                    }
                }

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

                if (!string.IsNullOrWhiteSpace(incomingEmail))
                {
                    var other = await _db.VisitRecords.AsNoTracking()
                        .Where(v => v.Id != visit.Id && v.CheckOutTime == null && v.Email != null)
                        .ToListAsync();
                    var conflict = other.FirstOrDefault(v => string.Equals((v.Email ?? string.Empty).Trim(), incomingEmail, StringComparison.OrdinalIgnoreCase));
                    if (conflict != null)
                    {
                        await tx.RollbackAsync();
                        var existingDto = MapToDto(conflict);
                        return new VisitCreateResult { IsConflict = true, Message = "Hai già effettuato il check‑in", ExistingVisit = existingDto, Visit = null };
                    }
                }

                await tx.CommitAsync();

                var dto = MapToDto(visit);
                try { _publisher?.Publish(new Template.Web.SignalR.Hubs.Events.UpdateVisitEvent { IdGroup = Guid.Empty, VisitDto = dto }); } catch { }
                return new VisitCreateResult { IsConflict = false, Message = null, ExistingVisit = null, Visit = dto };
            }
        }

        // apri visita per email
        public async Task<VisitDto> GetOpenByEmailAsync(string email)
        {
            var emailTrim = email.Trim();
            var openCandidates = await _db.VisitRecords.AsNoTracking()
                .Where(x => x.CheckOutTime == null && x.Email != null)
                .OrderByDescending(x => x.CheckInTime)
                .ToListAsync();
            var v = openCandidates.FirstOrDefault(x => string.Equals((x.Email ?? string.Empty).Trim(), emailTrim, StringComparison.OrdinalIgnoreCase));
            if (v == null) return null;
            return MapToDto(v);
        }
    }
}
