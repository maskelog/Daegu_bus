"use client";

import ArrivalPreview from "./ArrivalPreview";
import FavoriteRoutes from "./FavoriteRoutes";
import { Stop } from "@/types";
import {
  Search,
  Star,
  Home,
  MapPin,
  User,
  Route,
  Settings,
  RefreshCw,
  Plus,
  ChevronRight,
} from "lucide-react";
import React, { useState, useEffect } from "react";

export const BusInfo = () => {
  const [activeTab, setActiveTab] = useState<"stops" | "routes" | "search">(
    "stops"
  );
  const [stops, setStops] = useState<Stop[]>([]);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [favoriteStops, setFavoriteStops] = useState<Stop[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>(
    new Date()
      .toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
      .replace(/\./g, "-")
      .replace(",", "")
  );

  useEffect(() => {
    const loadStops = async () => {
      try {
        const response = await fetch("/response.json");
        const data = await response.json();
        let stopsData = data?.body?.items?.items;
        if (stopsData && !Array.isArray(stopsData)) {
          stopsData = [stopsData];
        }
        setStops(stopsData || []);

        const savedFavorites = localStorage.getItem("favoriteStops");
        if (savedFavorites) {
          setFavoriteStops(JSON.parse(savedFavorites));
        }
      } catch (error) {
        console.error("Error loading stops:", error);
      } finally {
        setLoading(false);
      }
    };
    loadStops();
  }, []);

  const toggleFavorite = (stop: Stop) => {
    const isFav = favoriteStops.some((fav) => fav.bsId === stop.bsId);
    const newFavorites = isFav
      ? favoriteStops.filter((fav) => fav.bsId !== stop.bsId)
      : [...favoriteStops, stop];
    setFavoriteStops(newFavorites);
    localStorage.setItem("favoriteStops", JSON.stringify(newFavorites));
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
      setLastUpdate(
        new Date()
          .toLocaleString("ko-KR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
          .replace(/\./g, "-")
          .replace(",", "")
      );
    }, 60000);
    return () => clearInterval(intervalId);
  }, []);

  const filteredStops = stops.filter(
    (stop) =>
      stop.bsNm.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stop.bsId.includes(searchQuery)
  );

  return (
    <div className="relative min-h-screen bg-gray-50">
      {/* Header */}
      <div className="fixed top-0 w-full bg-blue-600 text-white px-4 py-3 z-50">
        <div className="flex justify-between items-center">
          <h1 className="text-lg font-semibold">버스 알림</h1>
          <button className="p-2 rounded-full">
            <Settings className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Segment Control */}
      <div className="mt-14 px-4 py-2">
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            className={`flex-1 py-2 text-sm rounded-md ${
              activeTab === "stops" ? "bg-blue-600 text-white" : "text-gray-600"
            }`}
            onClick={() => setActiveTab("stops")}
          >
            즐겨찾는 정류장
          </button>
          <button
            className={`flex-1 py-2 text-sm rounded-md ${
              activeTab === "routes"
                ? "bg-blue-600 text-white"
                : "text-gray-600"
            }`}
            onClick={() => setActiveTab("routes")}
          >
            즐겨찾는 버스
          </button>
          <button
            className={`flex-1 py-2 text-sm rounded-md ${
              activeTab === "search"
                ? "bg-blue-600 text-white"
                : "text-gray-600"
            }`}
            onClick={() => setActiveTab("search")}
          >
            경로 찾기
          </button>
        </div>
      </div>

      {/* Last Update */}
      <div className="px-4 py-2 text-xs text-gray-500 text-center">
        마지막 업데이트: {lastUpdate}
      </div>

      {/* Content */}
      <div className="px-4 pb-20">
        {activeTab === "search" ? (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="space-y-3">
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="출발지 입력"
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-red-600 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="도착지 입력"
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                </div>
                <button className="w-full bg-blue-600 text-white py-3 font-medium rounded-lg">
                  경로 검색
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === "stops" ? (
          <>
            {selectedStop ? (
              <>
                <div className="flex justify-between items-center mb-4">
                  <button
                    onClick={() => setSelectedStop(null)}
                    className="flex items-center text-blue-600"
                  >
                    <ChevronRight className="w-5 h-5 rotate-180 mr-2" />
                    정류장 목록
                  </button>
                  <button
                    onClick={() => toggleFavorite(selectedStop)}
                    className={`p-2 ${
                      favoriteStops.some(
                        (fav) => fav.bsId === selectedStop.bsId
                      )
                        ? "text-yellow-500"
                        : "text-gray-400"
                    }`}
                  >
                    <Star
                      fill={
                        favoriteStops.some(
                          (fav) => fav.bsId === selectedStop.bsId
                        )
                          ? "currentColor"
                          : "none"
                      }
                      className="w-6 h-6"
                      strokeWidth={1.5}
                    />
                  </button>
                </div>
                {/* 선택된 정류장은 상세 ArrivalPreview (상세 정보 표시) */}
                <ArrivalPreview stop={selectedStop} />
              </>
            ) : (
              <>
                {/* 즐겨찾는 정류장 도착 정보 섹션 - 간단한 배지 형태 */}
                {favoriteStops.length > 0 && (
                  <div className="mb-4">
                    <h2 className="text-lg font-bold mb-2">
                      즐겨찾는 정류장 도착 정보
                    </h2>
                    {favoriteStops.map((stop) => (
                      <div
                        key={stop.bsId}
                        className="mb-3 border rounded p-3 bg-white"
                      >
                        <h3 className="font-medium text-md mb-1">
                          {stop.bsNm}
                        </h3>
                        {/* 즐겨찾는 정류장은 간단 배지 형태로 표시 */}
                        <ArrivalPreview stop={stop} simplified />
                      </div>
                    ))}
                  </div>
                )}

                {/* 검색창 */}
                <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm p-3">
                  <Search className="w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    placeholder="정류장명 또는 번호로 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full p-1 focus:outline-none"
                  />
                </div>

                {/* 전체 정류장 목록 */}
                <div className="bg-white rounded-lg shadow-sm p-4">
                  <h3 className="font-medium text-lg mb-3">정류장 목록</h3>
                  {loading ? (
                    <div className="flex justify-center items-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : filteredStops.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">
                      검색 결과가 없습니다.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                      {filteredStops.map((stop) => (
                        <div
                          key={stop.bsId}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                          onClick={() => setSelectedStop(stop)}
                        >
                          <div className="font-medium">{stop.bsNm}</div>
                          <div className="flex items-center">
                            <button
                              className={`mr-2 ${
                                favoriteStops.some(
                                  (fav) => fav.bsId === stop.bsId
                                )
                                  ? "text-yellow-500"
                                  : "text-gray-300"
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(stop);
                              }}
                            >
                              <Star
                                fill={
                                  favoriteStops.some(
                                    (fav) => fav.bsId === stop.bsId
                                  )
                                    ? "currentColor"
                                    : "none"
                                }
                                className="w-5 h-5"
                                strokeWidth={1.5}
                              />
                            </button>
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <FavoriteRoutes />
        )}
      </div>

      {/* Floating Action Button */}
      <button
        className="fixed bottom-20 right-4 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center"
        onClick={() => setSearchQuery("")}
      >
        {activeTab === "stops" && !selectedStop ? (
          <RefreshCw className="w-6 h-6" />
        ) : (
          <Plus className="w-6 h-6" />
        )}
      </button>

      {/* Tab Bar */}
      <div className="fixed bottom-0 w-full bg-white border-t border-gray-200 px-6 py-2">
        <div className="grid grid-cols-5 gap-4">
          <button className="flex flex-col items-center">
            <Home className="w-5 h-5 text-blue-600" />
            <span className="text-xs mt-1">홈</span>
          </button>
          <button className="flex flex-col items-center">
            <MapPin className="w-5 h-5 text-gray-400" />
            <span className="text-xs mt-1">주변</span>
          </button>
          <button className="flex flex-col items-center">
            <Star className="w-5 h-5 text-gray-400" />
            <span className="text-xs mt-1">즐겨찾기</span>
          </button>
          <button className="flex flex-col items-center">
            <User className="w-5 h-5 text-gray-400" />
            <span className="text-xs mt-1">내정보</span>
          </button>
          <button className="flex flex-col items-center">
            <Route className="w-5 h-5 text-gray-400" />
            <span className="text-xs mt-1">경로</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default BusInfo;
