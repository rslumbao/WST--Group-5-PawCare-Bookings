# PawCare Bookings

## About the Project

PawCare Bookings is a web-based pet grooming appointment booking system developed by WST Group 5. It allows customers to view pet grooming services, choose an appointment date and time, and submit booking information through a website.

The system uses a Node.js and Express.js backend to process booking requests and manage appointment availability.

## Features

- Online pet grooming appointment booking
- Pet grooming service selection
- Appointment date and time selection
- Form validation for required information
- Available and unavailable time-slot display
- Backend appointment availability validation
- Prevention of overlapping bookings
- Booking record storage in JSON format

## Technologies Used

- HTML
- CSS
- JavaScript
- Node.js
- Express.js
- JSON
- Visual Studio Code

## Project Structure

```text
WST_G5_Pawcare-Bookings/
├── backend/
│   ├── bookings.json
│   ├── db.js
│   ├── package.json
│   ├── package-lock.json
│   └── Server.js
├── frontend/
│   ├── images/
│   ├── index.html
│   ├── script.js
│   └── style.css
├── package-lock.json
└── README.md
```

## Requirements

Before running the application, make sure you have installed:

- Node.js
- npm
- A web browser
- Visual Studio Code (recommended)

## Installation

1. Open the project folder in Visual Studio Code.
2. Open the integrated terminal.
3. Navigate to the backend folder:

   ```bash
   cd backend
   ```

4. Install the dependencies:

   ```bash
   npm install
   ```

## How to Run

1. In the terminal, make sure you are inside the `backend` folder.
2. Start the server:

   ```bash
   node Server.js
   ```

3. Wait for the server confirmation message.
4. Open your browser and visit:

   http://localhost:3000/

5. Select a grooming service, choose an available appointment date and time, complete the required information, and submit your booking.

Keep the terminal running while using the website.

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/available-slots` | Checks appointment time-slot availability. |
| GET | `/api/bookings` | Retrieves booking records. |
| POST | `/api/bookings` | Submits a booking request. |

## Booking Data

Booking records are stored in `backend/bookings.json` in the current implementation.

Do not delete or overwrite this file if you want to preserve existing booking records.

## Testing

The following basic tests have been performed during development:

| Test Case | Expected Result |
|---|---|
| Homepage loading | The website loads successfully. |
| Booking submission | A valid booking can be submitted. |
| Booking data retrieval | Saved bookings can be retrieved through the API. |
| Appointment availability | Unavailable time slots are indicated in the interface. |
| Required field validation | Missing required fields are rejected. |
| Email validation | Invalid email addresses are rejected. |
| Past date validation | Past appointment dates are rejected. |
| Booking conflict prevention | The backend rejects overlapping appointments when verified by a direct API test. |

## Developers

**WST Group 5**

Project: PawCare Bookings  
Course: Web Systems and Technologies

## License

This project was developed for academic purposes.
