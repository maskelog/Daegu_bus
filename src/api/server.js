// server.js
const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");

const app = express();
const port = 8080;

app.use(cors());

// 버스 정류장 정보를 가져오는 API
app.get("/api/station/:stationId", async (req, res) => {
  try {
    const stationId = req.params.stationId;
    const url = `https://businfo.daegu.go.kr/ba/route/rtbsarr.do?act=findByPath&bsId=${stationId}`;

    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const busRoutes = [];

    // 버스 노선 정보 파싱
    $(".body_row").each((i, element) => {
      const routeCell = $(element).find(".body_col2");
      const routeNumber = routeCell.text().trim();
      const imgSrc = routeCell.find("img").attr("src");

      // 버스 타입 확인
      let busType = "일반";
      if (imgSrc.includes("r01.gif")) {
        busType = "급행";
      } else if (imgSrc.includes("r03.gif")) {
        busType = "일반";
      } else if (imgSrc.includes("r04.gif")) {
        busType = "지선";
      }

      // 버스 정보 객체 생성
      const busInfo = {
        routeNumber: routeNumber,
        type: busType,
        // onclick 이벤트에서 좌표 정보 추출
        coordinates: $(element)
          .find(".body_col1")
          .attr("onclick")
          ?.match(/\d+\.\d+\|\d+\.\d+/g)?.[0],
      };

      busRoutes.push(busInfo);
    });

    // 정류장 이름 파싱
    const stationName = $("#arrResultRed2").text().trim();

    res.json({
      stationName: stationName,
      stationId: stationId,
      routes: busRoutes,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "서버 에러가 발생했습니다." });
  }
});

app.listen(port, () => {
  console.log(`서버가 http://localhost:${port} 에서 실행중입니다.`);
});
