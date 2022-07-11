`use strict`;

var constraints = {
    audio: true,
    video: true
};

async function getLocalMedia(e) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        document.querySelector('#localVideo').srcObject = stream;
        e.target.disabled = true;
    } catch (err) {
        console.error(err);
    }
}

document.querySelector('#openLocalVideo').addEventListener('click', e => getLocalMedia(e));
