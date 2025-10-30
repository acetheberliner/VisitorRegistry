using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using Template.Services; // <--- aggiunto: TemplateDbContext

namespace Template.Web.Services
{
    // Servizio per l'inizializzazione del database
	public static class DbInitializationService
	{
		public static void EnsureInitialized(TemplateDbContext db, ILogger logger)
		{
			try
			{
				var conn = db.Database.GetDbConnection();
				if (conn.State != System.Data.ConnectionState.Open) conn.Open();

				using (var cmd = conn.CreateCommand())
				{
					cmd.CommandText = "PRAGMA table_info('VisitRecords')";
					using var reader = cmd.ExecuteReader();
					bool hasEmailNorm = false;
					while (reader.Read())
					{
						var colName = reader["name"]?.ToString();
						if (string.Equals(colName, "EmailNorm", StringComparison.OrdinalIgnoreCase))
						{
							hasEmailNorm = true;
							break;
						}
					}

					if (!hasEmailNorm)
					{
						try { db.Database.ExecuteSqlRaw("ALTER TABLE VisitRecords ADD COLUMN EmailNorm TEXT"); logger?.LogInformation("Aggiunta colonna EmailNorm"); }
						catch (Exception ex) { logger?.LogWarning(ex, "Aggiunta colonna EmailNorm fallita (continua senza vincolo DB)"); }
					}

					try { db.Database.ExecuteSqlRaw("UPDATE VisitRecords SET EmailNorm = LOWER(Email) WHERE Email IS NOT NULL"); }
					catch (Exception ex) { logger?.LogDebug(ex, "Popolamento EmailNorm non eseguito (ignoro)"); }

					cmd.CommandText = "PRAGMA index_list('VisitRecords')";
					using var idxReader = cmd.ExecuteReader();
					bool hasIndex = false;
					while (idxReader.Read())
					{
						var idxName = idxReader["name"]?.ToString();
						if (string.Equals(idxName, "IX_VisitRecords_EmailNorm_Open", StringComparison.OrdinalIgnoreCase))
						{
							hasIndex = true;
							break;
						}
					}

					if (!hasIndex)
					{
						try { db.Database.ExecuteSqlRaw("CREATE UNIQUE INDEX IF NOT EXISTS IX_VisitRecords_EmailNorm_Open ON VisitRecords (EmailNorm) WHERE CheckOutTime IS NULL AND EmailNorm IS NOT NULL"); logger?.LogInformation("Creato indice IX_VisitRecords_EmailNorm_Open"); }
						catch (Exception ex) { logger?.LogWarning(ex, "Creazione indice EmailNorm fallita (continua senza vincolo DB)"); }
					}
				}

				if (conn.State == System.Data.ConnectionState.Open) conn.Close();
			}
			catch (Exception ex)
			{
				logger?.LogWarning(ex, "Controllo iniziale DB per EmailNorm/indice fallito (continua comunque)");
			}
		}
	}
}
