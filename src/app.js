`use strict`;

import { ref, set, get, push, update, child, onChildAdded, remove } from "firebase/database";
import { signInWithEmailAndPassword } from "firebase/auth";
import { db, auth } from "./init-firebase"

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
  iceServers: [{
    urls: [
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302'
    ]
  }],
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
  console.log('Create PeerConnection with configuration: ', configuration);
  peerConnection = new RTCPeerConnection(configuration);

  registerPeerConnectionListeners();

  // creat a room
  const uid = await authenticate();
  const roomId = await push(child(ref(db), "rooms")).key;
  const room_menber = {};
  room_menber["/rooms/" + roomId + "/" + uid] = { "name": "test" };
  await update(ref(db), room_menber);
  document.querySelector('#currentRoom').innerText = `Current room is ${roomId} - You are the caller!`

  // create a offer
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  await set(ref(db, 'offers/' + uid), { "type": offer.type, "sdp": offer.sdp });

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // upload my ICE candidates.
  peerConnection.onicecandidate = e => onIceCandidate(uid, e);

  // watch another user entered in the room.
  let peerUID = null;
  let peerUIDs = [];
  await onChildAdded(ref(db, "rooms/" + roomId), async (data) => {
    // TODO If there are users more than 2 in a room, how should I connect each user?
    if (data.key != uid) {
      peerUIDs.push(data.key);
      peerUID = peerUIDs[0];
      if (peerUIDs.length == 1) {
        // Listening for remote session description.
        let snapshot = await get(ref(db, "offers/" + peerUID));
        await peerConnection.setRemoteDescription(snapshot.val());

        // Listen for remote ICE candidates
        // TODO should I do `get` before watching whether a child is added.
        await onChildAdded(ref(db, "candidates/" + peerUID), async (data) => {
          await peerConnection.addIceCandidate(data.val());
        });
      }
    }
  });

  peerConnection.addEventListener('track', event => {
    console.log('Got remote track:', event.streams[0]);
    event.streams[0].getTracks().forEach(track => {
      console.log('Add a track to the remoteStream:', track);
      remoteStream.addTrack(track);
    });
  });

  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = true;
}

function joinRoom() {
  document.querySelector('#confirmJoinBtn').
    addEventListener('click', async () => {
      roomId = document.querySelector('#room-id').value;
      console.log('Join room: ', roomId);
      document.querySelector(
        '#currentRoom').innerText = `Current room is ${roomId} - You are the callee!`;
      await joinRoomById(roomId);
    }, { once: true });
  roomDialog.open();

  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = true;
}

async function joinRoomById(roomId) {
  // Before getting peer uid, authenticate myself.
  let uid = await authenticate();

  let peerUID = null;
  let peerUIDs = [];
  await onChildAdded(ref(db, "rooms/" + roomId), async (data) => {
    if (data.key != uid) {
      peerUIDs.push(data.key);
      // always, peer user id is one who made this room.
      peerUID = peerUIDs[0];
      // the following code is run when first data is added.
      if (peerUIDs.length == 1) {
        // set remote SDP offer.
        let snapshot = await get(ref(db, "offers/" + peerUID));
        await peerConnection.setRemoteDescription(snapshot.val());
        // create SDP answer.
        let answer = await peerConnection.createAnswer();
        await set(ref(db, "offers/" + uid), {
          type: answer.type,
          sdp: answer.sdp
        });

        // Listening for remote ICE candidates.
        await onChildAdded(ref(db, "candidates/" + peerUID), async (data) => {
          await peerConnection.addIceCandidate(data.val());
        });
        // register myself to room.
        await set(ref(db, "rooms/" + roomId + "/" + uid), { "name": "test2" });
      }
    }
  });

  console.log('Create PeerConnection with configuration: ', configuration);
  peerConnection = new RTCPeerConnection(configuration);
  registerPeerConnectionListeners();
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // collect ICE candidates
  peerConnection.onicecandidate = e => onIceCandidate(uid, e);

  peerConnection.addEventListener('track', event => {
    console.log('Got remote track:', event.streams[0]);
    event.streams[0].getTracks().forEach(track => {
      console.log('Add a track to the remoteStream:', track);
      remoteStream.addTrack(track);
    });
  });
}

async function onIceCandidate(uid, event) {
  if (event.candidate) {
    if (event.candidate.candidate === '') {
      return;
    }
    const { candidate } = event;
    await push(ref(db, "candidates/" + uid), candidate.toJSON());
  }
}

async function hangUp() {
  console.log('Hang up');
  peerConnection.close();
  peerConnection = null;
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
  const email = document.querySelector(`#authEmail`).value;
  const password = document.querySelector(`#authPass`).value;
  let userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user.uid;
}

init();
