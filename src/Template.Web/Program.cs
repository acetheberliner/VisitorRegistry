using System;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;

namespace Template.Web
{
    // Classe per l'avvio dell'applicazione web
    public class Program
    {
        public static void Main(string[] args)
        {
            // Messaggio immediato all'avvio (visibile anche se il logging è filtrato)
            Console.WriteLine("Avvio applicazione...");
            // divisore visivo obbligatorio
            Console.WriteLine(new string('-', 91));
            Console.Out.Flush();

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

            // Avvia l'host in modo che siano disponibili gli indirizzi di ascolto
            host.Start();

            // Stampa esplicita degli indirizzi di ascolto (visibile sempre anche se i log sono filtrati)
            try
            {
                // 1) Prova IServerAddressesFeature (DI)
                var serverAddresses = host.Services.GetService(typeof(IServerAddressesFeature)) as IServerAddressesFeature;
                if (serverAddresses != null && serverAddresses.Addresses != null && serverAddresses.Addresses.Count > 0)
                {
                    foreach (var address in serverAddresses.Addresses)
                        Console.WriteLine($"- Applicazione in ascolto su: {address}");                    
                }
                else
                {
                    // 2) Prova a ottenere la feature dall'IServer (se presente)
                    var server = host.Services.GetService(typeof(IServer)) as IServer;
                    var feat = server?.Features.Get<IServerAddressesFeature>();
                    if (feat != null && feat.Addresses != null && feat.Addresses.Count > 0)
                    {
                        foreach (var address in feat.Addresses) Console.WriteLine($"Applicazione in ascolto su: {address}");
                    }
                    else
                    {
                        // 3) Fallback: leggi configurazione / variabile d'ambiente
                        var config = host.Services.GetService(typeof(IConfiguration)) as IConfiguration;
                        var cfgUrls = config?.GetValue<string>("urls") ?? config?.GetValue<string>("ASPNETCORE_URLS");
                        var envUrls = string.IsNullOrWhiteSpace(cfgUrls) ? Environment.GetEnvironmentVariable("ASPNETCORE_URLS") : cfgUrls;
                        if (!string.IsNullOrWhiteSpace(envUrls))
                        {
                            var parts = envUrls.Split(new[] { ';' }, StringSplitOptions.RemoveEmptyEntries);
                            foreach (var p in parts) Console.WriteLine($"Applicazione in ascolto su: {p.Trim()}");
                        }
                        else
                        {
                            Console.WriteLine("Nessun indirizzo di ascolto rilevato automaticamente. Controlla Properties/launchSettings.json o la variabile ASPNETCORE_URLS.");
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("Impossibile determinare l'URL di ascolto: " + ex.Message);
            }

            // divisore dopo print degli indirizzi
            Console.WriteLine(new string('-', 91));
            Console.Out.Flush();

            // Attende la terminazione (equivalente a host.Run)
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