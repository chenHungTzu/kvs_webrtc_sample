import { Component, ElementRef, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Role, SignalingClient } from 'amazon-kinesis-video-streams-webrtc';
import { environment } from '../environments/environment';
import AWS from 'aws-sdk';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {

  @ViewChild("localView", { static: true }) localView: ElementRef = new ElementRef(null);
  @ViewChild("remoteView", { static: true }) remoteView: ElementRef = new ElementRef(null);

  title = 'webrtc';

  async onclickViewer() {

    const channelARN = environment.channelarn;
    console.log('channelARN :', channelARN)
    const accessKeyId = environment.accesskeyId;
    console.log('accessKeyId :', accessKeyId)
    const secretAccessKey = environment.secretId;
    console.log('secretAccessKey :', secretAccessKey)
    const sessionToken = environment.session_token;
    console.log('sessionToken :', sessionToken)
    const region = environment.region;
    console.log('region :', region)
    const clientId = Math.floor(Math.random() * 999999).toString();


    const kinesisVideoClient = new AWS.KinesisVideo({
      region,
      accessKeyId,
      secretAccessKey,
      sessionToken,
      correctClockSkew: true,
      apiVersion: 'latest'
    });

    const endpoint = await kinesisVideoClient.getSignalingChannelEndpoint({
      ChannelARN: channelARN,
      SingleMasterChannelEndpointConfiguration: {
        Protocols: ['WSS', 'HTTPS'],
        Role: Role.VIEWER,
      },
    }).promise().then((data) => data);

    const httpsEndpoint = endpoint.ResourceEndpointList?.find(x => x.Protocol === 'HTTPS')?.ResourceEndpoint;
    const wssEndpoint = endpoint.ResourceEndpointList?.find(x => x.Protocol === 'WSS')?.ResourceEndpoint;


    const kinesisVideoSignalingChannelsClient = new AWS.KinesisVideoSignalingChannels({
      region,
      accessKeyId,
      secretAccessKey,
      sessionToken,
      endpoint: httpsEndpoint,
      correctClockSkew: true,
    });

    const getIceServerConfigResponse = await kinesisVideoSignalingChannelsClient
      .getIceServerConfig({
        ChannelARN: channelARN,
      })
      .promise();

    const iceServers: RTCIceServer[] = [{ urls: `stun:stun.kinesisvideo.${region}.amazonaws.com:443` }];


    getIceServerConfigResponse.IceServerList?.forEach(iceServer =>
      iceServers.push({
        urls: iceServer.Uris as string[] | string,
        username: iceServer.Username,
        credential: iceServer.Password,
      }),
    );

    const peerConnection = new RTCPeerConnection({ iceServers });

    const signalingClient = new SignalingClient({
      channelARN,
      channelEndpoint: wssEndpoint as string,
      role: Role.VIEWER,
      clientId,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
        sessionToken
      },
      systemClockOffset: kinesisVideoClient.config.systemClockOffset,
    });


    signalingClient.on('open', async () => {

        const localStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
        this.localView.nativeElement.srcObject = localStream;

        await peerConnection.setLocalDescription(
          await peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          }),
        );

        console.warn('[viewer] send sdp offer')
        signalingClient.sendSdpOffer(peerConnection.localDescription as RTCSessionDescription);

    });


    signalingClient.on('sdpAnswer', async answer => {
      console.warn('[viewer] get sdp answer')
      await peerConnection.setRemoteDescription(answer);

    });


    signalingClient.on('iceCandidate', candidate => {
      console.warn('[viewer] get iceCandidate')
      peerConnection.addIceCandidate(candidate);
    });

    signalingClient.on('close', () => {
      console.log('close');
    });

    signalingClient.on('error', error => {
      console.log('error', error);
    });

    peerConnection.addEventListener('icecandidate', ({ candidate }) => {
      if (candidate) {
        console.warn('[viewer] send iceCandidate')
        signalingClient.sendIceCandidate(candidate);
      } else {
        console.log('No more ICE candidates will be generated')
      }
    });


    peerConnection.addEventListener('track', event => {
      this.remoteView.nativeElement.srcObject = event.streams[0];
    });

    signalingClient.open();

  }


  async onclickMaster() {

    // 建立臨時憑證，請參閱語法
    const channelARN = environment.channelarn;
    console.log('channelARN :', channelARN)
    const accessKeyId = environment.accesskeyId;
    console.log('accessKeyId :', accessKeyId)
    const secretAccessKey = environment.secretId;
    console.log('secretAccessKey :', secretAccessKey)
    const sessionToken = environment.session_token;
    console.log('sessionToken :', sessionToken)
    const region = environment.region;
    console.log('region :', region)


    // 用於儲存vierwe的ID
    let remoteId = '';


    const kinesisVideoClient = new AWS.KinesisVideo({
      region,
      accessKeyId,
      secretAccessKey,
      sessionToken,
      correctClockSkew: true,
      apiVersion: 'latest'
    });

    // 取得信號通道的服務端點。
    // wss 的端點作為Signaling Server。
    // https 的端點， 主要是透過服務去取得 ICE Server。
    const endpoints = await kinesisVideoClient.getSignalingChannelEndpoint({
        ChannelARN: channelARN,
        SingleMasterChannelEndpointConfiguration: {
          Protocols: ['WSS', 'HTTPS'],
          Role: Role.MASTER,
        },
      })
      .promise().then((data) => data);

    const httpsEndpoint = endpoints.ResourceEndpointList?.find(x => x.Protocol === 'HTTPS')?.ResourceEndpoint;
    const wssEndpoint = endpoints.ResourceEndpointList?.find(x => x.Protocol === 'WSS')?.ResourceEndpoint;

    const kinesisVideoSignalingChannelsClient = new AWS.KinesisVideoSignalingChannels({
      region,
      accessKeyId,
      secretAccessKey,
      sessionToken,
      endpoint: httpsEndpoint,
      correctClockSkew: true,
    });

    // 取得 ICE Server ，包含了 TURN server endpoint
    const getIceServerConfigResponse = await kinesisVideoSignalingChannelsClient
      .getIceServerConfig({
        ChannelARN: channelARN,
      })
      .promise();

    //  AWS 公有的 STUN server endpoint
    const iceServers: RTCIceServer[] = [{ urls: `stun:stun.kinesisvideo.${region}.amazonaws.com:443` }];

    getIceServerConfigResponse.IceServerList?.forEach(iceServer =>
      iceServers.push({
        urls: iceServer.Uris as string[] | string,
        username: iceServer.Username,
        credential: iceServer.Password,
      }),
    );


    // 建立 RTCPeerConnection，並且設定 ICE server
    // iceTransportPolicy : 'all' 表示會使用所有類型 (STUN/TURN) ICE server
    const peerConnection = new RTCPeerConnection({ iceServers, iceTransportPolicy: 'all' });


    // 準備用於傳送 SDP / ICE 候選訊息
    const signalingClient = new SignalingClient({
      channelARN,
      channelEndpoint: wssEndpoint as string,
      role: Role.MASTER,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
        sessionToken
      },
      systemClockOffset: kinesisVideoClient.config.systemClockOffset,
    });


    signalingClient.on('open', async () => {

        // 為了呈現用，這邊只取得本地的媒體資料，並且顯示在 localView
        // 如果是用瀏覽器執行到這行，理論上會發起詢問是否允許取得媒體資料的視窗。
        const localStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });

        // 將本地的媒體資料流加入到 RTCPeerConnection，進行共享
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
        this.localView.nativeElement.srcObject = localStream;

    });


    signalingClient.on('sdpOffer', async (offer, remoteClientId) => {
      console.warn('[master] get sdp offer')
      remoteId = remoteClientId;
      await peerConnection.setRemoteDescription(offer);

      await peerConnection.setLocalDescription(
        await peerConnection.createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        }),
      );

      // 接到發話端的 SDP offer 後，進行 SDP answer 的回應
      // 將 SDP answer 回應給 viewer 端
      console.warn('[master] send sdp answer')
      signalingClient.sendSdpAnswer(peerConnection.localDescription as RTCSessionDescription, remoteId);
    });

    // 接收到發話端的 ICE 候選後，加入到 RTCPeerConnection進行連接
    signalingClient.on('iceCandidate', candidate => {
      console.warn('[master] get iceCandidate')
      console.log(candidate)
      peerConnection.addIceCandidate(candidate);
    });

    signalingClient.on('close', () => {
      console.log('close');
    });

    signalingClient.on('error', error => {
      console.log('error', error);
    });

    // 本地端的 RTCPeerConnection 產生 ICE 候選後，透過 signalingClient 傳送給發話端
    peerConnection.addEventListener('icecandidate', ({ candidate }) => {
      if (candidate) {
        console.warn('[master] send iceCandidate')
        console.log(candidate)
        signalingClient.sendIceCandidate(candidate, remoteId);
      } else {
        console.log('No more ICE candidates will be generated')
      }
    });

    // 當遠端的媒體資料流被接收到，加入到 remoteView 進行顯示
    peerConnection.addEventListener('track', event => {
      this.remoteView.nativeElement.srcObject = event.streams[0];
    });

    signalingClient.open();

  }


}
