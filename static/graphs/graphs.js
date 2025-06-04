

window.addEventListener('load', init);
function init() {
    console.log("init");
    PopulateMapSelect();
    
    const mapSelect = document.getElementById('mapSelect');
    mapSelect.addEventListener("change",ShowGraph);

}

// Declare global variables
let tankNames = [];
let winPercentages = [];
let prestigePoints = [];
let pickRates = [];

function PopulateMapSelect() {
    const mapSelect = document.getElementById('mapSelect');
    const URL = "http://localhost:8080";
    fetch(URL+'/graphs?maps=true')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(maps => {
            console.log(maps);
            maps = maps["maps"];
            console.log(maps);
            for (const map in maps) {
                console.log(maps[map]);
                const option = document.createElement('option');
                option.value = maps[map]; // Use the map name as the value
                option.innerHTML = maps[map]; // Use the map name as the display text
                mapSelect.appendChild(option);
            }
        });
}

function ShowGraph() {
    const MapSelect = document.getElementById('mapSelect').value;
    console.log(MapSelect);
    const URL = "http://localhost:8080";
    fetch(URL+`/graphs?map=${MapSelect}`)
        .then(response =>{
            if (!response.ok) {
                throw new Error('Network response was not ok');
              }
            return response.json();
        })
        .then(data =>{
            console.log(data);
            PlotGraph(data);
        });
}

function PlotGraph(data) {
    const plotDiv = document.getElementById('plot');
    plotDiv.innerHTML = ''; // Clear previous plot

    // Extract data for plotting
    tankNames = [];
    winPercentages = [];
    prestigePoints = [];
    pickRates = [];

    Object.keys(data).forEach(tankName => {
        const tankStats = data[tankName];
        tankNames.push(tankName);
        winPercentages.push(tankStats.win_percentage);
        prestigePoints.push(tankStats.average_comp7PrestigePoints);
        pickRates.push(tankStats.pickrate*100);
    });

    // Calculate averages for each axis
    const avgWinPercentage = winPercentages.reduce((a, b) => a + b, 0) / winPercentages.length;
    const avgPrestigePoints = prestigePoints.reduce((a, b) => a + b, 0) / prestigePoints.length;
    const avgPickRate = pickRates.reduce((a, b) => a + b, 0) / pickRates.length * 0.75;

    // Filter data points where any axis is above the average
    const filteredData = winPercentages.map((winPercentage, index) => {
        if (
            (winPercentage > avgWinPercentage || prestigePoints[index] > avgPrestigePoints) &&
            pickRates[index] > avgPickRate
        ) {
            return {
                name: tankNames[index],
                winPercentage: winPercentage,
                prestigePoints: prestigePoints[index],
                pickRate: pickRates[index]
            };
        }
        return null;
    }).filter(item => item !== null);

    // Extract filtered data
    const filteredWinPercentages = filteredData.map(item => item.winPercentage);
    const filteredPrestigePoints = filteredData.map(item => item.prestigePoints);
    const filteredPickRates = filteredData.map(item => item.pickRate);
    const filteredTankNames = filteredData.map(item => item.name);

    // Create a 3D scatter plot using Plotly
    const trace1 = {
        x: filteredWinPercentages,
        y: filteredPrestigePoints,
        z: filteredPickRates,
        type: 'scatter3d',
        mode: 'markers+text',
        marker: {
            size: filteredPickRates.map(rate => Math.sqrt(rate) * 10),
            color: filteredPickRates,
            colorscale: [
    ['0.0', 'rgb(165,0,38)'],
    ['0.111111111111', 'rgb(215,48,39)'],
    ['0.222222222222', 'rgb(244,109,67)'],
    ['0.333333333333', 'rgb(253,174,97)'],
    ['0.444444444444', 'rgb(240, 223, 75)'],
    ['0.555555555556', 'rgb(224, 243, 115)'],
    ['0.666666666667', 'rgb(75, 186, 223)'],
    ['0.777777777778', 'rgb(50, 70, 182)'],
    ['0.888888888889', 'rgb(80, 60, 170)'],
    ['1.0', 'rgb(66, 23, 107)']
  ],
            opacity: 0.9
        },
        text: filteredTankNames,
        textposition: "top center",
        textfont: {
            family: "Arial, sans-serif",
            size: 12,
            color: "white"
        }
    };

    const layout = {
        title: "Above Average Tank Performance: 3D Visualization",
        paper_bgcolor: "rgba(0, 0, 0, 0.75)", // Background outside the plot
        plot_bgcolor: "rgba(233, 233, 233, 0.86)", // Background inside the plot
        scene: {
            xaxis: {
                title: {
                    text: "Win Percentage (%)",
                    range: [
                        Math.min(...filteredWinPercentages) * 0.8,
                        Math.max(...filteredWinPercentages) * 1.2
                    ],
                    font: {
                        color: "#ffffff" // White axis title
                    }
                },
                tickfont: {
                    color: "#ffffff" // White tick labels
                },
                showline: true,
                linecolor: "#ffffff", // White axis line
                gridcolor: "rgba(255, 255, 255, 0.2)" // Light white grid lines
            },
            yaxis: {
                title: {
                    text: "Average Prestige Points",
                    font: {
                        color: "#ffffff" // White axis title
                    },
                    range: [
                        Math.min(...filteredPrestigePoints) * 0.8,
                        Math.max(...filteredPrestigePoints) * 1.2,
                    ]
                },
                tickfont: {
                    color: "#ffffff" // White tick labels
                },
                showline: true,
                linecolor: "#ffffff", // White axis line
                gridcolor: "rgba(255, 255, 255, 0.2)" // Light white grid lines
            },
            zaxis: {
                title: {
                    text: "Pickrate (%)",
                    font: {
                        color: "#ffffff" // White axis title
                    }
                },
                tickfont: {
                    color: "#ffffff" // White tick labels
                },
                showline: true,
                linecolor: "#ffffff", // White axis line
                gridcolor: "rgba(255, 255, 255, 0.2)" // Light white grid lines
            }
        },
        margin: { l: 0, r: 0, t: 0, b: 0 }
    };

    Plotly.newPlot('plot', [trace1], layout);
}

/// heatmaps


function showPlayerHeatmaps(playerName, mapName) {
    fetch(`http://localhost:8080/player/positions?name=${encodeURIComponent(playerName)}&map=${encodeURIComponent(mapName)}`)
        .then(res => res.json())
        .then(positions => {

            const xs = positions.map(p => p.x);
            const ys = positions.map(p => p.y);

            Plotly.newPlot('positions-heatmap', [{
                x: xs,
                y: ys,
                type: 'histogram2d',
                colorscale: 'Hot',
                nbinsx: 50,
                nbinsy: 50
            }], {
                title: `Position Heatmap for ${playerName} on ${mapName}`,
                xaxis: {title: 'X'},
                yaxis: {title: 'Y'}
            });
        });

    fetch(`http://localhost:8080/player/shots?name=${encodeURIComponent(playerName)}&map=${encodeURIComponent(mapName)}`)
        .then(res => res.json())
        .then(shots => {
            // Prepare data for shot origins
            const xs = shots.map(s => s.x);
            const ys = shots.map(s => s.y);

            Plotly.newPlot('shots-heatmap', [{
                x: xs,
                y: ys,
                type: 'histogram2d',
                colorscale: 'Blues',
                nbinsx: 50,
                nbinsy: 50
            }], {
                title: `Shot Origin Heatmap for ${playerName} on ${mapName}`,
                xaxis: {title: 'X'},
                yaxis: {title: 'Y'}
            });
        });
}

document.getElementById('show-positions').addEventListener('click', function() {
    document.getElementById('positions-heatmap').style.display = '';
    document.getElementById('shots-heatmap').style.display = 'none';
    this.classList.add('active');
    document.getElementById('show-shots').classList.remove('active');
});

document.getElementById('show-shots').addEventListener('click', function() {
    document.getElementById('positions-heatmap').style.display = 'none';
    document.getElementById('shots-heatmap').style.display = '';
    this.classList.add('active');
    document.getElementById('show-positions').classList.remove('active');
});