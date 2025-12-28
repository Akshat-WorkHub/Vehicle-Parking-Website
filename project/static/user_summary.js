document.addEventListener('DOMContentLoaded', () => {

    const tableBody = document.getElementById('billing-table-body');
    const noSummaryMessage = document.getElementById('no-summary-message');
    const errorMessage = document.getElementById('summary-error-message');

    // Read the user ID from local storage.
    const CURRENT_USER_ID = localStorage.getItem('parking_user_id');
    console.log("Summary User ID from localStorage:", CURRENT_USER_ID);

    /**
     * Helper function to show error messages.
     * @param {string} msg - The error message to display.
     */
    function showError(msg) {
        if (errorMessage) {
            errorMessage.textContent = msg;
            errorMessage.style.display = 'block';
        } else {
            alert(msg); // Fallback
        }
        if (noSummaryMessage) noSummaryMessage.style.display = 'none';
        if (tableBody) tableBody.innerHTML = ''; // Clear table
    }

    /**
     * Helper function to show the "no data" message.
     */
     function showNoDataMessage() {
         if (noSummaryMessage) {
            noSummaryMessage.style.display = 'block';
         } else {
             console.warn("Element 'no-summary-message' not found.");
         }
        if (errorMessage) errorMessage.style.display = 'none';
        if (tableBody) tableBody.innerHTML = ''; // Clear table
     }

    /**
     * Fetches the user's billing summary from the API and displays it.
     */
    async function fetchBillingSummary() {
        if (!CURRENT_USER_ID) {
            console.error('No user ID found in localStorage.');
            showError('Could not identify user. Please log in again.');
            return;
        }

        console.log(`Fetching summary for User ID: ${CURRENT_USER_ID}`);

        try {
            // Fetch data from the new API endpoint
            const response = await fetch(`/api/user-summary/${CURRENT_USER_ID}`);
            console.log("Summary fetch response status:", response.status);

            if (!response.ok) {
                let errorMsg = `HTTP error! Status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } catch (e) { console.warn("Could not parse error response as JSON."); }
                throw new Error(errorMsg);
            }

            const summaryData = await response.json();
            console.log("Summary data received:", summaryData);

            displaySummary(summaryData);

        } catch (error) {
            console.error('Error fetching billing summary:', error);
            showError(`Error loading summary: ${error.message}. Please try again.`);
        }
    }

    /**
     * Renders the fetched summary data into the table.
     * @param {Array} summaryItems - An array of billing summary objects.
     */
    function displaySummary(summaryItems) {
         // Ensure elements exist
         if (!tableBody || !noSummaryMessage || !errorMessage) {
              console.error("Required table elements not found.");
              alert("Error displaying summary table.");
              return;
         }

        tableBody.innerHTML = ''; // Clear previous data
        errorMessage.style.display = 'none'; // Hide error

        if (!summaryItems || !Array.isArray(summaryItems) || summaryItems.length === 0) {
            console.log("No summary items found.");
            showNoDataMessage();
            return;
        }

        noSummaryMessage.style.display = 'none'; // Hide no data message

        summaryItems.forEach(item => {
            const row = tableBody.insertRow();

            // Calculate duration (optional, if needed and not provided by API)
            // Example calculation (replace with API data if available):
            let durationHours = 'N/A';
            if (item.start_time && item.billing_time) {
                 try {
                     const start = new Date(item.start_time);
                     const end = new Date(item.billing_time);
                     const durationMillis = end - start;
                     durationHours = Math.ceil(durationMillis / (1000 * 60 * 60)); // Calculate hours, ceiling
                     if (durationHours < 1) durationHours = 1; // Minimum 1 hour
                     durationHours = durationHours.toFixed(0); // Show whole hours
                 } catch (e) {
                     console.error("Error calculating duration:", e);
                     durationHours = 'Calc Error';
                 }
            } else if (item.status !== 'Reserved') { // Only show N/A for ongoing if others calculated
                 durationHours = 'N/A';
            } else {
                 durationHours = 'Ongoing'; // Or empty if reserved
            }

             // Apply status class for color (optional)
            let statusClass = '';
            if (item.status === 'Completed') statusClass = 'status-completed';
            else if (item.status === 'Reserved') statusClass = 'status-reserved';
            else if (item.status === 'Paid') statusClass = 'status-paid';


            row.innerHTML = `
                <td>${item.billing_id ?? 'N/A'}</td>
                <td>${item.booking_id ?? 'N/A'}</td>
                <td>${item.customer_id ?? 'N/A'}</td>
                <td>${typeof item.final_cost === 'number' ? `Rs. ${item.final_cost.toFixed(2)}` : (item.status === 'Reserved' ? '-' : 'N/A')}</td>
                <td>${durationHours}</td>
                <td class="${statusClass}">${item.status ?? 'N/A'}</td>
            `;
        });
    }

    // --- Initial Load ---
    fetchBillingSummary();

});
