"use client";

import { DaeguBusAPI } from "@/api/DaeguBusAPI";
import { Stop } from "@/types";
import React, { useState, useEffect, useCallback } from "react";

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

interface ArrivalInfoProps {
  stop: Stop | null;
}

const ArrivalInfo: React.FC<ArrivalInfoProps> = ({ stop }) => {
  const [arrivalInfo, setArrivalInfo] = useState<
    Array<{ number: string; arrival: string; location: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>("");

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
        setArrivalInfo(cachedAllArrivals.data);
        const updateTime = new Date(cachedAllArrivals.timestamp);
        setLastUpdate(
          `${updateTime.getFullYear()}-${String(
            updateTime.getMonth() + 1
          ).padStart(2, "0")}-${String(updateTime.getDate()).padStart(
            2,
            "0"
          )} ${String(updateTime.getHours()).padStart(2, "0")}:${String(
            updateTime.getMinutes()
          ).padStart(2, "0")}`
        );
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
        setArrivalInfo([]);
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
        setArrivalInfo([]);
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
      const formattedArrivals = allResults
        .filter(({ data }) => data && data.header && data.header.success)
        .flatMap(({ data, routeNo }) => {
          const items = data.body?.items;
          if (!items || items.length === 0) return [];

          // 해당 노선 찾기
          const routeItem =
            items.find((item: any) => item.routeNo === routeNo) || items[0];

          // arrList 처리
          let arrData = routeItem.arrList;
          if (!arrData) return [];

          if (!Array.isArray(arrData)) {
            arrData = [arrData];
          }

          return arrData.map((item: any) => ({
            number: routeNo,
            arrival: item.arrState,
            location: `${item.bsGap}정거장 전`,
          }));
        })
        .sort((a, b) => {
          // 도착 시간 기준 정렬 (숫자만 추출)
          const aTime = parseInt(a.arrival.replace(/[^0-9]/g, "") || "999");
          const bTime = parseInt(b.arrival.replace(/[^0-9]/g, "") || "999");
          return aTime - bTime;
        });

      // 결과 설정 및 캐싱
      setArrivalInfo(formattedArrivals);
      arrivalCache[allRoutesKey] = {
        data: formattedArrivals,
        timestamp: now,
      };

      // 현재 시간을 YYYY-MM-DD HH:MM 형식으로 저장
      const updateTime = new Date();
      const formattedDate = `${updateTime.getFullYear()}-${String(
        updateTime.getMonth() + 1
      ).padStart(2, "0")}-${String(updateTime.getDate()).padStart(
        2,
        "0"
      )} ${String(updateTime.getHours()).padStart(2, "0")}:${String(
        updateTime.getMinutes()
      ).padStart(2, "0")}`;

      setLastUpdate(formattedDate);
    } catch (error) {
      console.error("도착정보 조회 오류:", error);
      setArrivalInfo([]);
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
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="text-gray-500 text-center py-8">
          정류장을 선택해주세요
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-medium text-lg">{stop.bsNm}</h3>
          {/* <p className="text-sm text-gray-500">정류장 번호: {stop.bsId}</p> */}
        </div>
        <button
          className="text-gray-400 p-2"
          onClick={refreshArrivalInfo}
          disabled={loading}
        >
          <i
            className={`fas ${loading ? "fa-sync fa-spin" : "fa-sync-alt"}`}
          ></i>
        </button>
      </div>

      {loading && arrivalInfo.length === 0 ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : arrivalInfo.length === 0 ? (
        <div className="bg-gray-50 p-4 rounded text-center text-gray-500">
          현재 도착 예정인 버스가 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {arrivalInfo.map((bus, index) => (
            <div
              key={index}
              className="flex justify-between items-center bg-gray-50 p-3 rounded"
            >
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <i className="fas fa-bus text-blue-600"></i>
                </div>
                <div className="ml-3">
                  <p className="font-medium">{bus.number}</p>
                  <p className="text-sm text-gray-500">{bus.location}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-medium text-blue-600">
                  {bus.arrival}
                </p>
                <p className="text-xs text-gray-500">도착예정</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ArrivalInfo;
