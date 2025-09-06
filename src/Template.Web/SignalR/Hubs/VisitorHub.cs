using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;

namespace Template.Web.SignalR.Hubs
{
    public class VisitorHub : Hub
    {
        // Metodo che può essere chiamato lato client se serve
        public async Task NotifyUpdate()
        {
            await Clients.All.SendAsync("VisitorListUpdated");
        }
    }
}
