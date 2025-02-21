"use client";

import { DaeguBusAPI } from "@/api/DaeguBusAPI";
import { Stop } from "@/types";
import { RefreshCw } from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";

interface CacheItem {
  data: any;
  timestamp: number;
}

const CACHE_TTL = 60 * 1000; // 1분
const ALL_ROUTES_CACHE_TTL = 120 * 1000; // 2분
const ROUTE_INFO_CACHE_TTL = 60 * 60 * 1000; // 1시간

const arrivalCache: Record<string, CacheItem> = {};

interface BusArrival {
  routeNumber: string;
  routeId?: string;
  buses: Array<{
    stops: string;
    stopsNumber: number;
    time: string;
    timeType: string;
    stationName?: string;
    moveDir?: string;
  }>;
}

interface ArrivalPreviewProps {
  stop: Stop;
  simplified?: boolean;
}

const formatStopsText = (stopsNumber: number): string => {
  if (stopsNumber <= 0) return "곧 도착";
  if (stopsNumber === 1) return "전";
  if (stopsNumber === 2) return "전전";
  return `${stopsNumber}개소전`;
};

const formatDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")} ${String(
    date.getHours()
  ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

const ArrivalPreview: React.FC<ArrivalPreviewProps> = ({
  stop,
  simplified,
}) => {
  const [arrivals, setArrivals] = useState<BusArrival[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  const refreshArrivalInfo = useCallback(async () => {
    setLoading(true);
    try {
      const now = Date.now();
      const allRoutesKey = `all_arrivals_${stop.bsId}`;
      const cachedAll = arrivalCache[allRoutesKey];
      if (cachedAll && now - cachedAll.timestamp < ALL_ROUTES_CACHE_TTL) {
        console.log("전체 도착 정보 캐시 사용:", allRoutesKey);
        setArrivals(cachedAll.data);
        setLastUpdate(formatDate(new Date(cachedAll.timestamp)));
        setLoading(false);
        return;
      }

      // 1. 정류소별 경유 노선 목록 조회 (국토교통부 API)
      const nodeid = "DGB" + stop.bsId;
      const routeListData = await DaeguBusAPI.getSttnThrghRouteList(nodeid);
      if (!routeListData?.response?.body?.items?.item) {
        console.error("정류소별 경유 노선 정보 누락:", routeListData);
        setArrivals([]);
        setLoading(false);
        return;
      }
      let items: any = routeListData.response.body.items.item;
      if (!Array.isArray(items)) items = [items];
      const routeInfos: { routeNo: string; routeId: string }[] = items.map(
        (item: any): { routeNo: string; routeId: string } => ({
          routeNo: String(item.routeno),
          routeId: String(item.routeid || ""),
        })
      );
      if (routeInfos.length === 0) {
        setArrivals([]);
        setLoading(false);
        return;
      }
      const uniqueRouteNos: string[] = [
        ...new Set(routeInfos.map((info) => info.routeNo)),
      ];
      console.log("조회할 노선 목록:", uniqueRouteNos);
      const routeNoToId: Record<string, string> = {};
      routeInfos.forEach((info) => {
        if (info.routeId && info.routeId !== "undefined") {
          routeNoToId[info.routeNo] = info.routeId;
        }
      });

      // 2. realtime API 호출 시, 화면에 표시된 stop.bsId를 그대로 사용
      const realtimeBsId: string = stop.bsId;

      // 3. 각 노선별 도착정보 조회 (배치 처리)
      const batchSize: number = 3;
      const allResults: Array<{ data: any; routeNo: string; routeId: string }> =
        [];
      for (let i = 0; i < uniqueRouteNos.length; i += batchSize) {
        const batchRouteNos: string[] = uniqueRouteNos.slice(i, i + batchSize);
        const batchPromises = batchRouteNos.map((routeNo: string) => {
          const cacheKey = `arrival_${stop.bsId}_${routeNo}`;
          const cached = arrivalCache[cacheKey];
          if (cached && now - cached.timestamp < CACHE_TTL) {
            console.log("도착 정보 캐시 사용:", cacheKey);
            return Promise.resolve({
              data: cached.data,
              routeNo,
              routeId: routeNoToId[routeNo],
            });
          } else {
            return DaeguBusAPI.getRealtime(realtimeBsId, routeNo)
              .then((data) => {
                if (data && data.header && data.header.success) {
                  arrivalCache[cacheKey] = { data, timestamp: now };
                }
                return { data, routeNo, routeId: routeNoToId[routeNo] };
              })
              .catch((err) => {
                console.error(`${routeNo} 도착 정보 조회 오류:`, err);
                return { data: null, routeNo, routeId: routeNoToId[routeNo] };
              });
          }
        });
        const batchResults = await Promise.all(batchPromises);
        allResults.push(...batchResults);
        if (i + batchSize < uniqueRouteNos.length) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      // 4. 도착 정보 파싱 및 포맷팅
      const busArrivals: BusArrival[] = [];
      allResults.forEach(({ data, routeNo, routeId }) => {
        if (data && data.header && data.header.success) {
          let items = data.body?.items;
          if (!items) return;
          if (!Array.isArray(items)) items = [items];
          items.forEach((item: any) => {
            let arrList = item.arrList;
            if (!arrList) return;
            // 만약 arrList가 객체 형태라면 내부의 arrList 배열 추출
            if (
              typeof arrList === "object" &&
              !Array.isArray(arrList) &&
              arrList.arrList
            ) {
              arrList = arrList.arrList;
            }
            if (!Array.isArray(arrList)) arrList = [arrList];
            const buses = arrList.map((bus: any) => {
              const stopsNumber = parseInt(bus.bsGap) || 0;
              const timeText = bus.arrState || "";
              const stationName = bus.bsNm;
              return {
                stops: `${formatStopsText(stopsNumber)} ${stationName}`,
                stopsNumber,
                time: timeText,
                timeType: "도착예정",
                stationName,
                moveDir: bus.moveDir || "0",
              };
            });
            if (buses.length > 0) {
              busArrivals.push({
                routeNumber: routeNo,
                routeId,
                buses,
              });
            }
          });
        }
      });

      console.log(`총 ${busArrivals.length}개 노선 정보 로드됨`);
      setArrivals(busArrivals);
      arrivalCache[allRoutesKey] = { data: busArrivals, timestamp: now };
      setLastUpdate(formatDate(new Date(now)));
    } catch (error) {
      console.error("도착정보 조회 오류:", error);
      setArrivals([]);
    } finally {
      setLoading(false);
    }
  }, [stop]);

  useEffect(() => {
    refreshArrivalInfo();
    const intervalId = setInterval(refreshArrivalInfo, 60000);
    return () => clearInterval(intervalId);
  }, [stop, refreshArrivalInfo]);

  if (simplified) {
    // 간략 모드: 배지 형태로 버스번호와 첫 도착시간만 표시
    return (
      <div className="flex flex-wrap gap-2">
        {loading && arrivals.length === 0 ? (
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        ) : arrivals.length === 0 ? (
          <div className="text-gray-500 text-sm">정보 없음</div>
        ) : (
          arrivals.map((bus, index) => {
            const firstBus = bus.buses[0];
            if (!firstBus) return null;
            return (
              <div
                key={index}
                className="inline-flex items-center px-3 py-1 bg-blue-600 text-white rounded-full text-sm"
              >
                <span className="font-semibold mr-1">{bus.routeNumber}</span>
                <span>{firstBus.time}</span>
              </div>
            );
          })
        )}
      </div>
    );
  }

  // 상세 모드
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-medium text-lg">{stop.bsNm}</h3>
          <p className="text-xs text-gray-500">
            {lastUpdate && `최근 업데이트: ${lastUpdate}`}
          </p>
        </div>
        <button
          className="text-gray-400 p-2"
          onClick={refreshArrivalInfo}
          disabled={loading}
        >
          <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      {loading && arrivals.length === 0 ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : arrivals.length === 0 ? (
        <div className="bg-gray-50 p-4 rounded text-center text-gray-500">
          현재 도착 예정인 버스가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {arrivals.map((bus, index) => (
            <div key={index} className="bg-gray-50 p-3 rounded-lg">
              <div className="mb-2 font-medium text-blue-600 text-lg">
                {bus.routeNumber}
              </div>
              <div className="space-y-2">
                {bus.buses.map((busInfo, busIndex) => (
                  <div
                    key={busIndex}
                    className={
                      busIndex > 0 ? "border-t border-gray-200 pt-2" : ""
                    }
                  >
                    <div className="text-sm font-medium">{busInfo.stops}</div>
                    <div className="flex justify-end text-sm text-blue-800">
                      {busInfo.time}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ArrivalPreview;
