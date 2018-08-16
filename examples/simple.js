require('console-stamp')(console, { pattern: 'dd/mm/yyyy HH:MM:ss.l' });
const chalk = require('chalk')
const { DPT } = require('../src')
const Buffer = require('safe-buffer').Buffer
const { Pool } = require('pg')
const pool = new Pool({
  host: process.env.DATABASE_HOSTNAME,
  port: process.env.DATABASE_PORT,
  database: process.env.DATABASE_DATABASE,
  user: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
})
var conString = require('../src/database').conString
var totalInstanceCount = parseInt(process.env.TOTAL_INSTANCE_COUNT, 10)
var capacity = 200
const PRIVATE_KEY = 'd772e3d6a001a38064dd23964dd2836239fa0e6cec8b28972a87460a17210fe9'
var BOOTNODES = require('ethereum-common').bootstrapNodes.map((node) => {
  return {
    address: node.ip,
    udpPort: node.port,
    tcpPort: node.port,
    nodeId: node.id
  }
})

main().catch(e => console.error(e.stack))
async function main() {
  console.log('main starts')
  const client = await pool.connect()
  var hostnames = undefined
  var nodeIds = undefined
  try {
    const { rows } = await client.query(`select hostname, "nodeId" from node2 where ("lastAsked" is null or "lastAsked" < now() - interval '60' minute) order by timestamp desc limit 2000`, [])
    hostnames = []
    nodeIds = []
    for (let row of rows) {
      if (hostnames.indexOf(row.hostname) == -1) {
        hostnames.push(row.hostname)
        nodeIds.push(row.nodeId)
        if (hostnames.length >= 200) {
          break
        }
      }
    }
    var current = new Date()
    await client.query(`update node2 set "lastAsked" = $1 where hostname = any($2)`, [current, hostnames])
  } catch (e) {
    console.error('e = '+JSON.stringify(e))
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
  if (hostnames) {
    var dynamic_boot_nodes = hostnames.map((row, index) => {
      var ip = row.split(':')[0]
      var port = row.split(':')[1]
      return {"address":ip,"udpPort":port,"tcpPort":port,"nodeId":nodeIds[index]}
    })
    BOOTNODES = BOOTNODES.concat(dynamic_boot_nodes)
    startBootstrap()
    console.log('startBootstrap successful')
  }
}



function startBootstrap() {
  const dpt = new DPT(Buffer.from(PRIVATE_KEY, 'hex'), {
    endpoint: {
      address: '0.0.0.0',
      udpPort: null,
      tcpPort: null
    }
  })

  dpt.on('error', (err) => console.error(chalk.red(err.stack || err)))

  dpt.on('peer:added', (peer) => {
    const info = `(${peer.id.toString('hex')},${peer.address},${peer.udpPort},${peer.tcpPort})`
    console.log(chalk.green(`New peer: ${info} (total: ${dpt.getPeers().length})`))
  })

  dpt.on('peer:removed', (peer) => {
    console.log(chalk.yellow(`Remove peer: ${peer.id.toString('hex')} (total: ${dpt.getPeers().length})`))
  })

  // for accept incoming connections uncomment next line
  // dpt.bind(30303, '0.0.0.0')

  for (let bootnode of BOOTNODES) {
    dpt.setParent(bootnode)
    dpt.bootstrap(bootnode).catch((err) => console.error(chalk.bold.red(err.stack || err)))
  }
}
