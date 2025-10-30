using ClosedXML.Excel;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;

namespace Template.Web.Services
{
    // Servizio per l'esportazione delle visite
	public class VisitExportService
	{
		private readonly ILogger _logger;
		public VisitExportService(ILogger logger) { _logger = logger; }

        // Genera un file Excel dalle visite
        public Task<byte[]> GenerateExcelAsync(List<Template.Web.Models.VisitDto> items)
        {
            try
            {
                using var wb = new XLWorkbook();
                var ws = wb.Worksheets.Add("Visits");
                var headers = new[] { "Codice", "QR", "E-mail", "Nome", "Cognome", "Check-in", "Check-out", "Durata visita" };
                for (int c = 0; c < headers.Length; c++) ws.Cell(1, c + 1).Value = headers[c];

                // Formatta durata in modo leggibile
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
                    ws.Cell(row, 1).Value = r.ShortCode ?? r.Id.ToString();
                    ws.Cell(row, 2).Value = r.QrKey;
                    ws.Cell(row, 3).Value = r.Email;
                    ws.Cell(row, 4).Value = r.FirstName;
                    ws.Cell(row, 5).Value = r.LastName;
                    if (r.CheckInTime != default) { ws.Cell(row, 6).Value = r.CheckInTime; ws.Cell(row, 6).Style.DateFormat.Format = "dd/MM/yyyy HH:mm:ss"; }
                    if (r.CheckOutTime != null) { ws.Cell(row, 7).Value = r.CheckOutTime; ws.Cell(row, 7).Style.DateFormat.Format = "dd/MM/yyyy HH:mm:ss"; }
                    if (r.CheckInTime != default) { var endDt = r.CheckOutTime ?? DateTime.UtcNow; var dur = endDt - r.CheckInTime; ws.Cell(row, 8).Value = FormatDuration(dur); }
                }

                ws.Columns().AdjustToContents();
                using var ms = new MemoryStream();
                wb.SaveAs(ms);
                return Task.FromResult(ms.ToArray());
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Export generation failed");
                throw;
            }
        }
	}
}
