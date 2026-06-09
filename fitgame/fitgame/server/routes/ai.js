/**
 * AI 분석 라우터
 * OpenAI API를 사용한 운동 분석, 루틴 추천, 밸런스 코멘트
 */

const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const Workout = require('../models/Workout');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// OpenAI 클라이언트 초기화
// API 키가 없어도 서버가 시작되도록 함
let openai = null;
try {
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-your-openai-api-key-here') {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    console.log('✅ OpenAI API 연결됨');
  } else {
    console.warn('⚠️ OpenAI API 키가 설정되지 않았습니다. AI 기능은 데모 모드로 동작합니다.');
  }
} catch (e) {
  console.error('OpenAI 초기화 실패:', e.message);
}

// ================================
// 데모 모드 AI 응답 (API 키 없을 때)
// ================================
const getDemoAnalysis = (workoutSummary) => {
  const feedbacks = [
    "최근 운동 패턴을 분석했습니다. 꾸준히 운동하고 계시네요! 🔥",
    "하체 운동(스쿼트, 데드리프트) 비율을 늘려보세요. 전신 밸런스가 중요합니다.",
    "유산소 운동을 주 2-3회 추가하면 심폐 기능 향상에 도움이 됩니다.",
    "현재 운동 강도를 점진적으로 올려보세요. 과부하의 원칙이 성장의 핵심입니다."
  ];

  const routines = [
    "월: 가슴/삼두 (벤치프레스 4세트, 푸쉬업 3세트)",
    "화: 등/이두 (데드리프트 4세트)",
    "수: 유산소 (러닝 30분)",
    "목: 하체 (스쿼트 5세트)",
    "금: 전신 + 유산소",
    "토/일: 휴식 또는 가벼운 스트레칭"
  ];

  return {
    feedback: feedbacks[Math.floor(Math.random() * feedbacks.length)],
    routine: routines,
    balance: {
      upper: 45,
      lower: 35,
      cardio: 20,
      comment: "상체 운동 비중이 높습니다. 하체 운동 비율을 늘려보세요!"
    }
  };
};

// ================================
// POST /api/ai/analyze - 운동 기록 AI 분석
// ================================
router.post('/analyze', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    // 최근 2주 운동 기록 가져오기
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const recentWorkouts = await Workout.find({
      userId: req.user._id,
      date: { $gte: twoWeeksAgo }
    }).sort({ date: -1 }).limit(30);

    // 운동 통계 요약
    const typeCount = {};
    const totalScoreByType = {};
    recentWorkouts.forEach(w => {
      typeCount[w.name] = (typeCount[w.name] || 0) + 1;
      totalScoreByType[w.name] = (totalScoreByType[w.name] || 0) + w.score;
    });

    const workoutSummary = {
      totalWorkouts: recentWorkouts.length,
      typeDistribution: typeCount,
      scoreByType: totalScoreByType,
      level: user.gameStats.level,
      tier: user.gameStats.tier,
      streakDays: user.streakDays
    };

    // OpenAI API 없으면 데모 모드
    if (!openai) {
      const demoResult = getDemoAnalysis(workoutSummary);
      return res.json({
        success: true,
        analysis: demoResult,
        isDemo: true,
        message: '데모 모드 (OpenAI API 키 설정 필요)'
      });
    }

    // ================================
    // OpenAI GPT 분석 요청
    // ================================
    const prompt = `
당신은 전문 피트니스 코치입니다. 다음 사용자의 운동 데이터를 분석하고 한국어로 조언해주세요.

사용자 정보:
- 레벨: ${user.gameStats.level}
- 티어: ${user.gameStats.tier}
- 연속 운동 일수: ${user.streakDays}일

최근 2주 운동 기록:
- 총 운동 횟수: ${recentWorkouts.length}회
- 운동 종류별 횟수: ${JSON.stringify(typeCount, null, 2)}
- 운동 종류별 점수: ${JSON.stringify(totalScoreByType, null, 2)}

다음 형식으로 JSON 응답해주세요:
{
  "feedback": "전반적인 피드백 (2-3문장, 구체적인 수치 언급)",
  "routine": ["추천 루틴 1", "추천 루틴 2", "추천 루틴 3"],
  "balance": {
    "upper": 상체비율(숫자),
    "lower": 하체비율(숫자),
    "cardio": 유산소비율(숫자),
    "comment": "밸런스 코멘트 (1문장)"
  },
  "warnings": ["주의사항1", "주의사항2"]
}
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
      temperature: 0.7
    });

    const responseText = completion.choices[0].message.content;

    // JSON 파싱 시도
    let analysis;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    } catch {
      analysis = { feedback: responseText, routine: [], balance: null };
    }

    res.json({
      success: true,
      analysis,
      workoutSummary,
      isDemo: false
    });

  } catch (error) {
    console.error('AI 분석 에러:', error);

    // 에러 시 데모 응답
    const demoResult = getDemoAnalysis({});
    res.json({
      success: true,
      analysis: demoResult,
      isDemo: true,
      message: 'AI 분석 일시 오류 - 데모 응답 제공'
    });
  }
});

// ================================
// POST /api/ai/routine - 맞춤 루틴 추천
// ================================
router.post('/routine', async (req, res) => {
  try {
    const { goal, daysPerWeek, equipment } = req.body;
    const user = await User.findById(req.user._id);

    if (!openai) {
      return res.json({
        success: true,
        routine: [
          { day: '월', name: '가슴 + 삼두', exercises: ['벤치프레스 4×10', '푸쉬업 3×15', '딥스 3×12'] },
          { day: '화', name: '등 + 이두', exercises: ['데드리프트 4×5', '바벨 로우 3×10'] },
          { day: '수', name: '유산소', exercises: ['러닝 30분', '스트레칭 15분'] },
          { day: '목', name: '하체', exercises: ['스쿼트 5×5', '레그프레스 3×12', '런지 3×15'] },
          { day: '금', name: '전신', exercises: ['클린앤프레스 3×8', '버피 3×10', '플랭크 3×60초'] }
        ],
        isDemo: true
      });
    }

    const prompt = `
피트니스 코치로서 개인 맞춤 운동 루틴을 JSON으로 추천해주세요.

목표: ${goal || '전반적인 체력 향상'}
주당 운동 일수: ${daysPerWeek || 4}일
장비: ${equipment || '헬스장 풀장비'}
현재 레벨: ${user.gameStats.level}

형식:
{
  "routine": [
    { "day": "월", "name": "부위명", "exercises": ["운동1 세트×횟수", "운동2 세트×횟수"] }
  ],
  "tips": ["팁1", "팁2"]
}
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600
    });

    const responseText = completion.choices[0].message.content;
    let routineData;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      routineData = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    } catch {
      routineData = { routine: [], tips: [responseText] };
    }

    res.json({ success: true, ...routineData, isDemo: false });

  } catch (error) {
    console.error('루틴 추천 에러:', error);
    res.status(500).json({ success: false, message: '루틴 추천 중 오류가 발생했습니다.' });
  }
});

module.exports = router;

// ── AI 자유 채팅 ──────────────────────────────────────
router.post('/chat', authMiddleware, async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ success: false, message: '메시지가 필요합니다.' });

    if (!process.env.OPENAI_API_KEY) {
      const demos = [
        '좋은 질문이에요! 운동의 일관성이 가장 중요합니다. 매일 조금씩 꾸준히 하세요.',
        '단백질 섭취는 체중 1kg당 1.6~2.2g을 목표로 하세요. 닭가슴살, 달걀, 두부를 추천합니다!',
        '충분한 수면(7~9시간)이 근육 회복과 성장에 필수적입니다. 수면의 질도 중요해요.',
        '워밍업 없이 운동하면 부상 위험이 높아집니다. 항상 5~10분 가볍게 시작하세요!',
        '목표를 SMART하게 설정하세요: 구체적(Specific), 측정가능(Measurable), 달성가능(Achievable)!',
      ];
      return res.json({ success: true, reply: demos[Math.floor(Math.random() * demos.length)], isDemo: true });
    }

    const messages = [
      { role: 'system', content: 'FitGame AI 피트니스 코치. 운동/영양/회복 전문 조언을 한국어로 200자 이내로 답변.' },
      ...history.slice(-6),
      { role: 'user', content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
      max_tokens: 300,
      temperature: 0.8,
    });

    res.json({ success: true, reply: completion.choices[0].message.content, isDemo: false });
  } catch (error) {
    console.error('AI 채팅 에러:', error);
    res.status(500).json({ success: false, message: 'AI 응답 중 오류가 발생했습니다.' });
  }
});
