"use client";

import DigitalSign from "./DigitalSign";
import { DaeguBusAPI } from "@/api/DaeguBusAPI";
import { Stop } from "@/types";
import React, { useState, useEffect } from "react";

interface ArrivalInfoProps {
  stop: Stop | null;
}

const ArrivalInfo: React.FC<ArrivalInfoProps> = ({ stop }) => {
  const [arrivalText, setArrivalText] =
    useState("실시간 도착 정보가 없습니다.");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (stop) {
      const fetchArrivalForStop = async () => {
        setLoading(true);
        try {
          // 국토교통부 API 호출을 위한 nodeid 생성: 정류장 bsId 앞에 "DGB" 추가
          const nodeid = "DGB" + stop.bsId;
          // 1. 정류소별 경유 노선 정보 조회 API 호출
          const routeListData = await DaeguBusAPI.getSttnThrghRouteList(nodeid);
          console.log(
            "getSttnThrghRouteList 응답:",
            JSON.stringify(routeListData)
          );

          if (
            !routeListData?.response ||
            !routeListData.response.body ||
            !routeListData.response.body.items ||
            !routeListData.response.body.items.item
          ) {
            console.error("정류소별 경유 노선 정보 누락:", routeListData);
            setArrivalText(
              "정류소별 경유 노선 정보가 없습니다. API 응답: " +
                JSON.stringify(routeListData)
            );
            setLoading(false);
            return;
          }

          let items: any = routeListData.response.body.items.item;
          if (!Array.isArray(items)) {
            items = [items];
          }
          // 각 항목에서 routeno(버스 번호)를 추출
          const routeNos: string[] = items.map((item: any) =>
            String(item.routeno)
          );
          console.log("추출된 routeNos:", routeNos);

          if (routeNos.length === 0) {
            setArrivalText("해당 정류장을 지나는 버스 노선이 없습니다.");
            setLoading(false);
            return;
          }

          // 2. 각 노선 번호에 대해 정류소별 버스 도착예정정보 조회 API(getRealtime) 호출
          const realtimePromises = routeNos.map((rNo: string) =>
            DaeguBusAPI.getRealtime(stop.bsId, rNo)
          );
          const realtimeResults = await Promise.all(realtimePromises);
          console.log("getRealtime 응답들:", JSON.stringify(realtimeResults));

          // 3. 각 응답에서 도착 예정 정보를 추출
          const arrivalStrings = realtimeResults.map(
            (data: any, idx: number) => {
              if (!data || !data.header || !data.header.success) {
                return `${routeNos[idx]}: 도착 예정 정보 없음`;
              }

              const items = data.body?.items;
              if (!items || items.length === 0) {
                return `${routeNos[idx]}: 도착 예정 정보 없음`;
              }

              // 해당 노선 찾기
              const routeItem =
                items.find((item: any) => item.routeNo === routeNos[idx]) ||
                items[0];

              // arrList 처리
              let arrData = routeItem.arrList;
              if (!arrData) {
                return `${routeNos[idx]}: 도착 예정 정보 없음`;
              }

              if (!Array.isArray(arrData)) {
                arrData = [arrData];
              }

              const info = arrData
                .map((item: any) => `${item.bsNm} (${item.arrState})`)
                .join(" | ");
              return `${routeNos[idx]}: ${info || "도착 예정 정보 없음"}`;
            }
          );

          const validArrivalStrings = arrivalStrings.filter(
            (s) => !s.endsWith("도착 예정 정보 없음")
          );

          if (validArrivalStrings.length > 0) {
            const combinedArrival = validArrivalStrings.join("    ");
            setArrivalText(combinedArrival);
          } else {
            setArrivalText("현재 도착 예정인 버스가 없습니다.");
          }
        } catch (error) {
          console.error("도착정보 조회 오류:", error);
          setArrivalText("도착정보 조회 오류: " + error);
        } finally {
          setLoading(false);
        }
      };
      fetchArrivalForStop();
    }
  }, [stop]);

  if (!stop) {
    return (
      <div className="border rounded-lg p-4">
        <div className="text-gray-500">정류장을 선택해주세요</div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4">
      <h2 className="text-xl font-semibold mb-4">정류장 정보</h2>
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
