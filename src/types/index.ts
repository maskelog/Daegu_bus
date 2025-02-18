export interface Stop {
  ID: string;
  _id: number;
  geo_x: string;
  geo_y: string;
  name: string;
  stopNo: string;
}

export interface BusLine {
  ID: string;
  _id: number;
  kind: string;
  name: string;
  ward: string;
}