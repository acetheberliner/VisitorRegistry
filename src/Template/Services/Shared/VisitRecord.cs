using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Template.Services.Shared
{
    public class VisitRecord
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public Guid Id { get; set; }

        // A key representing the QR code scanned (could be the same for all entries)
        public string QrKey { get; set; }

        public string Email { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string AdditionalInfo { get; set; }

        public DateTime CheckInTime { get; set; }
        public DateTime? CheckOutTime { get; set; }

        [NotMapped]
        public bool IsPresent => CheckOutTime == null && CheckInTime != default;
    }
}
