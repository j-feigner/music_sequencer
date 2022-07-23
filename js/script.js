window.onload = main;

function main() {
    var app = new MusicSequencer();
    app.container = document.querySelector(".app-container");

    var canvas = document.querySelector(".temp-canvas");
    canvas.width = 1000;
    canvas.height = 500;
    var sounds;

    app.loadSounds("../sounds/piano").then(decoded_buffers => {
        sounds = decoded_buffers;
    })

    app.tracks.push(new MusicTrack(001, "../sounds/piano", null));
    app.tracks[0].grid = new CanvasGrid(canvas, canvas.width, canvas.height, 10, 18, 46, 46, 4);
    app.tracks[0].grid.draw();

    canvas.addEventListener("click", event => {
        var cell = app.tracks[0].grid.checkHit(event.offsetX, event.offsetY);
        if(cell) {
            if(cell.is_filled) {
                cell.color = "rgb(255, 255, 255)";
            } else {
                cell.color = "rgb(255, 0, 0)";
            }
            cell.is_filled = !cell.is_filled;
            cell.draw(app.tracks[0].grid.ctx);
        }
    })

    var instruments = null;
    fetch("php/dir_contents.php?dir=../sounds", {method: "GET"})
        .then(response => response.json())
        .then(folder_names => {
            instruments = folder_names
            var stop = 0;
        });
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
        return fetch("php/dir_contents.php?dir=" + directory, {method: "GET"})
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
        this.grid = null;
    }
}

class CanvasGrid {
    constructor(canvas, width, height, rows, columns, cell_width, cell_height, line_width) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext("2d");

        this.padding_x = Math.floor((width - (cell_width * columns)) / 2);
        this.padding_y = Math.floor((height - (cell_height * rows)) / 2);

        this.rect = new Rectangle(
            line_width / 2 + this.padding_x, 
            line_width / 2 + this.padding_y, 
            width - line_width - (this.padding_x * 2), 
            height - line_width - (this.padding_y * 2)
        );

        this.line_width = line_width;

        this.num_rows = rows;
        this.num_columns = columns;

        this.row_height = cell_height;
        this.column_width = cell_width;

        this.cells = this.initCells();
    }

    // Creates all cell objects according to given parameters
    initCells() {
        var cells = [];
        for(var i = 0; i < this.num_columns; i++) {
            for(var j = 0; j < this.num_rows; j++) {
                var cell_x = this.rect.x + this.column_width * i;
                var cell_y = this.rect.y + this.row_height * j;
                cells.push(new CanvasGridCell(cell_x, cell_y, this.column_width, this.row_height, this.line_width));
            }
        }
        return cells;
    }

    // Calls cell.draw() on every cell in the grid
    draw() {
        this.cells.forEach(cell => {
            cell.draw(this.ctx);
        })
    }

    // Checks if given x,y pair falls inside the bounds of any grid cell
    // Returns the cell on a successful hit, returns undefined if no hits found
    checkHit(x, y) {
        for(var i = 0; i < this.cells.length; i++) {
            if(this.cells[i].rect.isPointInBounds(x,y)) {
                return this.cells[i];
            }
        }
        return undefined;
    }

    // Returns an array of arrays representing the grid cells grouped by column
    getColumns() {
        var columns = [];
        for(var i = 0; i < this.num_columns; i++) {
            var start = i * this.num_rows;
            var end = start + this.num_rows;
            columns.push(this.cells.slice(start, end));
        }
        return columns;
    }

    // Returns an array of arrays representing the grid cells grouped by row
    getRows() {
        var rows = [];
        for(var i = 0; i < this.num_rows; i++) {
            var row = [];
            for(var j = i; j < this.cells.length; j += this.num_rows) {
                row.push(this.cells[j]);
            }
            rows.push(row);
        }
        return rows;
    }
}

class CanvasGridCell {
    constructor(x, y, width, height, line_width) {
        this.rect = new Rectangle(x, y, width, height);
        this.line_width = line_width;
        this.color = "rgb(255, 255, 255)";
        this.is_filled = false;
    }

    draw(ctx) {
        ctx.lineWidth = this.line_width;
        ctx.lineStyle = "black";
        ctx.fillStyle = this.color;

        ctx.clearRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)

        ctx.beginPath();
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        ctx.fill();
        ctx.stroke();
        ctx.closePath();
    }
}