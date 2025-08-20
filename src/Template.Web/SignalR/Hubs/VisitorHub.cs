using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;

namespace Template.Web.SignalR.Hubs
{
    public class VisitorHub : Hub
    {
        public async Task NotifyVisitorUpdated()
        {
            await Clients.All.SendAsync("ReceiveVisitorUpdate");
        }
    }
}
