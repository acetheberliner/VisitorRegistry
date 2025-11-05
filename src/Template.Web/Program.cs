using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Template.Web
{
    // Classe per l'avvio dell'applicazione web
    public class Program
    {
        public static void Main(string[] args)
        {
            var hostBuilder = CreateHostBuilder(args)
                .ConfigureLogging(logging =>
                {
                    // Pulisce i log predefiniti e aggiunge il log su console
                    logging.ClearProviders();
                    logging.AddConsole();

                    // Imposta il livello minimo di log globale a Warning
                    logging.SetMinimumLevel(LogLevel.Warning);

                    // Permette i log di Template.Web a livello Info
                    logging.AddFilter("Template.Web", LogLevel.Information);

                    // Assicura che i log di EF e Microsoft siano a livello Warning o superiore
                    logging.AddFilter("Microsoft", LogLevel.Warning);
                    logging.AddFilter("Microsoft.EntityFrameworkCore", LogLevel.Warning);
                });

            var host = hostBuilder.Build();

            // Avvia l'applicazione
            host.Start();

            // Logga gli indirizzi di ascolto una volta
            var logger = host.Services.GetService(typeof(ILogger<Program>)) as ILogger;
            var serverAddresses = host.Services.GetService(typeof(Microsoft.AspNetCore.Hosting.Server.Features.IServerAddressesFeature)) as Microsoft.AspNetCore.Hosting.Server.Features.IServerAddressesFeature;
            if (logger != null && serverAddresses != null)
            {
                foreach (var address in serverAddresses.Addresses)
                {
                    logger.LogInformation("Applicazione in ascolto su: {address}", address);
                }
            }

            // Attendi la chiusura
            host.WaitForShutdown();
        }

        public static IHostBuilder CreateHostBuilder(string[] args) =>
            Host.CreateDefaultBuilder(args).ConfigureWebHostDefaults(webBuilder =>
                {
                    webBuilder.UseStartup<Startup>();
                }
            );
    }
}