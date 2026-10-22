const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
for(const dir of ['api','lib','public','scripts'])for(const name of fs.readdirSync(path.join(root,dir)))if(/\.(c?js)$/.test(name))execFileSync(process.execPath,['--check',path.join(root,dir,name)]);
for(const name of ['package.json','vercel.json'])JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
for(const match of html.matchAll(/(?:src|href)="\/(.*?)"/g))if(!fs.existsSync(path.join(root,'public',match[1])))throw new Error('Missing asset: '+match[1]);
console.log('Syntax, JSON, and static assets OK.');
