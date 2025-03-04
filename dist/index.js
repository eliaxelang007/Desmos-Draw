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
function map_option(option, mapper) {
    if (option === undefined) {
        return undefined;
    }
    return mapper(option);
}
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
    percentage(value) {
        const min = this.min;
        const range = this.max - min;
        const range_location = value - min;
        return (range_location / range);
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
    draw(canvas) {
        canvas.fillStyle = this.fill_style.to_style();
        const rectangle = this.rectangle;
        const top_left = rectangle.top_left;
        const size = rectangle.size;
        const stroke_style = this.stroke_style;
        canvas.rect(top_left.x, top_left.y, size.width, size.height);
        canvas.fill();
        if (stroke_style !== undefined) {
            const unit_line_width = canvas.lineWidth;
            canvas.lineWidth = stroke_style.weight * unit_line_width;
            canvas.strokeStyle = stroke_style.color.to_style();
            canvas.stroke();
            canvas.lineWidth = unit_line_width;
        }
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
    draw(canvas) {
        const stroke_style = this.stroke_style;
        canvas.beginPath();
        const line = this.line;
        const start = line.start;
        const end = line.end;
        canvas.moveTo(start.x, start.y);
        canvas.lineTo(end.x, end.y);
        const unit_line_width = canvas.lineWidth;
        canvas.lineWidth = stroke_style.weight * unit_line_width;
        canvas.strokeStyle = stroke_style.color.to_style();
        canvas.stroke();
        canvas.lineWidth = unit_line_width;
    }
}
class Transform {
    transform;
    constructor(transform) {
        this.transform = transform;
    }
    apply(canvas, draw) {
        canvas.save();
        const transform = this.transform;
        map_option(transform.translation, (translation) => canvas.translate(translation.x, translation.y));
        map_option(transform.scaling, (scaling) => {
            const percentage = scaling.percentage;
            const signs = scaling.signs;
            canvas.lineWidth = 1 / percentage;
            canvas.scale(percentage * signs.x, percentage * signs.y);
        });
        map_option(transform.rotation, (rotation) => canvas.rotate(rotation));
        draw(canvas);
        canvas.restore();
    }
}
// #endregion draw.ts
const canvas_element = unwrap_option(document.getElementById("canvas"));
const canvas = canvas_element.getContext("2d");
assert(canvas !== null, "Failed to retrieve the canvas context!");
let width = 0;
let height = 0;
// const unit_size = 30;
const render = () => {
    canvas_element.width = width;
    canvas_element.height = height;
    new RectangleGraphic(new Rectangle({ x: 0, y: 0 }, { width: width, height: height }), Color.WHITE, { color: Color.BLACK, weight: 1, }).draw(canvas);
    const middle_x = width / 2;
    const middle_y = height / 2;
    const cartesian_transform = new Transform({
        scaling: { percentage: 30, signs: { x: 1, y: -1 } },
        translation: { x: middle_x, y: middle_y }
    });
    cartesian_transform.apply(canvas, (canvas) => {
        const line_color = Color.monochrome(200);
        // const draw_vertical_line = (at_x: number, weight: number = 1) => {
        //     new LineGraphic(
        //         new Line(
        //             { x: at_x, y: canvas.to_math_y(0 as CanvasAxis) },
        //             { x: at_x, y: canvas.to_math_y(height as CanvasAxis) }
        //         ),
        //         { color: line_color, weight: weight }
        //     ).draw(canvas);
        // };
        // const draw_horizontal_line = (at_y: number, weight: number = 1) => {
        //     new LineGraphic(
        //         new Line(
        //             { x: canvas.to_math_x(0 as CanvasAxis), y: at_y },
        //             { x: canvas.to_math_x(width as CanvasAxis), y: at_y }
        //         ),
        //         { color: line_color, weight: weight }
        //     ).draw(canvas);
        // }
        // const draw_axis_gridlines = (
        //     axis: "x" | "y"
        // ) => {
        //     let [draw_line, to_math, to_canvas, middle, canvas_end, step] = 
        //         (axis === "x") ? 
        //             [draw_vertical_line, canvas.to_math_x, canvas.to_canvas_x, middle_x, width, 1] : 
        //             [draw_horizontal_line, math_canvas.to_math_y, canvas.to_canvas_y, middle_y, height, -1]; 
        //     let start_position = to_math((middle % unit_size) as CanvasAxis);
        //     while (to_canvas(start_position) < canvas_end) {
        //         draw_line(start_position);
        //         start_position = (start_position + step) as MathAxis;
        //     }
        // };
        // // let start_math_x = math_canvas.to_math_x((middle_x % unit_size) as CanvasAxis);
        // // while (math_canvas.to_canvas_x(start_math_x) < width) {
        // //     draw_vertical_line(start_math_x);
        // //     start_math_x = (start_math_x + 1) as MathAxis;
        // // }
        // // let start_math_y = math_canvas.to_math_y((middle_y % unit_size) as CanvasAxis);
        // // while (math_canvas.to_canvas_y(start_math_y) < height) {
        // //     draw_horizontal_line(start_math_y);
        // //     start_math_y = (start_math_y - 1) as MathAxis;
        // // }
        // draw_axis_gridlines();
        // draw_vertical_line(0, 2);
        // draw_horizontal_line(0, 2);
        const radius = 1;
        canvas.beginPath();
        canvas.arc(0, 0, radius, 0, 2 * Math.PI, false);
        canvas.fillStyle = 'green';
        canvas.fill();
        // canvas.lineWidth = 5 / 30;
        canvas.strokeStyle = '#003300';
        canvas.stroke();
        new LineGraphic(new Line({ x: 2, y: 2 }, { x: -5, y: 5 })).draw(canvas);
    });
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