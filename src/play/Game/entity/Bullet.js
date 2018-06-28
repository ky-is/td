import { CircleBufferGeometry, SphereBufferGeometry, Mesh, MeshBasicMaterial } from 'three'

import local from '@/xjs/local'
import store from '@/xjs/store'

import render from '@/play/render'

import towers from '@/play/data/towers'

import gameMath from '@/play/Game/math'

import Creep from '@/play/Game/entity/Unit/Creep'

//LOCAL

const COLLISION_DISTANCE = 300

let allBullets = []
let allSplashes = []

const bulletsCache = {}
const rangesCache = {}
const splashesCache = {}
for (const name in towers) {
	if (name === 'names') {
		continue
	}
	const towerData = towers[name]
	const geometry = new SphereBufferGeometry(towerData.bulletSize || 4)
	const material = new MeshBasicMaterial({ color: towerData.color })
	bulletsCache[name] = [ geometry, material ]

	const splashMaterial = new MeshBasicMaterial({ color: towerData.color })
	splashMaterial.transparent = true
	splashMaterial.opacity = 0.3
	splashesCache[name] = splashMaterial

	const ranges = towerData.radius
	if (ranges) {
		let range = 0
		for (const diff of ranges) {
			if (diff) {
				range += diff
				if (!rangesCache[range]) {
					rangesCache[range] = new CircleBufferGeometry(range * 2, range * 2)
				}
			}
		}
	}
}

class Bullet {

	// Constructor

	constructor (source, target, data, parent, initialDistance) {
		const startAngle = null //TODO source.top.rotation.z
		this.unitTarget = target.stats !== undefined
		this.name = source.name

		this.explosionRadius = data.explosionRadius
		this.slow = data.slow

		this.container = render.group(parent)
		const cached = bulletsCache[source.name]
		const ball = new Mesh(cached[0], cached[1])
		this.container.add(ball)

		this.attackDamage = data.attackDamage
		target.healthScheduled -= data.attackDamage
		this.moveConstant = data.bulletSpeed / local.game.tickDuration
		if (data.bulletAcceleration) {
			this.moveAcceleration = 0.00000005
			this.startTime = store.state.game.renderTime
		}

		this.cX = source.cX
		this.cY = source.cY
		this.container.position.set(this.cX, this.cY, source.height || 10)
		if (startAngle) {
			this.container.rotation.z = startAngle
		}
		this.target = target
		this.updateTarget(true)
		if (initialDistance) {
			this.cX += Math.floor(Math.cos(this.moveAngle) * initialDistance)
			this.cY += Math.floor(Math.sin(this.moveAngle) * initialDistance)
			this.updatePosition()
		}

		allBullets.push(this)
	}

	// Move

	setDestination (x, y) {
		const dx = x - this.cX
		const dy = y - this.cY
		let moveX, moveY
		const moveAngle = Math.atan2(dy, dx)
		this.moveAngle = moveAngle
		moveX = Math.cos(moveAngle)
		moveY = Math.sin(moveAngle)
		this.container.rotation.z = moveAngle
		this.moveX = moveX
		this.moveY = moveY
		this.destX = x
		this.destY = y
	}

	updatePosition (moveToX, moveToY) {
		if (!moveToX) {
			moveToX = this.cX
			moveToY = this.cY
		}
		this.container.position.x = moveToX
		this.container.position.y = moveToY
	}

	reachedDestination () {
		const damage = this.attackDamage
		const targetAlive = !this.target.dead
		if (this.explosionRadius) {
			const area = new Mesh(rangesCache[this.explosionRadius], splashesCache[this.name].clone())
			const aX = this.target.cX
			const aY = this.target.cY
			area.position.x = aX
			area.position.y = aY
			this.container.parent.add(area)
			allSplashes.push(area)
			const radiusCheck = gameMath.checkRadius(this.explosionRadius)
			for (const creep of Creep.all()) {
				if (creep.distanceTo(aX, aY) <= radiusCheck) {
					creep.takeDamage(damage, creep !== this.target)
					//TODO slow
				}
			}
		} else if (targetAlive) {
			this.target.takeDamage(damage, false)
		}

		this.remove = true
	}

	move (renderTime, timeDelta, tweening) {
		let fromX, fromY
		let moveByX, moveByY
		if (tweening) {
			fromX = this.container.position.x
			fromY = this.container.position.y

			const tweenScalar = this.currentSpeed * timeDelta
			moveByX = tweenScalar * this.moveX
			moveByY = tweenScalar * this.moveY
		} else {
			fromX = this.cX
			fromY = this.cY

			// Cache
			let speed = this.moveConstant
			if (this.moveAcceleration) {
				const timeElapsed = Math.min(3000, renderTime - this.startTime)
				speed += this.moveAcceleration * timeElapsed * timeElapsed
			}
			this.currentSpeed = speed
			const moveScalar = speed * timeDelta
			moveByX = Math.round(moveScalar * this.moveX)
			moveByY = Math.round(moveScalar * this.moveY)
		}

		let movingToX = fromX + moveByX
		let movingToY = fromY + moveByY
		if (tweening) {
			this.updatePosition(movingToX, movingToY)
		} else {
			let reachedApproximate = false
			const distX = this.destX - movingToX
			const distY = this.destY - movingToY
			if (Math.abs(distX) < COLLISION_DISTANCE && Math.abs(distY) < COLLISION_DISTANCE) {
				reachedApproximate = gameMath.pointDistance(movingToX, movingToY, this.destX, this.destY) <= COLLISION_DISTANCE
			}
			if (reachedApproximate) {
				this.reachedDestination(renderTime)
			} else {
				this.cX = movingToX
				this.cY = movingToY
				this.updatePosition(movingToX, movingToY)
			}
		}
	}

	updateTarget (force) {
		const targ = this.target
		if (!force && targ.dead) {
			this.unitTarget = false
			return
		}
		this.setDestination(targ.cX, targ.cY)
	}

}

//STATIC

Bullet.destroy = function () {
	allBullets = []
	allSplashes = []
}

Bullet.update = function (renderTime, timeDelta, tweening) {
	if (!tweening) {
		for (let idx = allBullets.length - 1; idx >= 0; idx -= 1) {
			const bullet = allBullets[idx]
			if (bullet.remove) {
				allBullets.splice(idx, 1)
				render.remove(bullet.container)
			} else {
				bullet.updateTarget(false)
			}
		}
	}

	for (const bullet of allBullets) {
		bullet.move(renderTime, timeDelta, tweening)
		if (bullet.updateAnimations) {
			bullet.updateAnimations(renderTime)
		}
	}

	const splashFade = timeDelta / 1000
	for (let idx = allSplashes.length - 1; idx >= 0; idx -= 1) {
		const splash = allSplashes[idx]
		if (splash.opacity < splashFade) {
			allBullets.splice(idx, 1)
			render.remove(splash.container)
		} else {
			splash.material.opacity -= splashFade
		}
	}
}

export default Bullet
