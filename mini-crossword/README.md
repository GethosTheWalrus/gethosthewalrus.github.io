# Mini Crossword Puzzle

A web-based mini crossword puzzle game that generates 5x5 crossword puzzles from a JSON word database. Each puzzle is generated from a seed ID, ensuring consistent puzzles that can be shared via URL.

## Features

- **Seeded Generation**: Each puzzle is generated from a seed ID, allowing for consistent, shareable puzzles
- **URL Sharing**: Puzzles can be shared via URL with the seed parameter
- **Interactive Grid**: Click and type to fill in letters, with keyboard navigation support
- **Clue Highlighting**: Click on clues or cells to highlight the corresponding word
- **Puzzle Validation**: Check your answers and see correct/incorrect letters
- **Solution Reveal**: Get help when stuck by revealing the solution
- **Responsive Design**: Works on desktop and mobile devices

## Files Structure

- `index.html` - Main HTML structure
- `styles.css` - Complete styling for the crossword interface
- `crossword-generator.js` - Core puzzle generation logic with seeded randomization
- `app.js` - Main application logic and user interface handling
- `words.json` - Database of words and clues for puzzle generation

## How It Works

### Puzzle Generation
1. The `CrosswordGenerator` class uses a seeded random number generator to ensure consistent puzzle generation
2. Words are selected from the JSON database and placed on a 5x5 grid
3. The algorithm tries to create intersecting words while maintaining valid crossword structure
4. Remaining cells are marked as blocked (black squares)

### Seeded Randomization
- Uses the Mulberry32 algorithm for seeded random number generation
- Same seed always produces the same puzzle layout and word selection
- Seeds can be shared via URL parameter: `?seed=12345`

### User Interface
- Click on cells or clues to select words
- Type letters directly into cells
- Use arrow keys for navigation
- Keyboard shortcuts: Space/Enter to move forward, Backspace to move backward
- Toggle between intersecting across/down words by clicking the same cell

## Usage

### Running Locally
1. Clone or download the project files
2. Open `index.html` in a web browser
3. No server required - runs entirely in the browser

### URL Parameters
- `?seed=12345` - Load a specific puzzle by seed ID
- No seed parameter - Generate a random new puzzle

### Controls
- **New Puzzle**: Generate a fresh random puzzle
- **Share Puzzle**: Copy the current puzzle URL to clipboard (or use native sharing on mobile)
- **Check Puzzle**: Validate your answers and see progress
- **Reveal Solution**: Show the complete solution
- **Clear All**: Remove all entered letters

## Word Database

The `words.json` file contains an array of word objects with the following structure:

```json
{
  "words": [
    {
      "word": "CAT",
      "clue": "Feline pet"
    }
  ]
}
```

You can easily expand the word database by adding more entries to this file.

## Browser Compatibility

- Modern browsers with ES6+ support
- Uses Fetch API for loading word data
- CSS Grid for layout
- Works on mobile devices with touch support

## Customization

### Grid Size
Change the `gridSize` property in the `CrosswordGenerator` constructor to create different sized puzzles.

### Word Selection
Modify the word placement algorithm in `crossword-generator.js` to change how words are selected and arranged.

### Styling
Update `styles.css` to customize the appearance, colors, and layout.

### Word Database
Add more words to `words.json` to increase puzzle variety.

## Technical Details

- Pure JavaScript (no external dependencies)
- Responsive CSS Grid layout
- Seeded random generation for consistency
- Local storage could be added for saving progress
- PWA features could be added for offline usage

Enjoy creating and solving mini crossword puzzles!
