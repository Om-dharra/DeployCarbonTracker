const allLabels = ["lakshit", "jain"];
const inputData = [100, 134];
const labelofLegend = "Dadbod";
//Iske neeche haath mat lagaio agar samay pyara ho to

const ctx1 = document.getElementById("monthlyChart");

new Chart(ctx1, {
  type: "line",
  data: {
    labels: allLabels,
    datasets: [
      {
        label: labelofLegend,
        data: inputData,
        backgroundColor: [
          "rgba(255, 159, 64, 0.8)",
          "rgba(255, 205, 86, 0.8)",
          "rgba(75, 192, 192, 0.8)",
          "rgba(54, 162, 235, 0.8)",
          "rgba(153, 102, 255, 0.8)",
          "rgba(201, 203, 207, 0.8)",
          "rgba(218, 112, 214, 0.8)", // Orchid
          "rgba(255, 99, 132, 0.8)",
          "rgba(46, 139, 87, 0.8)", // Sea Green
          "rgba(0, 128, 128, 0.8)", // Teal
        ],
        borderColor: [
          "rgb(255, 159, 64)",
          "rgb(255, 205, 86)",
          "rgb(75, 192, 192)",
          "rgb(54, 162, 235)",
          "rgb(153, 102, 255)",
          "rgb(201, 203, 207)",
          "rgb(218, 112, 214)", // Orchid
          "rgb(255, 99, 132)",
          "rgb(46, 139, 87)", // Sea Green
          "rgb(0, 128, 128)", // Teal
        ],

        hoverOffset: 25,
        borderWidth: 1,
      },
    ],
  },
  options: {
    onClick: (e) => {
      const canvasPosition = getRelativePosition(e, chart);

      //   Substitute the appropriate scale IDs
      const dataX = chart.scales.x.getValueForPixel(canvasPosition.x);
      const dataY = chart.scales.y.getValueForPixel(canvasPosition.y);
    },
    scales: {
      display: true,
    },
    plugins: {
      legend: {
        position: "top",
        align: "end",
      },
    },
    layout: {
      padding: {
        bottom: 30,
      },
    },
    animation:true,
  },
});