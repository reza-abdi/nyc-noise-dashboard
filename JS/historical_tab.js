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
