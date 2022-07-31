`use strict`;

import { ref, set, get, push, remove } from "firebase/database";
import { signInWithEmailAndPassword } from "firebase/auth";
import { db, auth } from "./init-firebase"

import { v4 as uuidv4 } from "uuid";
import adapter from 'webrtc-adapter';
import { MDCRipple } from '@material/ripple';
import { MDCDialog } from '@material/dialog';

const ripple = new MDCRipple(document.querySelector('.mdc-button'));

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

// local media
let localStream = null;
// remote media
let remoteStream = null;
// peer connection
let peerConnection = null;
let roomDialog = null;
let roomId = null;

function UserException(message) {
  this.message = message;
  this.name = 'UserException';
}

function init() {
  document.querySelector('#cameraBtn').addEventListener('click', openUserMedia);
  document.querySelector('#hangupBtn').addEventListener('click', hangUp);
  document.querySelector('#createBtn').addEventListener('click', createRoom);
  document.querySelector('#joinBtn').addEventListener('click', joinRoom);
  roomDialog = new MDCDialog(document.querySelector('#room-dialog'));
}

async function createRoom() {
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = true;

  console.log('Create PeerConnection with configuration: ', configuration);
  peerConnection = new RTCPeerConnection(configuration);

  registerPeerConnectionListeners();

  // creat a room
  const uid = await authenticate();
  const roomId = uuidv4();
  await set(push(ref(db, "rooms/" + roomId)), uid);
  document.querySelector('#currentRoom').innerText = `Current room is ${roomId} - You are the caller!`

  // create a offer
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  await set(ref(db, "offers/" + uid), {
    type: offer.type,
    sdp: offer.sdp
  });

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // upload my ICE candidates.
  peerConnection.onicecandidate = e => onIceCandidate(uid, e);

  // watch another user entered in the room.
  let peerUID = null;
  await onChildAdded(ref(db, "rooms/" + roomId), (data) => {
    // TODO If there are users more than 2 in a room, how should I connect each user?
    peerUID = data.val();
  });

  peerConnection.addEventListener('track', event => {
    console.log('Got remote track:', event.streams[0]);
    event.streams[0].getTracks().forEach(track => {
      console.log('Add a track to the remoteStream:', track);
      remoteStream.addTrack(track);
    });
  });

  // Listening for remote session description.
  await get(ref(db, "offers/" + peerUID), (snapshot) => {
    peerConnection.setRemoteDescription(snapshot.val());
  });

  // Listen for remote ICE candidates
  // TODO should I do `get` before watching whether a child is added.
  await onChildAdded(ref(db, "candidates/" + peerUID), (data) => {
    peerConnection.addIceCandidate(data.val());
  });
}

function joinRoom() {
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = true;

  document.querySelector('#confirmJoinBtn').
    addEventListener('click', async () => {
      roomId = document.querySelector('#joinRoomId').value;
      console.log('Join room: ', roomId);
      document.querySelector(
        '#currentRoom').innerText = `Current room is ${roomId} - You are the callee!`;
      await joinRoomById(roomId);
    }, { once: true });
  roomDialog.open();
}

async function joinRoomById(roomId) {
  let peerUID = null;
  await get(ref(db, "rooms/" + roomId), (snapshot) => {
    if (snapshot.exists()) {
      let data = snapshot.val();
      if (data.length >= 1) {
        peerUID = data[0];
      }
    }
  });

  if (!peerUID) {
    await remove(ref(db, "rooms/" + roomId));
    throw UserException("Invalid Room.");
  }

  console.log('Create PeerConnection with configuration: ', configuration);
  peerConnection = new RTCPeerConnection(configuration);
  registerPeerConnectionListeners();
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  let uid = authenticate();
  // collect ICE candidates
  pc.onicecandidate = e => onIceCandidate(uid, e);

  peerConnection.addEventListener('track', event => {
    console.log('Got remote track:', event.streams[0]);
    event.streams[0].getTracks().forEach(track => {
      console.log('Add a track to the remoteStream:', track);
      remoteStream.addTrack(track);
    });
  });

  // set remote SDP offer.
  let remoteOffer = null;
  await get(ref(db, "offers/" + peerUID), (snapshot) => {
    remoteOffer = snapshot.val();
  });

  await peerConnection.setRemoteDescription(snapshot.val());

  // create SDP answer.
  let answer = peerConnection.createAnswer();
  await set(ref(db, "offers/" + uid), {
    type: answer.type,
    sdp: answer.sdp
  });

  // Listening for remote ICE candidates.
  await onChildAdded(ref(db, "candidates/" + peerUID), (data) => {
    peerConnection.addIceCandidate(data.val());
  });

  // register myself to room.
  await set(push(ref(db, "rooms/" + roomId)), uid);
}

async function onIceCandidate(uid, event) {
  if (event.candidate) {
    if (event.candidate.candidate === '') {
      return;
    }
    const { candidate } = event;
    await set(push(ref(db, "candidates/" + uid)), candidate.toJSON());
  }
}

async function hangUp() {
  console.log('Hang up');
  pc.close();
  pc = null;
  document.querySelector('#hangupBtn').disabled = true;
  // delete room.
  await remove(ref(db, "rooms/" + roomId));
  // delete offer
  await remove(ref(db, "offers/" + uid));
  // delete ICE candidates
  await remove(ref(db, "candidates/" + uid));
}

async function openUserMedia(e) {
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  document.querySelector('#localVideo').srcObject = stream;
  localStream = stream;
  remoteStream = new MediaStream();
  document.querySelector('#remoteVideo').srcObject = remoteStream;

  console.log('Stream:', document.querySelector('#localVideo').srcObject);
  document.querySelector('#cameraBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = false;
  document.querySelector('#createBtn').disabled = false;
  document.querySelector('#hangupBtn').disabled = false;
}

function registerPeerConnectionListeners() {
  peerConnection.addEventListener('icegatheringstatechange', () => {
    console.log(
      `ICE gathering state changed: ${peerConnection.iceGatheringState}`);
  });

  peerConnection.addEventListener('connectionstatechange', () => {
    console.log(`Connection state change: ${peerConnection.connectionState}`);
  });

  peerConnection.addEventListener('signalingstatechange', () => {
    console.log(`Signaling state change: ${peerConnection.signalingState}`);
  });

  peerConnection.addEventListener('iceconnectionstatechange ', () => {
    console.log(
      `ICE connection state change: ${peerConnection.iceConnectionState}`);
  });
}

async function authenticate() {
  try {
    const email = document.querySelector(`#authEmail`).value;
    const password = document.querySelector(`#authPass`).value;
    let userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user.uid;
  } catch (error) {
    console.error(`code: ${error.code}, ${error.message}`);
  }
}

init();
