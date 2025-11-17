using Microsoft.AspNetCore.Mvc;
using QRCoder;

namespace Template.Web.Features.Visitor
{
    [Route("qr")]
    public partial class QrController : Controller
    {
        // GET /qr/generate?key=demo-qr
        [HttpGet("generate")]
        public virtual IActionResult Generate(string key, string baseUrl = null, bool debug = false)
        {
            if (string.IsNullOrWhiteSpace(key)) return BadRequest("Missing key");

            // Build the target URL to be encoded in the QR
            var host = string.IsNullOrWhiteSpace(baseUrl) ? Request.Scheme + "://" + Request.Host : baseUrl;
            var url = $"{host}/Visitor?q={System.Net.WebUtility.UrlEncode(key)}";

            if (debug)
            {
                return Content(url);
            }

            using (var qrGenerator = new QRCodeGenerator())
            using (var qrData = qrGenerator.CreateQrCode(url, QRCodeGenerator.ECCLevel.Q))
            using (var qrCode = new PngByteQRCode(qrData))
            {
                // Usa PngByteQRCode per compatibilità cross-platform (senza System.Drawing)
                var bytes = qrCode.GetGraphic(20);
                return File(bytes, "image/png");
            }
        }

        // Simple page to preview multiple QR codes
        [HttpGet("preview")]
        public virtual IActionResult Preview(string[] keys)
        {
            ViewBag.Keys = keys ?? new string[] {
                "main-entrance",
                "side-door",
                "rear-exit",
                "garage-access",
                "staff-entry",
                "vip-lounge",
                "storage-room",
                "emergency-exit",
                "roof-access" };
            return View();
        }
    }
}
