using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System;
using System.Threading.Tasks;
using Template.Web.Services;
using Template.Web.Models;
using Template.Services; // <--- aggiunto: TemplateDbContext / VisitRecord namespace

namespace Template.Web.Api
{
	[Route("api/visits")]
	[ApiController]
	[Authorize]
	public partial class VisitsApiController : ControllerBase
	{
		private readonly ILogger<VisitsApiController> _logger;
		private readonly VisitService _visitService;
		private readonly VisitExportService _exportService;

		public VisitsApiController(TemplateDbContext db, ILogger<VisitsApiController> logger, Template.Services.Shared.SharedService sharedService, Template.Web.SignalR.IPublishDomainEvents publisher)
		{
			_logger = logger;
			// inizializza servizi (mantengono lo stesso db context internamente)
			DbInitializationService.EnsureInitialized(db, _logger);
			_visitService = new VisitService(db, _logger, publisher);
			_exportService = new VisitExportService(_logger);
		}

		[HttpGet]
		[AllowAnonymous]
		public virtual async Task<IActionResult> Get([FromQuery] string q = null, [FromQuery] DateTime? start = null, [FromQuery] DateTime? end = null, [FromQuery] bool presentOnly = false, [FromQuery] int page = 1, [FromQuery] int pageSize = 100)
		{
			var dto = await _visitService.GetVisitsAsync(q, start, end, presentOnly, page, pageSize);
			_logger?.LogInformation("/api/visits returning {Count} items (q={q}, start={start}, end={end}, presentOnly={presentOnly})", dto.Count, q, start, end, presentOnly);
			return Ok(dto);
		}

		[HttpGet("export")]
		[AllowAnonymous]
		public virtual async Task<IActionResult> Export([FromQuery] string q = null, [FromQuery] DateTime? start = null, [FromQuery] DateTime? end = null, [FromQuery] bool presentOnly = false)
		{
			var list = await _visitService.GetVisitsListAsync(q, start, end, presentOnly); // now List<VisitDto>
			var bytes = await _exportService.GenerateExcelAsync(list);
			var fileName = $"visite-{DateTime.UtcNow:dd_MM_yyyy}.xlsx";
			return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
		}

		[HttpPost("{id:guid}/checkout")]
		[AllowAnonymous]
		public virtual async Task<IActionResult> Checkout([FromRoute] Guid id)
		{
			var dto = await _visitService.CheckoutAsync(id);
			if (dto == null) return NotFound();
			return Ok(dto);
		}

		[HttpPut("{id:guid}")]
		[AllowAnonymous]
		public virtual async Task<IActionResult> Update([FromRoute] Guid id, [FromBody] UpdateVisitRequest model)
		{
			if (model == null) return BadRequest("Payload mancante");
			var dto = await _visitService.UpdateAsync(id, model);
			if (dto == null) return NotFound();
			return Ok(dto);
		}

		[HttpDelete("{id:guid}")]
		[AllowAnonymous]
		public virtual async Task<IActionResult> Delete([FromRoute] Guid id)
		{
			var ok = await _visitService.DeleteAsync(id);
			if (!ok) return NotFound();
			return NoContent();
		}

		[HttpPost]
		[AllowAnonymous]
		public virtual async Task<IActionResult> Create([FromBody] CreateVisitRequest model)
		{
			if (model == null) return BadRequest("Payload mancante");
			var result = await _visitService.CreateAsync(model);
			if (result.IsConflict) return Conflict(new { message = result.Message, visit = result.ExistingVisit });
			return CreatedAtAction(nameof(Get), new { id = result.Visit.Id }, result.Visit);
		}

		[HttpGet("by-email")]
		[AllowAnonymous]
		public virtual async Task<IActionResult> GetOpenByEmail([FromQuery] string email)
		{
			if (string.IsNullOrWhiteSpace(email)) return BadRequest("Parametro 'email' mancante");
			var dto = await _visitService.GetOpenByEmailAsync(email);
			if (dto == null) return NotFound();
			return Ok(dto);
		}
	}
}
