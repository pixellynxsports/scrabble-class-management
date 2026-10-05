import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');
const refs=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]).filter(x=>!/^https?:\/\//.test(x)&&!x.startsWith('#'));
const missing=[];
for(const ref of refs){
  const clean=ref.split('?')[0];
  if(!fs.existsSync(clean)) missing.push(clean);
}
if(missing.length){
  console.error('Missing local references:',missing.join('\n'));
  process.exit(1);
}
console.log('Local HTML references: OK');
