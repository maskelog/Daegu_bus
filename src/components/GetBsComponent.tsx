"use client";

import { DaeguBusAPI } from "@/api/DaeguBusAPI";
import React, { useEffect, useState } from "react";

interface Station {
  bsId: string;
  bsNm: string;
  seq: number;
  moveDir: string;
}

interface RouteMapping {
  [routeNo: string]: string;
}

interface GetBsComponentProps {
  stopId: string; // 정류소 ID (예: "7021023900")
}

const GetBsComponent: React.FC<GetBsComponentProps> = ({ stopId }) => {
  const [stations, setStations] = useState<Station[]>([]);
  const [routeMapping, setRouteMapping] = useState<RouteMapping>({});
  const [selectedRouteNo, setSelectedRouteNo] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 1. 해당 정류소(stopId)에 도착하는 버스들의 노선번호와 routeId 매핑 정보를 가져오기
  useEffect(() => {
    async function fetchRouteMapping() {
      try {
        // 정류소별 경유 노선 조회: nodeid는 "DGB" 접두어가 붙은 값
        const nodeid = "DGB" + stopId;
        const routeListData = await DaeguBusAPI.getSttnThrghRouteList(nodeid);
        if (
          routeListData &&
          routeListData.response &&
          routeListData.response.body &&
          routeListData.response.body.items &&
          routeListData.response.body.items.item
        ) {
          let items = routeListData.response.body.items.item;
          if (!Array.isArray(items)) {
            items = [items];
          }
          const mapping: RouteMapping = {};
          items.forEach((item: any) => {
            // 매핑: 노선번호 -> routeId
            mapping[String(item.routeno)] = String(item.routeid || "");
          });
          setRouteMapping(mapping);
          // 도착하는 버스 노선 번호 목록이 있다면 첫 번째를 기본 선택합니다.
          const routeNos = Object.keys(mapping);
          if (routeNos.length > 0) {
            setSelectedRouteNo(routeNos[0]);
          } else {
            setError("해당 정류소에 도착하는 버스 노선 정보가 없습니다.");
          }
        } else {
          setError("정류소별 노선 정보가 조회되지 않았습니다.");
        }
      } catch (err) {
        console.error("노선 정보 조회 오류:", err);
        setError("노선 정보를 가져오는 중 오류가 발생했습니다.");
      }
    }
    fetchRouteMapping();
  }, [stopId]);

  // 2. 선택된 버스 노선의 routeId를 사용해 전체 정류장 목록 가져오기
  useEffect(() => {
    async function fetchStations() {
      if (!selectedRouteNo) return;
      const routeId = routeMapping[selectedRouteNo];
      if (!routeId) {
        setError("선택된 노선의 routeId를 찾을 수 없습니다.");
        setLoading(false);
        return;
      }
      try {
        const data = await DaeguBusAPI.getBs(routeId);
        let stationList: Station[] = [];
        if (data && data.body && data.body.items) {
          let items = data.body.items;
          if (!Array.isArray(items)) {
            items = [items];
          }
          stationList = items.map((station: any) => ({
            bsId: station.bsId,
            bsNm: station.bsNm,
            seq: parseInt(station.seq) || 0,
            moveDir: String(station.moveDir || "0"),
          }));
          stationList.sort((a, b) => a.seq - b.seq);
        }
        setStations(stationList);
      } catch (err) {
        console.error("정류장 정보 조회 오류:", err);
        setError("정류장 정보를 가져오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }
    if (Object.keys(routeMapping).length > 0 && selectedRouteNo) {
      fetchStations();
    }
  }, [selectedRouteNo, routeMapping]);

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">
        정류장 목록 (노선번호: {selectedRouteNo}, routeId:{" "}
        {routeMapping[selectedRouteNo]})
      </h2>
      {loading ? (
        <p>정류장 정보를 불러오는 중...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : stations.length === 0 ? (
        <p>정류장 정보가 없습니다.</p>
      ) : (
        <ul>
          {stations.map((station) => (
            <li key={station.bsId}>
              {station.bsId} - {station.bsNm} (순서: {station.seq})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default GetBsComponent;
