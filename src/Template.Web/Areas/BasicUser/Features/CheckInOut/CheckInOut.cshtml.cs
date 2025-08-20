using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.Threading.Tasks;
using System.Linq;
using VisitorRegistry.Infrastructure.Data;
using VisitorRegistry.Infrastructure.Entities;
using System;

namespace Template.Web.Areas.BasicUser.Features.CheckInOut // <- questo deve combaciare
{
    public class CheckInOutModel : PageModel
    {
        private readonly VisitorDbContext _db;

        public CheckInOutModel(VisitorDbContext db)
        {
            _db = db;
        }

        [BindProperty]
        public Visitor Form { get; set; }

        public bool IsCheckIn { get; set; }
        public bool IsCheckOut { get; set; }

        public async Task<IActionResult> OnPostAsync()
        {
            var existing = _db.Visitors.FirstOrDefault(v => v.Email == Form.Email && v.CheckOutTime == null);

            if (existing == null)
            {
                Form.CheckInTime = DateTime.Now;
                _db.Visitors.Add(Form);
                await _db.SaveChangesAsync();
                IsCheckIn = true;
            }
            else
            {
                existing.CheckOutTime = DateTime.Now;
                await _db.SaveChangesAsync();
                IsCheckOut = true;
            }

            return Page();
        }
    }
}
