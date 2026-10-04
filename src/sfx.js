import thunderUrl from './assets/audio/set.mp3'
import windUrl from './assets/audio/gio-hu.mp3'
import crowUrl from './assets/audio/qua.mp3'
import pageUrl from './assets/audio/lat-trang.mp3'
import coverUrl from './assets/audio/mo-so.mp3'

const BOLTS = [
  { at: 0.07, volume: 1, rate: 1 },
  { at: 0.13, volume: 0.62, rate: 1.06 },
  { at: 0.26, volume: 0.94, rate: 0.94 },
  { at: 0.4, volume: 1, rate: 1.02 },
  { at: 0.56, volume: 0.82, rate: 0.9 },
  { at: 0.74, volume: 1, rate: 0.97 },
]

export function mountSfx() {
  const wind = track(windUrl)
  const thunder = track(thunderUrl)
  const crow = track(crowUrl)
  const page = track(pageUrl)
  const cover = track(coverUrl)

  let stormOn = false
  let ambienceOn = false
  let stormStart = 0
  let stormMs = 5200
  let windToken = 0
  const boltTimers = []
  let howlTimer = 0
  let crowTimer = 0
  let omenTimer = 0

  const unlock = () => {
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
    if (stormOn) syncStorm()
    else prime()
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)

  function startStorm(ms) {
    stormMs = ms
    stormOn = true
    ambienceOn = false
    stormStart = performance.now()
    wind.currentTime = 0
    wind.volume = 0.58
    wind.play().catch(() => {})
    scheduleBolts(0)
    omenTimer = window.setTimeout(() => {
      if (!stormOn) return
      shot(crow, 0.34, 0.86)
    }, Math.round(ms * 0.46))
  }

  function bookIn() {
    if (!stormOn) return
    fadeWind(0.3, 800, false)
  }

  function finishIntro() {
    stormOn = false
    clearBolts()
    fadeWind(0, 700, true)
    startAmbience()
  }

  function skipIntro() {
    stormOn = false
    windToken += 1
    wind.pause()
    clearBolts()
  }

  function startAmbience() {
    if (ambienceOn) return
    ambienceOn = true
    scheduleHowl(11000 + Math.random() * 8000)
    scheduleCrow(7000 + Math.random() * 7000)
  }

  function scheduleBolts(elapsed) {
    while (boltTimers.length) window.clearTimeout(boltTimers.pop())
    for (const bolt of BOLTS) {
      const at = Math.round(bolt.at * stormMs)
      if (at < elapsed) continue
      const id = window.setTimeout(() => {
        if (!stormOn) return
        shot(thunder, bolt.volume, bolt.rate)
      }, at - elapsed)
      boltTimers.push(id)
    }
  }

  function syncStorm() {
    if (!stormOn) return
    const elapsed = performance.now() - stormStart
    windToken += 1
    wind.currentTime = Math.min(elapsed / 1000, 36)
    wind.volume = elapsed > stormMs ? 0.3 : 0.58
    wind.play().catch(() => {})
    if (elapsed < stormMs * 0.46) {
      window.clearTimeout(omenTimer)
      omenTimer = window.setTimeout(() => {
        if (!stormOn) return
        shot(crow, 0.34, 0.86)
      }, Math.round(stormMs * 0.46) - elapsed)
    }
    if (elapsed < stormMs) scheduleBolts(elapsed)
  }

  function clearBolts() {
    while (boltTimers.length) window.clearTimeout(boltTimers.pop())
    window.clearTimeout(omenTimer)
  }

  function prime() {
    const poke = wind.cloneNode()
    poke.volume = 0
    poke.play().then(() => poke.pause()).catch(() => {})
  }

  function playHowl() {
    if (!ambienceOn || stormOn) return
    window.clearTimeout(howlTimer)
    windToken += 1
    wind.currentTime = Math.random() * 32
    wind.volume = 0.48
    wind.play().catch(() => {})
    const hold = 4600 + Math.random() * 2400
    howlTimer = window.setTimeout(() => {
      fadeWind(0, 600, true)
      scheduleHowl(16000 + Math.random() * 18000)
    }, hold)
  }

  function scheduleHowl(delay) {
    window.clearTimeout(howlTimer)
    howlTimer = window.setTimeout(playHowl, delay)
  }

  function scheduleCrow(delay) {
    window.clearTimeout(crowTimer)
    crowTimer = window.setTimeout(() => {
      if (ambienceOn) shot(crow, 0.46 + Math.random() * 0.28, 0.88 + Math.random() * 0.2)
      if (ambienceOn) scheduleCrow(14000 + Math.random() * 20000)
    }, delay)
  }

  function fadeWind(to, ms, pauseAtEnd) {
    const token = ++windToken
    const from = wind.volume
    const steps = 6
    for (let step = 1; step <= steps; step += 1) {
      window.setTimeout(() => {
        if (token !== windToken) return
        wind.volume = from + (to - from) * (step / steps)
        if (step === steps && pauseAtEnd) wind.pause()
      }, (ms / steps) * step)
    }
  }

  return {
    startStorm,
    bookIn,
    finishIntro,
    skipIntro,
    cover() {
      shot(cover, 0.9, 1)
    },
    page() {
      shot(page, 0.86, 0.96 + Math.random() * 0.1)
    },
  }
}

function track(url) {
  const audio = new Audio(url)
  audio.preload = 'auto'
  return audio
}

function shot(audio, volume, rate) {
  const node = new Audio(audio.currentSrc || audio.src)
  node.volume = volume
  node.playbackRate = rate
  node.play().catch(() => {})
}
