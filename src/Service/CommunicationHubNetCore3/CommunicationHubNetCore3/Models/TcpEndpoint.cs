namespace CommunicationHubNetCore3.Models
{
  public class TcpEndpoint
  {
    public string Address { get; set; } = "127.0.0.1";

    public int Port { get; set; } = 50000;
  }
}
