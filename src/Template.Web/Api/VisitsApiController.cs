using Microsoft.AspNetCore.Authorization;
using System;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Mvc;
using System.Linq;
using Template.Services;

namespace Template.Web.Api
{
    [Route("api/visits")]
    [ApiController]
    [Authorize]
    public partial class VisitsApiController : ControllerBase
    {
        private readonly TemplateDbContext _db;
        private readonly Microsoft.Extensions.Logging.ILogger<VisitsApiController> _logger;
        private readonly Template.Services.Shared.SharedService _sharedService;
        private readonly Template.Web.SignalR.IPublishDomainEvents _publisher;

        public VisitsApiController(TemplateDbContext db, Microsoft.Extensions.Logging.ILogger<VisitsApiController> logger, Template.Services.Shared.SharedService sharedService, Template.Web.SignalR.IPublishDomainEvents publisher)
        {
            _db = db;
            _logger = logger;
            _sharedService = sharedService;
            _publisher = publisher;
        }

    [HttpGet]
    [Microsoft.AspNetCore.Authorization.AllowAnonymous]
    public virtual IActionResult Get()
        {
            var q = _db.VisitRecords
                .OrderByDescending(x => x.CheckInTime)
                .Select(x => new { x.Id, x.QrKey, x.Email, x.FirstName, x.LastName, x.CheckInTime, x.CheckOutTime })
                .ToList();
            _logger?.LogInformation("/api/visits returning {Count} items", q.Count);

            return Ok(q);
        }

        [HttpPost("{id:guid}/checkout")]
        [Microsoft.AspNetCore.Authorization.AllowAnonymous]
    public virtual async System.Threading.Tasks.Task<IActionResult> Checkout([FromRoute] Guid id)
        {
            if (_sharedService == null)
                return StatusCode(500, "SharedService not available");

            var result = await _sharedService.Handle(new Template.Services.Shared.CheckoutVisitCommand { Id = id });
            if (result == null) return NotFound();

            // publish update event so Reception clients refresh the row
            try
            {
                _publisher?.Publish(new Template.Web.SignalR.Hubs.Events.UpdateVisitEvent { IdGroup = Guid.Empty, VisitDto = result });
            }
            catch { /* best-effort */ }

            return Ok(result);
        }
    }
}
