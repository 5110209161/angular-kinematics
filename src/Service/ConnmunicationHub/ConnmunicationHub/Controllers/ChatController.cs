using ConnmunicationHub.Hubs;
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

    public ChatController(IHubContext<ChatHub> hub, TimerManager timer)
    {
      _hub = hub;
      _timer = timer;
    }

    [HttpGet]
    public IActionResult GetMockedJointPosition()
    {
      if (!_timer.IsTimerStarted)
        _timer.InitTimer(() => _hub.Clients.All.SendAsync("MockJointPosition", DataManager.GetMockedData()));
      return Ok(new { Success = true, Message = "Request Completed" });
    }
  }
}
