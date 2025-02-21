import dotenv from "dotenv";
import { parseStringPromise } from "xml2js";

dotenv.config();

// 모든 API 호출에 사용할 KEY (.env.local에 TAGO_KEY에 저장)
export const TAGO_KEY = process.env.NEXT_PUBLIC_TAGO_KEY || process.env.TAGO_KEY;

// 대구버스정보시스템 API의 base URL (DGB 접두어 없이 호출)
const DGB_BASE_URL = "https://apis.data.go.kr/6270000/dbmsapi01";
// 국토교통부 정류소정보 API의 base URL (노드 ID에 "DGB" 접두어 필요)
const BSI_BASE_URL = "https://apis.data.go.kr/1613000/BusSttnInfoInqireService";

// Fetch 헬퍼 함수
const fetchWithParams = async (url: string, params: Record<string, any>): Promise<any> => {
  const urlObj = new URL(url);
  
  // URL에 파라미터 추가
  Object.keys(params).forEach(key => {
    urlObj.searchParams.append(key, params[key]);
  });
  
  const response = await fetch(urlObj.toString());
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  
  // 응답 형식 확인 (XML 또는 JSON)
  const contentType = response.headers.get('content-type') || '';
  let data;
  
  if (contentType.includes('application/json') || 
      contentType.includes('json') || 
      params._type === 'json') {
    data = await response.json();
  } else {
    const text = await response.text();
    
    // XML 응답 처리
    if (typeof text === "string" && text.trim().startsWith("<")) {
      data = await parseStringPromise(text, {
        explicitArray: false,
        trim: true,
      });
    } else {
      data = text;
    }
  }
  
  return data;
};

export const DaeguBusAPI = {
  getLink: async (routeId: string): Promise<any> => {
    try {
      return await fetchWithParams(`${DGB_BASE_URL}/getLink`, { 
        serviceKey: TAGO_KEY, 
        routeId 
      });
    } catch (error) {
      console.error("getLink Error:", error);
      console.error("getLink 요청 파라미터:", { serviceKey: TAGO_KEY, routeId });
      throw error;
    }
  },

  getRealtime: async (bsId: string, routeNo: string): Promise<any> => {
    try {
      const response = await fetchWithParams(`${DGB_BASE_URL}/getRealtime`, { 
        serviceKey: TAGO_KEY, 
        bsId, 
        routeNo 
      });
  
      // 응답 데이터 후처리
      if (response.response?.body?.items?.item) {
        // 배열이 아닌 경우 배열로 변환
        const items = Array.isArray(response.response.body.items.item) 
          ? response.response.body.items.item 
          : [response.response.body.items.item];
  
        // 중복 제거 로직
        const uniqueItems = items.filter((item: any, index: number, self: any[]) => 
          index === self.findIndex((t) => (
            t.ROUTENO === item.ROUTENO && 
            t.DESTINATION === item.DESTINATION && 
            t.EXTIME1 === item.EXTIME1
          ))
        );
  
        // 중복 제거된 아이템으로 응답 재구성
        response.response.body.items.item = uniqueItems;
      }
  
      return response;
    } catch (error) {
      console.error("getRealtime Error:", error);
      console.error("getRealtime 요청 파라미터:", { serviceKey: TAGO_KEY, bsId, routeNo });
      throw error;
    }
  },

  getBs: async (routeId: string): Promise<any> => {
    try {
      return await fetchWithParams(`${DGB_BASE_URL}/getBs`, { 
        serviceKey: TAGO_KEY, 
        routeId 
      });
    } catch (error) {
      console.error("getBs Error:", error);
      console.error("getBs 요청 파라미터:", { serviceKey: TAGO_KEY, routeId });
      throw error;
    }
  },

  getPos: async (routeId: string): Promise<any> => {
    try {
      return await fetchWithParams(`${DGB_BASE_URL}/getPos`, { 
        serviceKey: TAGO_KEY, 
        routeId 
      });
    } catch (error) {
      console.error("getPos Error:", error);
      console.error("getPos 요청 파라미터:", { serviceKey: TAGO_KEY, routeId });
      throw error;
    }
  },

  // 정류소별 경유 노선 정보 조회 API (국토교통부 정류소정보 API)
  getSttnThrghRouteList: async (nodeid: string): Promise<any> => {
    try {
      // 여기서 nodeid는 반드시 "DGB" 접두어가 붙은 값이어야 함
      return await fetchWithParams(`${BSI_BASE_URL}/getSttnThrghRouteList`, {
        serviceKey: TAGO_KEY,
        pageNo: 1,
        numOfRows: 10, // 샘플 URL과 동일
        _type: "json",
        cityCode: "22",
        nodeid,
      });
    } catch (error) {
      console.error("getSttnThrghRouteList Error:", error);
      console.error("getSttnThrghRouteList 요청 파라미터:", {
        serviceKey: TAGO_KEY,
        pageNo: 1,
        numOfRows: 10,
        _type: "json",
        cityCode: "22",
        nodeid,
      });
      throw error;
    }
  },

  getBusLocation: async (routeNo: string): Promise<any> => {
    try {
      return await fetchWithParams(`${DGB_BASE_URL}/getBusLocation`, { 
        serviceKey: TAGO_KEY, 
        routeNo 
      });
    } catch (error) {
      console.error("getBusLocation Error:", error);
      console.error("getBusLocation 요청 파라미터:", { serviceKey: TAGO_KEY, routeNo });
      throw error;
    }
  },
};