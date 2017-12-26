const { EventEmitter } = require('events')
const secp256k1 = require('secp256k1')
const Buffer = require('safe-buffer').Buffer
const { randomBytes } = require('crypto')
const createDebugLogger = require('debug')
const ms = require('ms')
const { pk2id } = require('../util')
const KBucket = require('./kbucket')
const BanList = require('./ban-list')
const DPTServer = require('./server')
var pg = require('pg');
var conString = "postgres://pwang:%3EMwoYREUZIE%25z%40%21%5B@127.0.0.1/ethereum"
const debug = createDebugLogger('devp2p:dpt')

class DPT extends EventEmitter {
  constructor (privateKey, options) {
    super()

    this._privateKey = Buffer.from(privateKey)
    this._id = pk2id(secp256k1.publicKeyCreate(this._privateKey, false))

    this._banlist = new BanList()

    this._kbucket = new KBucket(this._id)
    this._kbucket.on('added', (peer) => this.emit('peer:added', peer))
    this._kbucket.on('remove', (peer) => this.emit('peer:removed', peer))
    this._kbucket.on('ping', (...args) => this._onKBucketPing(...args))

    this._server = new DPTServer(this, this._privateKey, {
      createSocket: options.createSocket,
      timeout: options.timeout,
      endpoint: options.endpoint
    })
    this._server.once('listening', () => this.emit('listening'))
    this._server.once('close', () => this.emit('close'))
    this._server.on('peers', (peers) => this._onServerPeers(peers))
    this._server.on('error', (err) => this.emit('error', err))

    const refreshInterval = options.refreshInterval || ms('60s')
    this._refreshIntervalId = setInterval(() => this.refresh(), refreshInterval)
  }

  bind (...args) {
    this._server.bind(...args)
  }

  destroy (...args) {
    clearInterval(this._refreshIntervalId)
    this._server.destroy(...args)
  }

  _onKBucketPing (oldPeers, newPeer) {
    if (this._banlist.has(newPeer)) return

    let count = 0
    let err = null
    for (let peer of oldPeers) {
      this._server.ping(peer)
        .catch((_err) => {
          this._banlist.add(peer, ms('5m'))
          this._kbucket.remove(peer)
          err = err || _err
        })
        .then(() => {
          if (++count < oldPeers.length) return

          if (err === null) this._banlist.add(newPeer, ms('5m'))
          else this._kbucket.add(newPeer)
        })
    }
  }

  _onServerPeers (peers) {
    for (let peer of peers) {
      console.log('_onServerPeers: peer = '+JSON.stringify(peer))
      // console.log("peer.id.toString('hex') = "+peer.id.toString('hex'))
      //_onServerPeers: peer = {"address":"18.217.101.169","udpPort":20000,"tcpPort":20000}
      this.addPeer(peer).catch(() => {})
    }
    var uniquePeers = peers.filter(function(elem, pos, arr) {
      return arr.indexOf(elem) == pos;
    });
    pg.connect(conString, function(err, client, done) {
      if(err) {
        return console.error('error fetching client from pool', err);
      }
      console.log('connected to postgres')
      for (let peer of uniquePeers) {
        if (peer.endpoint && peer.endpoint.address!='::') {
          client.query('insert into active_node("ethereumId", timestamp, hostname, method) values($1,$2,$3,$4)',
            [peer.id.toString('hex'), new Date(), peer.endpoint.address+':'+peer.endpoint.udpPort, 2], function(err, result) {
            if(err) {
              return console.error('error running query', err);
            }
          });
        }
      }
      done()
    });
  }

  async bootstrap (peer) {
    debug(`bootstrap with peer ${peer.address}:${peer.udpPort}`)

    peer = await this.addPeer(peer)
    this._server.findneighbours(peer, this._id)
  }

  async addPeer (obj) {
    if (this._banlist.has(obj)) throw new Error('Peer is banned')
    debug(`attempt adding peer ${obj.address}:${obj.udpPort}`)

    // check k-bucket first
    const peer = this._kbucket.get(obj)
    if (peer !== null) return peer

    // check that peer is alive
    try {
      const peer = await this._server.ping(obj)
      this.emit('peer:new', peer)
      this._kbucket.add(peer)
      return peer
    } catch (err) {
      this._banlist.add(obj, ms('5m'))
      throw err
    }
  }

  getPeer (obj) {
    return this._kbucket.get(obj)
  }

  getPeers () {
    return this._kbucket.getAll()
  }

  getClosestPeers (id) {
    return this._kbucket.closest(id)
  }

  removePeer (obj) {
    this._kbucket.remove(obj)
  }

  banPeer (obj, maxAge) {
    this._banlist.add(obj, maxAge)
    this._kbucket.remove(obj)
  }

  refresh () {
    const peers = this.getPeers()
    debug(`call .refresh (${peers.length} peers in table)`)

    for (let peer of peers) this._server.findneighbours(peer, randomBytes(64))
  }
}

module.exports = DPT
