const API_ORIGIN = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
  ? location.origin : 'https://guokao-2027-pocket.xiaoniao051.chatgpt.site';
const SESSION_KEY = 'guokao-ai-session-v1';
const CHAT_KEY = 'guokao-ai-chat-v1';
const DRAFT_KEY = 'guokao-ai-draft-v1';
const PENDING_KEY = 'guokao-ai-pending-v1';
const MAX_QUESTION = 6000;
const MAX_CONTEXT = 24000;
const MAX_TURNS = 8;
const $ = id => document.getElementById(id);
if (location.hostname === 'guokao-2027-pocket.xiaoniao051.chatgpt.site' && new URLSearchParams(location.search).get('from') === 'github') {
  const studyHome = 'https://xiaoniao051-sudo.github.io/super-octo-goggles/#home';
  $('back-to-study').href = studyHome;
  $('brand-home').href = studyHome;
}
let session = readStored(SESSION_KEY, null);
let messages = readStored(CHAT_KEY, []);
let busy = false;
let ready = false;
let healthReady = false;
let healthChecking = false;
let loginBusy = false;
let pendingRequest = readStored(PENDING_KEY, null);
let toastTimer;
messages = Array.isArray(messages) ? messages.filter(validMessage) : [];
if (!pendingRequest || typeof pendingRequest.fingerprint !== 'string' || pendingRequest.fingerprint.length > 200000
  || typeof pendingRequest.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pendingRequest.requestId)) {
  setPendingRequest(null);
}

function validMessage(message) {
  return message && ['user', 'assistant'].includes(message.role) && typeof message.content === 'string'
    && message.content.length <= (message.role === 'user' ? MAX_QUESTION : 30000);
}
function readStored(key, fallback) {
  try { return JSON.parse(sessionStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeStored(key, value) {
  try { value === null ? sessionStorage.removeItem(key) : sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* The page remains usable with storage disabled. */ }
}
function setPendingRequest(value) {
  pendingRequest = value;
  writeStored(PENDING_KEY, value);
}
function toast(text) {
  clearTimeout(toastTimer);
  $('toast').textContent = text;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2400);
}
function validSession(value) {
  if (!value || typeof value.token !== 'string' || !value.token) return false;
  const expires = typeof value.expiresAt === 'number'
    ? (value.expiresAt < 1e12 ? value.expiresAt * 1000 : value.expiresAt)
    : Date.parse(value.expiresAt);
  return Number.isFinite(expires) && expires > Date.now();
}
function updateCounter() {
  $('question-count').textContent = `${$('question').value.length} / ${MAX_QUESTION}`;
  writeStored(DRAFT_KEY, $('question').value);
  updateButtons();
}
function updateButtons() {
  $('login-button').disabled = !healthReady || healthChecking || loginBusy;
  $('passphrase').disabled = !healthReady || healthChecking || loginBusy;
  $('health-retry').disabled = healthChecking;
  $('send-button').disabled = busy || !ready || !session || !$('question').value.trim();
  $('send-label').textContent = busy ? '正在回答…' : messages.length ? '继续追问' : '发送问题';
  $('question').disabled = busy;
  $('new-question').disabled = busy;
  $('lock-button').disabled = busy;
  $('retry-question').disabled = busy || !ready || !session;
  document.querySelectorAll('[data-followup],[data-starter]').forEach(button => { button.disabled = busy; });
  $('composer-help').textContent = !healthReady ? '答疑暂不可用，问题可以先留在这里。' : !session ? '先输入口令，再发送问题。'
    : !ready ? '答疑暂不可用，问题可以先留在这里。'
    : messages.length ? '可以直接追问；换题请点“换一道题”。' : '支持文字提问；写清困惑，回答更有针对性。';
}
function showAccess() {
  $('access-panel').hidden = Boolean(session) && healthReady;
  $('chat-panel').hidden = !session || !healthReady;
  $('lock-button').hidden = !session;
  updateButtons();
}
function updateBudget(budget) {
  if (!budget || !Number.isFinite(budget.remainingUsd)) return;
  const remaining = Math.max(0, budget.remainingUsd);
  $('budget-label').textContent = `本站预算约剩 $${remaining.toFixed(2)}`;
  if (remaining <= 0) {
    ready = false;
    notice('本次 28 美元额度已用完，答疑已暂停。已有内容仍可查看和复制。');
  }
  updateButtons();
}
function notice(text, retry = false) {
  const target = $('service-notice');
  target.replaceChildren();
  target.hidden = !text;
  if (!text) return;
  const content = document.createElement('span');
  content.textContent = text;
  target.append(content);
  if (retry) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'text-button';
    button.textContent = '重新检查';
    button.addEventListener('click', checkStatus);
    target.append(document.createTextNode(' '), button);
  }
}
async function api(path, { body, token = session?.token, timeout = 25000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${API_ORIGIN}/api/tutor/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'omit', cache: 'no-store', signal: controller.signal,
    });
    let result;
    try { result = await response.json(); } catch { throw Object.assign(new Error('服务暂时没有正常响应，请稍后再试。'), { status: response.status }); }
    if (!response.ok) {
      const error = new Error(typeof result?.error?.message === 'string' ? result.error.message : '暂时未能完成，请稍后再试。');
      error.status = response.status;
      error.code = result?.error?.code;
      throw error;
    }
    return result;
  } catch (error) {
    if (error.name === 'AbortError') throw Object.assign(new Error('等待时间较长，暂时没有收到回答。问题已保留，请不要连续重发。'), { code: 'CLIENT_TIMEOUT' });
    if (error instanceof TypeError) throw Object.assign(new Error('网络连接中断，问题已保留。请检查网络后再试，不会自动重发。'), { code: 'NETWORK_ERROR' });
    throw error;
  } finally { clearTimeout(timer); }
}
function showAuthError(message) {
  session = null;
  ready = false;
  writeStored(SESSION_KEY, null);
  showAccess();
  $('login-feedback').textContent = message || '访问已过期，请重新输入口令。';
}
async function checkHealth() {
  if (healthChecking) return;
  healthChecking = true;
  healthReady = false;
  ready = false;
  $('health-notice').hidden = false;
  $('access-title').textContent = '正在检查答疑服务';
  $('health-message').textContent = '正在检查答疑服务…';
  $('health-retry').hidden = true;
  showAccess();
  try {
    const health = await api('health', { token: null });
    healthReady = health.ready === true;
    $('access-title').textContent = healthReady ? '输入口令，开始答疑' : 'AI 答疑尚未启用';
    $('health-notice').hidden = healthReady;
    $('health-message').textContent = healthReady ? '' : 'AI 答疑尚未启用，正在完成接入。可以先保存题目草稿。';
    $('health-retry').hidden = healthReady;
  } catch {
    $('access-title').textContent = '暂时无法连接答疑';
    $('health-message').textContent = '答疑服务暂时无法连接。题目草稿会保留在当前标签页，请稍后重新检查。';
    $('health-retry').hidden = false;
  } finally {
    healthChecking = false;
    showAccess();
  }
  if (healthReady && session) await checkStatus();
}
async function checkStatus() {
  if (!session) return;
  ready = false;
  updateButtons();
  $('budget-label').textContent = '正在检查答疑状态…';
  try {
    const status = await api('status');
    ready = status.ready === true;
    notice(ready ? '' : '答疑服务还在准备，暂时不能发送。可以先把题目粘贴在下方。', !ready);
    updateBudget(status.budget);
    if (!status.budget) $('budget-label').textContent = ready ? '答疑已就绪' : '答疑准备中';
  } catch (error) {
    if (error.status === 401 || error.status === 403) showAuthError('访问已过期，请重新输入口令。');
    else {
      $('budget-label').textContent = '暂未连接';
      notice(error.message, true);
    }
  }
  updateButtons();
}
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('已复制回答');
  } catch {
    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.append(input);
    input.select();
    input.setSelectionRange(0, input.value.length);
    const copied = document.execCommand('copy');
    input.remove();
    toast(copied ? '已复制回答' : '复制未成功，可长按回答文字复制');
  }
}
function messageElement(message) {
  const article = document.createElement('article');
  article.className = `message message-${message.role}`;
  const header = document.createElement('div');
  header.className = 'message-header';
  const avatar = document.createElement('span');
  avatar.className = 'message-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = message.role === 'user' ? '我' : '知';
  const name = document.createElement('strong');
  name.textContent = message.role === 'user' ? '我的问题' : 'AI 答疑';
  header.append(avatar, name);
  const body = document.createElement('div');
  body.className = 'message-body';
  body.textContent = message.content;
  article.append(header, body);
  if (message.role === 'assistant') {
    if (message.incomplete === true) {
      const lengthNote = document.createElement('p');
      lengthNote.className = 'privacy-note';
      lengthNote.textContent = '本次回答达到长度上限，可继续追问。';
      article.append(lengthNote);
    }
    const actions = document.createElement('div');
    actions.className = 'message-actions';
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'copy-button';
    copy.textContent = '复制回答';
    copy.addEventListener('click', () => copyText(message.content));
    actions.append(copy);
    article.append(actions);
  }
  return article;
}
function renderMessages() {
  $('messages').replaceChildren(...messages.map(messageElement));
  $('empty-state').hidden = messages.length > 0;
  $('followups').hidden = messages.length === 0 || busy;
}
function nextContext(question) {
  if (!messages.length) return [{ role: 'user', content: question }];
  const original = messages.find(message => message.role === 'user');
  if (!original) return [{ role: 'user', content: question }];
  const firstIndex = messages.indexOf(original);
  const firstAnswer = messages[firstIndex + 1]?.role === 'assistant' ? messages[firstIndex + 1] : null;
  const followupPairs = [];
  for (let index = firstIndex + (firstAnswer ? 2 : 1); index < messages.length - 1; index++) {
    if (messages[index].role === 'user' && messages[index + 1].role === 'assistant') {
      followupPairs.push([messages[index], messages[index + 1]]);
      index++;
    }
  }
  const context = [original, ...(firstAnswer ? [firstAnswer] : []), ...followupPairs.slice(-(MAX_TURNS - 2)).flat()]
    .map(message => ({ role: message.role, content: message.role === 'assistant' ? message.content.slice(0, MAX_QUESTION) : message.content }));
  context.push({ role: 'user', content: question });
  const pinnedCount = firstAnswer ? 2 : 1;
  while (context.reduce((sum, message) => sum + message.content.length, 0) > MAX_CONTEXT && context.length > pinnedCount + 1) {
    context.splice(pinnedCount, 2);
  }
  return context;
}
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  return [...bytes].map((byte, index) => ([4, 6, 8, 10].includes(index) ? '-' : '') + byte.toString(16).padStart(2, '0')).join('');
}
function setDraft(text) {
  if (busy) return;
  $('question').value = text;
  $('question-feedback').textContent = '';
  $('retry-question').hidden = true;
  updateCounter();
  $('question').focus({ preventScroll: true });
  $('question-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
$('login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const passphrase = $('passphrase').value;
  if (!passphrase || $('login-button').disabled) return;
  loginBusy = true;
  updateButtons();
  $('login-button').textContent = '正在验证…';
  $('login-feedback').textContent = '';
  try {
    const result = await api('login', { body: { passphrase }, token: null });
    if (!validSession(result)) throw new Error('登录状态未能保存，请稍后再试。');
    session = { token: result.token, expiresAt: result.expiresAt };
    writeStored(SESSION_KEY, session);
    $('passphrase').value = '';
    showAccess();
    renderMessages();
    await checkStatus();
    if (ready) $('question').focus({ preventScroll: true });
  } catch (error) {
    $('login-feedback').textContent = error.message;
    if (error.status === 401 || error.status === 403) $('passphrase').focus();
    if (error.status === 503) await checkHealth();
  } finally {
    loginBusy = false;
    $('login-button').textContent = '进入答疑 →';
    updateButtons();
  }
});
$('question-form').addEventListener('submit', async event => {
  event.preventDefault();
  const question = $('question').value.trim();
  if (busy || !ready || !session || !question) return;
  if (question.length > MAX_QUESTION) { $('question-feedback').textContent = '题目较长，请缩短到 6000 字以内。'; return; }
  const context = nextContext(question);
  const fingerprint = JSON.stringify(context);
  if (!pendingRequest || pendingRequest.fingerprint !== fingerprint) setPendingRequest({ fingerprint, requestId: uuid() });
  busy = true;
  $('question-feedback').textContent = '';
  $('retry-question').hidden = true;
  $('waiting').hidden = false;
  $('followups').hidden = true;
  $('empty-state').hidden = true;
  const pendingBubble = messageElement({ role: 'user', content: question });
  $('messages').append(pendingBubble);
  updateButtons();
  $('waiting').scrollIntoView({ behavior: 'smooth', block: 'center' });
  try {
    const result = await api('ask', { body: { requestId: pendingRequest.requestId, messages: context }, timeout: 120000 });
    if (typeof result.answer !== 'string' || !result.answer.trim()) throw new Error('这次没有收到完整回答，问题已保留。');
    messages = [...messages, { role: 'user', content: question }, { role: 'assistant', content: result.answer, incomplete: result.incomplete === true }];
    writeStored(CHAT_KEY, messages);
    setPendingRequest(null);
    $('question').value = '';
    writeStored(DRAFT_KEY, '');
    $('import-notice').hidden = true;
    updateBudget(result.budget);
    renderMessages();
    const answer = $('messages').lastElementChild;
    answer?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    pendingBubble.remove();
    $('question-feedback').textContent = error.message;
    if (error.status === 409) {
      $('question-feedback').textContent = '这次请求已提交，未能找回回答。重新提问会再次使用额度。题目草稿已保留，也可以先复制下来。';
      $('retry-question').hidden = false;
    }
    if (error.status === 401 || error.status === 403) showAuthError('访问已过期。问题已保留，重新输入口令即可。');
    if (error.status === 402) { ready = false; notice(error.message); }
    if (error.status === 503) { ready = false; notice(error.message, true); }
    $('empty-state').hidden = messages.length > 0;
  } finally {
    busy = false;
    $('waiting').hidden = true;
    $('followups').hidden = messages.length === 0;
    updateCounter();
  }
});
$('question').addEventListener('input', () => { $('retry-question').hidden = true; updateCounter(); });
$('health-retry').addEventListener('click', checkHealth);
$('retry-question').addEventListener('click', () => {
  if (busy || !ready || !session || !$('question').value.trim()) return;
  if (!confirm('重新提问会再次使用额度，是否继续？')) return;
  setPendingRequest(null);
  $('retry-question').hidden = true;
  $('question-form').requestSubmit();
});
$('question').addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.isComposing) {
    event.preventDefault();
    if (!$('send-button').disabled) $('question-form').requestSubmit();
  }
});
$('lock-button').addEventListener('click', () => {
  session = null;
  ready = false;
  messages = [];
  setPendingRequest(null);
  writeStored(SESSION_KEY, null);
  writeStored(CHAT_KEY, null);
  $('question').value = '';
  writeStored(DRAFT_KEY, null);
  $('question-feedback').textContent = '';
  $('retry-question').hidden = true;
  $('login-feedback').textContent = '已退出答疑。';
  renderMessages();
  showAccess();
  updateCounter();
});
$('new-question').addEventListener('click', () => {
  if (busy) return;
  if ((messages.length || $('question').value.trim()) && !confirm('开始新问题会清空本页对话，重要回答可以先复制。继续吗？')) return;
  messages = [];
  setPendingRequest(null);
  writeStored(CHAT_KEY, []);
  $('import-notice').hidden = true;
  renderMessages();
  setDraft('');
});
document.querySelectorAll('[data-followup]').forEach(button => button.addEventListener('click', () => setDraft(button.dataset.followup)));
document.querySelectorAll('[data-starter]').forEach(button => button.addEventListener('click', () => {
  if ($('question').value.trim() && !confirm('用提问模板替换当前草稿吗？')) return;
  setDraft(button.dataset.starter.replaceAll('\\n', '\n'));
}));
function consumeQuestionLink() {
  const url = new URL(location.href);
  const id = url.searchParams.get('question');
  if (id === null) return null;
  url.searchParams.delete('question');
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
  return id;
}
function applyImportedQuestion(text) {
  if (busy) return;
  messages = [];
  setPendingRequest(null);
  writeStored(CHAT_KEY, null);
  $('question').value = text;
  $('question-feedback').textContent = '';
  $('retry-question').hidden = true;
  $('import-notice').hidden = false;
  $('import-notice').textContent = '已开始新对话并带入题干和选项，补充你的疑问后再发送。';
  renderMessages();
  updateCounter();
}
function offerQuestionImport(text) {
  const target = $('import-notice');
  target.hidden = false;
  target.textContent = '新题已准备好。当前对话和草稿已保留；确认换题后才会替换。';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'text-button';
  button.textContent = '带入新题';
  button.addEventListener('click', () => {
    if (busy) { toast('请等当前回答结束后再换题'); return; }
    if (!confirm('将新题作为一段新对话，替换当前草稿并清空本页对话。需要保留的内容请先复制。继续吗？')) return;
    applyImportedQuestion(text);
  });
  target.append(document.createTextNode(' '), button);
}
async function importQuestion() {
  const id = consumeQuestionLink();
  if (!id) return;
  try {
    const response = await fetch(new URL('./answers.json', location.href), { cache: 'no-cache' });
    if (!response.ok) throw new Error();
    const data = await response.json();
    const item = data.answers?.find(answer => answer.id === id);
    if (!item?.question?.stem) throw new Error();
    const question = item.question;
    const options = Array.isArray(question.options) ? question.options.map(option => `${option.label}. ${option.text}`).join('\n') : '';
    const text = [`${item.paper} · 第 ${item.number} 题`, question.stem, question.prompt, options, item.correctOption ? `页面参考答案：${item.correctOption}（请结合题干独立核对）` : '', '\n我的疑问：'].filter(Boolean).join('\n\n');
    if (text.length > MAX_QUESTION) throw new Error();
    if (messages.length || $('question').value.trim() || busy) offerQuestionImport(text);
    else applyImportedQuestion(text);
  } catch {
    $('import-notice').hidden = false;
    $('import-notice').textContent = '暂未能带入这道题，请返回错题库复制题干和选项。';
  }
}

if (!validSession(session)) { session = null; writeStored(SESSION_KEY, null); }
const draft = readStored(DRAFT_KEY, '');
$('question').value = typeof draft === 'string' ? draft.slice(0, MAX_QUESTION) : '';
showAccess();
renderMessages();
updateCounter();
checkHealth();
importQuestion();
