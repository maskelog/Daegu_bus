"use client";

import { Stop } from "@/types";
import React from "react";

interface ArrivalInfoProps {
  stop: Stop | null;
}

export const ArrivalInfo = ({ stop }: ArrivalInfoProps) => {
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
          <span className="font-medium">정류장명:</span> {stop.name}
        </div>
        <div>
          <span className="font-medium">정류장 번호:</span> {stop.stopNo}
        </div>
        <div>
          <span className="font-medium">위치:</span>
          <div className="text-sm text-gray-600">
            <div>위도: {stop.geo_y}</div>
            <div>경도: {stop.geo_x}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
