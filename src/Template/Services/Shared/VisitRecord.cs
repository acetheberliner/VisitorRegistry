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

        // Univoco per visitatore
        public string QrKey { get; set; }

        public string Email { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }

        public DateTime CheckInTime { get; set; }
        public DateTime? CheckOutTime { get; set; }

        [NotMapped]
        public bool IsPresent => CheckOutTime == null && CheckInTime != default;

        // Genera un codice breve di 5 caratteri basato su GUID
        public static string GenerateShortCode(Guid id)
        {
            const string alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            var bytes = id.ToByteArray();
            ulong val = 0;
            for (int i = 0; i < 6; i++) val = (val << 8) | bytes[i];
            var sb = new System.Text.StringBuilder();
            while (sb.Length < 5)
            {
                var idx = (int)(val % (ulong)alphabet.Length);
                sb.Insert(0, alphabet[idx]);
                val /= (ulong)alphabet.Length;
                if (val == 0) val = (ulong)(DateTime.UtcNow.Ticks & 0xFFFFFFFFFFFF);
            }
            return sb.ToString().Substring(0, 5);
        }
    }
}
