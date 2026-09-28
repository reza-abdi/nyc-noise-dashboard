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

// tab functionality
function openTab(event, tabContentName) {
    // Get all elements with class="tabcontent" and hide them
    var tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    // Get all elements with class="tablinks" and remove the class "active"
    var tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    // Show current tab, add "active" class to the button that opened the tab
    document.getElementById(tabContentName).style.display = "block";
    event.currentTarget.className += " active";

    // dispatch custom event
    window.dispatchEvent(new CustomEvent("tabChanged", {
        detail: {
            tab: tabContentName
        }
    }));
}

// used to put the name of the community district in proper case
// https://stackoverflow.com/questions/196972/convert-string-to-title-case-with-javascript
String.prototype.toProperCase = function() {
    return this.replace(/\w\S*/g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
};

// Mappings between complaint type in 311 dataste and the value we're displaying on the FE
const complaintTypeMappings = {
    "Noise": "General/Unspecified",
    "Noise - Commercial": "Commercial",
    "Noise - Helicopter": "Helicopter",
    "Noise - House of Worship": "House of Worship",
    "Noise - Park": "Park",
    "Noise - Residential": "Residential",
    "Noise - Street/Sidewalk": "Street/Sidewalk",
    "Noise - Vehicle": "Vehicle",
    "Collection Truck Noise": "Collection Truck"
}