// Rectangle object useful for Canvas manipulation
// Consists of an origin point expressed as (x,y) and width/height values
class Rectangle {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    // Boolean function to determine if given (x,y) point lies within the bounds
    // of a Rectangle object
    isPointInBounds(x, y) {
        var x1 = this.x;
        var x2 = this.x + this.width;
        var y1 = this.y;
        var y2 = this.y + this.height;
        if(x > x1 && x < x2 && y > y1 && y < y2) {
            return true;
        } else {
            return false;
        }
    }
}