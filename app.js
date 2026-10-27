// app.js – 화면 동작 (목록 그리기, Supabase 일정 추가)

let tasks = [];
let weatherByRegion = {};
let judgmentById = {};
const windTest = new URLSearchParams(location.search).get('test') === 'wind';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function loadWeather() {
  const status = document.getElementById('weatherBox');
  const failed = [];
  status.textContent = '오늘 날씨를 불러오는 중…' + (windTest ? ' [시험: 풍속 12 m/s]' : '');
  if (location.protocol === 'file:') {
    status.textContent = '기상청 날씨와 판단은 배포된 웹 주소에서 확인해 주세요. 로컬에서는 DB 일정만 표시합니다.';
    return;
  }
  await Promise.all(Object.keys(REGIONS).map(async (region) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch('/api/kma?region=' + encodeURIComponent(region), { signal: controller.signal });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const result = await response.json();
      const weather = result.weather;
      if (!weather || ![weather.tempMax, weather.windMax, weather.rainProb].every(Number.isFinite)) throw new Error('날씨 수신 실패');
      for (const task of result.tasks || []) judgmentById[task.id] = task.judgment;
      weatherByRegion[region] = windTest ? { ...weather, windMax: 12 } : weather;
    } catch (error) {
      failed.push(region);
    } finally {
      clearTimeout(timeout);
      renderTasks();
    }
  }));
  status.textContent = (failed.length
    ? '날씨 수신 실패: ' + failed.join(' · ') + ' — 일정은 계속 표시합니다. 새로고침해 다시 시도하세요.'
    : '기상청 · 한국 시간 오늘 예보 (전일 23시 발표) · 최고 기온 / 최대 풍속 / 최대 강수확률')
    + (windTest ? ' [시험 모드: 수신한 날씨의 풍속을 12 m/s로 변경]' : '');
}

function isTask(task) {
  return task && ['title', 'region', 'kind', 'owner'].every(key => typeof task[key] === 'string')
    && task.title.trim() && task.owner.trim()
    && Object.hasOwn(REGIONS, task.region) && ['야외', '고소', '실내'].includes(task.kind);
}

async function loadTasks() {
  const form = document.getElementById('taskForm');
  const button = form.querySelector('button');
  const message = document.getElementById('msgBox');
  button.disabled = true;
  message.textContent = 'Supabase에서 일정을 불러오는 중…';
  try {
    const { data, error } = await supabaseClient
      .from('wx_tasks')
      .select('id, title, region, kind, owner, created_at')
      .order('created_at', { ascending: true });
    if (error) throw error;
    if (!Array.isArray(data) || !data.every(isTask)) throw new Error('잘못된 일정 데이터');
    tasks = data;
    message.textContent = '';
  } catch (error) {
    tasks = [];
    message.textContent = 'Supabase에서 일정을 읽지 못했습니다. setup.sql 실행과 config.js 설정을 확인해 주세요.';
  }
  renderTasks();
  button.disabled = false;
}

function weatherText(w) {
  return w ? w.tempMax + '℃ · ' + w.windMax + 'm/s · ' + w.rainProb + '%' : '-';
}

function renderTasks() {
  const body = document.getElementById('taskList');
  body.innerHTML = '';
  for (const t of tasks) {
    const w = weatherByRegion[t.region];
    const r = (!windTest && judgmentById[t.id]) || judge(t.kind, w);
    const tr = document.createElement('tr');
    for (const v of [t.title, t.region, t.kind, t.owner, weatherText(w)]) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    const td = document.createElement('td');
    td.textContent = r.text;
    td.className = r.level;
    tr.appendChild(td);
    body.appendChild(tr);
  }
}

async function addTask(e) {
  e.preventDefault();
  const button = e.target.querySelector('button');
  const message = document.getElementById('msgBox');
  const t = {
    title: document.getElementById('titleInput').value.trim(),
    region: document.getElementById('regionInput').value,
    kind: document.getElementById('kindInput').value,
    owner: document.getElementById('ownerInput').value.trim(),
  };
  if (!t.title || !t.owner) return;
  button.disabled = true;
  message.textContent = 'Supabase에 일정을 저장하는 중…';
  const { data, error } = await supabaseClient
    .from('wx_tasks')
    .insert(t)
    .select('id, title, region, kind, owner, created_at')
    .single();
  if (error) {
    message.textContent = '일정을 저장하지 못했습니다. 지역·구분 규칙과 Supabase 설정을 확인해 주세요.';
    button.disabled = false;
    return;
  }
  tasks.push(data);
  e.target.reset();
  message.textContent = '일정을 저장했습니다.';
  renderTasks();
  button.disabled = false;
}

const clockFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});

function updateCurrentTime() {
  const now = new Date();
  const clock = document.getElementById('currentTime');
  clock.dateTime = now.toISOString();
  clock.textContent = clockFormatter.format(now);
}

updateCurrentTime();
setInterval(updateCurrentTime, 1000);

document.getElementById('taskForm').addEventListener('submit', addTask);
loadTasks();
renderTasks();
loadWeather();
