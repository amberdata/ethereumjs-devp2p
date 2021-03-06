require('console-stamp')(console, { pattern: 'dd/mm/yyyy HH:MM:ss.l' });
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

var pg = require('pg')
var conString = require('../database').conString
var peersSet = new Set()
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
      this.addPeer(peer).catch(() => {})
    }
    var filteredPeers = peers.filter(function(elem, pos, arr) {
      return arr.indexOf(elem) == pos;
    }).filter(function(elem, pos, arr) {
      if (elem.id) {
        return true
      } else {
        return false
      }
    });
    var uniquePeers = []
    for (let filteredPeer of filteredPeers) {
      var peerIdString = filteredPeer.id.toString('hex')
      if (!peersSet.has(peerIdString)) {
        uniquePeers.push(filteredPeer)
        peersSet.add(peerIdString)
      }
    }
    var peersNeededToAdd = []
    pg.connect(conString, function(err, client, done) {
      if(err) {
        return console.error('error fetching client from pool', err);
      }
      var lastSeen = new Date();
      var lastSeenDateOnlyLower = new Date(lastSeen.toDateString());
      var lastSeenDateOnlyUpper = new Date(lastSeenDateOnlyLower.getTime() + 24 * 3600 * 1000);
      console.log('lastSeenDateOnlyLower = ' + lastSeenDateOnlyLower.toString());
      console.log('lastSeenDateOnlyUpper = ' + lastSeenDateOnlyUpper.toString());
      for (let peer of uniquePeers) {
        console.log('peer = ' + JSON.stringify(peer))
        if (peer.endpoint && peer.endpoint.address!='::') {
          client.query('delete from node where "nodeId" = $1 and timestamp >= $2 and timestamp < $3', [peer.id.toString('hex'), lastSeenDateOnlyLower, lastSeenDateOnlyUpper], function(err, result) {
            if(err) {
              return console.error('error running query', err);
            }

            pg.connect(conString, function(err, client, done) {
              if(err) {
                return console.error('error fetching client from pool', err);
              }
              console.log("peer.id.toString('hex') = " + peer.id.toString('hex') + ', lastSeen = ' + lastSeen.toString() + ', address&port = ' + peer.endpoint.address+':'+peer.endpoint.udpPort);
              client.query('insert into node("nodeId", timestamp, hostname, method) values($1,$2,$3,$4) on conflict do nothing',
                [peer.id.toString('hex'), lastSeen, peer.endpoint.address+':'+peer.endpoint.udpPort, 2], function(err, result) {
                if(err) {
                  return console.error('error running query', err);
                }
              });
              done();
            });

          });
        } else {
          console.log("peer.endpoint && peer.endpoint.address!='::' is false!");
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
