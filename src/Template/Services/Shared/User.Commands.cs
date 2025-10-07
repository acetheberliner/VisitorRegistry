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
        public string AdditionalInfo { get; set; }
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

        // ...existing code...

        /// <summary>
        /// If there's an active visit (same QrKey with null CheckOutTime) then set checkout time.
        /// Otherwise create a new VisitRecord (check-in).
        /// Publishes SignalR events for new visits and updates.
        /// </summary>
        public async Task<VisitByQrDTO> Handle(AddOrUpdateVisitCommand cmd)
        {
            // Find the most recent visit for that QrKey which is still open
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
                    Email = existing.Email,
                    FirstName = existing.FirstName,
                    LastName = existing.LastName,
                    CheckInTime = existing.CheckInTime,
                    CheckOutTime = existing.CheckOutTime
                };
            }

            var visit = new Template.Services.Shared.VisitRecord
            {
                QrKey = cmd.QrKey,
                Email = cmd.Email,
                FirstName = cmd.FirstName,
                LastName = cmd.LastName,
                AdditionalInfo = cmd.AdditionalInfo,
                CheckInTime = DateTime.UtcNow,
                CheckOutTime = null
            };

            _dbContext.VisitRecords.Add(visit);
            await _dbContext.SaveChangesAsync();

            return new VisitByQrDTO
            {
                Id = visit.Id,
                Email = visit.Email,
                FirstName = visit.FirstName,
                LastName = visit.LastName,
                CheckInTime = visit.CheckInTime,
                CheckOutTime = visit.CheckOutTime
            };
        }
    }
}