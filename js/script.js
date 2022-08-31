window.onload = main;

function main() {
    var app = new MusicSequencer();
    app.container = document.querySelector(".app-container");

    app.start();

    var play_button = document.querySelector("#playSong");
    play_button.addEventListener("click", e => {
        app.stopSong();
        app.playSong();
    });

    var stop_button = document.querySelector("#stopSong");
    stop_button.addEventListener("click", e => {
        app.stopSong();
    });

    var add_track_button = document.querySelector("#addTrack");
    add_track_button.addEventListener("click", e => {
        app.createTrack("guitar");
    })

    var volume_control = document.querySelector("#songGain input");
    var volume_display = document.querySelector("#songGain .slider-display");
    volume_control.addEventListener("input", e => {
        volume_display.innerHTML = e.target.value;
    })

    var tempo_control = document.querySelector("#songTempo input");
    var tempo_display = document.querySelector("#songTempo .slider-display");
    tempo_control.addEventListener("input", e => {
        tempo_display.innerHTML = e.target.value + "bpm";
    })
}

class MusicSequencer {
    constructor() {
        this.audio_ctx = new AudioContext();
        // DOM properties
        this.container = document.querySelector(".app-container");
        this.track_insert_point = document.querySelector("#trackInsertPoint");
        // Song playback and animation properties
        this.animation = null;
        this.audio_buffers = [];
        this.beat_length = 250;
        // UI properties

        // Main data containers
        this.tracks = [];
        this.sounds = {};
    }

    start() {
        this.loadSounds();
        this.createTrack("piano");
    }

    loadSounds() {
        var instruments = null;

        // Fetch all instrument folder names
        fetch("php/dir_contents.php?dir=../sounds", {method: "GET"})
        .then(response => response.json())
        .then(folder_names => {
            instruments = folder_names;
            // Fetch and decode all sound files for each instrument folder
            instruments.forEach(instr => {
                fetch("php/dir_contents.php?dir=../sounds/" + instr, {method: "GET"})
                .then(response => response.json())
                .then(file_names => {
                    var urls = file_names.map(name => "sounds/" + instr + "/" + name);
                    var fetches = urls.map(url => fetch(url).then(response => response.arrayBuffer()));
                    return Promise.all(fetches);
                })
                .then(buffers => {
                    var sounds = buffers.map(buffer => this.audio_ctx.decodeAudioData(buffer));
                    return Promise.all(sounds);
                })
                .then(decoded_sounds => {
                    this.sounds[instr] = decoded_sounds;
                });   
            })
        })
    }

    createTrack(instrument) {
        fetch("html/music_track.html", {method: "GET"})
        .then(response => response.text())
        .then(html => {
            var div = document.createElement("div");
            div.innerHTML = html;

            var canvas = div.querySelector(".track-canvas");
            var track = new MusicTrack(div.firstChild, this.audio_ctx, instrument, canvas);
    
            this.tracks.push(track);
            this.container.insertBefore(div.firstChild, this.track_insert_point);
        })
    }

    playSong() {
        // Create buffer nodes for each filled note in track grid
        var buffers = [];
        this.tracks.forEach(track => {
            var current_time = this.audio_ctx.currentTime;
            var beats = track.grid.getColumns();
            var sounds = this.sounds[track.instrument];
            
            // Set destination according to reverb status
            var destination;
            if(track.reverb) {
                destination = track.reverb_node;
            } else {
                destination = this.audio_ctx.destination;
            }
            // Read grid by column (beat)
            beats.forEach((beat, beat_index) => {
                beat.forEach((note, note_index) => {
                    if(note.is_filled) {
                        var source = this.audio_ctx.createBufferSource();
                        source.buffer = sounds[sounds.length - note_index - 1];
                        source.connect(destination);
                        source.start(current_time + (0.25 * beat_index));
                        buffers.push(source);
                    }
                })
            })
        }) 
        this.audio_buffers = buffers; // Capture source nodes to enable playback stopping

        this.tracks.forEach(track => track.playAnimation(this.beat_length));
    }

    stopSong() {
        // Cancel any animation currently active
        this.tracks.forEach(track => track.stopAnimation());
        // Refresh grid to remove any animation artifacts
        this.tracks.forEach(track => {
            track.grid.cells.forEach(cell => {
                cell.is_playing = false;
            })
            track.grid.draw();
        })
        // Stop all scheduled audio buffers and reset buffer array
        this.audio_buffers.forEach(buffer => {
            buffer.stop();
        })
        this.audio_buffers = [];
    }
}

class MusicTrack {
    constructor(container, audio_ctx, instrument, grid_canvas) {
        // DOM properties
        this.container = container;
        this.canvas_container = container.querySelector(".canvas-container");

        this.instrument = instrument;
        this.grid;
        this.reverb = false;
        this.reverb_node;
        this.animation;
        
        this.initGrid(grid_canvas);
        this.initEvents(grid_canvas);
        this.initReverb(audio_ctx);
    }

    initGrid(canvas) {
        var rows = 13;
        var columns = 64;
        var cell_width = 45;
        var cell_height = 30;
        canvas.width = columns * cell_width + 2;
        canvas.height = rows * cell_height + 2;
        this.grid = new CanvasGrid(canvas, canvas.width, canvas.height, rows, columns, cell_width, cell_height, 2);
        this.setBeatBaseColors(new Color(240, 240, 240), new Color(220, 220, 220), 4);
        this.grid.draw();
    }

    initEvents(canvas) {
        canvas.addEventListener("click", event => {
            var cell = this.grid.checkHit(event.offsetX, event.offsetY);
            if(cell) {
                if(cell.is_filled) {
                    cell.color = "rgb(255, 255, 255)";
                } else {
                    cell.color = "rgb(125, 85, 110)";
                }
                cell.is_filled = !cell.is_filled;
                cell.draw(this.grid.ctx);
            }
        })

        this.container.querySelector(".reverb-switch").addEventListener("input", e => {
            this.reverb = !this.reverb;
        })
    }

    initReverb(ctx) {
        this.reverb_node = ctx.createConvolver();
        fetch("sounds/impulse_response/JFKUnderpass.wav", {method: "GET"})
        .then(response => response.arrayBuffer())
        .then(array_buffer => ctx.decodeAudioData(array_buffer))
        .then(data => {
            this.reverb_node.buffer = data;
            this.reverb_node.connect(ctx.destination);
        });
    }

    playAnimation(tempo) {
        var start, active_beat;
        var beats = this.grid.getColumns().length;

        var step = function(timestamp) {
            // Initialize start of animation
            if(start === undefined) {
                start = timestamp;
            }
            
            // Time elapsed in ms since start of animation
            const progress = timestamp - start;
    
            // Get current beat according to time elapsed against song tempo
            var current_beat = Math.floor(progress/tempo);
    
            // Animation has finished, clear last beat and exit function
            if(current_beat >= beats) {
                this.toggleBeat(active_beat);
                window.cancelAnimationFrame(this.animation);
                return null;
            }
            // Update grid if progress has moved to a new beat
            if(current_beat != active_beat) {
                // If not the first beat, clear previous beat
                if(current_beat != 0) {
                    this.toggleBeat(active_beat);
                }
                // Proceed with next beat
                this.toggleBeat(current_beat);
                // Set active beat
                active_beat = current_beat;
            }
    
            this.animation = window.requestAnimationFrame(step);
        }.bind(this);

        this.animation = window.requestAnimationFrame(step);
    }

    stopAnimation() {
        window.cancelAnimationFrame(this.animation);
    }

    toggleBeat(index) {
        var col = this.grid.getColumn(index);
        col.forEach(cell => {
            cell.is_playing = !cell.is_playing;
            cell.draw(this.grid.ctx);
        })
    }

    setBeatBaseColors(c1, c2, increment) {
        var beat_switch = false;

        this.grid.getColumns().forEach((column, index) => {
            if(index % increment == 0) {
                beat_switch = !beat_switch
            }
            column.forEach(cell => {
                if(beat_switch) {
                    cell.base_color = c1
                } else {
                    cell.base_color = c2
                }
            })
        })
    }
}

class CanvasGrid {
    constructor(canvas, width, height, rows, columns, cell_width, cell_height, line_width) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext("2d");

        this.rect = new Rectangle(
            line_width / 2, 
            line_width / 2, 
            width - line_width, 
            height - line_width
        );

        this.line_width = line_width;

        this.num_rows = rows;
        this.num_columns = columns;

        this.row_height = cell_height;
        this.column_width = cell_width;

        this.colors = Color.createColorGradient(
            new Color(180, 75, 0), 
            new Color(50, 147, 211),
            13);

        this.cells = this.initCells();
    }

    // Creates all cell objects according to grid parameters
    initCells() {
        var cells = [];
        for(var i = 0; i < this.num_columns; i++) {
            for(var j = 0; j < this.num_rows; j++) {
                var cell_x = this.rect.x + this.column_width * i;
                var cell_y = this.rect.y + this.row_height * j;
                cells.push(new CanvasGridCell(cell_x, cell_y, this.column_width, this.row_height, this.line_width, this.colors[j]));
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
    // Returns the cell object on a successful hit, returns undefined if no hits found
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
            columns.push(this.getColumn(i));
        }
        return columns;
    }

    // Returns an array of cells at given column index
    getColumn(index) {
        var start = index * this.num_rows;
        var end = start + this.num_rows;
        return this.cells.slice(start, end);
    }

    // Returns an array of arrays representing the grid cells grouped by row
    getRows() {
        var rows = [];
        for(var i = 0; i < this.num_rows; i++) {
            rows.push(this.getRow(i));
        }
        return rows;
    }

    // Returns an array of cells at given row index
    getRow(index) {
        var row = [];
        for(var i = index; i < this.cells.length; i += this.num_rows) {
            row.push(this.cells[i]);
        }
        return row;
    }
}

class CanvasGridCell {
    constructor(x, y, width, height, line_width, fill_color) {
        this.rect = new Rectangle(x, y, width, height);
        this.line_width = line_width;

        this.base_color = new Color(240, 240, 240);
        this.fill_color = fill_color;

        this.color = this.base_color;

        this.is_filled = false;
        this.is_playing = false;
    }

    draw(ctx) {
        ctx.lineWidth = this.line_width;
        ctx.strokeStyle = "gray";

        // Modify color based on fill status
        if(this.is_filled) {
            this.color = this.fill_color;
        } else {
            this.color = this.base_color;
        }

        // Modify color based on playing animation status
        if(this.is_playing) {
            if(this.is_filled) {
                this.color = new Color(255, 255, 255);
            } else {
                this.color = new Color(170, 170, 200);
            }
        }

        ctx.fillStyle = this.color.toString(true);

        ctx.clearRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)

        ctx.beginPath();
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        ctx.fill();
        ctx.stroke();
        ctx.closePath();
    }
}