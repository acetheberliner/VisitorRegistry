namespace Template.Web.Models
{
    // DTO per la creazione di una visita
	public class CreateVisitRequest
	{
		public string QrKey { get; set; }
		public string Email { get; set; }
		public string FirstName { get; set; }
		public string LastName { get; set; }
	}

    // DTO per l'aggiornamento di una visita
    public class UpdateVisitRequest
    {
        public string QrKey { get; set; }
        public string Email { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
    }
}
