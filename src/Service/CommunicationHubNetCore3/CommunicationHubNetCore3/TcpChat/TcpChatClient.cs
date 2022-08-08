using CommunicationHubNetCore3.Models;
using System;
using System.Linq;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using TcpClient = CommunicationHub.TcpChat.TcpClient;

namespace CommunicationHubNetCore3.TcpChat
{
  public class TcpChatClient : TcpClient
  {
    private bool _stop;

    public string ReceivedMessage { get; private set; }
    public Joints JointPosition { get; private set; }

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

      var hexBytes = buffer.Skip((int)offset).Take((int)size).ToArray();
      var hexStr = BitConverter.ToString(hexBytes).Replace("-", "");
      JointPosition = GetJointPosition(hexStr);
      ReceivedMessage = hexStr;
    }

    protected override void OnError(SocketError error)
    {
      Console.WriteLine($"Chat TCP client caught an error with code {error}");
    }

    /// <summary>
    /// Substract string to get joint position
    /// Each joint position taks 32 bits, convert to hex string, each character takes 4 bits, so set 8 as length 
    /// </summary>
    /// <param name="hexStr"></param>
    /// <returns></returns>
    private Joints GetJointPosition(string hexStr)
    {
      Joints result = new Joints();

      var joint1Str = hexStr.Substring(0, 8);
      result.Joint1 = HexToFloat(joint1Str);
      var joint2Str = hexStr.Substring(8, 8);
      result.Joint2 = HexToFloat(joint2Str);
      var joint3Str = hexStr.Substring(16, 8);
      result.Joint3 = HexToFloat(joint3Str);
      var joint4Str = hexStr.Substring(24, 8);
      result.Joint4 = HexToFloat(joint4Str);
      var joint5Str = hexStr.Substring(32, 8);
      result.Joint5 = HexToFloat(joint5Str);
      var joint6Str = hexStr.Substring(40, 8);
      result.Joint6 = HexToFloat(joint6Str);

      return result;
    }

    /// <summary>
    /// Convert HEX string to float
    /// </summary>
    /// <param name="hexStr"></param>
    /// Sample: 3F8CCCCD => 1.1
    /// <returns></returns>
    private float HexToFloat(string hexStr)
    {
      uint num = uint.Parse(hexStr, System.Globalization.NumberStyles.AllowHexSpecifier);
      byte[] floatVal = BitConverter.GetBytes(num);
      float floatValue = BitConverter.ToSingle(floatVal, 0);
      return floatValue;
    }
  }
}
