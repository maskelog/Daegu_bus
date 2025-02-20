import { Stop } from "@/types";
import { Search, Star } from "lucide-react";
import React, { useState, useEffect } from "react";

// StopList 컴포넌트의 props 타입 정의
interface StopListProps {
  stops: Stop[]; // 정류장 목록
  loading: boolean; // 로딩 상태
  selectedStop: Stop | null; // 선택된 정류장
  onSelectStop: (stop: Stop) => void; // 정류장 선택 시 호출되는 함수
}

const StopList: React.FC<StopListProps> = ({
  stops,
  loading,
  selectedStop,
  onSelectStop,
}) => {
  // 검색어 상태 관리
  const [searchQuery, setSearchQuery] = useState("");

  // 즐겨찾기 정류장 ID 목록 상태 관리
  const [favoriteStops, setFavoriteStops] = useState<string[]>([]);

  // 컴포넌트 마운트 시 로컬 스토리지에서 즐겨찾기 정보 로드
  useEffect(() => {
    const savedFavorites = localStorage.getItem("favoriteStopIds");
    if (savedFavorites) {
      try {
        setFavoriteStops(JSON.parse(savedFavorites));
      } catch (error) {
        console.error("즐겨찾기 로드 중 오류:", error);
        // 오류 발생 시 빈 배열로 초기화
        setFavoriteStops([]);
      }
    }
  }, []);

  // 즐겨찾기 토글 함수
  const toggleFavorite = (stopId: string, event: React.MouseEvent) => {
    // 이벤트 버블링 방지 (부모 요소의 클릭 이벤트 실행 방지)
    event.stopPropagation();

    // 현재 즐겨찾기 목록 확인
    const isAlreadyFavorite = favoriteStops.includes(stopId);

    // 즐겨찾기 추가 또는 제거
    let newFavorites;
    if (isAlreadyFavorite) {
      // 이미 즐겨찾기된 경우 제거
      newFavorites = favoriteStops.filter((id) => id !== stopId);
    } else {
      // 새로운 즐겨찾기 추가
      newFavorites = [...favoriteStops, stopId];
    }

    // 상태 업데이트
    setFavoriteStops(newFavorites);

    // 로컬 스토리지에 즐겨찾기 ID 저장
    localStorage.setItem("favoriteStopIds", JSON.stringify(newFavorites));

    // 전체 즐겨찾기 정류장 객체 저장 (옵션)
    const favStops = stops.filter((stop) => newFavorites.includes(stop.bsId));
    localStorage.setItem("favoriteStops", JSON.stringify(favStops));
  };

  // 검색어로 정류장 필터링
  const filteredStops = stops.filter(
    (stop) =>
      stop.bsNm.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stop.bsId.includes(searchQuery)
  );

  return (
    <div className="border rounded-lg p-4">
      {/* 검색 입력란 */}
      <div className="flex items-center gap-2 mb-4">
        <Search className="w-5 h-5 text-gray-500" />
        <input
          type="text"
          placeholder="정류장명 또는 번호로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-2 border rounded"
        />
      </div>

      {/* 정류장 목록 컨테이너 */}
      <div className="h-[600px] overflow-y-auto pr-2">
        {loading ? (
          // 로딩 중 스피너
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        ) : (
          <div className="space-y-2">
            {filteredStops.length === 0 ? (
              // 검색 결과 없음
              <div className="text-center text-gray-500 py-10">
                검색 결과가 없습니다
              </div>
            ) : (
              // 정류장 목록 렌더링
              filteredStops.map((stop) => (
                <div
                  key={stop.bsId}
                  className={`
                    p-3 border rounded cursor-pointer 
                    flex justify-between items-center 
                    hover:bg-gray-50 
                    ${
                      selectedStop?.bsId === stop.bsId
                        ? "bg-blue-50 border-blue-200"
                        : ""
                    }
                  `}
                  onClick={() => onSelectStop(stop)}
                >
                  {/* 정류장 정보 */}
                  <div>
                    <div className="font-medium">{stop.bsNm}</div>
                    <div className="text-sm text-gray-500">
                      정류소 ID: {stop.bsId}
                    </div>
                  </div>

                  {/* 즐겨찾기 버튼 */}
                  <button
                    onClick={(e) => toggleFavorite(stop.bsId, e)}
                    className={`
                      flex items-center justify-center
                      w-8 h-8 rounded-full 
                      transition-colors duration-200
                      ${
                        favoriteStops.includes(stop.bsId)
                          ? "text-yellow-500 hover:bg-yellow-50"
                          : "text-gray-300 hover:text-yellow-500 hover:bg-gray-100"
                      }
                    `}
                    aria-label={
                      favoriteStops.includes(stop.bsId)
                        ? "즐겨찾기 해제"
                        : "즐겨찾기 추가"
                    }
                  >
                    <Star
                      fill={
                        favoriteStops.includes(stop.bsId)
                          ? "currentColor"
                          : "none"
                      }
                      className="w-5 h-5"
                      strokeWidth={1.5}
                    />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StopList;
