/* tslint:disable */
/* eslint-disable */
export function start(): void;
export class FlappyBird {
  free(): void;
  constructor(canvas: HTMLCanvasElement);
  update(): void;
  render(): void;
  flap(): void;
  reset(): void;
}
export class PacmanGame {
  free(): void;
  constructor(canvas: HTMLCanvasElement);
  update(): void;
  render(): void;
  change_direction(dx: number, dy: number): void;
  reset(): void;
}
export class SnakeGame {
  free(): void;
  constructor(canvas: HTMLCanvasElement);
  update(): void;
  render(): void;
  change_direction(dx: number, dy: number): void;
  reset(): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_flappybird_free: (a: number, b: number) => void;
  readonly flappybird_new: (a: any) => number;
  readonly flappybird_update: (a: number) => void;
  readonly flappybird_render: (a: number) => void;
  readonly flappybird_flap: (a: number) => void;
  readonly flappybird_reset: (a: number) => void;
  readonly __wbg_pacmangame_free: (a: number, b: number) => void;
  readonly pacmangame_new: (a: any) => number;
  readonly pacmangame_update: (a: number) => void;
  readonly pacmangame_render: (a: number) => void;
  readonly pacmangame_change_direction: (a: number, b: number, c: number) => void;
  readonly pacmangame_reset: (a: number) => void;
  readonly __wbg_snakegame_free: (a: number, b: number) => void;
  readonly snakegame_new: (a: any) => number;
  readonly snakegame_update: (a: number) => void;
  readonly snakegame_render: (a: number) => void;
  readonly snakegame_change_direction: (a: number, b: number, c: number) => void;
  readonly snakegame_reset: (a: number) => void;
  readonly start: () => void;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_2: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
