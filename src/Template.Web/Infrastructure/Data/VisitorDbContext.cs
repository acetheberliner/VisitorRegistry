using Microsoft.EntityFrameworkCore;
using VisitorRegistry.Infrastructure.Entities; // o il namespace corretto della tua classe Visitor

namespace VisitorRegistry.Infrastructure.Data
{
    public class VisitorDbContext : DbContext
    {
        public VisitorDbContext(DbContextOptions<VisitorDbContext> options) : base(options) { }

        public DbSet<Visitor> Visitors { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
        }
    }
}
