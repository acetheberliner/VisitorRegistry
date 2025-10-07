using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Mvc;
using System.Linq;
using Template.Services;

namespace Template.Web.Api
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public partial class VisitsApiController : ControllerBase
    {
        private readonly TemplateDbContext _db;
        private readonly Microsoft.Extensions.Logging.ILogger<VisitsApiController> _logger;
        public VisitsApiController(TemplateDbContext db, Microsoft.Extensions.Logging.ILogger<VisitsApiController> logger)
        {
            _db = db;
            _logger = logger;
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
    }
}
