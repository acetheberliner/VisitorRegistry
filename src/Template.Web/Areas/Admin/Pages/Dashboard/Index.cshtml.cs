using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using VisitorRegistry.Infrastructure.Data;
using VisitorRegistry.Infrastructure.Entities;

namespace Template.Web.Areas.Admin.Pages.Dashboard
{
    public class IndexModel : PageModel
    {
        // private readonly VisitorDbContext _db;

        // public IndexModel(VisitorDbContext db)
        // {
        //     _db = db;
        // }

        public IndexModel()
        {
            // Mock temporaneo, niente DB
        }


        public List<Visitor> Visitors { get; set; }

        public async Task OnGetAsync()
        {
            // Visitors = await _db.Visitors
            //     .OrderByDescending(v => v.CheckInTime)
            //     .ToListAsync();
            Visitors = new List<Visitor>(); // lista vuota temporanea
        }
    }
}
