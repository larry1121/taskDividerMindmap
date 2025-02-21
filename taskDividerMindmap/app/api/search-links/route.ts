import { NextResponse } from 'next/server';

interface GoogleSearchItem {
  title: string;
  link: string;
  pagemap?: {
    sitelinks?: unknown;
  };
}

interface SearchResult {
  title: string;
  type: string;
  url: string;
  relevanceScore: number;
}

// 검색 결과의 연관성을 계산하는 함수
function calculateRelevance(query: string, item: any): number {
  const searchTerms = query.toLowerCase().split(' ');
  let score = 0;

  // 제목에서 검색어 매칭
  const title = item.title.toLowerCase();
  searchTerms.forEach(term => {
    if (title.includes(term)) score += 3;
  });

  // 스니펫(설명)에서 검색어 매칭
  if (item.snippet) {
    const snippet = item.snippet.toLowerCase();
    searchTerms.forEach(term => {
      if (snippet.includes(term)) score += 2;
    });
  }

  // URL 관련성 체크 (한국 산업별 전문 사이트 및 신뢰도 기반 가중치 부여)
  const url = item.link.toLowerCase();
  
  // 공공/정부 기관 (높은 신뢰도)
  if (url.includes('.go.kr') || url.includes('.or.kr')) score += 3;
  if (url.includes('.re.kr') || url.includes('.kr/gov')) score += 3;
  
  // 사업관리/경영
  if (url.includes('nts.go.kr') || url.includes('kcci.or.kr')) score += 2; 
  if (url.includes('kostat.go.kr') || url.includes('kbiz.or.kr')) score += 2;

  // 금융/보험
  if (url.includes('fss.or.kr') || url.includes('klia.or.kr')) score += 2;
  if (url.includes('kfia.or.kr') || url.includes('kcmi.re.kr')) score += 2;

  // 교육/과학
  if (url.includes('.ac.kr') || url.includes('kedi.re.kr')) score += 2;
  if (url.includes('kice.re.kr') || url.includes('kofac.re.kr')) score += 2;

  // 법률/경찰/소방
  if (url.includes('law.go.kr') || url.includes('police.go.kr')) score += 2;
  if (url.includes('nfa.go.kr') || url.includes('mnd.go.kr')) score += 2;

  // 보건/의료
  if (url.includes('mohw.go.kr') || url.includes('khidi.or.kr')) score += 2;
  if (url.includes('kma.org') || url.includes('hira.or.kr')) score += 2;

  // 사회복지/종교
  if (url.includes('bokjiro.go.kr') || url.includes('ncrc.or.kr')) score += 2;
  if (url.includes('kccr.or.kr') || url.includes('welfare.net')) score += 2;

  // 문화/예술/방송
  if (url.includes('mcst.go.kr') || url.includes('arko.or.kr')) score += 2;
  if (url.includes('kocca.kr') || url.includes('kba.or.kr')) score += 2;

  // 운전/운송
  if (url.includes('kotsa.or.kr') || url.includes('koti.re.kr')) score += 2;
  if (url.includes('koroad.or.kr') || url.includes('ts2020.kr')) score += 2;

  // 건설/기계/재료
  if (url.includes('kict.re.kr') || url.includes('kimm.re.kr')) score += 2;
  if (url.includes('kma.or.kr') || url.includes('krri.re.kr')) score += 2;

  // 화학/바이오/섬유
  if (url.includes('krict.re.kr') || url.includes('kitech.re.kr')) score += 2;
  if (url.includes('kofoti.or.kr') || url.includes('kata.or.kr')) score += 2;

  // 전기/전자/정보통신
  if (url.includes('kepco.co.kr') || url.includes('etri.re.kr')) score += 2;
  if (url.includes('nia.or.kr') || url.includes('kisa.or.kr')) score += 2;

  // 식품/농림어업
  if (url.includes('mfds.go.kr') || url.includes('at.or.kr')) score += 2;
  if (url.includes('krei.re.kr') || url.includes('nifs.go.kr')) score += 2;

  // 환경/에너지/안전
  if (url.includes('me.go.kr') || url.includes('keiti.re.kr')) score += 2;
  if (url.includes('keco.or.kr') || url.includes('kosha.or.kr')) score += 2;

  // 산업표준/인증
  if (url.includes('kats.go.kr') || url.includes('standard.go.kr')) score += 2;
  if (url.includes('ktl.re.kr') || url.includes('ktr.or.kr')) score += 2;

  // 전문 협회/학회
  if (url.includes('society.') || url.includes('association.')) score += 1;
  if (url.includes('institute.') || url.includes('academy.')) score += 1;

  return score;
}

async function fetchLinksFromGoogle(query: string) {
  const searchQuery = `${query} 절차`;
  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CX;

  const response = await fetch(
    `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(searchQuery)}&key=${apiKey}&cx=${cx}&num=10`
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch from Google Search API');
  }
  
  const data = await response.json();
  
  // 광고 필터링 및 연관성 점수 계산
  const scoredResults = data.items
    .filter((item: GoogleSearchItem) => !item.pagemap?.sitelinks)
    .map((item: GoogleSearchItem) => ({
      ...item,
      relevanceScore: calculateRelevance(query, item)
    }));

  // 연관성 점수로 정렬하고 상위 3개 선택
  return scoredResults
    .sort((a: SearchResult, b: SearchResult) => b.relevanceScore - a.relevanceScore)
    .slice(0, 3)
    .map((item: SearchResult) => ({
      title: item.title,
      type: 'website',
      url: item.link,
    }));
}

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    const topThreeLinks = await fetchLinksFromGoogle(query);
    return NextResponse.json(topThreeLinks);
  } catch (err) {
    console.error("search-links error:", err);
    return NextResponse.json([], { status: 500 });
  }
}