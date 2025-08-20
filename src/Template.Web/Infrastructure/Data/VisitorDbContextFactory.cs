using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace VisitorRegistry.Infrastructure.Data
{
    public class VisitorDbContextFactory : IDesignTimeDbContextFactory<VisitorDbContext>
    {
        public VisitorDbContext CreateDbContext(string[] args)
        {
            var optionsBuilder = new DbContextOptionsBuilder<VisitorDbContext>();
            optionsBuilder.UseSqlite("Data Source=visitors.db");

            return new VisitorDbContext(optionsBuilder.Options);
        }
    }
}
