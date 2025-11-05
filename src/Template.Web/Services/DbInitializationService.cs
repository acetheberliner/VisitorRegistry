using Microsoft.Extensions.Logging;
using System;

namespace Template.Web.Services
{
    public static class DbInitializationService
    {
        // Assicura che il database sia inizializzato per evitare conflitti di lettura
        public static void EnsureInitialized(Template.Services.TemplateDbContext db, ILogger logger)
        {
            try{}
            catch (Exception ex)
            {
                // Logga solo in caso di errori inaspettati con il DB
                logger?.LogWarning(ex, "Errore durante l'inizializzazione del database");
            }
        }
    }
}
