/* Server-side projection. Only the requested report and anonymous comparisons leave the server. */
(function(root){
  'use strict';
  function report(raw, lookup, aliasFor) {
    const A=root.GradeAnalytics, model=A.normalize(raw);
    const key=String(lookup||'').replace(/\s/g,'').toLowerCase();
    if(!/^[a-z0-9.-]{5,40}$/.test(key))throw new Error('Enter a valid admission or enrollment number.');
    const me=model.students.find(s=>[s.admission,s.enrollment].some(v=>v.replace(/\s/g,'').toLowerCase()===key));
    if(!me)throw new Error('No student report was found for that number.');
    const privateFeedback=text=>{
      let value=String(text||'');
      for(const peer of model.students){
        if(peer.key===me.key)continue;
        for(const id of [peer.admission,peer.enrollment].filter(Boolean))value=value.split(id).join('[another student ID]');
        if(peer.name.trim().split(/\s+/).length>=2){
          const escaped=peer.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+');
          value=value.replace(new RegExp('\\b'+escaped+'\\b','gi'),'[another student]');
        }
      }
      return value;
    };
    const cohort=model.students.filter(s=>s.rows.length>0);
    const section=cohort.filter(s=>s.section===me.section);
    const standing=rows=>{
      const ranked=A.rank(rows,'overall',Infinity), own=ranked.find(s=>s.key===me.key);
      const threshold=ranked.filter(s=>s.rank<=10).at(-1)?.overall;
      return {rank:own?.rank??null,total:rows.length,average:A.round(A.mean(rows.map(s=>s.overall))||0),gapToTop10:threshold===undefined?null:A.round(Math.max(0,threshold-me.overall))};
    };
    const board=rows=>A.rank(rows).map(s=>({rank:s.rank,alias:aliasFor(s.key),score:s.overall,isYou:s.key===me.key}));
    const topics=me.topics.map(t=>{
      const rows=A.select(model,{topic:t.topic,section:me.section}).filter(s=>s.rows.length);
      return {...t,rank:A.rank(rows,'overall',Infinity).find(s=>s.key===me.key)?.rank??null,totalLearners:rows.length,
        sectionAverage:A.round(A.mean(rows.map(s=>s.overall))||0),limitedEvidence:t.total<2,
        leaderboard:board(rows)};
    });
    const strongest=me.topics.filter(t=>t.submitted).slice().sort((a,b)=>b.mastery-a.mastery)[0];
    const weakest=me.topics.filter(t=>t.submitted).slice().sort((a,b)=>a.mastery-b.mastery)[0];
    const doingWell=strongest?`Your strongest submitted topic is ${strongest.topic} (${A.round(strongest.mastery)}/100 across ${strongest.submitted} submitted activities).`:'No submitted evidence is available yet.';
    const steps=[];
    if(me.missing)steps.push(`${me.missing} activities have no submission recorded. Midterm submissions are closed; raise a grade query if you already submitted them.`);
    if(weakest&&weakest.mastery<80)steps.push(`Practise ${weakest.topic} using the feedback on your submitted work (${A.round(weakest.mastery)}/100).`);
    if(me.late)steps.push(`${me.late} submissions are recorded late. Plan earlier completion for future activities.`);
    if(me.quiz!==null&&me.lab!==null&&Math.abs(me.quiz-me.lab)>=20)steps.push(me.quiz>me.lab?'Your quiz scores exceed practical scores; focus on guided coding practice.':'Your practical scores exceed quiz scores; practise explaining the underlying concepts.');
    if(!steps.length)steps.push('Keep your submission record consistent and review the feedback on your lower-scoring work.');
    return {
      name:me.name,section:'Section '+me.section,admissionNo:me.admission,enrollmentNo:me.enrollment,
      normalizedScore:me.overall,submitted:me.submitted,notSubmitted:me.missing,
      activities:me.rows.map(r=>({id:r.id,title:r.title,category:r.category,topic:r.topic,marks:r.marks,maxMarks:r.max,normalizedScore:r.score,status:r.submitted?'Submitted':'Not submitted',timing:r.submitted?r.timing:'Not submitted',comment:privateFeedback(r.comment)})),
      midSemFeedback:{doingWell,improve:steps.join(' ')},
      insights:{section:standing(section),overall:standing(cohort),alias:aliasFor(me.key),
        mastery:me.mastery,participation:me.completion,performanceLevel:me.performanceLevel,engagement:me.engagement,
        timing:{onTime:me.rows.filter(r=>r.timing==='On time').length,late:me.late,unknown:me.submitted-me.timingKnown},
        topics,leaderboards:{section:board(section),overall:board(cohort)},generatedAt:raw.generatedAt}
    };
  }
  root.StudentInsights={report};
  if(typeof module!=='undefined')module.exports=root.StudentInsights;
})(typeof window!=='undefined'?window:globalThis);
