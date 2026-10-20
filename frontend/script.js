
"use strict";

// =========================================================
// PawCare Bookings - Frontend Interactivity
//
// Features:
// 1. Service selection
// 2. Appointment date and time-slot picker
// 3. Booking form validation
// 4. POST booking requests to the Node.js backend
// 5. Booking confirmation summary
// 6. Contact form character counter and demo submission
//
// IMPORTANT:
// Time slots are simulated in the browser.
// They are not yet checked against Google Calendar.
// =========================================================

document.addEventListener("DOMContentLoaded", function () {
    initServiceSelection();
    initTimeSlotPicker();
    initBookingForm();
    initContactCharCounter();
    initContactForm();
});

// ---------------------------------------------------------
// Shared helper functions
// ---------------------------------------------------------

function setElementHidden(element, hidden) {
    if (element) {
        element.hidden = hidden;
    }
}

function getTodayString() {
    var today = new Date();

    var month = String(today.getMonth() + 1).padStart(2, "0");
    var day = String(today.getDate()).padStart(2, "0");

    return today.getFullYear() + "-" + month + "-" + day;
}

function formatTime12h(time24) {
    if (!time24) {
        return "";
    }

    var parts = time24.split(":");
    var hour = parseInt(parts[0], 10);
    var minute = parts[1];

    var suffix = hour >= 12 ? "PM" : "AM";
    var hour12 = hour % 12 || 12;

    return hour12 + ":" + minute + " " + suffix;
}

function formatDateForDisplay(dateString) {
    if (!dateString) {
        return "";
    }

    var parts = dateString.split("-");

    if (parts.length !== 3) {
        return dateString;
    }

    var date = new Date(
        Number(parts[0]),
        Number(parts[1]) - 1,
        Number(parts[2])
    );

    if (Number.isNaN(date.getTime())) {
        return dateString;
    }

    return date.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}

// ---------------------------------------------------------
// 1. Service Selection
// ---------------------------------------------------------

function initServiceSelection() {
    var serviceSelect = document.getElementById("service-type");
    var statusEl = document.getElementById("service-select-status");

    var selectLinks = document.querySelectorAll(
        ".select-service-link"
    );

    if (!serviceSelect) {
        console.error("PawCare: #service-type was not found.");
        return;
    }

    function announceSelection() {
        if (!statusEl) {
            return;
        }

        var selectedIndex = serviceSelect.selectedIndex;

        if (selectedIndex < 0) {
            statusEl.textContent = "";
            return;
        }

        var chosenOption = serviceSelect.options[selectedIndex];

        statusEl.textContent = chosenOption.value
            ? "Selected service: " + chosenOption.text
            : "";
    }

    selectLinks.forEach(function (link) {
        link.addEventListener("click", function () {
            var serviceValue = link.dataset.service;

            serviceSelect.value = serviceValue;

            serviceSelect.dispatchEvent(
                new Event("change")
            );

            announceSelection();
        });
    });

    serviceSelect.addEventListener(
        "change",
        announceSelection
    );
}

// ---------------------------------------------------------
// 2. Appointment Time-Slot Picker
// ---------------------------------------------------------

function initTimeSlotPicker() {
    var dateInput = document.getElementById("appointment-date");
    var serviceSelect = document.getElementById("service-type");
    var slotList = document.getElementById("time-slot-list");

    var hiddenTimeInput = document.getElementById(
        "appointment-time"
    );

    var selectedTimeDisplay = document.getElementById(
        "selected-time-display"
    );

    var dateError = document.getElementById("date-error");
    var timeError = document.getElementById("time-error");

    if (!dateInput || !serviceSelect || !slotList ||
        !hiddenTimeInput || !selectedTimeDisplay) {
        console.error(
            "PawCare: A required time-slot HTML element is missing. " +
            "Check the appointment-date, service-type, time-slot-list, " +
            "appointment-time, and selected-time-display IDs."
        );
        return;
    }

    // Available start times, with a lunch break from 12 PM to 1 PM.
    var SLOT_TIMES = [
        "09:00", "09:30", "10:00", "10:30",
        "11:00", "11:30",
        "13:00", "13:30", "14:00", "14:30",
        "15:00", "15:30", "16:00", "16:30"
    ];

    var SERVICE_DURATIONS = {
        "bath": 30,
        "full-groom": 90,
        "nail-trim": 20
    };

    var BUFFER_MINUTES = 15;
    var CLOSING_TIME = 17 * 60;

    function isAllowedDate(dateString) {
        return Boolean(
            dateString &&
            dateInput.min &&
            dateString >= dateInput.min &&
            isValidDateString(dateString)
        );
    }

    function isValidDateString(dateString) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            return false;
        }

        var parts = dateString.split("-").map(Number);

        var date = new Date(
            Date.UTC(parts[0], parts[1] - 1, parts[2])
        );

        return date.getUTCFullYear() === parts[0] &&
            date.getUTCMonth() === parts[1] - 1 &&
            date.getUTCDate() === parts[2];
    }

    function clearSelection() {
        hiddenTimeInput.value = "";
        selectedTimeDisplay.textContent = "No time selected.";
    }

    function showPlaceholder(message) {
        slotList.replaceChildren();

        var item = document.createElement("li");
        item.className = "slot-placeholder";
        item.textContent = message;

        slotList.appendChild(item);
    }

    function getAvailableSlotTimes(serviceValue) {
        var duration = SERVICE_DURATIONS[serviceValue];

        if (!duration) {
            return [];
        }

        return SLOT_TIMES.filter(function (time) {
            var parts = time.split(":");

            var startMinutes =
                Number(parts[0]) * 60 + Number(parts[1]);

            return startMinutes + duration + BUFFER_MINUTES
                <= CLOSING_TIME;
        });
    }

    // DEMO ONLY: These simulated bookings are not real appointments.
    function getBookedSlotsForDate(dateString) {
        var seed = 0;

        for (var i = 0; i < dateString.length; i++) {
            seed += dateString.charCodeAt(i);
        }

        var bookedCount = 2 + (seed % 3);
        var booked = [];
        var attempt = 0;

        while (
            booked.length < bookedCount &&
            attempt < SLOT_TIMES.length
        ) {
            var index =
                (seed * (attempt + 3)) % SLOT_TIMES.length;

            var time = SLOT_TIMES[index];

            if (booked.indexOf(time) === -1) {
                booked.push(time);
            }

            attempt++;
        }

        return booked;
    }

    function renderSlots(dateString) {
        slotList.replaceChildren();
        clearSelection();
        setElementHidden(timeError, true);

        if (!serviceSelect.value) {
            showPlaceholder(
                "Please select a service to see available time slots."
            );
            return;
        }

        var availableTimes = getAvailableSlotTimes(
            serviceSelect.value
        );

        var bookedSlots = getBookedSlotsForDate(dateString);
        var displayedCount = 0;

        availableTimes.forEach(function (time) {
            var item = document.createElement("li");
            var button = document.createElement("button");

            button.type = "button";
            button.className = "slot-btn";
            button.textContent = formatTime12h(time);
            button.dataset.time = time;
            button.setAttribute("aria-pressed", "false");

            var isBooked = bookedSlots.indexOf(time) !== -1;

            if (isBooked) {
                button.classList.add("slot-booked");
                button.disabled = true;

                button.setAttribute(
                    "aria-label",
                    formatTime12h(time) + ", unavailable in demo"
                );
            } else {
                displayedCount++;

                button.addEventListener("click", function () {
                    var allButtons =
                        slotList.querySelectorAll(".slot-btn");

                    allButtons.forEach(function (otherButton) {
                        otherButton.classList.remove("slot-selected");

                        otherButton.setAttribute(
                            "aria-pressed",
                            "false"
                        );
                    });

                    button.classList.add("slot-selected");

                    button.setAttribute(
                        "aria-pressed",
                        "true"
                    );

                    hiddenTimeInput.value = time;

                    selectedTimeDisplay.textContent =
                        "Selected time: " + formatTime12h(time);

                    setElementHidden(timeError, true);
                });
            }

            item.appendChild(button);
            slotList.appendChild(item);
        });

        if (displayedCount === 0) {
            showPlaceholder(
                "No time slots are available for this service and date. " +
                "Please choose another date."
            );
        }
    }

    dateInput.min = getTodayString();

    dateInput.addEventListener("change", function () {
        var value = dateInput.value;

        clearSelection();

        if (!value) {
            setElementHidden(dateError, true);

            showPlaceholder(
                "Select a date above to see open time slots."
            );

            return;
        }

        if (!isAllowedDate(value)) {
            setElementHidden(dateError, false);

            dateInput.setAttribute("aria-invalid", "true");

            showPlaceholder(
                "Please choose a valid date that is today or later."
            );

            return;
        }

        setElementHidden(dateError, true);

        dateInput.removeAttribute("aria-invalid");

        renderSlots(value);
    });

    serviceSelect.addEventListener("change", function () {
        if (!dateInput.value) {
            showPlaceholder(
                "Select a date above to see open time slots."
            );

            clearSelection();
            return;
        }

        if (!isAllowedDate(dateInput.value)) {
            showPlaceholder(
                "Please choose a valid date that is today or later."
            );

            clearSelection();
            return;
        }

        renderSlots(dateInput.value);
    });
}

// ---------------------------------------------------------
// 3. Booking Form Validation and Backend Submission
// ---------------------------------------------------------

function initBookingForm() {
    var form = document.getElementById("booking-form");

    if (!form) {
        form = document.querySelector("#book form");
    }

    if (!form) {
        console.error("PawCare: Booking form was not found.");
        return;
    }

    var petSizeRadios = form.querySelectorAll(
        'input[name="pet-size"]'
    );

    var petSizeError = document.getElementById("pet-size-error");
    var dateInput = document.getElementById("appointment-date");
    var dateError = document.getElementById("date-error");
    var timeInput = document.getElementById("appointment-time");
    var timeError = document.getElementById("time-error");

    var confirmationBox = document.getElementById(
        "booking-confirmation"
    );

    var detailsList = document.getElementById(
        "confirmation-details"
    );

    var slotList = document.getElementById("time-slot-list");

    var selectedTimeDisplay = document.getElementById(
        "selected-time-display"
    );

    var bookAnotherBtn = document.getElementById(
        "book-another-btn"
    );

    var statusEl = document.getElementById(
        "service-select-status"
    );

    var submitButton = form.querySelector(
        'button[type="submit"], input[type="submit"]'
    );

    function addRow(label, value) {
        var dt = document.createElement("dt");
        dt.textContent = label;

        var dd = document.createElement("dd");
        dd.textContent = value || "Not provided";

        detailsList.appendChild(dt);
        detailsList.appendChild(dd);
    }

    function resetBookingState() {
        if (slotList) {
            slotList.replaceChildren();

            var placeholder = document.createElement("li");
            placeholder.className = "slot-placeholder";
            placeholder.textContent =
                "Select a date above to see open time slots.";

            slotList.appendChild(placeholder);
        }

        if (selectedTimeDisplay) {
            selectedTimeDisplay.textContent = "No time selected.";
        }

        if (statusEl) {
            statusEl.textContent = "";
        }

        setElementHidden(petSizeError, true);
        setElementHidden(timeError, true);
        setElementHidden(dateError, true);

        if (dateInput) {
            dateInput.removeAttribute("aria-invalid");
        }

        if (dateInput) {
            dateInput.value = "";
        }

        if (timeInput) {
            timeInput.value = "";
        }

        if (detailsList) {
            detailsList.replaceChildren();
        }
    }

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        var isValid = true;

        if (!form.checkValidity()) {
            form.reportValidity();
            isValid = false;
        }

        // Validate the date.
        var dateValue = dateInput ? dateInput.value : "";

        var chosenDate = dateValue
            ? new Date(dateValue + "T00:00:00")
            : null;

        var today = new Date();
        today.setHours(0, 0, 0, 0);

        if (
            !dateValue ||
            !dateInput ||
            dateValue < dateInput.min ||
            !chosenDate ||
            Number.isNaN(chosenDate.getTime()) ||
            chosenDate < today
        ) {
            setElementHidden(dateError, false);

            if (dateInput) {
                dateInput.setAttribute("aria-invalid", "true");
            }

            isValid = false;
        } else {
            setElementHidden(dateError, true);
            dateInput.removeAttribute("aria-invalid");
        }

        // Validate pet size.
        var checkedSize = form.querySelector(
            'input[name="pet-size"]:checked'
        );

        if (!checkedSize) {
            setElementHidden(petSizeError, false);
            isValid = false;
        } else {
            setElementHidden(petSizeError, true);
        }

        // Validate the selected appointment time.
        if (!timeInput || !timeInput.value) {
            setElementHidden(timeError, false);
            isValid = false;
        } else {
            setElementHidden(timeError, true);
        }

        if (!isValid) {
            return;
        }

        var serviceSelect = document.getElementById("service-type");

        if (!serviceSelect || !serviceSelect.value) {
            if (statusEl) {
                statusEl.textContent = "Please select a grooming service.";
            }
            return;
        }

        // Collect the checked add-on services.
        var addons = Array.from(
            form.querySelectorAll('input[name="addons"]:checked')
        ).map(function (checkbox) {
            return checkbox.value;
        });

        // Match the property names expected by backend/Server.js.
        var payload = {
            ownerName: document.getElementById("owner-name").value.trim(),
            ownerEmail: document.getElementById("owner-email").value.trim(),
            ownerPhone: document.getElementById("owner-phone").value.trim(),
            petName: document.getElementById("pet-name").value.trim(),
            petBreed: document.getElementById("pet-breed").value.trim(),
            petSize: checkedSize.value,
            service: serviceSelect.value,
            appointmentDate: dateInput.value,
            appointmentTime: timeInput.value,
            addons: addons,
            notes: document.getElementById("pet-notes").value.trim()
        };

        if (statusEl) {
            statusEl.textContent = "Submitting your booking request...";
        }

        if (submitButton) {
            submitButton.disabled = true;
        }

        try {
            var response = await fetch("/api/bookings", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            var result = await response.json().catch(function () {
                return {};
            });

            if (!response.ok || !result.success) {
                throw new Error(
                    "HTTP " + response.status +
                    " | Server response: " +
                    JSON.stringify(result)
            );
            }

            // Display the server response, not a fake confirmation.
            if (detailsList) {
                detailsList.replaceChildren();

                if (result.booking && result.booking.id !== undefined) {
                    addRow("Booking Reference", String(result.booking.id));
                }

                addRow("Owner", payload.ownerName);
                addRow(
                    "Pet",
                    payload.petName + " (" + payload.petSize + ")"
                );

                addRow(
                    "Service",
                    serviceSelect.options[serviceSelect.selectedIndex].text
                );

                addRow(
                    "Date",
                    formatDateForDisplay(payload.appointmentDate)
                );

                addRow(
                    "Time",
                    formatTime12h(payload.appointmentTime)
                );

                addRow(
                    "Add-ons",
                    payload.addons.length
                        ? payload.addons.join(", ")
                        : "None"
                );

                addRow(
                    "Request Status",
                    result.booking && result.booking.status
                        ? result.booking.status
                        : "Received by server"
                );
            }

            var confirmationParagraph = confirmationBox
                ? confirmationBox.querySelector("p")
                : null;

            if (confirmationParagraph) {
                confirmationParagraph.textContent =
                    "Your booking request was received by the PawCare server. " +
                    "This is not yet a confirmed Google Calendar appointment, " +
                    "and no confirmation email has been sent.";
            }

            form.hidden = true;

            if (confirmationBox) {
                confirmationBox.hidden = false;

                confirmationBox.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }

            if (statusEl) {
                statusEl.textContent = "";
            }
        } catch (error) {
            console.error("PawCare booking submission failed:", error);

            if (statusEl) {
                statusEl.textContent =
                    error.message ||
                    "Unable to submit your request. Please try again.";
            }
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
            }
        }
    });

    if (bookAnotherBtn) {
        bookAnotherBtn.addEventListener("click", function () {
            form.reset();

            resetBookingState();

            form.hidden = false;

            if (confirmationBox) {
                confirmationBox.hidden = true;
            }

            form.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        });
    }

    form.addEventListener("reset", function () {
        // Wait until the browser has reset the form values.
        window.setTimeout(resetBookingState, 0);
    });
}

// ---------------------------------------------------------
// 4. Contact Form Character Counter
// ---------------------------------------------------------

function initContactCharCounter() {
    var textarea = document.getElementById("contact-message");
    var counter = document.getElementById("message-char-count");

    if (!textarea || !counter) {
        return;
    }

    var maxLength = textarea.maxLength > 0
        ? textarea.maxLength
        : 500;

    function updateCount() {
        counter.textContent =
            textarea.value.length + " / " + maxLength + " characters";
    }

    textarea.addEventListener("input", updateCount);

    if (textarea.form) {
        textarea.form.addEventListener("reset", function () {
            window.setTimeout(updateCount, 0);
        });
    }

    updateCount();
}

// ---------------------------------------------------------
// 5. Contact Form Demonstration
// ---------------------------------------------------------

function initContactForm() {
    var form = document.getElementById("contact-form");

    if (!form) {
        form = document.querySelector("#contact form");
    }

    var status = document.getElementById("contact-status");

    if (!form) {
        return;
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        form.reset();

        if (status) {
            status.textContent =
                "Thanks for your message. This demo does not send messages " +
                "to a server yet.";
        }
    });

    form.addEventListener("reset", function () {
        if (status) {
            status.textContent = "";
        }
    });
}
