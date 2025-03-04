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
    point;
    angle;
    constructor(point, angle) {
        this.point = point;
        this.angle = angle;
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
        const canvas_element = canvas.canvas;
        const top_left = canvas.transform_point(new DOMPoint(0, 0));
        const bottom_right = canvas.transform_point(new DOMPoint(canvas_element.width, canvas_element.height));
        const line = this.line;
        const point = line.point;
        const point_x = point.x;
        let start = new DOMPoint(point_x, top_left.y);
        let end = new DOMPoint(point_x, bottom_right.y);
        const angle = line.angle;
        const is_90 = (modulo(angle + (Math.PI / 2), Math.PI)) <= 0.001;
        if (!is_90) {
            const slope = Math.tan(angle);
            const y_intercept = point.y - slope * point.x;
            const line_function = (x) => {
                return slope * x + y_intercept;
            };
            const leftmost_x = top_left.x;
            const rightmost_x = bottom_right.x;
            start = new DOMPoint(leftmost_x, line_function(leftmost_x));
            end = new DOMPoint(rightmost_x, line_function(rightmost_x));
        }
        new LineSegmentGraphic(new LineSegment(start, end), this.stroke_style).draw(canvas);
    }
}
class LineSegment {
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
class Transform {
    matrix;
    inverse;
    constructor(matrix) {
        this.matrix = matrix;
        this.inverse = matrix.inverse();
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
    apply(canvas, draw) {
        const old_transform = canvas.getTransform();
        const matrix = this.matrix;
        canvas.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
        const old_line_width = canvas.lineWidth;
        canvas.lineWidth = 1 / canvas.average_unit_size();
        draw(canvas);
        canvas.setTransform(old_transform);
        canvas.lineWidth = old_line_width;
    }
}
// #endregion draw.ts
const canvas_element = unwrap_option(document.getElementById("canvas"));
const canvas = canvas_element.getContext("2d");
assert(canvas !== null, "Failed to retrieve the canvas context!");
let width = 0;
let height = 0;
const draw_number_plane = (canvas) => {
    const line_color = Color.monochrome(200);
    const draw_vertical_line = (at_x, weight = 1) => {
        new LineGraphic(new Line(new DOMPoint(at_x, 0), Math.PI / 2), { color: line_color, weight: weight }).draw(canvas);
    };
    const draw_horizontal_line = (at_y, weight = 1) => {
        new LineGraphic(new Line(new DOMPoint(0, at_y), 0), { color: line_color, weight: weight }).draw(canvas);
    };
    const ZERO = new DOMPoint(0, 0);
    const unit_size = canvas.average_unit_size();
    const screen_origin = canvas.untransform_point(ZERO);
    const start_positions = canvas.transform_point(new DOMPoint(screen_origin.x % unit_size, screen_origin.y % unit_size));
    const end_positions = canvas.transform_point(new DOMPoint(width, height));
    while (start_positions.x < end_positions.x) {
        draw_vertical_line(start_positions.x);
        start_positions.x += 1;
    }
    while (start_positions.y > end_positions.y) {
        draw_horizontal_line(start_positions.y);
        start_positions.y -= 1;
    }
    draw_vertical_line(0, 2);
    draw_horizontal_line(0, 2);
};
const render = () => {
    canvas_element.width = width;
    canvas_element.height = height;
    new RectangleGraphic(new Rectangle(new DOMPoint(0, 0), { width: width, height: height }), Color.WHITE, { color: Color.BLACK, weight: 1, }).draw(canvas);
    const middle_x = width / 2;
    const middle_y = height / 2;
    const unit_size = 30;
    const cartesian = Transform.translate_scale(new DOMPoint(middle_x, middle_y), unit_size, false, true);
    cartesian.apply(canvas, (canvas) => {
        draw_number_plane(canvas);
        new LineSegmentGraphic(new LineSegment(new DOMPoint(2, 2), new DOMPoint(-5, 5))).draw(canvas);
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