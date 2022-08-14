class Color {
    constructor(red, green, blue, alpha = 1) {
        this.r = Math.min(Math.max(0, red), 255);
        this.g = Math.min(Math.max(0, green), 255);
        this.b = Math.min(Math.max(0, blue), 255);

        this.a = Math.min(Math.max(0, alpha), 1);

        this.fade_interval;
    }

    // Linearly interpolates between two Color objects and returns an array
    // of discrete Colors between start_color and end_color
    static createColorGradient(start_color, end_color, steps) {
        var colors = [];
        var step_size = 1 / steps;

        // Interpolate between start_color and end_color on discrete t steps
        for(var t = 0; t <= 1; t += step_size) {
            colors.push(new Color(
                (1 - t) * start_color.r + t * end_color.r,
                (1 - t) * start_color.g + t * end_color.g,
                (1 - t) * start_color.b + t * end_color.b
            ));
        }
        return colors;
    }

    // Returns a Color between start_color and end_color at given ratio between the two
    static getFadeAtStep(start_color, end_color, step) {
        var dr = (start_color.r - end_color.r) * step;
        var dg = (start_color.g - end_color.g) * step;
        var db = (start_color.b - end_color.b) * step;
        var da = (start_color.a - end_color.a) * step;

        return new Color(dr, dg, db, da);
    }

    // Returns a new Color with modified r,g,b values
    static getModifiedColor(color, dr, dg, db) {
        var r = Math.min(Math.max(0, color.r + dr), 255);
        var g = Math.min(Math.max(0, color.g + dg), 255);
        var b = Math.min(Math.max(0, color.b + db), 255);

        return new Color(r, g, b, color.a);
    }

    // Fades from current color to end_color over time milliseconds
    fade(end_color, time) {
        var increment = 50;
        var time_step = time / increment;

        var dr = (this.r - end_color.r) / increment;
        var dg = (this.g - end_color.g) / increment;
        var db = (this.b - end_color.b) / increment;
        var da = (this.a - end_color.a) / increment;

        var timer = 0;

        this.fade_interval = setInterval(() => {
            this.r -= dr;
            this.g -= dg;
            this.b -= db;
            this.a -= da;

            timer += time_step;
            if(timer >= time) {
                clearInterval(this.fade_interval);
            }
        }, time_step);
    }

    // Adds a single delta to all r,g,b values
    modifyAll(d) {
        this.r = Math.min(Math.max(0, this.r + d), 255);
        this.g = Math.min(Math.max(0, this.g + d), 255);
        this.b = Math.min(Math.max(0, this.b + d), 255);
    }

    // Adds specific deltas to r,g,b values
    modify(dr, dg, db) {
        this.r = Math.min(Math.max(0, this.r + dr), 255);
        this.g = Math.min(Math.max(0, this.g + dg), 255);
        this.b = Math.min(Math.max(0, this.b + db), 255);
    }

    // Returns string of form "rgb(r, g, b)" for CSS styling / HTMLCanvas manipulation
    // If include_alpha is true will return string of form "rgba(r, g, b, a)"
    toString(include_alpha) {
        if(include_alpha) {
            return "rgba(" + 
                    String(this.r) + ", " +
                    String(this.g) + ", " +
                    String(this.b) + ", " + 
                    String(this.a) + ")";
        } else {
            return "rgb(" + 
                    String(this.r) + ", " +
                    String(this.g) + ", " +
                    String(this.b) + ")";
        }
    }
}