from flask import Flask, request, jsonify, render_template, redirect, url_for, flash
from sqlalchemy.orm import joinedload
from sqlalchemy import desc
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS 
from datetime import datetime
import json
import math # <-- ADDED FOR BILLING CALCULATION
from werkzeug.security import generate_password_hash, check_password_hash # ADDED SECURITY IMPORTS

# --- CONFIGURATION ---
app = Flask(__name__, template_folder='templates', static_folder='static') 
app.config['SECRET_KEY'] = 'a_secure_secret_key_for_sessions' 
CORS(app) 
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///parking_system.sqlite'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# --- DATABASE MODELS (SQLAlchemy) ---

class User(db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False) # This will be the email
    password_hash = db.Column(db.String(128), nullable=False) # Hashed password
    role = db.Column(db.String(10), nullable=False) 
    full_name = db.Column(db.String(100))

    def set_password(self, password):
        """Hashes the password before storing."""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """Checks the plain text password against the stored hash."""
        return check_password_hash(self.password_hash, password)
    
class ParkingSpot(db.Model):
    __tablename__ = 'parking_spot'
    id = db.Column(db.Integer, primary_key=True)
    lot_id = db.Column(db.Integer, db.ForeignKey('parking_lot.id'), nullable=False)
    spot_number = db.Column(db.String(10), nullable=False) 
    is_occupied = db.Column(db.Boolean, default=False)
    
    active_booking = db.relationship('Booking', 
                                     primaryjoin="and_(ParkingSpot.id == Booking.spot_id, Booking.status == 'Active')",
                                     uselist=False, lazy='joined', viewonly=True) # Added viewonly=True as bookings relationship handles deletion 
    
    # --- ADDED THIS RELATIONSHIP ---
    # Back-reference to the parent lot
    lot = db.relationship('ParkingLot', back_populates='spots')

    # --- ADD THIS RELATIONSHIP ---
    # One-to-many relationship: One spot can have many bookings over time
    bookings = db.relationship('Booking', back_populates='spot', cascade="all, delete-orphan", lazy='dynamic')

    def to_dict(self):
        """Converts spot instance to a dictionary for JSON."""
        return {
            'id': self.id,
            'lotId': self.lot_id, # Added this for the booking form
            'spotNumber': self.spot_number, # Added this
            'status': 1 if self.is_occupied else 0,
            'customerId': self.active_booking.customer_id if self.is_occupied and self.active_booking else None,
            'vehicle': self.active_booking.vehicle_number if self.is_occupied and self.active_booking else None
        }

class ParkingLot(db.Model):
    __tablename__ = 'parking_lot'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    address = db.Column(db.String(200), nullable=False)
    pincode = db.Column(db.String(10), nullable=False)
    price_per_hour = db.Column(db.Float, nullable=False)
    max_spots = db.Column(db.Integer, nullable=False)
    
    # --- MODIFIED THIS RELATIONSHIP ---
    spots = db.relationship('ParkingSpot', back_populates='lot', lazy='dynamic', cascade="all, delete-orphan") 

    def to_dict(self):
        """Converts lot instance to a dictionary for JSON response, including spot details."""
        occupied_count = self.spots.filter(ParkingSpot.is_occupied == True).count()
        
        return {
            'id': self.id,
            'name': self.name,
            'number': f'#{self.id}', 
            'address': self.address,
            'pincode': self.pincode,
            'price': self.price_per_hour,
            'maxSpots': self.max_spots,
            'occupied': occupied_count,
            'spots': [spot.to_dict() for spot in self.spots.all()] 
        }

class Booking(db.Model):
    __tablename__ = 'booking'
    id = db.Column(db.Integer, primary_key=True)
    # --- ADD ondelete='CASCADE' HERE ---
    spot_id = db.Column(db.Integer, 
                        db.ForeignKey('parking_spot.id', ondelete='CASCADE'), 
                        nullable=False)
    
    customer_id = db.Column(db.Integer, 
                            db.ForeignKey('user.id', ondelete='SET NULL'), 
                            nullable=True)
    

    vehicle_number = db.Column(db.String(20), nullable=False)
    start_time = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    end_time = db.Column(db.DateTime, nullable=True)
    # --- REMOVED estimated_cost as final_cost is in Billing ---
    status = db.Column(db.String(10), default='Active', nullable=False) 

    # This links the Booking to its one-and-only Billing record
    billing = db.relationship('Billing', back_populates='booking', uselist=False, cascade="all, delete-orphan")

    # --- ADDED THESE RELATIONSHIPS ---
    # Relationships to get info easily
    user = db.relationship('User')
    spot = db.relationship('ParkingSpot' , back_populates='bookings')


# --- ADD THIS NEW MODEL ---
class Billing(db.Model):
    __tablename__ = 'billing'
    id = db.Column(db.Integer, primary_key=True)
    
    # Foreign key to link this bill to a specific booking
    booking_id = db.Column(db.Integer, db.ForeignKey('booking.id'), nullable=False, unique=True)
    
    # 'Reserved', 'Completed', 'Paid'
    status = db.Column(db.String(20), nullable=False, default='Reserved') 
    
    # This will be NULL (empty) until the user checks out
    final_cost = db.Column(db.Float, nullable=True) 
    
    # The time the bill was finalized (when they leave)
    billing_time = db.Column(db.DateTime, nullable=True) 
    
    # Creates the one-to-one link back to the Booking
    booking = db.relationship('Booking', back_populates='billing') 

    def to_dict(self):
        return {
            'id': self.id,
            'booking_id': self.booking_id,
            'status': self.status,
            'final_cost': self.final_cost,
            'billing_time': self.billing_time.isoformat() if self.billing_time else None
        }
# -------------------------


# --- FRONTEND ROUTES ---

@app.route('/')
def serve_index_page():
    """Serves the main (Admin) Login page (index.html)."""
    return render_template('index.html')

@app.route('/login', methods=['POST'])
def handle_login():
    """Handles Admin login form submission."""
    username = request.form.get('username')
    password = request.form.get('password')

    user = User.query.filter_by(username=username).first()

    if user and user.check_password(password) and user.role == 'Admin':
        # NOTE: In a real app, you would start a session here
        return redirect(url_for('serve_admin_dashboard'))
    else:
        flash('Invalid username or password, or insufficient permissions.', 'error')
        return redirect(url_for('serve_index_page')) # <-- Corrected redirect

@app.route('/admin-dashboard')
def serve_admin_dashboard():
    return render_template('admin_page.html')

@app.route('/admin-summary')
def serve_admin_summary():
    return render_template('admin_summary.html')

# --- NEW USER PAGE ROUTE ---
@app.route('/user-dashboard-page')
def serve_user_dashboard_page():
    """Serves the User page (user_page.html)."""
    return render_template('user_dashboard.html')
# ------------------------------

@app.route('/user-summary')
def serve_user_summary():
    return render_template('user_summary.html')

# --- ADD THIS NEW ROUTE TO main.py ---
@app.route('/my-booking')
def serve_my_booking_page():
    """Serves the 'My Booking' page (my_booking.html)."""
    return render_template('my_booking.html')

@app.route('/user-page')
def serve_user_page():
    """Serves the User page (user_page.html) after they log in."""
    # NOTE: In a real app, this route would check if a session exists
    return render_template('user_page.html')

# --- RENAMED ROUTE ---
@app.route('/register-page') 
def serve_user_reg_page():
    """Serves the User Registration page (user_reg.html)."""
    return render_template('user_reg.html')
# ------------------------------

# --- NEW USER LOGIN PAGE ROUTE ---
@app.route('/user-login')
def serve_user_login_page():
    """Serves the new User Login page (user_login.html)."""
    return render_template('user_login.html')
# ------------------------------


# --- UTILITY ROUTE FOR SETUP (TEMPORARY) ---

@app.route('/setup-admin')
def setup_admin():
    """Temporary route to create the initial admin user if none exists."""
    with app.app_context():
        admin_exists = User.query.filter_by(role='Admin').first()
        if admin_exists:
            return "Admin user already set up."
        
        new_admin = User(username='admin', role='Admin', full_name='System Admin')
        new_admin.set_password('password123') 
        
        db.session.add(new_admin)
        db.session.commit()
        return "Initial Admin User ('admin' / 'password123') created successfully!"


# --- API ROUTES ---

# --- ADD THIS NEW API ROUTE FOR PROFIT SUMMARY ---
@app.route('/api/summary/profit-by-lot', methods=['GET'])
def get_profit_summary():
    """Calculates the total profit for each parking lot based on completed billings."""
    try:
        # Query to join Billing, Booking, ParkingSpot, and ParkingLot
        # and filter for completed billings
        profit_data = db.session.query(
            ParkingLot.id,
            ParkingLot.name,
            db.func.sum(Billing.final_cost) # Sum the final_cost for each lot
        ).select_from(Billing).join(
            Booking, Billing.booking_id == Booking.id
        ).join(
            ParkingSpot, Booking.spot_id == ParkingSpot.id
        ).join(
            ParkingLot, ParkingSpot.lot_id == ParkingLot.id
        ).filter(
            Billing.status == 'Completed' # Only include completed/paid bills
        ).group_by(
            ParkingLot.id, ParkingLot.name # Group by lot to sum costs per lot
        ).order_by(
            ParkingLot.id # Optional: order by lot ID
        ).all()

        results = [
            {
                'lot_id': lot_id,
                'lot_name': lot_name,
                'total_profit': total_profit if total_profit is not None else 0 # Handle cases with no profit yet
            }
            for lot_id, lot_name, total_profit in profit_data
        ]

        return jsonify(results), 200

    except Exception as e:
        app.logger.error(f"Error calculating profit summary: {e}")
        return jsonify({'error': 'An internal server error occurred while calculating profit.'}), 500
# ----------------------------------------------

@app.route('/register', methods=['POST'])
def register_user():
    """Handles the user registration API call from script.js."""
    
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    username = data.get('username') # This is the email
    password = data.get('password')
    full_name = data.get('full_name')

    if not username or not password or not full_name:
        return jsonify({'error': 'Missing required fields'}), 400
    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters long'}), 400

    existing_user = User.query.filter_by(username=username).first()
    if existing_user:
        return jsonify({'error': 'Username (email) already exists'}), 409 # 409 Conflict

    try:
        new_user = User(
            username=username,
            full_name=full_name,
            role='User'  # Default role for new signups
        )
        new_user.set_password(password) # Hash the password

        db.session.add(new_user)
        db.session.commit()

        return jsonify({'message': 'Registration successful! You can now login.'}), 201

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error during registration: {e}")
        return jsonify({'error': 'An internal server error occurred.'}), 500

# --- USER LOGIN API ROUTE (CORRECTED) ---
@app.route('/user-login-api', methods=['POST'])
def handle_user_login():
    """Handles the user login API call from user_login.js."""
    
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    username = data.get('username') # This is the email
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Missing email or password'}), 400

    # Find the user by their email
    user = User.query.filter_by(username=username).first()

    # Check if user exists, password is correct, AND role is 'User'
    if user and user.check_password(password) and user.role == 'User':
        # NOTE: This is where you would create a user session
        
        # On success, return a message and the URL to redirect to
        return jsonify({
            'message': 'Login successful! Redirecting...',
            'user_id': user.id, # <-- CRITICAL FIX: Added user_id
            'redirect_url': url_for('serve_user_dashboard_page') # <-- CRITICAL FIX: Point to correct function
        }), 200
    else:
        # On failure, return a generic error
        return jsonify({'error': 'Invalid email or password.'}), 401 # 401 Unauthorized
# ------------------------------

# --- ADD THIS NEW API ROUTE FOR USER DETAILS ---
@app.route('/api/user-details/<int:user_id>', methods=['GET'])
def get_user_details(user_id):
    """Fetches details for a specific user, like their full name."""
    
    # Check if user exists
    user = User.query.get_or_404(user_id)
    
    try:
        # Return only the necessary details 
        return jsonify({
            'user_id': user.id,
            'full_name': user.full_name 
            # Add other details here if needed later
        }), 200
        
    except Exception as e:
        app.logger.error(f"Error fetching details for user {user_id}: {e}")
        return jsonify({'error': 'An internal server error occurred while fetching user details.'}), 500
# ---------------------------------------------


# --- /api/book-spot ROUTE (DEFINED ONLY ONCE) ---
@app.route('/api/book-spot', methods=['POST'])
def book_spot():
    """
    Handles a new booking request from a user.
    Creates BOTH a Booking record and a Billing record.
    """
    
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    spot_id = data.get('spot_id')
    user_id = data.get('user_id')
    vehicle_number = data.get('vehicle_number')

    if not all([spot_id, user_id, vehicle_number]):
        return jsonify({'error': 'Missing required booking information'}), 400

    # Find the spot and user
    spot = ParkingSpot.query.get(spot_id)
    user = User.query.get(user_id) 

    if not spot:
        return jsonify({'error': 'Invalid parking spot ID'}), 404
    if not user:
        return jsonify({'error': 'Invalid user ID'}), 404
        
    if spot.is_occupied:
        return jsonify({'error': 'This spot is already occupied. Please select another.'}), 409

    try:
        # 1. Create the new booking
        new_booking = Booking(
            spot_id=spot.id,
            customer_id=user.id,
            vehicle_number=vehicle_number,
            status='Active' 
        )
        
        # 2. Create the corresponding billing record
        new_billing = Billing(
            status='Reserved',
            final_cost=None,
            billing_time=None
        )
        
        # 3. Link them together
        new_booking.billing = new_billing
        
        # 4. Mark the spot as occupied
        spot.is_occupied = True
        
        # 5. Add to session (Flask-SQLAlchemy handles adding both new_booking and new_billing)
        db.session.add(new_booking)
        db.session.commit()

        return jsonify({
            'message': 'Booking successful!',
            'booking_id': new_booking.id,
            'billing_id': new_billing.id,
            'status': new_billing.status
        }), 201

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error booking spot: {e}")
        return jsonify({'error': 'An internal server error occurred.'}), 500
# -----------------------------------------


# --- NEW API ROUTE FOR "MY BOOKING" PAGE ---
@app.route('/api/my-bookings/<int:user_id>', methods=['GET'])
def get_my_bookings(user_id):
    """Fetches all bookings for a specific user."""
    
    # Check if user exists
    user = User.query.get_or_404(user_id)
    
    try:
        # Query to get booking, spot, and lot information
        bookings_query = db.session.query(
            Booking, ParkingSpot, ParkingLot
        ).join(
            ParkingSpot, Booking.spot_id == ParkingSpot.id
        ).join(
            ParkingLot, ParkingSpot.lot_id == ParkingLot.id
        ).filter(
            Booking.customer_id == user.id
        ).order_by(
            Booking.start_time.desc() # Show newest first
        ).all()
        
        results = []
        for booking, spot, lot in bookings_query:
            results.append({
                'booking_id': booking.id,
                'parking_location': f"Lot #{lot.id}: {lot.name}",
                'vehicle_number': booking.vehicle_number,
                'time_stamp': booking.start_time.isoformat(), # Show when it started
                'status': booking.status # 'Active' or 'Completed'
            })
            
        return jsonify(results), 200
        
    except Exception as e:
        app.logger.error(f"Error fetching bookings for user {user_id}: {e}")
        return jsonify({'error': 'An internal server error occurred.'}), 500
# -----------------------------------------

# --- ADD THIS NEW API ROUTE FOR USER SUMMARY ---
@app.route('/api/user-summary/<int:user_id>', methods=['GET'])
def get_user_summary(user_id):
    """Fetches all billing records for a specific user."""
    
    # Check if user exists
    user = User.query.get_or_404(user_id)
    
    try:
        # Query Billing and eagerly load related Booking data
        billing_records = Billing.query.options(
            joinedload(Billing.booking) # Efficiently load booking details
        ).join(Booking).filter(
            Booking.customer_id == user.id
        ).order_by(
            # --- MODIFIED SORT ORDER ---
            desc(Booking.id) # Sort by Booking ID descending (most recent booking first)
            # --- END MODIFICATION ---
        ).all()
        
        results = []
        for bill in billing_records:
            results.append({
                'billing_id': bill.id,
                'booking_id': bill.booking_id,
                'customer_id': bill.booking.customer_id, # Get customer_id via booking relationship
                'final_cost': bill.final_cost,
                'billing_time': bill.billing_time.isoformat() if bill.billing_time else None,
                'start_time': bill.booking.start_time.isoformat() if bill.booking else None, # Include start time for duration calc
                'status': bill.status 
            })
            
        return jsonify(results), 200
        
    except Exception as e:
        app.logger.error(f"Error fetching summary for user {user_id}: {e}")
        return jsonify({'error': 'An internal server error occurred while fetching summary.'}), 500
# ---------------------------------------------

# --- NEW API ROUTE FOR "RELEASE SPOT" ---
@app.route('/api/release-spot/<int:booking_id>', methods=['POST'])
def release_spot(booking_id):
    """
    Handles releasing a spot.
    Calculates the final bill and updates booking, billing, and spot status.
    """
    
    booking = Booking.query.get_or_404(booking_id)
    
    if booking.status != 'Active':
        return jsonify({'error': 'This booking is already completed.'}), 400
        
    try:
        # Get related objects
        billing = booking.billing
        spot = booking.spot
        lot = spot.lot
        
        # Calculate cost
        end_time = datetime.utcnow()
        duration = end_time - booking.start_time
        
        # Bill for at least one hour
        duration_hours = math.ceil(duration.total_seconds() / 3600) 
        if duration_hours < 1:
            duration_hours = 1
            
        final_cost = duration_hours * lot.price_per_hour
        
        # Update database records
        booking.end_time = end_time
        booking.status = 'Completed'
        
        billing.final_cost = final_cost
        billing.billing_time = end_time
        billing.status = 'Completed'
        
        spot.is_occupied = False
        
        db.session.commit()
        
        return jsonify({
            'message': 'Spot released successfully! Bill generated.',
            'booking_id': booking.id,
            'status': booking.status,
            'final_cost': final_cost,
            'duration_hours': duration_hours
        }), 200

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error releasing spot {booking_id}: {e}")
        return jsonify({'error': 'An internal server error occurred.'}), 500
# -----------------------------------------


@app.route('/api/lots', methods=['GET'])
def get_all_lots():
    """Fetches all parking lots and returns them for dashboard rendering."""
    lots = ParkingLot.query.all()
    lots_data = [lot.to_dict() for lot in lots]
    return jsonify(lots_data)


@app.route('/api/lots', methods=['POST'])
def add_new_lot():
    """Handles submission of the 'Add Parking Lot' form and initializes spots."""
    data = request.get_json()

    required_fields = ['name', 'address', 'pincode', 'price', 'maxSpots']
    if not data or not all(key in data for key in required_fields):
        return jsonify({'message': 'Missing data fields'}), 400
    
    try:
        new_lot = ParkingLot(
            name=data['name'],
            address=data['address'],
            pincode=data['pincode'],
            price_per_hour=float(data['price']),
            max_spots=int(data['maxSpots'])
        )
        db.session.add(new_lot)
        db.session.commit() # Commit here to get new_lot.id

        # Initialize ParkingSpot records
        max_spots = int(data['maxSpots'])
        for i in range(1, max_spots + 1):
            spot = ParkingSpot(lot_id=new_lot.id, spot_number=str(i), is_occupied=False)
            db.session.add(spot)
        
        db.session.commit() # Commit all the new spots
        
        return jsonify(new_lot.to_dict()), 201 

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error adding lot: {e}")
        return jsonify({'message': f'Database error occurred: {e}'}), 500


@app.route('/api/lots/<int:lot_id>', methods=['PUT'])
def update_lot(lot_id):
    """Handles submission of the 'Edit Parking Lot' form."""
    lot = ParkingLot.query.get_or_404(lot_id)
    data = request.get_json()

    try:
        # Update fields
        lot.name = data.get('name', lot.name)
        lot.address = data.get('address', lot.address)
        lot.pincode = data.get('pincode', lot.pincode)
        lot.price_per_hour = float(data.get('price', lot.price_per_hour))
        
        if int(data.get('maxSpots', lot.max_spots)) != lot.max_spots:
             return jsonify({'message': 'Cannot change max spots after creation in this simplified API.'}), 400

        db.session.commit()
        return jsonify(lot.to_dict()), 200
    
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error updating lot {lot_id}: {e}")
        return jsonify({'message': f'Database error: {e}'}), 500


@app.route('/api/lots/<int:lot_id>', methods=['DELETE'])
def delete_lot(lot_id):
    """Deletes a parking lot and all associated spots/bookings (due to cascading)."""
    lot = ParkingLot.query.get_or_404(lot_id)
    
    try:
        db.session.delete(lot)
        db.session.commit()
        return jsonify({'message': f'Lot {lot_id} deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error deleting lot {lot_id}: {e}")
        return jsonify({'message': f'Database error: {e}'}), 500
        
# --- INITIAL SETUP ---
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)


