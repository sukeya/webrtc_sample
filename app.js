async function getMedia(constraints) {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    document.querySelector('video').srcObject = stream;
}
  
var constraints = {
    audio: true,
    video: true
};

getMedia(constraints);
