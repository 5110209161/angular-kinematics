using System.Net.Sockets;
using System.Text;
using TcpClient = CommunicationHub.TcpChat.TcpClient;

namespace ConnmunicationHub.TcpChat
{
  public class TcpChatClient : TcpClient  
  {
    private bool _stop;

    public string ReceivedMessage { get; private set; }

    public TcpChatClient(string address, int port) : base(address, port) { }

    public void DisconnectAndStop()
    {
      _stop = true;
      DisconnectAsync();
      while (IsConnected)
        Thread.Yield();
    }

    protected override void OnConnected()
    {
      Console.WriteLine($"Chat TCP client connected a new session with Id {Id}");
    }

    protected override void OnDisconnected()
    {
      Console.WriteLine($"Chat TCP client disconnected a session with Id {Id}");

      // Wait for a while...
      Thread.Sleep(1000);

      // Try to connect again
      if (!_stop)
        ConnectAsync();
    }

    protected override void OnReceived(byte[] buffer, long offset, long size)
    {
      Console.WriteLine(Encoding.UTF8.GetString(buffer, (int)offset, (int)size));
      ReceivedMessage = Encoding.UTF8.GetString(buffer, (int)offset, (int)size);
    }

    protected override void OnError(SocketError error)
    {
      Console.WriteLine($"Chat TCP client caught an error with code {error}");
    }
  }
}
