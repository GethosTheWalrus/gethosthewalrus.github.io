use wasm_bindgen::prelude::*;
use web_sys::{CanvasRenderingContext2d, HtmlCanvasElement};
use std::f64;

const GRID_SIZE: f64 = 20.0;
const WIDTH: u32 = 20;
const HEIGHT: u32 = 20;
const SNAKE_MOVE_INTERVAL: f64 = 0.15; // ✅ Move every 150ms

#[wasm_bindgen]
pub struct SnakeGame {
    last_update_time: f64, // ✅ Track last movement time
    snake: Vec<(u32, u32)>,
    direction: (i32, i32),
    food: (u32, u32),
    context: CanvasRenderingContext2d,
    running: bool,
    tick_counter: u32,
}

#[wasm_bindgen]
impl SnakeGame {
    #[wasm_bindgen(constructor)]
    pub fn new(canvas: HtmlCanvasElement) -> SnakeGame {
        let context = canvas
            .get_context("2d")
            .unwrap()
            .unwrap()
            .dyn_into::<CanvasRenderingContext2d>()
            .unwrap();

        SnakeGame {
            last_update_time: 0.0,
            snake: vec![(10, 10)],
            direction: (0, 0),
            food: (5, 5),
            context,
            running: false,
            tick_counter: 0,
        }
    }

    #[wasm_bindgen]
    pub fn update(&mut self, delta_time: f64) {
        if !self.running {
            return;
        }

        self.last_update_time += delta_time;
        if self.last_update_time < SNAKE_MOVE_INTERVAL {
            return; // ✅ Skip updates until enough time has passed
        }
        self.last_update_time = 0.0;

        let (dx, dy) = self.direction;
        if dx == 0 && dy == 0 {
            return;
        }

        let (head_x, head_y) = self.snake[0];
        let new_head = ((head_x as i32 + dx) as u32, (head_y as i32 + dy) as u32);

        if new_head.0 >= WIDTH || new_head.1 >= HEIGHT {
            self.reset();
            return;
        }

        if new_head == self.food {
            self.food = ((js_sys::Math::random() * WIDTH as f64) as u32,
                        (js_sys::Math::random() * HEIGHT as f64) as u32);
        } else {
            self.snake.pop();
        }

        if self.snake.contains(&new_head) {
            self.reset();
        } else {
            self.snake.insert(0, new_head);
        }
    }

    #[wasm_bindgen]
    pub fn render(&self) {
        self.context.set_fill_style(&"black".into());
        self.context.fill_rect(0.0, 0.0, (WIDTH as f64) * GRID_SIZE, (HEIGHT as f64) * GRID_SIZE);

        self.context.set_fill_style(&"green".into());
        for (x, y) in &self.snake {
            self.context.fill_rect((*x as f64) * GRID_SIZE, (*y as f64) * GRID_SIZE, GRID_SIZE, GRID_SIZE);
        }

        self.context.set_fill_style(&"red".into());
        let (fx, fy) = self.food;
        self.context.fill_rect((fx as f64) * GRID_SIZE, (fy as f64) * GRID_SIZE, GRID_SIZE, GRID_SIZE);
    }

    #[wasm_bindgen]
    pub fn change_direction(&mut self, dx: i32, dy: i32) {
        if (dx, dy) != (-self.direction.0, -self.direction.1) {
            self.direction = (dx, dy);
        }

        if !self.running {
            self.running = true;
        }
    }

    #[wasm_bindgen]
    pub fn reset(&mut self) {
        self.snake = vec![(10, 10)];
        self.direction = (0, 0);
        self.food = ((js_sys::Math::random() * WIDTH as f64) as u32,
                     (js_sys::Math::random() * HEIGHT as f64) as u32);
        self.running = false;
    }
}
