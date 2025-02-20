import { NextResponse } from 'next/server';

// Google Search Console API를 호출하여 검색 결과의 상위 3개 링크를 가져오는 함수
async function fetchLinksFromGoogle(query: string) {
  // 실제로 Google Custom Search API를 호출하는 부분입니다.
  const searchQuery = `${query} 절차`;
  const apiKey = process.env.GOOGLE_API_KEY; // 환경 변수에 API 키를 저장해두고 사용
  const cx = process.env.GOOGLE_CX; // Custom Search Engine ID

  const response = await fetch(`https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(searchQuery)}&key=${apiKey}&cx=${cx}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch from Google Search API');
  }
  
  const data = await response.json();
  
  // 비스폰서드 링크만 필터링하고 상위 3개만 반환
  return data.items.filter((item: any) => !item.pagemap?.sitelinks) // 광고 필터링
    .slice(0, 3)
    .map((item: any) => ({
      title: item.title,
      type: 'website', // 필요한 경우 다른 타입으로 지정 가능
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