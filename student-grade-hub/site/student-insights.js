'use strict';
function insightElement(tag,text,className=''){
  const node=document.createElement(tag);node.textContent=text;node.className=className;return node;
}
function renderInsights(insights){
  const panel=document.querySelector('#student-insights');
  panel.classList.toggle('hidden',!insights);if(!insights)return;
  const cards=document.querySelector('#standing-cards');cards.replaceChildren();
  for(const [label,value,note] of [
    ['Section rank',insights.section.rank===null?'—':`${insights.section.rank} / ${insights.section.total}`,`Section average: ${formatScore(insights.section.average)}/100`],
    ['Overall rank',insights.overall.rank===null?'—':`${insights.overall.rank} / ${insights.overall.total}`,`Both sections average: ${formatScore(insights.overall.average)}/100`],
    ['Submitted-work average',insights.mastery===null?'—':`${formatScore(insights.mastery)}/100`,insights.performanceLevel?`${insights.performanceLevel} current performance`:'No graded evidence'],
    ['Gap to section top 10',insights.section.gapToTop10===null?'—':`${formatScore(insights.section.gapToTop10)} points`,'Based on the current scores; future rank may change'],
  ]){
    const card=insightElement('article','','metric');card.append(insightElement('span',label),insightElement('strong',value),insightElement('small',note));cards.append(card);
  }
  document.querySelector('#participation-insight').textContent=`Participation: ${formatScore(insights.participation)}% · ${insights.engagement}. Timing evidence: ${insights.timing.onTime} on time, ${insights.timing.late} late, ${insights.timing.unknown} unavailable. Your alias: ${insights.alias}.`;
  document.querySelector('#insights-updated').textContent='As of '+new Date(insights.generatedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'});
  const topics=document.querySelector('#topic-comparisons');topics.replaceChildren();
  for(const topic of insights.topics){
    const card=insightElement('article','','topic-comparison');
    card.append(insightElement('h4',topic.topic),insightElement('p',`You: ${formatScore(topic.score)}/100 · Section: ${formatScore(topic.sectionAverage)}/100`),insightElement('small',`Rank ${topic.rank??'—'} of ${topic.totalLearners} · ${topic.submitted}/${topic.total} submitted${topic.limitedEvidence?' · Limited evidence':''}`));
    for(const [label,value,tone] of [['You',topic.score,'own'],['Section average',topic.sectionAverage,'cohort']]){
      const row=insightElement('div','','comparison-row');const track=insightElement('div','','comparison-track');const fill=insightElement('div','',tone);fill.style.width=Math.max(0,Math.min(100,value))+'%';track.append(fill);row.append(insightElement('span',label),track);card.append(row);
    }
    topics.append(card);
  }
  const select=document.querySelector('#leaderboard-topic');select.replaceChildren();
  insights.topics.forEach((topic,i)=>{const option=insightElement('option',topic.topic);option.value=i;select.append(option);});
  document.querySelector('#leaderboard-scope').value='section';select.disabled=true;
  renderStudentLeaderboard();
}
function renderStudentLeaderboard(){
  const insights=currentReport?.insights;if(!insights)return;
  const scope=document.querySelector('#leaderboard-scope').value,topic=document.querySelector('#leaderboard-topic');topic.disabled=scope!=='topic';
  const selected=insights.topics[Number(topic.value)];
  const entries=scope==='topic'?(selected?.leaderboard||[]):insights.leaderboards[scope];
  const list=document.querySelector('#leaderboard-list');list.replaceChildren();
  for(const entry of entries){const row=insightElement('div','','leaderboard-entry'+(entry.isYou?' is-you':''));row.append(insightElement('strong','#'+entry.rank),insightElement('span',entry.isYou?`You · ${entry.alias}`:entry.alias),insightElement('strong',formatScore(entry.score)+'/100'));list.append(row);}
  if(!entries.length)list.append(insightElement('p','No eligible activities are available for this comparison.'));
  if(entries.length&&!entries.some(e=>e.isYou))list.append(insightElement('p','Your position is shown in the standing cards or topic comparison above.','muted'));
}
document.querySelector('#leaderboard-scope').addEventListener('change',renderStudentLeaderboard);
document.querySelector('#leaderboard-topic').addEventListener('change',renderStudentLeaderboard);
