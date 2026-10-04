import './style.css'
import coverUrl from './assets/anh-bia.jpg'
import { mountSfx } from './sfx.js'

const API_BASE = 'https://deadth-note-be.vercel.app'
const LINES = 7
const PAGE_COUNT = 6
const LAST_SPREAD = PAGE_COUNT / 2 - 1
const FLIP_MS = 900
const BOOK_IN_MS = 5200
const OPEN_MS = 7600

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const singleQuery = window.matchMedia('(max-width: 800px)')
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI']

const timers = []
let phase = 'storm'
let settled = false
let opened = false
let spread = 0
let busy = false
let dragging = false
let flipToken = 0
let remoteNames = []
let pages = blankPages()
let editing = null
let saving = false

const app = document.querySelector('#app')

const ash = el('canvas', 'ash')
const fogA = el('div', 'fog')
const fogB = el('div', 'fog fog-b')
const groundFog = el('div', 'ground-fog')
const vignette = el('div', 'vignette')
const grain = el('div', 'grain')
const redPulse = el('div', 'red-pulse')

const storm = el('div', 'storm')
const flash = el('div', 'flash')
storm.append(flash, bolt('bolt bolt-a'), bolt('bolt bolt-b'), bolt('bolt bolt-c'))
const reaperWrap = el('div', 'reaper-wrap')
const reaper = document.createElement('img')
reaper.className = 'reaper'
reaper.src = coverUrl
reaper.alt = ''
reaper.setAttribute('aria-hidden', 'true')
reaper.draggable = false
if (reaper.complete && reaper.naturalWidth) carveReaper(reaper)
else reaper.addEventListener('load', () => carveReaper(reaper), { once: true })
reaperWrap.append(reaper)
storm.append(reaperWrap)

const rig = el('div', 'rig')
const levitate = el('div', 'levitate')
const scene = el('div', 'scene')
const underLeft = el('div', 'under-left')
const leftFace = el('div', 'sheet-face left-face')
const prevBtn = turnButton('turn turn-prev', 'Lật về trang trước')
underLeft.append(el('div', 'binding-left'), leftFace)

const book = el('div', 'book')
const rightFace = el('div', 'sheet-face right-face')
const flipper = el('div', 'sheet flipper')
const flipFront = el('div', 'face-fill')
const flipBack = el('div', 'face-fill')
const frontFace = el('div', 'face front')
const backFace = el('div', 'face back')
frontFace.append(flipFront)
backFace.append(flipBack)
flipper.append(frontFace, backFace)
const nextBtn = turnButton('turn turn-next', 'Lật sang trang sau')
book.append(el('div', 'halo'), el('div', 'book-shadow'), rightFace, flipper, el('div', 'page-edge'), el('div', 'binding'), nextBtn)

scene.append(underLeft, book, prevBtn)
levitate.append(scene)
rig.append(levitate)

const modal = el('div', 'modal')
modal.hidden = true
modal.setAttribute('role', 'dialog')
modal.setAttribute('aria-modal', 'true')
modal.setAttribute('aria-labelledby', 'popupTitle')
const card = el('form', 'modal-card')
const popupTitle = el('h2', 'popup-title', 'Ghi tên')
popupTitle.id = 'popupTitle'
const popupNote = el('p', 'popup-note', 'Nhập mật khẩu trước khi đổi tên.')
const fieldLabel = el('label', 'sr', 'Tên')
fieldLabel.htmlFor = 'nameInput'
const input = document.createElement('input')
input.id = 'nameInput'
input.name = 'name'
input.type = 'text'
input.maxLength = 42
input.autocomplete = 'off'
input.spellcheck = false
input.placeholder = 'Viết một cái tên…'
const passLabel = el('label', 'sr', 'Mật khẩu')
passLabel.htmlFor = 'passInput'
const passInput = document.createElement('input')
passInput.id = 'passInput'
passInput.name = 'password'
passInput.type = 'password'
passInput.className = 'secret'
passInput.autocomplete = 'off'
passInput.placeholder = 'Mật khẩu'
const actions = el('div', 'popup-actions')
const writeBtn = el('button', 'blood-btn', 'Viết')
writeBtn.type = 'submit'
const closeBtn = el('button', 'ghost-btn', 'Đóng')
closeBtn.type = 'button'
actions.append(writeBtn, closeBtn)
card.append(popupTitle, popupNote, fieldLabel, input, passLabel, passInput, actions)
modal.append(card)

const announce = el('div', 'announce')
announce.setAttribute('aria-live', 'polite')

app.append(ash, fogA, fogB, groundFog, rig, storm, redPulse, vignette, grain, modal, announce)
const sfx = mountSfx()

startAsh(ash)
showCover()
updateControls()
document.body.dataset.phase = phase

closeBtn.addEventListener('click', closePopup)
modal.addEventListener('click', (event) => {
  if (event.target === modal) closePopup()
})
card.addEventListener('submit', (event) => {
  event.preventDefault()
  commitName(sanitize(input.value))
})

bindDrag(nextBtn, 'next')
bindDrag(prevBtn, 'prev')
bindPageSwipe()
loadRemoteNames()

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (!modal.hidden) closePopup()
    else if (!settled) jumpToBook(false)
    return
  }
  if (!settled || busy || !modal.hidden) return
  if (event.key === 'ArrowRight') turn('next')
  if (event.key === 'ArrowLeft') turn('prev')
})

if (reduceMotion) jumpToBook(false)
else runIntro()

function runIntro() {
  phase = 'storm'
  document.body.dataset.phase = phase
  storm.classList.remove('done')
  storm.classList.add('play')
  sfx.startStorm(BOOK_IN_MS)
  later(() => {
    phase = 'book'
    document.body.dataset.phase = phase
    storm.classList.add('done')
    rig.classList.add('show')
    sfx.bookIn()
  }, BOOK_IN_MS)
  later(() => openCover(1200, () => finish()), OPEN_MS)
}

function jumpToBook() {
  clearTimers()
  sfx.skipIntro()
  flipToken += 1
  busy = false
  setDragging(false)
  hideFlipper(true)
  storm.classList.remove('play')
  storm.classList.add('done')
  rig.classList.add('show')
  if (!opened) {
    opened = true
    spread = 0
    scene.classList.add('opened', 'instant')
    showSettled()
    requestAnimationFrame(() => scene.classList.remove('instant'))
  }
  finish()
}

function finish() {
  if (settled) return
  settled = true
  sfx.finishIntro()
  phase = 'ready'
  document.body.dataset.phase = phase
  rig.classList.add('show', 'ready')
  updateControls()
}

function openCover(ms, done) {
  if (busy || opened) return
  busy = true
  sfx.cover()
  scene.classList.add('opened')
  paintCoverFlip()
  flipper.hidden = false
  setAngle(0, 0)
  window.setTimeout(() => setAngle(-180, ms), 30)
  whenFlipped(ms, () => {
    opened = true
    spread = 0
    showSettled()
    hideFlipper(true)
    busy = false
    updateControls()
    done?.()
  })
}

function closeCover() {
  if (busy || !opened || spread !== 0) return
  busy = true
  sfx.cover()
  updateControls()
  paintCoverFlip()
  flipper.hidden = false
  setAngle(-180, 0)
  window.setTimeout(() => setAngle(0, FLIP_MS), 30)
  whenFlipped(FLIP_MS, () => {
    opened = false
    showCover()
    hideFlipper(true)
    busy = false
    updateControls()
  })
}

function turn(direction) {
  if (busy || !settled || dragging) return
  if (!canTurn(direction)) return
  if (!opened && direction === 'next') {
    openCover(FLIP_MS)
    return
  }
  if (direction === 'prev' && spread === 0) {
    closeCover()
    return
  }
  sfx.page()
  beginFlip(direction)
  const target = direction === 'next' ? -180 : 0
  window.setTimeout(() => setAngle(target, FLIP_MS), 30)
  whenFlipped(FLIP_MS, () => endFlip(direction))
}

function beginFlip(direction) {
  busy = true
  if (direction === 'next') {
    paintForward()
    flipper.hidden = false
    setAngle(0, 0)
    return
  }
  paintBackward()
  flipper.hidden = false
  setAngle(-180, 0)
}

function endFlip(direction) {
  spread += direction === 'next' ? 1 : -1
  showSettled()
  hideFlipper(true)
  busy = false
  updateControls()
}

function bindDrag(button, direction) {
  let startX = 0
  let active = false
  let velocity = 0
  let lastX = 0
  let lastT = 0

  button.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (busy || !settled || !canTurn(direction) || !modal.hidden) return
    event.stopPropagation()
    active = true
    startX = lastX = event.clientX
    lastT = performance.now()
    velocity = 0
    button.setPointerCapture(event.pointerId)
    armFlip(direction)
  })

  button.addEventListener('pointermove', (event) => {
    if (!active) return
    trackVelocity(event)
    setAngle(dragAngle(direction, event.clientX - startX).angle, 0)
  })

  function trackVelocity(event) {
    const now = performance.now()
    const dt = now - lastT
    if (dt > 0) velocity = (event.clientX - lastX) / dt
    lastX = event.clientX
    lastT = now
  }

  function release(event) {
    if (!active) return
    active = false
    setDragging(false)
    if (event.type === 'pointercancel') {
      cancelDrag(direction)
      return
    }
    commitOrCancel(direction, event.clientX - startX, velocity, true)
  }

  button.addEventListener('pointerup', release)
  button.addEventListener('pointercancel', release)
}

function bindPageSwipe() {
  const LOCK = 18
  let pointerId = null
  let startX = 0
  let startY = 0
  let lastX = 0
  let lastT = 0
  let velocity = 0
  let direction = null

  scene.addEventListener('pointerdown', (event) => {
    if (pointerId !== null) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (busy || !settled || !modal.hidden) return
    if (event.target.closest('.turn')) return
    pointerId = event.pointerId
    startX = lastX = event.clientX
    startY = event.clientY
    lastT = performance.now()
    velocity = 0
    direction = null
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  })

  function detach() {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
  }

  function onMove(event) {
    if (event.pointerId !== pointerId) return
    const dx = event.clientX - startX
    const dy = event.clientY - startY
    const now = performance.now()
    const dt = now - lastT
    if (dt > 0) velocity = (event.clientX - lastX) / dt
    lastX = event.clientX
    lastT = now
    if (!direction) {
      if (Math.abs(dx) < LOCK && Math.abs(dy) < LOCK) return
      if (Math.abs(dx) <= Math.abs(dy)) {
        pointerId = null
        detach()
        return
      }
      swallowClick()
      const nextDirection = dx < 0 ? 'next' : 'prev'
      if (!canTurn(nextDirection)) {
        pointerId = null
        detach()
        return
      }
      direction = nextDirection
      armFlip(direction)
    }
    event.preventDefault()
    setAngle(dragAngle(direction, dx).angle, 0)
  }

  function onUp(event) {
    if (event.pointerId !== pointerId) return
    const dx = event.clientX - startX
    const dir = direction
    const speed = velocity
    pointerId = null
    direction = null
    detach()
    if (!dir) return
    setDragging(false)
    if (event.type === 'pointercancel') {
      cancelDrag(dir)
      return
    }
    commitOrCancel(dir, dx, speed, false)
  }

  function swallowClick() {
    const stop = (event) => {
      event.preventDefault()
      event.stopPropagation()
      document.removeEventListener('click', stop, true)
    }
    document.addEventListener('click', stop, true)
    window.setTimeout(() => document.removeEventListener('click', stop, true), 500)
  }
}

function armFlip(direction) {
  setDragging(true)
  busy = true
  updateControls()
  if (!opened && direction === 'next') {
    scene.classList.add('opened')
    paintCoverFlip()
    flipper.hidden = false
    setAngle(0, 0)
    return
  }
  if (direction === 'prev' && spread === 0) {
    paintCoverFlip()
    flipper.hidden = false
    setAngle(-180, 0)
    return
  }
  beginFlip(direction)
}

function dragAngle(direction, delta) {
  const width = Math.max(book.getBoundingClientRect().width, 1)
  const pulled = direction === 'next' ? -delta / width : delta / width
  const progress = Math.max(0, Math.min(0.92, pulled))
  const sign = direction === 'next' ? -1 : 1
  const origin = direction === 'next' ? 0 : -180
  return { pulled, angle: origin + sign * progress * 180 }
}

function commitOrCancel(direction, delta, velocity, tapTurns) {
  const { pulled } = dragAngle(direction, delta)
  const flick = direction === 'next' ? velocity < -0.55 : velocity > 0.55
  const shouldTurn = (tapTurns && Math.abs(delta) < 10) || pulled > 0.18 || (flick && pulled > 0.02)
  if (!shouldTurn) {
    cancelDrag(direction)
    return
  }
  const coverMove = (!opened && direction === 'next') || (direction === 'prev' && spread === 0)
  if (coverMove) sfx.cover()
  else sfx.page()
  const target = direction === 'next' ? -180 : 0
  setAngle(target, FLIP_MS)
  whenFlipped(FLIP_MS, () => finishArmed(direction))
}

function finishArmed(direction) {
  if (!opened && direction === 'next') {
    opened = true
    spread = 0
    showSettled()
  } else if (direction === 'prev' && spread === 0) {
    opened = false
    showCover()
  } else {
    endFlip(direction)
    return
  }
  hideFlipper(true)
  busy = false
  updateControls()
}

function cancelDrag(direction) {
  const backTo = direction === 'next' ? 0 : -180
  setAngle(backTo, 360)
  whenFlipped(360, () => {
    if (!opened) scene.classList.remove('opened')
    showSettled()
    hideFlipper(true)
    busy = false
    setDragging(false)
    updateControls()
  })
}

function setDragging(on) {
  dragging = on
  scene.classList.toggle('dragging', on)
}

function canTurn(direction) {
  if (!opened) return direction === 'next'
  if (direction === 'next') return spread < lastIndex()
  return true
}

function showCover() {
  opened = false
  scene.classList.remove('opened')
  renderInto(rightFace, 'cover')
  leftFace.replaceChildren()
}

function showSettled(fresh) {
  if (!opened) {
    showCover()
    return
  }
  scene.classList.add('opened')
  if (isSinglePage()) {
    leftFace.replaceChildren()
    renderInto(rightFace, spread, fresh)
    return
  }
  renderInto(leftFace, spread * 2, fresh)
  renderInto(rightFace, spread * 2 + 1, fresh)
}

function updateControls() {
  const lock = busy && !dragging
  prevBtn.disabled = lock || !opened
  nextBtn.disabled = lock || (opened && spread >= lastIndex())
  nextBtn.setAttribute('aria-label', opened ? 'Lật sang trang sau' : 'Mở sổ')
  prevBtn.hidden = !opened
}

function openPopup(pageIndex, lineIndex) {
  if (busy || phase !== 'ready' || dragging || saving) return
  editing = { pageIndex, lineIndex }
  const current = pages[pageIndex][lineIndex]
  input.value = current
  passInput.value = ''
  popupTitle.textContent = current ? 'Đổi tên' : 'Ghi tên'
  popupNote.textContent = 'Nhập mật khẩu trước khi đổi tên.'
  modal.hidden = false
  input.focus()
}

function closePopup() {
  modal.hidden = true
  editing = null
  card.classList.remove('shake')
}

async function commitName(name) {
  if (!editing || saving) return
  const { pageIndex, lineIndex } = editing
  const previous = pages[pageIndex][lineIndex]
  if (!name) {
    popupNote.textContent = 'Tên không được để trống.'
    shakeCard()
    return
  }
  if (name === previous) {
    closePopup()
    return
  }
  const password = passInput.value
  if (!password) {
    popupNote.textContent = 'Nhập mật khẩu trước khi đổi tên.'
    shakeCard()
    passInput.focus()
    return
  }

  saving = true
  writeBtn.disabled = true
  try {
    const response = await fetch(`${API_BASE}/names`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password }),
    })
    if (response.status === 401) {
      popupNote.textContent = 'Sai mật khẩu.'
      shakeCard()
      passInput.focus()
      return
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      popupNote.textContent = body.error || 'Không ghi được tên.'
      shakeCard()
      return
    }
    const created = await response.json().catch(() => null)
    closePopup()
    const synced = await loadRemoteNames(name)
    if (!synced && created?.name) applyNames([created, ...remoteNames], name)
    redPulse.classList.remove('go')
    void redPulse.offsetWidth
    redPulse.classList.add('go')
    announce.textContent = `Đã ghi ${name}`
  } catch {
    popupNote.textContent = 'Không gọi được sổ tên.'
    shakeCard()
  } finally {
    saving = false
    writeBtn.disabled = false
  }
}

function shakeCard() {
  card.classList.remove('shake')
  void card.offsetWidth
  card.classList.add('shake')
}

function renderInto(target, pageIndex, fresh) {
  target.replaceChildren()
  target.classList.toggle('paper', pageIndex !== 'cover')
  target.classList.toggle('cover-face', pageIndex === 'cover')
  if (pageIndex === 'cover') {
    const image = document.createElement('img')
    image.src = coverUrl
    image.alt = 'Bìa Death Note'
    image.draggable = false
    target.append(image)
    return
  }

  const head = document.createElement('header')
  head.className = 'page-head'
  head.append(el('p', 'page-kicker', 'Death Note'), el('p', 'folio', ROMAN[pageIndex] || ''))
  const list = el('div', 'names')
  pages[pageIndex].forEach((name, line) => {
    list.append(makeRule(pageIndex, line, name, fresh?.page === pageIndex && fresh?.line === line))
  })
  target.append(head, list, el('div', 'pad'))
}

function makeRule(pageIndex, line, name, animate) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'rule'
  button.style.zIndex = String(40 - line)
  button.addEventListener('click', () => openPopup(pageIndex, line))
  if (!name) {
    button.setAttribute('aria-label', 'Dòng trống')
    return button
  }
  const ink = document.createElement('span')
  ink.className = animate ? 'ink fresh' : 'ink'
  const tone = hashText(name)
  ink.style.color = `rgb(${154 + (tone % 36)}, ${16 + (tone % 12)}, ${18 + (tone % 8)})`
  const text = document.createElement('span')
  text.className = 'ink-text'
  text.textContent = name
  ink.append(text)
  button.append(ink)
  return button
}

function hashText(value) {
  let hash = 0
  for (const char of value) hash = (hash * 33 + char.codePointAt(0)) >>> 0
  return hash
}

function hideFlipper(instant) {
  if (instant) flipper.classList.add('instant')
  flipper.hidden = true
  flipper.style.transition = ''
  flipper.style.transform = ''
  if (instant) {
    void flipper.offsetWidth
    flipper.classList.remove('instant')
  }
}

function setAngle(angle, ms) {
  flipper.style.transition = ms ? `transform ${ms}ms cubic-bezier(0.42, 0.03, 0.18, 1)` : 'none'
  flipper.style.transform = `rotateY(${angle}deg)`
}

function whenFlipped(ms, done) {
  const token = ++flipToken
  let finished = false
  const complete = () => {
    if (finished || token !== flipToken) return
    finished = true
    flipper.removeEventListener('transitionend', onEnd)
    done()
  }
  const onEnd = (event) => {
    if (event.target !== flipper || event.propertyName !== 'transform') return
    complete()
  }
  flipper.addEventListener('transitionend', onEnd)
  window.setTimeout(complete, ms + 90)
}

function turnButton(className, label) {
  const button = el('button', className)
  button.type = 'button'
  button.setAttribute('aria-label', label)
  return button
}

function carveReaper(image) {
  if (!image.naturalWidth) return
  const cropX = 20
  const cropY = 1360
  const cropW = 860
  const cropH = 1000
  const canvas = document.createElement('canvas')
  canvas.width = cropW
  canvas.height = cropH
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(image, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)
  const frame = context.getImageData(0, 0, cropW, cropH)
  const pixels = frame.data
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index]
    const green = pixels[index + 1]
    const blue = pixels[index + 2]
    const max = Math.max(red, green, blue)
    const min = Math.min(red, green, blue)
    const luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue
    const leather = green >= red - 8 && green + 6 >= blue && luma < 96
    const crack = red > green && green >= blue - 10 && luma < 115 && max < 150
    const blueHair = blue > 48 && blue > red + 8 && blue + 6 > green
    const redEye = red > 115 && red > green + 45 && red > blue + 35
    if ((leather || crack) && !blueHair && !redEye) {
      pixels[index + 3] = 0
      continue
    }
    if (luma < 22 && !blueHair && !redEye) {
      pixels[index + 3] = 0
      continue
    }
    if (redEye) {
      pixels[index] = 255
      pixels[index + 1] = 24
      pixels[index + 2] = 18
      pixels[index + 3] = 255
      continue
    }
    if (blueHair && luma < 90) {
      pixels[index] = 10
      pixels[index + 1] = 16
      pixels[index + 2] = 36
      pixels[index + 3] = 230
      continue
    }
    pixels[index] = 8
    pixels[index + 1] = 8
    pixels[index + 2] = 12
    pixels[index + 3] = luma > 150 ? 245 : 210
  }
  context.putImageData(frame, 0, 0)
  image.dataset.carved = '1'
  image.src = canvas.toDataURL('image/png')
  image.classList.add('carved')
}

function bolt(className) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 80 320')
  svg.setAttribute('class', className)
  svg.setAttribute('aria-hidden', 'true')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
  path.setAttribute('points', '48,0 18,118 46,118 14,320')
  svg.append(path)
  return svg
}

function isSinglePage() {
  return singleQuery.matches
}

function lastIndex() {
  return isSinglePage() ? PAGE_COUNT - 1 : LAST_SPREAD
}

function paintCoverFlip() {
  renderInto(flipFront, 'cover')
  renderInto(flipBack, 0)
  renderInto(rightFace, isSinglePage() ? 0 : 1)
}

function paintForward() {
  const next = spread + 1
  if (isSinglePage()) {
    renderInto(flipFront, spread)
    renderInto(flipBack, next)
    renderInto(rightFace, next)
    return
  }
  renderInto(flipFront, spread * 2 + 1)
  renderInto(flipBack, next * 2)
  renderInto(rightFace, next * 2 + 1)
}

function paintBackward() {
  const prev = spread - 1
  if (isSinglePage()) {
    renderInto(flipFront, prev)
    renderInto(flipBack, spread)
    renderInto(rightFace, prev)
    return
  }
  renderInto(flipFront, prev * 2 + 1)
  renderInto(flipBack, spread * 2)
  renderInto(leftFace, prev * 2)
}

singleQuery.addEventListener('change', () => {
  if (busy) return
  if (opened) showSettled()
  updateControls()
})

function sanitize(value) {
  return value.replace(/[\u0000-\u001F]/g, '').trim().replace(/\s+/g, ' ').slice(0, 42)
}

function blankPages() {
  return Array.from({ length: PAGE_COUNT }, () => Array(LINES).fill(''))
}

function applyNames(list, freshName) {
  remoteNames = Array.isArray(list) ? list : []
  const next = blankPages()
  const names = remoteNames
    .slice()
    .reverse()
    .map((row) => (typeof row?.name === 'string' ? sanitize(row.name) : ''))
    .filter(Boolean)
  let fresh = null
  names.forEach((entry, index) => {
    const page = Math.floor(index / LINES)
    const line = index % LINES
    if (!next[page]) return
    next[page][line] = entry
    if (entry === freshName) fresh = { page, line }
  })
  pages = next
  if (opened && !busy) showSettled(fresh)
}

async function loadRemoteNames(freshName) {
  try {
    const response = await fetch(`${API_BASE}/names`)
    if (!response.ok) return false
    const list = await response.json()
    if (!Array.isArray(list)) return false
    applyNames(list, freshName)
    return true
  } catch {
    return false
  }
}

function later(fn, ms) {
  const id = window.setTimeout(fn, ms)
  timers.push(id)
}

function clearTimers() {
  while (timers.length) window.clearTimeout(timers.pop())
}

function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text) node.textContent = text
  return node
}

function startAsh(canvas) {
  const context = canvas.getContext('2d')
  if (!context || reduceMotion) return
  let width = 0
  let height = 0
  let frameId = 0
  let running = false
  const motes = Array.from({ length: 56 }, () => spawn(true))

  function spawn(anywhere) {
    return {
      x: Math.random(),
      y: anywhere ? Math.random() : 1.05,
      r: Math.random() * 1.5 + 0.3,
      speed: Math.random() * 0.12 + 0.03,
      drift: Math.random() * 0.18 - 0.09,
      alpha: Math.random() * 0.28 + 0.05,
      green: Math.random() > 0.84,
    }
  }

  function resize() {
    width = canvas.width = window.innerWidth
    height = canvas.height = window.innerHeight
  }

  function frame() {
    context.clearRect(0, 0, width, height)
    for (const mote of motes) {
      mote.y -= 0.0009 + mote.speed * 0.004
      mote.x += mote.drift * 0.003
      if (mote.y < -0.02) Object.assign(mote, spawn(false))
      context.fillStyle = mote.green
        ? `rgba(120, 220, 150, ${mote.alpha})`
        : `rgba(186, 176, 166, ${mote.alpha})`
      context.beginPath()
      context.arc(mote.x * width, mote.y * height, mote.r, 0, Math.PI * 2)
      context.fill()
    }
    frameId = window.requestAnimationFrame(frame)
  }

  function start() {
    if (running) return
    running = true
    frame()
  }

  function stop() {
    running = false
    window.cancelAnimationFrame(frameId)
  }

  resize()
  start()
  window.addEventListener('resize', resize)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop()
    else start()
  })
}
