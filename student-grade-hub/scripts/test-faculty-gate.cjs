const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function element(id) {
  return {id,tagName:'DIV',hidden:false,required:true,value:'',textContent:'',listeners:{},
    addEventListener(event, fn){this.listeners[event]=fn;},
    cloneNode(){return element(id);},replaceWith(el){elements[id]=el;},
    append(el){elements.lock=el;},replaceChildren(){},close(){},focus(){}};
}
const elements={};
for(const id of ['leadership-gate','leadership-form','leadership-code','gate-message','leadership-submit','refresh','learner-table','kpis','insight','learner-dialog','label','actions'])elements[id]=element(id);
let authCalls=0, reads=[], statuses=[], timer;
const context={model:null,rawSnapshot:null,window:{crypto:{getRandomValues(bytes){bytes.fill(1);}}},
  document:{body:{children:[elements['leadership-gate'],elements.actions]},getElementById:id=>elements[id],
    querySelector:selector=>selector==='.actions'?elements.actions:elements.label,createElement:()=>element('lock')},
  status:message=>statuses.push(message),acceptData(){},setTimeout:fn=>{timer=fn;return 1;},clearTimeout(){},
  google:{script:{run:{withSuccessHandler(success){return {withFailureHandler(failure){return {
    authenticateLeadership(){authCalls++;success();},getLeadershipData(){reads.push({success,failure});}
  };}};},lockLeadershipSession(){}}}}
};
context.crypto=context.window.crypto;
const source=fs.readFileSync('student-grade-hub/apps-script/leadership/Gate.html','utf8').split('<script>')[1].split('</script>')[0];
vm.runInNewContext(source,context);
elements['leadership-code'].value='test';
elements['leadership-form'].listeners.submit({preventDefault(){}});
assert.equal(authCalls,1);
assert.equal(elements['leadership-gate'].hidden,false,'Keep the gate visible until data arrives');
reads.shift().failure({message:'Sheets API 503: temporary error'});
assert.equal(elements['leadership-submit'].textContent,'Retry loading data');
assert.equal(elements['leadership-code'].required,false,'Retry must not require another password');
elements['leadership-form'].listeners.submit({preventDefault(){}});
assert.equal(authCalls,1,'Retry uses the existing authenticated session');
reads.shift().success({});
assert.equal(elements['leadership-gate'].hidden,true);
elements.refresh.listeners.click();
reads.shift().failure({message:'Temporary spreadsheet failure'});
assert.equal(elements['leadership-gate'].hidden,true,'A refresh error does not log out the user');
assert.match(statuses.at(-1),/Previously loaded data/);
elements.refresh.listeners.click();
reads.shift().failure({message:'Access session expired or has been revoked.'});
assert.equal(elements['leadership-gate'].hidden,false);
assert.equal(elements['leadership-code'].required,true);
console.log('Faculty gate checks passed: no dashboard flash, data retry without re-login, refresh error retained, revoked session locked.');
