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

function unwrap_option_or_else<T>(option: Option<T>, or_else: () => T): T {
    return (is_some_option(option)) ? option : or_else();
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

// #region draw.ts

type NewType<T, Brand> = T & { __brand: Brand };

interface CanvasRenderingContext2D {
    transform_point(untransformed_point: DOMPoint): DOMPoint;
    untransform_point(transformed_point: DOMPoint): DOMPoint;
    unit_size(): Size;
}

CanvasRenderingContext2D.prototype.transform_point = function (untransformed_point: DOMPoint): DOMPoint {
    return untransformed_point.matrixTransform(this.getTransform().inverse());
}

CanvasRenderingContext2D.prototype.untransform_point = function (transformed_point: DOMPoint): DOMPoint {
    return transformed_point.matrixTransform(this.getTransform());
}

CanvasRenderingContext2D.prototype.unit_size = function (): Size {
    const matrix = this.getTransform();

    const x_scale = matrix.a;
    const y_skew = matrix.b;
    const x_skew = matrix.c;
    const y_scale = matrix.d;

    return { width: Math.sqrt((x_scale * x_scale) + (y_skew * y_skew)), height: Math.sqrt((y_scale * y_scale) + (x_skew * x_skew)) };
}

interface Drawable {
    draw(canvas: CanvasRenderingContext2D): void;
}

interface ToDrawable<T extends Drawable> {
    to_drawable(stroke_style: StrokeStyle, fill_style: FillStyle): T;
}



// type StaticImplements<I extends new (...args: any[]) => any, C extends I> = InstanceType<C>;

// interface EditableInstance {
//     to_control_points(): Record<string, ControlPoint>;
// }

// interface EditableStatic<T extends EditableInstance> {
//     new(...args: any[]): T;
//     from_control_points(control_points: Record<string, ControlPoint>): T;
// }

// class ControlPoint implements Drawable, StaticImplements<EditableStatic<ControlPoint>, typeof ControlPoint> {
//     constructor(
//         readonly point: DOMPoint,
//         readonly locked_on_axis?: "x" | "y"
//     ) { }

//     get x(): number {
//         return this.point.x;
//     }

//     set x(value: number) {
//         this.point.x = value;
//     }

//     get y(): number {
//         return this.point.y;
//     }

//     set y(value: number) {
//         this.point.y = value;
//     }

//     to_control_points(): Record<string, ControlPoint> {
//         return {
//             value: this
//         };
//     }

//     static from_control_points(control_points: Record<string, ControlPoint>): ControlPoint {
//         assert(Object.keys(control_points).length == 1, "There is more than one control point in [control_points], but you're trying to build a single control point!");
//         return unwrap_option(control_points.value);
//     }

//     draw(canvas: CanvasRenderingContext2D): void {
//         new EllipseGraphic(
//             new Ellipse(this.point, 0.2, 0.2),
//             Color.opaque(35, 116, 255) as FillStyle
//         ).draw(canvas);
//     }
// }

// interface Editable {

// } 

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

class Rectangle implements ToDrawable<RectangleGraphic> {
    constructor(
        readonly start: DOMPoint,
        readonly end: DOMPoint
    ) { }

    to_drawable(stroke_style: StrokeStyle, fill_style: FillStyle): RectangleGraphic {
        return new RectangleGraphic(
            this,
            stroke_style,
            fill_style
        );
    }
}

class RectangleGraphic implements Drawable {
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
        readonly start: DOMPoint,
        readonly end: DOMPoint
    ) { }
}

class LineGraphic implements Drawable {
    constructor(
        readonly line: Line,
        readonly stroke_style: StrokeStyle
    ) {
    }

    draw(canvas: CanvasRenderingContext2D): void {
        const line = this.line;
        const start = line.start;
        const end = line.end;

        const x_delta = end.x - start.x;

        const canvas_element = canvas.canvas;
        const bottom_right = canvas.transform_point(new DOMPoint(canvas_element.width, canvas_element.height));
        const top_left = canvas.transform_point(new DOMPoint(0, 0));

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

class LineSegmentGraphic implements Drawable {

    constructor(
        readonly line: Line,
        readonly stroke_style?: StrokeStyle
    ) {
    }

    draw(canvas: CanvasRenderingContext2D): void {
        const line = this.line;
        const start = line.start;
        const end = line.end;

        canvas.beginPath();
        canvas.moveTo(start.x, start.y);
        canvas.lineTo(end.x, end.y);
        canvas.closePath();

        map_option(this.stroke_style, (stroke_style) => {
            const unit_line_width = canvas.lineWidth;

            canvas.lineWidth = stroke_style.weight * unit_line_width;
            canvas.strokeStyle = stroke_style.color.to_style();

            canvas.stroke();
            canvas.lineWidth = unit_line_width;
        });
    }
}

class Ellipse {
    constructor(
        readonly center: DOMPoint,
        readonly horizontal_radius: number,
        readonly vertical_radius: number
    ) { }
}

class EllipseGraphic implements Drawable {
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
        canvas.ellipse(center.x, center.y, horizontal_radius, vertical_radius, 0, 0, 2 * Math.PI);
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

class NumberPlaneGraphic implements Drawable {
    constructor(
        readonly axis_style: StrokeStyle,
        readonly tick_line_style: StrokeStyle
    ) {
    }

    draw(canvas: CanvasRenderingContext2D): void {
        const draw_vertical_line = (at_x: number, stroke_style: StrokeStyle) => {
            new LineGraphic(
                new Line(new DOMPoint(at_x, 0), new DOMPoint(at_x, 1)),
                stroke_style
            ).draw(canvas);
        };

        const draw_horizontal_line = (at_y: number, stroke_style: StrokeStyle) => {
            new LineGraphic(
                new Line(new DOMPoint(0, at_y), new DOMPoint(1, at_y)),
                stroke_style
            ).draw(canvas);
        }

        const tick_line_style = this.tick_line_style;

        const ZERO = new DOMPoint(0, 0);

        const unit_size = canvas.unit_size();
        const screen_origin = canvas.untransform_point(ZERO);

        const start_positions = canvas.transform_point(new DOMPoint(screen_origin.x % unit_size.width, screen_origin.y % unit_size.height));

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

type AxisTransform = {
    scale: Percentage,
    skew: number
};

class Transform implements Drawable {
    constructor(
        readonly matrix?: DOMMatrix,
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
        unwrap_option_or_else(
            map_option(
                this.matrix,
                (matrix) => {
                    canvas.transform(
                        matrix.a,
                        matrix.b,
                        matrix.c,
                        matrix.d,
                        matrix.e,
                        matrix.f,
                    );
                }
            ),
            () => {
                canvas.resetTransform();
            }
        );

        const unit_size = canvas.unit_size();

        canvas.lineWidth = 1 / ((unit_size.width + unit_size.height) / 2);
    }
}

// #endregion draw.ts

const canvas_element = unwrap_option(document.getElementById("canvas")) as HTMLCanvasElement;
const canvas = canvas_element.getContext("2d");

assert(is_some_option(canvas), "Failed to retrieve the canvas context!");

type Shape = Line | Ellipse;

// class Shapes {
//     readonly shapes: Map<number, ToDrawable<Drawable>>

//     constructor(
//         shapes?: Map<number, Drawable>,
//         public selected?: number
//     ) {
//         this.shapes = shapes ?? new Map();
//     }

//     entries(): IterableIterator<[number, Drawable]> {
//         return this.shapes.entries();
//     }

//     drawable()
// }

const shapes = new Shapes(
    new Map([
        [0, new ControlLine(new Line(new DOMPoint(2, 2), new DOMPoint(-5, 5)))]
    ])
);

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

    const identity_transform = new Transform();

    identity_transform.draw(canvas);

    canvas.resetTransform();

    new RectangleGraphic(
        new Rectangle(new DOMPoint(0, 0), new DOMPoint(width, height)),
        { color: Color.BLACK, weight: 1, },
        Color.WHITE as FillStyle
    ).draw(canvas);

    const middle_x = width / 2;
    const middle_y = height / 2;

    const unit_size = 30;

    const cartesian = Transform.translate_scale(
        new DOMPoint(middle_x, middle_y),
        unit_size as Percentage,
        false,
        true
    );

    cartesian.draw(canvas);

    const line_color = Color.monochrome(200);

    new NumberPlaneGraphic(
        { color: line_color, weight: 2 },
        { color: line_color, weight: 1 }
    ).draw(canvas);

    const fill_style = 

    for (const [id, control_shape] of shapes.entries()) {
        if (control_shape instanceof ControlLine) {
            new LineSegmentGraphic(
                control_shape.line,
            ).draw(canvas);
        }

        if (id === shapes.selected) {
            for (const control_point of Object.values(control_shape)) {

            }
        }
    }
};

let render_request: Option<number> = undefined;

const request_render = () => {
    if (is_some_option(render_request)) {
        return;
    }

    render_request = requestAnimationFrame(
        () => {
            render();
            render_request = undefined;
        }
    );
}

const resize_canvas = (entries: ResizeObserverEntry[]) => {
    const [canvas_resize] = entries;
    assert(is_some_option(canvas_resize), "The resize observer might not be targeted on the canvas!");

    const screen_size = canvas_resize.contentBoxSize[0];
    assert(is_some_option(screen_size), "The resize observer couldn't get a size!");

    canvas_element.width = screen_size.inlineSize;
    canvas_element.height = screen_size.blockSize;

    request_render();
};

const canvas_observer = new ResizeObserver(resize_canvas);
canvas_observer.observe(canvas_element);

window.addEventListener("mousemove", () => request_render());
window.addEventListener("mousedown", () => request_render());
window.addEventListener("mouseup", () => request_render());