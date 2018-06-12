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
var common = require('ethereum-common')
var args = process.argv.slice(2);
if (args[0] == '--rinkeby') {
  common.bootstrapNodes = [
    {
      "ip": "52.169.42.101",
      "port": 30303,
      "id": "a24ac7c5484ef4ed0c5eb2d36620ba4e4aa13b8c84684e1b4aab0cebea2ae45cb4d375b77eab56516d34bfbd3c1a833fc51296ff084b770b94fb9028c4d25ccf",
      "location": "IE",
      "comment": ""
    },
    {
      "ip": "52.3.158.184",
      "port": 30303,
      "id": "343149e4feefa15d882d9fe4ac7d88f885bd05ebb735e547f12e12080a9fa07c8014ca6fd7f373123488102fe5e34111f8509cf0b7de3f5b44339c9f25e87cb8",
      "location": "",
      "comment": "INFURA"
    },
    {
      "ip": "75.80.115.212",
      "port": 30303,
      "id": "364b6383e467c3da5cbd522958e9f74c636307c89283e26ee21efc40e1fb454efc388da31ce954c0ebc9b0216ae98ad2e0cbd0d13336e80a6c8b8c0eff109607"
    },
    {
      "ip": "159.89.28.211",
      "port": 30303,
      "id": "b6b28890b006743680c52e64e0d16db57f28124885595fa03a562be1d2bf0f3a1da297d56b13da25fb992888fd556d4c1a27b1f39d531bde7de1921c90061cc6"
    }
  ];
}
var BOOTNODES = common.bootstrapNodes.map((node) => {
  return {
    address: node.ip,
    udpPort: node.port,
    tcpPort: node.port
  }
})
console.log("static bootnodes = "+JSON.stringify(BOOTNODES))
main().catch(e => console.error(e.stack))
async function main() {
  console.log('main starts')
  const client = await pool.connect()
  var hostnames = undefined
  try {
    const { rows } = await client.query(`select hostname from node where ("lastAsked" is null or "lastAsked" < now() - interval '60' minute)  group by hostname, timestamp order by timestamp desc limit 200`, [])
    hostnames = []
    for (let row of rows) {
      if (hostnames.indexOf(row) == -1) {
        hostnames.push(row.hostname)
        if (hostnames.length >= 200) {
          break
        }
      }
    }
    var current = new Date()
    await client.query(`update node set "lastAsked" = $1 where hostname = any($2)`, [current, hostnames])
  } catch (e) {
    console.error('e = '+JSON.stringify(e))
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
  if (hostnames) {
    var dynamic_boot_nodes = hostnames.map((row) => {
      var ip = row.split(':')[0]
      var port = row.split(':')[1]
      return {"address":ip,"udpPort":port,"tcpPort":port}
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
    dpt.bootstrap(bootnode).catch((err) => console.error(chalk.bold.red(err.stack || err)))
  }
}
