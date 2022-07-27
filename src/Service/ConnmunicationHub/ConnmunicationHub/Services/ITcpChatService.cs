namespace ConnmunicationHub.Services
{
  public interface ITcpChatService
  {
    void ConnectToServer(string address, int port);

    string GetReceivedMessage();
  }
}
