// Parse every game script as a classic browser script (no module wrapper),
// so mistakes like a top-level `return` fail here instead of in the browser.
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..', 'src', 'js');
let bad = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
  try { new vm.Script(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f }); }
  catch (e) { bad++; console.error(`${f}: ${e.message}`); }
}
process.exit(bad ? 1 : 0);
