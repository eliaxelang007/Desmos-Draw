// #region asserts.ts

class AssertionError extends Error { }

function assert(condition: boolean, message: string): asserts condition {
    if (condition) return;

    throw new AssertionError(message);
}

//#endregion asserts.ts

// #region options.ts

function map_option<T, U>(option: T | undefined, mapper: (from: T) => U): U | undefined {
    if (option === undefined) {
        return undefined;
    }

    return mapper(option);
}

function is_some_option<T>(option: T | undefined): option is T {
    return option !== undefined;
}

function unwrap_option<T>(option: T | undefined | null): T {
    assert(is_some_option(option) && option !== null, "Called unwrap on a None value!");
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
    average_unit_size(): Percentage;
}

CanvasRenderingContext2D.prototype.transform_point = function (untransformed_point: DOMPoint): DOMPoint {
    return untransformed_point.matrixTransform(this.getTransform().inverse());
}

CanvasRenderingContext2D.prototype.untransform_point = function (transformed_point: DOMPoint): DOMPoint {
    return transformed_point.matrixTransform(this.getTransform());
}

CanvasRenderingContext2D.prototype.average_unit_size = function (): Percentage {
    const matrix = this.getTransform();

    const x_scale = matrix.a;
    const y_skew = matrix.b;
    const x_skew = matrix.c;
    const y_scale = matrix.d

    const pure_x_scale = Math.sqrt((x_scale * x_scale) + (y_skew * y_skew));
    const pure_y_scale = Math.sqrt((y_scale * y_scale) + (x_skew * x_skew));

    return ((pure_x_scale + pure_y_scale) / 2) as Percentage;
}

interface Drawable {
    draw(canvas: CanvasRenderingContext2D): void;
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

class Rectangle {
    constructor(
        readonly start: DOMPoint,
        readonly end: DOMPoint
    ) { }
}

class RectangleGraphic implements Drawable {
    readonly fill_style: FillStyle;

    constructor(
        readonly rectangle: Rectangle,
        fill_color?: FillStyle,
        readonly stroke_style?: StrokeStyle
    ) {
        this.fill_style = fill_color ?? Color.WHITE as FillStyle;
    }

    draw(canvas: CanvasRenderingContext2D): void {
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

class LineGraphic implements Drawable {
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

class Line {
    constructor(
        readonly start: DOMPoint,
        readonly end: DOMPoint
    ) { }
}

class LineSegmentGraphic implements Drawable {
    readonly stroke_style: StrokeStyle;

    constructor(
        readonly line: Line,
        stroke_style?: StrokeStyle
    ) {
        this.stroke_style = stroke_style ?? { color: Color.BLACK, weight: 1 };
    }

    draw(canvas: CanvasRenderingContext2D): void {
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
    constructor(
        readonly unit_size: Percentage
    ) {
    }
}

class NumberPlaneGraphic implements Drawable {
    constructor(
        readonly number_plane: NumberPlane,
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

type AxisTransform = {
    scale: Percentage,
    skew: number
};

class Transform implements Drawable {
    // readonly inverse: DOMMatrix;

    constructor(
        readonly matrix: DOMMatrix,
    ) {
        // this.inverse = matrix.inverse();
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

        canvas.transform(
            matrix.a,
            matrix.b,
            matrix.c,
            matrix.d,
            matrix.e,
            matrix.f,
        );

        canvas.lineWidth = 1 / canvas.average_unit_size();
    }

    // transform(point: DOMPoint): DOMPoint {
    //     return point.matrixTransform(this.inverse);
    // }

    // revert(point: DOMPoint): DOMPoint {
    //     return point.matrixTransform(this.matrix);
    // }
}

// #endregion draw.ts

const canvas_element = unwrap_option(document.getElementById("canvas")) as HTMLCanvasElement;
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

    new RectangleGraphic(
        new Rectangle(new DOMPoint(0, 0), new DOMPoint(width, height)),
        Color.WHITE as FillStyle,
        { color: Color.BLACK, weight: 1, }
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
        new NumberPlane(30 as Percentage),
        { color: line_color, weight: 2 },
        { color: line_color, weight: 1 }
    ).draw(canvas);

    for (const [id, element] of elements.entries()) {
        if (element instanceof Line) {
            new LineSegmentGraphic(
                element,
            ).draw(canvas);
        }

        if (id == selected) {
            for (const control_point of Object.values(element)) {

            }
        }
    }
};

let render_request: number | undefined = undefined;

const request_render = () => {
    if (render_request !== undefined) {
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