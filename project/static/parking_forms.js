document.addEventListener('DOMContentLoaded', function() {
    
    // --- 1. MODAL ELEMENT REFERENCES ---
    const API_BASE_URL = 'http://127.0.0.1:5000/api/lots';
    
    // Add Modal Elements
    const addModal = document.getElementById("newLotModal");
    const openAddBtn = document.getElementById("openAddModalBtn");
    const closeAddBtn = document.getElementById("closeAddModalBtn");
    const addForm = addModal.querySelector('.modal-form');
    
    // Edit Modal Elements
    const editModal = document.getElementById("editLotModal");
    const closeEditBtn = document.getElementById("closeEditModalBtn");
    const editForm = editModal.querySelector('.modal-form');
    let currentEditLotId = null; // To store the ID of the lot being edited

    // View Modal Elements
    const viewLotModal = document.getElementById("viewLotModal");
    const closeViewLotModalBtn = document.getElementById("closeViewLotModalBtn");
    const spotGridContainer = document.getElementById("spotGridContainer");
    const spotDetailsModal = document.getElementById("spotDetailsModal");


    // --- 2. DYNAMIC CARD DATA (Initialized as empty, populated by API) ---
    let parkingLots = []; // REMOVED DUMMY DATA
    const container = document.querySelector('.parking-lots-grid'); 


    // --- 3. CORE RENDERING FUNCTIONS ---

    function createParkingCard(lot) {
        return `
            <div class="parking-card" data-lot-id="${lot.id}">
                <h3>Parking ${lot.number}</h3>
                <h3>Name : ${lot.name}</h3>
                <div class="spots-info">Occupied Spots : ${lot.occupied}/${lot.maxSpots}</div>
                <div class="price-info">Price Per Hour : Rs. ${lot.price}</div>
                <div class="card-actions">
                    <button class="action-button edit-button" data-id="${lot.id}">Edit</button>
                    <button class="action-button delete-button" data-id="${lot.id}">Delete</button>
                    <button class="action-button view-button" data-id="${lot.id}">View</button>
                </div>
            </div>
        `;
    }

    function renderParkingLots() {
        container.innerHTML = '';
        
        parkingLots.forEach(lot => {
            container.innerHTML += createParkingCard(lot);
        });

        attachCardListeners(); 
    }


    // --- 4. DATA FETCH & INITIALIZATION (Fetch data from Flask API) ---

    async function fetchAndRenderLots() {
        try {
            const response = await fetch(API_BASE_URL, { method: 'GET' });
            if (!response.ok) throw new Error('Failed to fetch data');
            
            // Populate the global array from the API response
            parkingLots = await response.json(); 
            
            // Render the dashboard
            renderParkingLots();

        } catch (error) {
            console.error("Initialization Error: Failed to connect to API.", error);
            container.innerHTML = '<p style="color:red; text-align:center;">Error loading parking lots. Ensure Python server is running on port 5000.</p>';
        }
    }


    // --- 5. CRUD IMPLEMENTATIONS ---

    // Add Lot (Form Submission)
    addForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        const formData = {
            name: event.target.location_name.value,
            address: event.target.address.value,
            pincode: event.target.pincode.value,
            price: parseFloat(event.target.price_per_hour.value),
            maxSpots: parseInt(event.target.max_spots.value),
        };

        try {
            const response = await fetch(API_BASE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (!response.ok) throw new Error('API Error: Could not add lot.');
            
            // On success, refresh the UI from the database
            addModal.style.display = "none";
            addForm.reset();
            alert(`Lot ${formData.name} added successfully!`);
            fetchAndRenderLots();

        } catch (error) {
            console.error('Error adding lot:', error);
            alert('Failed to add parking lot. See console for details.');
        }
    });

    // Delete Lot
    async function handleDeleteLot(lotIdToDelete) {
        if (!confirm(`Are you sure you want to delete Parking Lot #${lotIdToDelete}? This action cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/${lotIdToDelete}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('API Error: Could not delete lot.');
            
            // On success, refresh the UI
            alert(`Lot #${lotIdToDelete} deleted successfully!`);
            fetchAndRenderLots();

        } catch (error) {
            console.error('Error deleting lot:', error);
            alert('Failed to delete lot. See console for details.');
        }
    }

    // Edit Lot (Form Submission)
    editForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        const formData = {
            name: event.target.location_name.value,
            address: event.target.address.value,
            pincode: event.target.pincode.value,
            price: parseFloat(event.target.price_per_hour.value),
            maxSpots: parseInt(event.target.max_spots.value),
        };

        try {
            const response = await fetch(`${API_BASE_URL}/${currentEditLotId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (!response.ok) throw new Error('API Error: Could not update lot.');

            editModal.style.display = "none";
            alert(`Lot #${currentEditLotId} updated successfully!`);
            fetchAndRenderLots();

        } catch (error) {
            console.error('Error updating lot:', error);
            alert('Failed to update lot. Check console for details.');
        }
    });


    // --- 6. ATTACH CARD LISTENERS (Routing to Modals/APIs) ---

    function attachCardListeners() {
        // Edit Button Listener: Populates form and opens modal
        document.querySelectorAll('.edit-button').forEach(button => {
            button.addEventListener('click', function() {
                const lotId = parseInt(this.getAttribute('data-id'));
                const lotData = parkingLots.find(lot => lot.id === lotId);
                
                if (lotData) {
                    currentEditLotId = lotId; // Store ID for PUT request
                    
                    // Populate the Edit Modal Form
                    editForm.querySelector('[name="location_name"]').value = lotData.name;
                    editForm.querySelector('[name="address"]').value = lotData.address;
                    editForm.querySelector('[name="pincode"]').value = lotData.pincode;
                    editForm.querySelector('[name="price_per_hour"]').value = lotData.price;
                    editForm.querySelector('[name="max_spots"]').value = lotData.maxSpots;
                    
                    editModal.style.display = 'block';
                }
            });
        });

        // Delete Button Listener: Triggers API deletion
        document.querySelectorAll('.delete-button').forEach(button => {
            button.addEventListener('click', function() {
                const lotIdToDelete = parseInt(this.getAttribute('data-id'));
                handleDeleteLot(lotIdToDelete);
            });
        });
        
        // View Button Listener: Opens the spot grid modal
        document.querySelectorAll('.view-button').forEach(button => {
            button.addEventListener('click', function() {
                const lotId = parseInt(this.getAttribute('data-id'));
                const lotData = parkingLots.find(lot => lot.id === lotId);

                if (lotData) {
                    generateSpotGrid(lotData); // Opens Wireframe 5 modal
                }
            });
        });
    }


    // --- 7. VIEW MODAL LOGIC (Simplified handlers for client-side demo) ---

    function generateSpotGrid(lotData) {
        spotGridContainer.innerHTML = '';
        
        lotData.spots.forEach(spot => {
            const statusClass = spot.status === 1 ? 'spot-occupied' : 'spot-available';
            const statusLabel = spot.status === 1 ? 'O' : 'A';
            
            const spotButton = document.createElement('button');
            spotButton.className = `spot-button ${statusClass}`;
            spotButton.textContent = statusLabel;
            spotButton.setAttribute('data-spot-id', spot.id);
            spotButton.setAttribute('data-lot-id', lotData.id);
            
            spotButton.addEventListener('click', handleSpotClick);
            spotGridContainer.appendChild(spotButton);
        });

        document.getElementById('viewLotTitle').textContent = `Parking Lot ${lotData.number}`;
        document.getElementById('viewLotOccupancy').textContent = `Occupied ${lotData.occupied}/${lotData.maxSpots}`;
        viewLotModal.style.display = 'block';
    }

    function renderSpotDetails(spotData, lotPrice) {
        let detailsHTML = '';
        
        const lot = parkingLots.find(l => l.id === parseInt(document.querySelector('.spot-button').getAttribute('data-lot-id')));
        const isCurrentLotAvailable = lot.spots.some(s => s.id === spotData.id);


        if (spotData.status === 0 && isCurrentLotAvailable) { // AVAILABLE Spot (Wireframe - 6)
            detailsHTML = `
                <div class="spot-details-header">
                    <h2>Available Parking Spot</h2>
                </div>
                <div class="spot-available-content">
                    <div class="spot-info-chip">
                        <span class="spot-id-label">Id</span>
                        <span class="spot-id-value">${spotData.id}</span>
                    </div>
                    <div class="spot-info-chip">
                        <span class="spot-status-label">Status</span>
                        <span class="spot-available view-action-btn">Open</span>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="form-button delete-action-btn" onclick="handleDeleteSpotFromView(${spotData.id}, ${lot.id})">Remove Spot</button>
                        <button type="button" class="form-button add-button" id="closeSpotDetailsModalBtn">Close</button>
                    </div>
                </div>
            `;
        } else if (spotData.status === 1) { // OCCUPIED Spot (Wireframe - 7)
            detailsHTML = `
                <div class="spot-details-header">
                    <h2>Occupied Parking Slot Details</h2>
                </div>
                <div class="spot-occupied-content">
                    <form class="modal-form">
                        <div class="form-group">
                            <label>Spot Id :</label>
                            <input type="text" value="${spotData.id}" readonly>
                        </div>
                        <div class="form-group">
                            <label>Customer Id :</label>
                            <input type="text" value="${spotData.customerId || 'N/A'}" readonly>
                        </div>
                        <div class="form-group">
                            <label>Vehicle Number :</label>
                            <input type="text" value="${spotData.vehicle || 'N/A'}" readonly>
                        </div>
                        <div class="form-group">
                            <label>Price Per Hour :</label>
                            <input type="text" value="Rs. ${lotPrice}" readonly>
                        </div>
                        <div class="form-group">
                            <label>Estimated Cost of Parking :</label>
                            <input type="text" value="N/A (Requires live calculation)" readonly>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="form-button add-button" onclick="handleCheckout(${spotData.id}, ${lot.id})">Checkout</button>
                            <button type="button" class="form-button cancel-button" id="closeSpotDetailsModalBtn">Close</button>
                        </div>
                    </form>
                </div>
            `;
        }
        
        spotDetailsModal.querySelector('.modal-content').innerHTML = detailsHTML;
        spotDetailsModal.style.display = 'block';

        // Attach close listener to the dynamically created close button
        document.getElementById('closeSpotDetailsModalBtn').addEventListener('click', () => {
             spotDetailsModal.style.display = 'none';
        });
    }

    function handleSpotClick(event) {
        const spotId = parseInt(event.currentTarget.getAttribute('data-spot-id'));
        const lotId = parseInt(event.currentTarget.getAttribute('data-lot-id'));

        const lotData = parkingLots.find(lot => lot.id === lotId);
        const spotData = lotData.spots.find(spot => spot.id === spotId);

        if (spotData && lotData) {
            renderSpotDetails(spotData, lotData.price);
        }
    }


    // --- 8. GLOBAL HANDLERS (Simulated Checkout/Delete Spot - Needs Backend API) ---

    // NOTE: These functions only update the UI state locally. 
    // In a real application, they would require dedicated API endpoints (e.g., /api/spots/delete, /api/booking/checkout).

    window.handleDeleteSpotFromView = function(spotId, lotId) {
        if (!confirm("Confirm delete spot? This will permanently remove the spot. (Local Action)")) {
            return;
        }
        
        let lot = parkingLots.find(l => l.id === lotId);
        if (lot) {
            lot.spots = lot.spots.filter(s => s.id !== spotId);
            lot.maxSpots = lot.spots.length; 
            
            renderParkingLots(); 
            generateSpotGrid(lot); 
            spotDetailsModal.style.display = 'none';
        }
    };
    
    window.handleCheckout = function(spotId, lotId) {
        if (!confirm("Confirm checkout? This will make the spot available. (Local Action)")) {
            return;
        }
        
        let lot = parkingLots.find(l => l.id === lotId);
        let spot = lot.spots.find(s => s.id === spotId);

        if (spot) {
            spot.status = 0;
            spot.customerId = null;
            spot.vehicle = null;
            lot.occupied = lot.spots.filter(s => s.status === 1).length;

            renderParkingLots(); 
            generateSpotGrid(lot); 
            spotDetailsModal.style.display = 'none';
        }
    };


    // --- 9. MODAL OPEN/CLOSE SETUP ---
    
    if (openAddBtn) { openAddBtn.addEventListener('click', function() { addModal.style.display = "block"; }); }
    if (closeAddBtn) { closeAddBtn.addEventListener('click', function() { addModal.style.display = "none"; }); }
    if (closeEditBtn) { closeEditBtn.addEventListener('click', function() { editModal.style.display = "none"; }); }
    
    if (closeViewLotModalBtn) {
        closeViewLotModalBtn.addEventListener('click', () => { viewLotModal.style.display = 'none'; });
    }

    window.onclick = function(event) {
        if (event.target === addModal) { addModal.style.display = "none"; }
        if (event.target === editModal) { editModal.style.display = "none"; }
        if (event.target === viewLotModal) { viewLotModal.style.display = "none"; }
        if (event.target === spotDetailsModal) { spotDetailsModal.style.display = "none"; }
    };


    // Initialize the application by fetching data from the backend
    fetchAndRenderLots();
});
