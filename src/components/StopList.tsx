"use client";

import { Stop } from "@/types";
import { Search } from "lucide-react";
import React from "react";

interface StopListProps {
  stops: Stop[];
  loading: boolean;
  selectedStop: Stop | null;
  onSelectStop: (stop: Stop) => void;
}

export const StopList = ({
  stops,
  loading,
  selectedStop,
  onSelectStop,
}: StopListProps) => {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Search className="w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="정류장 검색..."
          className="w-full p-2 border rounded"
        />
      </div>
      <div className="h-[600px] overflow-y-auto">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        ) : (
          <div className="space-y-2">
            {stops.map((stop) => (
              <div
                key={stop._id}
                className={`p-3 border rounded cursor-pointer hover:bg-gray-50 ${
                  selectedStop?._id === stop._id
                    ? "bg-blue-50 border-blue-200"
                    : ""
                }`}
                onClick={() => onSelectStop(stop)}
              >
                <div className="font-medium">{stop.name}</div>
                <div className="text-sm text-gray-500">
                  정류장 번호: {stop.stopNo}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
