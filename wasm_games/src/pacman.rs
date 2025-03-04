use wasm_bindgen::prelude::*;
use web_sys::{CanvasRenderingContext2d, HtmlCanvasElement};
use js_sys::Math;
use std::collections::VecDeque; // ✅ Used for BFS pathfinding
use rand::Rng;
use rand::seq::SliceRandom; // ✅ Enables `shuffle()` method


const GRID_SIZE: f64 = 20.0;
const WIDTH: usize = 28;
const HEIGHT: usize = 31;
const NUM_GHOSTS: usize = 4;
const PACMAN_SPEED: u32 = 8;
const GHOST_SPEED: u32 = 12;
const PACMAN_MOVE_INTERVAL: f64 = 0.12; // ✅ Move every 120ms
const GHOST_MOVE_INTERVAL: f64 = 0.25; // ✅ Move every 250ms

#[wasm_bindgen]
pub struct PacmanGame {
    last_pacman_update: f64,
    last_ghost_update: f64,
    pacman: (usize, usize),
    direction: (i32, i32),
    next_direction: (i32, i32),
    ghosts: Vec<(usize, usize)>,
    ghost_directions: Vec<(i32, i32)>,
    tick_counter: u32,
    stopped: bool,
    context: CanvasRenderingContext2d,
    grid: [[u8; WIDTH]; HEIGHT],
}

#[wasm_bindgen]
impl PacmanGame {
    #[wasm_bindgen(constructor)]
    pub fn new(canvas: HtmlCanvasElement) -> PacmanGame {
        let context = canvas
            .get_context("2d")
            .unwrap()
            .unwrap()
            .dyn_into::<CanvasRenderingContext2d>()
            .unwrap();

        let mut grid = [[0; WIDTH]; HEIGHT];

        Self::generate_random_stage(&mut grid, 0.8);

        let pacman_start = (WIDTH / 2, HEIGHT / 2);
        let ghost_positions = vec![(13, 11), (14, 11), (15, 11), (16, 11)];
        let ghost_directions = vec![(0, 1), (0, -1), (1, 0), (-1, 0)];

        PacmanGame {
            last_pacman_update: 0.0,
            last_ghost_update: 0.0,
            pacman: pacman_start,
            direction: (0, 0),
            next_direction: (0, 0),
            ghosts: ghost_positions,
            ghost_directions,
            stopped: true,
            tick_counter: 0,
            context,
            grid,
        }              
    }

    /// ✅ Generates a maze-like grid with configurable openness
    fn generate_random_stage(grid: &mut [[u8; WIDTH]; HEIGHT], density_factor: f64) {
        let mut rng = rand::thread_rng();

        // 1. Fill the grid with walls
        for y in 0..HEIGHT {
            for x in 0..WIDTH {
                grid[y][x] = 1; // Wall
            }
        }

        // 2. Choose a random start point
        let start_x = rng.gen_range(1..WIDTH / 2) * 2; // Ensures odd indices
        let start_y = rng.gen_range(1..HEIGHT / 2) * 2;
        grid[start_y][start_x] = 0; // Open path

        let mut frontier = VecDeque::new();
        frontier.push_back((start_x, start_y));

        // 3. Generate the maze using Prim’s Algorithm
        let directions = [(0, -2), (0, 2), (-2, 0), (2, 0)]; // Moves in steps of 2

        while let Some((x, y)) = frontier.pop_front() {
            let mut possible_directions = directions.to_vec();
            possible_directions.shuffle(&mut rng);
        
            for &(dx, dy) in &possible_directions {
                let nx = x as i32 + dx;
                let ny = y as i32 + dy;
        
                // ✅ Fix: Ensure nx and ny are within valid bounds
                if nx >= 1 && nx < WIDTH as i32 - 1 && ny >= 1 && ny < HEIGHT as i32 - 1 {
                    let mid_x = x as i32 + dx / 2;
                    let mid_y = y as i32 + dy / 2;
        
                    // ✅ Ensure midpoint is within valid bounds before converting to usize
                    if mid_x >= 1 && mid_x < WIDTH as i32 - 1 && mid_y >= 1 && mid_y < HEIGHT as i32 - 1 {
                        let nx = nx as usize;
                        let ny = ny as usize;
                        let mid_x = mid_x as usize;
                        let mid_y = mid_y as usize;
        
                        if grid[ny][nx] == 1 {
                            grid[ny][nx] = 0;
                            grid[mid_y][mid_x] = 0;
                            frontier.push_back((nx, ny));
                        }
                    }
                }
            }
        }        

        // 4. Remove extra walls based on `density_factor`
        let remove_wall_count = ((WIDTH * HEIGHT) as f64 * density_factor) as usize;
        for _ in 0..remove_wall_count {
            let x = rng.gen_range(1..WIDTH - 1);
            let y = rng.gen_range(1..HEIGHT - 1);

            if grid[y][x] == 1 {
                grid[y][x] = 0; // Remove the wall to open the path
            }
        }

        // 5. ✅ Ensure every open space has a pellet
        for y in 1..HEIGHT - 1 {
            for x in 1..WIDTH - 1 {
                if grid[y][x] == 0 { 
                    grid[y][x] = 2; // ✅ Every open space now has a pellet
                }
            }
        }
    }

    #[wasm_bindgen]
    pub fn update(&mut self, delta_time: f64) {
        // ✅ Ghosts should always move independently
        self.last_ghost_update += delta_time;
        if self.last_ghost_update >= GHOST_MOVE_INTERVAL {
            self.last_ghost_update = 0.0;

            let mut new_positions = Vec::new();
            let mut new_directions = Vec::new();

            for (i, &ghost) in self.ghosts.iter().enumerate() {
                let new_dir = self.get_next_ghost_move(ghost, self.pacman);
                let new_pos = ((ghost.0 as i32 + new_dir.0) as usize, (ghost.1 as i32 + new_dir.1) as usize);

                new_positions.push(new_pos);
                new_directions.push(new_dir);
            }

            self.ghosts = new_positions;
            self.ghost_directions = new_directions;
        }

        // ✅ Pac-Man only moves when an arrow key is actively pressed
        if self.stopped {
            return; // ❌ Stop Pac-Man but keep ghosts moving
        }

        self.last_pacman_update += delta_time;
        if self.last_pacman_update >= PACMAN_MOVE_INTERVAL {
            self.last_pacman_update = 0.0;

            let (dx, dy) = self.direction;
            let new_x = (self.pacman.0 as i32 + dx) as usize;
            let new_y = (self.pacman.1 as i32 + dy) as usize;

            if self.grid[new_y][new_x] != 1 {
                self.pacman = (new_x, new_y);
                // Eat pellet
                if self.grid[new_y][new_x] == 2 {
                    self.grid[new_y][new_x] = 0;
                }
            } else {
                self.stopped = true; // ✅ Stop Pac-Man if he hits a wall
            }
        }

        // ✅ Check for collisions with ghosts
        if self.ghosts.contains(&self.pacman) {
            self.reset();
        }
    }

    /// ✅ Improved Ghost Pathfinding (Prevents Moving into Walls)
    fn get_next_ghost_move(&self, ghost: (usize, usize), target: (usize, usize)) -> (i32, i32) {
        let directions = [(0, -1), (0, 1), (-1, 0), (1, 0)]; // Up, Down, Left, Right
        let mut queue = VecDeque::new();
        let mut visited = [[false; WIDTH]; HEIGHT];
        let mut parent = [[None; WIDTH]; HEIGHT];
        let mut rng = rand::thread_rng();

        // ✅ 30% chance to target a random tile instead of Pac-Man
        let target = if rng.gen_range(0..100) < 30 {
            (rng.gen_range(1..WIDTH - 1), rng.gen_range(1..HEIGHT - 1))
        } else {
            target
        };

        queue.push_back(ghost);
        visited[ghost.1][ghost.0] = true;

        while let Some((x, y)) = queue.pop_front() {
            if (x, y) == target {
                break; // Found the shortest path
            }

            for &(dx, dy) in &directions {
                let nx = x as i32 + dx;
                let ny = y as i32 + dy;

                if nx >= 0 && nx < WIDTH as i32 && ny >= 0 && ny < HEIGHT as i32 {
                    let nx = nx as usize;
                    let ny = ny as usize;

                    if self.grid[ny][nx] != 1 && !visited[ny][nx] {
                        queue.push_back((nx, ny));
                        visited[ny][nx] = true;
                        parent[ny][nx] = Some((x, y));
                    }
                }
            }
        }

        // ✅ 30% chance to make a wrong turn, but only to a valid tile
        if rng.gen_range(0..100) < 30 {
            let mut shuffled_directions = directions.to_vec();
            shuffled_directions.shuffle(&mut rng); // Randomize choices

            for &(dx, dy) in &shuffled_directions {
                let new_x = ghost.0 as i32 + dx;
                let new_y = ghost.1 as i32 + dy;

                if new_x >= 0 && new_x < WIDTH as i32 && new_y >= 0 && new_y < HEIGHT as i32 {
                    let new_x = new_x as usize;
                    let new_y = new_y as usize;

                    if self.grid[new_y][new_x] != 1 { // ✅ Ensure it's not a wall
                        return (dx, dy);
                    }
                }
            }
        }

        // ✅ Find the first step in the shortest path
        let mut step = target;
        while let Some(prev) = parent[step.1][step.0] {
            if prev == ghost {
                let move_x = step.0 as i32 - ghost.0 as i32;
                let move_y = step.1 as i32 - ghost.1 as i32;

                // ✅ Ensure the ghost does not move onto a wall
                let next_x = ghost.0 as i32 + move_x;
                let next_y = ghost.1 as i32 + move_y;
                if next_x >= 0 && next_x < WIDTH as i32 && next_y >= 0 && next_y < HEIGHT as i32 {
                    let next_x = next_x as usize;
                    let next_y = next_y as usize;

                    if self.grid[next_y][next_x] != 1 {
                        return (move_x, move_y);
                    }
                }
            }
            step = prev;
        }

        (0, 0) // No valid move found (stay in place)
    }

    #[wasm_bindgen]
    pub fn render(&self) {
        self.context.set_fill_style(&"black".into());
        self.context.fill_rect(0.0, 0.0, (WIDTH as f64) * GRID_SIZE, (HEIGHT as f64) * GRID_SIZE);

        // Draw walls, pellets
        for y in 0..HEIGHT {
            for x in 0..WIDTH {
                match self.grid[y][x] {
                    1 => {
                        self.context.set_fill_style(&"blue".into()); // Wall
                        self.context.fill_rect(
                            (x as f64) * GRID_SIZE,
                            (y as f64) * GRID_SIZE,
                            GRID_SIZE,
                            GRID_SIZE,
                        );
                    }
                    2 => {
                        self.context.set_fill_style(&"white".into()); // Pellet
                        self.context.begin_path();
                        self.context
                            .arc(
                                (x as f64 + 0.5) * GRID_SIZE,
                                (y as f64 + 0.5) * GRID_SIZE,
                                3.0,
                                0.0,
                                std::f64::consts::PI * 2.0,
                            )
                            .unwrap();
                        self.context.fill();
                    }
                    _ => {}
                }
            }
        }

        // ✅ Draw Pac-Man
        self.context.set_fill_style(&"yellow".into());
        self.context.begin_path();
        self.context
            .arc(
                (self.pacman.0 as f64 + 0.5) * GRID_SIZE,
                (self.pacman.1 as f64 + 0.5) * GRID_SIZE,
                GRID_SIZE / 2.0,
                0.2,
                std::f64::consts::PI * 1.8,
            )
            .unwrap();
        self.context.fill();

        // ✅ Updated Ghost Rendering with Classic Colors
        let ghost_colors = ["#FF0000", "#FFC0CB", "#00FFFF", "#FFA500"]; // Blinky, Pinky, Inky, Clyde

        for (i, &(gx, gy)) in self.ghosts.iter().enumerate() {
            let color = ghost_colors[i % ghost_colors.len()]; // Assign colors in order

            self.context.set_fill_style(&color.into());
            self.context.begin_path();
            self.context
                .arc(
                    (gx as f64 + 0.5) * GRID_SIZE,
                    (gy as f64 + 0.5) * GRID_SIZE,
                    GRID_SIZE / 2.0,
                    0.0,
                    std::f64::consts::PI * 2.0,
                )
                .unwrap();
            self.context.fill();
        }
    }

    #[wasm_bindgen]
    pub fn change_direction(&mut self, dx: i32, dy: i32) {
        if dx == 0 && dy == 0 {
            self.stopped = true;  // ✅ Stop Pac-Man when no key is pressed
        } else {
            self.next_direction = (dx, dy);
            self.direction = (dx, dy); // ✅ Update direction immediately
            self.stopped = false;      // ✅ Resume movement when key is pressed
        }
    }

    #[wasm_bindgen]
    pub fn reset(&mut self) {
        self.pacman = (14, 23);
        self.direction = (0, 0);
        self.next_direction = (0, 0);
        self.stopped = true;

        self.ghosts = vec![(13, 11), (14, 11), (15, 11), (16, 11)];
        self.ghost_directions = vec![(0, 1), (0, -1), (1, 0), (-1, 0)];

        // Restore pellets
        for y in 0..HEIGHT {
            for x in 0..WIDTH {
                if self.grid[y][x] != 1 {
                    self.grid[y][x] = 2;
                }
            }
        }
    }
}
