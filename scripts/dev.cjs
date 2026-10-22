'use strict';
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const handler=require('../api/gateway.js');
const root=path.resolve(__dirname,'../public');
const portIndex=process.argv.indexOf('--port');
const port=Number(portIndex>=0?process.argv[portIndex+1]:process.env.PORT||3000);
http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/gateway')return handler(req,res);
  try{const rel=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).slice(1);const file=path.resolve(root,rel);if(!file.startsWith(root+path.sep))throw new Error('invalid path');
    const data=await fs.readFile(file);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'})[path.extname(file)]||'application/octet-stream');res.end(data);
  }catch{res.statusCode=404;res.end('Not found');}
}).listen(port,'0.0.0.0',()=>console.log('Quota Guard: http://localhost:'+port));
