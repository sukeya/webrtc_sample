`use strict`;

import db from "init-firebase"

mdc.ripple.MDCRipple.attachTo(document.querySelector('.mdc-button'));

// constraints of local media.
let constraints = {
    audio: true,
    video: true
};

// configuration of ICE.
const configuration = {
  iceServers: [
    'stun:stun1.l.google.com:19302',
    'stun:stun2.l.google.com:19302'
  ],
  iceTransportPolicy: `all`,
  iceCandidatePoolSize: 10
};

// offer option of SDP.
// TODO should I remove all option of offerOptions?
// (because each offerToReceive* ensure that * can be received, regardless if audio is sent or not.)
const offerOptions = {
    offerToReceiveAudio: true,
    offerToReceiveVideo: true
};

// local media
let localStream = null;
// remote media
let remoteStream = null;
// peer connection
let pc = null;
// the time which call func is called.
let startTime;

async function start() {
  console.log('Requesting local stream');
  startButton.disabled = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('Received local stream');
    localVideo.srcObject = stream;
    localStream = stream;
    callButton.disabled = false;
  } catch (e) {
    alert(`getUserMedia() error: ${e.name}`);
  }
}

async function call() {
    callButton.disabled = true;
    hangupButton.disabled = false;
    console.log('Starting call');
    startTime = window.performance.now();
    const videoTracks = localStream.getVideoTracks();
    const audioTracks = localStream.getAudioTracks();
    if (videoTracks.length > 0) {
      console.log(`Using video device: ${videoTracks[0].label}`);
    }
    if (audioTracks.length > 0) {
      console.log(`Using audio device: ${audioTracks[0].label}`);
    }

    console.log('RTCPeerConnection configuration:', configuration);

    pc1 = new RTCPeerConnection(configuration);
    console.log('Created local peer connection object pc1');
    // If IP address or port is changed, add the ICE candidates of the other peer connection.
    pc1.onicecandidate(e => onIceCandidate(pc1, e));

    pc2 = new RTCPeerConnection(configuration);
    console.log('Created remote peer connection object pc2');
    // If IP address or port is changed, add the ICE candidates of the other peer connection.
    pc2.onicecandidate(e => onIceCandidate(pc2, e));
    // If ICE state is changed, output it to log.
    pc1.oniceconnectionstatechange(e => onIceStateChange(pc1, e));
    pc2.oniceconnectionstatechange(e => onIceStateChange(pc2, e));
    // If remote peer connection has received, output this to log.
    pc2.addEventListener('track', gotRemoteStream);
    // add local stream to local peer connection.
    localStream.getTracks().forEach(track => pc1.addTrack(track, localStream));
    console.log('Added local stream to pc1');
  
    try {
      console.log('pc1 createOffer start');
      // create SDP offer of pc1.
      const offer = await pc1.createOffer(offerOptions);
      // set local and remote session discription of each peer connection.
      await onCreateOfferSuccess(offer);
    } catch (e) {
      onCreateSessionDescriptionError(e);
    }
}

function getName(pc) {
    return (pc === pc1) ? 'pc1' : 'pc2';
}

function getOtherPc(pc) {
    return (pc === pc1) ? pc2 : pc1;
}

function gotRemoteStream(e) {
  if (remoteVideo.srcObject !== e.streams[0]) {
    remoteVideo.srcObject = e.streams[0];
    console.log('pc2 received remote stream');
  }
}

function onCreateSessionDescriptionError(error) {
  console.log(`Failed to create session description: ${error.toString()}`);
}

function onSetSessionDescriptionError(error) {
  console.log(`Failed to set session description: ${error.toString()}`);
}

function onSetLocalSuccess(pc) {
  console.log(`${getName(pc)} setLocalDescription complete`);
}

function onSetRemoteSuccess(pc) {
  console.log(`${getName(pc)} setRemoteDescription complete`);
}

async function onCreateOfferSuccess(desc) {
  console.log(`Offer from pc1\n${desc.sdp}`);
  console.log('pc1 setLocalDescription start');
  try {
    await pc1.setLocalDescription(desc);
    onSetLocalSuccess(pc1);
  } catch (e) {
    onSetSessionDescriptionError();
  }

  console.log('pc2 setRemoteDescription start');
  try {
    await pc2.setRemoteDescription(desc);
    onSetRemoteSuccess(pc2);
  } catch (e) {
    onSetSessionDescriptionError();
  }

  console.log('pc2 createAnswer start');
  // Since the 'remote' side has no media stream we need
  // to pass in the right constraints in order for it to
  // accept the incoming offer of audio and video.
  try {
    const answer = await pc2.createAnswer();
    await onCreateAnswerSuccess(answer);
  } catch (e) {
    onCreateSessionDescriptionError(e);
  }
}

async function onCreateAnswerSuccess(desc) {
  console.log(`Answer from pc2:\n${desc.sdp}`);
  console.log('pc2 setLocalDescription start');
  try {
    await pc2.setLocalDescription(desc);
    onSetLocalSuccess(pc2);
  } catch (e) {
    onSetSessionDescriptionError(e);
  }
  console.log('pc1 setRemoteDescription start');
  try {
    await pc1.setRemoteDescription(desc);
    onSetRemoteSuccess(pc1);
  } catch (e) {
    onSetSessionDescriptionError(e);
  }
}

async function onIceCandidate(pc, event) {
  try {
    await (getOtherPc(pc).addIceCandidate(event.candidate));
    onAddIceCandidateSuccess(pc);
  } catch (e) {
    onAddIceCandidateError(pc, e);
  }
  console.log(`${getName(pc)} ICE candidate:\n${event.candidate ? event.candidate.candidate : '(null)'}`);
}

function onAddIceCandidateSuccess(pc) {
  console.log(`${getName(pc)} addIceCandidate success`);
}

function onAddIceCandidateError(pc, error) {
  console.log(`${getName(pc)} failed to add ICE Candidate: ${error.toString()}`);
}

function onIceStateChange(pc, event) {
  if (pc) {
    console.log(`${getName(pc)} ICE state: ${pc.iceConnectionState}`);
    console.log('ICE state change event: ', event);
  }
}

function hangup() {
  console.log('Ending call');
  pc1.close();
  pc2.close();
  pc1 = null;
  pc2 = null;
  hangupButton.disabled = true;
  callButton.disabled = false;
}


callButton.disabled = true;
hangupButton.disabled = true;

startButton.addEventListener('click', start);
callButton.addEventListener('click', call);
hangupButton.addEventListener('click', hangup);

localVideo.addEventListener('loadedmetadata', function() {
    console.log(`Local video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`);
});

remoteVideo.addEventListener('loadedmetadata', function() {
    console.log(`Remote video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`);
});

remoteVideo.addEventListener('resize', () => {
    console.log(`Remote video size changed to ${remoteVideo.videoWidth}x${remoteVideo.videoHeight} - Time since pageload ${performance.now().toFixed(0)}ms`);
    // We'll use the first onsize callback as an indication that video has started
    // playing out.
    if (startTime) {
        const elapsedTime = window.performance.now() - startTime;
        console.log('Setup time: ' + elapsedTime.toFixed(3) + 'ms');
        startTime = null;
    }
});
