using ConnmunicationHub.Hubs;
using ConnmunicationHub.Utils;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace ConnmunicationHub.Controllers
{
  [ApiController]
  [Route("api/[controller]")]
  public class ChartController : ControllerBase
  {
    private readonly IHubContext<ChartHub> _hub;
    private readonly TimerManager _timer;

    public ChartController(IHubContext<ChartHub> hub, TimerManager timer)
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
