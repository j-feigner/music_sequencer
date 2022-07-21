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

class CanvasGrid {
    constructor(canvas, width, height, rows, columns) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext("2d");

        this.rect = new Rectangle(0, 0, width, height);

        this.rows = rows;
        this.columns = columns;

        this.row_height = height / rows;
        this.column_width = width / columns;

        this.cells = [];
    }
}

class CanvasGridCell {
    constructor(x, y, width, height) {
        this.rect = new Rectangle(x, y, w, h);
    }
}