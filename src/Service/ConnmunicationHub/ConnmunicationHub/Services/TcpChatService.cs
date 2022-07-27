using ConnmunicationHub.TcpChat;

namespace ConnmunicationHub.Services
{
  public class TcpChatService : ITcpChatService
  {
    public string ReceivedMessage { get; private set; }

    public void ConnectToServer(string address, int port)
    {
      // create a new TCP chat client
      var client = new TcpChatClient(address, port);

      // build connection
      client.ConnectAsync();

      new Thread(() =>
      {
        Thread.CurrentThread.IsBackground = true;
        for (; ; )
        {
          if (client.ReceivedMessage == "quit" || client.ReceivedMessage == "Q")
            client.DisconnectAndStop();

          ReceivedMessage = client.ReceivedMessage;
        }
        //try
        //{
        //  for (; ; )
        //  {
        //    if (client.ReceivedMessage == "quit" || client.ReceivedMessage == "Q")
        //      client.DisconnectAndStop();

        //    ReceivedMessage = client.ReceivedMessage;
        //  }
        //}
        //catch (Exception e)
        //{
        //  Console.WriteLine("Exception: {0}", e);
        //  client.DisconnectAndStop();
        //}
      }).Start();

    }

    public string GetReceivedMessage()
    {
      Console.WriteLine("received mes: " + ReceivedMessage);
      return ReceivedMessage;
    }
  }
}
