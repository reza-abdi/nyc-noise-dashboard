// there was some JS code that we ended up not using for the final project
// adding them here in case we wanted to use them

    // Noise color palette
    const noiseColors = [
      '#FF0000',  // Loud red (sirens, alarms)
      '#FF4500',  // Orange red (construction)
      '#FF6347',  // Tomato (street noise)
      '#FF8C00',  // Dark orange (traffic)
      '#FFA500',  // Orange (horns)
      '#FFD700',  // Gold (transition)
      '#87CEEB',  // Sky blue (quieter)
      '#4682B4',  // Steel blue (calm)
      '#5F9EA0',  // Cadet blue (peaceful)
      '#708090',  // Slate gray (quiet)
      '#2F4F4F'   // Dark slate gray (silence)
    ];

    // Complaint type categories for pie chart
    const complaintCategories = [
      'Loud Music/Party',
      'Construction',
      'Barking Dog',
      'Car/Truck Horn',
      'Loud Talking',
      'Banging/Pounding',
      'Ice Cream Truck',
      'Leaf Blower',
      'Other'
    ];

     // Make this function globally accessible for your choropleth scripts
    window.showComplaintBreakdown = showComplaintBreakdown;
    window.hideComplaintBreakdown = hideComplaintBreakdown;


    // Update top boards list
    function updateTopBoardsList(elementId, boardsData) {
      const list = document.getElementById(elementId);
      list.innerHTML = boardsData.map(board => 
        `<li class="board-item">
          <span class="board-name">${board.name}</span>
          <span class="board-count">${board.count.toLocaleString()}</span>
        </li>`
      ).join('');
    }


    // Generate breakdown data for a community board
    function generateComplaintBreakdown(boardName) {
      return complaintCategories.map(category => ({
        category: category,
        count: Math.floor(Math.random() * 500) + 50
      })).sort((a, b) => b.count - a.count);
    }

    // Restored Original PIE CHART function
    function drawPieChart(selector, data, title) {
      const svg = d3.select(selector);
      svg.selectAll("*").remove();
      
      const width = parseInt(svg.style('width'));
      const height = parseInt(svg.attr('height'));
      const radius = Math.min(width, height) / 2 - 10;
      
      const g = svg.append("g")
        .attr("transform", `translate(${width/2},${height/2})`);
      
      const pie = d3.pie()
        .value(d => d.count)
        .sort(null);
      
      const arc = d3.arc()
        .innerRadius(0)
        .outerRadius(radius);
      
      const arcs = g.selectAll(".arc")
        .data(pie(data))
        .enter().append("g")
        .attr("class", "arc");
      
      arcs.append("path")
        .attr("d", arc)
        .attr("fill", (d, i) => noiseColors[i % noiseColors.length])
        .attr("stroke", "white")
        .attr("stroke-width", 2)
        .style("opacity", 0.9);
      
      // Add percentage labels for larger slices
      arcs.append("text")
        .attr("transform", d => `translate(${arc.centroid(d)})`)
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .attr("fill", "white")
        .text(d => {
          const percent = (d.data.count / d3.sum(data, d => d.count) * 100);
          return percent > 5 ? percent.toFixed(0) + "%" : "";
        });
    }

    // Restored Original PIE LEGEND function
    function drawPieLegend(elementId, data) {
      const legendDiv = document.getElementById(elementId);
      const total = d3.sum(data, d => d.count);
      
      legendDiv.innerHTML = data.map((d, i) => `
        <div class="legend-item">
          <div class="legend-color" style="background-color: ${noiseColors[i % noiseColors.length]}"></div>
          <span class="legend-label">${d.category}</span>
          <span class="legend-value">${d.count.toLocaleString()}</span>
        </div>
      `).join('');
    }

    // Show pie chart for clicked community board
    function showComplaintBreakdown(boardName, tabType) {
      const pieContainerId = tabType === 'predictive' ? 'pieChartContainerPredictive' : 'pieChartContainerHistorical';
      const pieChartId = tabType === 'predictive' ? '#pieChartPredictive' : '#pieChartHistorical';
      const pieTitleId = tabType === 'predictive' ? 'pieChartTitlePredictive' : 'pieChartTitleHistorical';
      const pieLegendId = tabType === 'predictive' ? 'pieLegendPredictive' : 'pieLegendHistorical';
      const topBoardsContainerId = tabType === 'predictive' ? 'topBoardsContainerPredictive' : 'topBoardsContainerHistorical';
      
      const breakdownData = generateComplaintBreakdown(boardName);
      
      document.getElementById(pieContainerId).style.display = 'block';
      document.getElementById(topBoardsContainerId).style.display = 'none';
      document.getElementById(pieTitleId).textContent = `${boardName} - Complaint Types`;
      
      drawPieChart(pieChartId, breakdownData, boardName);
      drawPieLegend(pieLegendId, breakdownData);
    }

    // Hide pie chart
    function hideComplaintBreakdown(tabType) {
      const pieContainerId = tabType === 'predictive' ? 'pieChartContainerPredictive' : 'pieChartContainerHistorical';
      const topBoardsContainerId = tabType === 'predictive' ? 'topBoardsContainerPredictive' : 'topBoardsContainerHistorical';
      
      document.getElementById(pieContainerId).style.display = 'none';
      document.getElementById(topBoardsContainerId).style.display = 'block';
    }

// Make popup functions globally accessible for your choropleth scripts
window.showPieChartPopup = showPieChartPopup;
window.closePieChartPopup = closePieChartPopup;
window.showPieChartPopupHistorical = showPieChartPopupHistorical;
window.closePieChartPopupHistorical = closePieChartPopupHistorical;


// Popup pie chart functions for Predictive tab (Restored original arguments and logic)
    function showPieChartPopup(boardName, x, y) {
      const popup = document.getElementById('pieChartPopup');
      const breakdownData = generateComplaintBreakdown(boardName);
      
      document.getElementById('pieChartPopupTitle').textContent = `${boardName} - Complaint Types`;
      drawPieChart('#pieChartPopupSvg', breakdownData, boardName);
      drawPieLegend('pieChartPopupLegend', breakdownData);
      
      popup.style.display = 'block';
      // Original positioning logic using input coordinates
      popup.style.left = x + 'px';
      popup.style.top = y + 'px';
    }

    function closePieChartPopup() {
      document.getElementById('pieChartPopup').style.display = 'none';
    }

    // Popup pie chart functions for Historical tab (Restored original arguments and logic)
    function showPieChartPopupHistorical(boardName, x, y) {
      const popup = document.getElementById('pieChartPopupHistorical');
      const breakdownData = generateComplaintBreakdown(boardName);
      
      document.getElementById('pieChartPopupTitleHistorical').textContent = `${boardName} - Complaint Types`;
      drawPieChart('#pieChartPopupSvgHistorical', breakdownData, boardName);
      drawPieLegend('pieChartPopupLegendHistorical', breakdownData);
      
      popup.style.display = 'block';
      // Original positioning logic using input coordinates
      popup.style.left = x + 'px';
      popup.style.top = y + 'px';
    }

    function closePieChartPopupHistorical() {
      document.getElementById('pieChartPopupHistorical').style.display = 'none';
    }


// Generate toy data for year-over-year trends
    function generateYearOverYearData() {
      const years = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
      return years.map(year => ({
        year: year,
        count: Math.floor(Math.random() * 20000) + 30000 + (year - 2014) * 1000
      }));
    }

    // Generate toy data for community boards
    function generateCommunityBoardData(year) {
      const boards = [
        'Manhattan CB 1', 'Manhattan CB 2', 'Manhattan CB 3', 'Manhattan CB 4', 'Manhattan CB 5',
        'Brooklyn CB 1', 'Brooklyn CB 2', 'Brooklyn CB 6', 'Brooklyn CB 7',
        'Queens CB 1', 'Queens CB 2', 'Queens CB 3', 'Queens CB 7',
        'Bronx CB 1', 'Bronx CB 4', 'Bronx CB 6',
        'Staten Island CB 1', 'Staten Island CB 2'
      ];
      
      return boards.map(board => ({
        name: board,
        count: Math.floor(Math.random() * 5000) + 1000 + (year - 2014) * 50
      })).sort((a, b) => b.count - a.count).slice(0, 5);
    }



// Initialize custom multiselects
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    
    const monthMultiselectPredictive = new CustomMultiselect(
      'monthMultiselectPredictive', 
      months, 
      'Select Months'
    );

    const complaintTypeMultiselectPredictive = new CustomMultiselect(
      'complaintTypeMultiselectPredictive', 
      complaintCategories, 
      'Select Complaint Types'
    );

    const monthMultiselectHistorical = new CustomMultiselect(
      'monthMultiselectHistorical', 
      months, 
      'Select Months'
    );

    const complaintTypeMultiselectHistorical = new CustomMultiselect(
      'complaintTypeMultiselectHistorical', 
      complaintCategories, 
      'Select Complaint Types'
    );

    // Make multiselects globally accessible
    window.monthMultiselectPredictive = monthMultiselectPredictive;
    window.complaintTypeMultiselectPredictive = complaintTypeMultiselectPredictive;
    window.monthMultiselectHistorical = monthMultiselectHistorical;
    window.complaintTypeMultiselectHistorical = complaintTypeMultiselectHistorical;

    // Add event listeners for choropleth updates
    document.getElementById('monthMultiselectPredictive').addEventListener('multiselectchange', (e) => {
      console.log('Predictive months changed:', e.detail.values);
      // Trigger change event on original select element if it exists
      const originalSelect = document.getElementById('monthDropdownPredictive');
      if (originalSelect) {
        // Update original select to match
        Array.from(originalSelect.options).forEach(opt => {
          opt.selected = e.detail.values.includes(opt.value);
        });
        originalSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
      // Call update function if available
      if (typeof updatePredictiveMap === 'function') {
        updatePredictiveMap();
      }
    });

    document.getElementById('complaintTypeMultiselectPredictive').addEventListener('multiselectchange', (e) => {
      console.log('Predictive complaint types changed:', e.detail.values);
      const originalSelect = document.getElementById('complaintTypeDropdownPredictive');
      if (originalSelect) {
        Array.from(originalSelect.options).forEach(opt => {
          opt.selected = e.detail.values.includes(opt.value);
        });
        originalSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (typeof updatePredictiveMap === 'function') {
        updatePredictiveMap();
      }
    });

    document.getElementById('monthMultiselectHistorical').addEventListener('multiselectchange', (e) => {
      console.log('Historical months changed:', e.detail.values);
      const originalSelect = document.getElementById('monthDropdownHistorical');
      if (originalSelect) {
        Array.from(originalSelect.options).forEach(opt => {
          opt.selected = e.detail.values.includes(opt.value);
        });
        originalSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (typeof updateHistoricalMap === 'function') {
        updateHistoricalMap();
      }
    });

    document.getElementById('complaintTypeMultiselectHistorical').addEventListener('multiselectchange', (e) => {
      console.log('Historical complaint types changed:', e.detail.values);
      const originalSelect = document.getElementById('complaintTypeDropdownHistorical');
      if (originalSelect) {
        Array.from(originalSelect.options).forEach(opt => {
          opt.selected = e.detail.values.includes(opt.value);
        });
        originalSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (typeof updateHistoricalMap === 'function') {
        updateHistoricalMap();
      }
    });