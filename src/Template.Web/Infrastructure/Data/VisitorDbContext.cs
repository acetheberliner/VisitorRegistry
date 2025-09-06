using System;
using Microsoft.EntityFrameworkCore;
using VisitorRegistry.Infrastructure.Entities; // o il namespace corretto della tua classe Visitor

namespace VisitorRegistry.Infrastructure.Data
{
    public class VisitorDbContext : DbContext
    {
        public DbSet<Visitor> Visitors { get; set; }

        public VisitorDbContext(DbContextOptions<VisitorDbContext> options) : base(options)
        {
            var conn = (Database.GetDbConnection() as Microsoft.Data.Sqlite.SqliteConnection);
            Console.WriteLine($"➡️ SQLite path: {conn?.DataSource}");
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
        }
    }

}
