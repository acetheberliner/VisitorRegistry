using Microsoft.AspNetCore.Mvc;
using QRCoder;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.Versioning;

namespace Template.Web.Features.Visitor
{
    [Route("qr")]
    public partial class QrController : Controller
    {
        // GET /qr/generate?key=demo-qr
        [HttpGet("generate")]
        [SupportedOSPlatform("windows")] // <-- indica che questo metodo usa API supportate solo su Windows (risolve CA1416)
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
            using (var qrCode = new QRCode(qrData))
            {
                // Colore brandizzato onit: dark = #47474b
                var dark = ColorTranslator.FromHtml("#47474b");
                var light = Color.White;

                using (var bitmap = qrCode.GetGraphic(20, dark, light, true))
                using (var ms = new MemoryStream())
                {
                    bitmap.Save(ms, ImageFormat.Png);
                    return File(ms.ToArray(), "image/png");
                }
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
