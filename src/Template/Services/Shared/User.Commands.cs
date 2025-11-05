using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace Template.Services.Shared
{
    public class AddOrUpdateUserCommand
    {
        public Guid? Id { get; set; }
        public string Email { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string NickName { get; set; }
    }

    public class AddOrUpdateVisitCommand
    {
        // The QR key scanned by the visitor (same for checkin/checkout)
        public string QrKey { get; set; }

        // Visitor provided data
        public string Email { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
    }

    public class CheckoutVisitCommand
    {
        // Id of the VisitRecord to checkout
        public Guid Id { get; set; }
    }

    public partial class SharedService
    {
        public async Task<Guid> Handle(AddOrUpdateUserCommand cmd)
        {
            var user = await _dbContext.Users
                .Where(x => x.Id == cmd.Id)
                .FirstOrDefaultAsync();

            if (user == null)
            {
                user = new User
                {
                    Email = cmd.Email,
                };
                _dbContext.Users.Add(user);
            }

            user.FirstName = cmd.FirstName;
            user.LastName = cmd.LastName;
            user.NickName = cmd.NickName;

            await _dbContext.SaveChangesAsync();

            return user.Id;
        }

        /// <summary>
        /// If there's an active visit (same QrKey with null CheckOutTime) then set checkout time.
        /// Otherwise create a new VisitRecord (check-in).
        /// Publishes SignalR events for new visits and updates.
        /// </summary>
        public async Task<VisitByQrDTO> Handle(AddOrUpdateVisitCommand cmd)
        {
            // Normalizza email per confronto (trim + lower)
            var emailTrim = string.IsNullOrWhiteSpace(cmd.Email) ? null : cmd.Email.Trim();
            var emailLower = emailTrim?.ToLowerInvariant();

            // 1) Se l'email è fornita: verifica se esiste già una visita aperta con la stessa email (indipendente dal QR)
            if (!string.IsNullOrWhiteSpace(emailLower))
            {
                var existingByEmail = await _dbContext.VisitRecords
                    .Where(x => x.CheckOutTime == null && x.Email != null && x.Email.ToLower() == emailLower)
                    .OrderByDescending(x => x.CheckInTime)
                    .FirstOrDefaultAsync();

                if (existingByEmail != null)
                {
                    return new VisitByQrDTO
                    {
                        Id = existingByEmail.Id,
                        QrKey = existingByEmail.QrKey,
                        Email = existingByEmail.Email,
                        FirstName = existingByEmail.FirstName,
                        LastName = existingByEmail.LastName,
                        CheckInTime = existingByEmail.CheckInTime,
                        CheckOutTime = existingByEmail.CheckOutTime,
                        IsExisting = true
                    };
                }
            }

            // 2) Se non c'è visita aperta per email, comportamento precedente: cerca per QrKey (checkout se stesso QR)
            var existing = await _dbContext.VisitRecords
                .Where(x => x.QrKey == cmd.QrKey && x.CheckOutTime == null)
                .OrderByDescending(x => x.CheckInTime)
                .FirstOrDefaultAsync();

            if (existing != null)
            {
                existing.CheckOutTime = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync();

                return new VisitByQrDTO
                {
                    Id = existing.Id,
                    QrKey = existing.QrKey,
                    Email = existing.Email,
                    FirstName = existing.FirstName,
                    LastName = existing.LastName,
                    CheckInTime = existing.CheckInTime,
                    CheckOutTime = existing.CheckOutTime
                };
            }

            // 3) Nessuna visita aperta: crea nuova visita (check-in)
            var visit = new VisitRecord
            {
                QrKey = cmd.QrKey,
                Email = cmd.Email,
                FirstName = cmd.FirstName,
                LastName = cmd.LastName,
                CheckInTime = DateTime.UtcNow,
                CheckOutTime = null
            };

            _dbContext.VisitRecords.Add(visit);
            await _dbContext.SaveChangesAsync();

            return new VisitByQrDTO
            {
                Id = visit.Id,
                QrKey = visit.QrKey,
                Email = visit.Email,
                FirstName = visit.FirstName,
                LastName = visit.LastName,
                CheckInTime = visit.CheckInTime,
                CheckOutTime = visit.CheckOutTime
            };
        }

        /// <summary>
        /// Checkout an existing visit by Id (set CheckOutTime to UTC now)
        /// Returns the updated VisitByQrDTO or null if not found.
        /// </summary>
        public async Task<VisitByQrDTO> Handle(CheckoutVisitCommand cmd)
        {
            var existing = await _dbContext.VisitRecords
                .Where(x => x.Id == cmd.Id)
                .FirstOrDefaultAsync();

            if (existing == null) return null;

            if (existing.CheckOutTime == null)
            {
                existing.CheckOutTime = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync();
            }

            return new VisitByQrDTO
            {
                Id = existing.Id,
                Email = existing.Email,
                FirstName = existing.FirstName,
                LastName = existing.LastName,
                CheckInTime = existing.CheckInTime,
                CheckOutTime = existing.CheckOutTime
            };
        }
    }
}