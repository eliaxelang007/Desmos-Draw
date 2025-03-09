"use strict";
// #region type_help.ts
// #endregion type_help.ts
// #region asserts.ts
class AssertionError extends Error {
}
function assert(condition, message) {
    if (condition)
        return;
    throw new AssertionError(message);
}
function map_option(option, mapper) {
    return (is_some_option(option)) ? mapper(option) : option;
}
function is_some_option(option) {
    return option !== undefined && option !== null;
}
function unwrap_option(option) {
    assert(is_some_option(option), "Called unwrap on a None value!");
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
    clamp(value) {
        const max = this.max;
        const min = this.min;
        if (value > max)
            return max;
        if (value < min)
            return min;
        return value;
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
class Variable {
    name;
    constructor(name) {
        this.name = name;
    }
    variables() {
        return new Set([this.name]);
    }
    simplify(substitutions) {
        return map_option(substitutions[this.name], (substitution) => [substitution]) ?? [new Variable(this.name)];
    }
    to_string() {
        return this.name;
    }
}
class Value {
    value;
    constructor(value) {
        this.value = value;
    }
    variables() {
        return new Set();
    }
    simplify(_) {
        return [this];
    }
    to_string() {
        return `${this.value}`;
    }
}
class BinaryOperator {
    a;
    b;
    constructor(a, b) {
        this.a = a;
        this.b = b;
    }
    variables() {
        return new Set([
            ...this.a.variables(),
            ...this.b.variables()
        ]);
    }
    simplify(substitutions) {
        const a = this.a.simplify(substitutions);
        const b = this.b.simplify(substitutions);
        const simplifications = [];
        for (const a_simplification of a) {
            for (const b_simplification of b) {
                for (const result of this.operate(a_simplification, b_simplification)) {
                    simplifications.push(result);
                }
            }
        }
        return simplifications;
    }
}
class Add extends BinaryOperator {
    operate(a, b) {
        if (a instanceof Value && b instanceof Value) {
            const a_value = a.value;
            const b_value = b.value;
            if (a_value === undefined || b_value === undefined) {
                return [new Value(undefined)];
            }
            return [new Value(a_value + b_value)];
        }
        return [new Add(a, b)];
    }
    to_string() {
        return `(${this.a.to_string()} + ${this.b.to_string()})`;
    }
}
class Subtract extends Add {
    constructor(a, b) {
        super(a, new Multiply(b, new Value(-1)));
    }
}
class Divide extends BinaryOperator {
    operate(a, b) {
        if (a instanceof Value && b instanceof Value) {
            const a_value = a.value;
            const b_value = b.value;
            if (a_value === undefined || b_value === undefined || b_value === 0) {
                return [new Value(undefined)];
            }
            return [new Value(a_value / b_value)];
        }
        return [new Divide(a, b)];
    }
    to_string() {
        return `(${this.a.to_string()} / ${this.b.to_string()})`;
    }
}
class Multiply extends Divide {
    constructor(a, b) {
        super(a, new Divide(new Value(1), b));
    }
}
class UnaryOperator {
    value;
    constructor(value) {
        this.value = value;
    }
    variables() {
        return this.value.variables();
    }
    simplify(substitutions) {
        const value = this.value.simplify(substitutions);
        const simplifications = [];
        for (const simplification of value) {
            for (const result of this.operate(simplification)) {
                simplifications.push(result);
            }
        }
        return simplifications;
    }
}
class PrincipalSqrt extends UnaryOperator {
    operate(expression) {
        if (expression instanceof Value) {
            const value = expression.value;
            return [new Value((value === undefined) ? undefined : Math.sqrt(value))];
        }
        return [new PrincipalSqrt(expression)];
    }
    to_string() {
        return `(+sqrt(${this.value.to_string()}))`;
    }
}
class Sqrt extends PrincipalSqrt {
    operate(value) {
        return super.operate(value).flatMap((operated) => [
            operated,
            ...new Multiply(operated, new Value(-1)).simplify({})
        ]);
    }
    to_string() {
        return `(sqrt(${this.value.to_string()}))`;
    }
}
CanvasRenderingContext2D.prototype.to_coordinate_space = function (point) {
    // return point.matrixTransform(this.getTransform().inverse()) as CoordinateSpace;
};
CanvasRenderingContext2D.prototype.to_screen_space = function (point) {
    return;
    //return point.matrixTransform(this.getTransform()) as ScreenSpace;
};
CanvasRenderingContext2D.prototype.unit_size = function () {
    const matrix = this.getTransform();
    const x_scale = matrix.a;
    const y_skew = matrix.b;
    const x_skew = matrix.c;
    const y_scale = matrix.d;
    return { width: Math.sqrt((x_scale * x_scale) + (y_skew * y_skew)), height: Math.sqrt((y_scale * y_scale) + (x_skew * x_skew)) };
};
DOMPoint.prototype.squared_distance = function (other) {
    const x_delta = this.x - other.x;
    const y_delta = this.y - other.y;
    return (x_delta * x_delta) + (y_delta * y_delta);
};
DOMPoint.prototype.distance = function (other) {
    return Math.sqrt(this.squared_distance(other));
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
    constructor(rectangle, stroke_style, fill_style) {
        this.rectangle = rectangle;
        this.stroke_style = stroke_style;
        this.fill_style = fill_style;
    }
    draw(canvas) {
        const rectangle = this.rectangle;
        const start = rectangle.start;
        const end = rectangle.end;
        canvas.beginPath();
        canvas.rect(start.x, start.y, end.x - start.x, end.y - start.y);
        canvas.closePath();
        map_option(this.fill_style, (fill_style) => {
            canvas.fillStyle = fill_style.to_style();
            canvas.fill();
        });
        map_option(this.stroke_style, (stroke_style) => {
            const unit_line_width = canvas.lineWidth;
            canvas.lineWidth = stroke_style.weight * unit_line_width;
            canvas.strokeStyle = stroke_style.color.to_style();
            canvas.stroke();
            canvas.lineWidth = unit_line_width;
        });
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
class Path {
    points;
    constructor(points) {
        this.points = points;
    }
}
class PathGraphic {
    path;
    stroke_style;
    constructor(path, stroke_style) {
        this.path = path;
        this.stroke_style = stroke_style;
    }
    draw(canvas) {
        const path = this.path;
        const points = [...path.points];
        const start = points.shift();
        if (is_some_option(start)) {
            canvas.beginPath();
            canvas.moveTo(start.x, start.y);
            for (const point of points) {
                canvas.lineTo(point.x, point.y);
            }
        }
        map_option(this.stroke_style, (stroke_style) => {
            const unit_line_width = canvas.lineWidth;
            canvas.lineWidth = stroke_style.weight * unit_line_width;
            canvas.strokeStyle = stroke_style.color.to_style();
            canvas.stroke();
            canvas.lineWidth = unit_line_width;
        });
    }
}
class LineSegmentGraphic {
    line;
    stroke_style;
    constructor(line, stroke_style) {
        this.line = line;
        this.stroke_style = stroke_style;
    }
    draw(canvas) {
        const line = this.line;
        new PathGraphic(new Path([line.start, line.end]), this.stroke_style).draw(canvas);
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
        const top_left = canvas.to_coordinate_space(new DOMPoint(0, 0));
        const bottom_right = canvas.to_coordinate_space(new DOMPoint(canvas_element.width, canvas_element.height));
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
class Ellipse {
    center;
    horizontal_radius;
    vertical_radius;
    constructor(center, horizontal_radius, vertical_radius) {
        this.center = center;
        this.horizontal_radius = horizontal_radius;
        this.vertical_radius = vertical_radius;
    }
}
class EllipseGraphic {
    ellipse;
    stroke_style;
    fill_style;
    constructor(ellipse, stroke_style, fill_style) {
        this.ellipse = ellipse;
        this.stroke_style = stroke_style;
        this.fill_style = fill_style;
    }
    draw(canvas) {
        const ellipse = this.ellipse;
        const center = ellipse.center;
        const horizontal_radius = ellipse.horizontal_radius;
        const vertical_radius = ellipse.vertical_radius;
        canvas.beginPath();
        canvas.ellipse(center.x, center.y, Math.abs(horizontal_radius), Math.abs(vertical_radius), 0, 0, 2 * Math.PI);
        canvas.closePath();
        map_option(this.fill_style, (fill_style) => {
            canvas.fillStyle = fill_style.to_style();
            canvas.fill();
        });
        map_option(this.stroke_style, (stroke_style) => {
            const unit_line_width = canvas.lineWidth;
            canvas.lineWidth = stroke_style.weight * unit_line_width;
            canvas.strokeStyle = stroke_style.color.to_style();
            canvas.stroke();
            canvas.lineWidth = unit_line_width;
        });
    }
}
class MathFunctionGraphic {
    stroke_style;
    function_variable;
    step;
    math_functions;
    constructor(math_function, stroke_style, step) {
        this.stroke_style = stroke_style;
        const variables = math_function.variables();
        assert(variables.size === 1 && (variables.has("x") || variables.has("y")), "You can't draw a function that doesn't have either an x or a y variable!");
        this.function_variable = unwrap_option(variables.values().next().value);
        this.math_functions = math_function.simplify({});
        this.step = step ?? 0.0003;
    }
    draw(canvas) {
        const canvas_element = canvas.canvas;
        const top_left = canvas.to_coordinate_space(new DOMPoint(0, 0));
        const bottom_right = canvas.to_coordinate_space(new DOMPoint(canvas_element.width, canvas_element.height));
        const function_variable = this.function_variable;
        const x_based = function_variable === "x";
        const [start, end] = (x_based) ? [top_left.x, bottom_right.x] : [bottom_right.y, top_left.y];
        for (const math_function of this.math_functions) {
            const points = [];
            let variable = start;
            const stroke_style = this.stroke_style;
            while (variable <= end) {
                const function_simplification = math_function.simplify({
                    [function_variable]: new Value(variable)
                });
                assert(function_simplification.length === 1, "The math function had multiple outputs!?");
                const [function_output] = function_simplification;
                assert(function_output instanceof Value, "The math function had an output that wasn't a value!");
                const output = function_output.value;
                if (!is_some_option(output)) {
                    const point_count = points.length;
                    if (point_count >= 1) {
                        new PathGraphic(new Path(points), stroke_style).draw(canvas);
                    }
                    points.length = 0;
                }
                points.push((x_based) ? new DOMPoint(variable, output) : new DOMPoint(output, variable));
                variable += this.step;
            }
            new PathGraphic(new Path(points), stroke_style).draw(canvas);
        }
    }
}
// class Parabola {
//     readonly math_function: Expression;
//     constructor(
//         axis: "x" | "y",
//         vertex: DOMPoint,
//     )
// }
class NumberPlaneGraphic {
    axis_style;
    tick_line_style;
    unit_size;
    origin;
    constructor(axis_style, tick_line_style, unit_size, origin) {
        this.axis_style = axis_style;
        this.tick_line_style = tick_line_style;
        this.origin = origin ?? new DOMPoint(0, 0);
        this.unit_size = unit_size ?? { width: 1, height: 1 };
    }
    draw(canvas) {
        const origin = this.origin;
        const unit_size = this.unit_size;
        const top_left = canvas.to_coordinate_space(new DOMPoint(0, 0));
        const screen_unit_size = canvas.to_screen_space(new DOMPoint(top_left.x + unit_size.width, top_left.y + unit_size.height));
        const screen_origin = canvas.to_screen_space(origin);
        const canvas_element = canvas.canvas;
        const start_positions = canvas.to_coordinate_space(new DOMPoint(screen_origin.x % screen_unit_size.x, screen_origin.y % screen_unit_size.y));
        const end_positions = canvas.to_coordinate_space(new DOMPoint(canvas_element.width, canvas_element.height));
        const draw_vertical_line = (at_x, stroke_style) => {
            new LineGraphic(new Line(new DOMPoint(at_x, 0), new DOMPoint(at_x, 1)), stroke_style).draw(canvas);
        };
        const draw_horizontal_line = (at_y, stroke_style) => {
            new LineGraphic(new Line(new DOMPoint(0, at_y), new DOMPoint(1, at_y)), stroke_style).draw(canvas);
        };
        const tick_line_style = this.tick_line_style;
        while (start_positions.x < end_positions.x) {
            draw_vertical_line(start_positions.x, tick_line_style);
            start_positions.x += 1;
        }
        while (start_positions.y > end_positions.y) {
            draw_horizontal_line(start_positions.y, tick_line_style);
            start_positions.y -= 1;
        }
        const axis_style = this.axis_style;
        draw_vertical_line(origin.x, axis_style);
        draw_horizontal_line(origin.y, axis_style);
    }
}
class Transform {
    matrix;
    constructor(matrix) {
        this.matrix = matrix;
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
        if (is_some_option(matrix)) {
            canvas.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
        }
        else {
            canvas.resetTransform();
        }
        const unit_size = canvas.unit_size();
        canvas.lineWidth = 1 / ((unit_size.width + unit_size.height) / 2);
    }
}
// #endregion draw.ts
// #region elements.ts
// #region control.ts
class Property {
    constructor() { }
}
class PointProperty extends Property {
    setter;
    getter;
    constructor(setter, getter) {
        super();
        this.setter = setter;
        this.getter = getter;
    }
}
class AxisProperty extends Property {
    axis;
    setter;
    getter;
    constructor(axis, setter, getter) {
        super();
        this.axis = axis;
        this.setter = setter;
        this.getter = getter;
    }
}
class ControlPoint {
    point;
    control;
    static current_id = 0;
    static selected = undefined;
    id;
    radius;
    constructor(point, control, radius) {
        this.point = point;
        this.control = control;
        this.id = ControlPoint.current_id;
        ControlPoint.current_id += 1;
        this.radius = radius ?? 0.25;
    }
    update(_, input) {
        const control = this.control;
        const mouse = input.mouse;
        const mouse_position = mouse.position;
        const point = this.point();
        const id = this.id;
        if (point.distance(mouse_position) < this.radius &&
            mouse.is_down &&
            ControlPoint.selected === undefined) {
            ControlPoint.selected = this.id;
        }
        if (id === ControlPoint.selected) {
            if (control instanceof PointProperty) {
                control.setter(mouse_position);
            }
            else if (control instanceof AxisProperty) {
                control.setter((control.axis === "x") ? mouse_position.x : mouse_position.y);
            }
            if (!mouse.is_down) {
                ControlPoint.selected = undefined;
            }
        }
    }
    to_drawable() {
        const radius = this.radius;
        return new EllipseGraphic(new Ellipse(this.point(), radius, radius), undefined, Color.opaque(65, 165, 238));
    }
}
class DesmosLineSegment {
    line;
    constructor(line) {
        this.line = line;
    }
    properties() {
        return {
            start: new PointProperty((point) => { this.line.start = point; }, () => this.line.start),
            end: new PointProperty((point) => { this.line.end = point; }, () => this.line.end),
        };
    }
    controls() {
        const properties = this.properties();
        return {
            start: new ControlPoint(() => this.line.start, properties.start),
            end: new ControlPoint(() => this.line.end, properties.end)
        };
    }
    to_drawable(stroke_style, _) {
        return new LineSegmentGraphic(this.line, stroke_style);
    }
}
class DesmosEllipse {
    ellipse;
    constructor(ellipse) {
        this.ellipse = ellipse;
    }
    properties() {
        return {
            center: new PointProperty((point) => { this.ellipse.center = point; }, () => this.ellipse.center),
            horizontal_radius: new AxisProperty("x", (horizontal) => {
                const ellipse = this.ellipse;
                ellipse.horizontal_radius = horizontal - ellipse.center.x;
            }, () => this.ellipse.horizontal_radius),
            vertical_radius: new AxisProperty("y", (vertical) => {
                const ellipse = this.ellipse;
                ellipse.vertical_radius = vertical - ellipse.center.y;
            }, () => this.ellipse.vertical_radius)
        };
    }
    controls() {
        const properties = this.properties();
        return {
            horizontal_radius: new ControlPoint(() => {
                const ellipse = this.ellipse;
                const center = ellipse.center;
                return new DOMPoint(center.x + ellipse.horizontal_radius, center.y);
            }, properties.horizontal_radius),
            vertical_radius: new ControlPoint(() => {
                const ellipse = this.ellipse;
                const center = ellipse.center;
                return new DOMPoint(center.x, center.y + ellipse.vertical_radius);
            }, properties.vertical_radius),
            center: new ControlPoint(() => this.ellipse.center, properties.center)
        };
    }
    to_drawable(stroke_style, fill_style) {
        return new EllipseGraphic(this.ellipse, stroke_style, fill_style);
    }
}
class DesmosDraw {
    current_id;
    selected_controls;
    shapes;
    constructor() {
        this.current_id = 0;
        this.shapes = new Map();
    }
    add_shape(shape) {
        const current_id = this.current_id;
        this.current_id += 1;
        this.shapes.set(current_id, shape);
        this.select_shape(current_id);
        return current_id;
    }
    remove_shape(id) {
        this.selected_controls = undefined;
        return this.shapes.delete(id);
    }
    select_shape(id) {
        this.selected_controls = map_option(this.shapes.get(id), (shape) => shape.controls());
    }
    update(delta_time, input) {
        map_option(this.selected_controls, (selected_controls) => {
            for (const control_point of Object.values(selected_controls)) {
                control_point.update(delta_time, input);
            }
        });
    }
    draw(canvas) {
        const canvas_element = canvas.canvas;
        const width = canvas_element.width;
        const height = canvas_element.height;
        const identity_transform = new Transform();
        identity_transform.draw(canvas);
        new RectangleGraphic(new Rectangle(new DOMPoint(0, 0), new DOMPoint(width, height)), { color: Color.BLACK, weight: 1 }, Color.WHITE).draw(canvas);
        const middle_x = width / 2;
        const middle_y = height / 2;
        const unit_size = 30;
        const cartesian_transform = Transform.translate_scale(new DOMPoint(middle_x, middle_y), unit_size, false, true);
        cartesian_transform.draw(canvas);
        const line_color = Color.monochrome(200);
        new NumberPlaneGraphic({ color: line_color, weight: 2 }, { color: line_color, weight: 1 }).draw(canvas);
        // new MathFunctionGraphic(
        //     new Sqrt(new Subtract(new Value(2), new Multiply(new Variable("x"), new Variable("x")))),
        //     // new Multiply(new Variable("x"), new Variable("x")),
        //     {
        //         color: Color.BLACK,
        //         weight: 1
        //     }
        // ).draw(canvas);
        map_option(this.selected_controls, (selected_controls) => {
            for (const control_point of Object.values(selected_controls)) {
                control_point.to_drawable().draw(canvas);
            }
        });
        for (const shape of this.shapes.values()) {
            shape.to_drawable({
                color: Color.BLACK,
                weight: 1
            }).draw(canvas);
        }
    }
}
const canvas_element = unwrap_option(document.getElementById("canvas"));
const canvas = unwrap_option(canvas_element.getContext("2d"));
const desmos_draw = new DesmosDraw();
const TARGET_FPS = 60;
const FRAME_TIME = 1000 / TARGET_FPS;
let previous_time_ms = 0;
let mouse_position = new DOMPoint(0, 0);
let is_down = false;
window.addEventListener("mousemove", (event) => {
    const canvas_rect = canvas_element.getBoundingClientRect();
    mouse_position = canvas.to_coordinate_space(new DOMPoint(event.clientX - canvas_rect.left, event.clientY - canvas_rect.top));
});
window.addEventListener("mousedown", () => { is_down = true; });
window.addEventListener("mouseup", () => { is_down = false; });
function loop(timestamp) {
    const delta_time = timestamp - previous_time_ms;
    if (delta_time >= FRAME_TIME) {
        previous_time_ms = timestamp;
        desmos_draw.update(delta_time, {
            mouse: {
                position: mouse_position,
                is_down: is_down
            }
        });
        desmos_draw.draw(canvas);
    }
    requestAnimationFrame(loop);
}
;
const shapes = unwrap_option(document.getElementById("shapes"));
[
    ["line_tool", () => new DesmosLineSegment(new Line(new DOMPoint(-1, -1), new DOMPoint(1, 1)))],
    ["ellipse_tool", () => new DesmosEllipse(new Ellipse(new DOMPoint(0, 0), 1, 1))],
    ["parabola_tool", () => undefined],
    ["hyperbola_tool", () => undefined]
].map(([element_name, builder]) => unwrap_option(document.getElementById(element_name))
    .addEventListener("click", () => {
    let id = desmos_draw.add_shape(unwrap_option(builder()));
    const selection_element = document.createElement("div");
    const name = document.createElement("p");
    name.innerHTML = element_name.split("_").slice(0, -1).map((part) => unwrap_option(part[0]).toUpperCase() + part.substring(1).toLowerCase()).join(" ");
    selection_element.appendChild(name);
    const deleter = document.createElement("button");
    deleter.onclick = () => {
        desmos_draw.remove_shape(id);
        shapes.removeChild(selection_element);
    };
    deleter.innerHTML = "<span class='material-symbols-outlined'>delete</span>";
    selection_element.appendChild(deleter);
    const selecter = document.createElement("input");
    selecter.type = "radio";
    selecter.name = "selected_element";
    selecter.onclick = () => {
        desmos_draw.select_shape(id);
    };
    selection_element.appendChild(selecter);
    shapes.appendChild(selection_element);
    //     <div>
    //     <p>Hyperbola</p>
    //     <button><span class="material-symbols-outlined">delete</span></button>
    //     <input type="radio" name="selected_element" id="0"></input>
    // </div>
}));
// let math_function = new Add(new Add(new Value(1), new Variable("x")), new Sqrt(new Add(new Value(1), new Sqrt(new Variable("y")))));
// console.log(math_function.to_string());
// console.log(math_function.simplify({}).map((e) => e.to_string()));
let start_game = () => {
    start_game = () => { };
    requestAnimationFrame(loop);
};
function resize_canvas(entries) {
    const [canvas_resize] = entries;
    assert(is_some_option(canvas_resize), "The resize observer might not be targeted on the canvas!");
    const screen_size = canvas_resize.contentBoxSize[0];
    assert(is_some_option(screen_size), "The resize observer couldn't get a size!");
    canvas_element.width = screen_size.inlineSize;
    canvas_element.height = screen_size.blockSize;
    start_game();
}
;
const canvas_observer = new ResizeObserver(resize_canvas);
canvas_observer.observe(canvas_element);
// #endregion main.ts
//# sourceMappingURL=index.js.map