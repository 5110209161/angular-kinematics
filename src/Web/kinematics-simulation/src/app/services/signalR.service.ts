import { Injectable } from '@angular/core';

import * as signalR from '@microsoft/signalr';
import { JointsModel } from '../models/joints.model';

@Injectable({
  providedIn: 'root'
})
export class SignalRService {

  private hubConnection: signalR.HubConnection;
  private connectionId: string;

  public mockedJointPosition: JointsModel;
  public mockMessage: string;
  public realJointPosition: JointsModel;

  constructor() { }

  startConnection(url: string): void {
    this.hubConnection = new signalR.HubConnectionBuilder()
                            .withUrl(url, { withCredentials: false })
                            .withAutomaticReconnect()
                            .configureLogging(signalR.LogLevel.Information)
                            .build();
    this.hubConnection.start()
                      .then(() => console.log('Connection started'))
                      //.then(() => this.getConnectionId())
                      .catch(err => console.log('Error while starting connection: ' + err));
                      
  }

  stopConnection(): void {
    console.log('Connection stopped!');
    this.hubConnection.stop();
  }

  closeConnection(): void {
    this.hubConnection.onclose(() => {
      console.log('Connection closed!');
    });
  }

  addHubListener(): void {
    this.getMockedJointPosition();
    this.getTcpJointPosition();
    this.getJointPosition();
  }

  private getConnectionId(): void {
    this.hubConnection.invoke('GetConnectionId').then(
      (data) => { this.connectionId = data; }
    );
  }

  private getMockedJointPosition(): void  {
    this.hubConnection.on('MockJointPosition', (data: JointsModel) => {
      this.mockedJointPosition = data;
    });
  }

  private getTcpJointPosition(): void  {
    this.hubConnection.on('TcpJointPosition', (data: string) => {
      this.mockMessage = data;
    });
  }

  private getJointPosition(): void {
    this.hubConnection.on('RealJointPosition', (data: JointsModel) => {
      this.realJointPosition = data;
    });
  }
}
