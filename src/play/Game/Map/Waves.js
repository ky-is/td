import creeps from '@/play/data/creeps'

import Creep from '@/play/Game/entity/Unit/Creep'

import bridge from '@/xjs/bridge'
import random from '@/xjs/random'
import store from '@/xjs/store'

const CREEP_TYPE_COUNT = creeps.length

export default class Waves {

	constructor (spawnPoints) {
		Creep.init()
		this.spawning = []
		this.count = 0
		this.spawnPoints = spawnPoints
		this.waveStart = 0
		this.creepCount = 0
	}

	spawn (renderTime) {
		const waveNumber = this.count + 1
		store.state.game.wave = waveNumber
		this.count = waveNumber
		const waveIndex = waveNumber - 1
		let creepIndex = waveIndex % CREEP_TYPE_COUNT
		if (waveIndex < 20 && creepIndex === 4) {
			creepIndex = 0
		}
		const data = creeps[creepIndex]
		const health = Math.round(data.health + 1.3 * waveIndex + Math.pow(0.55 * waveIndex, 2))
		const waveSize = data.count
		const gold = Math.ceil(waveNumber / CREEP_TYPE_COUNT * 10 / waveSize)
		const waveCount = waveSize * 2
		store.state.game.waveCreepCount = waveCount
		this.creepCount += waveCount
		this.waveStart = renderTime

		this.spawning.push({
			index: 0,
			startAt: renderTime,
			health: health,
			model: data.model,
			color: data.color,
			speed: data.speed,
			name: data.name,
			count: waveSize,
			gold: gold,
			grouped: data.grouped,
			attackBit: data.attackBit,
			isBoss: waveIndex && waveIndex % (CREEP_TYPE_COUNT + 1) === 0,
		})
		// console.log('Wave', this.count, data)
	}

	update (renderTime) {
		const waveNumber = this.count
		const spawning = this.spawning
		for (let sidx = spawning.length - 1; sidx >= 0; sidx -= 1) {
			const spawnData = spawning[sidx]
			if (renderTime >= spawnData.startAt + spawnData.index * (spawnData.grouped ? 50 : 500)) {
				if (spawnData.index >= spawnData.count - 1) {
					spawning.splice(sidx, 1)
				} else {
					spawnData.index += 1
				}
				for (let vertical = 0; vertical < 2; vertical += 1) {
					const entranceIndex = random.choose(this.spawnPoints[vertical])
					new Creep(renderTime, spawnData, entranceIndex, vertical, waveNumber)
				}
			}
		}

	}

	killCreep (renderTime) {
		this.creepCount -= 1
		if (this.creepCount === 0) {
			const waveTime = renderTime - this.waveStart
			// console.log('Wave complete!', this.count, waveTime)
			bridge.emit('wave complete', { wave: this.count, time: waveTime })
		}
	}

}
