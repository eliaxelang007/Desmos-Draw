// #region asserts.ts

class AssertionError extends Error { }

function assert(condition: boolean, message: string): asserts condition {
    if (condition) return;

    throw new AssertionError(message);
}

//#endregion asserts.ts

// #region options.ts

function is_some_option<T>(option: T | undefined): option is T {
    return option !== undefined;
}

function unwrap_option<T>(option: T | undefined | null): T {
    assert(is_some_option(option) && option !== null, "Called unwrap on a None value!");
    return option;
}

// #endregion options.ts

// #region extent.ts

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

    contains(value: number) {
        return value >= this.min && value <= this.max;
    }
}

// #endregion

// #region draw.ts
type NewType<T, Brand> = T & { __brand: Brand };

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

type Position = {
    x: number;
    y: number;
};

type CanvasAxis = NewType<number, "CanvasAxis">;

type CanvasPosition = {
    x: CanvasAxis;
    y: CanvasAxis;
};

type MathAxis = NewType<number, "MathAxis">;

type MathPosition = {
    x: MathAxis;
    y: MathAxis;
};

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
    draw_on(canvas: CanvasRenderingContext2D): void;
}

class Rectangle {
    readonly top_left: Position;
    readonly size: Size;

    constructor(top_left: Position, size: Size) {
        this.top_left = top_left;
        this.size = size;
    }
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

    draw_on(canvas: CanvasRenderingContext2D): void {
        canvas.fillStyle = this.fill_style.to_style();

        const rectangle = this.rectangle;
        const top_left = rectangle.top_left;
        const size = rectangle.size;

        const stroke_style = this.stroke_style;

        let drawer = () => canvas.fill();

        if (stroke_style !== undefined) {
            canvas.lineWidth = stroke_style.weight;
            canvas.strokeStyle = stroke_style.color.to_style();

            drawer = () => { canvas.fill(); canvas.stroke(); }
        }

        canvas.rect(top_left.x, top_left.y, size.width, size.height);
        drawer();
    }
}

class Line {
    constructor(
        readonly start: Position,
        readonly end: Position
    ) { }
}

class LineGraphic implements Drawable {
    readonly stroke_style: StrokeStyle;

    constructor(
        readonly line: Line,
        stroke_style?: StrokeStyle
    ) {
        this.stroke_style = stroke_style ?? { color: Color.BLACK, weight: 1 };
    }

    draw_on(canvas: CanvasRenderingContext2D): void {
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

// #endregion draw.ts

// #region math.ts

interface MathDrawable {
    draw_on(canvas: MathCanvas): void;
}

// type CanvasPosition = NewType<Position, "CanvasPosition">;
// type MathPosition = NewType<Position, "MathPosition">;

class MathCanvas {
    constructor(
        readonly canvas: CanvasRenderingContext2D,
        readonly origin: CanvasPosition,
        readonly unit_size: number
    ) { }

    to_canvas_x(x: MathAxis): CanvasAxis {
        return (this.origin.x + (x * this.unit_size)) as CanvasAxis;
    }

    to_canvas_y(y: MathAxis): CanvasAxis {
        return (this.origin.y + (-y * this.unit_size)) as CanvasAxis;
    }

    to_canvas_position(position: MathPosition): CanvasPosition {
        return {
            x: this.to_canvas_x(position.x),
            y: this.to_canvas_y(position.y)
        } as CanvasPosition;
    }

    to_math_x(x: CanvasAxis): MathAxis {
        return ((x - this.origin.x) / this.unit_size) as MathAxis;
    }

    to_math_y(y: CanvasAxis): MathAxis {
        return (((y - this.origin.y) / this.unit_size) * -1) as MathAxis;
    }

    to_math_position(position: CanvasPosition): MathPosition {
        return {
            x: this.to_math_x(position.x),
            y: this.to_math_y(position.y)
        } as MathPosition;
    }
}

class MathLineGraphic implements MathDrawable {
    constructor(
        readonly line_graphic: LineGraphic
    ) {
    }

    draw_on(canvas: MathCanvas): void {
        const graphic = this.line_graphic;

        const line = graphic.line;
        const start = line.start;
        const end = line.end;

        new LineGraphic(
            new Line(canvas.to_canvas_position(start as MathPosition), canvas.to_canvas_position(end as MathPosition)),
            graphic.stroke_style
        ).draw_on(canvas.canvas);
    }
}

// #endregion math.ts

const canvas_element = unwrap_option(document.getElementById("canvas")) as HTMLCanvasElement;
const canvas = canvas_element.getContext("2d");

assert(canvas !== null, "Failed to retrieve the canvas context!");

let width = 0;
let height = 0;

// const unit_size = 30;


const render = () => {
    canvas_element.width = width;
    canvas_element.height = height;

    new RectangleGraphic(
        new Rectangle({ x: 0, y: 0 }, { width: width, height: height }),
        Color.WHITE as FillStyle,
        { color: Color.BLACK, weight: 1, }
    ).draw_on(canvas);

    const line_color = Color.monochrome(200);

    const middle_x = width / 2;
    const middle_y = height / 2;

    const unit_size = 30;

    const math_canvas = new MathCanvas(canvas, { x: middle_x, y: middle_y } as CanvasPosition, unit_size);

    const draw_vertical_line = (at_x: number, weight: number = 1) => {
        new MathLineGraphic(
            new LineGraphic(
                new Line(
                    { x: at_x, y: math_canvas.to_math_y(0 as CanvasAxis) },
                    { x: at_x, y: math_canvas.to_math_y(height as CanvasAxis) }
                ),
                { color: line_color, weight: weight }
            )
        ).draw_on(math_canvas);
    };

    const draw_horizontal_line = (at_y: number, weight: number = 1) => {
        new MathLineGraphic(
            new LineGraphic(
                new Line(
                    { x: math_canvas.to_math_x(0 as CanvasAxis), y: at_y },
                    { x: math_canvas.to_math_x(width as CanvasAxis), y: at_y }
                ),
                { color: line_color, weight: weight }
            )
        ).draw_on(math_canvas);
    }

    let

        draw_vertical_line(0, 2);
    draw_horizontal_line(0, 2);

    new MathLineGraphic(
        new LineGraphic(new Line({ x: 2, y: 2 }, { x: -5, y: 5 })),
    ).draw_on(math_canvas);
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
    assert(screen_size !== undefined, "The resize observer couldn't get a size!")

    width = screen_size.inlineSize;
    height = screen_size.blockSize;

    request_render();
};

const canvas_observer = new ResizeObserver(resize_canvas);
canvas_observer.observe(canvas_element);

window.addEventListener("mousemove", () => request_render());
window.addEventListener("mousedown", () => request_render());
window.addEventListener("mouseup", () => request_render());