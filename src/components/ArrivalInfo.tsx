"use client";

import DigitalSign from "./DigitalSign";
import { DaeguBusAPI } from "@/api/DaeguBusAPI";
import { Stop } from "@/types";
import React, { useState, useEffect, useCallback } from "react";

interface ArrivalInfoProps {
  stop: Stop | null;
}

// 도착 정보 캐시 - API 호출 최소화
interface CacheItem {
  data: any;
  timestamp: number;
}

// 캐시 유효 시간 (1분)
const CACHE_TTL = 60 * 1000;
// 전체 노선 도착 정보 캐시 유효 시간 (2분)
const ALL_ROUTES_CACHE_TTL = 120 * 1000;

// 정적 캐시 객체 - 컴포넌트 간에 공유됨
const arrivalCache: Record<string, CacheItem> = {};

const ArrivalInfo: React.FC<ArrivalInfoProps> = ({ stop }) => {
  const [arrivalText, setArrivalText] =
    useState("실시간 도착 정보가 없습니다.");
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // 도착 정보 갱신 함수
  const refreshArrivalInfo = useCallback(async () => {
    if (!stop) return;

    setLoading(true);
    try {
      // 정류장 통합 캐시 키 (모든 노선의 도착 정보를 한번에 캐싱)
      const allRoutesKey = `all_arrivals_${stop.bsId}`;
      const now = Date.now();

      // 전체 정류장 도착 정보 캐시 확인
      const cachedAllArrivals = arrivalCache[allRoutesKey];
      if (
        cachedAllArrivals &&
        now - cachedAllArrivals.timestamp < ALL_ROUTES_CACHE_TTL
      ) {
        // 캐시된 전체 도착 정보 사용
        console.log("전체 도착 정보 캐시 사용:", allRoutesKey);
        setArrivalText(cachedAllArrivals.data);
        setLastRefreshed(new Date(cachedAllArrivals.timestamp));
        setLoading(false);
        return;
      }

      // 노선 정보 캐시 키
      const routeListCacheKey = `routes_${stop.bsId}`;
      let routeListData;

      // 1. 캐시된 노선 목록 확인
      const cachedRouteList = arrivalCache[routeListCacheKey];
      if (cachedRouteList && now - cachedRouteList.timestamp < CACHE_TTL) {
        // 캐시 데이터 사용
        routeListData = cachedRouteList.data;
        console.log("노선 목록 캐시 사용:", routeListCacheKey);
      } else {
        // 국토교통부 API 호출을 위한 nodeid 생성: 정류장 bsId 앞에 "DGB" 추가
        const nodeid = "DGB" + stop.bsId;
        // 정류소별 경유 노선 정보 조회 API 호출
        routeListData = await DaeguBusAPI.getSttnThrghRouteList(nodeid);

        // 캐시 저장
        arrivalCache[routeListCacheKey] = {
          data: routeListData,
          timestamp: now,
        };
      }

      if (
        !routeListData?.response ||
        !routeListData.response.body ||
        !routeListData.response.body.items ||
        !routeListData.response.body.items.item
      ) {
        console.error("정류소별 경유 노선 정보 누락:", routeListData);
        setArrivalText("정류소별 경유 노선 정보가 없습니다.");
        setLoading(false);
        return;
      }

      let items: any = routeListData.response.body.items.item;
      if (!Array.isArray(items)) {
        items = [items];
      }

      // 각 항목에서 routeno(버스 번호)를 추출
      const routeNos: string[] = items.map((item: any) => String(item.routeno));

      if (routeNos.length === 0) {
        setArrivalText("해당 정류장을 지나는 버스 노선이 없습니다.");
        setLoading(false);
        return;
      }

      // 2. 각 노선별 도착 정보를 효율적으로 가져오기
      // API 호출 효율성을 위해 배치 처리 - 한 번에 최대 3개씩 병렬 처리
      const batchSize = 3;
      const allResults = [];

      for (let i = 0; i < routeNos.length; i += batchSize) {
        const batchRouteNos = routeNos.slice(i, i + batchSize);
        const batchPromises = batchRouteNos.map((routeNo) => {
          const arrivalCacheKey = `arrival_${stop.bsId}_${routeNo}`;
          const cachedArrival = arrivalCache[arrivalCacheKey];

          if (cachedArrival && now - cachedArrival.timestamp < CACHE_TTL) {
            // 캐시 데이터 사용
            console.log("도착 정보 캐시 사용:", arrivalCacheKey);
            return Promise.resolve({
              data: cachedArrival.data,
              routeNo,
            });
          } else {
            // 새로운 API
            return DaeguBusAPI.getRealtime(stop.bsId, routeNo)
              .then((data) => {
                // 응답이 성공한 경우만 캐시에 저장
                if (data && data.header && data.header.success) {
                  arrivalCache[arrivalCacheKey] = {
                    data,
                    timestamp: now,
                  };
                }
                return { data, routeNo };
              })
              .catch((err) => {
                console.error(`${routeNo} 도착 정보 조회 오류:`, err);
                return { data: null, routeNo };
              });
          }
        });

        // 배치 처리 - 각 배치가 완료된 후 다음 배치 처리
        const batchResults = await Promise.all(batchPromises);
        allResults.push(...batchResults);

        // 배치 간 짧은 지연 (API 서버 부하 방지)
        if (i + batchSize < routeNos.length) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      // 3. 각 응답에서 도착 예정 정보를 추출
      const arrivalStrings = allResults.map(({ data, routeNo }) => {
        if (!data || !data.header || !data.header.success) {
          return `${routeNo}: 도착 예정 정보 없음`;
        }

        const items = data.body?.items;
        if (!items || items.length === 0) {
          return `${routeNo}: 도착 예정 정보 없음`;
        }

        // 해당 노선 찾기
        const routeItem =
          items.find((item: any) => item.routeNo === routeNo) || items[0];

        // arrList 처리
        let arrData = routeItem.arrList;
        if (!arrData) {
          return `${routeNo}: 도착 예정 정보 없음`;
        }

        if (!Array.isArray(arrData)) {
          arrData = [arrData];
        }

        const info = arrData
          .map((item: any) => `${item.bsNm} (${item.arrState})`)
          .join(" | ");
        return `${routeNo}: ${info || "도착 예정 정보 없음"}`;
      });

      const validArrivalStrings = arrivalStrings.filter(
        (s) => !s.endsWith("도착 예정 정보 없음")
      );

      let resultText;
      if (validArrivalStrings.length > 0) {
        resultText = validArrivalStrings.join("    ");
      } else {
        resultText = "현재 도착 예정인 버스가 없습니다.";
      }

      // 결과 텍스트 설정 및 캐싱
      setArrivalText(resultText);
      arrivalCache[allRoutesKey] = {
        data: resultText,
        timestamp: now,
      };

      // 마지막 갱신 시간 업데이트
      setLastRefreshed(new Date());
    } catch (error) {
      console.error("도착정보 조회 오류:", error);
      setArrivalText("도착정보 조회 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [stop]);

  // 정류장이 변경되면 도착 정보 갱신
  useEffect(() => {
    if (stop) {
      refreshArrivalInfo();

      // 1분마다 자동 갱신
      const intervalId = setInterval(refreshArrivalInfo, 60000);
      return () => clearInterval(intervalId);
    }
  }, [stop, refreshArrivalInfo]);

  if (!stop) {
    return (
      <div className="border rounded-lg p-4">
        <div className="text-gray-500">정류장을 선택해주세요</div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-xl font-semibold">정류장 정보</h2>
        <button
          onClick={refreshArrivalInfo}
          disabled={loading}
          className="text-blue-500 hover:text-blue-700 flex items-center text-sm"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`mr-1 ${loading ? "animate-spin" : ""}`}
          >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          갱신
        </button>
      </div>
      <div className="space-y-2">
        <div>
          <span className="font-medium">정류장명:</span> {stop.bsNm}
        </div>
        <div>
          <span className="font-medium">정류소 ID:</span> {stop.bsId}
        </div>
        <div>
          <span className="font-medium">순서:</span> {stop.seq}
        </div>
        <div>
          <span className="font-medium">위치:</span>
          <div className="text-sm text-gray-600">
            <div>위도: {stop.yPos}</div>
            <div>경도: {stop.xPos}</div>
          </div>
        </div>
        {lastRefreshed && (
          <div className="text-xs text-gray-500 mt-1">
            마지막 갱신: {lastRefreshed.toLocaleTimeString()}
          </div>
        )}
      </div>
      {loading ? (
        <div className="mt-4 flex items-center justify-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-gray-600">도착 정보를 불러오는 중...</span>
        </div>
      ) : (
        <DigitalSign arrivalText={arrivalText} />
      )}
    </div>
  );
};

export default ArrivalInfo;
