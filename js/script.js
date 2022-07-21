window.onload = main;

function main() {
    var app = new MusicSequencer();
    app.container = document.querySelector(".app-container");

    var sounds;

    app.loadSounds("piano").then(decoded_buffers => {
        sounds = decoded_buffers;
    })
}

class MusicSequencer {
    constructor() {
        this.container = null;
        this.audio_ctx = new AudioContext();
    }

    loadSounds(directory) {
        return fetch("php/load_sounds.php?instr=" + directory, {method: "GET"})
        .then(response => response.json())
        .then(file_names => {
            var urls = file_names.map(name => "sounds/" + directory + "/" + name);
            var fetches = urls.map(url => fetch(url).then(response => response.arrayBuffer()));
            return Promise.all(fetches);
        })
        .then(buffers => {
            var sounds = buffers.map(buffer => this.audio_ctx.decodeAudioData(buffer)
                .then(sound => sound));   
            return Promise.all(sounds);
        })
    }
}