import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
async function main() {
 const [modulePath, queryKey, resultKey, output] = process.argv.slice(2);
 const mod = await import(pathToFileURL(modulePath).href);
 const fixture=JSON.parse(fs.readFileSync('/tmp/shop-search-exercise-20261025/run-a/products.json','utf8'));
 const run=(f:Record<string,unknown>={},data=fixture)=>{
  const mapped={...f}; if('q' in mapped){mapped[queryKey]=mapped.q;if(queryKey!=='q')delete mapped.q;}
  const raw=mod.searchProducts(data,mapped);
  return {items:raw[resultKey],total:raw.total};
 };
 const ids=(v:any)=>v.items.map((p:any)=>p.productId);
 const results:any[]=[];
 function check(name:string,fn:()=>void){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:String(e)});}}
 check('empty query and deterministic ordering',()=>assert.deepEqual(ids(run()),['p-01','p-02','p-05','p-06','p-03']));
 check('whitespace query',()=>assert.equal(run({q:'   '}).total,5));
 check('case-insensitive trimmed substring',()=>assert.deepEqual(ids(run({q:' MUG '})),['p-01','p-02']));
 check('unmatched query',()=>assert.deepEqual(run({q:'not-present'}),{items:[],total:0}));
 check('category exact match',()=>assert.deepEqual(ids(run({categoryId:'outdoors'})),['p-03']));
 check('category is not a fuzzy label',()=>assert.equal(run({categoryId:'Home'}).total,0));
 check('AND combination and inclusive boundaries',()=>assert.deepEqual(ids(run({q:'mug',categoryId:'home',minPriceMinor:1000,maxPriceMinor:1500})),['p-01','p-02']));
 check('zero-price exact bound',()=>assert.deepEqual(ids(run({minPriceMinor:0,maxPriceMinor:0})),['p-06']));
 check('minimum-only inclusive bound',()=>assert.equal(run({minPriceMinor:1500}).total,3));
 check('maximum-only inclusive bound',()=>assert.equal(run({maxPriceMinor:1000}).total,2));
 check('unpublished exclusion',()=>assert.equal(run({q:'hidden'}).total,0));
 check('negative minimum rejected',()=>assert.throws(()=>run({minPriceMinor:-1})));
 check('fractional maximum rejected',()=>assert.throws(()=>run({maxPriceMinor:12.5})));
 check('reversed bounds rejected',()=>assert.throws(()=>run({minPriceMinor:2000,maxPriceMinor:1000})));
 check('nonfinite bounds rejected',()=>{assert.throws(()=>run({minPriceMinor:NaN}));assert.throws(()=>run({maxPriceMinor:Infinity}));});
 check('five-field summary without source metadata',()=>assert.deepEqual(Object.keys(run().items[0]).sort(),['productId','name','categoryId','priceMinor','currency'].sort()));
 check('input immutability including result edits',()=>{const data=structuredClone(fixture);const before=JSON.stringify(data);const v=run({},data);v.items[0].name='changed';assert.equal(JSON.stringify(data),before);});
 check('empty catalog',()=>assert.deepEqual(run({},[]),{items:[],total:0}));
 fs.writeFileSync(output,JSON.stringify({adapter:{queryKey,resultKey},passed:results.filter(r=>r.pass).length,total:results.length,results},null,2)+'\n');
 console.log(JSON.stringify({passed:results.filter(r=>r.pass).length,total:results.length,failures:results.filter(r=>!r.pass)}));
}
main();
