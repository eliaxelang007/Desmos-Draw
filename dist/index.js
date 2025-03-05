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
function modulo(dividend, divisor) {
    return ((dividend % divisor) + divisor) % divisor;
}
CanvasRenderingContext2D.prototype.transform_point = function (untransformed_point) {
    return untransformed_point.matrixTransform(this.getTransform().inverse());
};
CanvasRenderingContext2D.prototype.untransform_point = function (transformed_point) {
    return transformed_point.matrixTransform(this.getTransform());
};
CanvasRenderingContext2D.prototype.average_unit_size = function () {
    const matrix = this.getTransform();
    const x_scale = matrix.a;
    const y_skew = matrix.b;
    const x_skew = matrix.c;
    const y_scale = matrix.d;
    const pure_x_scale = Math.sqrt((x_scale * x_scale) + (y_skew * y_skew));
    const pure_y_scale = Math.sqrt((y_scale * y_scale) + (x_skew * x_skew));
    return ((pure_x_scale + pure_y_scale) / 2);
};
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
    start;
    end;
    constructor(start, end) {
        this.start = start;
        this.end = end;
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
        const start = rectangle.start;
        const end = rectangle.end;
        const stroke_style = this.stroke_style;
        canvas.rect(start.x, start.y, end.x - start.x, end.y - start.y);
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
class LineGraphic {
    line;
    stroke_style;
    constructor(line, stroke_style) {
        this.line = line;
        this.stroke_style = stroke_style;
    }
    draw(canvas) {
        const line = this.line;
        const start = line.start;
        const end = line.end;
        const x_delta = end.x - start.x;
        const canvas_element = canvas.canvas;
        const bottom_right = canvas.transform_point(new DOMPoint(canvas_element.width, canvas_element.height));
        const top_left = canvas.transform_point(new DOMPoint(0, 0));
        const is_90 = x_delta <= 0.001;
        new LineSegmentGraphic((is_90) ? new Line(new DOMPoint(start.x, top_left.y), new DOMPoint(end.x, bottom_right.y)) : (() => {
            const slope = (end.y - start.y) / x_delta;
            const y_intercept = start.y - slope * start.x;
            const line_function = (x) => {
                return slope * x + y_intercept;
            };
            const leftmost_x = top_left.x;
            const rightmost_x = bottom_right.x;
            return new Line(new DOMPoint(leftmost_x, line_function(leftmost_x)), new DOMPoint(rightmost_x, line_function(rightmost_x)));
        })(), this.stroke_style).draw(canvas);
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
class LineSegmentGraphic {
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
class NumberPlane {
    unit_size;
    constructor(unit_size) {
        this.unit_size = unit_size;
    }
}
class NumberPlaneGraphic {
    number_plane;
    axis_style;
    tick_line_style;
    constructor(number_plane, axis_style, tick_line_style) {
        this.number_plane = number_plane;
        this.axis_style = axis_style;
        this.tick_line_style = tick_line_style;
    }
    draw(canvas) {
        const draw_vertical_line = (at_x, stroke_style) => {
            new LineGraphic(new Line(new DOMPoint(at_x, 0), new DOMPoint(at_x, 1)), stroke_style).draw(canvas);
        };
        const draw_horizontal_line = (at_y, stroke_style) => {
            new LineGraphic(new Line(new DOMPoint(0, at_y), new DOMPoint(1, at_y)), stroke_style).draw(canvas);
        };
        const tick_line_style = this.tick_line_style;
        const ZERO = new DOMPoint(0, 0);
        const unit_size = this.number_plane.unit_size;
        const screen_origin = canvas.untransform_point(ZERO);
        const start_positions = canvas.transform_point(new DOMPoint(screen_origin.x % unit_size, screen_origin.y % unit_size));
        const canvas_element = canvas.canvas;
        const end_positions = canvas.transform_point(new DOMPoint(canvas_element.width, canvas_element.height));
        while (start_positions.x < end_positions.x) {
            draw_vertical_line(start_positions.x, tick_line_style);
            start_positions.x += 1;
        }
        while (start_positions.y > end_positions.y) {
            draw_horizontal_line(start_positions.y, tick_line_style);
            start_positions.y -= 1;
        }
        const axis_style = this.axis_style;
        draw_vertical_line(0, axis_style);
        draw_horizontal_line(0, axis_style);
    }
}
class Transform {
    matrix;
    // readonly inverse: DOMMatrix;
    constructor(matrix) {
        this.matrix = matrix;
        // this.inverse = matrix.inverse();
    }
    static from_values(x_transform, y_transform, translation) {
        return new Transform(new DOMMatrix([
            x_transform.scale,
            y_transform.skew,
            x_transform.skew,
            y_transform.scale,
            translation.x,
            translation.y
        ]));
    }
    static translate_scale(translation, scaling, flip_x = false, flip_y = false) {
        const to_flipper = (should_flip) => (should_flip) ? -1 : 1;
        return Transform.from_values({
            scale: (scaling * to_flipper(flip_x)),
            skew: 0
        }, {
            scale: (scaling * to_flipper(flip_y)),
            skew: 0
        }, translation);
    }
    draw(canvas) {
        const matrix = this.matrix;
        canvas.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
        canvas.lineWidth = 1 / canvas.average_unit_size();
    }
}
// #endregion draw.ts
const canvas_element = unwrap_option(document.getElementById("canvas"));
const canvas = canvas_element.getContext("2d");
assert(canvas !== null, "Failed to retrieve the canvas context!");
const selected = 0;
const elements = new Map([
    [0, new Line(new DOMPoint(2, 2), new DOMPoint(-5, 5))]
]);
canvas_element.addEventListener("mousedown", (event) => {
    // const area = canvas_element.getBoundingClientRect();
    // const position = canvas.transform_point(
    //     new DOMPoint(
    //         event.clientX - area.left,
    //         event.clientY - area.top
    //     )
    // );
});
const render = () => {
    const width = canvas_element.width;
    const height = canvas_element.height;
    canvas.resetTransform();
    new RectangleGraphic(new Rectangle(new DOMPoint(0, 0), new DOMPoint(width, height)), Color.WHITE, { color: Color.BLACK, weight: 1, }).draw(canvas);
    const middle_x = width / 2;
    const middle_y = height / 2;
    const unit_size = 30;
    const cartesian = Transform.translate_scale(new DOMPoint(middle_x, middle_y), unit_size, false, true);
    cartesian.draw(canvas);
    const line_color = Color.monochrome(200);
    new NumberPlaneGraphic(new NumberPlane(30), { color: line_color, weight: 2 }, { color: line_color, weight: 1 }).draw(canvas);
    for (const [id, element] of elements.entries()) {
        if (element instanceof Line) {
            new LineSegmentGraphic(element).draw(canvas);
        }
        if (id == selected) {
            for (const control_point of Object.values(element)) {
            }
        }
    }
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
    canvas_element.width = screen_size.inlineSize;
    canvas_element.height = screen_size.blockSize;
    request_render();
};
const canvas_observer = new ResizeObserver(resize_canvas);
canvas_observer.observe(canvas_element);
window.addEventListener("mousemove", () => request_render());
window.addEventListener("mousedown", () => request_render());
window.addEventListener("mouseup", () => request_render());
//# sourceMappingURL=index.js.map