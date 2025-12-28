document.addEventListener('DOMContentLoaded', () => {

    const bookingListContainer = document.getElementById('booking-list');
    const noBookingsMessage = document.getElementById('no-bookings-message'); // Make sure this ID exists in your HTML

    // Read the user ID from local storage.
    const CURRENT_USER_ID = localStorage.getItem('parking_user_id');
    console.log("User ID from localStorage:", CURRENT_USER_ID); // Log the user ID

    /**
     * Helper function to safely update the noBookingsMessage text.
     * @param {string} text - The message to display.
     */
    function showNoBookingsMessage(text) {
        if (noBookingsMessage) { // <-- ADDED CHECK
            noBookingsMessage.textContent = text;
            noBookingsMessage.style.display = 'block';
        } else {
            console.error("Element with ID 'no-bookings-message' not found in HTML!");
            alert(text); // Fallback to alert if element is missing
        }
        if (bookingListContainer) { // Also check for booking list container
             bookingListContainer.innerHTML = ''; // Clear just in case
        }
    }

    /**
     * Fetches the user's bookings from the API and displays them.
     */
    async function fetchMyBookings() {
        if (!CURRENT_USER_ID) {
            console.error('No user ID found in localStorage. Cannot fetch bookings.');
            showNoBookingsMessage('Could not identify user. Please log in again.'); // Use helper
            return;
        }

        console.log(`Fetching bookings for User ID: ${CURRENT_USER_ID}`); // Log before fetching

        try {
            const response = await fetch(`/api/my-bookings/${CURRENT_USER_ID}`);
            console.log("Fetch response status:", response.status); // Log response status

            if (!response.ok) {
                // Try to get error message from server if possible
                let errorMsg = `HTTP error! Status: ${response.status}`;
                try {
                    // Try parsing as JSON first
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } catch (jsonError) {
                    // If not JSON, try reading as text
                    try {
                        const errorText = await response.text();
                        console.error("Non-JSON error response:", errorText); // Log HTML or text error
                        errorMsg = `Server returned non-JSON error (status ${response.status}). Check console.`;
                    } catch (textError) {
                         // Fallback if reading text also fails
                         console.error("Failed to read error response body.");
                    }
                }
                throw new Error(errorMsg);
            }
            
            const bookings = await response.json();
            console.log("Bookings received from API:", bookings); // Log the raw data received

            displayBookings(bookings);

        } catch (error) {
            console.error('Error fetching bookings:', error);
            showNoBookingsMessage(`Error loading bookings: ${error.message}. Please try again.`); // Use helper
        }
    }

    /**
     * Renders the fetched bookings into the list.
     * @param {Array} bookings - An array of booking objects from the server.
     */
    function displayBookings(bookings) {
        // Ensure containers exist before modifying
        if (!bookingListContainer || !noBookingsMessage) {
             console.error("Booking list container or message element not found.");
             return;
        }

        // Clear any existing content first
        bookingListContainer.innerHTML = ''; 

        if (!bookings || !Array.isArray(bookings) || bookings.length === 0) { // Added check for Array type
            console.log("No bookings found or received data is not an array:", bookings);
            showNoBookingsMessage('No bookings found.'); // Use helper
            return;
        }

        noBookingsMessage.style.display = 'none'; // Hide the message if bookings exist

        bookings.forEach((booking, index) => { // Added index for logging
            console.log(`Processing booking ${index}:`, booking); // Log each booking object

             if (!booking || typeof booking !== 'object') { // Check if booking is a valid object
                 console.warn(`Booking data at index ${index} is invalid:`, booking);
                 return; // Skip this iteration
             }

            const bookingRow = document.createElement('div');
            bookingRow.className = 'booking-row';
            
            let startTime = 'Invalid Date'; // Default value
            try {
                 // Check if time_stamp exists and is a valid string before formatting
                 if (booking.time_stamp && typeof booking.time_stamp === 'string') {
                    startTime = new Date(booking.time_stamp).toLocaleString();
                    // Check if the date conversion was successful
                    if (startTime === "Invalid Date") {
                        console.warn(`Booking ID ${booking.booking_id} has an invalid time_stamp format: ${booking.time_stamp}`);
                    }
                 } else {
                    console.warn(`Booking ID ${booking.booking_id} missing or invalid time_stamp.`);
                    startTime = 'N/A'; // Use N/A if timestamp is missing/invalid
                 }
            } catch (dateError) {
                console.error(`Error formatting date for booking ID ${booking.booking_id}:`, dateError);
                 startTime = 'Error'; // Indicate an error occurred
            }
            
            let actionButton = '';
             // Check if status exists before setting button
             if (booking.status === 'Active') {
                // Ensure booking_id exists before creating the button
                actionButton = `<button class="action-btn release-btn" data-booking-id="${booking.booking_id || ''}">Release</button>`;
             } else if (booking.status === 'Completed') {
                 actionButton = `<button class="action-btn parked-out-btn" disabled>Parked Out</button>`;
             } else {
                 console.warn(`Booking ID ${booking.booking_id} has unexpected status: ${booking.status || 'undefined'}`);
                 actionButton = `<button class="action-btn" disabled>Unknown</button>`;
             }

            // Use fallback values (e.g., 'N/A') if properties are missing or null/undefined
            bookingRow.innerHTML = `
                <span class="cell-id">${booking.booking_id ?? 'N/A'}</span>
                <span class="cell-location">${booking.parking_location ?? 'N/A'}</span>
                <span class="cell-vehicle">${booking.vehicle_number ?? 'N/A'}</span>
                <span class="cell-time">${startTime}</span>
                <span class="cell-action">
                    ${actionButton}
                </span>
            `;

            bookingListContainer.appendChild(bookingRow);
        });
    }

    /**
     * Handles the click event for the "Release" button.
     * @param {Event} event - The click event.
     */
    async function releaseSpot(event) {
        // Check if the clicked element is a release button
        if (!event.target.classList.contains('release-btn')) {
            return;
        }

        const button = event.target;
        const bookingId = button.dataset.bookingId;

        if (!bookingId) {
            alert('Error: Booking ID not found on button.');
            return;
        }

        // Disable button to prevent double-clicks
        button.disabled = true;
        button.textContent = 'Releasing...';

        try {
            const response = await fetch(`/api/release-spot/${bookingId}`, {
                method: 'POST', // Make sure this matches your Flask route
            });

             console.log("Release response status:", response.status); // Log release status

            const result = await response.json(); // Always try to parse JSON

            if (response.ok) {
                 console.log("Release successful:", result);
                alert(`Spot released! Final Cost: Rs. ${result.final_cost}`);
                // Refresh the list to show the "Parked Out" status
                fetchMyBookings(); 
            } else {
                // Use the error message from the JSON if available
                throw new Error(result.error || `Failed to release spot. Status: ${response.status}`);
            }

        } catch (error) {
            console.error('Error releasing spot:', error);
            alert(`Error: ${error.message}`);
            // Re-enable button if it failed
            // Find the button again in case the DOM was refreshed elsewhere (unlikely here, but good practice)
            const failedButton = bookingListContainer.querySelector(`.release-btn[data-booking-id="${bookingId}"]`);
            if (failedButton) {
                failedButton.disabled = false;
                failedButton.textContent = 'Release';
            }
        }
    }

    // --- EVENT LISTENERS ---

    // Add a single event listener to the container for "Release" buttons using event delegation
    if (bookingListContainer) { // Ensure container exists before adding listener
        bookingListContainer.addEventListener('click', releaseSpot);
    } else {
        console.error("Booking list container not found. Cannot add release button listener.");
    }

    // Initial fetch of bookings when the page loads
    fetchMyBookings();
});

