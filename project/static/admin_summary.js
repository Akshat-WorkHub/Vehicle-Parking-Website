document.addEventListener('DOMContentLoaded', () => {

    // Buttons and Sections
    const showProfitBtn = document.getElementById('show-profit-btn');
    const showStatusBtn = document.getElementById('show-status-btn');
    const profitSection = document.getElementById('profit-section');
    const statusSection = document.getElementById('status-section');
    
    // Profit Chart Elements
    const profitChartContainer = document.getElementById('profit-chart-container');
    const profitChartCanvas = document.getElementById('profitChart');
    const profitChartLegend = document.getElementById('profitChartLegend');
    const profitErrorMessage = document.getElementById('profit-error-message');
    let profitChartInstance = null; // To hold the profit chart instance

    // Status Chart Elements
    const statusChartContainer = document.getElementById('status-chart-container'); 
    // const statusChartCanvas = document.getElementById('statusChart'); // Canvas is created dynamically
    const statusErrorMessage = document.getElementById('status-error-message');
    let statusChartInstance = null; // To hold the status chart instance


    // --- Event Listeners ---

    // Ensure buttons exist before adding listeners
    if (showProfitBtn && showStatusBtn && profitSection && statusSection) {
        showProfitBtn.addEventListener('click', () => {
            showProfitBtn.classList.add('active');
            showStatusBtn.classList.remove('active');
            profitSection.classList.remove('hidden');
            statusSection.classList.add('hidden');
            // Destroy status chart if switching away
            if (statusChartInstance) {
                try { statusChartInstance.destroy(); } catch (e) { console.error("Error destroying status chart:", e); }
                statusChartInstance = null;
            }
            // Clear status container content when hiding
            if (statusChartContainer) statusChartContainer.innerHTML = ''; 
            if (statusErrorMessage) statusErrorMessage.style.display = 'none';

            fetchAndRenderProfitChart(); 
        });

        showStatusBtn.addEventListener('click', () => {
            showStatusBtn.classList.add('active');
            showProfitBtn.classList.remove('active');
            statusSection.classList.remove('hidden');
            profitSection.classList.add('hidden');
             // Destroy profit chart if switching away
            if (profitChartInstance) {
                 try { profitChartInstance.destroy(); } catch (e) { console.error("Error destroying profit chart:", e); }
                profitChartInstance = null;
            }
             // Clear profit container content when hiding (except canvas wrapper for potential re-use)
             if (profitChartLegend) profitChartLegend.innerHTML = '';
             if (profitErrorMessage) profitErrorMessage.style.display = 'none';

            fetchAndRenderLotStatusChart(); // Call the new chart function
        });
    } else {
        console.error("Summary control buttons or sections not found!");
    }

    // --- Data Fetching and Rendering ---

    // Profit Chart (Pie) 
    async function fetchAndRenderProfitChart() {
        // Check essential elements exist
        if (!profitChartCanvas || !profitChartLegend || !profitErrorMessage || !profitChartContainer) {
             console.error("Profit chart elements not found."); 
             showProfitError("Cannot display profit chart - required elements missing.");
             return; 
        }
        profitErrorMessage.style.display = 'none'; 
        profitChartLegend.innerHTML = '<li>Loading profit data...</li>';
         // Make sure canvas container is visible if hidden previously
         profitChartContainer.style.display = 'flex'; // Or your default display style

        if (profitChartInstance) {
            try { profitChartInstance.destroy(); } catch (e) { console.error("Error destroying profit chart:", e); }
            profitChartInstance = null;
        }

        try {
            const response = await fetch('/api/summary/profit-by-lot'); 
            if (!response.ok) {
                 let errorData;
                 try {
                    errorData = await response.json();
                 } catch (e) {
                     errorData = { error: `HTTP error! Status: ${response.status}` };
                 }
                 throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
            }
            const profitData = await response.json();
            if (!profitData || !Array.isArray(profitData) || profitData.length === 0) {
                 showProfitError('No profit data available.');
                 return;
            }
            renderProfitChart(profitData);
        } catch (error) {
            console.error('Error fetching/rendering profit chart:', error);
             showProfitError(`Failed to load profit data: ${error.message}`);
        }
    }

    function renderProfitChart(data) {
        if (!profitChartCanvas) { // Double check canvas exists
             console.error("Profit chart canvas not found!");
             showProfitError("Chart canvas element is missing.");
             return;
        }
        let ctx;
         try { // Get context safely
             ctx = profitChartCanvas.getContext('2d');
             if (!ctx) throw new Error("Could not get 2D context");
         } catch (e) {
             console.error("Error getting profit chart context:", e);
             showProfitError("Failed to initialize profit chart rendering context.");
             return;
         }

        const labels = data.map(item => item.lot_name || `Lot #${item.lot_id}`);
        const profits = data.map(item => item.total_profit || 0);
        const totalProfit = profits.reduce((sum, val) => sum + (val || 0), 0); 
        const colors = generateColors(labels.length);

        if (profitChartInstance) { 
             try { profitChartInstance.destroy(); } catch(e){ console.error("Error destroying previous profit chart:", e); }
        }

        try {
            profitChartInstance = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Profit by Lot',
                        data: profits,
                        backgroundColor: colors,
                        borderColor: '#fff', 
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false, 
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.label || '';
                                    let value = typeof context.raw === 'number' ? context.raw : 0;
                                    let percentage = totalProfit > 0 ? ((value / totalProfit) * 100).toFixed(1) : 0;
                                    return `${label}: Rs. ${value.toFixed(2)} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
            generateCustomLegend(profitChartLegend, labels, colors, profits, totalProfit);
        } catch (chartError) {
             console.error("Error creating profit chart:", chartError);
             showProfitError("Failed to render profit chart.");
        }
    }
    
    function showProfitError(message) {
         if (profitChartContainer) profitChartContainer.style.display = 'none'; // Hide chart area on error
        if (profitChartLegend) profitChartLegend.innerHTML = ''; 
        if (profitErrorMessage) {
            profitErrorMessage.textContent = message;
            profitErrorMessage.style.display = 'block';
        }
        if (profitChartInstance) {
             try { profitChartInstance.destroy(); } catch (e) { console.error("Error destroying chart:", e); }
             profitChartInstance = null;
        } 
        // No need to clear canvas if container is hidden
    }

    // Lot Status (Bar Chart)
    async function fetchAndRenderLotStatusChart() {
         if (!statusChartContainer || !statusErrorMessage) {
             console.error("Status chart container or error message element not found."); 
             if(statusErrorMessage) {
                 statusErrorMessage.textContent = "Cannot display status chart - required elements missing.";
                 statusErrorMessage.style.display = 'block';
             } else {
                 alert("Cannot display status chart - required elements missing.");
             }
             return; 
         }

        statusErrorMessage.style.display = 'none'; 
        if (statusChartInstance) { 
            try { statusChartInstance.destroy(); } catch(e) { console.error("Error destroying status chart:", e); }
            statusChartInstance = null;
        }
         statusChartContainer.innerHTML = '<canvas id="statusChart"></canvas><p style="text-align:center;">Loading status data...</p>'; 
         const newStatusChartCanvas = document.getElementById('statusChart'); 

         if (!newStatusChartCanvas) {
             console.error("Failed to create status chart canvas element dynamically.");
             showStatusError("Failed to initialize status chart components.");
             return;
         }

        try {
            const response = await fetch('/api/lots'); 
            if (!response.ok) {
                 let errorData;
                 try {
                    errorData = await response.json();
                 } catch (e) {
                    errorData = { error: `HTTP error! Status: ${response.status}` };
                 }
                 throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
            }
            const lotsData = await response.json();
            
             if (!document.getElementById('status-chart-container')) {
                 console.log("Status view was hidden before data arrived. Aborting render.");
                 return; 
             }

            if (!lotsData || !Array.isArray(lotsData) || lotsData.length === 0) {
                 showStatusError('No parking lots found.');
                 return;
            }
             const loadingMessage = statusChartContainer.querySelector('p');
             if (loadingMessage) loadingMessage.remove();
             
            renderLotStatusBarChart(lotsData, newStatusChartCanvas); 

        } catch (error) {
             if (document.getElementById('status-chart-container')) {
                console.error('Error fetching/rendering lot status chart:', error);
                showStatusError(`Failed to load lot status: ${error.message}`);
             } else {
                 console.log("Status view was hidden before error occurred. Aborting error display.");
             }
        }
    }

    function renderLotStatusBarChart(lots, canvasElement) { 
         if (!canvasElement) { 
             console.error("Status chart canvas element not found or invalid!");
             showStatusError("Chart canvas element is missing.");
             return;
         }
         let ctx;
         try { 
             ctx = canvasElement.getContext('2d');
             if (!ctx) throw new Error("Could not get 2D context");
         } catch (e) {
             console.error("Error getting status chart context:", e);
             showStatusError("Failed to initialize status chart rendering context.");
             return;
         }
        
        const labels = lots.map(lot => lot.name || `Lot #${lot.number}`);

        // --- FIX: Calculate as numbers, remove .toFixed(1) ---
        const occupiedPercentages = lots.map(lot => {
            const max = parseFloat(lot.maxSpots);
            const occupied = parseFloat(lot.occupied);
            return (max > 0 && !isNaN(occupied)) ? Math.min(100, Math.max(0, (occupied / max) * 100)) : 0; // Return number
        });
        const availablePercentages = lots.map(lot => {
             const max = parseFloat(lot.maxSpots);
             const occupied = parseFloat(lot.occupied);
             return (max > 0 && !isNaN(occupied)) ? Math.min(100, Math.max(0, ((max - occupied) / max) * 100)) : 0; // Return number
        });
        // --- END FIX ---


        if (statusChartInstance) { 
             try {statusChartInstance.destroy();} catch(e){ console.error("Error destroying previous status chart:", e); }
        }

        try {
            // Ensure ChartDataLabels plugin is registered if not done globally
            // Chart.register(ChartDataLabels); // Usually needed if loaded via script tag

            statusChartInstance = new Chart(ctx, {
                type: 'bar',
                plugins: [ChartDataLabels], // Register plugin for this chart instance
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Occupied Spots (%)',
                            data: occupiedPercentages, // Now numbers
                            backgroundColor: '#e74c3c', // Red for occupied
                            borderColor: '#c0392b',
                            borderWidth: 1
                        },
                        {
                            label: 'Available Spots (%)',
                            data: availablePercentages, // Now numbers
                            backgroundColor: '#2ecc71', // Green for available
                            borderColor: '#27ae60',
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false, 
                    indexAxis: 'x', 
                    scales: {
                        x: {
                            stacked: true, 
                             title: {
                                 display: true,
                                 text: 'Parking Lots'
                             }
                        },
                        y: {
                            stacked: true,
                            beginAtZero: true,
                            max: 100, 
                            title: {
                                display: true,
                                text: 'Percentage (%)'
                            },
                             ticks: {
                                 callback: function(value) {
                                     return (typeof value === 'number') ? value + "%" : value;
                                 }
                             }
                        }
                    },
                    plugins: {
                        title: {
                             display: true,
                             text: 'Parking Lot Occupancy Status (%)',
                             font: { size: 16 }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    // --- FIX: Format value here ---
                                    let value = typeof context.raw === 'number' ? context.raw : 0;
                                    return `${label}: ${value.toFixed(1)}%`; // Format to 1 decimal place
                                    // --- END FIX ---
                                }
                            }
                        },
                        legend: {
                             position: 'top', 
                        },
                         // Datalabels configuration
                        datalabels: {
                            display: true,
                            color: 'white',
                            anchor: 'center', // Position in the center
                            align: 'center',  // Align in the center
                            font: {
                                weight: 'bold'
                            },
                            // --- FIX: Format value here ---
                            formatter: (value, context) => {
                                // Value is now a number
                                if (value < 5) { // Hide labels for very small segments
                                    return null;
                                }
                                return value.toFixed(1) + '%'; // Format to 1 decimal place
                            },
                            // --- END FIX ---
                        }
                    }
                }
            });
        } catch (chartError) {
             console.error("Error creating status chart:", chartError);
             showStatusError("Failed to render status chart.");
        }
    }

     function showStatusError(message) {
         if (statusChartInstance) {
            try { statusChartInstance.destroy(); } catch(e) { console.error("Error destroying status chart:", e);}
            statusChartInstance = null;
         }
         if (statusChartContainer) {
              if (document.getElementById('status-chart-container')) {
                  statusChartContainer.innerHTML = ''; 
              }
         }
         if (statusErrorMessage) {
            if (statusSection && !statusSection.classList.contains('hidden')) {
                statusErrorMessage.textContent = message;
                statusErrorMessage.style.display = 'block';
            }
         }
    }


    // --- Utility Functions ---

    function generateColors(count) {
        const baseColors = [
            '#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6', 
            '#34495e', '#1abc9c', '#e67e22', '#d35400', '#c0392b' 
        ];
        count = Math.max(1, Math.floor(count) || 1);
        const colors = [];
        for (let i = 0; i < count; i++) {
            colors.push(baseColors[i % baseColors.length]);
        }
        return colors;
    }

    function generateCustomLegend(legendContainer, labels, colors, values, total) {
         if (!legendContainer) return; 
         if (!Array.isArray(labels) || !Array.isArray(colors) || !Array.isArray(values)) {
             console.error("Invalid data for legend generation.");
             legendContainer.innerHTML = '<li>Error generating legend</li>';
             return;
         }
         total = typeof total === 'number' && isFinite(total) ? total : 0;

        legendContainer.innerHTML = ''; 
         const ul = document.createElement('ul');

        labels.forEach((label, index) => {
             if (index >= colors.length || index >= values.length) {
                 console.warn(`Legend generation skipped for index ${index} due to data mismatch.`);
                 return; 
             }
             const value = typeof values[index] === 'number' ? values[index] : 0; 
             const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
             const li = document.createElement('li');
            li.innerHTML = `
                <span class="legend-color-box" style="background-color: ${colors[index]}"></span>
                ${label || 'Unnamed'}: Rs. ${value.toFixed(2)} (${percentage}%) 
            `; 
             ul.appendChild(li);
        });
         legendContainer.appendChild(ul);
    }


    // --- Initial Load ---
     if (profitChartCanvas && profitChartLegend && profitErrorMessage) {
        fetchAndRenderProfitChart(); // Load profit chart by default
     } else {
         console.error("Initial profit chart elements not found. Cannot load default chart.");
         if(profitErrorMessage) {
             profitErrorMessage.textContent = "Error initializing summary page.";
             profitErrorMessage.style.display = 'block';
         }
     }

});

