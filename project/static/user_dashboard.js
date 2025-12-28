document.addEventListener('DOMContentLoaded', () => {

    const showBtn = document.getElementById('show-lots-btn');
    const lotGrid = document.getElementById('parking-lot-grid');

    // --- Modal Elements ---
    const backdrop = document.getElementById('modal-backdrop');
    
    // Spot Selection Modal
    const spotModal = document.getElementById('spot-selection-modal');
    const spotModalTitle = document.getElementById('spot-modal-title');
    const spotModalOccupiedCount = document.getElementById('spot-modal-occupied-count');
    const spotGrid = document.getElementById('spot-grid');
    const spotModalCloseBtn = document.getElementById('spot-modal-close-btn');

    // Booking Form Modal
    const bookingModal = document.getElementById('booking-form-modal');
    const bookingForm = document.getElementById('booking-form');
    const bookingCancelBtn = document.getElementById('booking-cancel-btn');
    const spotIdInput = document.getElementById('book-spot-id');
    const lotIdInput = document.getElementById('book-lot-id');
    const userIdInput = document.getElementById('book-user-id'); // We'll set this dynamically
    const vehicleInput = document.getElementById('book-vehicle-number');
    
    // Get the reserve button to disable it during fetch
    const reserveBtn = bookingForm.querySelector('.reserve-btn');

    // --- Global variable to store fetched lot data ---
    let allLotsData = [];
    
    // --- Get Logged-in User ID ---
    const CURRENT_USER_ID = localStorage.getItem('parking_user_id'); // Read from localStorage
    console.log("Dashboard User ID:", CURRENT_USER_ID); // Log for debugging

    // --- GET WELCOME GREETING ELEMENT ---
    const welcomeGreetingElement = document.getElementById('welcome-greeting'); 
    
    // --- FUNCTION TO UPDATE GREETING ---
    async function updateWelcomeGreeting(userId) {
        if (!welcomeGreetingElement) {
            console.warn("Welcome greeting element not found.");
            return; 
        }
        if (!userId) {
            console.warn("No user ID found for greeting.");
            const hour = new Date().getHours(); 
            const timeOfDay = hour < 12 ? "Good Morning" : "Good Evening";
            welcomeGreetingElement.textContent = `Welcome User (${timeOfDay})`; 
            return;
        }

        try {
            const response = await fetch(`/api/user-details/${userId}`);
            if (!response.ok) {
                let errorMsg = `HTTP Error: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } catch(e) {/* Ignore */}
                throw new Error(errorMsg);
            }
            const userData = await response.json();

            const hour = new Date().getHours();
            const timeOfDay = hour < 12 ? "Good Morning" : "Good Evening";

            if (userData && userData.full_name) {
                welcomeGreetingElement.textContent = `Welcome ${userData.full_name} (${timeOfDay})`;
            } else {
                console.warn("User data received, but full_name missing:", userData);
                welcomeGreetingElement.textContent = `Welcome User (${timeOfDay})`;
            }

        } catch (error) {
            console.error('Failed to fetch user details for greeting:', error);
            const hour = new Date().getHours();
            const timeOfDay = hour < 12 ? "Good Morning" : "Good Evening";
            welcomeGreetingElement.textContent = `Welcome (${timeOfDay})`;
        }
    }
    // --- END NEW FUNCTION ---


    // --- Event Listeners ---

    // 1. Show/Hide Parking Lots
    if (showBtn) {
        showBtn.addEventListener('click', () => {
            if (lotGrid.classList.contains('hidden')) {
                fetchLotsAndDisplay();
                showBtn.textContent = 'Hide';
            } else {
                lotGrid.classList.add('hidden');
                // Consider delaying innerHTML clear if transition is long
                lotGrid.innerHTML = ''; 
                showBtn.textContent = 'Show';
            }
        });
    }

    // 2. Handle "View" button click on a parking card (Event Delegation)
    if (lotGrid) { // Ensure grid exists
        lotGrid.addEventListener('click', (event) => {
            const viewBtn = event.target.closest('.view-btn');
            if (viewBtn) {
                const lotId = viewBtn.dataset.lotId;
                // Find the lot data using == for potential type difference (string vs number)
                const lot = allLotsData.find(l => l.id == lotId); 
                if (lot) {
                    openSpotSelectionModal(lot);
                } else {
                    console.error(`Lot data not found for lotId: ${lotId}`);
                }
            }
        });
    } else {
         console.error("Element with ID 'parking-lot-grid' not found.");
    }

    // 3. Handle "Available" spot click (Event Delegation)
     if (spotGrid) { // Ensure spot grid exists
        spotGrid.addEventListener('click', (event) => {
            const spotBtn = event.target.closest('.spot-btn.available');
            if (spotBtn) {
                const spotId = spotBtn.dataset.spotId;
                const lotId = spotBtn.dataset.lotId;
                openBookingFormModal(lotId, spotId);
            }
        });
     } else {
          console.error("Element with ID 'spot-grid' not found.");
     }

    // 4. Handle "Reserve" button click
    if (bookingForm) { // Ensure form exists
        bookingForm.addEventListener('submit', (event) => {
            event.preventDefault(); // Prevent form from submitting normally
            
            // --- UPDATED: Use CURRENT_USER_ID from localStorage ---
            if (!CURRENT_USER_ID) {
                alert("Error: Could not identify logged-in user. Please log in again.");
                return;
            }
            
            const bookingData = {
                spot_id: spotIdInput.value,
                user_id: CURRENT_USER_ID, // Use the ID from localStorage
                vehicle_number: vehicleInput.value.trim() // Trim whitespace
            };
            // --- END UPDATE ---

            // Basic validation
            if (!bookingData.vehicle_number) {
                 alert("Please enter your vehicle number.");
                 vehicleInput.focus();
                 return;
            }

            // Call the async function to handle the reservation
            handleBookingReservation(bookingData);
        });
    } else {
        console.error("Element with ID 'booking-form' not found.");
    }

    // 5. Close Modals
    if (spotModalCloseBtn) spotModalCloseBtn.addEventListener('click', closeAllModals);
    if (bookingCancelBtn) bookingCancelBtn.addEventListener('click', closeAllModals);
    if (backdrop) backdrop.addEventListener('click', closeAllModals);


    // --- Functions ---

    // --- NEW ASYNC FUNCTION to handle the booking ---
    async function handleBookingReservation(bookingData) {
        if (!reserveBtn) { // Check if reserve button exists
            console.error("Reserve button not found.");
            return;
        }
        // Disable button to prevent multiple clicks
        reserveBtn.disabled = true;
        reserveBtn.textContent = 'Reserving...';

        try {
            // This is the new API endpoint we need to create in main.py
            const response = await fetch('/api/book-spot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(bookingData),
            });

            // Always try to parse JSON, even for errors
            const result = await response.json(); 

            if (!response.ok) {
                // If server returns an error (like 409 Conflict)
                throw new Error(result.error || `Booking failed with status: ${response.status}`);
            }
            
            // If successful, server returns the new booking info
            // Use optional chaining just in case properties are missing
            alert(`Booking successful for Spot ${result?.spot_id || bookingData.spot_id}!`);

            closeAllModals();
            // Refresh the entire list of parking lots to show new occupied count
            fetchLotsAndDisplay();

        } catch (error) {
            console.error('Reservation Error:', error);
            alert(`Error: ${error.message}`); // Show specific error

        } finally {
            // Re-enable the button
            reserveBtn.disabled = false;
            reserveBtn.textContent = 'Reserve';
        }
    }
    // ----------------------------------------


    async function fetchLotsAndDisplay() {
         if (!lotGrid) return; // Don't proceed if grid doesn't exist

        try {
            // This calls your existing '/api/lots' endpoint
            const response = await fetch('/api/lots');
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            
            allLotsData = await response.json(); // Store data globally
            lotGrid.innerHTML = ''; // Clear previous content

            if (!Array.isArray(allLotsData)) {
                 console.error("Received invalid data from /api/lots:", allLotsData);
                 throw new Error("Invalid data received from server.");
            }

            if (allLotsData.length === 0) {
                lotGrid.innerHTML = '<p>No parking lots are available at this time.</p>';
            } else {
                allLotsData.forEach(lot => {
                     // Basic check for essential lot data
                     if (!lot || typeof lot.id === 'undefined' || typeof lot.number === 'undefined') {
                         console.warn("Skipping invalid lot data:", lot);
                         return; // Skip this iteration
                     }

                    const cardHTML = `
                        <div class="parking-card">
                            <h2>Parking ${lot.number}</h2> 
                            <p>Name : ${lot.name ?? 'N/A'}</p>
                            <p class="card-detail occupied">
                                Occupied Spots : ${lot.occupied ?? '?'}/${lot.maxSpots ?? '?'}
                            </p>
                            <p class="card-detail price">
                                Price Per Hour : Rs. ${lot.price ?? '?'}
                            </p>
                            <!-- Add data-lot-id to the button -->
                            <button class="view-btn" data-lot-id="${lot.id}">View</button>
                        </div>
                    `;
                    lotGrid.insertAdjacentHTML('beforeend', cardHTML);
                });
            }
            lotGrid.classList.remove('hidden'); // Show the grid
        } catch (error) {
            console.error('Failed to fetch parking lots:', error);
             if (lotGrid) { // Check again before modifying
                lotGrid.innerHTML = `<p style="color: red;">Error: Could not load parking lots. ${error.message}</p>`;
                lotGrid.classList.remove('hidden'); // Ensure grid is visible to show error
             }
        }
    }

    function openSpotSelectionModal(lot) {
         // Ensure modal elements exist
         if (!spotModal || !spotModalTitle || !spotModalOccupiedCount || !spotGrid || !backdrop) {
             console.error("Spot selection modal elements not found.");
             return;
         }
         // Basic check for essential lot data
         if (!lot || typeof lot.id === 'undefined' || !Array.isArray(lot.spots)) {
             console.error("Invalid lot data passed to openSpotSelectionModal:", lot);
             alert("Error: Could not load spot details for this lot.");
             return;
         }

        // 1. Populate modal with data
        spotModalTitle.textContent = `Parking ${lot.number ?? '?'}`;
        spotModalOccupiedCount.textContent = `Occupied ${lot.occupied ?? '?'}/${lot.maxSpots ?? '?'}`;
        
        // 2. Clear and create spot grid
        spotGrid.innerHTML = '';
        lot.spots.forEach(spot => {
             // Basic check for essential spot data
             if (!spot || typeof spot.id === 'undefined' || typeof spot.status === 'undefined') {
                 console.warn("Skipping invalid spot data:", spot);
                 return; // Skip this iteration
             }
            const isOccupied = spot.status === 1;
            const spotButton = document.createElement('button');
            spotButton.className = `spot-btn ${isOccupied ? 'occupied' : 'available'}`;
            // Use spotNumber if available, otherwise fallback
            spotButton.textContent = isOccupied ? 'O' : (spot.spotNumber ? `A-${spot.spotNumber}` : 'A'); 
            spotButton.disabled = isOccupied;
            spotButton.dataset.spotId = spot.id;
            spotButton.dataset.lotId = lot.id; // Pass lot.id here
            spotGrid.appendChild(spotButton);
        });

        // 3. Show the modal
        backdrop.classList.add('active');
        spotModal.classList.add('active');
    }

    function openBookingFormModal(lotId, spotId) {
         // Ensure modal elements exist
         if (!bookingModal || !spotIdInput || !lotIdInput || !userIdInput || !vehicleInput || !spotModal || !backdrop) {
             console.error("Booking form modal elements not found.");
             return;
         }
          // --- UPDATED: Set User ID from localStorage ---
         if (!CURRENT_USER_ID) {
             alert("Error: Could not identify logged-in user. Please log in again before booking.");
             return;
         }
         userIdInput.value = CURRENT_USER_ID; 
         // --- END UPDATE ---

        // 1. Populate the form
        spotIdInput.value = spotId;
        lotIdInput.value = lotId;
        vehicleInput.value = ''; // Clear vehicle input
        vehicleInput.focus(); // Set focus to vehicle input

        // 2. Close spot modal, open booking modal
        spotModal.classList.remove('active');
        bookingModal.classList.add('active');
        // Backdrop stays active
    }

    function closeAllModals() {
         if (backdrop) backdrop.classList.remove('active');
         if (spotModal) spotModal.classList.remove('active');
         if (bookingModal) bookingModal.classList.remove('active');
    }

    // --- Initial setup ---
     // Set the user ID in the booking form initially (though it's disabled in HTML)
     if (userIdInput && CURRENT_USER_ID) {
         userIdInput.value = CURRENT_USER_ID;
     } else if (userIdInput) {
         console.warn("User ID input found, but no user ID in localStorage.");
     }

     // --- CALL FUNCTION TO UPDATE GREETING ON LOAD ---
    updateWelcomeGreeting(CURRENT_USER_ID);

});

