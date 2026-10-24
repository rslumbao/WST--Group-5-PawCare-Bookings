
"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const { randomUUID } = require("crypto");

const app = express();
const PORT = 3000;

const FRONTEND_DIR = path.join(__dirname, "..", "frontend");
const BOOKINGS_FILE = path.join(__dirname, "bookings.json");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(FRONTEND_DIR));

const ALLOWED_SERVICES = ["bath", "full-groom", "nail-trim"];
const ALLOWED_SIZES = ["small", "medium", "large"];

const SLOT_TIMES = [
    "09:00", "09:30", "10:00", "10:30",
    "11:00", "11:30",
    "13:00", "13:30", "14:00", "14:30",
    "15:00", "15:30", "16:00", "16:30"
];

const SERVICE_DURATIONS = {
    "bath": 30,
    "full-groom": 90,
    "nail-trim": 20
};

const BUFFER_MINUTES = 15;
const OPENING_MINUTES = 9 * 60;
const CLOSING_MINUTES = 17 * 60;

// Manila date in YYYY-MM-DD format
function getManilaDate() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());

    const values = {};
    for (const part of parts) {
        values[part.type] = part.value;
    }

    return `${values.year}-${values.month}-${values.day}`;
}

function isValidDate(date) {
    if (typeof date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return false;
    }

    const parsed = new Date(`${date}T00:00:00.000Z`);

    return !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === date;
}

function timeToMinutes(time) {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
}

async function readBookings() {
    const content = await fs.readFile(BOOKINGS_FILE, "utf8");
    const bookings = JSON.parse(content);

    if (!Array.isArray(bookings)) {
        throw new Error("bookings.json must contain a JSON array.");
    }

    return bookings;
}

async function writeBookings(bookings) {
    await fs.writeFile(
        BOOKINGS_FILE,
        JSON.stringify(bookings, null, 2) + "\n",
        "utf8"
    );
}

// Serialize booking submissions to reduce the risk of simultaneous
// requests accepting the same time slot.
let bookingQueue = Promise.resolve();

function withBookingLock(operation) {
    const current = bookingQueue.then(operation);
    bookingQueue = current.catch(() => {});
    return current;
}

function getAvailableTimes(date, service, bookings) {
    const duration = SERVICE_DURATIONS[service];

    if (!duration) {
        return [];
    }

    return SLOT_TIMES.filter(time => {
        const start = timeToMinutes(time);
        const endWithBuffer = start + duration + BUFFER_MINUTES;

        if (start < OPENING_MINUTES ||
            endWithBuffer > CLOSING_MINUTES) {
            return false;
        }

        // Don't offer a slot that has already started today.
        if (date === getManilaDate()) {
            const nowParts = new Intl.DateTimeFormat("en-GB", {
                timeZone: "Asia/Manila",
                hour: "2-digit",
                minute: "2-digit",
                hourCycle: "h23"
            }).format(new Date()).split(":");

            const currentMinutes =
                Number(nowParts[0]) * 60 + Number(nowParts[1]);

            if (start <= currentMinutes) {
                return false;
            }
        }

        return !bookings.some(booking => {
            if (booking.appointmentDate !== date) {
                return false;
            }

            const existingDuration =
                SERVICE_DURATIONS[booking.service];

            // Ignore malformed/unknown legacy service records.
            if (!existingDuration ||
                !/^\d{2}:\d{2}$/.test(booking.appointmentTime || "")) {
                return false;
            }

            const existingStart =
                timeToMinutes(booking.appointmentTime);

            const existingEnd =
                existingStart + existingDuration + BUFFER_MINUTES;

            // Intervals overlap if each starts before the other ends.
            return start < existingEnd && existingStart < endWithBuffer;
        });
    });
}

app.get("/api/status", (req, res) => {
    res.json({
        success: true,
        message: "PawCare Bookings server is running!"
    });
});

// Retrieve real availability from saved bookings.
app.get("/api/available-slots", async (req, res) => {
    try {
        const { date, service } = req.query;

        if (!isValidDate(date) || date < getManilaDate()) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid date that is today or later."
            });
        }

        if (!ALLOWED_SERVICES.includes(service)) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid service."
            });
        }

        const bookings = await readBookings();
        const availableTimes = getAvailableTimes(date, service, bookings);

        res.json({
            success: true,
            date,
            service,
            availableTimes
        });
    } catch (error) {
        console.error("Error checking availability:", error);

        res.status(500).json({
            success: false,
            message: "Unable to check available time slots."
        });
    }
});

app.get("/api/bookings", async (req, res) => {
    try {
        const bookings = await readBookings();

        res.json({
            success: true,
            count: bookings.length,
            bookings
        });
    } catch (error) {
        console.error("Error reading bookings:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to retrieve saved bookings."
        });
    }
});

app.post("/api/bookings", async (req, res) => {
    try {
        const result = await withBookingLock(async () => {
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

            if (
                typeof ownerName !== "string" || !ownerName.trim() ||
                typeof ownerEmail !== "string" || !ownerEmail.trim() ||
                typeof ownerPhone !== "string" || !ownerPhone.trim() ||
                typeof petName !== "string" || !petName.trim()
            ) {
                return {
                    status: 400,
                    body: {
                        success: false,
                        message: "Please complete all required owner and pet details."
                    }
                };
            }

            const email = ownerEmail.trim();

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return {
                    status: 400,
                    body: {
                        success: false,
                        message: "Please enter a valid email address."
                    }
                };
            }

            if (!ALLOWED_SERVICES.includes(service) ||
                !ALLOWED_SIZES.includes(petSize)) {
                return {
                    status: 400,
                    body: {
                        success: false,
                        message: "Please select a valid service and pet size."
                    }
                };
            }

            if (!isValidDate(appointmentDate) ||
                appointmentDate < getManilaDate()) {
                return {
                    status: 400,
                    body: {
                        success: false,
                        message: "Please select a valid date that is not in the past."
                    }
                };
            }

            if (typeof appointmentTime !== "string" ||
                !/^([01]\d|2[0-3]):[0-5]\d$/.test(appointmentTime) ||
                !SLOT_TIMES.includes(appointmentTime)) {
                return {
                    status: 400,
                    body: {
                        success: false,
                        message: "Please select a valid available time slot."
                    }
                };
            }

            if (typeof petBreed !== "undefined" &&
                typeof petBreed !== "string") {
                return {
                    status: 400,
                    body: {
                        success: false,
                        message: "Invalid pet breed."
                    }
                };
            }

            if (typeof notes !== "undefined" &&
                typeof notes !== "string") {
                return {
                    status: 400,
                    body: {
                        success: false,
                        message: "Invalid booking notes."
                    }
                };
            }

            if (typeof addons !== "undefined" &&
                (!Array.isArray(addons) ||
                 !addons.every(item => typeof item === "string"))) {
                return {
                    status: 400,
                    body: {
                        success: false,
                        message: "Invalid add-on selection."
                    }
                };
            }

            const bookings = await readBookings();
            const availableTimes = getAvailableTimes(
                appointmentDate,
                service,
                bookings
            );

            if (!availableTimes.includes(appointmentTime)) {
                return {
                    status: 409,
                    body: {
                        success: false,
                        message: "That time slot is no longer available. Please select another time."
                    }
                };
            }

            const booking = {
                id: randomUUID(),
                ownerName: ownerName.trim(),
                ownerEmail: email,
                ownerPhone: ownerPhone.trim(),
                petName: petName.trim(),
                petBreed: (petBreed || "").trim(),
                petSize,
                service,
                appointmentDate,
                appointmentTime,
                addons: addons || [],
                notes: (notes || "").trim(),
                status: "received",
                createdAt: new Date().toISOString()
            };

            bookings.push(booking);
            await writeBookings(bookings);

            console.log("Booking saved successfully:", booking.id);

            return {
                status: 201,
                body: {
                    success: true,
                    message: "Your booking request was saved successfully.",
                    booking
                }
            };
        });

        return res.status(result.status).json(result.body);
    } catch (error) {
        console.error("Error saving booking:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to save your booking. Please try again."
        });
    }
});

app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: "API route not found.",
        method: req.method,
        url: req.originalUrl
    });
});

app.use((err, req, res, next) => {
    if (err instanceof SyntaxError &&
        err.status === 400 &&
        "body" in err) {
        return res.status(400).json({
            success: false,
            message: "Invalid JSON request body."
        });
    }

    console.error("Unexpected server error:", err);

    res.status(500).json({
        success: false,
        message: "An unexpected server error occurred."
    });
});

async function startServer() {
    try {
        try {
            await fs.access(BOOKINGS_FILE);
        } catch (error) {
            if (error.code !== "ENOENT") {
                throw error;
            }

            await writeBookings([]);
            console.log("Created bookings.json");
        }

        await readBookings();

        const server = app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
            console.log(`Frontend: http://localhost:${PORT}/`);
            console.log(`Availability: http://localhost:${PORT}/api/available-slots`);
            console.log(`Bookings: http://localhost:${PORT}/api/bookings`);
            console.log(`Storage file: ${BOOKINGS_FILE}`);
        });

        server.on("error", error => {
            if (error.code === "EADDRINUSE") {
                console.error(
                    `Port ${PORT} is already in use. Stop the existing server first.`
                );
            } else {
                console.error("Server startup error:", error);
            }

            process.exitCode = 1;
        });
    } catch (error) {
        console.error("Could not start server:", error.message);
        process.exitCode = 1;
    }
}

startServer();
