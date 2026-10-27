// Bound both the connection and body read; a stalled request must stay retryable.
export async function fetchJson(url, {timeoutMs=15000, label='内容'}={}) {
  const controller=new AbortController();
  let timer;
  const expired=new Promise((_,reject)=>{
    timer=setTimeout(()=>{
      reject(new Error(`${label}加载超时，请检查网络后重试`));
      controller.abort();
    },timeoutMs);
  });
  try {
    return await Promise.race([expired,(async()=>{
      const response=await fetch(url,{cache:'no-cache',signal:controller.signal});
      if(!response.ok)throw new Error(`${label}暂时无法读取，请稍后重试`);
      return response.json();
    })()]);
  } finally { clearTimeout(timer); }
}
