const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const CONFIG_FILE = path.join(__dirname, 'config.json');

function usage() {
  console.log('Usage: node setup-password.js --username <name> --password <pw>');
  console.log('If you omit args the script will prompt you.');
}

async function run() {
  const argv = require('minimist')(process.argv.slice(2));
  let username = argv.username || argv.u;
  let password = argv.password || argv.p;
  if (!username || !password) {
    // prompt
    const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout });
    username = await new Promise(res => readline.question('Username: ', v => res(v)));
    password = await new Promise(res => readline.question('Password: ', v => res(v)));
    readline.close();
  }
  if (!username || !password) {
    usage();
    process.exit(1);
  }
  const hash = await bcrypt.hash(String(password), 12);
  const cfg = {
    username: String(username),
    passwordHash: hash,
    jwtSecret: crypto.randomBytes(32).toString('hex')
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
  console.log('Wrote', CONFIG_FILE);
}

run().catch(err => { console.error(err); process.exit(2); });
