using CommunicationHubNetCore3.Models;

namespace CommunicationHubNetCore3.Services
{
  public interface ITcpChatService
  {
    void ConnectToServer(string address, int port);

    string GetReceivedMessage();

    Joints GetJointPosition();
  }
}
