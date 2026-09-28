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
