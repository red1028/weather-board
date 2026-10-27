const { judge } = require('../logic.js');

const grids = { 세종: [66, 103], 대전: [67, 100], 태안: [48, 109], 보령: [54, 100] };
const publicUrl = 'https://btfzzpojduscrelxmnwx.supabase.co';
const publicKey = 'sb_publishable_iut2-4UNRjwuKdNMgMzq4A_3gnJGkaC';

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('UPSTREAM');
  return response.json();
}

async function weatherFor(region, now) {
  // 전일 23시 발표는 오늘 하루 전체 시간대를 포함합니다.
  const kst = new Date(now.getTime() + 9 * 3600000);
  const date = kst.toISOString().slice(0, 10).replace(/-/g, '');
  const previous = new Date(kst.getTime() - 86400000).toISOString().slice(0, 10).replace(/-/g, '');
  const [nx, ny] = grids[region];
  let key = process.env.KMA_KEY.trim();
  try { key = decodeURIComponent(key); } catch (_) { /* 원문 키 사용 */ }
  const params = new URLSearchParams({ pageNo: '1', numOfRows: '1000', dataType: 'JSON', base_date: previous, base_time: '2300', nx, ny });
  const providers = [
    ['https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getVilageFcst', 'authKey'],
    ['https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst', 'serviceKey'],
  ];
  for (const [endpoint, keyName] of providers) {
    try {
      const query = new URLSearchParams(params);
      query.set(keyName, key);
      const data = await jsonFetch(endpoint + '?' + query);
      if (data.response?.header?.resultCode !== '00') throw new Error('KMA');
      const items = data.response.body?.items?.item;
      if (!Array.isArray(items)) throw new Error('KMA');
      const max = category => {
        const values = items.filter(i => i.fcstDate === date && i.category === category && String(i.fcstValue).trim() !== '')
          .map(i => Number(i.fcstValue)).filter(v => Number.isFinite(v) && v > -900);
        if (!values.length) throw new Error('KMA');
        return Math.max(...values);
      };
      const weather = { tempMax: max('TMX'), windMax: max('WSD'), rainProb: max('POP') };
      if (weather.windMax < 0 || weather.rainProb < 0 || weather.rainProb > 100) throw new Error('KMA');
      return { ...weather, date, source: '기상청 단기예보', baseDate: previous, baseTime: '2300', nx, ny };
    } catch (_) { /* 키 발급처가 다른 경우 다음 공식 엔드포인트 시도 */ }
  }
  throw new Error('KMA_UNAVAILABLE');
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET 요청만 지원합니다.' });
  }
  const region = req.query?.region;
  if (typeof region !== 'string' || !Object.hasOwn(grids, region)) {
    return res.status(400).json({ error: 'region은 세종, 대전, 태안, 보령 중 하나여야 합니다.' });
  }
  if (!process.env.KMA_KEY?.trim()) return res.status(503).json({ error: '서버 KMA_KEY 설정이 필요합니다.' });
  try {
    const url = new URL('/rest/v1/wx_tasks', process.env.SUPABASE_URL || publicUrl);
    url.search = new URLSearchParams({ select: 'id,title,region,kind,owner,created_at', region: 'eq.' + region, order: 'created_at.asc,id.asc' });
    const tasks = await jsonFetch(url, { headers: { apikey: process.env.SUPABASE_ANON_KEY || publicKey } });
    if (!Array.isArray(tasks)) throw new Error('DB');
    let weather = null;
    let weatherError;
    try { weather = await weatherFor(region, new Date()); }
    catch (_) { weatherError = '기상청 날씨를 조회하지 못했습니다. KMA_KEY와 단기예보 이용 권한을 확인하세요.'; }
    return res.status(200).json({ region, weather, ...(weatherError ? { weatherError } : {}), count: tasks.length,
      tasks: tasks.map(task => ({ ...task, weather, judgment: judge(task.kind, weather) })) });
  } catch (_) {
    return res.status(502).json({ error: 'DB 일정을 조회하지 못했습니다.' });
  }
};
