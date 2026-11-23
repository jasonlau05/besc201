import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import VehicleAssembly from './VehicleAssembly'
import TeslaLoading from './TeslaLoading'
import { createTeslaModel, poseTeslaModel } from './tesla-model.mjs'
import { fitTeslaCamera } from './tesla-framing.mjs'
import './TeslaScene.css'

export default function TeslaScene({ interactive = false, className = '' }) {
  const hostRef = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    const journey = interactive ? host.closest('[data-ev-journey]') : null
    host.dataset.renderer = 'loading'
    delete host.dataset.fallbackReason
    let renderer, environment, pmrem, resizeObserver, poseObserver, intersectionObserver
    let frame = 0, disposed = false, lost = false, forceRender = true
    let renderCount = 0, previousPose = ''
    let bufferWidth = 0, bufferHeight = 0, bufferRatio = 0
    let isIntersecting = true
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-3, 3, 2, -2, .1, 70)
    const model = createTeslaModel()
    scene.add(model.group)

    const isVisible = () => isIntersecting && (typeof document === 'undefined' || !document.hidden)

    const setFallback = () => {
      host.dataset.renderer = 'fallback'
      host.dataset.fallbackReason = lost ? 'context-lost' : 'webgl-unavailable'
    }
    const read = () => {
      const style = journey ? getComputedStyle(journey) : null
      const number = (name, fallback) => {
        const value = style ? Number.parseFloat(style.getPropertyValue(name)) : NaN
        return Number.isFinite(value) ? value : fallback
      }
      return {
        progress: number('--ev-progress', 0),
        bodyLift: number('--ev-body-lift', 0), bodyFade: number('--ev-body-fade', 1),
        chassisFade: number('--ev-chassis-fade', .12), packFade: number('--ev-pack-fade', 1),
        coverFade: number('--ev-cover-fade', 1), moduleFade: number('--ev-module-fade', 1),
        cellFade: number('--ev-cell-fade', 1), coolingFade: number('--ev-cooling-fade', 1),
        batteryDrop: number('--ev-battery-drop', 0), coverLift: number('--ev-cover-lift', 0),
        moduleSpread: number('--ev-module-spread', 0), cellSpread: number('--ev-cell-spread', 0),
        turn: number('--ev-turn', 0), viewTilt: number('--ev-view-tilt', 0),
      }
    }
    const render = () => {
      frame = 0
      if (disposed || lost || !renderer || !isVisible()) return
      const bounds = host.getBoundingClientRect()
      const width = Math.max(1, Math.round(bounds.width)), height = Math.max(1, Math.round(bounds.height))
      const values = read()
      const signature = JSON.stringify([values, width, height])
      if (!forceRender && signature === previousPose) return
      forceRender = false
      previousPose = signature
      poseTeslaModel(model, values)

      const aspect = width / height
      const batteryFocus = window.matchMedia('(min-width: 761px)').matches ? 1 - Math.min(1, Math.max(0, (values.bodyFade - .08) / .92)) : 0
      const framing = fitTeslaCamera(camera, model, aspect, batteryFocus)
      const maxDpr = Math.min(typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1, 2)
      const ratio = Math.min(maxDpr, width < 600 ? 1.25 : 1.5, Math.sqrt(1800000 / (width * height)))
      if (width !== bufferWidth || height !== bufferHeight || ratio !== bufferRatio) {
        renderer.setDrawingBufferSize(width, height, ratio)
        bufferWidth = width; bufferHeight = height; bufferRatio = ratio
      }
      try {
        renderer.render(scene, camera)
      } catch {
        lost = true
        if (frame) {
          cancelAnimationFrame(frame)
          frame = 0
        }
        setFallback()
        return
      }
      renderCount++
      host.dataset.renderer = 'webgl'
      delete host.dataset.fallbackReason
      host.dataset.progress = values.progress.toFixed(4)
      host.dataset.rotationY = String(model.group.rotation.y)
      host.dataset.bodyY = model.body.position.y.toFixed(4)
      host.dataset.coverY = model.cover.position.y.toFixed(4)
      host.dataset.moduleSpread = (model.modules[3].position.x - model.modules[3].userData.baseX).toFixed(4)
      host.dataset.cellSpread = (model.cells[0].position.y - .038).toFixed(4)
      host.dataset.renderCount = String(renderCount)
      host.dataset.triangles = String(renderer.info.render.triangles)
      host.dataset.framing = JSON.stringify(framing)
      host.dataset.layerOpacity = JSON.stringify(Object.fromEntries(Object.entries(model.layerMaterials || {}).map(([name, materials]) => [name, [...materials][0]?.opacity])))
      host.dataset.pose = JSON.stringify({ body: model.body.position.toArray(), battery: model.pack.position.toArray(), cover: model.cover.position.toArray(), modules: model.modules.map(part => part.position.toArray()), cells: model.cells.map(part => part.position.toArray()) })
    }
    const schedule = () => {
      if (!frame && !disposed && !lost && isVisible()) frame = requestAnimationFrame(render)
    }
    const onResize = () => { forceRender = true; schedule() }
    const onContextLost = event => {
      event.preventDefault()
      lost = true
      if (frame) {
        cancelAnimationFrame(frame)
        frame = 0
      }
      setFallback()
    }
    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        if (frame) {
          cancelAnimationFrame(frame)
          frame = 0
        }
      } else if (isIntersecting) {
        forceRender = true
        schedule()
      }
    }
    canvas.addEventListener('webglcontextlost', onContextLost, false)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange)
    }
    if (typeof IntersectionObserver !== 'undefined') {
      intersectionObserver = new IntersectionObserver(([entry]) => {
        const inView = entry ? entry.isIntersecting : true
        if (inView === isIntersecting) return
        isIntersecting = inView
        if (!isIntersecting) {
          if (frame) {
            cancelAnimationFrame(frame)
            frame = 0
          }
        } else if (typeof document === 'undefined' || !document.hidden) {
          forceRender = true
          schedule()
        }
      })
      intersectionObserver.observe(host)
    }
    try {
      const context = canvas.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'low-power', preserveDrawingBuffer: false })
      if (context && !context.isContextLost?.()) {
        renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true, powerPreference: 'low-power' })
        const maxDpr = Math.min(typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1, 2)
        renderer.setPixelRatio(maxDpr)
        renderer.setClearColor(0x000000, 0)
        renderer.outputColorSpace = THREE.SRGBColorSpace
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = .92
        const room = new RoomEnvironment()
        pmrem = new THREE.PMREMGenerator(renderer)
        environment = pmrem.fromScene(room, .06)
        scene.environment = environment.texture
        room.dispose()
        scene.add(new THREE.HemisphereLight(0xffffff, 0xa5b997, 1.1))
        const key = new THREE.DirectionalLight(0xfffbef, 2.3)
        key.position.set(3, 6, 4); scene.add(key)
        const rim = new THREE.DirectionalLight(0xd9edff, 1.5)
        rim.position.set(-4, 3, -3); scene.add(rim)
        resizeObserver = new ResizeObserver(onResize)
        resizeObserver.observe(host)
        if (journey) {
          poseObserver = new MutationObserver(schedule)
          poseObserver.observe(journey, { attributes: true, attributeFilter: ['style'] })
        }
        schedule()
      } else setFallback()
    } catch {
      setFallback()
    }

    return () => {
      disposed = true
      if (frame) {
        cancelAnimationFrame(frame)
        frame = 0
      }
      resizeObserver?.disconnect()
      poseObserver?.disconnect()
      intersectionObserver?.disconnect()
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange)
      }
      canvas.removeEventListener('webglcontextlost', onContextLost, false)
      const geometries = new Set(), materials = new Set(), textures = new Set()
      scene.traverse(object => {
        if (object.isInstancedMesh) object.dispose()
        if (object.geometry) geometries.add(object.geometry)
        if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material)
          for (const value of Object.values(material)) if (value?.isTexture) textures.add(value)
        }
      })
      geometries.forEach(geometry => geometry.dispose())
      materials.forEach(material => material.dispose())
      textures.forEach(texture => texture.dispose())
      environment?.dispose()
      pmrem?.dispose()
      renderer?.dispose()
      host.dataset.renderer = 'loading'
    }
  }, [interactive])

  return <div ref={hostRef} className={`tesla-scene ${className}`} data-car="Tesla Model 3" data-renderer="loading" data-interactive={interactive || undefined}>
    <div className="tesla-scene-loading"><TeslaLoading /></div>
    <div className="tesla-scene-fallback" aria-hidden="true"><VehicleAssembly /></div>
    <canvas ref={canvasRef} className="tesla-scene-canvas" aria-hidden="true" />
  </div>
}
