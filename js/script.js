window.onload = main;

function main() {
    var app = new MusicSequencer();
    app.start();
}

class MusicSequencer {
    constructor() {
        this.audio_ctx = new AudioContext();
        // DOM properties
        this.container = document.querySelector(".app-container");
        this.track_insert_point = document.querySelector("#trackInsertPoint");
        this.track_html = null;
        // Master volume / gain
        this.gain_node = this.audio_ctx.createGain();
        this.gain_node.connect(this.audio_ctx.destination);
        // Song playback and animation properties
        this.animation = null;
        this.audio_buffers = [];
        this.beat_length = 166.67; // in milliseconds
        this.song_is_playing = false;
        // Main data containers
        this.instruments = [];
        this.tracks = [];
        this.sounds = {}; // Format: { instrument_name : sound_array }
        // Other properties
        this.max_tracks = 8;

        this.initUIEvents();
    }

    start() {
        Promise.all([
            this.loadSounds(), 
            this.loadTrackHTML()
        ])
        .then(success => {
            // App has successfully loaded, hide loading icon and create new track
            console.log(success);
            var loadingIcon = document.querySelector("#appLoadingIcon");
            loadingIcon.classList.add("fade");
            setTimeout(() => {
                this.createTrack();
                loadingIcon.style.display = "none";
            }, 500);
        })
        .catch(error => {
            console.log(error);
            alert("Something went wrong. Please refresh and try again.");
        })
    }

    loadSounds() {
        // Fetch all instrument folder names
        return fetch("php/dir_contents.php?dir=../sounds", {method: "GET"})
        .then(response => response.json())
        // Capture folder names and for each, fetch file names in instr directory
        .then(instr_folder_names => {
            this.instruments = instr_folder_names;
            var fetches = instr_folder_names.map(instr => {
                return fetch("php/dir_contents.php?dir=../sounds/" + instr, {method: "GET"})
                .then(response => response.json());
            })
            return Promise.all(fetches);
        })
        // Fetch all mp3 files by name, grouped by instr
        .then(file_names => {          
            return Promise.all(file_names.map((folder, index) => {
                return Promise.all(folder.map(file => {
                    return fetch("sounds/" + this.instruments[index] + "/" + file)
                    .then(response => response.arrayBuffer());
                }));
            }));
        })
        // Decode all mp3 array buffers into usable sounds
        .then(array_buffers => {
            return Promise.all(array_buffers.map(buffers => {
                return Promise.all(buffers.map(buffer => {
                    return this.audio_ctx.decodeAudioData(buffer);
                }));
            }));
        })
        // Assign decoded sounds to sounds object
        .then(decoded_sounds => {
            decoded_sounds.forEach((sound, index) => {
                this.sounds[this.instruments[index]] = sound;
            });
            return Promise.resolve("All sounds loaded successfully");
        })
    }

    loadTrackHTML() {
        return fetch("html/music_track.html", {method: "GET"})
        .then(response => response.text())
        .then(html => {
            this.track_html = html;
            return Promise.resolve("Track template loaded successfully");
        })
    }

    initUIEvents() {
        var volume_control = this.container.querySelector("#songGain input");
        var volume_display = this.container.querySelector("#songGain .slider-display");
        volume_control.addEventListener("input", e => {
            volume_display.innerHTML = e.target.value;
            this.gain_node.gain.value = e.target.value / 100;
        })

        
        var tempo_control = this.container.querySelector("#songTempo input");
        var tempo_display = this.container.querySelector("#songTempo .slider-display");
        tempo_control.addEventListener("input", e => {
            tempo_display.innerHTML = e.target.value;
            this.beat_length = 60 / e.target.value * 1000 / 4;
        })

        var play_button = this.container.querySelector("#playSong");
        play_button.addEventListener("click", e => {
            if(this.song_is_playing) {
                this.stopSong();
            }
            this.playSong();
        });
    
        var stop_button = this.container.querySelector("#stopSong");
        stop_button.addEventListener("click", e => {
            this.stopSong();
        });
    
        var add_track_button = this.container.querySelector("#addTrack");
        add_track_button.addEventListener("click", e => {
            // Check for maximum track threshold
            if(this.tracks.length >= this.max_tracks) {
                alert("Maximum number of tracks reached");
                return;
            }

            if(this.song_is_playing) {
                this.stopSong();
            }
            this.createTrack("guitar");
        })
    }

    createTrack() {
        var div = document.createElement("div");
        div.innerHTML = this.track_html;

        var canvas = div.querySelector(".track-canvas");
        var track = new MusicTrack(div.firstChild, this.audio_ctx, this.gain_node, "piano", canvas);

        // Initialize click event for track canvas
        // This needs to be done in this class to ensure access to sound sources
        track.grid.canvas.addEventListener("click", e => {
            var hit = track.grid.fastCheckHit(e.offsetX, e.offsetY);
            var cell = hit.cell;

            if(cell) {
                cell.is_filled = !cell.is_filled;
                if(cell.is_filled) {
                    var sources = this.sounds[track.instrument];
                    var source = this.audio_ctx.createBufferSource();
                    source.buffer = sources[sources.length - hit.row - 1];
                    source.connect(track.audio_hook);
                    source.start();
                }
                cell.draw(track.grid.ctx);
            }
        })

        this.tracks.push(track);
        this.container.insertBefore(div.firstChild, this.track_insert_point);
    }

    playSong() {
        this.song_is_playing = true;

        // Create buffer nodes for each filled note in track grid
        var buffers = [];
        this.tracks.forEach(track => {
            var current_time = this.audio_ctx.currentTime;
            var beats = track.grid.getColumns();
            var sounds = this.sounds[track.instrument];

            // Read grid by column (beat)
            beats.forEach((beat, beat_index) => {
                beat.forEach((note, note_index) => {
                    if(note.is_filled) {
                        var source = this.audio_ctx.createBufferSource();
                        source.buffer = sounds[sounds.length - note_index - 1];
                        source.connect(track.audio_hook);
                        source.start(current_time + (this.beat_length / 1000 * beat_index));
                        buffers.push(source);
                    }
                })
            })
        }) 
        this.audio_buffers = buffers; // Capture source nodes to enable playback stopping

        this.tracks.forEach(track => track.playAnimation(this.beat_length));
    }

    stopSong() {
        this.song_is_playing = false;

        // Cancel any animation currently active
        this.tracks.forEach(track => {
            track.stopAnimation();
            track.toggleBeat(track.active_beat);
            track.active_beat = null;
        })
        // Stop all scheduled audio buffers and reset buffer array
        this.audio_buffers.forEach(buffer => {
            buffer.stop();
        })
        this.audio_buffers = [];
    }
}

class MusicTrack {
    constructor(container, audio_ctx, audio_destination, instrument, grid_canvas) {
        // DOM properties
        this.container = container;
        this.canvas_container = container.querySelector(".canvas-container");
        this.options_dropdown;
        this.options_menu;
        
        // Volume control
        this.gain_node = audio_ctx.createGain();
        this.gain_node.connect(audio_destination);
        this.gain_input;
        this.gain_display;

        this.name = "New Track";
        this.instrument = instrument;
        this.reverb = false;
        this.grid;
        this.reverb_node;

        this.audio_hook = this.gain_node;

        // Animation properties
        this.active_beat = null;
        this.animation;
        
        this.initGrid(grid_canvas);
        this.initEvents();
        this.initReverb(audio_ctx);
    }

    // Initializes CanvasGrid object according to default values
    // TODO: These should be paramaterized to allow more control over grid display
    //       and to allow for differing dimensions of track grids (percussion etc.)
    initGrid(canvas) {
        var rows = 13;
        var columns = 64;
        var cell_width = 45;
        var cell_height = 30;
        canvas.width = columns * cell_width + 2;
        canvas.height = rows * cell_height + 2;
        this.grid = new CanvasGrid(canvas, canvas.width, canvas.height, rows, columns, cell_width, cell_height, 2);
        this.setBeatBaseColors("rgb(240,240,240)", "rgb(220,220,220)", 4);
        this.grid.draw();
    }

    // Initialize all event listeners for track interface
    initEvents() {
        // Track options dropdown menu activation
        this.options_dropdown = this.container   
            .querySelector(".track-options-dropdown-button");
        var dropdown_button = this.options_dropdown
            .querySelector(".checkbox-dropdown input");
        this.options_menu = this.container
            .querySelector(".track-options-dropdown");

        dropdown_button.addEventListener("change", e => {
            this.updateOptions();
            if(dropdown_button.checked) {
                this.showOptions();
            } else {
                this.hideOptions();
            }
        })

        var save_button = this.options_menu
            .querySelector(".track-options-save button");
        save_button.addEventListener("click", e => {
            this.saveOptions();
        })

        this.gain_input = this.container
            .querySelector(".track-volume input");
        this.gain_display = this.container
            .querySelector(".track-volume .slider-display")
        this.gain_input.addEventListener("input", e => {
            this.gain_display.innerHTML = e.target.value;
            this.gain_node.gain.value = e.target.value / 100;
        })
    }

    // Creates convolver node with the Web Audio API for IR-based reverb effect
    // Audio Path: sound -> track-reverb -> track-gain -> master-gain -> output
    initReverb(ctx) {
        this.reverb_node = ctx.createConvolver();
        fetch("impulse_responses/JFKUnderpass.wav", {method: "GET"})
        .then(response => response.arrayBuffer())
        .then(array_buffer => ctx.decodeAudioData(array_buffer))
        .then(data => {
            this.reverb_node.buffer = data;
            this.reverb_node.connect(this.gain_node);
        });
    }

    // Main animation loop, called by play button event listener
    playAnimation(tempo) {
        var start;
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
                this.toggleBeat(this.active_beat);
                window.cancelAnimationFrame(this.animation);
                return null;
            }
            // Update grid if progress has moved to a new beat
            if(current_beat != this.active_beat) {
                // If not the first beat, clear previous beat
                if(current_beat != 0) {
                    this.toggleBeat(this.active_beat);
                }
                // Proceed with next beat
                this.toggleBeat(current_beat);
                // Set active beat
                this.active_beat = current_beat;
            }
    
            this.animation = window.requestAnimationFrame(step);
        }.bind(this);

        this.animation = window.requestAnimationFrame(step);
    }

    stopAnimation() {
        window.cancelAnimationFrame(this.animation);
    }

    // Helper function used in animation loop for setting a given
    // column (beat) to playing status and draw cells
    toggleBeat(index) {
        if(index == null) {
            return
        }

        var col = this.grid.getColumn(index);
        col.forEach(cell => {
            cell.is_playing = !cell.is_playing;
            cell.draw(this.grid.ctx);
        })
    }

    // Alternates cell base colors between c1 and c2 on increment
    // Used to give visual demarcation of beat subdivisions
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
    
    // Updates track data with given options menu form values
    // Called by save button event listener
    saveOptions() {
        var track_name_input = this.options_menu
            .querySelector(".track-name input");
        // Check name for valid input
        if(this.checkNameForInvalid(track_name_input.value)) {
            return alert("Track name must contain only letters, numbers, and spaces");
        }
        this.name = track_name_input.value;

        var track_instrument_select = this.options_menu 
            .querySelector(".track-instrument select")
        this.instrument = track_instrument_select.value;

        // Update track label
        this.container.querySelector(".track-label-name").innerHTML = this.name;
        this.container.querySelector(".track-label-instr i").innerHTML = track_instrument_select.selectedOptions[0].text;

        var track_reverb_switch = this.options_menu
            .querySelector(".track-reverb input");
        this.reverb = track_reverb_switch.checked;
        // Check reverb switch for audio hook toggle
        if(this.reverb) {
            this.audio_hook = this.reverb_node;
        } else {
            this.audio_hook = this.gain_node;
        }
    }

    // Updates options menu to default values based on current track state
    // Called by options dropdown button on menu showing/hiding
    updateOptions() {
        var track_name_input = this.options_menu
            .querySelector(".track-name input");
        track_name_input.value = this.name;

        var track_instrument_select = this.options_menu 
            .querySelector(".track-instrument select")
        track_instrument_select.value = this.instrument;

        var track_reverb_switch = this.options_menu
            .querySelector(".track-reverb input");
        track_reverb_switch.checked = this.reverb;
    }

    // Set CSS classes for visible options menu styling
    showOptions() {
        this.options_dropdown.classList.add("selected");
        this.options_menu.classList.add("visible");
    }

    // Remove CSS classes to hide options menu with default styling
    hideOptions() {
        this.options_dropdown.classList.remove("selected");
        this.options_menu.classList.remove("visible");
    }

    // Checks track name for invalid input characters
    // Returns true if an invalid char is found
    // Accepted: letters, numbers, single spaces
    checkNameForInvalid(string) {
        const regex = /[^\w" "]/g;
        return regex.test(string);
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
            new Color(255, 0, 40), 
            new Color(100, 10, 255),
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
                cells.push(new CanvasGridCell(cell_x, cell_y, this.column_width, this.row_height, this.line_width, this.colors[j].toString()));
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

    fastCheckHit(x, y) {
        var column_index = Math.floor(x / this.column_width);
        var row_index = Math.floor(y / this.row_height);
        return {
            col: column_index,
            row: row_index,
            cell: this.cells[(column_index * this.num_rows) + row_index]
        }
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

        this.base_color;
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
                this.color = "rgb(255,255,255)";
            } else {
                this.color = "rgb(170,170,200)";
            }
        }

        ctx.fillStyle = this.color;

        //ctx.clearRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h)

        ctx.beginPath();
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        ctx.fill();
        ctx.stroke();
        ctx.closePath();
    }
}