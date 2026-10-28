/* Shared pure analytics. No roster or grades are bundled in this public file. */
(function(root) {
  'use strict';
  const round = x => Math.round(x * 10) / 10;
  const mean = xs => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : null;
  const records = matrix => Array.isArray(matrix) && Array.isArray(matrix[0])
    ? matrix.slice(1).filter(r=>r[0]).map(r=>Object.fromEntries(matrix[0].map((h,i)=>[h,r[i] ?? '']))) : (matrix || []);
  const defaultTopics = {
    A01:'Neural computing foundations', A02:'Neural computing foundations', A03:'Neural computing foundations',
    A04:'Artificial neurons & Hebbian learning', A05:'Perceptron & ADALINE',
    A06:'Perceptron & ADALINE', A07:'Perceptron & ADALINE', A08:'ADALINE',
    A09:'Backpropagation', A10:'Backpropagation', A11:'Neural network coding — mixed', A12:'ADALINE',
    A13:'Neural computing foundations', A14:'Neural computing foundations', A15:'Neural learning — mixed review',
    A16:'Neural networks & hybrid systems', A17:'Neural networks & hybrid systems',
    A18:'Fuzzy sets & relations', A19:'Fuzzy sets & relations', A20:'Neural networks — cumulative',
    A21:'Fuzzy sets & relations', A22:'Neural networks, fuzzy sets & hybrid systems', A23:'Neural networks, fuzzy sets & hybrid systems',
    A24:'Soft computing — cumulative review', A25:'Neural networks — cumulative', A26:'Fuzzy logic — cumulative'
  };
  function normalize(raw) {
    const students = records(raw.students).map(s=>({key:String(s['Student Key'] || s.key),name:String(s['Student Name'] || s.name),section:String(s.Section || s.section).replace(/\D/g,''),admission:String(s['Admission No.'] || s.admission || ''),enrollment:String(s['Enrollment No. / PRN'] || s.enrollment || '')}));
    const topicRows = records(raw.topics || []);
    const topicById = Object.fromEntries(topicRows.map(r=>[String(r['Activity ID']),r.Topic]));
    const activities = records(raw.activities).filter(a=>String(a['Student Portal Visible'] ?? 'Yes').toLowerCase()==='yes').map(a=>({id:String(a['Activity ID'] || a.id),title:a['Activity Title'] || a.title,category:a.Category || a.category,max:Number(a['Max Marks'] || a.max || 0),section:String(a['Eligible Section'] || a.section || 'Both'),topic:topicById[a['Activity ID']] || defaultTopics[a['Activity ID']] || 'Unmapped topic',date:a['Assessment Date'] || a.date || null})).sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));
    const issues=[];const ledger=new Map();
    records(raw.ledger).forEach(r=>{const key=String(r['Student Key'])+'|'+String(r['Activity ID']);if(ledger.has(key))issues.push({type:'Duplicate ledger record',key});ledger.set(key,r);});
    const learnerRows = students.map(s=>{
      const rows=activities.filter(a=>a.section.toLowerCase()==='both'||a.section===s.section).map(a=>{
        const r=ledger.get(s.key+'|'+a.id)||{};const submitted=String(r.Status)==='Submitted';
        const maximum=Number(r['Max Marks'] || a.max); const marks=Number(r.Marks || 0);
        if(submitted&&(!Number.isFinite(marks)||marks<0||marks>maximum||maximum<=0))issues.push({type:'Invalid marks',key:s.key+'|'+a.id});
        const score=submitted&&maximum>0 ? Math.max(0,Math.min(100,marks/maximum*100)):0;
        const explicit=String(r['Submission Timing'] || '').toLowerCase();
        const evidence=[r['Teacher Comment'],r['Student Visible Feedback'],r['Source Detail']].join(' ');
        const timing=!submitted?'Missing':explicit==='late'||(/\blate\b/i.test(evidence)&&explicit!=='on time')?'Late':explicit==='on time'||explicit==='on-time'?'On time':'Unknown';
        return {...a,marks,max:maximum,score:round(score),submitted,timing,comment:String(r['Student Visible Feedback'] || r['Teacher Comment'] || '')};
      });
      const submitted=rows.filter(r=>r.submitted);const completion=rows.length?100*submitted.length/rows.length:0;
      const mastery=mean(submitted.map(r=>r.score));
      const overall=mean(rows.map(r=>r.score));
      const topics=[...new Set(rows.map(r=>r.topic))].map(topic=>{const tr=rows.filter(r=>r.topic===topic), sr=tr.filter(r=>r.submitted);return {topic,score:round(mean(tr.map(r=>r.score))||0),mastery:mean(sr.map(r=>r.score)),submitted:sr.length,total:tr.length};});
      // Speed needs measured learning intervals or comparable repeated attempts.
      // Grades, submission punctuality and activity ID order do not establish it.
      const engagement=completion>=80?'Active':completion>=50?'Intermediate active':'Low active';
      const support=mastery===null?'Insufficient evidence':mastery>=80?'Advanced performance':mastery>=50?'Developing performance':'Needs concept support';
      const quiz=mean(submitted.filter(r=>r.category==='Quiz').map(r=>r.score));
      const lab=mean(submitted.filter(r=>r.category!=='Quiz').map(r=>r.score));
      return {...s,rows,topics,submitted:submitted.length,missing:rows.length-submitted.length,zero:submitted.filter(r=>r.score===0).length,late:submitted.filter(r=>r.timing==='Late').length,timingKnown:submitted.filter(r=>r.timing==='Late'||r.timing==='On time').length,completion:round(completion),overall:round(overall||0),mastery:mastery===null?null:round(mastery),engagement,support,quiz:quiz===null?null:round(quiz),lab:lab===null?null:round(lab),learningPace:'Insufficient timing evidence'};
    });
    return {students:learnerRows,activities,issues,generatedAt:raw.generatedAt||raw.snapshotAt||null,audit:raw.audit||{},queries:records(raw.queries||[]),defaultTopics};
  }
  function select(model, filters={}) {
    return model.students.filter(s=>!filters.section||s.section===filters.section).map(s=>{
      if(!filters.topic)return s;const rows=s.rows.filter(r=>r.topic===filters.topic);const sub=rows.filter(r=>r.submitted);const completion=rows.length?round(sub.length/rows.length*100):0;const mastery=sub.length?round(mean(sub.map(r=>r.score))):null;return {...s,rows,overall:round(mean(rows.map(r=>r.score))||0),mastery,completion,submitted:sub.length,missing:rows.length-sub.length,zero:sub.filter(r=>r.score===0).length,late:sub.filter(r=>r.timing==='Late').length,engagement:completion>=80?'Active':completion>=50?'Intermediate active':'Low active',support:mastery===null?'Insufficient evidence':mastery>=80?'Advanced performance':mastery>=50?'Developing performance':'Needs concept support',quiz:mean(sub.filter(r=>r.category==='Quiz').map(r=>r.score)),lab:mean(sub.filter(r=>r.category!=='Quiz').map(r=>r.score))};
    }).filter(s=>!filters.query||[s.name,s.admission,s.enrollment].some(v=>v.toLowerCase().includes(filters.query.toLowerCase())));
  }
  function rank(rows,metric='overall',limit=10) {
    return rows.slice().sort((a,b)=>(b[metric]??-1)-(a[metric]??-1)||b.completion-a.completion||a.name.localeCompare(b.name)).slice(0,limit).map((s,i,all)=>({...s,rank:i&&s[metric]===all[i-1][metric]?null:i+1}));
  }
  const api={normalize,select,rank,mean,round,defaultTopics};root.GradeAnalytics=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
