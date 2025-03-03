"use strict";
// #region asserts.ts
class AssertionError extends Error {
}
function assert(condition, message) {
    if (condition)
        return;
    throw new AssertionError(message);
}
//#endregion asserts.ts
// #region options.ts
function is_some_option(option) {
    return option !== undefined;
}
function unwrap_option(option) {
    assert(is_some_option(option) && option !== null, "Called unwrap on a None value!");
    return option;
}
// #endregion options.ts
// #region extent.ts
class Extent {
    min;
    max;
    constructor(a, b) {
        if (a > b) {
            const temp = a;
            a = b;
            b = temp;
        }
        this.min = a;
        this.max = b;
    }
    contains(value) {
        return value >= this.min && value <= this.max;
    }
}
class Color {
    red;
    green;
    blue;
    alpha;
    constructor(red, green, blue, alpha) {
        const BIT_8_RANGE = new Extent(0, 255);
        const PERCENTAGE_RANGE = new Extent(0, 1);
        assert([red, green, blue].every((color) => BIT_8_RANGE.contains(color)), `One of your color values (${red}, ${green}, ${blue}) isn't in an 8-bit range!`);
        assert(PERCENTAGE_RANGE.contains(alpha), `Your alpha value (${alpha}) isn't in the range of zero and one!`);
        this.red = red;
        this.green = green;
        this.blue = blue;
        this.alpha = alpha;
    }
    static opaque(red, green, blue) {
        return new Color(red, green, blue, 1);
    }
    static monochrome(value) {
        return Color.opaque(value, value, value);
    }
    static from_hex(hex) {
        const cleaned_hex = hex.trim().replace("#", "");
        const hex_string_length = cleaned_hex.length;
        const has_alpha = hex_string_length === 8;
        assert(hex_string_length === 6 || has_alpha, `Your hex string (${hex}) isn't a valid length (6 or 8)!`);
        const to_8_bit = (hex_part) => Number(`0x${hex_part}`);
        return new Color(to_8_bit(cleaned_hex.substring(0, 2)), to_8_bit(cleaned_hex.substring(2, 4)), to_8_bit(cleaned_hex.substring(4, 6)), (!has_alpha) ? 1 : to_8_bit(cleaned_hex.substring(6, 8)));
    }
    to_style() {
        return `rgba(${this.red}, ${this.green}, ${this.blue}, ${this.alpha})`;
    }
    static BLACK = Color.opaque(0, 0, 0);
    static WHITE = Color.opaque(255, 255, 255);
}
class Rectangle {
    top_left;
    size;
    constructor(top_left, size) {
        this.top_left = top_left;
        this.size = size;
    }
}
class RectangleGraphic {
    rectangle;
    stroke_style;
    fill_style;
    constructor(rectangle, fill_color, stroke_style) {
        this.rectangle = rectangle;
        this.stroke_style = stroke_style;
        this.fill_style = fill_color ?? Color.WHITE;
    }
    draw_on(canvas) {
        canvas.fillStyle = this.fill_style.to_style();
        const rectangle = this.rectangle;
        const top_left = rectangle.top_left;
        const size = rectangle.size;
        const stroke_style = this.stroke_style;
        let drawer = () => canvas.fill();
        if (stroke_style !== undefined) {
            canvas.lineWidth = stroke_style.weight;
            canvas.strokeStyle = stroke_style.color.to_style();
            drawer = () => { canvas.fill(); canvas.stroke(); };
        }
        canvas.rect(top_left.x, top_left.y, size.width, size.height);
        drawer();
    }
}
class Line {
    start;
    end;
    constructor(start, end) {
        this.start = start;
        this.end = end;
    }
}
class LineGraphic {
    line;
    stroke_style;
    constructor(line, stroke_style) {
        this.line = line;
        this.stroke_style = stroke_style ?? { color: Color.BLACK, weight: 1 };
    }
    draw_on(canvas) {
        const stroke_style = this.stroke_style;
        canvas.lineWidth = stroke_style.weight;
        canvas.strokeStyle = stroke_style.color.to_style();
        canvas.beginPath();
        const line = this.line;
        const start = line.start;
        const end = line.end;
        canvas.moveTo(start.x, start.y);
        canvas.lineTo(end.x, end.y);
        canvas.stroke();
    }
}
// type CanvasPosition = NewType<Position, "CanvasPosition">;
// type MathPosition = NewType<Position, "MathPosition">;
class MathCanvas {
    canvas;
    origin;
    unit_size;
    constructor(canvas, origin, unit_size) {
        this.canvas = canvas;
        this.origin = origin;
        this.unit_size = unit_size;
    }
    to_canvas_x(math_x) {
        return this.origin.x + (math_x * this.unit_size);
    }
    to_canvas_y(math_y) {
        return this.origin.y + (-math_y * this.unit_size);
    }
    to_canvas_position(position) {
        return {
            x: this.to_canvas_x(position.x),
            y: this.to_canvas_y(position.y)
        };
    }
    to_math_x(canvas_x) {
        return (canvas_x - this.origin.x) / this.unit_size;
    }
    to_math_y(canvas_y) {
        return ((canvas_y - this.origin.y) / this.unit_size) * -1;
    }
    to_math_position(position) {
        return {
            x: this.to_math_x(position.x),
            y: this.to_math_y(position.y)
        };
    }
}
class MathLineGraphic {
    line_graphic;
    constructor(line_graphic) {
        this.line_graphic = line_graphic;
    }
    draw_on(canvas) {
        const graphic = this.line_graphic;
        const line = graphic.line;
        const start = line.start;
        const end = line.end;
        new LineGraphic(new Line(canvas.to_canvas_position(start), canvas.to_canvas_position(end)), graphic.stroke_style).draw_on(canvas.canvas);
    }
}
// #endregion math.ts
const canvas_element = unwrap_option(document.getElementById("canvas"));
const canvas = canvas_element.getContext("2d");
assert(canvas !== null, "Failed to retrieve the canvas context!");
let width = 0;
let height = 0;
// const unit_size = 30;
const render = () => {
    canvas_element.width = width;
    canvas_element.height = height;
    new RectangleGraphic(new Rectangle({ x: 0, y: 0 }, { width: width, height: height }), Color.WHITE, { color: Color.BLACK, weight: 1, }).draw_on(canvas);
    const line_color = Color.monochrome(200);
    const middle_x = width / 2;
    const middle_y = height / 2;
    const unit_size = 30;
    const math_canvas = new MathCanvas(canvas, { x: middle_x, y: middle_y }, unit_size);
    console.log("-------------");
    console.log(math_canvas.to_canvas_y(math_canvas.to_math_y(0)));
    console.log(height);
    console.log(math_canvas.to_canvas_y(math_canvas.to_math_y(height)));
    const draw_vertical_line = (at_x, weight = 1) => {
        new MathLineGraphic(new LineGraphic(new Line({ x: at_x, y: math_canvas.to_math_y(0) }, { x: at_x, y: math_canvas.to_math_y(height) }), { color: line_color, weight: weight })).draw_on(math_canvas);
    };
    const draw_horizontal_line = (at_y, weight = 1) => {
        new MathLineGraphic(new LineGraphic(new Line({ x: math_canvas.to_math_x(0), y: at_y }, { x: math_canvas.to_math_x(width), y: at_y }), { color: line_color, weight: weight })).draw_on(math_canvas);
    };
    draw_vertical_line(0, 2);
    draw_horizontal_line(0, 2);
    new MathLineGraphic(new LineGraphic(new Line({ x: 2, y: 2 }, { x: -5, y: 5 }))).draw_on(math_canvas);
};
let render_request = undefined;
const request_render = () => {
    if (render_request !== undefined) {
        return;
    }
    render_request = requestAnimationFrame(() => {
        render();
        render_request = undefined;
    });
};
const resize_canvas = (entries) => {
    const [canvas_resize] = entries;
    assert(canvas_resize !== undefined, "The resize observer might not be targeted on the canvas!");
    const screen_size = canvas_resize.contentBoxSize[0];
    assert(screen_size !== undefined, "The resize observer couldn't get a size!");
    width = screen_size.inlineSize;
    height = screen_size.blockSize;
    request_render();
};
const canvas_observer = new ResizeObserver(resize_canvas);
canvas_observer.observe(canvas_element);
window.addEventListener("mousemove", () => request_render());
window.addEventListener("mousedown", () => request_render());
window.addEventListener("mouseup", () => request_render());
//# sourceMappingURL=index.js.map