using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Template.Web.Features.Reception
{
    public partial class ReceptionController : Controller
    {
        public ReceptionController()
        {
        }

        [HttpGet]
        [Microsoft.AspNetCore.Authorization.AllowAnonymous]
        public virtual IActionResult Index()
        {
            return View();
        }
    }
}
