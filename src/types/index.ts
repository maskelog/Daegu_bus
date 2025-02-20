export interface Stop {
  bsId: string;
  bsNm: string;
  xPos: string;
  yPos: string;
  moveDir: string;
  seq: string;
  routeNos?: string[];
}

export interface BusLine {
  ID: string; 
  routeNo: string;
  _id: number;
  kind: string;
  name: string;
  ward: string;
}
