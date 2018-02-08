
var conString = 'postgres://' +
								encodeURIComponent(process.env.DATABASE_USERNAME) +
								':' +
								encodeURIComponent(process.env.DATABASE_PASSWORD) +
								'@' +
								process.env.DATABASE_HOSTNAME +
								':' +
								process.env.DATABASE_PORT +
								'/' +
								process.env.DATABASE_DATABASE;
module.exports = {
  'conString' : conString
}
