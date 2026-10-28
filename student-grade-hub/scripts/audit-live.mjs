import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const analytics=require('../site/teacher/analytics.js');
const raw=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const expected=analytics.normalize(raw);
const url='https://script.google.com/macros/s/AKfycbxNG-wHJ74tIGtKPBHQTXt55FzbR1SqcLNAl9yIMU54pFnf_BcQQ9tk5sK_sH0BV5KN/exec';
let cursor=0;let checked=0;const differences=[];const failures=[];
async function worker(){while(cursor<expected.students.length){const s=expected.students[cursor++];try{const response=await fetch(url+'?id='+encodeURIComponent(s.admission),{signal:AbortSignal.timeout(45000)});if(!response.ok)throw new Error('HTTP '+response.status);const data=await response.json();if(!data.ok)throw new Error(data.error);const r=data.report;const actual=new Map(r.activities.map(a=>[a.id,a]));for(const a of s.rows){const b=actual.get(a.id);if(!b||Number(b.marks)!==a.marks||Number(b.maxMarks)!==a.max||b.status!==(a.submitted?'Submitted':'Not submitted')||Math.abs(b.normalizedScore-a.score)>.11||String(b.comment||'')!==a.comment)differences.push({student:s.admission,activity:a.id,expected:{marks:a.marks,max:a.max,score:a.score,submitted:a.submitted,comment:a.comment},actual:b});}if(Math.abs(r.normalizedScore-s.overall)>.11||r.submitted!==s.submitted||r.notSubmitted!==s.missing||r.activities.length!==s.rows.length)differences.push({student:s.admission,type:'Summary mismatch',actual:r.normalizedScore,expected:s.overall});checked++;if(checked%20===0)console.log(JSON.stringify({progress:checked,total:expected.students.length}));}catch(e){failures.push({student:s.admission,error:e.message});}}}
await Promise.all(Array.from({length:5},worker));
console.log(JSON.stringify({checked,total:expected.students.length,differences,failures}));
