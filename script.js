// script.js - Math Challenge game logic (vanilla JS)
// Added features:
// - Difficulty levels (easy/medium/hard)
// - Sound effects toggle
// - High score (localStorage)
// - Clean modular structure with comments

// --- Utilities ---
function qs(selector){return document.querySelector(selector)}
function qsa(selector){return Array.from(document.querySelectorAll(selector))}

// DOM refs
const menuScreen = qs('#menu-screen')
const gameScreen = qs('#game-screen')
const resultScreen = qs('#result-screen')
const scoreEl = qs('#score')
const highscoreEl = qs('#highscore')
const modeLabel = qs('#mode-label')
const timerEl = qs('#timer')
const heartsEl = qs('#hearts')
const questionEl = qs('#question')
const answersEl = qs('#answers')
const finalScoreEl = qs('#final-score')
const resultHighEl = qs('#result-high')
const playAgainBtn = qs('#play-again')
const backMenuBtn = qs('#back-menu')
const quitBtn = qs('#quit-btn')
const nextBtn = qs('#next-btn')
const soundToggleBtn = qs('#toggle-sound')
const resetHighBtn = qs('#reset-highscore')

// Difficulty buttons
const diffButtons = qsa('.diff')
let chosenDifficulty = localStorage.getItem('mc_difficulty') || 'medium'

// Sound (simple using Audio API) - small beep using data URI or generate via oscillator? we'll use short audio via WebAudio API
let soundEnabled = (localStorage.getItem('mc_sound') || '1') === '1'

// Game state
let state = {
  mode: null, // 'practice' | 'survival' | 'timer'
  score: 0,
  hearts: 3,
  timer: 60,
  currentAnswer: null,
  questionTimeout: null,
  countdownInterval: null,
  acceptingInput: true,
  difficulty: chosenDifficulty,
}

// High score key
const HS_KEY = 'mc_best_score_v1'

// --- Init UI ---
function initUI(){
  // set difficulty button active
  diffButtons.forEach(b=>{
    b.classList.toggle('active', b.dataset.diff === state.difficulty)
    b.addEventListener('click', ()=>{
      state.difficulty = b.dataset.diff
      localStorage.setItem('mc_difficulty', state.difficulty)
      diffButtons.forEach(x=>x.classList.toggle('active', x===b))
    })
  })

  // menu mode buttons
  qsa('.menu-buttons .btn').forEach(btn=>{
    btn.addEventListener('click', ()=> startMode(btn.dataset.mode))
  })

  backMenuBtn.addEventListener('click', ()=> showMenu())
  quitBtn.addEventListener('click', ()=> showMenu())
  playAgainBtn.addEventListener('click', ()=> startMode(state.mode || 'practice'))
  soundToggleBtn.addEventListener('click', toggleSound)
  resetHighBtn.addEventListener('click', ()=>{
    localStorage.removeItem(HS_KEY)
    updateHighScoreDisplay()
  })

  // set sound button text
  updateSoundButton()

  // keyboard shortcuts
  window.addEventListener('keydown', (e)=>{
    if(!gameScreen.classList.contains('active')) return
    const btns = qsa('.answer-btn')
    if(btns.length === 0) return
    if(e.key >= '1' && e.key <= '4'){
      const idx = Number(e.key)-1
      if(btns[idx]) btns[idx].click()
    }
  })

  updateHighScoreDisplay()
}

// --- Screen helpers ---
function showMenu(){
  clearTimers()
  state.mode = null
  updateStatus()
  setActiveScreen('menu')
}
function setActiveScreen(name){
  menuScreen.classList.toggle('active', name==='menu')
  gameScreen.classList.toggle('active', name==='game')
  resultScreen.classList.toggle('active', name==='result')
}

function updateStatus(){
  scoreEl.textContent = state.score
  modeLabel.textContent = state.mode ? capitalize(state.mode) : '-'
  timerEl.textContent = state.mode === 'timer' ? ${state.timer}s : (state.mode === 'practice' ? '--' : (state.mode === 'survival' ? '--' : '--'))
  heartsEl.innerHTML = state.mode === 'survival' ? '❤️'.repeat(state.hearts) : (state.mode === 'survival' ? '❤️'.repeat(state.hearts) : '--')
}

function capitalize(s){return s ? s[0].toUpperCase()+s.slice(1) : ''}

// --- Start Modes ---
function startMode(mode){
  state.mode = mode
  state.score = 0
  state.hearts = 3
  state.timer = 60
  state.acceptingInput = true
  state.difficulty = state.difficulty || chosenDifficulty
  updateStatus()
  setActiveScreen('game')

  if(mode === 'timer'){
    startCountdown()
  }

  loadNextQuestion()
}

function clearTimers(){
  if(state.questionTimeout) clearTimeout(state.questionTimeout)
  if(state.countdownInterval) clearInterval(state.countdownInterval)
}

// --- Countdown ---
function startCountdown(){
  timerEl.textContent = ${state.timer}s
  if(state.countdownInterval) clearInterval(state.countdownInterval)
  state.countdownInterval = setInterval(()=>{
    state.timer -= 1
    timerEl.textContent = ${state.timer}s
    if(state.timer <= 0){
      clearInterval(state.countdownInterval)
      endGame()
    }
  }, 1000)
}

// --- Question generation with difficulty ---
function randomInt(min,max){return Math.floor(Math.random()*(max-min+1))+min}

function getRangeByDifficulty(){
  switch(state.difficulty){
    case 'easy': return {min:2, max:8}
    case 'hard': return {min:6, max:18}
    case 'medium':
    default: return {min:2, max:12}
  }
}

function generateQuestion(){
  const range = getRangeByDifficulty()
  const isMultiply = Math.random() < 0.55
  let a,b,questionText,answer
  if(isMultiply){
    a = randomInt(range.min, range.max)
    b = randomInt(range.min, range.max)
    answer = a * b
    questionText = ${a} × ${b} = ?
  } else {
    a = randomInt(range.min, range.max)
    b = randomInt(range.min, range.max)
    answer = b
    questionText = ${a*b} ÷ ${a} = ?
  }
  return {questionText, answer}
}

function makeChoices(correct){
  const choices = new Set([correct])
  const spread = Math.max(6, Math.abs(correct))
  while(choices.size < 4){
    const offset = Math.round((Math.random()*0.8 + 0.2) * (Math.random()<0.5 ? -1 : 1) * (Math.max(1, Math.ceil(spread/6))))
    let val = correct + offset
    if(val <= 0) val = Math.abs(val) + 1
    if(Math.random() < 0.12) val = correct + randomInt(-12,12)
    choices.add(val)
  }
  return Array.from(choices).sort(()=>Math.random()-0.5)
}

// --- Sounds via WebAudio ---
const audioCtx = window.AudioContext ? new AudioContext() : null
function playTone(freq=440, duration=0.07){
  if(!soundEnabled || !audioCtx) return
  try{
    const o = audioCtx.createOscillator()
    const g = audioCtx.createGain()
    o.type = 'sine'
    o.frequency.value = freq
    o.connect(g)
    g.connect(audioCtx.destination)
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.01)
    o.start()
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration)
    setTimeout(()=>{ o.stop(); o.disconnect(); g.disconnect() }, duration*1000 + 50)
  }catch(e){/* ignore */}
}

function playCorrect(){ playTone(880, 0.08) }
function playWrong(){ playTone(220, 0.12) }

function toggleSound(){
  soundEnabled = !soundEnabled
  localStorage.setItem('mc_sound', soundEnabled ? '1' : '0')
  updateSoundButton()
}
function updateSoundButton(){
  soundToggleBtn.textContent = soundEnabled ? 'Sound: On' : 'Sound: Off'
}

// --- UI: load question & answers ---
function loadNextQuestion(){
  clearTimeout(state.questionTimeout)
  state.acceptingInput = true
  answersEl.innerHTML = ''
  const q = generateQuestion()
  state.currentAnswer = q.answer
  questionEl.textContent = q.questionText

  const choices = makeChoices(q.answer)
  choices.forEach(c=>{
    const b = document.createElement('button')
    b.className = 'answer-btn'
    b.textContent = c
    b.addEventListener('click', ()=> selectAnswer(b, c))
    answersEl.appendChild(b)
  })

  updateStatus()
}

function selectAnswer(btn, value){
  if(!state.acceptingInput) return
  state.acceptingInput = false

  const correct = Number(value) === Number(state.currentAnswer)
  if(correct){
    btn.classList.add('correct')
    state.score += 1
    playCorrect()
  } else {
    btn.classList.add('wrong')
    playWrong()
    // show correct button
    const correctBtn = Array.from(qsa('.answer-btn')).find(x=>Number(x.textContent) === Number(state.currentAnswer))
    if(correctBtn) correctBtn.classList.add('correct')

    if(state.mode === 'survival'){
      state.hearts -= 1
      if(state.hearts <= 0){
        updateStatus()
        state.questionTimeout = setTimeout(()=> endGame(), 900)
        return
      }
    }
  }

  updateStatus()
  state.questionTimeout = setTimeout(()=>{
    if(state.mode === 'practice'){
      loadNextQuestion()
    } else if(state.mode === 'timer'){
      if(state.timer > 0) loadNextQuestion()
      else endGame()
    } else if(state.mode === 'survival'){
      if(state.hearts > 0) loadNextQuestion()
      else endGame()
    }
  }, 900)
}

// --- End game / results + high score ---
function endGame(){
  clearTimers()
  finalScoreEl.textContent = state.score
  // update highscore
  const best = Number(localStorage.getItem(HS_KEY) || 0)
  if(state.score > best){
    localStorage.setItem(HS_KEY, String(state.score))
  }
  updateHighScoreDisplay()
  resultHighEl.textContent = localStorage.getItem(HS_KEY) || '0'
  setActiveScreen('result')
}

function updateHighScoreDisplay(){
  highscoreEl.textContent = localStorage.getItem(HS_KEY) || '0'
}

// --- Init ---
initUI()
showMenu()
