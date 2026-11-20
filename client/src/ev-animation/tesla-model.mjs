import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

const profile = [
  [-2.34, .60, .63, .78], [-2.19, .80, .79, .92], [-1.80, .89, .86, .98],
  [-1.35, .92, .91, 1.02], [-.72, .925, .94, 1.045], [0, .925, .93, 1.04],
  [.65, .915, .89, 1.015], [1.14, .90, .84, .96], [1.65, .88, .76, .87],
  [2.07, .80, .66, .755], [2.31, .64, .54, .65], [2.36, .48, .50, .615],
]
const cabinProfile = [
  [-1.73, .59, 1.005, 1.02], [-1.42, .70, 1.015, 1.19], [-1.05, .735, 1.025, 1.365],
  [-.60, .74, 1.03, 1.465], [-.12, .735, 1.025, 1.475], [.30, .72, 1.015, 1.42],
  [.65, .70, 1.005, 1.235], [1.035, .68, .99, 1.005],
]

function interpolate(rows, x, column) {
  let i = 0
  while (i < rows.length - 2 && rows[i + 1][0] < x) i++
  const a = rows[Math.max(0, i - 1)][column]
  const b = rows[i][column]
  const c = rows[Math.min(rows.length - 1, i + 1)][column]
  const d = rows[Math.min(rows.length - 1, i + 2)][column]
  const t = THREE.MathUtils.clamp((x - rows[i][0]) / (rows[i + 1][0] - rows[i][0]), 0, 1)
  return .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t)
}

function bodySurfaceHeight(x, z) {
  const width = interpolate(profile, x, 1)
  const edge = interpolate(profile, x, 2), crown = interpolate(profile, x, 3)
  const cosine = Math.sqrt(Math.max(0, 1 - Math.pow(z / width, 2)))
  return edge + Math.pow(cosine, .62) * (crown - edge)
}

function cabinSurfaceHeight(x, z) {
  const clampedX = THREE.MathUtils.clamp(x, cabinProfile[0][0], cabinProfile.at(-1)[0])
  const width = interpolate(cabinProfile, clampedX, 1)
  const edge = interpolate(cabinProfile, clampedX, 2), crown = interpolate(cabinProfile, clampedX, 3)
  return crown - Math.pow(Math.min(1, Math.abs(z / width)), 12) * (crown - edge)
}

// Smooth longitudinal sections produce a continuous bonnet/shoulder/fastback,
// rather than a stack of beveled boxes. All dimensions are an authored study.
function loft(rows, lengthSegments = 90, widthSegments = 30, glass = false) {
  const positions = [], indices = [], uvs = []
  const start = rows[0][0], end = rows.at(-1)[0]
  for (let i = 0; i <= lengthSegments; i++) {
    const x = THREE.MathUtils.lerp(start, end, i / lengthSegments)
    const width = interpolate(rows, x, 1)
    const edge = interpolate(rows, x, 2), crown = interpolate(rows, x, 3)
    for (let j = 0; j <= widthSegments; j++) {
      const angle = (j / widthSegments - .5) * Math.PI
      const z = Math.sin(angle) * width
      const y = glass ? crown - Math.pow(Math.abs(Math.sin(angle)), 12) * (crown - edge) : edge + Math.pow(Math.max(0, Math.cos(angle)), .62) * (crown - edge)
      positions.push(x, y, z)
      uvs.push(i / lengthSegments, j / widthSegments)
    }
  }
  for (let i = 0; i < lengthSegments; i++) for (let j = 0; j < widthSegments; j++) {
    const a = i * (widthSegments + 1) + j, b = a + widthSegments + 1
    indices.push(a, a + 1, b, a + 1, b + 1, b)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function mesh(geometry, material, parent, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, material)
  object.position.set(x, y, z)
  parent.add(object)
  return object
}

function rounded(width, height, depth, radius = .035) {
  return new RoundedBoxGeometry(width, height, depth, 3, radius)
}

function curve(points, radius, material, parent, segments = 32) {
  return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point))), segments, radius, 6, false), material, parent)
}

function surfaceRibbon(points, width, material, parent, surface, offset = .005) {
  const spline = new THREE.CatmullRomCurve3(points.map(([x,z]) => new THREE.Vector3(x,0,z)))
  const positions = [], indices = [], segments = 40
  for (let i=0;i<=segments;i++) {
    const t=i/segments, point=spline.getPoint(t), tangent=spline.getTangent(t)
    const normal=new THREE.Vector2(-tangent.z,tangent.x).normalize()
    const half=width*.5*(.35+.65*Math.pow(Math.sin(Math.PI*t),.6))
    for(const side of [-1,1]) {
      const x=point.x+normal.x*half*side, z=point.z+normal.y*half*side
      positions.push(x,surface(x,z)+offset,z)
    }
  }
  for(let i=0;i<segments;i++) {
    const a=i*2,b=a+2
    indices.push(a,a+1,b,a+1,b+1,b)
  }
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
  geometry.setIndex(indices);geometry.computeVertexNormals()
  return mesh(geometry,material,parent)
}

function sidePanel(side) {
  const shape = new THREE.Shape()
  shape.moveTo(-2.31, .28)
  shape.quadraticCurveTo(-2.36, .53, -2.31, .63)
  for (let i = 0; i <= 60; i++) {
    const x = THREE.MathUtils.lerp(-2.31, 2.31, i / 60)
    shape.lineTo(x, interpolate(profile, x, 2) + .005)
  }
  shape.quadraticCurveTo(2.36, .40, 2.23, .23)
  shape.lineTo(1.825, .23)
  shape.lineTo(1.825, .365)
  shape.absarc(1.43, .365, .395, 0, Math.PI, false)
  shape.lineTo(1.035, .23)
  shape.lineTo(-1.035, .23)
  shape.lineTo(-1.035, .365)
  shape.absarc(-1.43, .365, .395, 0, Math.PI, false)
  shape.lineTo(-1.825, .23)
  shape.lineTo(-2.22, .23)
  shape.quadraticCurveTo(-2.29, .24, -2.31, .28)
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .025, bevelEnabled: true, bevelSize: .018, bevelThickness: .015, bevelSegments: 3, curveSegments: 20, steps: 1 })
  const position = geometry.getAttribute('position')
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const width = interpolate(profile, THREE.MathUtils.clamp(x, -2.34, 2.36), 1)
    position.setZ(i, side * (width - .025 + position.getZ(i)))
  }
  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

function wordTexture(word, color = '#39433f') {
  const canvas = document.createElement('canvas')
  canvas.width = 512; canvas.height = 96
  const context = canvas.getContext('2d')
  if (!context) return null
  context.fillStyle = color
  context.textAlign = 'center'; context.textBaseline = 'middle'
  context.font = '500 56px "DM Sans", sans-serif'
  context.fillText(word, 256, 51)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// The pillars are part of the canopy's own material. A UV paint mask avoids
// near-coplanar white overlays and remains clean at every view/scroll angle.
function canopyMaterial() {
  const colorCanvas = document.createElement('canvas')
  const roughCanvas = document.createElement('canvas')
  colorCanvas.width = roughCanvas.width = 1024
  colorCanvas.height = roughCanvas.height = 512
  const color = colorCanvas.getContext('2d'), rough = roughCanvas.getContext('2d')
  if (!color || !rough) return new THREE.MeshPhysicalMaterial({color:'#16201d',metalness:.18,roughness:.1,clearcoat:1,transparent:true,side:THREE.DoubleSide})
  color.fillStyle='#101c1c';color.fillRect(0,0,1024,512)
  rough.fillStyle='#191919';rough.fillRect(0,0,1024,512)
  const toUV = (x,z) => {
    const clampedX=THREE.MathUtils.clamp(x,cabinProfile[0][0],cabinProfile.at(-1)[0])
    const width=interpolate(cabinProfile,clampedX,1)
    return [
      (clampedX-cabinProfile[0][0])/(cabinProfile.at(-1)[0]-cabinProfile[0][0])*1024,
      (1-(Math.asin(THREE.MathUtils.clamp(z/width,-1,1))/Math.PI+.5))*512,
    ]
  }
  const paintBand=(points,width,ink,roughness)=>{
    const spline=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z)))
    const edges=[[],[]]
    for(let i=0;i<=64;i++){
      const t=i/64,point=spline.getPoint(t),tangent=spline.getTangent(t)
      const normal=new THREE.Vector2(-tangent.z,tangent.x).normalize()
      const half=width*.5*(.55+.45*Math.pow(Math.sin(Math.PI*t),.6))
      for(let side=0;side<2;side++){
        const sign=side?1:-1
        edges[side].push(toUV(point.x+normal.x*half*sign,point.z+normal.y*half*sign))
      }
    }
    const polygon=[...edges[0],...edges[1].reverse()]
    for(const [context,fill] of [[color,ink],[rough,roughness]]){
      context.beginPath();context.moveTo(...polygon[0])
      for(const point of polygon.slice(1))context.lineTo(...point)
      context.closePath();context.fillStyle=fill;context.fill()
    }
  }
  for(const side of [-1,1]){
    paintBand([[.28,side*.57],[.65,side*.65],[1.025,side*.675]],.062,'#eef1ed','#454545')
    paintBand([[-1.68,side*.575],[-1.26,side*.66],[-.88,side*.625]],.085,'#eef1ed','#454545')
    paintBand([[-.27,side*.735],[-.27,side*.68],[-.27,side*.60]],.046,'#090f0d','#303030')
  }
  const map=new THREE.CanvasTexture(colorCanvas),roughnessMap=new THREE.CanvasTexture(roughCanvas)
  map.colorSpace=THREE.SRGBColorSpace
  map.anisotropy=roughnessMap.anisotropy=4
  return new THREE.MeshPhysicalMaterial({map,roughnessMap,color:'#ffffff',metalness:.18,roughness:1,clearcoat:1,clearcoatRoughness:.05,envMapIntensity:1.3,transparent:true,side:THREE.DoubleSide})
}

function makeWheel(parent, x, side, materials) {
  const wheel = new THREE.Group()
  wheel.position.set(x, .365, side * .905)
  parent.add(wheel)
  mesh(new THREE.TorusGeometry(.268, .088, 14, 64), materials.tire, wheel)
  const barrel = mesh(new THREE.CylinderGeometry(.265, .265, .16, 48), materials.rim, wheel)
  barrel.rotation.x = Math.PI / 2
  const brake = mesh(new THREE.CylinderGeometry(.235, .235, .018, 40), materials.brake, wheel, 0, 0, side * .035)
  brake.rotation.x = Math.PI / 2
  mesh(rounded(.065, .17, .055, .02), materials.caliper, wheel, .17, 0, side * .063)
  const face = mesh(new THREE.CylinderGeometry(.225, .25, .022, 48), materials.aero, wheel, 0, 0, side * .095)
  face.rotation.x = Math.PI / 2
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 2 / 5 + .1
    const spoke = mesh(rounded(.068, .21, .024, .012), materials.spoke, wheel, Math.sin(angle) * .1, Math.cos(angle) * .1, side * .114)
    spoke.rotation.z = -angle - .13
  }
  const hub = mesh(new THREE.CylinderGeometry(.066, .066, .025, 32), materials.rim, wheel, 0, 0, side * .129)
  hub.rotation.x = Math.PI / 2
  const ring = mesh(new THREE.TorusGeometry(.251, .007, 6, 64), materials.rimLip, wheel, 0, 0, side * .11)
  ring.rotation.z = .04
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 2 / 5
    const bolt = mesh(new THREE.SphereGeometry(.009, 8, 6), materials.rimLip, wheel, Math.sin(angle) * .044, Math.cos(angle) * .044, side * .145)
    bolt.scale.z = .4
  }
  return wheel
}

function makeShadow() {
  const canvas = document.createElement('canvas')
  canvas.width = 256; canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const gradient = ctx.createRadialGradient(128, 64, 5, 128, 64, 64)
  gradient.addColorStop(0, 'rgba(17,35,27,.34)')
  gradient.addColorStop(.45, 'rgba(17,35,27,.19)')
  gradient.addColorStop(1, 'rgba(17,35,27,0)')
  ctx.save(); ctx.translate(128, 64); ctx.scale(2, 1); ctx.translate(-128, -64)
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 128); ctx.restore()
  const texture = new THREE.CanvasTexture(canvas)
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(6.1, 3), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, opacity: .72 }))
  plane.rotation.x = -Math.PI / 2
  plane.position.y = -.025
  return plane
}

export function createTeslaModel() {
  const group = new THREE.Group(), body = new THREE.Group(), chassis = new THREE.Group()
  body.name = 'Model 3 body'; chassis.name = 'Electric skateboard'
  group.add(chassis, body)
  const paint = new THREE.MeshPhysicalMaterial({ color: '#eef1ed', metalness: .13, roughness: .27, clearcoat: 1, clearcoatRoughness: .08, envMapIntensity: 1, transparent: true, side: THREE.DoubleSide })
  const glass = new THREE.MeshPhysicalMaterial({ color: '#101c1c', metalness: .26, roughness: .085, clearcoat: 1, clearcoatRoughness: .04, envMapIntensity: 1.4, transparent: true, side: THREE.DoubleSide })
  const trim = new THREE.MeshStandardMaterial({ color: '#101714', roughness: .25, metalness: .6, transparent: true })
  const seam = new THREE.MeshStandardMaterial({ color: '#8b9690', roughness: .5, metalness: .3, transparent: true })
  const lamp = new THREE.MeshStandardMaterial({ color: '#f6ffff', emissive: '#d7f3ff', emissiveIntensity: 1.25, metalness: .2, roughness: .16, transparent: true })
  const red = new THREE.MeshStandardMaterial({ color: '#911c18', emissive: '#e53022', emissiveIntensity: .6, roughness: .2, transparent: true })
  const black = new THREE.MeshStandardMaterial({ color: '#17231e', roughness: .62, metalness: .35 })
  const metal = new THREE.MeshStandardMaterial({ color: '#6f8379', roughness: .3, metalness: .8 })
  mesh(loft(profile), paint, body)
  mesh(sidePanel(1), paint, body)
  mesh(sidePanel(-1), paint, body)
  mesh(loft(cabinProfile, 100, 48, true), canopyMaterial(), body)

  // Sealed, rounded nose and short rear deck; no combustion-car grille.
  mesh(rounded(.30, .38, 1.26, .11), paint, body, 2.23, .42, 0)
  mesh(rounded(.26, .38, 1.42, .105), paint, body, -2.21, .43, 0)
  mesh(rounded(3.45, .035, 1.60, .015), black, chassis, 0, .325, 0)

  for (const side of [-1, 1]) {
    // The long glass roof, tapered side lights and fastback C pillars are the
    // identifying proportions of the Model 3 study, not a generic SUV cabin.
    // Pillar bands are painted into the shared canopy material above.
    const lowerWindow=[]
    for(let i=0;i<=32;i++) {
      const x=THREE.MathUtils.lerp(-1.65,1.025,i/32)
      const z=side*interpolate(cabinProfile,x,1)*.999
      lowerWindow.push([x,cabinSurfaceHeight(x,z)+.005,z])
    }
    curve(lowerWindow,.011,trim,body,40)
    for (const x of [-.76,.26]) mesh(rounded(.155,.017,.021,.008), trim, body, x, .92, side * (interpolate(profile,x,1) + .005))
    for (const x of [-.72,.67]) curve([[x,.94,side*.934],[x+.025,.63,side*.934],[x+.06,.275,side*.928]], .0037, seam, body, 14)
    curve([[-1.0,.265,side*.927],[0,.255,side*.939],[.99,.265,side*.917]], .005, seam, body)
    const mirror = mesh(new THREE.SphereGeometry(1, 20, 12), paint, body, .72, 1.025, side * .96)
    mirror.scale.set(.135,.048,.074)
    curve([[.72,1.0,side*.79],[.69,.99,side*.95]], .019, trim, body, 8)
    const mirrorGlass = mesh(new THREE.SphereGeometry(1, 16, 10), glass, body, .685, 1.027, side * 1.006)
    mirrorGlass.scale.set(.084,.029,.012)
    // Modern Highland lamps sweep around the front corners.
    const frontPoints = [[2.145,side*.32],[2.16,side*.53],[2.115,side*.69],[2.015,side*.77]]
    surfaceRibbon(frontPoints,.054,trim,body,bodySurfaceHeight,.006)
    surfaceRibbon(frontPoints,.008,lamp,body,bodySurfaceHeight,.013)
    curve([[-2.19,.815,side*.77],[-2.33,.765,side*.63],[-2.345,.76,side*.43]], .032, trim, body, 20)
    curve([[-2.20,.822,side*.77],[-2.34,.772,side*.63],[-2.353,.767,side*.43]], .013, red, body, 20)
    surfaceRibbon([[1.03,side*.55],[1.45,side*.57],[1.96,side*.48]],.006,seam,body,bodySurfaceHeight,.003)
    for (const x of [-1.43,1.43]) {
      const arch = mesh(new THREE.TorusGeometry(.395,.013,6,48,Math.PI), paint, body, x,.365,side*.91)
      arch.scale.z = .7
    }
  }

  const badgeTexture = wordTexture('T E S L A')
  if (badgeTexture) {
    const badge = mesh(new THREE.PlaneGeometry(.46,.086), new THREE.MeshBasicMaterial({ map: badgeTexture, transparent: true, depthWrite: false, side: THREE.DoubleSide }), body, -2.355, .677, 0)
    badge.rotation.y = -Math.PI / 2
  }
  // A simple typographic hood badge intentionally avoids inventing a Tesla T.
  const hoodTexture = wordTexture('TESLA', '#5f6d65')
  if (hoodTexture) {
    const badge = mesh(new THREE.PlaneGeometry(.15,.029), new THREE.MeshBasicMaterial({ map: hoodTexture, transparent: true, depthWrite: false, side: THREE.DoubleSide }), body, 2.02, .775, 0)
    badge.rotation.x = -Math.PI/2; badge.rotation.z = -Math.PI/2
  }

  const wheelMaterials = {
    tire: new THREE.MeshStandardMaterial({color:'#111713',roughness:.86,metalness:.04}),
    rim: new THREE.MeshStandardMaterial({color:'#29312d',roughness:.27,metalness:.8}),
    aero: new THREE.MeshStandardMaterial({color:'#19231f',roughness:.36,metalness:.55}),
    spoke: new THREE.MeshStandardMaterial({color:'#36413b',roughness:.26,metalness:.8}),
    rimLip: new THREE.MeshStandardMaterial({color:'#64716a',roughness:.22,metalness:.95}),
    brake: new THREE.MeshStandardMaterial({color:'#59625c',roughness:.55,metalness:.8}),
    caliper: new THREE.MeshStandardMaterial({color:'#993e2c',roughness:.35,metalness:.55}),
  }
  for (const x of [-1.43,1.43]) {
    for (const side of [-1,1]) makeWheel(chassis,x,side,wheelMaterials)
    mesh(rounded(.10,.10,1.70,.035), metal, chassis,x,.30,0)
    mesh(rounded(.36,.19,.50,.08), black, chassis,x,.30,0)
  }

  const pack = new THREE.Group(); pack.name = 'Illustrative traction battery'; group.add(pack)
  const packMetal = new THREE.MeshStandardMaterial({color:'#aab8ae',metalness:.72,roughness:.32})
  const packDark = new THREE.MeshStandardMaterial({color:'#4b6255',metalness:.7,roughness:.34})
  const copper = new THREE.MeshStandardMaterial({color:'#dd7b2b',metalness:.52,roughness:.31})
  const cellMetal = new THREE.MeshStandardMaterial({color:'#a7b8b0',metalness:.86,roughness:.24})
  const cellCap = new THREE.MeshStandardMaterial({color:'#d3bd86',metalness:.8,roughness:.3})
  const cooling = new THREE.Group(); cooling.name = 'Liquid cooling plate'; pack.add(cooling)
  mesh(rounded(2.73,.035,1.43,.03), new THREE.MeshStandardMaterial({color:'#7ca6a6',metalness:.65,roughness:.28}),cooling,0,.155,0)
  const coolant = new THREE.MeshStandardMaterial({color:'#386b75',metalness:.5,roughness:.32})
  for (let i=0;i<9;i++) curve([[-1.21,.179,-.58+i*.145],[-.6,.18,-.58+i*.145],[.6,.18,-.58+i*.145],[1.21,.179,-.58+i*.145]],.007,coolant,cooling,10)
  for (const z of [-.28,-.12]) curve([[-1.34,.17,z],[-1.49,.17,z],[-1.53,.17,z-.08]],.018,coolant,cooling,8)
  mesh(rounded(2.7,.08,1.42,.035),packMetal,pack,0,.245,0)
  mesh(rounded(2.60,.034,1.31,.02),packDark,pack,0,.29,0)
  // Four long module groups and repeated cylindrical cells express cell-level
  // construction. This is an educational study, not a Tesla production CAD pack.
  const modules = [], cells = []
  const cylinder = new THREE.CylinderGeometry(.035,.035,.105,12)
  const capGeometry = new THREE.CylinderGeometry(.026,.026,.005,10)
  for (let i=0;i<4;i++) {
    const module = new THREE.Group(); const x = -.975+i*.65
    module.position.set(x,.31,0); module.userData.baseX=x; module.userData.direction=i-1.5
    pack.add(module); modules.push(module)
    mesh(rounded(.59,.06,1.19,.02),packMetal,module,0,0,0)
    mesh(rounded(.54,.012,1.14,.006),packDark,module,0,.036,0)
    const cellGroup = new THREE.Group(); cellGroup.position.y=.038; module.add(cellGroup); cells.push(cellGroup)
    const barrels=new THREE.InstancedMesh(cylinder,cellMetal,60)
    const caps=new THREE.InstancedMesh(capGeometry,cellCap,60)
    const matrix=new THREE.Matrix4()
    for (let row=0;row<12;row++) for(let column=0;column<5;column++) {
      const cx=-.208+column*.104, cz=-.51+row*.0927,index=row*5+column
      matrix.makeTranslation(cx,.053,cz);barrels.setMatrixAt(index,matrix)
      matrix.makeTranslation(cx,.109,cz);caps.setMatrixAt(index,matrix)
    }
    barrels.instanceMatrix.needsUpdate=true;caps.instanceMatrix.needsUpdate=true
    cellGroup.add(barrels,caps)
    for(const z of [-.60,.60]) mesh(rounded(.54,.012,.024,.006),copper,module,0,.055,z)
  }
  for (const z of [-.665,.665]) curve([[-1.20,.325,z],[0,.325,z],[1.22,.325,z]],.017,copper,pack,20)
  const electronics = new THREE.Group(); electronics.position.set(1.60,.27,0); pack.add(electronics)
  mesh(rounded(.38,.12,.75,.035),packMetal,electronics)
  for(let i=0;i<8;i++) mesh(rounded(.25,.025,.018,.004),packDark,electronics,0,.073,-.27+i*.077)
  for(const z of [-.20,.20]) curve([[1.29,.33,z],[1.41,.35,z],[1.44,.32,z]],.025,copper,pack,10)
  const cover = new THREE.Group(); cover.position.y=.44; cover.name='Battery cover'; pack.add(cover)
  mesh(rounded(2.72,.045,1.44,.04),packMetal,cover)
  mesh(rounded(2.56,.006,1.28,.025),new THREE.MeshStandardMaterial({color:'#cbd4ca',metalness:.65,roughness:.28}),cover,0,.026,0)
  for(let i=0;i<11;i++) mesh(rounded(.012,.008,1.20,.003),packMetal,cover,-1.15+i*.23,.032,0)
  for(const x of [-1.27,1.27]) for(const z of [-.63,.63]) mesh(new THREE.CylinderGeometry(.017,.017,.008,8),metal,cover,x,.03,z)
  const shadow=makeShadow(); if(shadow) group.add(shadow)
  // Shared metal, trim and cell materials must not carry opacity between layers.
  // Clone once per layer, preserving instancing and sharing within that layer.
  for(const [layer,parts] of Object.entries({body:[body],chassis:[chassis],pack:[pack,electronics],cover:[cover],modules,cells,cooling:[cooling]})) {
    parts.forEach(part=>{part.userData.evLayer=layer})
  }
  const layerMaterials = Object.fromEntries(['body','chassis','pack','cover','modules','cells','cooling'].map(layer=>[layer,new Set()]))
  const clones = new Map()
  group.traverse(object=>{
    if(!object.isMesh || object===shadow) return
    let owner=object
    while(owner && !owner.userData.evLayer) owner=owner.parent
    const layer=owner?.userData.evLayer
    if(!layer) return
    const cloneForLayer = original => {
      if(!clones.has(layer)) clones.set(layer,new Map())
      const cache=clones.get(layer)
      if(!cache.has(original)) {
        const material=original.clone()
        material.transparent=true
        material.userData.opaqueDepthWrite=original.depthWrite
        cache.set(original,material)
        layerMaterials[layer].add(material)
      }
      return cache.get(original)
    }
    object.material=Array.isArray(object.material)?object.material.map(cloneForLayer):cloneForLayer(object.material)
    object.userData.evLayer=layer
  })
  const bodyMaterials=layerMaterials.body
  return {group,body,chassis,pack,cover,modules,cells,cooling,electronics,shadow,bodyMaterials,layerMaterials}
}

export function poseTeslaModel(model, values) {
  model.currentPose = values
  const lift=values.bodyLift/100, drop=values.batteryDrop/100, lid=values.coverLift/100
  const spread=values.moduleSpread/100, cellLift=values.cellSpread/100
  model.body.position.y=lift
  model.pack.position.y=-drop
  model.cover.position.set(-lid*1.25,.44+lid,-lid*1.2)
  model.cooling.position.y=-spread*.45
  model.modules.forEach((module,i)=>{
    module.position.set(module.userData.baseX+module.userData.direction*spread*.38,.31+spread*.35,(i%2?1:-1)*spread*.10)
  })
  model.cells.forEach((cells,i)=>{cells.position.y=.038+cellLift*(1+i*.055)})
  model.electronics.position.x=1.60+spread*.35
  model.group.rotation.y=-.10+THREE.MathUtils.degToRad(values.turn)
  model.group.rotation.z=THREE.MathUtils.degToRad(values.viewTilt)*.035
  const fades={body:values.bodyFade,chassis:values.chassisFade,pack:values.packFade,cover:values.coverFade,modules:values.moduleFade,cells:values.cellFade,cooling:values.coolingFade}
  if(model.layerMaterials) {
    for(const [layer,materials] of Object.entries(model.layerMaterials)) {
      const opacity=Number.isFinite(fades[layer])?fades[layer]:1
      for(const material of materials) {
        material.opacity=opacity
        material.depthWrite=opacity>.99 && material.userData.opaqueDepthWrite!==false
      }
    }
    // Ghosts render first without depth writes; the active parts remain clear
    // even when a lifted cover crosses them during the 180-degree rotation.
    model.group.traverse(object=>{if(object.isMesh && object.userData.evLayer) object.renderOrder=(fades[object.userData.evLayer]??1)>.5?2:1})
  } else for(const material of model.bodyMaterials){
    material.opacity=values.bodyFade
    material.depthWrite=values.bodyFade>.99
  }
  if(model.shadow){model.shadow.position.y=-.025-drop-spread*.45;model.shadow.material.opacity=.72-values.progress*.15}
}
