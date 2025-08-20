using System;

namespace VisitorRegistry.Infrastructure.Entities
{
    public class Visitor
    {
        public int Id { get; set; }
        public string FullName { get; set; }
        public string Email { get; set; }
        public string Reason { get; set; }
        public DateTime CheckInTime { get; set; }
        public DateTime? CheckOutTime { get; set; }

        public bool IsCheckedIn => CheckOutTime == null;
    }
}
