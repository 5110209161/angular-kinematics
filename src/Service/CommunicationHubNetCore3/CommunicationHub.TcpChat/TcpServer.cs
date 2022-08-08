using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;

namespace CommunicationHub.TcpChat
{
  /// <summary>
  /// Used to connect, disconnect and manage TCP session
  /// </summary>
  public class TcpServer : IDisposable
  {
    #region Public Properties
    /// <summary>
    /// Server id
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// TCP server address
    /// </summary>
    public string Address { get; set; }

    /// <summary>
    /// TCP server port
    /// </summary>
    public int Port { get; set; }

    /// <summary>
    /// Endpoint
    /// </summary>
    public EndPoint EndPoint { get; set; }

    /// <summary>
    /// Number of sessions connected to the server
    /// </summary>
    public long ConnectedSessions { get { return Sessions.Count; } }

    /// <summary>
    /// Number of bytes pending sent by the server
    /// </summary>
    public long BytesPending { get { return _bytesPending; } }

    /// <summary>
    /// Number of bytes sent by the server
    /// </summary>
    public long BytesSent { get { return _bytesSent; } }

    /// <summary>
    /// Number of bytes received by the server
    /// </summary>
    public long BytesReceived { get { return _bytesReceived; } }

    /// <summary>
    /// Set the listening socket's backlog size
    /// </summary>
    public int AcceptorBacklog { get; set; } = 1024;

    /// <summary>
    /// Specifies whether the Socket is a dual-mode socket used for both IPv4 and IPv6
    /// </summary>
    public bool DualMode { get; set; }

    /// <summary>
    /// Setup SO_KEEPALIVE if the OS support this feature
    /// </summary>
    public bool KeepAlive { get; set; }

    /// <summary>
    /// Enable/disbale Nagle's algorithm for TCP protocol
    /// </summary>
    public bool NoDelay { get; set; }

    /// <summary>
    /// Enable/disable SO_REUSEADDR if the OS support
    /// </summary>
    public bool ReuseAddress { get; set; }

    /// <summary>
    /// Enable/disable SO_EXCLUSIVEADDRUSE if the OS support
    /// </summary>
    public bool ExclusiveAddressUse { get; set; }

    /// <summary>
    /// Receive buffer size
    /// </summary>
    public int ReceiveBufferSize { get; set; } = 8192;

    /// <summary>
    /// Send buffer size
    /// </summary>
    public int SendBufferSize { get; set; } = 8192;

    #endregion

    #region Private Properties

    internal long _bytesPending;
    internal long _bytesSent;
    internal long _bytesReceived;

    private Socket _acceptorSocket;
    private SocketAsyncEventArgs _acceptorEventArg;

    #endregion

    #region Start & Stop Socket

    /// <summary>
    /// Is the server started
    /// </summary>
    public bool IsStarted { get; private set; }

    /// <summary>
    /// Create a new socket object
    /// </summary>
    /// <returns></returns>
    protected virtual Socket CreateSocket()
    {
      return new Socket(EndPoint.AddressFamily, SocketType.Stream, ProtocolType.Tcp);
    }

    /// <summary>
    /// Start the server
    /// </summary>
    /// <returns></returns>
    public virtual bool Start()
    {
      if (IsStarted)
        return false;

      // Setup acceptor event arg
      _acceptorEventArg = new SocketAsyncEventArgs();
      _acceptorEventArg.Completed += OnAsyncComplete;

      // Create a new acceptor socket
      _acceptorSocket = CreateSocket();

      // Update the acceptor socket disposed flag
      IsSocketDisposed = false;

      // Apply the option
      _acceptorSocket.SetSocketOption(SocketOptionLevel.Socket, SocketOptionName.ReuseAddress, ReuseAddress);
      _acceptorSocket.SetSocketOption(SocketOptionLevel.Socket, SocketOptionName.ExclusiveAddressUse, ExclusiveAddressUse);
      if (_acceptorSocket.AddressFamily == AddressFamily.InterNetworkV6)
        _acceptorSocket.DualMode = DualMode;

      // Bind the acceptor socket to the endpoint
      _acceptorSocket.Bind(EndPoint);
      // Refresh the endpoint property based on the actual endpoint created
      EndPoint = _acceptorSocket.LocalEndPoint;

      // Call the server starting handler
      onStarting();

      // Start listen to the acceptor socket with the given accepting backlog size
      _acceptorSocket.Listen(AcceptorBacklog);

      // Reset statistic
      _bytesPending = 0;
      _bytesSent = 0;
      _bytesReceived = 0;

      // Update the started flag
      IsStarted = true;

      // Call the server started handler
      OnStarted();

      // Perform the first server accept
      IsAccepting = true;
      StartAccept(_acceptorEventArg);

      return true;
    }

    /// <summary>
    /// Stop the server
    /// </summary>
    /// <returns></returns>
    public virtual bool Stop()
    {
      if (!IsStarted)
        return false;

      // Stop accepting new clients
      IsAccepting = false;

      // Reset acceptor event arg
      _acceptorEventArg.Completed -= OnAsyncComplete;

      // Call the server stopping handler
      OnStopping();

      try
      {
        // Close the acceptor socket
        _acceptorSocket.Close();

        // Dispose the accetpor socket
        _acceptorSocket.Dispose();

        // Dispose event arguments
        _acceptorEventArg.Dispose();

        // Update the acceptor socket disposed flag
        IsSocketDisposed = true;
      }
      catch (ObjectDisposedException)
      { }

      // Disconnect all sessions
      DisconnectAll();

      // Update the Started flag
      IsStarted = false;

      // Call the server stopped handler
      OnStopped();

      return true;
    }

    /// <summary>
    /// Restart the server
    /// </summary>
    /// <returns></returns>
    public virtual bool Restart()
    {
      if (!Stop())
        return false;

      while (IsStarted)
        Thread.Yield();

      return Start();
    }

    #endregion

    #region Accepting Clients

    /// <summary>
    /// Is the server accepting new client
    /// </summary>
    public bool IsAccepting { get; private set; }

    /// <summary>
    /// Start accept a new client connection
    /// </summary>
    /// <param name="e"></param>
    private void StartAccept(SocketAsyncEventArgs e)
    {
      // Socket must be cleared since the context object is being reused
      e.AcceptSocket = null;

      if (!_acceptorSocket.AcceptAsync(e))
        ProcessAccept(e);
    }

    /// <summary>
    /// Process accepted client connection
    /// </summary>
    /// <param name="e"></param>
    private void ProcessAccept(SocketAsyncEventArgs e)
    {
      if (e.SocketError == SocketError.Success)
      {
        // Create a new session to register
        var session = CreateSession();

        // Register the session
        RegisterSession(session);

        // Connect new session
        session.Connect(e.AcceptSocket);
      }
      else
      {
        SendError(e.SocketError);
      }

      // Accept the next client connection
      if (IsAccepting)
        StartAccept(e);
    }

    /// <summary>
    /// This method is the callback method associated with Socket.AcceptAsync()
    /// operations and is invoked when an accept operation is complete
    /// </summary>
    /// <param name="sender"></param>
    /// <param name="e"></param>
    private void OnAsyncComplete(object sender, SocketAsyncEventArgs e)
    {
      if (IsSocketDisposed)
        return;

      ProcessAccept(e);
    }

    #endregion

    #region Session management

    /// <summary>
    /// Server sessions
    /// </summary>
    protected readonly ConcurrentDictionary<Guid, TcpSession> Sessions = new ConcurrentDictionary<Guid, TcpSession>();

    /// <summary>
    /// Disconnect all connected sessions
    /// </summary>
    /// <returns></returns>
    public virtual bool DisconnectAll()
    {
      if (!IsStarted)
        return false;

      // Disconnect all sessions
      foreach (var session in Sessions.Values)
        session.Disconnect();

      return true;
    }

    /// <summary>
    /// Create TCP serssion
    /// </summary>
    /// <returns></returns>
    public TcpSession CreateSession()
    {
      return new TcpSession(this);
    }

    /// <summary>
    /// Find session with given ID
    /// </summary>
    /// <param name="id"></param>
    /// <returns></returns>
    public TcpSession FindSession(Guid id)
    {
      return Sessions.TryGetValue(id, out TcpSession result) ? result : null;
    }

    /// <summary>
    /// Register a new session
    /// </summary>
    /// <param name="session"></param>
    public void RegisterSession(TcpSession session)
    {
      Sessions.TryAdd(session.Id, session);
    }

    /// <summary>
    /// Unregister session by Id
    /// </summary>
    /// <param name="id"></param>
    public void UnregisterSession(Guid id)
    {
      Sessions.TryRemove(id, out TcpSession temp);
    }

    #endregion

    #region Server Handlers

    /// <summary>
    /// Handle server starting notification
    /// </summary>
    protected virtual void onStarting() { }

    /// <summary>
    /// Handle server started notification
    /// </summary>
    protected virtual void OnStarted() { }

    /// <summary>
    /// Handle server stopping notification
    /// </summary>
    protected virtual void OnStopping() { }

    /// <summary>
    /// Handle server stopped notification
    /// </summary>
    protected virtual void OnStopped() { }

    /// <summary>
    /// Handle session connecting notification
    /// </summary>
    protected virtual void OnConnecting(TcpSession session) { }

    /// <summary>
    /// Handle session connected notification
    /// </summary>
    protected virtual void OnConnected(TcpSession session) { }

    /// <summary>
    /// Handle session disconnecting notification
    /// </summary>
    protected virtual void OnDisconnecting(TcpSession session) { }

    /// <summary>
    /// Handle session disconnected notification
    /// </summary>
    protected virtual void OnDisconnected(TcpSession session) { }

    /// <summary>
    /// Handle error notifications
    /// </summary>
    /// <param name="error"></param>
    protected virtual void OnError(SocketError error) { }

    internal void OnConnectingInternal(TcpSession session) { OnConnecting(session); }
    internal void OnConnectedInternal(TcpSession session) { OnConnected(session); }
    internal void OnDisconnectingInternal(TcpSession session) { OnDisconnecting(session); }
    internal void OnDisconnectedInternal(TcpSession session) { OnDisconnected(session); }

    #endregion

    #region Multicasting

    /// <summary>
    /// Multicast data to all connected sessions
    /// </summary>
    /// <param name="buffer"></param>
    /// <returns></returns>
    public virtual bool Multicast(byte[] buffer)
    {
      return Multicast(buffer, 0, buffer.Length);
    }

    /// <summary>
    /// Multicast data to all connected clients
    /// </summary>
    /// <param name="buffer"></param>
    /// <param name="offset"></param>
    /// <param name="size"></param>
    /// <returns></returns>
    public virtual bool Multicast(byte[] buffer, long offset, long size)
    {
      if (!IsStarted)
        return false;

      if (size == 0)
        return true;

      // multicast data to all sessions
      foreach (var session in Sessions.Values)
      {
        session.SendAsync(buffer, offset, size);
      }

      return true;
    }

    /// <summary>
    /// Multicast text to all connected clients
    /// </summary>
    /// <param name="text"></param>
    /// <returns></returns>
    public virtual bool Multicast(string text)
    {
      return Multicast(Encoding.UTF8.GetBytes(text));
    }

    #endregion

    #region Error Handling

    private void SendError(SocketError error)
    {
      // Skip disconnect error
      if (error == SocketError.ConnectionAborted || error == SocketError.ConnectionRefused ||
          error == SocketError.ConnectionReset || error == SocketError.OperationAborted ||
          error == SocketError.Shutdown)
      {
        return;
      }

      OnError(error);
    }

    #endregion

    #region IDisposable Implementation

    /// <summary>
    /// Disposed flag
    /// </summary>
    public bool IsDisposed { get; private set; }

    /// <summary>
    /// Accetpor socket disposed flag
    /// </summary>
    public bool IsSocketDisposed { get; private set; } = true;

    /// <summary>
    /// Implement IDisposable
    /// </summary>
    public void Dispose()
    {
      Dispose(true);
      GC.SuppressFinalize(this);
    }

    protected virtual void Dispose(bool disposingManagedResource)
    {
      /*
       * The idea here is that Dispose(Boolean) knows whether it is
       * being called to do explicit cleanup (the Boolean is true)
       * versus being called due to a garbage collection (the Boolean
       * is false). This distinction is useful because, when being
       * disposed explicitly, the Dispose(Boolean) method can safely
       * execute code using reference type fields that refer to other
       * objects knowing for sure that these other objects have not been
       * finalized or disposed of yet. When the Boolean is false,
       * the Dispose(Boolean) method should not execute code that
       * refer to reference type fields because those objects may
       * have already been finalized
       */

      if (!IsDisposed)
      {
        if (disposingManagedResource)
        {
          // Dispose managed resources here...
          Stop();
        }

        // Dispose unmanaged resources here...

        // Mark as disposed.
        IsDisposed = true;
      }
    }

    #endregion
  }
}
