import store from '@/xjs/store'

import GameMap from '@/play/Game/Map'
import Unit from '@/play/Game/entity/Unit'

export default class Game {

	constructor (container, data) {
		this.container = container
		this.players = []

		this.updateCount = 0
		this.updateQueue = {}

		this.renderedSinceUpdate = false
		this.ticksRendered = 0
		this.lastTickTime = 0
		this.tickOffsets = -4

		this.tickDuration = data.tickDuration
		this.updateDuration = data.updateDuration
		this.ticksPerUpdate = this.updateDuration / this.tickDuration

		this.id = data.gid
		this.finished = false
		this.serverUpdate = -1
		this.updatesUntilStart = data.updatesUntilStart

		this.started = true

		this.map = new GameMap(this.container)

		this.ticksRendered = -this.updatesUntilStart * this.ticksPerUpdate
		this.lastTickTime = performance.now()
	}

	// Update

	calculateTicksToRender (currentTime) {
		const tickOffsetTime = this.tickOffsets * this.ticksPerUpdate * this.tickDuration / 2
		return Math.floor((currentTime - this.lastTickTime - tickOffsetTime) / this.tickDuration)
	}

	performTicks (ticksToRender) {
		let renderTime
		let ticksRenderedForFrame = 0
		const maxTicksToRender = ticksToRender > 9 ? Math.min(1000, Math.pow(ticksToRender, 0.75)) : 1
		while (ticksToRender > 0) {
			renderTime = this.ticksRendered * this.tickDuration
			store.state.game.renderTime = renderTime

			if (this.ticksRendered % this.ticksPerUpdate === 0) {
				if (this.dequeueUpdate(renderTime)) {
					store.state.game.missingUpdate = false
				} else {
					this.tickOffsets += 1
					if (renderTime > 0 && ticksToRender > this.ticksPerUpdate) {
						store.state.game.missingUpdate = true
					}
					// p('Missing update', ticksToRender, tickOffsets)
					break
				}
			}
			if (renderTime > 0) {
				// Bullet.update(renderTime, this.tickDuration, false)
				Unit.update(renderTime, this.tickDuration, false)
			} else if (renderTime === 0) {
				this.startPlaying()
			}

			this.ticksRendered += 1
			ticksToRender -= 1
			this.lastTickTime += this.tickDuration

			if (ticksRenderedForFrame >= maxTicksToRender) {
				break
			}
			ticksRenderedForFrame += 1
		}
		if (ticksToRender === 0) {
			this.renderedSinceUpdate = true
		}
		return true
	}

	dequeueUpdate (_renderTime) {
		const nextUpdate = this.updateQueue[this.updateCount]
		if (!nextUpdate) {
			return false
		}
		this.updateQueue[this.updateCount] = null
		this.updateCount += 1

		for (let idx = nextUpdate.length - 1; idx >= 0; idx -= 1) { // 'action' response
			const update = nextUpdate[idx]
			console.log(update)
		}
		return true
	}

	// Play

	enqueueUpdate (update, actions) {
		if (update >= 9 && this.updatePanel) {
			if (update > 9) {
				this.updatePanel.end()
			}
			this.updatePanel.begin()
		}
		this.serverUpdate = update
		this.updateQueue[update] = actions
		if (this.renderedSinceUpdate) {
			const behindUpdates = update - this.updateCount
			if (behindUpdates > 0) {
				this.tickOffsets -= behindUpdates
				this.renderedSinceUpdate = false
				p('Catching up to server update', behindUpdates, this.tickOffsets)
			}
		}
	}

	startPlaying () {
		if (store.state.game.playing) {
			console.error('game already playing')
			return
		}
		store.state.game.playing = true

		this.map.spawn()
	}

	// Setup

	destroy () {
		store.resetGameState()
	}

	end () {
		this.finished = true
		store.state.game.playing = false
	}

	// Players

	playerForId (id) {
		for (const player of this.players) {
			if (player.id === id) {
				return player
			}
		}
		return null
	}

	updatePlayer (gameData) {
		const pid = gameData.pid
		const player = this.playerForId(pid)
		const storePlayer = store.state.game.players[pid]
		if (!player || !storePlayer) {
			console.error('Updated player DNE', player, storePlayer, gameData, this.players)
			return
		}
		player.isActive = gameData.joined
		storePlayer.isActive = gameData.joined
		store.state.chatMessages.push({ name: player.name, active: player.isActive })
	}

}
