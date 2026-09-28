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
