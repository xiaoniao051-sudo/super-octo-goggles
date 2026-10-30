export const NOTEBOOK_KEY='guokao-notebook-key-v1';
const HISTORY_KEY='guokao-notebook-history-v1';
export const isNotebookKey=key=>typeof key==='string'&&/^nb1_[a-f0-9]{64}$/.test(key);
export function knownNotebooks(storage){try{const rows=JSON.parse(storage.getItem(HISTORY_KEY)||'[]');return Array.isArray(rows)?rows.filter(r=>isNotebookKey(r.key)&&typeof r.at==='string'):[];}catch{return [];}}
export function rememberNotebook(storage,key){
 if(!isNotebookKey(key))throw Error('恢复链接不完整，请复制完整链接后重试。');
 const current=storage.getItem(NOTEBOOK_KEY),rows=knownNotebooks(storage),now=new Date().toISOString();
 for(const value of [current,key])if(isNotebookKey(value)&&!rows.some(r=>r.key===value))rows.push({key:value,at:now});
 storage.setItem(HISTORY_KEY,JSON.stringify(rows));storage.setItem(NOTEBOOK_KEY,key);
 if(storage.getItem(NOTEBOOK_KEY)!==key)throw Error('浏览器未能记住错题本，请用 Safari 普通页面打开。');
 return key;
}
export function getNotebook(storage,cryptoApi){
 let key;try{key=storage.getItem(NOTEBOOK_KEY);}catch{throw Error('浏览器不允许保存错题本入口，请用 Safari 普通页面打开。');}
 if(isNotebookKey(key))return key;
 const bytes=new Uint8Array(32);cryptoApi.getRandomValues(bytes);key='nb1_'+[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
 try{return rememberNotebook(storage,key);}catch{throw Error('浏览器未能记住错题本入口，尚未保存题目。请用 Safari 普通页面打开。');}
}
export function recoveryUrl(key,base){if(!isNotebookKey(key))throw Error('错题本入口无效');const url=new URL('./mistakes.html',base);url.search='';url.hash='notebook='+key;return url.href;}
export function recoveryKey(url){try{const u=new URL(url);return new URLSearchParams(u.hash.slice(1)).get('notebook');}catch{return null;}}
