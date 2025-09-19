document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const screens = document.querySelectorAll('.screen');
    const modeButtons = document.querySelectorAll('.mode-button');
    const backButtons = document.querySelectorAll('.back-button');
    const soundToggle = document.getElementById('sound-toggle');

    // Game Screen Elements
    const scoreDisplay = document.getElementById('score');
    const gameStatsDisplay = document.getElementById('game-stats');
    const questionDisplay = document.getElementById('question');
    const optionsContainer = document.getElementById('options-container');
    const feedbackDisplay = document.getElementById('feedback');
    
    // Learn Screen Elements
    const tableContainer = document.getElementById('multiplication-table-container');

    // End Screen Elements
    const endTitle = document.getElementById('end-title');
    const endMessage = document.getElementById('end-message');
    const finalScoreDisplay = document.getElementById('final-score');
    const playAgainBtn = document.getElementById('play-again-btn');

    // Audio Elements
    const correctSound = document.getElementById('correct-sound');
    const wrongSound = document.getElementById('wrong-sound');
    const winSound = document.getElementById('win-sound');
    const loseSound = document.getElementById('lose-sound');
    
    // --- Game State ---
    let currentMode = '';
    let score = 0;
    let lives = 3;
    let timeLeft = 60;
    let gameInterval;
    let isSoundOn = true;
    let currentCorrectAnswer = 0;

    // --- Sound Handling ---
    // A fallback for the Base64 audio if it fails to load
    const createTone = (freq) => {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        return (duration) => {
            const oscillator = audioCtx.createOscillator();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
            oscillator.connect(audioCtx.destination);
            oscillator.start();
            setTimeout(() => oscillator.stop(), duration);
        };
    };

    const playCorrectSound = correctSound.src.includes('data:audio') ? () => correctSound.play() : createTone(523.25)(100);
    const playWrongSound = wrongSound.src.includes('data:audio') ? () => wrongSound.play() : createTone(261.63)(200);
    const playWinSound = winSound.src.includes('data:audio') ? () => winSound.play() : createTone(783.99)(300);
    const playLoseSound = loseSound.src.includes('data:audio') ? () => loseSound.play() : createTone(196.00)(400);

    function playSound(soundFunction) {
        if (isSoundOn) {
            try { soundFunction(); } catch (e) { console.warn("Audio playback failed.", e); }
        }
    }

    soundToggle.addEventListener('click', () => {
        isSoundOn = !isSoundOn;
        soundToggle.textContent = isSoundOn ? '🔊' : '🔇';
    });

    // --- Navigation ---
    const showScreen = (screenId) => {
        screens.forEach(screen => screen.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
    };

    modeButtons.forEach(button => {
        button.addEventListener('click', () => {
            currentMode = button.dataset.mode;
            if (currentMode === 'learn') {
                generateLearnTable();
                showScreen('learn-screen');
            } else {
                startGame();
            }
        });
    });

    backButtons.forEach(button => button.addEventListener('click', () => {
        clearInterval(gameInterval);
        showScreen('main-menu');
    }));
    
    playAgainBtn.addEventListener('click', startGame);

    // --- Learn Mode ---
    function generateLearnTable() {
        tableContainer.innerHTML = '';
        for (let i = 0; i <= 12; i++) {
            for (let j = 0; j <= 12; j++) {
                const cell = document.createElement('div');
                cell.classList.add('table-cell');
                let content = '';
                if (i === 0 && j > 0) { content = j; cell.classList.add('header'); }
                else if (j === 0 && i > 0) { content = i; cell.classList.add('header'); }
                else if (i > 0 && j > 0) { content = i * j; }
                else if (i === 0 && j === 0) { content = '×'; cell.classList.add('header');}
                cell.textContent = content;
                if (i > 0 && j > 0) {
                    cell.addEventListener('click', () => {
                        document.querySelectorAll('.table-cell.highlight').forEach(c => c.classList.remove('highlight'));
                        cell.classList.add('highlight');
                    });
                }
                tableContainer.appendChild(cell);
            }
        }
    }

    // --- Game Logic ---
    function startGame() {
        score = 0;
        lives = 3;
        timeLeft = 60;
        clearInterval(gameInterval);
        
        updateHUD();
        showScreen('game-screen');
        nextQuestion();

        if (currentMode === 'timer') {
            gameInterval = setInterval(updateTimer, 1000);
        }
    }

    function updateHUD() {
        scoreDisplay.textContent = Score: ${score};
        switch (currentMode) {
            case 'survival':
                gameStatsDisplay.textContent = Lives: ${'♥'.repeat(lives)};
                break;
            case 'timer':
                gameStatsDisplay.textContent = Time: ${timeLeft}s;
                break;
            default:
                gameStatsDisplay.textContent = '';
        }
    }

    function updateTimer() {
        timeLeft--;
        updateHUD();
        if (timeLeft <= 0) {
            clearInterval(gameInterval);
            endGame(true);
        }
    }

    function nextQuestion() {
        feedbackDisplay.textContent = '';
        let num1, num2, operator, questionType;
        
        // Determine question type based on mode
        const types = [];
        if (['multiplication', 'mixed', 'survival', 'timer'].includes(currentMode)) types.push('multiplication');
        if (['division', 'mixed', 'survival', 'timer'].includes(currentMode)) types.push('division');
        questionType = types[Math.floor(Math.random() * types.length)];

        if (questionType === 'multiplication') {
            num1 = Math.floor(Math.random() * 12) + 1;
            num2 = Math.floor(Math.random() * 12) + 1;
            currentCorrectAnswer = num1 * num2;
            operator = '×';
        } else { // Division
            const divisor = Math.floor(Math.random() * 12) + 1;
            const result = Math.floor(Math.random() * 12) + 1;
            num1 = divisor * result;
            num2 = divisor;
            currentCorrectAnswer = result;
            operator = '÷';
        }

        questionDisplay.textContent = ${num1} ${operator} ${num2} = ?;
        generateOptions();
    }
    
    function generateOptions() {
        const options = new Set([currentCorrectAnswer]);
        while (options.size < 4) {
            const range = Math.max(5, Math.ceil(currentCorrectAnswer * 0.2));
            const randomOffset = Math.floor(Math.random() * range * 2) - range;
            const distractor = currentCorrectAnswer + randomOffset;
            if (distractor !== currentCorrectAnswer && distractor > 0) {
                options.add(distractor);
            }
        }
        
        const shuffledOptions = Array.from(options).sort(() => Math.random() - 0.5);
        
        optionsContainer.innerHTML = '';
        shuffledOptions.forEach(option => {
            const button = document.createElement('button');
            button.classList.add('option-btn');
            button.textContent = option;
            button.addEventListener('click', selectAnswer);
            optionsContainer.appendChild(button);
        });
    }

    function selectAnswer(e) {
        const selectedButton = e.target;
        const selectedAnswer = parseInt(selectedButton.textContent);
        
        // Disable all buttons after an answer is chosen
        document.querySelectorAll('.option-btn').forEach(btn => btn.disabled = true);

        if (selectedAnswer === currentCorrectAnswer) {
            score++;
            selectedButton.classList.add('correct');
            feedbackDisplay.textContent = '✓ Correct!';
            playSound(playCorrectSound);
        } else {
            lives--;
            selectedButton.classList.add('wrong');
            feedbackDisplay.textContent = ✗ Wrong! The answer was ${currentCorrectAnswer};
            playSound(playWrongSound);
            
            // Highlight the correct answer
            document.querySelectorAll('.option-btn').forEach(btn => {
                if (parseInt(btn.textContent) === currentCorrectAnswer) {
                    btn.classList.add('correct');
                }
            });
        }
        
        updateHUD();

        if (currentMode === 'survival' && lives <= 0) {
            setTimeout(() => endGame(false), 1500);
            return;
        }
        
        setTimeout(nextQuestion, 1500);
    }
    
    function endGame(isWin) {
        finalScoreDisplay.textContent = score;
        if (currentMode === 'timer') {
            endTitle.textContent = "Time's Up!";
            endMessage.textContent = score > 15 ? "Amazing job! You're a speed demon!" : "Great effort! Keep practicing!";
            isWin = score > 15;
        } else if (currentMode === 'survival') {
            endTitle.textContent = 'Game Over!';
            endMessage.textContent = "You ran out of lives. Better luck next time!";
            isWin = false;
        }
        playSound(isWin ? playWinSound : playLoseSound);
        showScreen('end-screen');
    }

    // Initial load
    showScreen('main-menu');
});
