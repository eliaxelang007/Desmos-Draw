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

type Size = {
    width: number;
    height: number;
};

type StrokeStyle = {
    weight: number;
    color: Color;
};

type FillStyle = Color;

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

class DrawableRectangle implements Drawable {
    readonly fill_style: FillStyle;

    constructor(
        readonly rectangle: Rectangle,
        fill_color?: FillStyle,
        readonly stroke_style?: StrokeStyle
    ) {
        this.fill_style = fill_color ?? Color.WHITE;
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

class DrawableLine implements Drawable {
    readonly stroke_style: StrokeStyle

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

//#endregion draw.ts

function main() {
    const canvas_element = unwrap_option(document.getElementById("canvas")) as HTMLCanvasElement;
    const canvas = canvas_element.getContext("2d");

    assert(canvas !== null, "Failed to retrieve the canvas context!");

    let width = 0;
    let height = 0;

    const render = () => {
        canvas_element.width = width;
        canvas_element.height = height;

        const LEFT_X = 0;
        const TOP_Y = 0;

        const right_x = width;
        const bottom_y = height;

        const middle_x = width / 2;
        const middle_y = height / 2;

        const background = new DrawableRectangle(
            new Rectangle({ x: LEFT_X, y: TOP_Y }, { width: right_x, height: bottom_y }),
            Color.WHITE,
            { color: Color.BLACK, weight: 1, }
        );

        const x_axis = new DrawableLine(
            new Line({ x: middle_x, y: TOP_Y }, { x: middle_x, y: bottom_y }),
            { color: Color.BLACK, weight: 2, }
        );

        const y_axis = new DrawableLine(
            new Line({ x: LEFT_X, y: middle_y }, { x: right_x, y: middle_y }),
            { color: Color.BLACK, weight: 2, }
        );

        background.draw_on(canvas);
        x_axis.draw_on(canvas);
        y_axis.draw_on(canvas);
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

    window.onmousemove = () => request_render();
    window.onmousedown = () => request_render();
    window.onmouseup = () => request_render();
}

main();