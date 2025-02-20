"use client";

import React from "react";

interface DigitalSignProps {
  arrivalText: string;
}

const DigitalSign: React.FC<DigitalSignProps> = ({ arrivalText }) => {
  return (
    <div className="bg-black text-green-500 font-mono text-lg p-2 rounded mt-4 overflow-hidden">
      <div className="whitespace-nowrap relative">
        <div className="inline-block animate-marquee">{arrivalText}</div>
      </div>
    </div>
  );
};

export default DigitalSign;
