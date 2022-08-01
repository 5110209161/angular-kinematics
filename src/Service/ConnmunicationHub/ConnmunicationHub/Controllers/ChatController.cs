using ConnmunicationHub.Hubs;
using ConnmunicationHub.Models;
using ConnmunicationHub.Services;
using ConnmunicationHub.Utils;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace ConnmunicationHub.Controllers
{
  [ApiController]
  [Route("api/[controller]")]
  public class ChatController : ControllerBase
  {
    private readonly IHubContext<ChatHub> _hub;
    private readonly TimerManager _timer;

    private readonly ITcpChatService _tcpChatService;

    public ChatController(IHubContext<ChatHub> hub, TimerManager timer, ITcpChatService tcpChatService)
    {
      _hub = hub;
      _timer = timer;
      _tcpChatService = tcpChatService;
    }

    [HttpPost]
    public IActionResult GetMockedJointPosition([FromBody] TcpEndpoint tcpEndpoint)
    {
      _tcpChatService.ConnectToServer(tcpEndpoint.Address, tcpEndpoint.Port);

      if (!_timer.IsTimerStarted)
        _timer.InitTimer(() =>
        {
          // get mocked joints data
          _hub.Clients.All.SendAsync("MockJointPosition", DataManager.GetMockedData());

          // connect to TCP server and send back received data to Web
          var message = _tcpChatService.GetReceivedMessage();
          _hub.Clients.All.SendAsync("TcpJointPosition", message);

          var jointPos = _tcpChatService.GetJointPosition();
          _hub.Clients.All.SendAsync("RealJointPosition", jointPos);
        });
      return Ok(new { Success = true, Message = "Request Completed" });
    }
  }
}
