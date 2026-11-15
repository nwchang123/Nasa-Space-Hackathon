import {createRequire}from'node:module';
import {existsSync,readFileSync,writeFileSync,readdirSync}from'node:fs';
import{resolve,delimiter}from'node:path';
const pkg=process.env.PATH.split(delimiter).map(p=>resolve(p,'../@gltf-transform/cli/package.json')).find(existsSync);
const validator=createRequire(pkg)('gltf-validator'),dir=resolve('assets-raw/global-refine/final'),report={};
for(const file of readdirSync(dir).filter(s=>s.endsWith('.glb'))){
 const r=await validator.validateBytes(new Uint8Array(readFileSync(resolve(dir,file))),{uri:file,maxIssues:1000});
 report[file]={errors:r.issues.numErrors,warnings:r.issues.numWarnings,messages:r.issues.messages.filter(m=>m.severity<2)};
 console.log(file,r.issues.numErrors,'errors',r.issues.numWarnings,'warnings');
}
writeFileSync('assets-raw/global-refine/validation.json',JSON.stringify(report,null,2));
if(Object.values(report).some(r=>r.errors))process.exitCode=1;
