namespace Template.Web.Models
{
    // DTO per VisitRecord
    public class VisitDto
    {
        public System.Guid Id { get; set; }
        public string ShortCode { get; set; }
        public string QrKey { get; set; }
        public string Email { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public System.DateTime CheckInTime { get; set; }
        public System.DateTime? CheckOutTime { get; set; }
    }

    // DTO per il risultato della creazione di una visita
    public class VisitCreateResult
    {
        public bool IsConflict { get; set; }
        public string Message { get; set; }
        public VisitDto ExistingVisit { get; set; }
        public VisitDto Visit { get; set; }
    }
}
