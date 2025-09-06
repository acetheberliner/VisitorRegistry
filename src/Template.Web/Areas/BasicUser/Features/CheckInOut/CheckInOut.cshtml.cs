using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.Threading.Tasks;
using System.Linq;
using VisitorRegistry.Infrastructure.Data;
using VisitorRegistry.Infrastructure.Entities;
using System;
using System.Collections.Generic;

namespace Template.Web.Areas.BasicUser.Features.CheckInOut // <- questo deve combaciare
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

        private static Dictionary<string, DateTime?> _visits = new(); // simulazione DB in memoria

        public void OnGet() {}

        public void OnPost()
        {
            if (_visits.ContainsKey(Email) && _visits[Email] == null)
            {
                // già fatto check-out, nuova visita
                _visits[Email] = DateTime.Now;
                Message = "Benvenuto di nuovo! Check-in effettuato.";
            }
            else if (_visits.ContainsKey(Email))
            {
                _visits[Email] = null;
                Message = "Check-out effettuato.";
            }
            else
            {
                _visits[Email] = DateTime.Now;
                Message = "Check-in effettuato.";
            }

            // TODO: broadcast via SignalR
        }
    }
}