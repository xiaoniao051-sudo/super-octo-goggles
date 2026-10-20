// Review scheduling uses local calendar dates, not fixed 24-hour durations.
export const REVIEW_INTERVALS=[1,3,7,14];
const labels={checked:'已核对',pending:'待核对',incomplete:'材料不全',disputed:'有争议'};
const optionLabel=/^[A-H]$/;
const statuses=new Set(Object.keys(labels));
const optionsOf=answer=>Array.isArray(answer?.question?.options)?answer.question.options:[];
const validOptions=options=>options.length>=2&&options.length<=8&&options.every(o=>o&&optionLabel.test(o.label)&&typeof o.text==='string'&&o.text.trim())&&new Set(options.map(o=>o.label)).size===options.length;

export function getVerification(answer){
 const supplied=answer?.verification;
 let status=statuses.has(supplied?.status)?supplied.status:'pending';
 let note=typeof supplied?.note==='string'?supplied.note:'尚未补充结构化核验记录，暂不自动判分。';
 const options=optionsOf(answer);
 const complete=typeof answer?.question?.stem==='string'&&!!answer.question.stem.trim()&&validOptions(options);
 const hasKey=optionLabel.test(answer?.correctOption)&&options.some(o=>o.label===answer.correctOption);
 if(status==='checked'&&(!complete||!hasKey)){
  status='pending';note='缺少完整题面、结构化选项或明确判分选项，暂不自动判分。';
 }
 return {status,label:labels[status],note,canGrade:status==='checked'&&complete&&hasKey};
}

export function gradeAnswer(answer,selectedOption){
 if(!getVerification(answer).canGrade||!optionsOf(answer).some(o=>o.label===selectedOption))return null;
 return selectedOption===answer.correctOption;
}

// This is a version stamp, not a security hash. It invalidates old grading when
// the question, ordered options, answer key or verification evidence changes.
export function reviewEvidenceKey(answer){
 const input=JSON.stringify([answer?.id,answer?.question?.stem,answer?.question?.prompt,optionsOf(answer),answer?.question?.versionNote,answer?.question?.sourceUrl,answer?.correctOption,answer?.verification,answer?.sourceVersion,answer?.sources,answer?.reviewedAt]);
 let hex='';
 for(const seed of [0x811c9dc5,0x9e3779b9,0x85ebca6b,0xc2b2ae35]){
  let hash=seed;for(let i=0;i<input.length;i++){hash^=input.charCodeAt(i);hash=Math.imul(hash,0x01000193);}
  hex+=(hash>>>0).toString(16).padStart(8,'0');
 }
 return 'rv1-'+hex;
}

export function localDate(date=new Date()){
 if(!(date instanceof Date)||!Number.isFinite(date.getTime()))throw Error('复习日期无效');
 return `${String(date.getFullYear()).padStart(4,'0')}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function addDays(day,days){
 const [year,month,date]=day.split('-').map(Number);
 const next=new Date(0);next.setFullYear(year,month-1,date);next.setHours(12,0,0,0);
 next.setDate(next.getDate()+days);return localDate(next);
}
export const compareAttempts=(a,b)=>a.answeredAt.localeCompare(b.answeredAt)||a.id.localeCompare(b.id);
const attemptsFor=(answer,study)=>(study.reviewAttempts?.[answer.id]||[]).slice().sort(compareAttempts);
const validAttempts=(answer,attempts)=>getVerification(answer).canGrade?attempts.filter(a=>a.evidenceKey===reviewEvidenceKey(answer)&&typeof a.correct==='boolean'&&gradeAnswer(answer,a.selectedOption)===a.correct):[];

export function reviewProgress(answer,study,now=new Date()){
 const attempts=attemptsFor(answer,study),lastAttempt=attempts.at(-1)||null;
 const result={dueDate:null,stage:0,attemptCount:attempts.length,lastAttempt,passed:false};
 if(!getVerification(answer).canGrade||!attempts.length)return result;
 const current=validAttempts(answer,attempts);
 if(!current.length)return {...result,dueDate:localDate(now)};
 let stage=0,lastAdvanceDate=null;
 for(const attempt of current){
  if(!attempt.correct){stage=0;lastAdvanceDate=null;}
  else if(lastAdvanceDate!==attempt.localDate){stage=Math.min(stage+1,REVIEW_INTERVALS.length);lastAdvanceDate=attempt.localDate;}
 }
 const latest=current.at(-1);
 // Repeated successes on the same day preserve the day's interval. An error
 // always restarts at one day, so same-day drilling cannot jump to day fourteen.
 return {...result,stage,dueDate:addDays(latest.localDate,REVIEW_INTERVALS[Math.max(0,stage-1)]),passed:latest.correct};
}

export function getReviewSummary(answers,study,now=new Date()){
 const summary={due:[],newItems:[],paused:[],scheduled:[],passedCount:0,gradedCount:0,correctCount:0};
 const today=localDate(now);
 for(const answer of answers){
  if(!getVerification(answer).canGrade){summary.paused.push(answer);continue;}
  const progress=reviewProgress(answer,study,now),attempts=validAttempts(answer,attemptsFor(answer,study));
  summary.gradedCount+=attempts.length;summary.correctCount+=attempts.filter(a=>a.correct).length;
  if(progress.passed)summary.passedCount++;
  if(!progress.attemptCount)summary.newItems.push(answer);
  else if(progress.dueDate<=today)summary.due.push(answer);
  else summary.scheduled.push(answer);
 }
 // Oldest due item first; equal dates retain the caller's stable question order.
 summary.due.sort((a,b)=>reviewProgress(a,study,now).dueDate.localeCompare(reviewProgress(b,study,now).dueDate));
 return summary;
}
