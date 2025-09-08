class CrosswordGenerator {
    constructor(wordsData, seed = Date.now()) {
        this.words = wordsData.words;
        this.seed = seed;
        this.calculateGridSize();
    }

    calculateGridSize() {
        // Find the longest word
        const maxWordLength = Math.max(...this.words.map(w => w.word.length));
        
        // Use a more conservative grid size - we'll trim it later
        // Start with a grid that's 70% of max word length but at least 5x5
        this.gridSize = Math.max(5, Math.ceil(maxWordLength * 0.8));
        
        // Cap at 12x12 to keep puzzles manageable
        this.gridSize = Math.min(12, this.gridSize);
        
        console.log(`Grid size set to ${this.gridSize}x${this.gridSize} based on max word length: ${maxWordLength}`);
    }

    // Seeded random number generator for consistent puzzle generation
    seedRandom(seed) {
        this.seed = seed;
        this.rng = this.mulberry32(seed);
    }

    mulberry32(a) {
        return function() {
            let t = a += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
    }

    random() {
        return this.rng();
    }

    // Fisher-Yates shuffle with seeded random
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(this.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    generatePuzzle(seed) {
        this.seedRandom(seed);
        
        // Initialize empty grid
        this.grid = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(null));
        this.solution = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(''));
        this.placedWords = [];
        this.clues = { across: {}, down: {} };
        this.wordNumbers = {};

        // Try multiple attempts to generate a balanced puzzle
        let bestAttempt = null;
        let bestScore = 0;

        for (let attempt = 0; attempt < 15; attempt++) {
            const attemptResult = this.generateSingleAttempt(seed + attempt);
            const score = this.scorePuzzle(attemptResult);
            
            if (score > bestScore) {
                bestScore = score;
                bestAttempt = attemptResult;
            }
        }

        // Use the best attempt
        if (bestAttempt) {
            this.grid = bestAttempt.grid;
            this.solution = bestAttempt.solution;
            this.placedWords = bestAttempt.placedWords;
            this.clues = bestAttempt.clues;
        } else {
            // Fallback: create a minimal puzzle if no good attempt found
            this.createFallbackPuzzle();
        }

        // Ensure all grid cells are properly initialized
        this.ensureGridComplete();

        // Trim the grid to remove unused rows/columns
        this.trimGrid();

        // Assign numbers to words
        this.assignWordNumbers();

        return {
            grid: this.grid,
            solution: this.solution,
            clues: this.clues,
            seed: seed,
            placedWords: this.placedWords
        };
    }

    scorePuzzle(attempt) {
        const acrossCount = attempt.placedWords.filter(w => w.direction === 'across').length;
        const downCount = attempt.placedWords.filter(w => w.direction === 'down').length;
        
        // Calculate density
        let filledCells = 0;
        const totalCells = this.gridSize * this.gridSize;
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                if (attempt.grid[row][col] && !attempt.grid[row][col].isBlocked) {
                    filledCells++;
                }
            }
        }
        const density = filledCells / totalCells;
        
        // Give a base score even if not perfectly balanced
        let score = density * 0.5 + (attempt.placedWords.length / 10) * 0.3;
        
        // Heavily reward if we have at least 3 of each direction
        if (acrossCount >= 3 && downCount >= 3) {
            const balance = Math.min(acrossCount, downCount) / Math.max(acrossCount, downCount);
            score += balance * 0.8; // Big bonus for balanced puzzles
        } else if (acrossCount >= 2 && downCount >= 2) {
            // Smaller bonus for partially balanced
            score += 0.2;
        }
        
        return score;
    }

    generateSingleAttempt(seed) {
        this.seedRandom(seed);
        
        // Reset for this attempt
        const grid = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(null));
        const solution = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(''));
        const placedWords = [];
        const clues = { across: {}, down: {} };

        // Get words suitable for the grid size
        const suitableWords = this.words.filter(w => 
            w.word.length >= 3 && w.word.length <= this.gridSize
        );
        const shuffledWords = this.shuffleArray(suitableWords);

        // Strategy: Ensure balanced placement
        this.placeWordsBalanced(shuffledWords, grid, solution, placedWords);

        // Fill minimal blocked cells
        this.fillMinimalBlockedCells(grid, solution);

        return { grid, solution, placedWords, clues };
    }

    placeWordsBalanced(words, grid, solution, placedWords) {
        // Place first word (horizontal)
        const firstWord = words.find(w => w.word.length >= 4) || words[0];
        if (firstWord) {
            this.placeFirstWord(firstWord, grid, solution, placedWords);
        }

        // Track direction counts
        let acrossCount = placedWords.filter(w => w.direction === 'across').length;
        let downCount = placedWords.filter(w => w.direction === 'down').length;

        // Continue placing words - try to place as many as possible for density
        for (let i = 1; i < words.length && placedWords.length < 15; i++) {
            const word = words[i];
            
            // Skip if already used
            if (placedWords.some(pw => pw.word === word.word)) continue;
            
            // Determine preferred direction based on current balance
            let preferredDirection = null;
            if (acrossCount < downCount) {
                preferredDirection = 'across';
            } else if (downCount < acrossCount) {
                preferredDirection = 'down';
            }
            
            // Try preferred direction first, then the other
            const directions = preferredDirection ? 
                [preferredDirection, preferredDirection === 'across' ? 'down' : 'across'] :
                ['across', 'down'];
            
            let placed = false;
            for (const direction of directions) {
                if (this.tryPlaceWordInDirection(word, direction, grid, solution, placedWords)) {
                    placed = true;
                    break;
                }
            }
            
            if (placed) {
                acrossCount = placedWords.filter(w => w.direction === 'across').length;
                downCount = placedWords.filter(w => w.direction === 'down').length;
            }
        }

        // If we still don't have enough in either direction, force placement
        if (acrossCount < 3 || downCount < 3) {
            this.forceBalancedPlacement(words, grid, solution, placedWords);
        }
    }

    tryPlaceWordInDirection(wordData, direction, grid, solution, placedWords) {
        const word = wordData.word;
        const possiblePlacements = [];

        // Find all possible placements for this direction
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                if (this.canPlaceWordAt(word, row, col, direction, grid, solution)) {
                    const intersections = this.countIntersections(word, row, col, direction, solution);
                    
                    // For denser puzzles, require intersections for all words except the first
                    if (intersections > 0 || placedWords.length === 0) {
                        possiblePlacements.push({
                            row, col, 
                            intersections, 
                            coverage: this.calculateCoverage(word, row, col, direction, grid),
                            // Add density score - prefer placements that create more crossing opportunities
                            densityScore: this.calculateDensityScore(word, row, col, direction, grid, solution)
                        });
                    }
                }
            }
        }

        if (possiblePlacements.length === 0) return false;

        // Sort by intersections first, then density score, then coverage
        possiblePlacements.sort((a, b) => {
            if (a.intersections !== b.intersections) {
                return b.intersections - a.intersections;
            }
            if (a.densityScore !== b.densityScore) {
                return b.densityScore - a.densityScore;
            }
            return b.coverage - a.coverage;
        });

        // Place the word at the best location
        const bestPlacement = possiblePlacements[0];
        this.placeWordAt(wordData, bestPlacement.row, bestPlacement.col, 
                        direction, grid, solution, placedWords);
        return true;
    }

    forceBalancedPlacement(words, grid, solution, placedWords) {
        const acrossCount = placedWords.filter(w => w.direction === 'across').length;
        const downCount = placedWords.filter(w => w.direction === 'down').length;
        
        // Try to place more words with emphasis on the less represented direction
        const targetDirection = acrossCount < downCount ? 'across' : 'down';
        
        // Try to force placement of more words
        for (const word of words) {
            if (placedWords.some(pw => pw.word === word.word)) continue;
            if (placedWords.length >= 15) break; // Increased limit for denser puzzles
            
            // Try target direction first
            if (this.tryPlaceWordInDirection(word, targetDirection, grid, solution, placedWords)) {
                continue;
            }
            
            // Then try the other direction
            const otherDirection = targetDirection === 'across' ? 'down' : 'across';
            if (this.tryPlaceWordInDirection(word, otherDirection, grid, solution, placedWords)) {
                continue;
            }
        }
    }

    placeFirstWord(wordData, grid, solution, placedWords) {
        const word = wordData.word;
        
        // Try both horizontal and vertical placement
        const placements = [
            // Horizontal in middle
            { row: Math.floor(this.gridSize / 2), col: Math.floor((this.gridSize - word.length) / 2), direction: 'across' },
            // Vertical in middle
            { row: Math.floor((this.gridSize - word.length) / 2), col: Math.floor(this.gridSize / 2), direction: 'down' },
            // Horizontal offset
            { row: 1, col: 0, direction: 'across' },
            // Vertical offset
            { row: 0, col: 1, direction: 'down' }
        ];

        for (const placement of placements) {
            if (this.canPlaceWordAt(word, placement.row, placement.col, placement.direction, grid, solution)) {
                this.placeWordAt(wordData, placement.row, placement.col, placement.direction, grid, solution, placedWords);
                return true;
            }
        }

        return false;
    }

    countIntersections(word, row, col, direction, solution) {
        let intersections = 0;
        for (let i = 0; i < word.length; i++) {
            const checkRow = direction === 'across' ? row : row + i;
            const checkCol = direction === 'across' ? col + i : col;
            
            if (solution[checkRow][checkCol] === word[i]) {
                intersections++;
            }
        }
        return intersections;
    }

    calculateCoverage(word, row, col, direction, grid) {
        let newCells = 0;
        for (let i = 0; i < word.length; i++) {
            const checkRow = direction === 'across' ? row : row + i;
            const checkCol = direction === 'across' ? col + i : col;
            
            if (!grid[checkRow][checkCol]) {
                newCells++;
            }
        }
        return newCells;
    }

    calculateDensityScore(word, row, col, direction, grid, solution) {
        let densityScore = 0;
        
        // Score based on how many potential crossing points this word creates
        for (let i = 0; i < word.length; i++) {
            const checkRow = direction === 'across' ? row : row + i;
            const checkCol = direction === 'across' ? col + i : col;
            
            // Skip if this position already has a letter (intersection)
            if (solution[checkRow][checkCol]) continue;
            
            // Check perpendicular directions for potential word placements
            const perpDirection = direction === 'across' ? 'down' : 'across';
            
            // Count how many positions this could intersect with future words
            if (perpDirection === 'down') {
                // Check vertical space above and below
                let spaceAbove = 0, spaceBelow = 0;
                for (let r = checkRow - 1; r >= 0 && !solution[r][checkCol]; r--) spaceAbove++;
                for (let r = checkRow + 1; r < this.gridSize && !solution[r][checkCol]; r++) spaceBelow++;
                if (spaceAbove + spaceBelow >= 2) densityScore += 2; // Good crossing potential
            } else {
                // Check horizontal space left and right  
                let spaceLeft = 0, spaceRight = 0;
                for (let c = checkCol - 1; c >= 0 && !solution[checkRow][c]; c--) spaceLeft++;
                for (let c = checkCol + 1; c < this.gridSize && !solution[checkRow][c]; c++) spaceRight++;
                if (spaceLeft + spaceRight >= 2) densityScore += 2; // Good crossing potential
            }
        }
        
        return densityScore;
    }

    canPlaceWordAt(word, row, col, direction, grid, solution) {
        // Check bounds
        if (direction === 'across' && col + word.length > this.gridSize) return false;
        if (direction === 'down' && row + word.length > this.gridSize) return false;

        // Check each position
        for (let i = 0; i < word.length; i++) {
            const checkRow = direction === 'across' ? row : row + i;
            const checkCol = direction === 'across' ? col + i : col;
            
            const existingLetter = solution[checkRow][checkCol];
            
            // If there's a letter, it must match
            if (existingLetter && existingLetter !== word[i]) {
                return false;
            }

            // Check for invalid adjacent letters (less restrictive)
            if (!existingLetter && this.hasConflictingAdjacent(checkRow, checkCol, direction, grid)) {
                return false;
            }
        }

        // Check word boundaries (can't have letters immediately before/after)
        return this.checkWordBoundaries(word, row, col, direction, solution);
    }

    hasConflictingAdjacent(row, col, direction, grid) {
        // Only check perpendicular adjacents for conflicts
        if (direction === 'across') {
            // Check above and below
            if ((row > 0 && grid[row - 1][col] && !grid[row - 1][col].isBlocked) ||
                (row < this.gridSize - 1 && grid[row + 1][col] && !grid[row + 1][col].isBlocked)) {
                return true;
            }
        } else {
            // Check left and right
            if ((col > 0 && grid[row][col - 1] && !grid[row][col - 1].isBlocked) ||
                (col < this.gridSize - 1 && grid[row][col + 1] && !grid[row][col + 1].isBlocked)) {
                return true;
            }
        }
        return false;
    }

    checkWordBoundaries(word, row, col, direction, solution) {
        // Check that the word doesn't extend into existing letters
        if (direction === 'across') {
            // Check before start
            if (col > 0 && solution[row][col - 1]) return false;
            // Check after end
            if (col + word.length < this.gridSize && solution[row][col + word.length]) return false;
        } else {
            // Check before start
            if (row > 0 && solution[row - 1][col]) return false;
            // Check after end
            if (row + word.length < this.gridSize && solution[row + word.length][col]) return false;
        }
        return true;
    }

    placeWordAt(wordData, row, col, direction, grid, solution, placedWords) {
        const word = wordData.word;

        for (let i = 0; i < word.length; i++) {
            const placeRow = direction === 'across' ? row : row + i;
            const placeCol = direction === 'across' ? col + i : col;
            
            solution[placeRow][placeCol] = word[i];
            grid[placeRow][placeCol] = {
                letter: word[i],
                isEmpty: false,
                isBlocked: false
            };
        }

        placedWords.push({
            word: word,
            clue: wordData.clue,
            row: row,
            col: col,
            direction: direction,
            length: word.length
        });
    }

    fillMinimalBlockedCells(grid, solution) {
        // Only block cells that are truly isolated
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                if (!grid[row][col]) {
                    grid[row][col] = {
                        letter: '',
                        isEmpty: false,
                        isBlocked: true
                    };
                }
            }
        }
    }

    trimGrid() {
        // Find the actual bounds of the placed words
        let minRow = this.gridSize, maxRow = -1;
        let minCol = this.gridSize, maxCol = -1;
        let hasContent = false;
        
        // Find the bounding box of all placed words
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                if (this.grid[row][col] && !this.grid[row][col].isBlocked) {
                    minRow = Math.min(minRow, row);
                    maxRow = Math.max(maxRow, row);
                    minCol = Math.min(minCol, col);
                    maxCol = Math.max(maxCol, col);
                    hasContent = true;
                }
            }
        }
        
        // If no words were placed, keep a minimum 3x3 grid
        if (!hasContent) {
            this.gridSize = 3;
            this.grid = Array(3).fill().map(() => Array(3).fill({
                letter: '',
                isEmpty: false,
                isBlocked: true
            }));
            this.solution = Array(3).fill().map(() => Array(3).fill(''));
            return;
        }
        
        // Calculate new dimensions (allow rectangular grids)
        const newGridHeight = maxRow - minRow + 1;
        const newGridWidth = maxCol - minCol + 1;
        
        // Only trim if it would make the grid smaller
        if (newGridHeight < this.gridSize || newGridWidth < this.gridSize) {
            console.log('TRIMMING: Creating new grid with dimensions:', newGridHeight, 'x', newGridWidth);
            
            // Create new trimmed grids with exact dimensions needed
            const newGrid = Array(newGridHeight).fill().map(() => Array(newGridWidth).fill(null));
            const newSolution = Array(newGridHeight).fill().map(() => Array(newGridWidth).fill(''));
            
            // Copy the content to the new grid (no centering needed since we're using exact dimensions)
            for (let row = minRow; row <= maxRow; row++) {
                for (let col = minCol; col <= maxCol; col++) {
                    const newRow = row - minRow;
                    const newCol = col - minCol;
                    
                    console.log(`Copying [${row}, ${col}] -> [${newRow}, ${newCol}]`);
                    
                    if (this.grid[row][col]) {
                        newGrid[newRow][newCol] = this.grid[row][col];
                        newSolution[newRow][newCol] = this.solution[row][col];
                    }
                }
            }
            
            // Update placed words coordinates
            this.placedWords.forEach(word => {
                console.log(`Updating word "${word.word}" from [${word.row}, ${word.col}] to [${word.row - minRow}, ${word.col - minCol}]`);
                word.row = word.row - minRow;
                word.col = word.col - minCol;
            });
            
            // Update grid references
            const oldSize = this.gridSize;
            this.grid = newGrid;
            this.solution = newSolution;
            this.gridHeight = newGridHeight;
            this.gridWidth = newGridWidth;
            
            console.log(`Grid trimmed from ${oldSize}x${oldSize} to ${newGridHeight}x${newGridWidth}`);
            console.log('Final grid dimensions:', this.grid.length, 'x', this.grid[0].length);
        } else {
            console.log('NO TRIMMING: Grid size unchanged');
        }
        console.log('=== END TRIM GRID DEBUG ===');
    }

    ensureGridComplete() {
        // Make sure every cell in the main grid is initialized
        const gridHeight = this.grid.length;
        const gridWidth = this.grid[0].length;
        
        for (let row = 0; row < gridHeight; row++) {
            for (let col = 0; col < gridWidth; col++) {
                if (!this.grid[row][col]) {
                    this.grid[row][col] = {
                        letter: '',
                        isEmpty: false,
                        isBlocked: true
                    };
                }
            }
        }
    }

    createFallbackPuzzle() {
        // Create a simple fallback puzzle if generation fails
        this.grid = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(null));
        this.solution = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(''));
        this.placedWords = [];
        this.clues = { across: {}, down: {} };

        // Place a simple horizontal word
        const simpleWord = this.words.find(w => w.word.length <= this.gridSize) || 
                          { word: 'HELLO', clue: 'Greeting' };
        
        const row = Math.floor(this.gridSize / 2);
        const startCol = Math.floor((this.gridSize - simpleWord.word.length) / 2);

        for (let i = 0; i < simpleWord.word.length; i++) {
            this.solution[row][startCol + i] = simpleWord.word[i];
            this.grid[row][startCol + i] = {
                letter: simpleWord.word[i],
                isEmpty: false,
                isBlocked: false
            };
        }

        this.placedWords.push({
            word: simpleWord.word,
            clue: simpleWord.clue,
            row: row,
            col: startCol,
            direction: 'across',
            length: simpleWord.word.length
        });

        // Fill remaining cells as blocked
        this.ensureGridComplete();
        
        // Trim the fallback grid as well
        this.trimGrid();
    }

    assignWordNumbers() {
        let currentNumber = 1;
        const numberedCells = {};

        // Sort words by position (top to bottom, left to right)
        const sortedWords = [...this.placedWords].sort((a, b) => {
            if (a.row !== b.row) return a.row - b.row;
            return a.col - b.col;
        });

        for (const wordInfo of sortedWords) {
            const key = `${wordInfo.row}-${wordInfo.col}`;
            
            if (!numberedCells[key]) {
                numberedCells[key] = currentNumber;
                wordInfo.number = currentNumber;
                currentNumber++;
            } else {
                wordInfo.number = numberedCells[key];
            }

            // Add to clues
            this.clues[wordInfo.direction][wordInfo.number] = wordInfo.clue;
        }

        // Add numbers to grid
        for (const wordInfo of this.placedWords) {
            const cell = this.grid[wordInfo.row][wordInfo.col];
            if (cell && !cell.isBlocked) {
                cell.number = wordInfo.number;
            }
        }
    }

    // Helper method to generate a random seed
    static generateSeed() {
        return Math.floor(Math.random() * 1000000);
    }
}
