// var schedule = require('node-schedule');
//
// var j = schedule.scheduleJob('*/5 * * * *', function(){
//   console.log('The answer to life, the universe, and everything!');
//   main();
// });
// main();
// function main() {
const chalk = require('chalk')
const { DPT } = require('../src')
const Buffer = require('safe-buffer').Buffer
var pg = require('pg');
var conString = "postgres://pwang:%3EMwoYREUZIE%25z%40%21%5B@127.0.0.1/ethereum"
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
pg.connect(conString, function(err, client, done) {
  if(err) {
    return console.error('error fetching client from pool', err);
  }
  // client.query('select hostname from active_node order by timestamp desc limit 200',
  client.query('select hostname from (select hostname, max(timestamp) from active_node group by hostname order by max(timestamp) desc limit 600) as recent_active_nodes order by RANDOM() limit 200',
    [], function(err, result) {
      done()
    if(err) {
      return console.error('error running query', err);
    }
    // console.log('result = '+JSON.stringify(result))
    var dynamic_boot_nodes = result.rows.map((row) => {
      var ip = row.hostname.split(':')[0]
      var port = row.hostname.split(':')[1]
      return {"address":ip,"udpPort":port,"tcpPort":port}
    })
    BOOTNODES = BOOTNODES.concat(dynamic_boot_nodes)
    startBootstrap()
  });
});
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
