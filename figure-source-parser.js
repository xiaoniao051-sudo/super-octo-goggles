/**
 * Browser-safe parser for ERRRC/xingcezhenti verbal Markdown.
 * No network, DOM, storage, eval, scoring or third-party explanations.
 * Caller fetches a selected paper and retains the parsed result in memory.
 * Source reference answers are not independently verified official answers.
 */
const OWNER = 'ERRRC';
const REPO = 'xingcezhenti';
const QUESTION_HEADER = /^#{2,3}\s+第\s+(\d+)\s+题[^\n]*?<sub>qid\s+(\d+)\s*[·•]\s*([^<]+)<\/sub>\s*$/gm;
const OPTION_HEADER = /^-\s+\*\*([A-H])\*\*\.\s*/gm;
const EXPLANATION_HEADER = /^\*\*(?:官方解析|参考解析|解析)\*\*\s*$/m;

function decodeEntities(value) {
  const named = {nbsp:' ',amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
  return String(value).replace(/&(#x[\da-f]+|#\d+|nbsp|amp|lt|gt|quot|apos);/gi, (all, key) => {
    if (key[0] !== '#') return named[key.toLowerCase()] ?? all;
    const point = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2),16) : Number(key.slice(1));
    return Number.isInteger(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : all;
  });
}

export function rawFigureSourceUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw Error('原题地址无效'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw Error('原题仅接受 HTTPS 地址');
  let path = decodeURIComponent(url.pathname);
  if (url.hostname === 'github.com') {
    const prefix = '/' + OWNER + '/' + REPO + '/blob/';
    if (!path.startsWith(prefix)) throw Error('原题仓库不在支持范围');
    path = '/' + OWNER + '/' + REPO + '/' + path.slice(prefix.length);
  } else if (url.hostname !== 'raw.githubusercontent.com') throw Error('原题域名不在支持范围');
  const pattern = new RegExp('^/' + OWNER + '/' + REPO + '/[a-f0-9]{40}/05-判断推理/[^/]+\\.md$');
  if (!pattern.test(path)) throw Error('不是支持的判断推理试卷文件');
  return 'https://raw.githubusercontent.com' + path.split('/').map(encodeURIComponent).join('/');
}

export function safeImageUrl(value, sourceUrl) {
  try {
    const base = new URL(rawFigureSourceUrl(sourceUrl));
    const image = new URL(decodeEntities(value), base);
    const root = decodeURIComponent(base.pathname).split('/').slice(0,4).join('/') + '/90-图片/';
    const imagePath = decodeURIComponent(image.pathname);
    if (image.protocol !== 'https:' || image.hostname !== 'raw.githubusercontent.com' ||
        image.username || image.password || !imagePath.startsWith(root) ||
        !/\.(?:png|jpe?g|gif|webp)$/i.test(imagePath)) return null;
    image.hash = '';
    image.search = '';
    return image.href;
  } catch { return null; }
}

/** Returns inert text/image descriptors. Render text with textContent, never innerHTML. */
export function displaySegments(input, sourceUrl) {
  const warnings = [];
  const images = [];
  let value = String(input)
    .replace(/<u[^>]*>([\s\u00a0]*)<\/u>/gi,' ________ ')
    .replace(/<img\b[^>]*>/gi, tag => {
      const src = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
      const alt = tag.match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1] || '原题图片';
      const url = src ? safeImageUrl(src, sourceUrl) : null;
      if (!url) warnings.push('原题图片地址缺失或不在允许范围，需打开来源核对');
      const index = images.push({type:'image',url,alt:decodeEntities(alt)}) - 1;
      return '\uE000' + index + '\uE001';
    })
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (all,alt,src) => {
      const url = safeImageUrl(src, sourceUrl);
      if (!url) warnings.push('原题图片地址缺失或不在允许范围，需打开来源核对');
      const index = images.push({type:'image',url,alt:decodeEntities(alt || '原题图片')}) - 1;
      return '\uE000' + index + '\uE001';
    })
    .replace(/<\/?p\b[^>]*>|<br\s*\/?>/gi,'\n')
    .replace(/<[^>]*>/g,'')
    .replace(/\*\*|✅/g,'');
  value = decodeEntities(value).replace(/\r\n?/g,'\n').replace(/^[ \t\u00a0]+/gm,'')
    .replace(/[ \t\u00a0]{3,}/g,' ________ ').trim();
  const segments = [];
  let cursor = 0;
  for (const marker of value.matchAll(/\uE000(\d+)\uE001/g)) {
    if (marker.index > cursor) segments.push({type:'text',text:value.slice(cursor,marker.index)});
    const image = images[Number(marker[1])];
    if (image?.url) segments.push(image);
    else segments.push({type:'text',text:'[图片待核对，请打开原题来源]'});
    cursor = marker.index + marker[0].length;
  }
  if (cursor < value.length) segments.push({type:'text',text:value.slice(cursor)});
  return {segments,warnings:[...new Set(warnings)]};
}

function field(markdown, name) {
  return markdown.match(new RegExp('^' + name + ':\\s*"([^"]*)"\\s*$','m'))?.[1] || null;
}
function bindingFor(bindings, qid, moduleNumber) {
  return bindings?.find(b => String(b.qid) === qid && Number(b.moduleNumber) === moduleNumber);
}
function materialNumber(binding) {
  if (!binding) return undefined;
  if (binding.materialGroupId === null || binding.sharedPassage === null) return null;
  if (Number.isInteger(binding.sharedPassage)) return binding.sharedPassage;
  if (Number.isInteger(binding.materialNumber)) return binding.materialNumber;
  if (typeof binding.materialGroupId === 'string') {
    const n = binding.materialGroupId.match(/(?:passage|material)-(\d+)$/)?.[1];
    if (n) return Number(n);
  }
  return undefined;
}

/**
 * options.bindings: [{qid,moduleNumber,materialGroupId:null|string,sharedPassage?:number|null}]
 * Material bindings MUST be explicit when the source has shared passages:
 * its last material heading also precedes later standalone questions.
 */
export function parseFigureSource(markdown, options = {}) {
  if (typeof markdown !== 'string' || markdown.length > 2_000_000) throw Error('试卷文本无效或过大');
  const sourceUrl = rawFigureSourceUrl(options.sourceUrl);
  const title = field(markdown,'试卷');
  if (!title) throw Error('没有识别到试卷名称');
  if (options.expectedTitle && title !== options.expectedTitle) throw Error('试卷名称与目录不一致');
  const year = Number(field(markdown,'年份')) || null;
  if (Number.isInteger(options.expectedYear) && year !== options.expectedYear) throw Error('试卷年份与目录不一致');
  const declaredCount = Number(field(markdown,'题数'));
  const headers = [...markdown.matchAll(new RegExp(QUESTION_HEADER.source,'gm'))];
  if (!headers.length) throw Error('没有识别到试题');
  const warnings = [];
  if (declaredCount !== headers.length) throw Error('来源声明题量与实际题目数不一致');
  if (Number.isInteger(options.expectedCount) && options.expectedCount !== headers.length)
    throw Error('目录题量与实际来源题量不一致');
  if (options.bindings) {
    const keys = options.bindings.map(b => String(b.qid)+':'+Number(b.moduleNumber));
    const sourceKeys = headers.map(h => h[2]+':'+Number(h[1]));
    if (new Set(keys).size !== keys.length || new Set(sourceKeys).size !== sourceKeys.length ||
        keys.length !== sourceKeys.length || sourceKeys.some(key => !keys.includes(key)))
      throw Error('目录题号与来源题目不能一一对应');
  }
  const materials = [];
  for (const heading of markdown.matchAll(/^##\s+材料\s+(\d+)\s*$/gm)) {
    if (materials.some(m => m.number === Number(heading[1]))) throw Error('来源材料编号重复');
    const next = headers.find(h => h.index > heading.index);
    if (!next) {warnings.push('材料没有对应小题');continue;}
    const raw = markdown.slice(heading.index + heading[0].length,next.index).trim();
    materials.push({number:Number(heading[1]),...displaySegments(raw,sourceUrl)});
  }
  // A file can change from two passages to three. A full set of explicit null
  // bindings is not evidence that the source passages may be discarded.
  const usedMaterialNumbers = new Set(headers.map(header =>
    materialNumber(bindingFor(options.bindings,header[2],Number(header[1])))));
  const unusedMaterials = materials.filter(material => !usedMaterialNumbers.has(material.number));
  const unboundMaterialWarning = unusedMaterials.length
    ? '来源共享材料' + unusedMaterials.map(material=>material.number).join('、') + '未关联任何题，材料绑定需要复核'
    : null;
  if (unboundMaterialWarning) warnings.push(unboundMaterialWarning);
  const seen = new Set();
  const questions = headers.map((header, index) => {
    const moduleNumber = Number(header[1]), qid = header[2], sourceType = header[3].trim();
    const nextHeader = index + 1 < headers.length ? headers[index+1].index : markdown.length;
    let body = markdown.slice(header.index + header[0].length,nextHeader);
    // A following passage must never enter the preceding question.
    body = body.split(/^##\s+材料\s+\d+\s*$/m)[0];
    const questionWarnings = [];
    const key = qid + ':' + moduleNumber;
    // Audited figure index binds standalone question blocks explicitly; later
    // case-study material in the full reasoning paper does not belong to them.
    const standalone = sourceType === '图形推理' && options.standaloneKeys?.includes(key);
    if (unboundMaterialWarning && !standalone) questionWarnings.push(unboundMaterialWarning);
    if (seen.has(key)) questionWarnings.push('来源题目编号重复');
    seen.add(key);
    const explanationAt = body.search(EXPLANATION_HEADER);
    const beforeExplanation = explanationAt < 0 ? body : body.slice(0,explanationAt);
    const answerMatch = beforeExplanation.match(/^\*\*答案\*\*\s*[：:]\s*([^\r\n]+)/m);
    const answerAt = beforeExplanation.search(/^\*\*答案\*\*\s*[：:]/m);
    const questionOnly = (answerAt < 0 ? beforeExplanation : beforeExplanation.slice(0,answerAt)).trim()
      .replace(/\n---\s*$/,'');
    const optionHeaders = [...questionOnly.matchAll(new RegExp(OPTION_HEADER.source,'gm'))];
    const rawStem = optionHeaders.length ? questionOnly.slice(0,optionHeaders[0].index).trim() : questionOnly;
    const stem = displaySegments(rawStem,sourceUrl);
    questionWarnings.push(...stem.warnings);
    const choices = optionHeaders.map((option,i) => {
      const end = i+1 < optionHeaders.length ? optionHeaders[i+1].index : questionOnly.length;
      const raw = questionOnly.slice(option.index+option[0].length,end).trim();
      const parsed = displaySegments(raw,sourceUrl);
      questionWarnings.push(...parsed.warnings);
      if (!parsed.segments.some(s => s.type === 'image' || s.text?.trim()))
        questionWarnings.push('选项'+option[1]+'内容为空');
      return {label:option[1],segments:parsed.segments,markedCorrect:raw.includes('✅')};
    });
    if (choices.map(c=>c.label).join('') !== 'ABCD') questionWarnings.push('A—D选项不完整或顺序异常');
    const answerText = answerMatch?.[1]?.replace(/\s|✅/g,'') || null;
    const marked = choices.filter(c=>c.markedCorrect).map(c=>c.label);
    const explicit = answerText && /^[A-D]$/.test(answerText) ? answerText : null;
    if (!explicit) questionWarnings.push('来源参考答案无法确认为单选A—D');
    if (marked.length > 1 || (marked.length === 1 && explicit && marked[0] !== explicit))
      questionWarnings.push('来源答案文字与选项勾号不一致');
    const consistent = explicit && (marked.length === 0 || (marked.length === 1 && marked[0] === explicit));
    const binding = bindingFor(options.bindings,qid,moduleNumber);
    const groupNumber = materialNumber(binding);
    let material = null;
    if (materials.length && groupNumber === undefined && !standalone)
      questionWarnings.push('共享材料关联尚未核对，不能按最近材料标题自动继承');
    else if (Number.isInteger(groupNumber)) {
      material = materials.find(m=>m.number===groupNumber) || null;
      if (!material) questionWarnings.push('目录指定的共享材料没有找到');
      else {
        questionWarnings.push(...material.warnings);
        if (!material.segments.some(s => s.type === 'image' || s.text?.trim())) questionWarnings.push('共享材料内容为空');
      }
    }
    if (!stem.segments.length) questionWarnings.push('题干为空');
    const problems = [...new Set(questionWarnings)];
    return {
      qid,moduleNumber,originalNumber:null,sourceType,sourceUrl,
      stem:stem.segments,options:choices.map(({label,segments})=>({label,segments})),
      material:material ? {number:material.number,segments:material.segments} : null,
      referenceAnswer:{
        value:consistent ? explicit : null,
        label:'来源参考答案（未独立核验）',
        origin:'source_only',independentlyVerified:false,
        answerText:explicit,answerMarked:marked.length===1?marked[0]:null
      },
      sourceTextComplete:problems.length===0,
      eligibleForVerifiedStats:false,
      warnings:problems
    };
  });
  return {
    title,year,sourceUrl,
    declaredCount,parsedCount:questions.length,materials,questions,
    sourceNature:'第三方整理的网友回忆版',
    answerNotice:'参考答案来自原题库，未逐题独立核验，不称官方答案；机构解析未导入。',
    warnings:[...new Set(warnings)]
  };
}

