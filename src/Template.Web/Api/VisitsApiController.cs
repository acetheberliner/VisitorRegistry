using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System;
using System.Threading.Tasks;
using Template.Web.Services;
using Template.Web.Models;
using Template.Services;

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

		// Chiamata statica a DbInitializationService
		public VisitsApiController(TemplateDbContext db, ILogger<VisitsApiController> logger, Template.Services.Shared.SharedService sharedService, Template.Web.SignalR.IPublishDomainEvents publisher)
		{
			_logger = logger;
			// inizializza servizi (mantengono lo stesso db context internamente)
			DbInitializationService.EnsureInitialized(db, _logger); // Corretto: chiamata statica
			_visitService = new VisitService(db, _logger, publisher);
			_exportService = new VisitExportService(_logger);
		}

		// restituisce lista di VisitDto in base ai parametri di query e filtri
		[HttpGet]
		[AllowAnonymous]

		public virtual async Task<IActionResult> Get([FromQuery] string q = null, [FromQuery] DateTime? start = null, [FromQuery] DateTime? end = null, [FromQuery] bool presentOnly = false, [FromQuery] int page = 1, [FromQuery] int pageSize = 100)
		{
			var dto = await _visitService.GetVisitsAsync(q, start, end, presentOnly, page, pageSize);
			_logger?.LogInformation("[/api/visits] Returns {Count} entries", dto.Count);
			_logger?.LogInformation(new string('-', 85));
			return Ok(dto);
		}

		// Exporta le visite in un file Excel scaricabile
		[HttpGet("export")]
		[AllowAnonymous]
		public virtual async Task<IActionResult> Export([FromQuery] string q = null, [FromQuery] DateTime? start = null, [FromQuery] DateTime? end = null, [FromQuery] bool presentOnly = false)
		{
			var list = await _visitService.GetVisitsListAsync(q, start, end, presentOnly); // now List<VisitDto>
			var bytes = await _exportService.GenerateExcelAsync(list);
			var fileName = $"visite-{DateTime.UtcNow:dd_MM_yyyy}.xlsx";
			return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
		}

		// Checkout di una visita esistente
		[HttpPost("{id:guid}/checkout")]
		[AllowAnonymous]
		public virtual async Task<IActionResult> Checkout([FromRoute] Guid id)
		{
			var dto = await _visitService.CheckoutAsync(id);
			if (dto == null) return NotFound();
			return Ok(dto);
		}

		// Aggiorna una visita esistente
		[HttpPut("{id:guid}")]
		[AllowAnonymous]
		public virtual async Task<IActionResult> Update([FromRoute] Guid id, [FromBody] UpdateVisitRequest model)
		{
			if (model == null) return BadRequest("Payload mancante");
			var dto = await _visitService.UpdateAsync(id, model);
			if (dto == null) return NotFound();
			return Ok(dto);
		}

		// Elimina una visita esistente
		[HttpDelete("{id:guid}")]
		[AllowAnonymous]
		public virtual async Task<IActionResult> Delete([FromRoute] Guid id)
		{
			// ora DeleteAsync restituisce il VisitDto cancellato oppure null
			var deleted = await _visitService.DeleteAsync(id);
			if (deleted == null) return NotFound();

			_logger?.LogInformation("Deleted entry [Nome={FirstName}, Cognome={LastName}, Email={Email}]", deleted.FirstName, deleted.LastName, deleted.Email);
			_logger?.LogInformation(new string('-', 85));

			return NoContent();
		}

		// Crea una nuova visita (check-in)
		[HttpPost]
		[AllowAnonymous]
		public virtual async Task<IActionResult> Create([FromBody] CreateVisitRequest model)
		{
			if (model == null) return BadRequest("Payload mancante");
			var result = await _visitService.CreateAsync(model);
			if (result.IsConflict) 
			{
				// Log compatto per conflitto
				_logger?.LogInformation("Create conflitto: {Message}", result.Message);
				_logger?.LogInformation(new string('-', 91));
				return Conflict(new { message = result.Message, visit = result.ExistingVisit });
			}

			// Log compatto per inserimento
			var v = result.Visit;
			if (v != null)
			{
				_logger?.LogInformation("Created entry [Nome={FirstName}, Cognome={LastName}, Email={Email}]", v.FirstName, v.LastName, v.Email);
				_logger?.LogInformation(new string('-', 85));
			}

			return CreatedAtAction(nameof(Get), new { id = result.Visit.Id }, result.Visit);
		}
		
		// Recupera una visita aperta in base all'email
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