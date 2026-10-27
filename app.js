// app.js – 화면 동작 (목록 그리기, 일정 추가)

let baseTasks = [];
let addedTasks = [];
let tasks = [];
let weatherByRegion = {};
const windTest = new URLSearchParams(location.search).get('test') === 'wind';

async function loadWeather() {
  const status = document.getElementById('weatherBox');
  const failed = [];
  status.textContent = '오늘 날씨를 불러오는 중…' + (windTest ? ' [시험: 풍속 12 m/s]' : '');
  await Promise.all(Object.keys(REGIONS).map(async (region) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(buildWeatherUrl(region), { signal: controller.signal });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const weather = parseWeatherResponse(await response.json());
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
    : '한국 시간 기준 오늘 예보 · 최고 기온 / 최대 풍속 / 최대 강수확률')
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
  message.textContent = '일정을 불러오는 중…';
  try {
    const response = await fetch('data/tasks.json');
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    if (!Array.isArray(data) || !data.every(isTask)) throw new Error('잘못된 일정 JSON');
    baseTasks = data;
    message.textContent = '';
  } catch (error) {
    baseTasks = [];
    message.textContent = location.protocol === 'file:'
      ? '배포 주소로 열어 주세요'
      : '기본 일정 파일을 읽지 못했습니다. 새로고침해 다시 시도해 주세요.';
  }
  // 기본 JSON을 먼저 읽은 후, 이 브라우저에서 추가한 일정만 합칩니다.
  try {
    const saved = JSON.parse(localStorage.getItem('wx_added') || '[]');
    addedTasks = Array.isArray(saved) ? saved.filter(isTask) : [];
  } catch (error) {
    addedTasks = [];
    message.textContent += ' 브라우저에 저장된 추가 일정을 읽지 못했습니다.';
  }
  tasks = baseTasks.concat(addedTasks);
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
    const r = judge(t.kind, w);
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

function addTask(e) {
  e.preventDefault();
  const t = {
    title: document.getElementById('titleInput').value.trim(),
    region: document.getElementById('regionInput').value,
    kind: document.getElementById('kindInput').value,
    owner: document.getElementById('ownerInput').value.trim(),
  };
  if (!t.title || !t.owner) return;
  const updated = addedTasks.concat(t);
  try {
    localStorage.setItem('wx_added', JSON.stringify(updated));
  } catch (error) {
    document.getElementById('msgBox').textContent = '추가 일정을 브라우저에 저장하지 못했습니다.';
    return;
  }
  addedTasks = updated;
  tasks = baseTasks.concat(addedTasks);
  e.target.reset();
  renderTasks();
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
