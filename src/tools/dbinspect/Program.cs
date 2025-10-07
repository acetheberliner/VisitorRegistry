using Microsoft.Data.Sqlite;
using System;
using System.IO;

var dbPath = Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "..", "Template.Web", "visitorregistry.db");
if (!File.Exists(dbPath))
{
    Console.WriteLine($"DB not found at {dbPath}");
    return 1;
}

using var conn = new SqliteConnection($"Data Source={dbPath}");
conn.Open();

var cmd = conn.CreateCommand();
cmd.CommandText = @"SELECT Id, QrKey, Email, FirstName, LastName, CheckInTime, CheckOutTime FROM VisitRecords ORDER BY CheckInTime DESC LIMIT 10;";
using var reader = cmd.ExecuteReader();
Console.WriteLine("Latest visit records:");
int c = 0;
while (reader.Read())
{
    c++;
    Console.WriteLine($"{reader.GetGuid(0)} | {reader.GetString(1)} | {reader.GetString(2)} | {reader.GetString(3)} {reader.GetString(4)} | {reader.GetDateTime(5)} | { (reader.IsDBNull(6) ? "(null)" : reader.GetDateTime(6).ToString()) }");
}
if (c==0) Console.WriteLine("(no rows)");
return 0;