// This is for things that are shared between multiple charts or are generic components (like the tabs)

// Choropleth projection and path
// inspired by: https://observablehq.com/@holistudio/3d-topographical-maps-with-nyc-open-data-d3
var projection = d3.geoTimes()
var path = d3.geoPath().projection(projection);

// colorPalette used to standardize
var colorPalette = [
    "#2F4F4F", // Dark slate gray (silence) 
    "#708090", // Slate gray (quiet)
    "#5F9EA0", // Cadet blue (peaceful) 
    "#4682B4", // Steel blue (calm) 
    "#87CEEB", // Sky blue (quieter) 
    "#FFD700", // Gold (transition)
    "#FFA500", // Orange (horns) 
    "#FF8C00", // Dark orange (traffic) 
    "#FF6347", // Tomato (street noise) 
    "#FF4500", // Orange red (construction)
    "#FF0000" // Loud red (sirens, alarms)
]

// padding used for the Choropleth map
var padding = {
    right: 10,
    left: 10
};

// GLOBAL VARS FOR DATA
let districtJSONData, historicalComplaintCountsData, predComplaintCountsData, BoroCDLookupData;

// DATA: Community districts JSON
var pathToJson = "data/NYC_community_districts.json"
var mapNYC = d3.json(pathToJson);

// DATA: lookup file to go from BoroCD to the community board
var boroLookup = d3.dsv(",", "data/lookup_boroCD_community_board.csv", function(d) {
    return {
        BoroCD: d.BoroCD,
        communityBoard: d["Community Board"],
        description: d["Description"]
    }
})

// Choropleth legend dimensions
legendWidth = 215;
legendHeight = 270;
legendXY = {
    x: 20,
    y: 20
}
