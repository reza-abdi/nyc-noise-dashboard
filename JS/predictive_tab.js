// global variables to keep track of what the user selected/is hovering over
// note: initial values of selectedMonthsPred and selectedComplaintType should match what is present in dropdown
let selectedMonthsPred = ["January"];
let selectedComplaintTypesPred = ["Noise"];
let selectedBoroCDPred;
let selectedModel = "Base";

// creates color scale
let color = d3.scaleQuantile().range(colorPalette);

const parseDate = d3.timeParse("%m/%d/%Y");
const pathToCsv = "data/forecasts_combined.csv";
let complaintCounts = d3.dsv(",", pathToCsv, function(d) {
    const date = parseDate(d.Year_Month);
    return {
        model: d["Model"],
        month: d3.timeFormat("%B")(date),
        communityBoard: d["Community Board"],
        complaintType: d["Complaint Type"],
        numComplaints: +d.predicted_count
    }
});

// help read multiple files concurrently
Promise.all([mapNYC, complaintCounts, boroLookup]).then(function(values) {
    // add BoroCD to each complaint count
    const lookupMap = new Map(values[2].map(d => [d.communityBoard, d.BoroCD]));
    values[1].forEach(d => {
        d.BoroCD = +lookupMap.get(d.communityBoard);
    })
    // assign data (I wanted these to be global variables)
    districtJSONData = values[0];
    predComplaintCountsData = values[1];
    BoroCDLookupData = values[2];
    // initialize the charts in the predictive tab
    initPredTab();
});

// this function should be called once the data from files have been read
function initPredTab() {
    // construct choropleth map
    constructChoropleth();
    // construct month over month visualization
    const scales = constructMonthOverMonth();

    // initial call to fill the map and pred count
    updateColorDomainAndLegendPred();
    updateChoropleth();
    updatePredCount();
    updateMonthOverMonth(scales);
    updateTopBoardsPredictive();

    // update charts if the user changes the model
    const modelDropdown = d3.select("#modelDropdown")
    modelDropdown.on("change", function(){
        selectedModel = this.selectedOptions[0].value;
        updateChoropleth();
        updatePredCount();
        updateMonthOverMonth(scales);
        updateTopBoardsPredictive();
    });

    // update charts if user changes month or complaint type dropdown values
    // NOTE: we're currently not changing month over month line chart if a user changes selected months
    // if we add bold/highlighted behavior we can update that chart
    const monthDropdown = d3.select("#monthDropdownPredictive")
    monthDropdown.on("change", function() {
        selectedMonthsPred = Array.from(this.selectedOptions).map(option => option.value);
        updateColorDomainAndLegendPred();
        updateChoropleth();
        updatePredCount();
        updateTopBoardsPredictive();
        updateMonthOverMonth(scales); // the line shouldn't change, but selected months will
    })
    const complaintTypeDropdown = d3.select("#complaintTypeDropdownPredictive")
    complaintTypeDropdown.on("change", function() {
        selectedComplaintTypesPred = Array.from(this.selectedOptions).map(option => option.value);
        updateColorDomainAndLegendPred();
        updateChoropleth();
        updatePredCount();
        updateTopBoardsPredictive();
        updateMonthOverMonth(scales);
    })

    // Hovering tooltip behavior on the Choropleth map
    const tooltip = d3.select("#tooltipPred");
    d3.select("#communities").selectAll("path")
        .on("mouseover", function(event, d) {
            // mute out the other community districts
            d3.select("#communities").selectAll("path")
                .style("stroke-width", "1px")
                .style("opacity", "0.5");
            // make selected community district clear
            d3.select(this)
                .style("stroke-width", "2px")
                .style("opacity", "1");

            selectedBoroCDPred = event.properties.BoroCD;
            const eventInfo = d3.event;
            // update and display tooltip
            tooltipHTML = generateInfo();
            tooltip
                .style("display", "block")
                .html(tooltipHTML)
                .style("left", (eventInfo.pageX - 5) + "px")
                .style("top", (eventInfo.pageY - 5) + "px");
        })
        .on("mouseout", function(event, d) {
            d3.select("#communities").selectAll("path")
                .style("stroke-width", "1px")
                .style("opacity", "1");
            d3.select("#info").style("display", "none")
            tooltip.style("display", "none");
        })
};

// initial function to construct the Choropleth map
// I made the width equal to the height to make it square, is that ok?
function constructChoropleth() {
    const choropleth = d3.select("#choropleth");
    const mapWidth = parseInt(choropleth.style("width")) - padding.left - padding.right
    // draw basic map outline
    projection.fitSize([mapWidth, mapWidth], districtJSONData);
    // add margins to map
    const map = d3.select("#choropleth")
        .attr("width", parseInt(choropleth.style("width")))
        .attr("height", parseInt(choropleth.style("width")));
    // this just draws the outline, fill attribute happens during updateChoropleth function
    map.append("g")
        .attr("transform", "translate(10, 10)")
        .attr("id", "communities")
        .selectAll("path")
        .data(districtJSONData.features)
        .enter().append("path")
        .attr("d", path)
        .style("stroke", "black");

    // create legend
    const legend = d3.select("#choropleth");
    // right now this is hardcoded
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
        .attr("id", "legendPredicted")
        .attr("transform", "translate(30,50)");

    // create tooltip
    // needs to be off of the map-container div instead of choropleth svg to appear
    const tooltip = d3.select("#predictive-map-container")
        .append("div")
        .attr("class", "tooltip")
        .attr("id", "tooltipPred")
        .style("position", "absolute")
        .style("display", "none")
        .style("background", "#fff")
        .style("pointer-events", "none");
};
