using Microsoft.EntityFrameworkCore;
using Template.Services.Shared;

namespace Template.Services
{
    public class TemplateDbContext : DbContext
    {
        public TemplateDbContext()
        {
        }

        public TemplateDbContext(DbContextOptions<TemplateDbContext> options) : base(options)
        {
            // Seeding is performed at application startup (Startup.Configure) after EnsureCreated()
        }

        public DbSet<User> Users { get; set; }
        public DbSet<Template.Services.Shared.VisitRecord> VisitRecords { get; set; }
    }
}
