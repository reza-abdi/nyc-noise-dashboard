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
