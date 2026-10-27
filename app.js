// app.js – 화면 동작 (목록 그리기, 일정 추가)

// 01 단원 : 일정 목록을 코드 안에 둠 (가상 데이터) → 04 단원에서 data/tasks.json 으로 분리
const SAMPLE_TASKS = [
  { title: '다중이용시설 안전점검', region: '세종', kind: '야외', owner: '김안전' },
  { title: '시민 안전체험 행사 운영', region: '보령', kind: '야외', owner: '이행사' },
  { title: '옥상 태양광 설비 점검', region: '태안', kind: '고소', owner: '박설비' },
  { title: '하천 수위계 확인', region: '대전', kind: '야외', owner: '최현장' },
  { title: '청사 외벽 간판 보수', region: '세종', kind: '고소', owner: '정시설' },
  { title: '비상연락 훈련', region: '대전', kind: '실내', owner: '한상황' },
];

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

function loadTasks() {
  const saved = JSON.parse(localStorage.getItem('wx_added') || '[]');
  tasks = SAMPLE_TASKS.concat(saved);
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
  const saved = JSON.parse(localStorage.getItem('wx_added') || '[]');
  saved.push(t);
  localStorage.setItem('wx_added', JSON.stringify(saved));
  e.target.reset();
  loadTasks();
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
