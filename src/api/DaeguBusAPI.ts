import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export const DECODING_KEY = process.env.NEXT_PUBLIC_DECODING_KEY;
const BASE_URL = 'https://apis.data.go.kr/6270000/dbmsapi01';

export const DaeguBusAPI = {
  getLink: async (routeId: string) => {
    try {
      const response = await axios.get(`${BASE_URL}/getLink`, {
        params: {
          serviceKey: DECODING_KEY,
          routeId
        }
      });
      return response.data;
    } catch (error) {
      console.error('getLink Error:', error);
      throw error;
    }
  },

  getRealtime: async (bsId: string) => {
    try {
      const response = await axios.get(`${BASE_URL}/getRealtime`, {
        params: {
          serviceKey: DECODING_KEY,
          bsId
        }
      });
      return response.data;
    } catch (error) {
      console.error('getRealtime Error:', error);
      throw error;
    }
  }
};