// #region type_help.ts

type NewType<T, Brand> = T & { __brand: Brand };

// #endregion type_help.ts

// #region asserts.ts

class AssertionError extends Error { }

function assert(condition: boolean, message: string): asserts condition {
    if (condition) return;

    throw new AssertionError(message);
}

//#endregion asserts.ts

// #region options.ts

type Option<T> = T | undefined | null;

function map_option<T, U>(option: Option<T>, mapper: (from: T) => U): Option<U> {
    return (is_some_option(option)) ? mapper(option) : option;
}

function is_some_option<T>(option: Option<T>): option is T {
    return option !== undefined && option !== null;
}

function unwrap_option<T>(option: Option<T>): T {
    assert(is_some_option(option), "Called unwrap on a None value!");
    return option;
}

// #endregion options.ts

// #region numbers.ts

type Radians = NewType<number, "Radians">;
type Percentage = NewType<number, "Percentage">;

class Extent {
    readonly min: number;
    readonly max: number;

    constructor(a: number, b: number) {
        if (a > b) {
            const temp = a;
            a = b;
            b = temp;
        }

        this.min = a;
        this.max = b;
    }

    contains(value: number): boolean {
        return value >= this.min && value <= this.max;
    }

    clamp(value: number): number {
        const max = this.max;
        const min = this.min;

        if (value > max) return max;
        if (value < min) return min;

        return value;
    }

    percentage(value: number): Percentage {
        const min = this.min;

        const range = this.max - min;
        const range_location = value - min;

        return (range_location / range) as Percentage;
    }
}

function modulo(dividend: number, divisor: number): number {
    return ((dividend % divisor) + divisor) % divisor;
}

// #endregion numbers.ts

// #region expressions.ts

interface Expression {
    variables(): Set<string>;
    simplify(substitutions: Record<string, Expression>): Expression[];
    to_string(): string;
}

class Variable implements Expression {
    constructor(
        readonly name: string
    ) { }

    variables(): Set<string> {
        return new Set([this.name]);
    }

    simplify(substitutions: Record<string, Expression>): Expression[] {
        return map_option(substitutions[this.name], (substitution) => [substitution]) ?? [new Variable(this.name)];
    }

    to_string(): string {
        return this.name;
    }
}

class Value implements Expression {
    constructor(
        readonly value: number | undefined
    ) { }

    variables(): Set<string> {
        return new Set();
    }

    simplify(_: Record<string, Expression>): Expression[] {
        return [this];
    }

    to_string(): string {
        return `${this.value}`;
    }
}

abstract class BinaryOperator implements Expression {
    constructor(
        readonly a: Expression,
        readonly b: Expression
    ) { }

    variables(): Set<string> {
        return new Set([
            ...this.a.variables(),
            ...this.b.variables()
        ]);
    }

    abstract operate(a: Expression, b: Expression): Expression[];

    simplify(substitutions: Record<string, Expression>): Expression[] {
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

    abstract to_string(): string;
}

class Add extends BinaryOperator {
    override operate(a: Expression, b: Expression): Expression[] {
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

    override to_string(): string {
        return `(${this.a.to_string()} + ${this.b.to_string()})`;
    }
}
class Subtract extends Add {
    constructor(
        a: Expression,
        b: Expression
    ) {
        super(a, new Multiply(b, new Value(-1)));
    }
}

class Divide extends BinaryOperator {
    override operate(a: Expression, b: Expression): Expression[] {
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

    override to_string(): string {
        return `(${this.a.to_string()} / ${this.b.to_string()})`;
    }
}

class Multiply extends Divide {
    constructor(
        a: Expression,
        b: Expression
    ) {
        super(a, new Divide(new Value(1), b));
    }
}

abstract class UnaryOperator implements Expression {
    constructor(
        readonly value: Expression
    ) { }

    variables(): Set<string> {
        return this.value.variables();
    }

    abstract operate(value: Expression): Expression[];

    simplify(substitutions: Record<string, Expression>): Expression[] {
        const value = this.value.simplify(substitutions);

        const simplifications = [];

        for (const simplification of value) {
            for (const result of this.operate(simplification)) {
                simplifications.push(result);
            }
        }

        return simplifications;
    }

    abstract to_string(): string;
}

class PrincipalSqrt extends UnaryOperator {
    override operate(expression: Expression): Expression[] {
        if (expression instanceof Value) {
            const value = expression.value;

            return [new Value((value === undefined) ? undefined : Math.sqrt(value))];
        }

        return [new PrincipalSqrt(expression)];
    }

    to_string(): string {
        return `(+sqrt(${this.value.to_string()}))`;
    }
}

class Sqrt extends PrincipalSqrt {
    override operate(value: Expression): Expression[] {
        return super.operate(value).flatMap(
            (operated) => [
                operated,
                ...new Multiply(operated, new Value(-1)).simplify({})
            ]
        );
    }

    override to_string(): string {
        return `(sqrt(${this.value.to_string()}))`;
    }
}

// #endregion expressions.ts

// #region draw.ts

type ScreenSpace = NewType<DOMPoint, "ScreenSpace">;
type CoordinateSpace = NewType<DOMPoint, "CoordinateSpace">;

interface CanvasRenderingContext2D {
    to_coordinate_space(point: ScreenSpace): CoordinateSpace;
    to_screen_space(point: CoordinateSpace): ScreenSpace;
    unit_size(): Size;
}

CanvasRenderingContext2D.prototype.to_coordinate_space = function (point: ScreenSpace): CoordinateSpace {
    // return point.matrixTransform(this.getTransform().inverse()) as CoordinateSpace;
}

CanvasRenderingContext2D.prototype.to_screen_space = function (point: CoordinateSpace): ScreenSpace {
    return

    //return point.matrixTransform(this.getTransform()) as ScreenSpace;
}

CanvasRenderingContext2D.prototype.unit_size = function (): Size {
    const matrix = this.getTransform();

    const x_scale = matrix.a;
    const y_skew = matrix.b;
    const x_skew = matrix.c;
    const y_scale = matrix.d;

    return { width: Math.sqrt((x_scale * x_scale) + (y_skew * y_skew)), height: Math.sqrt((y_scale * y_scale) + (x_skew * x_skew)) };
}

interface DOMPoint {
    squared_distance(other: DOMPoint): number;
    distance(other: DOMPoint): number;
}

DOMPoint.prototype.squared_distance = function (other: DOMPoint) {
    const x_delta = this.x - other.x;
    const y_delta = this.y - other.y;
    return (x_delta * x_delta) + (y_delta * y_delta);
}

DOMPoint.prototype.distance = function (other: DOMPoint) {
    return Math.sqrt(this.squared_distance(other));
}

class Color {
    readonly red: number;
    readonly green: number;
    readonly blue: number;
    readonly alpha: number;

    constructor(red: number, green: number, blue: number, alpha: number) {
        const BIT_8_RANGE = new Extent(0, 255);
        const PERCENTAGE_RANGE = new Extent(0, 1);

        assert(
            [red, green, blue].every((color) => BIT_8_RANGE.contains(color)),
            `One of your color values (${red}, ${green}, ${blue}) isn't in an 8-bit range!`
        );

        assert(
            PERCENTAGE_RANGE.contains(alpha),
            `Your alpha value (${alpha}) isn't in the range of zero and one!`
        );

        this.red = red;
        this.green = green;
        this.blue = blue;
        this.alpha = alpha;
    }

    static opaque(red: number, green: number, blue: number) {
        return new Color(red, green, blue, 1);
    }

    static monochrome(value: number) {
        return Color.opaque(value, value, value);
    }

    static from_hex(hex: string) {
        const cleaned_hex = hex.trim().replace("#", "");
        const hex_string_length = cleaned_hex.length;

        const has_alpha = hex_string_length === 8;

        assert(hex_string_length === 6 || has_alpha, `Your hex string (${hex}) isn't a valid length (6 or 8)!`);

        const to_8_bit = (hex_part: string) => Number(`0x${hex_part}`);

        return new Color(
            to_8_bit(cleaned_hex.substring(0, 2)),
            to_8_bit(cleaned_hex.substring(2, 4)),
            to_8_bit(cleaned_hex.substring(4, 6)),
            (!has_alpha) ? 1 : to_8_bit(cleaned_hex.substring(6, 8))
        );
    }

    to_style() {
        return `rgba(${this.red}, ${this.green}, ${this.blue}, ${this.alpha})`;
    }

    static BLACK = Color.opaque(0, 0, 0);
    static WHITE = Color.opaque(255, 255, 255);
}

type Size = {
    width: number;
    height: number;
};

type StrokeStyle = {
    weight: number;
    color: Color;
};

type FillStyle = NewType<Color, "FillStyle">;

interface Drawable {
    draw(canvas: CanvasRenderingContext2D): void;
}

class Rectangle {
    constructor(
        public start: DOMPoint,
        public end: DOMPoint
    ) { }
}

class RectangleGraphic implements Drawable /* , DrawableShape */ {
    constructor(
        readonly rectangle: Rectangle,
        readonly stroke_style?: StrokeStyle,
        readonly fill_style?: FillStyle
    ) {
    }

    draw(canvas: CanvasRenderingContext2D): void {
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
    constructor(
        public start: DOMPoint,
        public end: DOMPoint
    ) { }
}

class Path {
    constructor(
        readonly points: DOMPoint[]
    ) { }
}

class PathGraphic implements Drawable {
    constructor(
        readonly path: Path,
        readonly stroke_style?: StrokeStyle
    ) { }

    draw(canvas: CanvasRenderingContext2D): void {
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

class LineSegmentGraphic implements Drawable /* , DrawableShape */ {
    constructor(
        readonly line: Line,
        readonly stroke_style?: StrokeStyle
    ) {
    }

    draw(canvas: CanvasRenderingContext2D): void {
        const line = this.line;

        new PathGraphic(
            new Path([line.start, line.end]),
            this.stroke_style
        ).draw(canvas);
    }
}

class LineGraphic implements Drawable /* , DrawableShape */ {
    constructor(
        readonly line: Line,
        readonly stroke_style?: StrokeStyle
    ) {
    }

    draw(canvas: CanvasRenderingContext2D): void {
        const line = this.line;
        const start = line.start;
        const end = line.end;

        const x_delta = end.x - start.x;

        const canvas_element = canvas.canvas;
        const top_left = canvas.to_coordinate_space(new DOMPoint(0, 0) as ScreenSpace);
        const bottom_right = canvas.to_coordinate_space(new DOMPoint(canvas_element.width, canvas_element.height) as ScreenSpace);

        const is_90 = x_delta <= 0.001;

        new LineSegmentGraphic(
            (is_90) ? new Line(
                new DOMPoint(start.x, top_left.y),
                new DOMPoint(end.x, bottom_right.y)
            ) : (() => {
                const slope = (end.y - start.y) / x_delta;
                const y_intercept = start.y - slope * start.x;

                const line_function = (x: number) => {
                    return slope * x + y_intercept;
                };

                const leftmost_x = top_left.x;
                const rightmost_x = bottom_right.x;

                return new Line(
                    new DOMPoint(leftmost_x, line_function(leftmost_x)),
                    new DOMPoint(rightmost_x, line_function(rightmost_x))
                )
            })(),
            this.stroke_style
        ).draw(canvas);
    }
}

class Ellipse {
    constructor(
        public center: DOMPoint,
        public horizontal_radius: number,
        public vertical_radius: number
    ) { }
}

class EllipseGraphic implements Drawable /* , DrawableShape */ {
    constructor(
        readonly ellipse: Ellipse,
        readonly stroke_style?: StrokeStyle,
        readonly fill_style?: FillStyle
    ) {
    }

    draw(canvas: CanvasRenderingContext2D): void {
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

class MathFunctionGraphic implements Drawable {
    readonly function_variable: "x" | "y";
    readonly step: number;
    readonly math_functions: Expression[];

    constructor(
        math_function: Expression,
        readonly stroke_style?: StrokeStyle,
        step?: number
    ) {
        const variables = math_function.variables();

        assert(variables.size === 1 && (variables.has("x") || variables.has("y")), "You can't draw a function that doesn't have either an x or a y variable!");

        this.function_variable = unwrap_option(variables.values().next().value) as "x" | "y";
        this.math_functions = math_function.simplify({});

        this.step = step ?? 0.0003;
    }

    draw(canvas: CanvasRenderingContext2D): void {
        const canvas_element = canvas.canvas;
        const top_left = canvas.to_coordinate_space(new DOMPoint(0, 0) as ScreenSpace);
        const bottom_right = canvas.to_coordinate_space(new DOMPoint(canvas_element.width, canvas_element.height) as ScreenSpace);

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
                        new PathGraphic(
                            new Path(points),
                            stroke_style
                        ).draw(canvas);
                    }

                    points.length = 0;
                }

                points.push(
                    (x_based) ? new DOMPoint(variable, output) : new DOMPoint(output, variable)
                );

                variable += this.step;
            }

            new PathGraphic(
                new Path(points),
                stroke_style
            ).draw(canvas);
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

class NumberPlaneGraphic implements Drawable {
    readonly unit_size: Size;
    readonly origin: DOMPoint;

    constructor(
        readonly axis_style?: StrokeStyle,
        readonly tick_line_style?: StrokeStyle,
        unit_size?: Size,
        origin?: DOMPoint
    ) {
        this.origin = origin ?? new DOMPoint(0, 0);
        this.unit_size = unit_size ?? { width: 1, height: 1 };
    }

    draw(canvas: CanvasRenderingContext2D): void {
        const origin = this.origin;
        const unit_size = this.unit_size;

        const top_left = canvas.to_coordinate_space(new DOMPoint(0, 0) as ScreenSpace);
        const screen_unit_size = canvas.to_screen_space(new DOMPoint(top_left.x + unit_size.width, top_left.y + unit_size.height) as CoordinateSpace);

        const screen_origin = canvas.to_screen_space(origin as CoordinateSpace);

        const canvas_element = canvas.canvas;

        const start_positions = canvas.to_coordinate_space(new DOMPoint(screen_origin.x % screen_unit_size.x, screen_origin.y % screen_unit_size.y) as ScreenSpace);
        const end_positions = canvas.to_coordinate_space(new DOMPoint(canvas_element.width, canvas_element.height) as ScreenSpace);

        const draw_vertical_line = (at_x: number, stroke_style?: StrokeStyle) => {
            new LineGraphic(
                new Line(new DOMPoint(at_x, 0), new DOMPoint(at_x, 1)),
                stroke_style
            ).draw(canvas);
        };

        const draw_horizontal_line = (at_y: number, stroke_style?: StrokeStyle) => {
            new LineGraphic(
                new Line(new DOMPoint(0, at_y), new DOMPoint(1, at_y)),
                stroke_style
            ).draw(canvas);
        }

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

type AxisTransform = {
    scale: Percentage,
    skew: number
};

class Transform implements Drawable {
    constructor(
        public matrix?: DOMMatrix,
    ) {
    }

    static from_values(
        x_transform: AxisTransform,
        y_transform: AxisTransform,
        translation: DOMPoint
    ) {
        return new Transform(
            new DOMMatrix([
                x_transform.scale,
                y_transform.skew,
                x_transform.skew,
                y_transform.scale,
                translation.x,
                translation.y
            ])
        );
    }

    static translate_scale(
        translation: DOMPoint,
        scaling: Percentage,
        flip_x: boolean = false,
        flip_y: boolean = false
    ): Transform {
        const to_flipper = (should_flip: boolean) => (should_flip) ? -1 : 1;

        return Transform.from_values(
            {
                scale: (scaling * to_flipper(flip_x)) as Percentage,
                skew: 0
            },
            {
                scale: (scaling * to_flipper(flip_y)) as Percentage,
                skew: 0
            },
            translation
        );
    }

    draw(canvas: CanvasRenderingContext2D) {
        const matrix = this.matrix;

        if (is_some_option(matrix)) {
            canvas.transform(
                matrix.a,
                matrix.b,
                matrix.c,
                matrix.d,
                matrix.e,
                matrix.f,
            );
        } else {
            canvas.resetTransform();
        }

        const unit_size = canvas.unit_size();

        canvas.lineWidth = 1 / ((unit_size.width + unit_size.height) / 2);
    }
}

// #endregion draw.ts

// #region elements.ts

// #region control.ts

abstract class Property {
    constructor(
    ) { }
}

class PointProperty extends Property {
    constructor(
        readonly setter: (point: DOMPoint) => void,
        readonly getter: () => DOMPoint
    ) { super(); }
}

class AxisProperty extends Property {
    constructor(
        readonly axis: "x" | "y",
        readonly setter: (axis: number) => void,
        readonly getter: () => number
    ) { super(); }
}

// #endregion control.ts

interface DrawableShape {
    to_drawable(stroke_style?: StrokeStyle, fill_style?: FillStyle): Drawable;
}

interface Editable {
    properties(): Record<string, Property>;
}

interface Controllable {
    controls(): Record<string, ControlPoint>;
}

interface DesmosShape extends DrawableShape, Editable, Controllable { }

class ControlPoint implements DrawableShape {
    static current_id: number = 0;
    static selected: number | undefined = undefined;

    private id: number;
    public radius: number;

    constructor(
        readonly point: () => DOMPoint,
        readonly control: Property,
        radius?: number
    ) {
        this.id = ControlPoint.current_id;
        ControlPoint.current_id += 1;

        this.radius = radius ?? 0.25;
    }

    update(_: DOMHighResTimeStamp, input: Input) {
        const control = this.control;
        const mouse = input.mouse;
        const mouse_position = mouse.position;

        const point = this.point();

        const id = this.id;

        if (
            point.distance(mouse_position) < this.radius &&
            mouse.is_down &&
            ControlPoint.selected === undefined
        ) {
            ControlPoint.selected = this.id;
        }

        if (id === ControlPoint.selected) {
            if (control instanceof PointProperty) {
                control.setter(mouse_position);
            } else if (control instanceof AxisProperty) {
                control.setter((control.axis === "x") ? mouse_position.x : mouse_position.y);
            }

            if (!mouse.is_down) {
                ControlPoint.selected = undefined;
            }
        }
    }

    to_drawable(): Drawable {
        const radius = this.radius;

        return new EllipseGraphic(
            new Ellipse(
                this.point(),
                radius,
                radius
            ),
            undefined,
            Color.opaque(65, 165, 238) as FillStyle
        );
    }
}

type LineProperties = {
    start: PointProperty,
    end: PointProperty
};

class DesmosLineSegment implements DesmosShape {
    constructor(
        readonly line: Line
    ) { }

    properties(): LineProperties {
        return {
            start: new PointProperty((point) => { this.line.start = point; }, () => this.line.start),
            end: new PointProperty((point) => { this.line.end = point; }, () => this.line.end),
        };
    }

    controls(): Record<string, ControlPoint> {
        const properties = this.properties();

        return {
            start: new ControlPoint(
                () => this.line.start,
                properties.start
            ),
            end: new ControlPoint(
                () => this.line.end,
                properties.end
            )
        }
    }

    to_drawable(stroke_style?: StrokeStyle, _?: FillStyle): Drawable {
        return new LineSegmentGraphic(
            this.line,
            stroke_style
        );
    }
}

type EllipseProperties = {
    center: PointProperty,
    horizontal_radius: AxisProperty,
    vertical_radius: AxisProperty
};

class DesmosEllipse implements DesmosShape {
    constructor(
        readonly ellipse: Ellipse
    ) { }

    properties(): EllipseProperties {
        return {
            center: new PointProperty(
                (point) => { this.ellipse.center = point; },
                () => this.ellipse.center
            ),
            horizontal_radius: new AxisProperty(
                "x",
                (horizontal) => {
                    const ellipse = this.ellipse;
                    ellipse.horizontal_radius = horizontal - ellipse.center.x;
                },
                () => this.ellipse.horizontal_radius
            ),
            vertical_radius: new AxisProperty(
                "y",
                (vertical) => {
                    const ellipse = this.ellipse;
                    ellipse.vertical_radius = vertical - ellipse.center.y;
                },
                () => this.ellipse.vertical_radius
            )
        };
    }

    controls() {
        const properties = this.properties();

        return {
            horizontal_radius: new ControlPoint(
                () => {
                    const ellipse = this.ellipse;
                    const center = ellipse.center;

                    return new DOMPoint(
                        center.x + ellipse.horizontal_radius,
                        center.y
                    );
                },
                properties.horizontal_radius
            ),
            vertical_radius: new ControlPoint(
                () => {
                    const ellipse = this.ellipse;
                    const center = ellipse.center;

                    return new DOMPoint(
                        center.x,
                        center.y + ellipse.vertical_radius
                    );
                },
                properties.vertical_radius
            ),
            center: new ControlPoint(
                () => this.ellipse.center,
                properties.center
            )
        };
    }

    to_drawable(stroke_style?: StrokeStyle, fill_style?: FillStyle): Drawable {
        return new EllipseGraphic(
            this.ellipse,
            stroke_style,
            fill_style
        );
    }
}

// #endregion elements.ts 

// #region main.ts

type Input = {
    mouse: {
        position: DOMPoint,
        is_down: boolean
    }
};

class DesmosDraw implements Drawable {
    private current_id: number;
    private selected_controls: Option<Record<string, ControlPoint>>;
    readonly shapes: Map<number, DesmosShape>;

    constructor(
    ) {
        this.current_id = 0;
        this.shapes = new Map();
    }

    public add_shape(shape: DesmosShape): number {
        const current_id = this.current_id;
        this.current_id += 1;

        this.shapes.set(current_id, shape);
        this.select_shape(current_id);

        return current_id;
    }

    public remove_shape(id: number): boolean {
        this.selected_controls = undefined;
        return this.shapes.delete(id);
    }

    public select_shape(id: number) {
        this.selected_controls = map_option(this.shapes.get(id), (shape) => shape.controls());
    }

    update(delta_time: DOMHighResTimeStamp, input: Input): void {
        map_option(
            this.selected_controls,
            (selected_controls) => {
                for (const control_point of Object.values(selected_controls)) {
                    control_point.update(delta_time, input);
                }
            }
        );
    }

    draw(canvas: CanvasRenderingContext2D): void {
        const canvas_element = canvas.canvas;

        const width = canvas_element.width;
        const height = canvas_element.height;

        const identity_transform = new Transform();

        identity_transform.draw(canvas);

        new RectangleGraphic(
            new Rectangle(new DOMPoint(0, 0), new DOMPoint(width, height)),
            { color: Color.BLACK, weight: 1 },
            Color.WHITE as FillStyle
        ).draw(canvas);

        const middle_x = width / 2;
        const middle_y = height / 2;

        const unit_size = 30;

        const cartesian_transform = Transform.translate_scale(
            new DOMPoint(middle_x, middle_y),
            unit_size as Percentage,
            false,
            true
        );

        cartesian_transform.draw(canvas);

        const line_color = Color.monochrome(200);

        new NumberPlaneGraphic(
            { color: line_color, weight: 2 },
            { color: line_color, weight: 1 }
        ).draw(canvas);

        // new MathFunctionGraphic(
        //     new Sqrt(new Subtract(new Value(2), new Multiply(new Variable("x"), new Variable("x")))),
        //     // new Multiply(new Variable("x"), new Variable("x")),
        //     {
        //         color: Color.BLACK,
        //         weight: 1
        //     }
        // ).draw(canvas);

        map_option(
            this.selected_controls,
            (selected_controls) => {
                for (const control_point of Object.values(selected_controls)) {
                    control_point.to_drawable().draw(canvas);
                }
            }
        );

        for (const shape of this.shapes.values()) {
            shape.to_drawable(
                {
                    color: Color.BLACK,
                    weight: 1
                }
            ).draw(canvas)
        }
    }
}

const canvas_element = unwrap_option(document.getElementById("canvas")) as HTMLCanvasElement;
const canvas = unwrap_option(canvas_element.getContext("2d"));

const desmos_draw = new DesmosDraw();

const TARGET_FPS = 60;
const FRAME_TIME = 1000 / TARGET_FPS;
let previous_time_ms = 0 as DOMHighResTimeStamp;

let mouse_position = new DOMPoint(0, 0);
let is_down = false;

window.addEventListener("mousemove", (event) => {
    const canvas_rect = canvas_element.getBoundingClientRect();

    mouse_position = canvas.to_coordinate_space(
        new DOMPoint(
            event.clientX - canvas_rect.left,
            event.clientY - canvas_rect.top
        ) as ScreenSpace
    );
});

window.addEventListener("mousedown", () => { is_down = true; });
window.addEventListener("mouseup", () => { is_down = false; });

function loop(timestamp: DOMHighResTimeStamp) {
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
};

const shapes = unwrap_option(document.getElementById("shapes"));

([
    ["line_tool", () => new DesmosLineSegment(new Line(new DOMPoint(-1, -1), new DOMPoint(1, 1)))],
    ["ellipse_tool", () => new DesmosEllipse(new Ellipse(new DOMPoint(0, 0), 1, 1))],
    ["parabola_tool", () => undefined],
    ["hyperbola_tool", () => undefined]
] as [string, () => Option<DesmosShape>][]).map(
    ([element_name, builder]) =>
        unwrap_option(document.getElementById(element_name))
            .addEventListener("click", () => {
                let id = desmos_draw.add_shape(unwrap_option(builder()));

                const selection_element = document.createElement("div");
                const name = document.createElement("p");

                name.innerHTML = element_name.split("_").slice(0, -1).map(
                    (part) => unwrap_option(part[0]).toUpperCase() + part.substring(1).toLowerCase()
                ).join(" ");

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
                }

                selection_element.appendChild(selecter);

                shapes.appendChild(
                    selection_element
                );

                //     <div>
                //     <p>Hyperbola</p>
                //     <button><span class="material-symbols-outlined">delete</span></button>
                //     <input type="radio" name="selected_element" id="0"></input>
                // </div>
            })
);

// let math_function = new Add(new Add(new Value(1), new Variable("x")), new Sqrt(new Add(new Value(1), new Sqrt(new Variable("y")))));
// console.log(math_function.to_string());
// console.log(math_function.simplify({}).map((e) => e.to_string()));

let start_game = () => {
    start_game = () => { };
    requestAnimationFrame(loop);
};

function resize_canvas(entries: ResizeObserverEntry[]) {
    const [canvas_resize] = entries;
    assert(is_some_option(canvas_resize), "The resize observer might not be targeted on the canvas!");

    const screen_size = canvas_resize.contentBoxSize[0];
    assert(is_some_option(screen_size), "The resize observer couldn't get a size!");

    canvas_element.width = screen_size.inlineSize;
    canvas_element.height = screen_size.blockSize;

    start_game();
};

const canvas_observer = new ResizeObserver(resize_canvas);
canvas_observer.observe(canvas_element);

// #endregion main.ts