use wasm_bindgen::prelude::*;

mod flappy;
mod snake;
mod pacman;

pub use flappy::FlappyBird;
pub use snake::SnakeGame;
pub use pacman::PacmanGame;

#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}
