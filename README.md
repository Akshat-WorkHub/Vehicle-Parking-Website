# Vehicle Parking Application

## Project Details
- **Student Name:** Akshat Agarwal  
- **Registration Number:** 23BKT0003  
- **Course:** DBMS Lab (BCSE302P)  
- **Faculty:** Maheshwari B  

---

## Introduction
The Vehicle Parking Application is a database-driven web application developed to automate parking management operations. The system replaces manual parking processes with a structured database approach to manage users, parking lots, parking spots, bookings, and billing efficiently.

---

## Objectives
- Design a normalized relational database schema
- Implement CRUD operations for core entities
- Manage transactional operations for parking booking and release
- Ensure data integrity using relationships and cascading rules
- Provide a clear separation between frontend and backend logic

---

## Technologies Used
- **Backend:** Python, Flask, Flask-SQLAlchemy  
- **Database:** SQLite  
- **Frontend:** HTML, CSS, JavaScript  
- **Visualization:** Chart.js  

---

## Database Design
The system consists of five main tables:
- **User** – Stores admin and user details  
- **ParkingLot** – Represents parking areas  
- **ParkingSpot** – Individual parking spots in a lot  
- **Booking** – Records parking sessions  
- **Billing** – Maintains billing details for each booking  

Relationships include one-to-many and one-to-one mappings with cascading rules to maintain referential integrity.

---

## Key Functionalities
### Admin
- Add, update, and delete parking lots
- View parking lot occupancy
- View lot-wise profit summary

### User
- Register and login
- View available parking lots
- Book and release parking spots
- View booking and billing history

---

## Implementation Highlights
- ORM-based models implemented using Flask-SQLAlchemy
- Atomic transactions for booking and releasing parking spots
- Automatic billing calculation based on parking duration
- Aggregated reports using SQL functions for admin analytics

---

## Conclusion
The project successfully implements a database-centric vehicle parking management system. It demonstrates effective use of relational database concepts, ORM-based backend development, and transactional integrity, fulfilling the objectives of the DBMS Lab course.
