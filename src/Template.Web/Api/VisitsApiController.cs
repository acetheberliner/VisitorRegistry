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

            var items = await query.Skip((page - 1) * pageSize).Take(pageSize).Select(x => new { x.Id, x.QrKey, x.Email, x.FirstName, x.LastName, x.CheckInTime, x.CheckOutTime }).ToListAsync();

            _logger?.LogInformation("/api/visits returning {Count} items (q={q}, start={start}, end={end}, presentOnly={presentOnly})", items.Count, q, start, end, presentOnly);

            return Ok(items);
        }

        // Export XLSX (uses same filters)
        [HttpGet("export")]
        [AllowAnonymous]
        public virtual async Task<IActionResult> Export([FromQuery] string q = null, [FromQuery] DateTime? start = null, [FromQuery] DateTime? end = null, [FromQuery] bool presentOnly = false)
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
            ws.Cell(1, 1).Value = "Id";
            ws.Cell(1, 2).Value = "QrKey";
            ws.Cell(1, 3).Value = "Email";
            ws.Cell(1, 4).Value = "FirstName";
            ws.Cell(1, 5).Value = "LastName";
            ws.Cell(1, 6).Value = "CheckInTime";
            ws.Cell(1, 7).Value = "CheckOutTime";

            for (int i = 0; i < items.Count; i++)
            {
                var r = items[i];
                var row = i + 2;
                ws.Cell(row, 1).Value = r.Id.ToString();
                ws.Cell(row, 2).Value = r.QrKey;
                ws.Cell(row, 3).Value = r.Email;
                ws.Cell(row, 4).Value = r.FirstName;
                ws.Cell(row, 5).Value = r.LastName;
                ws.Cell(row, 6).Value = r.CheckInTime;
                ws.Cell(row, 7).Value = r.CheckOutTime;
            }

            ws.Columns().AdjustToContents();

            using var ms = new MemoryStream();
            wb.SaveAs(ms);
            ms.Seek(0, SeekOrigin.Begin);
            var fileName = $"visits_{DateTime.UtcNow:yyyyMMdd_HHmmss}.xlsx";
            return File(ms.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
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
                // already checked out — return current state
                return Ok(new { v.Id, v.QrKey, v.Email, v.FirstName, v.LastName, v.CheckInTime, v.CheckOutTime });
            }

            v.CheckOutTime = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            var dto = new { v.Id, v.QrKey, v.Email, v.FirstName, v.LastName, v.CheckInTime, v.CheckOutTime };

            try
            {
                _publisher?.Publish(new Template.Web.SignalR.Hubs.Events.UpdateVisitEvent { IdGroup = Guid.Empty, VisitDto = dto });
            }
            catch
            {
                // best-effort publish
            }

            return Ok(dto);
        }
    }
}
