using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.Collections.Concurrent;

namespace Template.Web.Areas.BasicUser.Pages
{
    public class CheckInOutModel : PageModel
    {
        [BindProperty]
        public string FullName { get; set; }

        [BindProperty]
        public string Email { get; set; }

        [BindProperty]
        public string Reason { get; set; }

        public string Message { get; set; }

        // ⚠️ Simulazione DB in-memory condiviso
        private static ConcurrentDictionary<string, bool> CheckInStatus = new();

        public void OnGet()
        {
        }

        public void OnPost()
        {
            if (CheckInStatus.TryGetValue(Email, out var isCheckedIn) && isCheckedIn)
            {
                // Check-out
                CheckInStatus[Email] = false;
                Message = "Check-out effettuato con successo. Grazie per la visita!";
            }
            else
            {
                // Check-in
                CheckInStatus[Email] = true;
                Message = $"Check-in effettuato! Benvenuto, {FullName}.";
            }
        }
    }
}
