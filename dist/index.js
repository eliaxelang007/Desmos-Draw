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
    return (is_some_option(option)) ? mapper(option) : undefined;
}
function is_some_option(option) {
    return option !== undefined && option !== null;
}
function unwrap_option(option) {
    assert(is_some_option(option), "Called unwrap on a None value!");
    return option;
}
// #endregion options.ts
// #region numbers.ts
function bi_sort(a, b) {
    return (a < b) ? [a, b] : [b, a];
}
class Extent {
    min;
    max;
    constructor(a, b) {
        [a, b] = bi_sort(a, b);
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
    static X = new Variable("x");
    static Y = new Variable("y");
    constructor(name) {
        this.name = name;
    }
    variables() {
        return new Set([this.name]);
    }
    simplify(substitutions) {
        return map_option(substitutions[this.name], (substitution) => [substitution]) ?? [this];
    }
    to_string() {
        return this.name;
    }
}
class Value {
    value;
    static UNDEFINED = new Value(undefined);
    static ONE = new Value(1);
    static NEGATIVE_ONE = new Value(-1);
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
}
class Add extends BinaryOperator {
    simplify(substitutions) {
        const a = this.a.simplify(substitutions);
        const b = this.b.simplify(substitutions);
        const simplifications = [];
        for (const a_simplification of a) {
            for (const b_simplification of b) {
                simplifications.push((() => {
                    if (a_simplification instanceof Value && b_simplification instanceof Value) {
                        const a_value = a_simplification.value;
                        const b_value = b_simplification.value;
                        if (a_value === undefined || b_value === undefined) {
                            return Value.UNDEFINED;
                        }
                        else {
                            return new Value(a_value + b_value);
                        }
                    }
                    else {
                        return new Add(a_simplification, b_simplification);
                    }
                })());
            }
        }
        return simplifications;
    }
    to_string() {
        return `(${this.a.to_string()} + ${this.b.to_string()})`;
    }
}
class Subtract extends Add {
    constructor(a, b) {
        super(a, new Multiply(b, Value.NEGATIVE_ONE));
    }
}
class Divide extends BinaryOperator {
    simplify(substitutions) {
        const a = this.a.simplify(substitutions);
        const b = this.b.simplify(substitutions);
        const simplifications = [];
        for (const a_simplification of a) {
            for (const b_simplification of b) {
                simplifications.push((() => {
                    if (a_simplification instanceof Value && b_simplification instanceof Value) {
                        const a_value = a_simplification.value;
                        const b_value = b_simplification.value;
                        if (a_value === undefined || b_value === undefined || b_value === 0) {
                            return Value.UNDEFINED;
                        }
                        else {
                            return new Value(a_value / b_value);
                        }
                    }
                    else {
                        return new Divide(a_simplification, b_simplification);
                    }
                })());
            }
        }
        return simplifications;
    }
    to_string() {
        return `(${this.a.to_string()} / ${this.b.to_string()})`;
    }
}
class Multiply extends Divide {
    constructor(a, b) {
        super(a, new Divide(Value.ONE, b));
    }
    static square(expression) {
        return new Multiply(expression, expression);
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
}
class RestrictTo {
    value;
    range;
    constructor(value, range) {
        this.value = value;
        this.range = range;
    }
    variables() {
        return this.value.variables();
    }
    simplify(substitutions) {
        const value = this.value.simplify(substitutions);
        const simplifications = [];
        for (const simplification of value) {
            simplifications.push((() => {
                if (simplification instanceof Value) {
                    const value = simplification.value;
                    if (value === undefined) {
                        return Value.UNDEFINED;
                    }
                    return new Value(this.range.contains(value) ? value : undefined);
                }
                return new RestrictTo(simplification, this.range);
            })());
        }
        return simplifications;
    }
    to_string() {
        return `(+sqrt(${this.value.to_string()}))`;
    }
}
class PrincipalSqrt extends UnaryOperator {
    simplify(substitutions) {
        const value = this.value.simplify(substitutions);
        const simplifications = [];
        for (const simplification of value) {
            simplifications.push((() => {
                if (simplification instanceof Value) {
                    const value = simplification.value;
                    return new Value((value === undefined || value < 0) ? undefined : Math.sqrt(value));
                }
                return new PrincipalSqrt(simplification);
            })());
        }
        return simplifications;
    }
    to_string() {
        return `(+sqrt(${this.value.to_string()}))`;
    }
}
class Sqrt extends PrincipalSqrt {
    simplify(substitutions) {
        return super.simplify(substitutions).flatMap((simplification) => [
            simplification,
            ...new Multiply(simplification, Value.NEGATIVE_ONE).simplify(substitutions)
        ]);
    }
    to_string() {
        return `(sqrt(${this.value.to_string()}))`;
    }
}
// #endregion expressions.ts
// #region draw.ts
const POINT_ZERO = new DOMPoint(0, 0);
CanvasRenderingContext2D.prototype.to_coordinate_space = function (point) {
    // Below is kind of a hack! (But it's faster).
    const { a: x_scale, d: y_scale, e: origin_screen_x, f: origin_screen_y } = this.getTransform();
    return new DOMPoint((point.x - origin_screen_x) / x_scale, (point.y - origin_screen_y) / y_scale);
    // Uncomment this for more correct behavior.
    // return point.matrixTransform(this.getTransform().inverse()) as CoordinateSpace;
};
CanvasRenderingContext2D.prototype.to_screen_space = function (point) {
    // Below is kind of a hack! (But it's faster).
    const { a: x_scale, d: y_scale, e: origin_screen_x, f: origin_screen_y } = this.getTransform();
    return new DOMPoint(origin_screen_x + (point.x * x_scale), origin_screen_y + (point.y * y_scale));
    // Uncomment this for more correct behavior.
    // return point.matrixTransform(this.getTransform().inverse()) as CoordinateSpace;
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
    static BIT_8_RANGE = new Extent(0, 255);
    static PERCENTAGE_RANGE = new Extent(0, 1);
    red;
    green;
    blue;
    alpha;
    constructor(red, green, blue, alpha) {
        assert([red, green, blue].every((color) => Color.BIT_8_RANGE.contains(color)), `One of your color values (${red}, ${green}, ${blue}) isn't in an 8-bit range!`);
        assert(Color.PERCENTAGE_RANGE.contains(alpha), `Your alpha value (${alpha}) isn't in the range of zero and one!`);
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
    slope() {
        const start = this.start;
        const end = this.end;
        const x_delta = end.x - start.x;
        if (x_delta === 0) {
            return undefined;
        }
        return (end.y - start.y) / x_delta;
    }
    to_latex() {
        const slope = this.slope();
        const y_intercept = this.y_intercept();
        const start = this.start;
        const end = this.end;
        if (is_some_option(slope) && is_some_option(y_intercept)) {
            let [start_x, end_x] = bi_sort(start.x, end.x);
            return `y=(${slope}x+${y_intercept})\\\\left\\\\{${start_x}<x<${end_x}\\\\right\\\\}`;
        }
        let [start_y, end_y] = bi_sort(start.y, end.y);
        return `x=${start.x}\\\\left\\\\{${start_y}<y<${end_y}\\\\right\\\\}`;
    }
    y_intercept() {
        const start = this.start;
        return map_option(this.slope(), (slope) => start.y - slope * start.x);
    }
    line_function() {
        const slope = this.slope();
        const y_intercept = this.y_intercept();
        if (is_some_option(slope) && is_some_option(y_intercept)) {
            return (x) => {
                return slope * x + y_intercept;
            };
        }
        return undefined;
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
        const canvas_element = canvas.canvas;
        const top_left = canvas.to_coordinate_space(POINT_ZERO);
        const bottom_right = canvas.to_coordinate_space(new DOMPoint(canvas_element.width, canvas_element.height));
        const line_function = line.line_function();
        new LineSegmentGraphic((is_some_option(line_function)) ? (() => {
            const leftmost_x = top_left.x;
            const rightmost_x = bottom_right.x;
            return new Line(new DOMPoint(leftmost_x, line_function(leftmost_x)), new DOMPoint(rightmost_x, line_function(rightmost_x)));
        })() : new Line(new DOMPoint(start.x, top_left.y), new DOMPoint(end.x, bottom_right.y)), this.stroke_style).draw(canvas);
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
    to_latex() {
        const center = this.center;
        const horizontal_radius = this.horizontal_radius;
        const vertical_radius = this.vertical_radius;
        return `\\\\frac{\\\\left(x-${center.x}\\\\right)^{2}}{${horizontal_radius * horizontal_radius}}+\\\\frac{\\\\left(y-${center.y}\\\\right)^{2}}{${vertical_radius * vertical_radius}}=1`;
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
        assert(variables.size <= 1 && (variables.has("x") || variables.has("y")), "You can't draw a function that doesn't have either an x or a y variable!");
        this.function_variable = unwrap_option(variables.values().next().value);
        this.math_functions = math_function.simplify({});
        this.step = step ?? 0.3;
    }
    draw(canvas) {
        const canvas_element = canvas.canvas;
        const top_left = canvas.to_coordinate_space(POINT_ZERO);
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
                else {
                    points.push((x_based) ? new DOMPoint(variable, output) : new DOMPoint(output, variable));
                }
                variable += this.step;
            }
            new PathGraphic(new Path(points), stroke_style).draw(canvas);
        }
    }
}
class Parabola {
    dependent_axis;
    vertex;
    point;
    constructor(dependent_axis, vertex, point) {
        this.dependent_axis = dependent_axis;
        this.vertex = vertex;
        this.point = point;
    }
    a() {
        const point = this.point;
        const vertex = this.vertex;
        const x_difference = point.x - vertex.x;
        const y_difference = point.y - vertex.y;
        const [numerator, denominator] = (this.dependent_axis === "x") ? [x_difference, y_difference] : [y_difference, x_difference];
        return numerator / (denominator * denominator);
    }
    to_latex() {
        const vertex = this.vertex;
        const a = this.a();
        if (this.dependent_axis === "y") {
            return `y=${a}\\\\left(x-${vertex.x}\\\\right)^{2}+${vertex.y}`;
        }
        return `x=${a}\\\\left(y-${vertex.y}\\\\right)^{2}+${vertex.x}`;
    }
}
class ParabolaGraphic {
    parabola;
    stroke_style;
    step;
    constructor(parabola, stroke_style, step) {
        this.parabola = parabola;
        this.stroke_style = stroke_style;
        this.step = step;
    }
    draw(canvas) {
        const parabola = this.parabola;
        const vertex = parabola.vertex;
        const point = parabola.point;
        const dependent_axis = parabola.dependent_axis;
        const a = parabola.a();
        const vertical = dependent_axis === "y";
        const vertex_x_value = new Value(vertex.x);
        const vertex_y_value = new Value(vertex.y);
        const [variable, squared_vertex, added_vertex] = (vertical) ?
            [Variable.X, vertex_x_value, vertex_y_value] :
            [Variable.Y, vertex_y_value, vertex_x_value];
        const clamper = (vertical) ? new Extent(vertex.y, point.y) : new Extent(vertex.x, point.x);
        const equation = new RestrictTo(new Add(new Multiply(new Value(a), Multiply.square(new Subtract(variable, squared_vertex))), added_vertex), clamper);
        new MathFunctionGraphic(equation, this.stroke_style, this.step).draw(canvas);
    }
}
class NumberPlaneGraphic {
    axis_style;
    tick_line_style;
    unit_size;
    origin;
    constructor(axis_style, tick_line_style, unit_size, origin) {
        this.axis_style = axis_style;
        this.tick_line_style = tick_line_style;
        this.origin = origin ?? POINT_ZERO;
        this.unit_size = unit_size ?? { width: 1, height: 1 };
    }
    draw(canvas) {
        const origin = this.origin;
        const unit_size = this.unit_size;
        const top_left = canvas.to_coordinate_space(POINT_ZERO);
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
    static IDENTITY = new Transform();
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
            skew: 0,
            scale: (scaling * to_flipper(flip_y))
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
    to_latex() {
        return this.line.to_latex();
    }
    properties() {
        const line = this.line;
        return {
            start: new PointProperty((point) => { line.start = point; }, () => line.start),
            end: new PointProperty((point) => { line.end = point; }, () => line.end),
        };
    }
    controls() {
        const properties = this.properties();
        const line = this.line;
        return {
            start: new ControlPoint(() => line.start, properties.start),
            end: new ControlPoint(() => line.end, properties.end)
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
    to_latex() {
        return this.ellipse.to_latex();
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
class DesmosParabola {
    parabola;
    constructor(parabola) {
        this.parabola = parabola;
    }
    to_latex() {
        return this.parabola.to_latex();
    }
    properties() {
        return {
            dependent_axis: new AxisProperty("x", (horizontal) => {
                const parabola = this.parabola;
                parabola.dependent_axis = (horizontal > parabola.vertex.x) ? "x" : "y";
            }, () => this.parabola.vertex.x + ((this.parabola.dependent_axis === "x") ? 1 : -1)),
            vertex: new PointProperty((point) => { this.parabola.vertex = point; }, () => this.parabola.vertex),
            point: new PointProperty((point) => { this.parabola.point = point; }, () => this.parabola.point)
        };
    }
    controls() {
        const properties = this.properties();
        const parabola = this.parabola;
        return {
            dependent_axis: new ControlPoint(() => {
                return new DOMPoint(parabola.vertex.x + ((parabola.dependent_axis === "x") ? 1 : -1), parabola.vertex.y);
            }, properties.dependent_axis),
            vertex: new ControlPoint(() => {
                return parabola.vertex;
            }, properties.vertex),
            point: new ControlPoint(() => parabola.point, properties.point)
        };
    }
    to_drawable(stroke_style, _) {
        return new ParabolaGraphic(this.parabola, stroke_style);
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
        const identity_transform = Transform.IDENTITY;
        identity_transform.draw(canvas);
        new RectangleGraphic(new Rectangle(POINT_ZERO, new DOMPoint(width, height)), { color: Color.BLACK, weight: 1 }, Color.WHITE).draw(canvas);
        const middle_x = width / 2;
        const middle_y = height / 2;
        const unit_size = 30;
        const cartesian_transform = Transform.translate_scale(new DOMPoint(middle_x, middle_y), unit_size, false, true);
        cartesian_transform.draw(canvas);
        const line_color = Color.monochrome(200);
        new NumberPlaneGraphic({ color: line_color, weight: 2 }, { color: line_color, weight: 1 }).draw(canvas);
        // new ParabolaGraphic(
        //     new Parabola(
        //         "y",
        //         new DOMPoint(0, 0),
        //         new DOMPoint(5, 5)
        //     ),
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
let mouse_position = POINT_ZERO;
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
    ["ellipse_tool", () => new DesmosEllipse(new Ellipse(POINT_ZERO, 1, 1))],
    ["parabola_tool", () => new DesmosParabola(new Parabola("y", POINT_ZERO, new DOMPoint(2, 2)))],
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
unwrap_option(document.getElementById("export")).onclick = () => {
    const latex_outputs = Array
        .from(desmos_draw.shapes.values())
        .map((shape) => `{type: "expression", latex: "${shape.to_latex()}"}`).join(",\n");
    navigator.clipboard.writeText(`state = Calc.getState(); state.expressions.list.push(${latex_outputs}); Calc.setState(state);`).then(() => {
        alert("Copied to clipboard!");
    });
};
// let math_function = new Add(new Add(new Value(1), Variable.X), new Sqrt(new Add(new Value(1), new Sqrt(Variable.Y))));
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