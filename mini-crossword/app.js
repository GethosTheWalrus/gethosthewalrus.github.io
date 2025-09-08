class CrosswordApp {
    constructor() {
        this.generator = null;
        this.currentPuzzle = null;
        this.currentSeed = null;
        this.selectedWord = null;
        this.userInputs = {};
        this.statusTimeout = null;
        
        // Timer-related properties
        this.startTime = null;
        this.completionTime = null;
        this.timerInterval = null;
        this.isCompleted = false;
        this.isPaused = false;
        this.pausedTime = 0;
        
        this.initializeApp();
        
        // Clean up timer on page unload
        window.addEventListener('beforeunload', () => {
            this.stopTimer();
        });
        
        // Handle tab visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseTimer();
            } else {
                this.resumeTimer();
            }
        });
    }

    async initializeApp() {
        try {
            // Load words data
            const response = await fetch('words.json');
            this.wordsData = await response.json();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Generate puzzle based on URL parameter or create new one
            this.handleInitialLoad();
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showStatus('Failed to load word data', 'error');
        }
    }

    setupEventListeners() {
        // Button events
        document.getElementById('new-puzzle').addEventListener('click', () => {
            this.generateNewPuzzle();
        });

        document.getElementById('share-puzzle').addEventListener('click', () => {
            this.sharePuzzle();
        });

        document.getElementById('check-puzzle').addEventListener('click', () => {
            this.checkPuzzle();
        });

        document.getElementById('reveal-puzzle').addEventListener('click', () => {
            this.revealSolution();
        });

        document.getElementById('clear-puzzle').addEventListener('click', () => {
            this.clearPuzzle();
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            this.handleKeyPress(e);
        });

        // Handle window resize and orientation changes for mobile
        window.addEventListener('resize', () => {
            if (this.currentPuzzle) {
                // Debounce resize events and be more careful on mobile
                clearTimeout(this.resizeTimeout);
                this.resizeTimeout = setTimeout(() => {
                    // Only re-render if the width changed significantly (orientation change)
                    const newWidth = window.innerWidth;
                    if (!this.lastWidth || Math.abs(newWidth - this.lastWidth) > 50) {
                        this.lastWidth = newWidth;
                        this.renderGrid();
                    }
                }, 250);
            }
        });

        // Clear selection when clicking outside the grid or clues
        document.addEventListener('click', (e) => {
            const isGridClick = e.target.closest('.grid-container') || e.target.closest('.clues-container');
            const isButton = e.target.closest('button');
            if (!isGridClick && !isButton && this.selectedWord) {
                this.clearSelection();
            }
        });
    }

    handleInitialLoad() {
        const urlParams = new URLSearchParams(window.location.search);
        const seedParam = urlParams.get('seed');
        
        if (seedParam) {
            const seed = parseInt(seedParam);
            if (!isNaN(seed)) {
                this.generatePuzzle(seed);
                return;
            }
        }
        
        // Generate date-based puzzle if no valid seed
        this.generateDateBasedPuzzle();
    }

    generateDateBasedPuzzle() {
        // Use today's date as seed (YYYYMMDD format)
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const dateSeed = parseInt(`${year}${month}${day}`);
        
        this.generatePuzzle(dateSeed);
        
        // Update URL with today's seed
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('seed', dateSeed);
        window.history.replaceState({}, '', newUrl);
    }

    generateNewPuzzle() {
        // Generate a random timestamp-based seed
        const now = new Date();
        const seed = Math.floor(now.getTime() / 1000); // Unix timestamp
        
        this.generatePuzzle(seed);
        
        // Update URL without reloading page
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('seed', seed);
        window.history.replaceState({}, '', newUrl);
    }

    updateHeader() {
        const headerElement = document.querySelector('h1');
        const seed = this.currentSeed.toString();
        
        // Check if this is a daily puzzle (YYYYMMDD format)
        if (seed.length === 8) {
            const dateInfo = this.parseSeedAsDate(seed);
            if (dateInfo) {
                headerElement.textContent = 'Mike\'s Daily Mini';
                return;
            }
        }
        
        headerElement.textContent = 'Mini Crossword';
    }

    generatePuzzle(seed) {
        this.currentSeed = seed;
        this.generator = new CrosswordGenerator(this.wordsData, seed);
        this.currentPuzzle = this.generator.generatePuzzle(seed);
        
        if (!this.currentPuzzle.placedWords.length) {
            this.showStatus('Could not generate puzzle. Please try again.', 'error');
            return;
        }
        
        // Reset completion state
        this.isCompleted = false;
        this.completionTime = null;
        this.isPaused = false;
        this.pausedTime = 0;
        
        // Clear user inputs first (before loading saved ones)
        this.userInputs = {};
        
        // Load saved user inputs
        this.loadUserInputs();
        
        // Initialize or restore timer
        this.initializeTimer();
        
        this.renderGrid();
        this.renderClues();
        this.updateHeader();
        this.updateSeedDisplay();
        this.showStatus(`Generated puzzle #${seed}`, 'info');
        
        // Check for completion in case puzzle was already filled
        this.checkForCompletion();
    }

    // Timer management methods
    initializeTimer() {
        const timerKey = `crossword_timer_${this.currentSeed}`;
        const completionKey = `crossword_completed_${this.currentSeed}`;
        const savedTimer = localStorage.getItem(timerKey);
        const savedCompletion = localStorage.getItem(completionKey);
        
        if (savedCompletion) {
            // Puzzle was previously completed
            this.isCompleted = true;
            this.completionTime = parseInt(savedCompletion);
            this.startTime = null;
            this.updateTimerDisplay();
            
            // Restore completed state visually after a brief delay to ensure grid is rendered
            setTimeout(() => {
                this.highlightCompletedPuzzle();
            }, 100);
        } else if (savedTimer) {
            // Resume existing timer
            this.startTime = parseInt(savedTimer);
            this.startTimer();
        } else {
            // Start new timer
            this.startTime = Date.now();
            localStorage.setItem(timerKey, this.startTime.toString());
            this.startTimer();
        }
    }

    startTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        // Don't start timer if tab is hidden
        if (document.hidden) {
            this.isPaused = true;
            return;
        }
        
        this.isPaused = false;
        
        this.timerInterval = setInterval(() => {
            if (!this.isCompleted && !this.isPaused) {
                this.updateTimerDisplay();
            }
        }, 1000);
        
        this.updateTimerDisplay();
    }

    pauseTimer() {
        if (this.isCompleted || !this.startTime) return;
        
        this.isPaused = true;
        this.pausedTime = Date.now() - this.startTime;
        
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    resumeTimer() {
        if (this.isCompleted || this.isPaused === false) return;
        
        // Adjust start time to account for paused duration
        if (this.pausedTime > 0) {
            this.startTime = Date.now() - this.pausedTime;
        }
        
        this.startTimer();
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.isPaused = false;
    }

    completeTimer() {
        if (this.isCompleted || !this.startTime) return;
        
        this.completionTime = Date.now() - this.startTime;
        this.isCompleted = true;
        
        // Save completion time to localStorage
        const completionKey = `crossword_completed_${this.currentSeed}`;
        localStorage.setItem(completionKey, this.completionTime.toString());
        
        // Remove the running timer from localStorage
        const timerKey = `crossword_timer_${this.currentSeed}`;
        localStorage.removeItem(timerKey);
        
        this.stopTimer();
        this.updateTimerDisplay();
    }

    updateTimerDisplay() {
        const timerElement = document.getElementById('timer-display');
        let timeToShow;
        
        if (this.isCompleted && this.completionTime) {
            timeToShow = this.completionTime;
        } else if (this.startTime) {
            if (this.isPaused && this.pausedTime > 0) {
                timeToShow = this.pausedTime;
            } else {
                timeToShow = Date.now() - this.startTime;
            }
        } else {
            timeToShow = 0;
        }
        
        const minutes = Math.floor(timeToShow / 60000);
        const seconds = Math.floor((timeToShow % 60000) / 1000);
        
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Update styling based on completion status
        if (this.isCompleted) {
            timerElement.style.background = 'rgba(212, 237, 218, 0.95)';
            timerElement.style.borderColor = 'rgba(40, 167, 69, 0.5)';
            timerElement.style.color = '#155724';
        } else {
            timerElement.style.background = 'rgba(255, 255, 255, 0.95)';
            timerElement.style.borderColor = 'rgba(44, 62, 80, 0.2)';
            timerElement.style.color = '#2c3e50';
        }
    }

    // User input persistence methods
    saveUserInputs() {
        const inputsKey = `crossword_inputs_${this.currentSeed}`;
        localStorage.setItem(inputsKey, JSON.stringify(this.userInputs));
    }

    loadUserInputs() {
        const inputsKey = `crossword_inputs_${this.currentSeed}`;
        const savedInputs = localStorage.getItem(inputsKey);
        
        if (savedInputs) {
            try {
                this.userInputs = JSON.parse(savedInputs);
            } catch (e) {
                console.error('Failed to parse saved user inputs:', e);
                this.userInputs = {};
            }
        } else {
            this.userInputs = {};
        }
    }

    renderGrid() {
        const gridElement = document.getElementById('crossword-grid');
        gridElement.innerHTML = '';
        
        // Get actual grid dimensions from the puzzle
        const gridHeight = this.currentPuzzle.grid.length;
        const gridWidth = this.currentPuzzle.grid[0].length;
        const maxGridSize = Math.max(gridWidth, gridHeight);
        
        let cellSize;
        
        if (window.innerWidth <= 480) {
            // Mobile: be extremely conservative to prevent any overflow
            // Use 95% of viewport width to ensure it fits with any padding/margins
            const safeWidth = Math.floor(window.innerWidth * 0.95);
            cellSize = Math.floor(safeWidth / maxGridSize);
            
            // Ensure minimum usability but cap to prevent overflow
            cellSize = Math.max(20, Math.min(35, cellSize));
            
            console.log(`Mobile sizing: viewport=${window.innerWidth}, safeWidth=${safeWidth}, gridSize=${maxGridSize}, cellSize=${cellSize}`);
        } else if (window.innerWidth <= 768) {
            // Tablet: medium cells, max 400px total width
            cellSize = Math.min(50, Math.floor(400 / maxGridSize));
        } else {
            // Desktop: larger cells, max 500px total width
            cellSize = Math.min(60, Math.floor(500 / maxGridSize));
        }
        
        const totalWidth = cellSize * gridWidth;
        const totalHeight = cellSize * gridHeight;
        
        // Set dynamic grid template and dimensions
        gridElement.style.gridTemplateColumns = `repeat(${gridWidth}, ${cellSize}px)`;
        gridElement.style.gridTemplateRows = `repeat(${gridHeight}, ${cellSize}px)`;
        gridElement.style.width = `${totalWidth}px`;
        gridElement.style.height = `${totalHeight}px`;

        for (let row = 0; row < gridHeight; row++) {
            for (let col = 0; col < gridWidth; col++) {
                const cell = this.currentPuzzle.grid[row][col];
                const cellElement = this.createCellElement(cell, row, col);
                gridElement.appendChild(cellElement);
            }
        }
    }

    createCellElement(cell, row, col) {
        const cellDiv = document.createElement('div');
        cellDiv.className = 'cell';
        cellDiv.dataset.row = row;
        cellDiv.dataset.col = col;

        // Set cell dimensions for mobile
        if (window.innerWidth <= 480) {
            const gridHeight = this.currentPuzzle.grid.length;
            const gridWidth = this.currentPuzzle.grid[0].length;
            const maxGridSize = Math.max(gridWidth, gridHeight);
            
            const safeWidth = Math.floor(window.innerWidth * 0.95);
            let cellSize = Math.floor(safeWidth / maxGridSize);
            cellSize = Math.max(20, Math.min(35, cellSize));
            
            cellDiv.style.width = `${cellSize}px`;
            cellDiv.style.height = `${cellSize}px`;
            cellDiv.style.fontSize = `${Math.max(10, cellSize * 0.6)}px`;
        }

        // Handle dynamic border removal based on actual grid dimensions
        const gridHeight = this.currentPuzzle.grid.length;
        const gridWidth = this.currentPuzzle.grid[0].length;
        
        // Remove right border for last column
        if (col === gridWidth - 1) {
            cellDiv.style.borderRight = 'none';
        }
        
        // Remove bottom border for last row
        if (row === gridHeight - 1) {
            cellDiv.style.borderBottom = 'none';
        }

        // Safety check: if cell is null, treat as blocked
        if (!cell || cell.isBlocked) {
            cellDiv.classList.add('blocked');
            return cellDiv;
        }

        // Add number if exists
        if (cell.number) {
            const numberSpan = document.createElement('span');
            numberSpan.className = 'cell-number';
            numberSpan.textContent = cell.number;
            cellDiv.appendChild(numberSpan);
        }

        // Add input field
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 1;
        input.addEventListener('input', (e) => this.handleInput(e, row, col));
        input.addEventListener('focus', () => this.handleCellFocus(row, col));
        input.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleCellClick(row, col);
        });
        
        // Mobile-specific improvements
        if (window.innerWidth <= 480) {
            input.addEventListener('blur', () => {
                // Small delay to prevent rapid re-renders on mobile
                setTimeout(() => {
                    if (document.activeElement !== input) {
                        // Only do something if focus truly moved away
                    }
                }, 100);
            });
            
            // Prevent zoom on focus for mobile
            input.style.fontSize = '16px';
        }
        
        // Restore user input if it exists
        const savedInput = this.userInputs[`${row}-${col}`];
        if (savedInput) {
            input.value = savedInput;
        }
        
        cellDiv.appendChild(input);

        return cellDiv;
    }

    renderClues() {
        this.renderCluesList('across');
        this.renderCluesList('down');
    }

    renderCluesList(direction) {
        const cluesElement = document.getElementById(`${direction}-clues`);
        cluesElement.innerHTML = '';

        const clues = this.currentPuzzle.clues[direction];
        
        for (const [number, clue] of Object.entries(clues)) {
            const li = document.createElement('li');
            li.dataset.number = number;
            li.dataset.direction = direction;
            li.innerHTML = `<span class="clue-number">${number}.</span> ${clue}`;
            li.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectWord(parseInt(number), direction);
            });
            cluesElement.appendChild(li);
        }
    }

    handleInput(event, row, col) {
        // Prevent input if puzzle is completed
        if (this.isCompleted) {
            event.preventDefault();
            return;
        }
        
        const value = event.target.value.toUpperCase();
        event.target.value = value;
        
        // Store user input
        this.userInputs[`${row}-${col}`] = value;
        
        // Save user inputs to localStorage
        this.saveUserInputs();
        
        // Check for completion after each input
        this.checkForCompletion();
        
        if (value && this.selectedWord) {
            // Move to next cell in the selected word
            this.moveToNextCell(row, col);
        }
    }

    checkForCompletion() {
        if (this.isCompleted) return;
        
        const gridHeight = this.currentPuzzle.grid.length;
        const gridWidth = this.currentPuzzle.grid[0].length;
        
        let allFilled = true;
        let allCorrect = true;
        
        // Check if all non-blocked cells are filled and correct
        for (let row = 0; row < gridHeight; row++) {
            for (let col = 0; col < gridWidth; col++) {
                const cellData = this.currentPuzzle.grid[row][col];
                
                if (!cellData.isBlocked) {
                    const userInput = this.userInputs[`${row}-${col}`] || '';
                    const correctLetter = this.currentPuzzle.solution[row][col];
                    
                    if (!userInput) {
                        allFilled = false;
                        break;
                    }
                    
                    if (userInput !== correctLetter) {
                        allCorrect = false;
                    }
                }
            }
            if (!allFilled) break;
        }
        
        // If all cells are filled, show completion message
        if (allFilled) {
            if (allCorrect) {
                this.completePuzzle();
            } else {
                this.showCompletionMessage(false);
            }
        }
    }

    completePuzzle() {
        this.completeTimer();
        this.highlightCompletedPuzzle();
        this.showCompletionMessage(true);
    }

    highlightCompletedPuzzle() {
        // Highlight all correct cells in green and make them non-editable
        const gridHeight = this.currentPuzzle.grid.length;
        const gridWidth = this.currentPuzzle.grid[0].length;

        for (let row = 0; row < gridHeight; row++) {
            for (let col = 0; col < gridWidth; col++) {
                const cellData = this.currentPuzzle.grid[row][col];
                
                if (!cellData.isBlocked) {
                    const cellElement = document.querySelector(
                        `.cell[data-row="${row}"][data-col="${col}"]`
                    );
                    const inputElement = cellElement.querySelector('input');
                    
                    if (cellElement && inputElement) {
                        // Add completed styling
                        cellElement.classList.add('completed');
                        cellElement.classList.remove('correct', 'incorrect'); // Remove any temporary styling
                        
                        // Make input non-editable
                        inputElement.disabled = true;
                        inputElement.style.cursor = 'default';
                    }
                }
            }
        }
    }

    showCompletionMessage(isCorrect) {
        const minutes = Math.floor((this.completionTime || 0) / 60000);
        const seconds = Math.floor(((this.completionTime || 0) % 60000) / 1000);
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (isCorrect) {
            this.showStatus(`🎉 Congratulations! Puzzle completed in ${timeString}!`, 'success');
        } else {
            this.showStatus('Puzzle filled but some answers are incorrect. Keep trying!', 'info');
        }
    }

    handleCellFocus(row, col) {
        this.highlightWord(row, col);
    }

    handleCellClick(row, col) {
        // Toggle between across and down word if both exist at this position
        const wordsAtPosition = this.getWordsAtPosition(row, col);
        
        if (wordsAtPosition.length > 1) {
            // If we have both across and down, toggle between them
            const currentDirection = this.selectedWord ? this.selectedWord.direction : 'across';
            const newDirection = currentDirection === 'across' ? 'down' : 'across';
            const newWord = wordsAtPosition.find(w => w.direction === newDirection);
            
            if (newWord) {
                this.selectWord(newWord.number, newWord.direction);
            }
        } else if (wordsAtPosition.length === 1) {
            const word = wordsAtPosition[0];
            this.selectWord(word.number, word.direction);
        }
    }

    getWordsAtPosition(row, col) {
        return this.currentPuzzle.placedWords.filter(word => {
            if (word.direction === 'across') {
                return word.row === row && col >= word.col && col < word.col + word.length;
            } else {
                return word.col === col && row >= word.row && row < word.row + word.length;
            }
        });
    }

    selectWord(number, direction) {
        // Remove previous highlights
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.remove('highlighted', 'active');
        });
        
        document.querySelectorAll('.clues-list li').forEach(li => {
            li.classList.remove('active');
        });

        // Find and highlight the selected word
        const word = this.currentPuzzle.placedWords.find(w => 
            w.number === number && w.direction === direction
        );

        if (word) {
            this.selectedWord = word;
            this.highlightSelectedWord(word);
            
            // Highlight clue and hide others
            this.showOnlySelectedClue(number, direction);
        }
    }

    highlightWord(row, col) {
        const wordsAtPosition = this.getWordsAtPosition(row, col);
        
        if (wordsAtPosition.length > 0) {
            // If we don't have a selected word, or the current position doesn't belong to the selected word,
            // select the first word at this position
            if (!this.selectedWord || !wordsAtPosition.includes(this.selectedWord)) {
                const word = wordsAtPosition[0];
                this.selectWord(word.number, word.direction);
            }
        }
    }

    showOnlySelectedClue(number, direction) {
        const cluesContainer = document.querySelector('.clues-container');
        const focusedClueSection = document.getElementById('focused-clue-section');
        
        // Hide all clues with smooth transition
        document.querySelectorAll('.clues-list li').forEach(li => {
            li.classList.add('hidden');
        });
        
        // Hide all section headers
        document.querySelectorAll('.clues-section h3').forEach(header => {
            header.classList.add('hidden');
        });
        
        // Hide all clue sections
        document.querySelectorAll('.clues-section').forEach(section => {
            section.style.display = 'none';
        });
        
        // Show and populate the focused clue section
        const selectedClue = document.querySelector(
            `.clues-list li[data-number="${number}"][data-direction="${direction}"]`
        );
        if (selectedClue && focusedClueSection) {
            const clueText = selectedClue.textContent;
            focusedClueSection.innerHTML = `<div class="clue-item">${clueText}</div>`;
            focusedClueSection.classList.add('active');
        }
        
        // Add single clue class for any additional styling
        cluesContainer.classList.add('single-clue');
    }

    showAllClues() {
        const cluesContainer = document.querySelector('.clues-container');
        const focusedClueSection = document.getElementById('focused-clue-section');
        
        // Hide the focused clue section
        if (focusedClueSection) {
            focusedClueSection.classList.remove('active');
            focusedClueSection.innerHTML = '';
        }
        
        // Show all clue sections
        document.querySelectorAll('.clues-section').forEach(section => {
            section.style.display = 'block';
        });
        
        // Show all clues again with smooth transition
        document.querySelectorAll('.clues-list li').forEach(li => {
            li.classList.remove('hidden');
        });
        
        // Show all section headers
        document.querySelectorAll('.clues-section h3').forEach(header => {
            header.classList.remove('hidden');
        });
        
        // Remove single clue class to return to normal layout
        cluesContainer.classList.remove('single-clue');
    }

    clearSelection() {
        // Remove highlights from grid
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.remove('highlighted', 'active');
        });
        
        // Remove active state from clues
        document.querySelectorAll('.clues-list li').forEach(li => {
            li.classList.remove('active');
        });

        // Show all clues again
        this.showAllClues();
        
        // Clear selected word
        this.selectedWord = null;
    }

    highlightSelectedWord(word) {
        for (let i = 0; i < word.length; i++) {
            const cellRow = word.direction === 'across' ? word.row : word.row + i;
            const cellCol = word.direction === 'across' ? word.col + i : word.col;
            
            const cellElement = document.querySelector(
                `.cell[data-row="${cellRow}"][data-col="${cellCol}"]`
            );
            
            if (cellElement && !cellElement.classList.contains('blocked')) {
                cellElement.classList.add('highlighted');
            }
        }

        // Make the first cell active
        const firstCellElement = document.querySelector(
            `.cell[data-row="${word.row}"][data-col="${word.col}"]`
        );
        if (firstCellElement) {
            firstCellElement.classList.add('active');
        }
    }

    moveToNextCell(currentRow, currentCol) {
        if (!this.selectedWord) return;

        const word = this.selectedWord;
        let nextRow, nextCol;

        if (word.direction === 'across') {
            nextCol = currentCol + 1;
            nextRow = currentRow;
            
            if (nextCol >= word.col + word.length) return; // End of word
        } else {
            nextRow = currentRow + 1;
            nextCol = currentCol;
            
            if (nextRow >= word.row + word.length) return; // End of word
        }

        const nextCellElement = document.querySelector(
            `.cell[data-row="${nextRow}"][data-col="${nextCol}"] input`
        );
        
        if (nextCellElement) {
            nextCellElement.focus();
        }
    }

    handleKeyPress(event) {
        // Prevent keyboard interaction if puzzle is completed
        if (this.isCompleted) {
            return;
        }
        
        if (!this.selectedWord) return;

        const activeElement = document.activeElement;
        if (!activeElement || activeElement.tagName !== 'INPUT') return;

        const currentRow = parseInt(activeElement.parentElement.dataset.row);
        const currentCol = parseInt(activeElement.parentElement.dataset.col);

        switch (event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                this.moveCursor(currentRow, currentCol, 'left');
                break;
            case 'ArrowRight':
                event.preventDefault();
                this.moveCursor(currentRow, currentCol, 'right');
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.moveCursor(currentRow, currentCol, 'up');
                break;
            case 'ArrowDown':
                event.preventDefault();
                this.moveCursor(currentRow, currentCol, 'down');
                break;
            case 'Backspace':
                if (activeElement.value === '') {
                    event.preventDefault();
                    this.moveCursor(currentRow, currentCol, this.selectedWord.direction === 'across' ? 'left' : 'up');
                }
                break;
            case ' ':
                event.preventDefault();
                this.moveCursor(currentRow, currentCol, this.selectedWord.direction === 'across' ? 'right' : 'down');
                break;
        }
    }

    moveCursor(currentRow, currentCol, direction) {
        let newRow = currentRow;
        let newCol = currentCol;
        
        const gridHeight = this.currentPuzzle.grid.length;
        const gridWidth = this.currentPuzzle.grid[0].length;

        switch (direction) {
            case 'left':
                newCol = Math.max(0, currentCol - 1);
                break;
            case 'right':
                newCol = Math.min(gridWidth - 1, currentCol + 1);
                break;
            case 'up':
                newRow = Math.max(0, currentRow - 1);
                break;
            case 'down':
                newRow = Math.min(gridHeight - 1, currentRow + 1);
                break;
        }

        const targetCell = document.querySelector(
            `.cell[data-row="${newRow}"][data-col="${newCol}"] input`
        );

        if (targetCell && !targetCell.parentElement.classList.contains('blocked')) {
            targetCell.focus();
        }
    }

    checkPuzzle() {
        // Don't check if already completed
        if (this.isCompleted) {
            this.showStatus('Puzzle already completed!', 'success');
            return;
        }
        
        let correct = 0;
        let total = 0;
        
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.remove('correct', 'incorrect');
        });

        const gridHeight = this.currentPuzzle.grid.length;
        const gridWidth = this.currentPuzzle.grid[0].length;

        for (let row = 0; row < gridHeight; row++) {
            for (let col = 0; col < gridWidth; col++) {
                const cellData = this.currentPuzzle.grid[row][col];
                
                if (!cellData.isBlocked) {
                    total++;
                    const userInput = this.userInputs[`${row}-${col}`] || '';
                    const correctLetter = this.currentPuzzle.solution[row][col];
                    
                    const cellElement = document.querySelector(
                        `.cell[data-row="${row}"][data-col="${col}"]`
                    );

                    if (userInput === correctLetter) {
                        correct++;
                        cellElement.classList.add('correct');
                    } else if (userInput) {
                        cellElement.classList.add('incorrect');
                    }
                }
            }
        }

        // Remove correct/incorrect styling after 2 seconds
        setTimeout(() => {
            document.querySelectorAll('.cell').forEach(cell => {
                cell.classList.remove('correct', 'incorrect');
            });
        }, 2000);

        if (correct === total) {
            this.showStatus('Congratulations! Puzzle completed!', 'success');
        } else {
            this.showStatus(`${correct} of ${total} letters correct`, 'info');
        }
    }

    revealSolution() {
        // Don't reveal if already completed
        if (this.isCompleted) {
            this.showStatus('Puzzle already completed!', 'success');
            return;
        }
        
        const gridHeight = this.currentPuzzle.grid.length;
        const gridWidth = this.currentPuzzle.grid[0].length;
        
        for (let row = 0; row < gridHeight; row++) {
            for (let col = 0; col < gridWidth; col++) {
                const cellData = this.currentPuzzle.grid[row][col];
                
                if (!cellData.isBlocked) {
                    const correctLetter = this.currentPuzzle.solution[row][col];
                    this.userInputs[`${row}-${col}`] = correctLetter;
                    
                    const inputElement = document.querySelector(
                        `.cell[data-row="${row}"][data-col="${col}"] input`
                    );
                    
                    if (inputElement) {
                        inputElement.value = correctLetter;
                    }
                }
            }
        }
        
        this.showStatus('Solution revealed!', 'info');
    }

    clearPuzzle() {
        this.userInputs = {};
        
        // Clear saved inputs from localStorage
        const inputsKey = `crossword_inputs_${this.currentSeed}`;
        localStorage.removeItem(inputsKey);
        
        document.querySelectorAll('.cell input').forEach(input => {
            input.value = '';
            input.disabled = false; // Re-enable inputs
            input.style.cursor = 'text';
        });

        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.remove('correct', 'incorrect', 'completed');
        });

        // Reset timer if puzzle was completed
        if (this.isCompleted) {
            this.isCompleted = false;
            this.completionTime = null;
            this.isPaused = false;
            this.pausedTime = 0;
            
            // Remove completion from localStorage and restart timer
            const completionKey = `crossword_completed_${this.currentSeed}`;
            localStorage.removeItem(completionKey);
            
            // Restart timer
            this.initializeTimer();
        }

        this.showStatus('Puzzle cleared', 'info');
    }

    async sharePuzzle() {
        const url = new URL(window.location);
        url.searchParams.set('seed', this.currentSeed);
        const shareUrl = url.toString();
        
        // Check if Web Share API is available and supported
        if (navigator.share && navigator.canShare) {
            try {
                const shareData = {
                    title: 'Mini Crossword Puzzle',
                    text: `Try this mini crossword puzzle #${this.currentSeed}!`,
                    url: shareUrl
                };
                
                // Check if the data can be shared
                if (navigator.canShare(shareData)) {
                    await navigator.share(shareData);
                    this.showStatus('Puzzle shared!', 'success');
                    return;
                }
            } catch (error) {
                console.log('Web Share API failed:', error);
                // Fall through to clipboard method
            }
        }
        
        // Try clipboard API as fallback
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(shareUrl);
                this.showStatus('Puzzle URL copied to clipboard!', 'success');
                return;
            } catch (error) {
                console.log('Clipboard API failed:', error);
                // Fall through to manual copy method
            }
        }
        
        // Final fallback: show URL for manual copying
        this.createShareDialog(shareUrl);
    }
    
    createShareDialog(url) {
        // Create a modal dialog for manual copying
        const dialog = document.createElement('div');
        dialog.className = 'share-dialog';
        dialog.innerHTML = `
            <div class="share-dialog-content">
                <h3>Share This Puzzle</h3>
                <p>Copy this URL to share:</p>
                <div class="share-url-container">
                    <input type="text" value="${url}" readonly id="share-url-input">
                    <button id="manual-copy-btn" class="copy-btn">Copy</button>
                </div>
                <button id="close-share-dialog" class="close-btn">Close</button>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // Auto-select the URL text for easy copying
        const urlInput = document.getElementById('share-url-input');
        urlInput.select();
        urlInput.setSelectionRange(0, 99999); // For mobile devices
        
        // Manual copy button
        document.getElementById('manual-copy-btn').addEventListener('click', () => {
            urlInput.select();
            urlInput.setSelectionRange(0, 99999);
            
            // Try the old document.execCommand as final fallback
            try {
                const successful = document.execCommand('copy');
                if (successful) {
                    this.showStatus('URL copied to clipboard!', 'success');
                } else {
                    this.showStatus('Please manually copy the URL', 'info');
                }
            } catch (err) {
                this.showStatus('Please manually copy the URL', 'info');
            }
        });
        
        // Close dialog
        document.getElementById('close-share-dialog').addEventListener('click', () => {
            document.body.removeChild(dialog);
        });
        
        // Close on background click
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                document.body.removeChild(dialog);
            }
        });
    }

    updateSeedDisplay() {
        const seedElement = document.getElementById('current-seed');
        const seed = this.currentSeed;
        
        // Try to parse seed as different date formats
        const dateInfo = this.parseSeedAsDate(seed);
        
        if (dateInfo) {
            seedElement.innerHTML = `<span title="Seed: ${seed}">${dateInfo}</span>`;
        } else {
            seedElement.textContent = seed;
        }
    }

    parseSeedAsDate(seed) {
        const seedStr = seed.toString();
        
        // Try YYYYMMDD format (like 20250907)
        if (seedStr.length === 8) {
            const year = parseInt(seedStr.substring(0, 4));
            const month = parseInt(seedStr.substring(4, 6));
            const day = parseInt(seedStr.substring(6, 8));
            
            if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                const date = new Date(year, month - 1, day);
                // Verify the date is valid (handles things like Feb 31st)
                if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
                    return date.toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    });
                }
            }
        }
        
        // Try Unix timestamp (10 digits)
        if (seedStr.length === 10) {
            const timestamp = parseInt(seedStr);
            const date = new Date(timestamp * 1000);
            
            // Check if it's a reasonable date (between 2000 and 2100)
            if (date.getFullYear() >= 2000 && date.getFullYear() <= 2100) {
                return date.toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
        }
        
        // Try 13-digit timestamp (milliseconds)
        if (seedStr.length === 13) {
            const timestamp = parseInt(seedStr);
            const date = new Date(timestamp);
            
            // Check if it's a reasonable date
            if (date.getFullYear() >= 2000 && date.getFullYear() <= 2100) {
                return date.toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
        }
        
        return null; // Not a recognizable date format
    }

    showStatus(message, type = 'info') {
        const statusElement = document.getElementById('status-message');
        
        // Clear any existing timeouts
        if (this.statusTimeout) {
            clearTimeout(this.statusTimeout);
        }
        
        // Set message and type
        statusElement.textContent = message;
        statusElement.className = `status-message ${type}`;
        
        // Force reflow to ensure the initial state is applied
        statusElement.offsetHeight;
        
        // Show the toast with animation
        statusElement.classList.add('show');
        
        // Hide after 4 seconds with animation
        this.statusTimeout = setTimeout(() => {
            statusElement.classList.remove('show');
            
            // Clear content after animation completes
            setTimeout(() => {
                if (!statusElement.classList.contains('show')) {
                    statusElement.textContent = '';
                    statusElement.className = 'status-message';
                }
            }, 300);
        }, 4000);
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new CrosswordApp();
});
