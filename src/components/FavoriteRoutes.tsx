import { Star, MoreVertical, Plus, Route } from "lucide-react";
import React, { useState, useEffect } from "react";

// 버스 노선 타입 정의
interface BusRoute {
  id: number;
  number: string;
  direction: string;
  nextBus: string;
  interval: string;
  nearestStop: string;
}

const FavoriteRoutes: React.FC = () => {
  // 즐겨찾는 버스 노선 상태 관리
  const [favoriteRoutes, setFavoriteRoutes] = useState<BusRoute[]>([]);

  // 컴포넌트 마운트 시 로컬 스토리지에서 즐겨찾기 노선 불러오기
  useEffect(() => {
    const savedFavoriteRoutes = localStorage.getItem("favoriteRoutes");
    if (savedFavoriteRoutes) {
      try {
        setFavoriteRoutes(JSON.parse(savedFavoriteRoutes));
      } catch (error) {
        console.error("즐겨찾기 노선 로드 중 오류:", error);
      }
    }
  }, []);

  // 버스 노선 즐겨찾기 토글 함수
  const toggleFavorite = (route: BusRoute) => {
    const isAlreadyFavorite = favoriteRoutes.some(
      (favRoute) => favRoute.id === route.id
    );

    let newFavorites;
    if (isAlreadyFavorite) {
      // 이미 즐겨찾기된 경우 제거
      newFavorites = favoriteRoutes.filter(
        (favRoute) => favRoute.id !== route.id
      );
    } else {
      // 새로운 즐겨찾기 추가
      newFavorites = [...favoriteRoutes, route];
    }

    // 상태 및 로컬 스토리지 업데이트
    setFavoriteRoutes(newFavorites);
    localStorage.setItem("favoriteRoutes", JSON.stringify(newFavorites));
  };

  // 버스 노선 추가 모달 상태
  const [isAddRouteModalOpen, setIsAddRouteModalOpen] = useState(false);
  const [newRouteNumber, setNewRouteNumber] = useState("");
  const [newRouteDirection, setNewRouteDirection] = useState("");

  // 새 버스 노선 추가 함수
  const addNewRoute = () => {
    if (!newRouteNumber || !newRouteDirection) {
      alert("버스 번호와 방향을 모두 입력해주세요.");
      return;
    }

    const newRoute: BusRoute = {
      id: Date.now(), // 고유 ID 생성
      number: newRouteNumber,
      direction: newRouteDirection,
      nextBus: "정보 없음",
      interval: "정보 없음",
      nearestStop: "정보 없음",
    };

    const updatedRoutes = [...favoriteRoutes, newRoute];
    setFavoriteRoutes(updatedRoutes);
    localStorage.setItem("favoriteRoutes", JSON.stringify(updatedRoutes));

    // 모달 초기화
    setNewRouteNumber("");
    setNewRouteDirection("");
    setIsAddRouteModalOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* 즐겨찾는 버스 노선 헤더 */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-medium text-lg">즐겨찾는 버스 노선</h3>
          <button
            className="p-2 text-gray-400"
            onClick={() => setIsAddRouteModalOpen(true)}
          >
            <Plus className="w-5 h-5 text-blue-600" />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-2">
          자주 이용하는 버스 노선을 등록하고 실시간으로 확인하세요.
        </p>
      </div>

      {/* 즐겨찾기 노선 없을 때 */}
      {favoriteRoutes.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <Route className="text-gray-300 w-16 h-16 mx-auto mb-4" />
          <p className="text-gray-500">즐겨찾는 버스 노선이 없습니다.</p>
          <p className="text-sm text-gray-400 mt-2">
            버스 노선을 추가하여 실시간 정보를 확인하세요
          </p>
        </div>
      ) : (
        // 즐겨찾기 노선 목록
        favoriteRoutes.map((route) => (
          <div
            key={route.id}
            className="bg-white rounded-lg shadow-sm p-4 mb-4"
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-medium text-lg">{route.number}</h3>
                <p className="text-sm text-gray-500">{route.direction}</p>
              </div>
              <div className="flex items-center">
                <button
                  className="text-yellow-500 mr-2"
                  onClick={() => toggleFavorite(route)}
                >
                  <Star
                    fill="currentColor"
                    className="w-5 h-5"
                    strokeWidth={1.5}
                  />
                </button>
                <button className="text-gray-400">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">가장 가까운 정류장</p>
                  <p className="font-medium">{route.nearestStop}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-medium text-blue-600">
                    {route.nextBus}
                  </p>
                  <p className="text-xs text-gray-500">
                    배차간격 {route.interval}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))
      )}

      {/* 노선 추가 모달 */}
      {isAddRouteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-11/12 max-w-md">
            <h2 className="text-lg font-semibold mb-4">새 버스 노선 추가</h2>
            <div className="mb-4">
              <label
                htmlFor="routeNumber"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                버스 번호
              </label>
              <input
                type="text"
                id="routeNumber"
                value={newRouteNumber}
                onChange={(e) => setNewRouteNumber(e.target.value)}
                placeholder="예: 급행1, 306"
                className="w-full p-2 border rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>
            <div className="mb-6">
              <label
                htmlFor="routeDirection"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                버스 방향
              </label>
              <input
                type="text"
                id="routeDirection"
                value={newRouteDirection}
                onChange={(e) => setNewRouteDirection(e.target.value)}
                placeholder="예: 대구역 → 동대구역"
                className="w-full p-2 border rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setIsAddRouteModalOpen(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={addNewRoute}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FavoriteRoutes;
