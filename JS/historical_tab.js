// global variables to keep track of what the user selected/is hovering over
// note: initial values of selectedMonthsPred and selectedComplaintType should match what is present in dropdown
let selectedMonthsHist = ["January"];
let selectedComplaintTypesHist = ["Noise"];
let selectedYear = "2014";
let selectedBoroCDHist;
let scales; // used for line chart


// creates color scale
let colorHistorical = d3.scaleQuantile().range(colorPalette);

// historical data
const complaintCountsHistorical = d3.dsv(",", "data/complaint_count_historical.csv", function(d) {
    return {
        month: d.Month,
        year: d.Year,
        communityBoard: d["Community Board"],
        complaintType: d["Complaint Type"],
        numComplaints: +d.Count
    }
});

// takes an iterable of promises as input, returns a single Promise
// promise fulfills when all of input's promises's fulfill, and has an array of fulfillment values
Promise.all([mapNYC, complaintCountsHistorical, boroLookup]).then(function(values) {
    // add BoroCD to each complaint count
    const lookupMap = new Map(values[2].map(d => [d.communityBoard, d.BoroCD]));
    values[1].forEach(d => {
        d.BoroCD = +lookupMap.get(d.communityBoard);
    })
    // assign data (I wanted these to be global vars)
    districtJSONData = values[0];
    historicalComplaintCountsData = values[1];
    BoroCDLookupData = values[2];
    // initialize historical data tab
    initHistoricalTab();
});

// this function should be called once the data from files have been read
// communityBoards: geoJSON of commmunityBoards
// complaintCounts: tabular data of complaintCounts
function initHistoricalTab() {
    // there was an issue with spacing in the legend and YoY chart upon first time switching to the tab, due to the container originally being hidden
    // this allows us to re-render the legend after tab is visible
    window.addEventListener("tabChanged", function(e) {
        if (e.detail.tab === "historicalTabContent") {
            // Render D3 charts when tab becomes visible
            setTimeout(() => {
                constructHistoricalChoropleth();
                scales = drawYearOverYearChart();
                updateHistoricalChoropleth();
                updateColorDomainAndLegendHist();
                updateHistCount();
                updateTopBoardsHistorical();
            }, 100);
        }
    }, {
        once: true
    }); // Only fire once

    // updates choropleth, historical count, yearly trend, and top boards if month dropdown changes
    const monthDropdownHistorical = d3.select("#monthDropdownHistorical");
    monthDropdownHistorical.on("change", function() {
        selectedMonthsHist = Array.from(this.selectedOptions).map(option => option.value);
        updateColorDomainAndLegendHist();
        updateHistoricalChoropleth();
        updateHistCount();
        updateYearOverYearChart(scales);
        updateTopBoardsHistorical();
    })

    // updates choropleth, historical count, yearly trend, and top boards if complaint type dropdown changes
    const complaintTypeDropdownHistorical = d3.select("#complaintTypeDropdownHistorical")
    complaintTypeDropdownHistorical.on("change", function() {
        selectedComplaintTypesHist = Array.from(this.selectedOptions).map(option => option.value);
        updateColorDomainAndLegendHist();
        updateHistoricalChoropleth();
        updateHistCount();
        updateTopBoardsHistorical();
        updateYearOverYearChart(scales);
    })

    // updates choropleth, historical count, yearly trend, and top boards if month dropdown changes
    // NOTE: we do not change the legend over the years, to allow for better comparison
    const slider = d3.select("#sliderYears")
    slider.on("input", function() {
        selectedYear = this.value;
        updateHistoricalChoropleth();
        updateHistCount();
        updateTopBoardsHistorical();
        updateYearOverYearChart(scales);
        document.getElementById('yearDisplay').textContent = selectedYear;
    })
};

// constructs initial choropleth
function constructHistoricalChoropleth() {
    // draw basic map outline
    const choropleth = d3.select("#historicalChoropleth");
    const mapWidth = parseInt(choropleth.style("width")) - padding.left - padding.right
    projection.fitSize([mapWidth, mapWidth], districtJSONData);
    // add margins to map
    const mapHistorical = d3.select("#historicalChoropleth")
        .attr("width", parseInt(choropleth.style("width")))
        .attr("height", parseInt(choropleth.style("width")));
    // this just draws the outline, fill attribute happens during updateHistoricalChoropleth function
    mapHistorical.append("g")
        .attr("transform", "translate(10, 10)")
        .attr("id", "historicalCommunities")
        .selectAll("path")
        .data(districtJSONData.features)
        .enter().append("path")
        .attr("d", path)
        .style("stroke", "black");

    // create legend
    const legend = d3.select("#historicalChoropleth");
    legend.append("rect")
        .attr("x", legendXY.x)
        .attr("y", legendXY.y)
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "white")
        .style("stroke", "black")
        .style("stroke-width", 1);
    legend.append("g")
        .attr("class", "legend")
        .attr("id", "legendHistorical")
        .attr("transform", "translate(30,50)");

    // create tooltip
    // needs to be off of the map-container div instead of choropleth svg to appear
    const tooltip = d3.select("#historical-map-container")
        .append("div")
        .attr("class", "tooltip")
        .attr("id", "tooltipHist")
        .style("position", "absolute")
        .style("display", "none")
        .style("background", "#fff")
        .style("pointer-events", "none");
    // adds behavior upon hovering over a CD
    addTooltipBehavior();
};

// Adds behavior upon hovering over a CD
// This needed to be separated out b/c we only construct the choropleth after we change to the historical tab
// (cont.) and the mouseover event handlers were not getting reattached
function addTooltipBehavior(){
    // Hovering tooltip behavior on the Choropleth map
    const tooltip = d3.select("#tooltipHist");
    d3.select("#historicalCommunities").selectAll("path")
        .on("mouseover", function(event, d) {
            // mute out the other community districts
            d3.select("#historicalCommunities").selectAll("path")
                .style("stroke-width", "1px")
                .style("opacity", "0.5");
            // make selected community district clear
            d3.select(this)
                .style("stroke-width", "2px")
                .style("opacity", "1");

            selectedBoroCDHist = event.properties.BoroCD;
            const eventInfo = d3.event;
            // update and display tooltip
            tooltipHTML = generateInfoHist();
            tooltip
                .style("display", "block")
                .html(tooltipHTML)
                .style("left", (eventInfo.pageX - 5) + "px")
                .style("top", (eventInfo.pageY - 5) + "px");
        })
        .on("mouseout", function(event, d) {
            d3.select("#historicalCommunities").selectAll("path")
                .style("stroke-width", "1px")
                .style("opacity", "1");
            d3.select("#info").style("display", "none")
            tooltip.style("display", "none");
        })
}

// Draw year-over-year line chart
const years = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];

function drawYearOverYearChart() {
    const selectedYearInt = parseInt(selectedYear)
    const filteredComplaintCounts = historicalComplaintCountsData.filter(d => (selectedComplaintTypesHist.includes(d.complaintType) && selectedMonthsHist.includes(d.month)));
    const groupedComplaintCounts = filteredComplaintCounts.reduce((accumulator, currentItem) => {
        itemYear = currentItem.year;
        itemNumComplaints = currentItem.numComplaints;
        // if complaint type doesn't exist in accumulator, initialize it
        if (!accumulator[itemYear]) {
            accumulator[itemYear] = 0;
        }
        accumulator[itemYear] += itemNumComplaints;
        return accumulator;
    }, {});
    // if there's no value for the month, just have it be 0
    const complaintCountsByYear = years.map(year => ({
        year,
        count: groupedComplaintCounts[year] !== undefined ? groupedComplaintCounts[year] : 0
    }));
    const svg = d3.select("#lineChartHistorical");

    const margin = {
        top: 20,
        right: 30,
        bottom: 40,
        left: 60
    };
    const width = parseInt(svg.style("width")) - margin.left - margin.right;
    const height = parseInt(svg.attr("height")) - margin.top - margin.bottom;

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain([2014, 2024])
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(complaintCountsByYear, d => d.count) * 1.1])
        .nice()
        .range([height, 0]);

    const line = d3.line()
        .x(d => x(d.year))
        .y(d => y(d.count));

    // X-axis
    const xAxis = d3.axisBottom(x).tickFormat(d3.format("d")).ticks(11)
    const xAxisGroup = g.append("g")
        .attr("class", "x-axis")
        .attr("id", "x-axis-YoY")
        .attr("transform", `translate(0,${height})`)
        .call(xAxis);

    // Bold the selected year
    xAxisGroup.selectAll("text")
        .style("font-weight", d => d === selectedYearInt ? "bold" : "normal")
        .style("font-size", d => d === selectedYearInt ? "14px" : "12px")
        .style("fill", d => d === selectedYearInt ? "#FF0000" : "#2F4F4F");

    // Y-axis
    const yAxis = d3.axisLeft(y).ticks(5)
    g.append("g")
        .attr("class", "y-axis")
        .attr("id", "y-axis-YoY")
        .call(yAxis);

    // Line with gradient color
    g.append("path")
        .attr("id", "lineYoY")
        .datum(complaintCountsByYear)
        .attr("fill", "none")
        .attr("stroke", "#FF6347")
        .attr("stroke-width", 2.5)
        .attr("d", line);

    // Dots
    // selected year is more prominent
    g.selectAll(".dot")
        .data(complaintCountsByYear)
        .enter().append("circle")
        .attr("class", "dot")
        .attr("cx", d => x(d.year))
        .attr("cy", d => y(d.count))
        .attr("r", d => (selectedYear && d.year === selectedYearInt) ? 6 : 4)
        .attr("fill", d => (selectedYear && d.year === selectedYearInt) ? "#FF0000" : "#FF8C00")
        .attr("stroke", "white")
        .attr("stroke-width", 2);

    return {
        x,
        y,
        xAxis,
        yAxis,
        line
    };
};

// helper function to get the color of a BoroCD
function getColorHistorical(BoroCD) {
    // get the value of the number of incidents for the country and year
    const filteredComplaintCounts = historicalComplaintCountsData.filter(d => (d.BoroCD == BoroCD && selectedComplaintTypesHist.includes(d.complaintType) && selectedMonthsHist.includes(d.month) && d.year === selectedYear));
    // if there is no value, return white
    if (filteredComplaintCounts.length === 0) {
        return "white"
    };
    boroCDComplaintCount = filteredComplaintCounts.reduce((accumulator, currentItem) => accumulator + currentItem.numComplaints, 0);
    return colorHistorical(boroCDComplaintCount);
};

// updates the Choropleth colors when a user changes input values (based on existing legend)
function updateHistoricalChoropleth() {
    // update the fill value
    d3.select("#historicalCommunities")
        .selectAll("path")
        .attr("fill", d => getColorHistorical(d.properties.BoroCD));
};

// update the color domain and legend of choropleth whenever a user changes dropdown values
// should be the same across years for easier comparison
function updateColorDomainAndLegendHist() {
    // update color domain and legend (same across years)
    const filteredComplaintCounts = historicalComplaintCountsData.filter(d => (selectedComplaintTypesHist.includes(d.complaintType) && selectedMonthsHist.includes(d.month)));
    const groupedComplaintCountsAllYears = d3.flatRollup(
        filteredComplaintCounts,
        v => d3.sum(v, d => d.numComplaints),
        d => d.year,
        d => d.BoroCD
    ).map(d => d[2]);
    colorHistorical.domain(d3.extent(groupedComplaintCountsAllYears));

    const legendScale = d3.legendColor()
        .shapeWidth(40)
        .cells(colorPalette.length)
        .labelFormat(d3.format(",.0f"))
        .title("Number of Complaints")
        .scale(colorHistorical);
    d3.select("#legendHistorical").call(legendScale);
};

// generates the HTML used in the tooltip when a user hovers over a CD in the choropleth
function generateInfoHist() {
    // Write CD name in proper case
    let communityDistrict = historicalComplaintCountsData.filter(d => d.BoroCD == selectedBoroCDHist)[0].communityBoard.split(" ");
    communityDistrict = communityDistrict.map(s => s.toProperCase()).join(" ");

    const communityDistrictDescription = BoroCDLookupData.filter(d => d.BoroCD == selectedBoroCDHist)[0].description;

    // Total Complaints
    const filteredComplaintCounts = historicalComplaintCountsData.filter(d => (d.BoroCD == selectedBoroCDHist && selectedComplaintTypesHist.includes(d.complaintType) && selectedMonthsHist.includes(d.month) && d.year === selectedYear));
    numComplaints = 0;
    if (filteredComplaintCounts.length !== 0) {
        numComplaints = filteredComplaintCounts.reduce((accumulator, currentItem) => accumulator + currentItem.numComplaints, 0);
    }

    // Complaint Counts based on Complaint Types
    const groupedComplaintCounts = filteredComplaintCounts.reduce((accumulator, currentItem) => {
        itemComplaintType = currentItem.complaintType;
        itemNumComplaints = currentItem.numComplaints;
        // if complaint type doesn't exist in accumulator, initialize it
        if (!accumulator[itemComplaintType]) {
            accumulator[itemComplaintType] = 0;
        }
        accumulator[itemComplaintType] += itemNumComplaints;
        return accumulator;
    }, {})

    const complaintTypeHTML = Object.entries(groupedComplaintCounts).sort((a, b) => b[1] - a[1]).map(([key, value]) => {
        return `<div class="tooltip-item">
                    <span class="tooltip-complaintType">${complaintTypeMappings[key]}</span>
                    <span class="tooltip-complaintTypeNum">${value.toLocaleString()}</span>
                </div>`
    }).join("");

    // build HTML in the info section
    let infoHTML = `<div class="tooltip-title">${communityDistrict}</div>
              <div class="tooltip-info-general">
                <strong>Key Neighborhoods or Landmarks:</strong> ${communityDistrictDescription} <br>
                <strong>Total Complaints: </strong>${numComplaints.toLocaleString()}
              </div>`;
    infoHTML += complaintTypeHTML;
    return infoHTML;
};

// Updates the total complaints KPI
function updateHistCount() {
    const selectedYearSpan = document.getElementById('selectedYear');
    selectedYearSpan.textContent = selectedYear;
    const filteredComplaintCounts = historicalComplaintCountsData.filter(d => (selectedComplaintTypesHist.includes(d.complaintType) && selectedMonthsHist.includes(d.month) && d.year === selectedYear));
    const totalComplaints = filteredComplaintCounts.reduce((accumulator, currentItem) => accumulator + currentItem.numComplaints, 0);
    document.getElementById("totalCountHistorical").textContent = totalComplaints.toLocaleString();
};

// Updates Yearly trend chart based on changing user input
function updateYearOverYearChart(scales) {
    const {
        x,
        y,
        xAxis,
        yAxis,
        line
    } = scales;

    const svg = d3.select("#lineChartHistorical");
    const selectedYearInt = parseInt(selectedYear);

    const filteredComplaintCounts = historicalComplaintCountsData.filter(d => (selectedComplaintTypesHist.includes(d.complaintType) && selectedMonthsHist.includes(d.month)));
    const groupedComplaintCounts = filteredComplaintCounts.reduce((accumulator, currentItem) => {
        itemYear = currentItem.year;
        itemNumComplaints = currentItem.numComplaints;
        // if complaint type doesn't exist in accumulator, initialize it
        if (!accumulator[itemYear]) {
            accumulator[itemYear] = 0;
        }
        accumulator[itemYear] += itemNumComplaints;
        return accumulator;
    }, {});
    // if there's no value for the month, just have it be 0
    const complaintCountsByYear = years.map(year => ({
        year,
        count: groupedComplaintCounts[year] !== undefined ? groupedComplaintCounts[year] : 0
    }));

    // update which x-axis value is highlighted
    svg.select("#x-axis-YoY").selectAll("text")
        .style("font-weight", d => d === selectedYearInt ? "bold" : "normal")
        .style("font-size", d => d === selectedYearInt ? "14px" : "12px")
        .style("fill", d => d === selectedYearInt ? "#FF0000" : "#2F4F4F");

    // update the domain of the y-axis
    y.domain([0, d3.max(complaintCountsByYear, d => d.count)]);

    // update the line and point values
    svg.select("#lineYoY")
        .datum(complaintCountsByYear)
        .attr("d", line);

    // update dot values
    const dots = svg.selectAll(".dot")
        .data(complaintCountsByYear);

    // delete old dots
    dots.exit().remove();

    // add new dots
    dots.enter()
        .append("circle")
        .attr("class", "dot")
        .merge(dots)
        .attr("cx", d => x(d.year))
        .attr("cy", d => y(d.count))
        .attr("r", d => (selectedYear && d.year === selectedYearInt) ? 6 : 4)
        .attr("fill", d => (selectedYear && d.year === selectedYearInt) ? "#FF0000" : "#FF8C00")
        .attr("stroke", "white")
        .attr("stroke-width", 2);

    // update y-axis
    svg.select("#y-axis-YoY")
        .call(yAxis);
};


// Updates the top five community boards based on user selection
function updateTopBoardsHistorical() {
    const filteredComplaintCounts = historicalComplaintCountsData.filter(d => (selectedComplaintTypesHist.includes(d.complaintType) && selectedMonthsHist.includes(d.month) && d.year === selectedYear));
    const groupedComplaintCounts = filteredComplaintCounts.reduce((accumulator, currentItem) => {
        itemCommunityBoard = currentItem.communityBoard;
        itemNumComplaints = currentItem.numComplaints;
        // if complaint type doesn't exist in accumulator, initialize it
        if (!accumulator[itemCommunityBoard]) {
            accumulator[itemCommunityBoard] = 0;
        }
        accumulator[itemCommunityBoard] += itemNumComplaints;
        return accumulator;
    }, {});
    const topFiveBoards = Object.entries(groupedComplaintCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
    const topFiveBoardsHTML = topFiveBoards.map(([key, value]) => {
        return `<li class="board-item">
          <span class="board-name">${key.toProperCase()}</span>
          <span class="board-count">${value.toLocaleString()}</span>
        </li>`
    }).join("");
    document.getElementById("topBoardsHistorical").innerHTML = topFiveBoardsHTML;
};