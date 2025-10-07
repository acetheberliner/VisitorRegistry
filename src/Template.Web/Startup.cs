using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Razor;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System.Globalization;
using System.IO;
using System.Linq;
using Template.Services;
using Template.Web.Infrastructure;
using Template.Web.SignalR.Hubs;

namespace Template.Web
{
    public class Startup
    {
        public IConfiguration Configuration { get; }
        public IWebHostEnvironment Env { get; set; }

        public Startup(IConfiguration configuration, IWebHostEnvironment env)
        {
            Env = env;
            Configuration = configuration;
        }

        public void ConfigureServices(IServiceCollection services)
        {
            services.Configure<AppSettings>(Configuration.GetSection("AppSettings"));

            // Configure DB: prefer SQLite file by default (persistent across restarts).
            var sqlite = Configuration.GetConnectionString("Sqlite");
            if (string.IsNullOrWhiteSpace(sqlite))
            {
                // default file-based sqlite DB in the application folder (use ContentRootPath to make it absolute)
                var dbPath = Path.Combine(Env.ContentRootPath ?? Directory.GetCurrentDirectory(), "visitorregistry.db");
                sqlite = $"Data Source={dbPath}";
            }

            services.AddDbContext<TemplateDbContext>(options => options.UseSqlite(sqlite));

            // services.AddDbContext<VisitorDbContext>(options =>
            // {
            //     options.UseSqlite("Data Source=visitors.db");
            // });

            // Authentication
            services.AddSession();
            services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(options =>
            {
                options.LoginPath = "/Login/Login";
                options.LogoutPath = "/Login/Logout";
            });

            // MVC + Razor Pages + Localizzazione
            var builder = services.AddMvc()
                .AddViewLocalization(LanguageViewLocationExpanderFormat.Suffix)
                .AddDataAnnotationsLocalization(options =>
                {
                    options.DataAnnotationLocalizerProvider = (type, factory) =>
                        factory.Create(typeof(SharedResource));
                });

#if DEBUG
            builder.AddRazorRuntimeCompilation();
#endif

            services.Configure<RazorViewEngineOptions>(options =>
            {
                options.AreaViewLocationFormats.Clear();
                options.AreaViewLocationFormats.Add("/Areas/{2}/{1}/{0}.cshtml");
                options.AreaViewLocationFormats.Add("/Areas/{2}/Views/{1}/{0}.cshtml");
                options.AreaViewLocationFormats.Add("/Areas/{2}/Views/Shared/{0}.cshtml");
                options.AreaViewLocationFormats.Add("/Views/Shared/{0}.cshtml");

                options.ViewLocationFormats.Clear();
                options.ViewLocationFormats.Add("/Features/{1}/{0}.cshtml");
                options.ViewLocationFormats.Add("/Features/Views/{1}/{0}.cshtml");
                options.ViewLocationFormats.Add("/Features/Views/Shared/{0}.cshtml");
                options.ViewLocationFormats.Add("/Views/Shared/{0}.cshtml");
            });

            services.AddSignalR();
            services.AddRazorPages();

            // Contenitore custom
            Container.RegisterTypes(services);
        }

        public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
        {
            // Ensure DB created and seeded
            using (var scope = app.ApplicationServices.CreateScope())
            {
                var db = scope.ServiceProvider.GetService(typeof(TemplateDbContext)) as TemplateDbContext;
                try
                {
                    db.Database.EnsureCreated();
                    Template.Infrastructure.DataGenerator.InitializeUsers(db);
                }
                catch
                {
                    // ignore seeding errors for now
                }
            }

            // Configure the HTTP request pipeline.
            if (!env.IsDevelopment())
            {
                app.UseExceptionHandler("/Home/Error");
                app.UseHsts();
                app.UseHttpsRedirection();
            }

            app.UseRequestLocalization(SupportedCultures.CultureNames);

            app.UseRouting();

            app.UseSession();
            app.UseAuthentication();
            app.UseAuthorization();

            // Static files da node_modules + Areas
            var node_modules = new CompositePhysicalFileProvider(Directory.GetCurrentDirectory(), "node_modules");
            var areas = new CompositePhysicalFileProvider(Directory.GetCurrentDirectory(), "Areas");
            var compositeFp = new CustomCompositeFileProvider(env.WebRootFileProvider, node_modules, areas);
            env.WebRootFileProvider = compositeFp;
            app.UseStaticFiles();

            app.UseEndpoints(endpoints =>
            {
                // SignalR Hubs
                endpoints.MapHub<VisitorHub>("/visitorHub");
                endpoints.MapHub<TemplateHub>("/templateHub");

                endpoints.MapAreaControllerRoute("Example", "Example", "Example/{controller=Users}/{action=Index}/{id?}");
                endpoints.MapControllerRoute(name: "default", pattern: "{controller=Reception}/{action=Index}/{id?}");
                endpoints.MapControllers();
            });
        }
    }

    public static class SupportedCultures
    {
        public static readonly string[] CultureNames = new[] { "it-it" };
        public static readonly CultureInfo[] Cultures = CultureNames.Select(c => new CultureInfo(c)).ToArray();
    }
}
