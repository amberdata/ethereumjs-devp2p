// var schedule = require('node-schedule');
//
// var j = schedule.scheduleJob('*/5 * * * *', function(){
//   console.log('The answer to life, the universe, and everything!');
//   main();
// });
// main();
// function main() {
require('console-stamp')(console, { pattern: 'dd/mm/yyyy HH:MM:ss.l' });
const chalk = require('chalk')
const { DPT } = require('../src')
const Buffer = require('safe-buffer').Buffer
// var pg = require('pg');
// var conString = "postgres://pwang:%3EMwoYREUZIE%25z%40%21%5B@127.0.0.1/ethereum"
const { Pool } = require('pg')
const pool = new Pool({
  host: process.env.DATABASE_HOSTNAME,
  port: process.env.DATABASE_PORT,
  database: process.env.DATABASE_DATABASE,
  user: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
})
var conString = require('../src/database').conString
var instanceId = parseInt(process.env.INSTANCE_ID, 10)
console.log('instanceId = '+instanceId)
var totalInstanceCount = parseInt(process.env.TOTAL_INSTANCE_COUNT, 10)
var capacity = 200
const PRIVATE_KEY = 'd772e3d6a001a38064dd23964dd2836239fa0e6cec8b28972a87460a17210fe9'
var BOOTNODES = require('ethereum-common').bootstrapNodes.map((node) => {
  return {
    address: node.ip,
    udpPort: node.port,
    tcpPort: node.port
  }
})

// console.log('BOOTNODES = '+JSON.stringify(BOOTNODES))
// BOOTNODES = [{"address":"47.100.29.243","udpPort":"55462","tcpPort":"55462"}]
// BOOTNODES = [{"address":"52.16.188.185","udpPort":"30303","tcpPort":"30303"},{"address":"13.93.211.84","udpPort":"30303","tcpPort":"30303"},{"address":"191.235.84.50","udpPort":"
// 30303","tcpPort":"30303"},{"address":"13.75.154.138","udpPort":"30303","tcpPort":"30303"},{"address":"52.74.57.123","udpPort":"30303","tcpPort":"30303"},{"address":"5.1.83.226","
// udpPort":"30303","tcpPort":"30303"},{"address":"13.84.180.240","udpPort":"30303","tcpPort":"30303"},{"address":"52.169.14.227","udpPort":"30303","tcpPort":"30303"},{"address":"52
// .169.42.101","udpPort":"30303","tcpPort":"30303"},{"address":"52.3.158.184","udpPort":"30303","tcpPort":"30303"}]
// pg.connect(conString, function(err, client, done) {
//   if(err) {
//     return console.error('error fetching client from pool', err);
//   }
//   // client.query('select hostname from active_node order by timestamp desc limit 200',
//   client.query('select hostname from (select hostname, max(timestamp) as tRecent from active_node group by hostname order by tRecent desc limit $1) as recent_active_nodes order by tRecent desc limit $2 offset $3',
//     [capacity * totalInstanceCount, capacity, capacity * (instanceId-1)], function(err, result) {
//       done()
//     if(err) {
//       return console.error('error running query', err);
//     }
//     // console.log('result = '+JSON.stringify(result))
//     var dynamic_boot_nodes = result.rows.map((row) => {
//       var ip = row.hostname.split(':')[0]
//       var port = row.hostname.split(':')[1]
//       return {"address":ip,"udpPort":port,"tcpPort":port}
//     })
//     BOOTNODES = BOOTNODES.concat(dynamic_boot_nodes)
//     startBootstrap()
//   });
// });
main().catch(e => console.error(e.stack))
async function main() {
  console.log('main start')
  // note: we don't try/catch this because if connecting throws an exception
  // we don't need to dispose of the client (it will be undefined)
  const client = await pool.connect()
  // console.log('client = '+JSON.stringify(client))
  var hostnames = undefined
  try {
    // await client.query('BEGIN')
    const { rows } = await client.query(`select hostname from active_node where ("lastAsked" is null or "lastAsked" < now() - interval '60' minute)  group by hostname, timestamp order by timestamp desc limit 200`, [])

    // var filteredRows = rows.filter(function(elem, pos, arr) {
    //   return arr.indexOf(elem) == pos;
    // })
    // console.log('filteredRows = '+JSON.stringify(filteredRows))
    hostnames = []
    for (let row of rows) {
      if (hostnames.indexOf(row) == -1) {
        hostnames.push(row.hostname)
        if (hostnames.length >= 200) {
          break
        }
      }
    }
    console.log("hostnames = "+JSON.stringify(hostnames))
    var current = new Date()
    await client.query(`update active_node set "lastAsked" = $1 where hostname = any($2)`, [current, hostnames])
    // await client.query('COMMIT')
    console.log("update active_node lastAsked successful")
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
// }
