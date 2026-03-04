const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const jobData = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'future_job_3960.json'), 'utf8')
);

// ══════════════════════════════════════════════════════════════
// 방법 1 적용: RIASEC ↔ Big5 간 불필요한 중복 키워드 선별 제거
// (기존 주석 그대로 유지)
// ══════════════════════════════════════════════════════════════

const riasecKeywords = {
  R: ['설계', '하드웨어', '인프라', '로봇', '센서', '제어', '회로', '엔지니어링', '제조', '자동화'],
  I: ['양자', '알고리즘', '연구', '탐구', '시뮬레이션', '모델링', '실험', '데이터 과학', '최적화', '분석'],
  A: ['창의', '콘텐츠', '디자인', '기획', '스토리', '인터페이스', '명령어', '프롬프트', '메타버스', '가상현실'],
  S: ['의료', '복지', '보건', '상담', '교육', '돌봄', '치료', '공감', '커뮤니티', '사회적'],
  E: ['비즈니스', '전략', '경영', '리더', '정책', '스타트업', '투자', '협상', '민간', '혁신 경영'],
  C: ['품질 관리', '프로세스', '규정', '감사', '체계', '수립', '운영 효율', '표준화', '인증', '컴플라이언스']
};

const big5Keywords = {
  O: ['혁신', '차세대', '새로운', '창의', '미래', '융합', '도전', '선도', '개척', '트렌드'],
  C: ['기준', '효율', '목표', '정밀', '계획', '품질', '일정', '마감', '책임', '완수'],
  E: ['소통', '협업', '커뮤니티', '서비스', '교육', '네트워크', '글로벌', '팀', '발표', '강연'],
  A: ['의료', '복지', '보건', '공감', '신뢰', '지원', '돌봄', '사회적', '배려', '봉사'],
  N: ['안전', '보호', '리스크', '감시', '모니터링', '예방', '보안', '안정화', '위기', '대응']
};

function calcScore(desc, keywords) {
  if (!keywords || keywords.length === 0) return 0;
  const maxPerKeyword = 3;
  const rawScore = keywords.reduce((sum, kw) => {
    const count = desc.split(kw).length - 1;
    return sum + Math.min(count, maxPerKeyword);
  }, 0);
  const maxPossible = keywords.length * maxPerKeyword;
  return (rawScore / maxPossible) * 100;
}

app.post('/recommend', (req, res) => {
  const { name, dob, country, ability, riasec, big5 } = req.body;

  const birthYear = parseInt((dob || '').substring(0, 4), 10);
  if (Number.isNaN(birthYear) || birthYear < 1900 || birthYear > 2100) {
    return res.status(400).json({
      error: '생년월일 형식이 올바르지 않습니다. 예) 2010-03-15 형식으로 입력해 주세요.'
    });
  }

  const year = birthYear + 25;
  const period = `${Math.floor(year / 10) * 10}년대`;

  const candidates = jobData.filter(
    row => row['국가'] === country && row['시기'] === period && row['직업등급'] === ability
  );
  const candidateCount = candidates.length;

  if (candidateCount === 0) {
    return res.status(404).json({
      error: `'${period}' 데이터가 없습니다. 지원 생년월일: 2005년~2034년생 (취업시기 2030~2050년대)`
    });
  }

  const rkws = riasecKeywords[riasec] || [];
  const bkws = big5Keywords[big5] || [];

  candidates.forEach(row => {
    const desc = row['직업해설'] || '';
    row.riasec_raw = calcScore(desc, rkws);
    row.big5_raw = calcScore(desc, bkws);
  });

  const maxR = Math.max(...candidates.map(r => r.riasec_raw), 1);
  const maxB = Math.max(...candidates.map(r => r.big5_raw), 1);

  candidates.forEach(row => {
    row.riasec_score = Math.round((row.riasec_raw / maxR) * 100 * 100) / 100;
    row.big5_score = Math.round((row.big5_raw / maxB) * 100 * 100) / 100;
    row.final_score = Math.round((row.riasec_score * 0.6 + row.big5_score * 0.4) * 100) / 100;
  });

  const allZero = candidates.every(row => row.riasec_raw === 0 && row.big5_raw === 0);

  candidates.sort(
    (a, b) => b.final_score - a.final_score || parseInt(a['연봉순위'], 10) - parseInt(b['연봉순위'], 10)
  );
  const best = candidates[0];

  const zeroScoreNote = allZero
    ? '\n※ 성향 키워드 매칭 결과가 없어 연봉순위 기준으로 최상위 직업을 추천하였습니다.'
    : '';

  const text = `
<div style="font-family:'Noto Sans KR',sans-serif; line-height:1.45; color:#2d2250; font-size:15px; padding:0; margin:0;">
  <h2 style="font-size:18px; font-weight:900; color:#2d2250; margin:0 0 10px 0; padding:0;">1. 출력 결과</h2>

  <p style="margin:4px 0; font-size:15px;"><b>성명:</b> ${name}</p>
  <p style="margin:4px 0; font-size:15px;"><b>국가:</b> ${country} / <b>취업시기:</b> ${period}</p>
  <p style="margin:8px 0 4px 0; font-size:16px; font-weight:700; color:#4f46e5;"><b>추천직업:</b> ${best['추천직업']}</p>
  <p style="margin:4px 0; font-size:14.5px;"><b>연봉순위:</b> ${period} ${country},"지능/성적/노력"을 고려한 20개 해당 직종 중 ${best['연봉순위']}위에 해당됩니다.</p>

  <p style="margin:12px 0 4px 0; font-size:15px;"><b>직업해설:</b><br>${best['직업해설']}</p>
  <p style="margin:8px 0 4px 0; font-size:15px;"><b>핵심 전문지식:</b><br>${best['핵심 전문지식']}</p>
  <p style="margin:8px 0 4px 0; font-size:15px;"><b>추천 학과/전공:</b><br>${best['추천 학과/전공']}</p>
  <p style="margin:8px 0; font-size:15px;"><b>준비 기간:</b> ${best['준비 기간']}</p>

  <h2 style="font-size:18px; font-weight:900; color:#2d2250; margin:20px 0 10px 0; padding:0;">2. 매칭 분석</h2>

  <p style="margin:4px 0; font-size:14.5px;"><b>조건 필터링:</b> 국가, 시기, 등급 데이터를 기반으로 1차 후보군 ${candidateCount}개를 추출하였습니다.</p>
  <p style="margin:4px 0; font-size:14.5px;"><b>성향 점수화:</b> 직업흥미유형(RIASEC) 적합도 ${best.riasec_score.toFixed(1)}점, 개인성향(Big5) 적합도 ${best.big5_score.toFixed(1)}점을 60:40 가중평균하여 최종 적합도 ${best.final_score}점을 산출하였습니다.</p>
  <p style="margin:4px 0; font-size:14.5px;"><b>최종 선택:</b> 적합도 점수와 연봉순위를 종합하여 최적의 직업 1종을 선정하였습니다.${zeroScoreNote}</p>
</div>
`;

  const buttons = `
<div style="margin:12px 0 0 0; padding:0; background:#f8f9fa; border-radius:10px; border:1px solid #dee2e6; width:100%; box-sizing:border-box; overflow:hidden;">
  <p style="margin:0; padding:10px 12px; font-size:17px; font-weight:bold; color:#333; line-height:1.4; background:#f1f5f9;">
    💡 더 궁금한 점은 아래 AI 중 본인이 가입한 모델을 클릭해서 문의하세요
  </p>
  <div style="display:flex; flex-direction:column; gap:0;">
    <a href="https://chat.openai.com" target="_blank" style="text-decoration:none; display:block;">
      <button style="width:100%; padding:12px 16px; font-size:17px; font-weight:bold; background:#10a37f; color:white; border:none; border-radius:0; cursor:pointer; text-align:left; box-sizing:border-box; margin:0;">
        💬 ChatGPT &nbsp;|&nbsp; <span style="font-weight:normal; font-size:15px;">창작 · 글쓰기 · 대화</span>
      </button>
    </a>
    <a href="https://gemini.google.com" target="_blank" style="text-decoration:none; display:block;">
      <button style="width:100%; padding:12px 16px; font-size:17px; font-weight:bold; background:#4285f4; color:white; border:none; border-radius:0; cursor:pointer; text-align:left; box-sizing:border-box; margin:0;">
        ✨ Gemini &nbsp;|&nbsp; <span style="font-weight:normal; font-size:15px;">구글 연동 · 코딩</span>
      </button>
    </a>
    <a href="https://claude.ai" target="_blank" style="text-decoration:none; display:block;">
      <button style="width:100%; padding:12px 16px; font-size:17px; font-weight:bold; background:#d97706; color:white; border:none; border-radius:0; cursor:pointer; text-align:left; box-sizing:border-box; margin:0;">
        🤖 Claude &nbsp;|&nbsp; <span style="font-weight:normal; font-size:15px;">심층 분석 · 문서 작성</span>
      </button>
    </a>
    <a href="https://www.perplexity.ai" target="_blank" style="text-decoration:none; display:block;">
      <button style="width:100%; padding:12px 16px; font-size:17px; font-weight:bold; background:#6366f1; color:white; border:none; border-radius:0; cursor:pointer; text-align:left; box-sizing:border-box; margin:0;">
        🔎 Perplexity &nbsp;|&nbsp; <span style="font-weight:normal; font-size:15px;">정보검색 · 최신 요약</span>
      </button>
    </a>
    <a href="https://grok.com" target="_blank" style="text-decoration:none; display:block;">
      <button style="width:100%; padding:12px 16px; font-size:17px; font-weight:bold; background:#1d9bf0; color:white; border:none; border-radius:0; cursor:pointer; text-align:left; box-sizing:border-box; margin:0;">
        ⚡ Grok &nbsp;|&nbsp; <span style="font-weight:normal; font-size:15px;">심층 질문 · 뉴스 분석</span>
      </button>
    </a>
    <a href="https://chat.deepseek.com" target="_blank" style="text-decoration:none; display:block;">
      <button style="width:100%; padding:12px 16px; font-size:17px; font-weight:bold; background:#e53e3e; color:white; border:none; border-radius:0; cursor:pointer; text-align:left; box-sizing:border-box; margin:0;">
        🐋 DeepSeek &nbsp;|&nbsp; <span style="font-weight:normal; font-size:15px;">무료 · 코딩 · 논리 추론</span>
      </button>
    </a>
  </div>
</div>
`;

  res.json({ text, buttons });
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));