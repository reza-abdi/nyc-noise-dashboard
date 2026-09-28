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

// Adapting original drawYearOverYear() function
// creates the month over month line chart
const monthOrder = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthAbbr = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function constructMonthOverMonth() {
    const filteredComplaintCounts = predComplaintCountsData.filter(d => (selectedComplaintTypesPred.includes(d.complaintType) && selectedModel === d.model));
    const groupedComplaintCounts = filteredComplaintCounts.reduce((accumulator, currentItem) => {
        itemMonth = currentItem.month;
        itemNumComplaints = currentItem.numComplaints;
        // if complaint type doesn't exist in accumulator, initialize it
        if (!accumulator[itemMonth]) {
            accumulator[itemMonth] = 0;
        }
        accumulator[itemMonth] += itemNumComplaints;
        return accumulator;
    }, {});
    // if there's no value for the month, just have it be 0
    const complaintCountsByMonth = monthOrder.map((monthName, idx) => ({
        month: idx,
        count: groupedComplaintCounts[monthName] || 0
    }))
    // CONSIDER: do we want to hide the line chart if there's no data (every month is 0?)

    const svg = d3.select("#lineChartPredictive");

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
        .domain([0, 11])
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(complaintCountsByMonth, d => d.count) * 1.1])
        .nice()
        .range([height, 0]);

    const line = d3.line()
        .x(d => x(d.month))
        .y(d => y(d.count));

    // X-axis
    const xAxis = d3.axisBottom(x).tickFormat(d => monthAbbr[d]).ticks(12)
    const xAxisGroup = g.append("g")
        .attr("class", "x-axis")
        .attr("id", "x-axis-MoM")
        .attr("transform", `translate(0,${height})`)
        .call(xAxis);

    // bold the months that are selected
    xAxisGroup.selectAll("text")
      .style("font-weight", d => selectedMonthsPred.includes(monthOrder[d]) ? "bold" : "normal")
      .style("font-size", d => selectedMonthsPred.includes(monthOrder[d]) ? "14px" : "12px")
      .style("fill", d => selectedMonthsPred.includes(monthOrder[d]) ? "#FF0000" : "#2F4F4F");

    // Y-axis
    const yAxis = d3.axisLeft(y).ticks(5)
    g.append("g")
        .attr("class", "y-axis")
        .attr("id", "y-axis-MoM")
        .call(yAxis);

    // Line with gradient color
    g.append("path")
        .attr("id", "lineMoM")
        .datum(complaintCountsByMonth)
        .attr("fill", "none")
        .attr("stroke", "#FF6347")
        .attr("stroke-width", 2.5)
        .attr("d", line);

    // Dots
    g.selectAll(".dot")
        .data(complaintCountsByMonth)
        .enter().append("circle")
        .attr("class", "dot")
        .attr("cx", d => x(d.month))
        .attr("cy", d => y(d.count))
        .attr("r", d => (selectedMonthsPred.includes(monthOrder[d.month]) ? 6 : 4))
        .attr("fill", d => (selectedMonthsPred.includes(monthOrder[d.month]) ? "#FF0000" : "#FF8C00"))
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

// helper function to get the color of a BoroCD in choropleth
// BoroCD: the community district BoroCD we are getting the color for
function getColor(BoroCD) {
    // get the value of the number of incidents for the country and year
    const filteredComplaintCounts = predComplaintCountsData.filter(d => (selectedModel === d.model && d.BoroCD == BoroCD && selectedComplaintTypesPred.includes(d.complaintType) && selectedMonthsPred.includes(d.month)));
    // if there is no value, return white
    if (filteredComplaintCounts.length === 0) {
        return "white"
    };
    const boroCDComplaintCount = filteredComplaintCounts.reduce((accumulator, currentItem) => accumulator + currentItem.numComplaints, 0);
    return color(boroCDComplaintCount);
}

// this function updates the Choropleth colors when a user's input changes
function updateChoropleth() {
    // update the fill value
    d3.select("#communities")
        .selectAll("path")
        .attr("fill", d => getColor(d.properties.BoroCD));
};

// updates the color domain and legend whenever a user changes complaint types or months
// this stays the same across models for easier comparison
function updateColorDomainAndLegendPred(){
    // update color domain
    const filteredComplaintCounts = predComplaintCountsData.filter(d => (selectedComplaintTypesPred.includes(d.complaintType) && selectedMonthsPred.includes(d.month)));
    const groupedComplaintCountsAllModels = d3.flatRollup(
        filteredComplaintCounts,
        v => d3.sum(v, d => d.numComplaints),
        d => d.model,
        d => d.BoroCD
    ).map(d => d[2]);
    color.domain(d3.extent(groupedComplaintCountsAllModels));

    // update legend
    const legendSequential = d3.legendColor()
        .shapeWidth(40)
        .cells(colorPalette.length)
        .labelFormat(d3.format(",.1f")) // uses built-in D3
        .title("Predicted Complaints")
        .scale(color);
    d3.select("#legendPredicted").call(legendSequential);

}
