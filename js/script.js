window.onload = main;

function main() {
    var app = new MusicSequencer();
    app.container = document.querySelector(".app-container");

    var canvas = document.querySelector(".temp-canvas");
    canvas.width = 1000;
    canvas.height = 500;
    var sounds;

    app.loadSounds("piano").then(decoded_buffers => {
        sounds = decoded_buffers;
    })

    var grid = new CanvasGrid(canvas, canvas.width, canvas.height, 10, 18);
    grid.draw();

    var stopper = 0;
}

class MusicSequencer {
    constructor() {
        this.container = null;
        this.audio_ctx = new AudioContext();

        this.tracks = [];
    }

    // Loads sounds by instrument/directory name
    // Returns an array of Promises that resolve to decoded sound buffers
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

class MusicTrack {
    constructor(id, instrument, audio_ctx) {
        this.id = id;
        this.instrument = instrument;
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

        this.cells = this.initCells();
    }

    initCells() {
        var cells = [];
        for(var i = 0; i < this.columns; i++) {
            var col = [];
            for(var j = 0; j < this.rows; j++) {
                var cell_x = this.rect.x + this.column_width * i;
                var cell_y = this.rect.y + this.row_height * j;
                col[j] = new CanvasGridCell(cell_x, cell_y, this.column_width, this.row_height);
            }
            cells.push(col);
        }
        return cells;
    }

    draw() {
        this.cells.forEach(column => {
            column.forEach(cell => {
                cell.draw(this.ctx);
            })
        })
    }
}

class CanvasGridCell {
    constructor(x, y, width, height) {
        this.rect = new Rectangle(x, y, width, height);
    }

    draw(ctx) {
        ctx.lineWidth = 2;
        ctx.lineStyle = "black";

        ctx.beginPath();
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        ctx.stroke();
        ctx.closePath();
    }
}