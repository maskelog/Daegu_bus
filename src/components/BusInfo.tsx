"use client";

import { ArrivalInfo } from "./ArrivalInfo";
import { StopList } from "./StopList";
import { Stop, BusLine } from "@/types";
import React, { useState, useEffect } from "react";

export const BusInfo = () => {
  const [stops, setStops] = useState<Stop[]>([]);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStops = async () => {
      try {
        const response = await fetch("/stops.json");
        const data = await response.json();
        setStops(data);
      } catch (error) {
        console.error("Error loading stops:", error);
      } finally {
        setLoading(false);
      }
    };
    loadStops();
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">대구 버스 정보 시스템</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StopList
          stops={stops}
          loading={loading}
          selectedStop={selectedStop}
          onSelectStop={setSelectedStop}
        />
        <ArrivalInfo stop={selectedStop} />
      </div>
    </div>
  );
};
