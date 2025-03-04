use wasm_bindgen::prelude::*;
use web_sys::{CanvasRenderingContext2d, HtmlCanvasElement};
use std::f64;

const WIDTH: f64 = 400.0;
const HEIGHT: f64 = 600.0;
const BIRD_RADIUS: f64 = 25.0;
const GRAVITY: f64 = 0.35;
const JUMP_STRENGTH: f64 = -7.0;
const PIPE_WIDTH: f64 = 50.0;
const PIPE_GAP: f64 = 150.0;

#[wasm_bindgen]
pub struct FlappyBird {
    bird_y: f64,
    bird_velocity: f64,
    pipes: Vec<(f64, f64)>,
    context: CanvasRenderingContext2d,
    running: bool,
}

#[wasm_bindgen]
impl FlappyBird {
    #[wasm_bindgen(constructor)]
    pub fn new(canvas: HtmlCanvasElement) -> FlappyBird {
        let context = canvas
            .get_context("2d")
            .unwrap()
            .unwrap()
            .dyn_into::<CanvasRenderingContext2d>()
            .unwrap();

        FlappyBird {
            bird_y: HEIGHT / 2.0,
            bird_velocity: 0.0,
            pipes: vec![(WIDTH, 200.0)],
            context,
            running: false,
        }
    }

    #[wasm_bindgen]
    pub fn update(&mut self, delta_time: f64) {
        if !self.running {
            return;
        }
    
        let time_scale = delta_time * 1000.0 / 16.67;  // ✅ Normalize updates to 60 FPS
    
        // ✅ Adjust gravity effect based on time scaling
        self.bird_velocity += GRAVITY * time_scale;
        if self.bird_velocity > 10.0 {
            self.bird_velocity = 10.0; // ✅ Clamp fall speed
        }
        self.bird_y += self.bird_velocity * time_scale;
    
        // ✅ Move pipes left based on deltaTime
        let pipe_speed = 2.0 * time_scale; // ✅ Speed up pipe movement
        for pipe in &mut self.pipes {
            pipe.0 -= pipe_speed;
        }
    
        // ✅ Generate new pipes with correct spacing
        if let Some(&(last_x, _)) = self.pipes.last() {
            if last_x < WIDTH - 250.0 { // ✅ Increased spacing to 250px
                let gap_y = (js_sys::Math::random() * (HEIGHT - PIPE_GAP)) as f64;
                self.pipes.push((WIDTH, gap_y));
            }
        }
    
        // ✅ Remove offscreen pipes
        self.pipes.retain(|&(x, _)| x > -PIPE_WIDTH);
    
        // ✅ Collision detection
        let mut collision = false;
        for &(pipe_x, gap_y) in &self.pipes {
            if (pipe_x < 50.0 && pipe_x + PIPE_WIDTH > 30.0) &&
               (self.bird_y - BIRD_RADIUS / 2.0 < gap_y || self.bird_y + BIRD_RADIUS / 2.0 > gap_y + PIPE_GAP) {
                collision = true;
                break;
            }
        }
    
        // ✅ Check for ground and ceiling collision
        if self.bird_y < 0.0 || self.bird_y > HEIGHT {
            collision = true;
        }
    
        // ✅ Reset if collision detected
        if collision {
            self.reset();
        }
    }    

    #[wasm_bindgen]
    pub fn render(&self) {
        self.context.set_fill_style(&"black".into());
        self.context.fill_rect(0.0, 0.0, WIDTH, HEIGHT);

        self.context.set_fill_style(&"yellow".into());
        self.context.begin_path();
        self.context.arc(50.0, self.bird_y, BIRD_RADIUS, 0.0, f64::consts::PI * 2.0).unwrap();
        self.context.fill();

        self.context.set_fill_style(&"green".into());
        for &(pipe_x, gap_y) in &self.pipes {
            self.context.fill_rect(pipe_x, 0.0, PIPE_WIDTH, gap_y);
            self.context.fill_rect(pipe_x, gap_y + PIPE_GAP, PIPE_WIDTH, HEIGHT - gap_y - PIPE_GAP);
        }
    }

    #[wasm_bindgen]
    pub fn flap(&mut self) {
        if !self.running {
            self.running = true;
        }
        self.bird_velocity = JUMP_STRENGTH;
    }

    #[wasm_bindgen]  // <-- Add this to expose `reset()`
    pub fn reset(&mut self) {
        self.bird_y = HEIGHT / 2.0;
        self.bird_velocity = 0.0;
        self.pipes = vec![(WIDTH, 200.0)];
        self.running = false;
    }
}