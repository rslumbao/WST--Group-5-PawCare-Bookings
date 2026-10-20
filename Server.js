
const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Allow the server to receive JSON and form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the PawCare frontend files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Test the server homepage
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        message: 'PawCare Bookings server is running!'
    });
});

app.post("/api/bookings", (req, res) => {
    const {
        ownerName,
        ownerEmail,
        ownerPhone,
        petName,
        petBreed,
        petSize,
        service,
        appointmentDate,
        appointmentTime,
        addons,
        notes
    } = req.body;

    const allowedServices = ["bath", "full-groom", "nail-trim"];
    const allowedSizes = ["small", "medium", "large"];

    if (
        !ownerName?.trim() ||
        !ownerEmail?.trim() ||
        !ownerPhone?.trim() ||
        !petName?.trim() ||
        !allowedSizes.includes(petSize) ||
        !allowedServices.includes(service) ||
        !appointmentDate ||
        !appointmentTime
    ) {
        return res.status(400).json({
            success: false,
            message: "Please complete all required booking details."
        });
    }

    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate) ||
        appointmentDate < new Date().toLocaleDateString("en-CA", {
            timeZone: "Asia/Manila"
        }) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(appointmentTime)
    ) {
        return res.status(400).json({
            success: false,
            message: "Please provide a valid appointment date and time."
        });
    }

    const booking = {
        id: Date.now(),
        ownerName: ownerName.trim(),
        ownerEmail: ownerEmail.trim(),
        ownerPhone: ownerPhone.trim(),
        petName: petName.trim(),
        petBreed: petBreed || "",
        petSize,
        service,
        appointmentDate,
        appointmentTime,
        addons: Array.isArray(addons) ? addons : [],
        notes: notes || "",
        status: "received"
    };

    console.log("Booking request received:", booking);

    return res.status(201).json({
        success: true,
        message: "Your booking request was received successfully.",
        booking: {
            id: booking.id,
            appointmentDate: booking.appointmentDate,
            appointmentTime: booking.appointmentTime,
            service: booking.service,
            petName: booking.petName,
            status: booking.status
        }
    });
});

// Diagnostic handler: shows requests that have no matching route
app.use((req, res) => {
    console.log("404 NOT FOUND:", req.method, req.originalUrl);

    res.status(404).json({
        success: false,
        message: "Route not found",
        method: req.method,
        url: req.originalUrl
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
