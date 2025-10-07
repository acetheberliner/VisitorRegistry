using System;

namespace Template.Web.SignalR.Hubs.Events
{
    public class NewVisitEvent
    {
        public Guid IdGroup { get; set; }
        public object VisitDto { get; set; }
    }

    public class UpdateVisitEvent
    {
        public Guid IdGroup { get; set; }
        public object VisitDto { get; set; }
    }
}
