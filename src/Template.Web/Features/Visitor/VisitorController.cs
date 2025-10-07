using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading.Tasks;
using Template.Services.Shared;
using Template.Web.SignalR;
using Template.Web.SignalR.Hubs.Events;

namespace Template.Web.Features.Visitor
{
    public partial class VisitorController : Controller
    {
        private readonly SharedService _sharedService;
        private readonly IPublishDomainEvents _publisher;

        public VisitorController(SharedService sharedService, IPublishDomainEvents publisher)
        {
            _sharedService = sharedService;
            _publisher = publisher;
        }

    [HttpGet]
    public virtual IActionResult Index(string q = null)
        {
            // q is the QR key param
            var model = new VisitorFormModel { QrKey = q };
            return View(model);
        }

    [HttpPost]
    public virtual async Task<IActionResult> Index(VisitorFormModel model)
        {
            if (!ModelState.IsValid)
                return View(model);

            var result = await _sharedService.Handle(new AddOrUpdateVisitCommand
            {
                QrKey = model.QrKey,
                Email = model.Email,
                FirstName = model.FirstName,
                LastName = model.LastName,
                AdditionalInfo = model.AdditionalInfo
            });

            // publish signalr events depending on whether it's checkin or checkout
            var visitDto = new { Id = result.Id, QrKey = model.QrKey, result.Email, result.FirstName, result.LastName, result.CheckInTime, result.CheckOutTime };

            if (result.CheckOutTime.HasValue)
            {
                await _publisher.Publish(new UpdateVisitEvent { IdGroup = Guid.Empty, VisitDto = visitDto });
            }
            else
            {
                await _publisher.Publish(new NewVisitEvent { IdGroup = Guid.Empty, VisitDto = visitDto });
            }

            return RedirectToAction("Summary", new { id = result.Id });
        }

    [HttpGet]
    public virtual async Task<IActionResult> Summary(Guid id)
        {
            var v = await _sharedService.Query(new VisitByQrQuery { QrKey = string.Empty });
            // For simplicity return a basic view with id shown
            return View(new VisitorSummaryModel { Id = id });
        }
    }

    public class VisitorFormModel
    {
        public string QrKey { get; set; }
        public string Email { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string AdditionalInfo { get; set; }
    }

    public class VisitorSummaryModel
    {
        public Guid Id { get; set; }
    }
}
