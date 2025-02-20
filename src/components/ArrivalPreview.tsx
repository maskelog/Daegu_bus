"use client";

import DigitalSign from "./DigitalSign";
import { DaeguBusAPI } from "@/api/DaeguBusAPI";
import { Stop } from "@/types";
import { RefreshCw } from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";

// 도착 정보 캐시 - API 호출 최소화
interface CacheItem {
  data: any;
  timestamp: number;
}

// 정류장 정보 타입
interface StationInfo {
  bsId: string;
  bsNm: string;
  seq: number;
  moveDir: string;
}

// 캐시 유효 시간 (단위: ms)
const CACHE_TTL = 60 * 1000; // 1분
const ALL_ROUTES_CACHE_TTL = 120 * 1000; // 2분
const ROUTE_INFO_CACHE_TTL = 60 * 60 * 1000; // 1시간

// 정적 캐시 객체
const arrivalCache: Record<string, CacheItem> = {};
const routeStationsCache: Record<string, CacheItem> = {};

// 버스 도착 정보 인터페이스
interface BusArrival {
  routeNumber: string;
  routeId?: string;
  buses: Array<{
    stops: string; // "6개소전 (정류장명)" 형식
    stopsNumber: number;
    time: string;
    timeType: string;
    stationName?: string;
    moveDir?: string;
  }>;
}

interface ArrivalPreviewProps {
  stop: Stop;
}

// 정류장 개수 텍스트 포맷팅 함수
const formatStopsText = (stopsNumber: number): string => {
  if (stopsNumber <= 0) return "곧 도착";
  if (stopsNumber === 1) return "전";
  if (stopsNumber === 2) return "전전";
  return `${stopsNumber}개소전`;
};

/**
 * 현재 선택된 정류장(stop)와 getBs로 불러온 정류장 목록(stations)을 이용하여,
 * 남은 정류소 수(stopsGap)만큼 떨어진 다음 정류장을 찾는 함수.
 * 매칭 실패 시, stop.bsNm과 유사한 항목으로 대체합니다.
 */
const findNextStation = (
  stations: StationInfo[],
  selectedStop: Stop,
  stopsGap: number,
  moveDir: string
): StationInfo | null => {
  // 우선, bsId와 moveDir으로 찾기 시도
  let currentStation = stations.find(
    (s) => s.bsId === selectedStop.bsId && s.moveDir === moveDir
  );
  // bsId 매칭 실패 시, 정류장 이름 기준으로 찾되, moveDir 조건을 추가합니다.
  if (!currentStation) {
    currentStation = stations.find(
      (s) =>
        (s.bsNm.toLowerCase().includes(selectedStop.bsNm.toLowerCase()) ||
          selectedStop.bsNm.toLowerCase().includes(s.bsNm.toLowerCase())) &&
        s.moveDir === moveDir
    );
  }
  if (!currentStation) return null;
  // 같은 방향의 정류장 목록(seq 기준 정렬)
  const directionStations = stations
    .filter((s) => s.moveDir === moveDir)
    .sort((a, b) => a.seq - b.seq);
  const currentIndex = directionStations.findIndex(
    (s) => s.bsId === currentStation!.bsId
  );
  if (currentIndex === -1) return null;
  const targetIndex = currentIndex + stopsGap;
  return targetIndex < directionStations.length
    ? directionStations[targetIndex]
    : null;
};

const ArrivalPreview: React.FC<ArrivalPreviewProps> = ({ stop }) => {
  const [arrivals, setArrivals] = useState<BusArrival[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  // 노선별 정류장 정보를 조회 (캐시 사용)
  const fetchRouteStations = useCallback(
    async (routeId: string): Promise<StationInfo[]> => {
      const now = Date.now();
      const cacheKey = `route_stations_${routeId}`;
      if (
        routeStationsCache[cacheKey] &&
        now - routeStationsCache[cacheKey].timestamp < ROUTE_INFO_CACHE_TTL
      ) {
        return routeStationsCache[cacheKey].data;
      }
      try {
        const stationsData = await DaeguBusAPI.getBs(routeId);
        let stationsList: StationInfo[] = [];
        if (stationsData?.body?.items) {
          const items = Array.isArray(stationsData.body.items)
            ? stationsData.body.items
            : [stationsData.body.items];
          stationsList = items.map((station: any) => ({
            bsId: station.bsId,
            bsNm: station.bsNm,
            seq: parseInt(station.seq) || 0,
            moveDir: String(station.moveDir || "0"),
          }));
          stationsList.sort((a, b) => a.seq - b.seq);
        }
        routeStationsCache[cacheKey] = { data: stationsList, timestamp: now };
        return stationsList;
      } catch (error) {
        console.error(`노선 정류장 정보 조회 오류(${routeId}):`, error);
        return [];
      }
    },
    []
  );

  // 정류장 이름 찾기 함수: 선택된 정류장에서 stopsGap만큼 떨어진 다음 정류장의 이름 반환
  const findStationName = useCallback(
    async (
      routeId: string,
      stopsGap: number,
      moveDir: string
    ): Promise<string | undefined> => {
      if (!routeId) return undefined;
      try {
        const stations = await fetchRouteStations(routeId);
        if (!stations || stations.length === 0) return undefined;
        // selectedStop의 moveDir을 실제 도착정보의 moveDir으로 덮어씁니다.
        const adjustedStop = { ...stop, moveDir };
        const nextStation = findNextStation(
          stations,
          adjustedStop,
          stopsGap,
          moveDir
        );
        return nextStation ? nextStation.bsNm : undefined;
      } catch (error) {
        console.error("정류장 이름 찾기 오류:", error);
        return undefined;
      }
    },
    [fetchRouteStations, stop]
  );

  // 현재 시간 포맷팅 함수
  const formatDate = (date: Date): string =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(date.getDate()).padStart(2, "0")} ${String(
      date.getHours()
    ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

  // 도착 정보 갱신 함수
  const refreshArrivalInfo = useCallback(async () => {
    setLoading(true);
    try {
      const now = Date.now();
      const allRoutesKey = `all_arrivals_${stop.bsId}`;
      const cachedAllArrivals = arrivalCache[allRoutesKey];
      if (
        cachedAllArrivals &&
        now - cachedAllArrivals.timestamp < ALL_ROUTES_CACHE_TTL
      ) {
        console.log("전체 도착 정보 캐시 사용:", allRoutesKey);
        setArrivals(cachedAllArrivals.data);
        setLastUpdate(formatDate(new Date(cachedAllArrivals.timestamp)));
        setLoading(false);
        return;
      }

      // 정류소별 경유 노선 목록 조회 (국토교통부 API)
      const routeListCacheKey = `routes_${stop.bsId}`;
      let routeListData;
      const cachedRouteList = arrivalCache[routeListCacheKey];
      if (cachedRouteList && now - cachedRouteList.timestamp < CACHE_TTL) {
        routeListData = cachedRouteList.data;
        console.log("노선 목록 캐시 사용:", routeListCacheKey);
      } else {
        const nodeid = "DGB" + stop.bsId; // DGB 접두어 추가
        routeListData = await DaeguBusAPI.getSttnThrghRouteList(nodeid);
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
        setArrivals([]);
        setLoading(false);
        return;
      }

      let items: any = routeListData.response.body.items.item;
      if (!Array.isArray(items)) {
        items = [items];
      }

      // 각 항목에서 노선번호와 노선ID 추출
      const routeInfos: Array<{ routeNo: string; routeId: string }> = items.map(
        (item: any) => ({
          routeNo: String(item.routeno),
          routeId: String(item.routeid || ""),
        })
      );
      if (routeInfos.length === 0) {
        setArrivals([]);
        setLoading(false);
        return;
      }

      // 미리 각 노선별 정류장 정보 조회 (캐시 사용)
      const routeStationsPromises = routeInfos
        .filter((info) => info.routeId && info.routeId !== "undefined")
        .map((info) => fetchRouteStations(info.routeId));
      await Promise.allSettled(routeStationsPromises);

      // 중복 노선 번호 제거 및 노선번호-노선ID 매핑
      const uniqueRouteNos = [
        ...new Set(routeInfos.map((info) => info.routeNo)),
      ];
      console.log("조회할 노선 목록:", uniqueRouteNos);
      const routeNoToIdMap: Record<string, string> = {};
      routeInfos.forEach((info) => {
        if (info.routeId && info.routeId !== "undefined") {
          routeNoToIdMap[info.routeNo] = info.routeId;
        }
      });

      // 각 노선별 도착 정보 조회 (배치 처리)
      const batchSize = 3;
      const allResults = [];
      for (let i = 0; i < uniqueRouteNos.length; i += batchSize) {
        const batchRouteNos = uniqueRouteNos.slice(i, i + batchSize);
        const batchPromises = batchRouteNos.map((routeNo) => {
          const arrivalCacheKey = `arrival_${stop.bsId}_${routeNo}`;
          const cachedArrival = arrivalCache[arrivalCacheKey];
          if (cachedArrival && now - cachedArrival.timestamp < CACHE_TTL) {
            console.log("도착 정보 캐시 사용:", arrivalCacheKey);
            return Promise.resolve({
              data: cachedArrival.data,
              routeNo,
              routeId: routeNoToIdMap[routeNo],
            });
          } else {
            return DaeguBusAPI.getRealtime(stop.bsId, routeNo)
              .then((data) => {
                if (data && data.header && data.header.success) {
                  arrivalCache[arrivalCacheKey] = { data, timestamp: now };
                }
                return { data, routeNo, routeId: routeNoToIdMap[routeNo] };
              })
              .catch((err) => {
                console.error(`${routeNo} 도착 정보 조회 오류:`, err);
                return {
                  data: null,
                  routeNo,
                  routeId: routeNoToIdMap[routeNo],
                };
              });
          }
        });
        const batchResults = await Promise.all(batchPromises);
        allResults.push(...batchResults);
        if (i + batchSize < uniqueRouteNos.length) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      // 도착 예정 정보 추출 및 포맷팅
      const processedBusNumbers = new Set();
      const formattedArrivalsPromises = allResults
        .filter(({ data }) => data && data.header && data.header.success)
        .flatMap(({ data, routeNo, routeId }) => {
          if (processedBusNumbers.has(routeNo)) return [];
          processedBusNumbers.add(routeNo);
          const items = data.body?.items;
          if (!items || (Array.isArray(items) && items.length === 0)) return [];
          const routeItem =
            (Array.isArray(items)
              ? items.find((item: any) => String(item.routeNo) === routeNo)
              : items) || (Array.isArray(items) ? items[0] : items);
          let arrData = routeItem.arrList;
          if (!arrData) return [];
          if (!Array.isArray(arrData)) arrData = [arrData];
          // 중복 도착 정보 제거
          const uniqueArrData = arrData.filter(
            (bus: any, index: number, self: any[]) =>
              index ===
              self.findIndex(
                (b) =>
                  b.DESTINATION === bus.DESTINATION &&
                  b.bsGap === bus.bsGap &&
                  b.arrState === bus.arrState
              )
          );
          if (uniqueArrData.length === 0) return [];
          // 각 버스 도착정보 전처리: 정류장 이름 추가
          const processedBusesPromises = uniqueArrData.map(async (bus: any) => {
            const stopsNumber = parseInt(bus.bsGap) || 0;
            const timeMinutes = parseInt(
              bus.arrState?.replace(/[^0-9]/g, "") || "999"
            );
            const moveDir = bus.moveDir || "0";
            const stationName = bus.bsNm;
            return {
              stopsNumber,
              timeMinutes,
              timeText: bus.arrState || "",
              stationName,
              moveDir,
            };
          });
          return Promise.all(processedBusesPromises).then((processedBuses) => {
            const sortedByDistance = processedBuses.sort(
              (a, b) => a.stopsNumber - b.stopsNumber
            );
            const maxBusesToShow = 3;
            const busesInfo = sortedByDistance
              .slice(0, maxBusesToShow)
              .map((busInfo) => ({
                // 정류장 남은 수와 함께 다음 정류장 이름을 표시
                stops: `${formatStopsText(busInfo.stopsNumber)} ${
                  busInfo.stationName || "정류장 정보 없음"
                }`,
                stopsNumber: busInfo.stopsNumber,
                time: busInfo.timeText,
                timeType: "도착예정",
                stationName: busInfo.stationName,
                moveDir: busInfo.moveDir,
              }));
            const firstBusTime =
              processedBuses.length > 0
                ? Math.min(...processedBuses.map((b) => b.timeMinutes))
                : 999;
            return {
              routeNumber: routeNo,
              routeId,
              buses: busesInfo,
              _firstBusTime: firstBusTime,
            };
          });
        });
      const formattedArrivalsResults = await Promise.all(
        formattedArrivalsPromises
      );
      const sortedArrivals = formattedArrivalsResults
        .sort((a, b) => a._firstBusTime - b._firstBusTime)
        .map(({ _firstBusTime, ...rest }) => rest);
      console.log(`총 ${sortedArrivals.length}개 노선 정보 로드됨`);
      setArrivals(sortedArrivals);
      arrivalCache[`all_arrivals_${stop.bsId}`] = {
        data: sortedArrivals,
        timestamp: now,
      };
      setLastUpdate(formatDate(new Date(now)));
    } catch (error) {
      console.error("도착정보 조회 오류:", error);
      setArrivals([]);
    } finally {
      setLoading(false);
    }
  }, [stop, fetchRouteStations, findStationName]);

  useEffect(() => {
    refreshArrivalInfo();
    const intervalId = setInterval(refreshArrivalInfo, 60000);
    return () => clearInterval(intervalId);
  }, [stop, refreshArrivalInfo]);

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
              <div className="mb-2">
                <div className="font-medium text-blue-600 text-lg">
                  {bus.routeNumber}
                </div>
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
