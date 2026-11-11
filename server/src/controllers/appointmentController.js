import { dbService } from '../services/db.js';
import { logAudit } from '../utils/auditLogger.js';

// Helper to compute available slots for a given date
const calculateAvailableSlots = (dateStr, workingHours, slotDurationMinutes, existingAppointments) => {
  const dateObj = new Date(dateStr);
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = days[dateObj.getDay()];
  const schedule = workingHours[dayName];

  if (!schedule || schedule.closed || !schedule.open || !schedule.close) {
    return { isClosed: true, slots: [] };
  }

  const [openH, openM] = schedule.open.split(':').map(Number);
  const [closeH, closeM] = schedule.close.split(':').map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  let lunchStartMin = -1;
  let lunchEndMin = -1;
  if (schedule.lunchStart && schedule.lunchEnd) {
    const [lsH, lsM] = schedule.lunchStart.split(':').map(Number);
    const [leH, leM] = schedule.lunchEnd.split(':').map(Number);
    lunchStartMin = lsH * 60 + lsM;
    lunchEndMin = leH * 60 + leM;
  }

  const bookedSlots = new Set(
    existingAppointments
      .filter(a => a.date === dateStr && a.status !== 'cancelled')
      .map(a => a.timeSlot)
  );

  const slots = [];
  for (let m = openMinutes; m + slotDurationMinutes <= closeMinutes; m += slotDurationMinutes) {
    // Skip lunch break
    if (lunchStartMin > 0 && m >= lunchStartMin && m < lunchEndMin) {
      continue;
    }
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    const slotTime = `${hh}:${mm}`;
    slots.push({
      time: slotTime,
      isAvailable: !bookedSlots.has(slotTime)
    });
  }

  return { isClosed: false, slots };
};

export const appointmentController = {
  // Get available slots for a date
  async getSlots(req, res) {
    try {
      const { date, clinicId = 'clinic-default' } = req.query;
      if (!date) {
        return res.status(400).json({ error: 'Date parameter is required (YYYY-MM-DD)' });
      }

      const clinic = await dbService.getDocument('clinicSettings', clinicId);
      const workingHours = clinic?.workingHours || {
        monday: { open: '09:00', close: '20:00', lunchStart: '13:00', lunchEnd: '17:00' },
        tuesday: { open: '09:00', close: '20:00', lunchStart: '13:00', lunchEnd: '17:00' },
        wednesday: { open: '09:00', close: '20:00', lunchStart: '13:00', lunchEnd: '17:00' },
        thursday: { open: '09:00', close: '20:00', lunchStart: '13:00', lunchEnd: '17:00' },
        friday: { open: '09:00', close: '20:00', lunchStart: '13:00', lunchEnd: '17:00' },
        saturday: { open: '09:00', close: '14:00' },
        sunday: { closed: true }
      };
      const slotDuration = clinic?.slotDurationMinutes || 15;

      const appointments = await dbService.getCollection('appointments', clinicId);
      const result = calculateAvailableSlots(date, workingHours, slotDuration, appointments);

      return res.json({ date, ...result });
    } catch (err) {
      console.error('Error fetching slots:', err);
      return res.status(500).json({ error: 'Failed to calculate available appointment slots' });
    }
  },

  // List appointments with date filters and statuses
  async listAppointments(req, res) {
    try {
      const { date, startDate, endDate, status, patientId, isWalkIn } = req.query;
      const clinicId = req.user.clinicId;
      const appointments = await dbService.getCollection('appointments', clinicId);

      let filtered = appointments.filter(a => {
        if (date && a.date !== date) return false;
        if (startDate && a.date < startDate) return false;
        if (endDate && a.date > endDate) return false;
        if (status && a.status !== status) return false;
        if (patientId && a.patientId !== patientId) return false;
        if (isWalkIn !== undefined && String(a.isWalkIn) !== String(isWalkIn)) return false;
        return true;
      });

      // Sort by date then timeSlot
      filtered.sort((a, b) => {
        const d = a.date.localeCompare(b.date);
        if (d !== 0) return d;
        return (a.timeSlot || '').localeCompare(b.timeSlot || '');
      });

      return res.json(filtered);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to retrieve appointments' });
    }
  },

  // Book appointment (Staff: Doctor / Receptionist)
  async bookAppointment(req, res) {
    try {
      const {
        patientId,
        patientName,
        patientPhone,
        date,
        timeSlot,
        reason = '',
        isWalkIn = false,
        status = 'confirmed'
      } = req.body;

      if (!date || !timeSlot) {
        return res.status(400).json({ error: 'Date and time slot are required' });
      }

      const clinicId = req.user.clinicId;

      // Concurrency-safe slot collision check
      const result = await dbService.runTransaction(async (tx) => {
        const appointments = await dbService.getCollection('appointments', clinicId);
        const collision = appointments.find(
          a => a.date === date && a.timeSlot === timeSlot && a.status !== 'cancelled'
        );

        if (collision) {
          throw new Error(`Time slot ${timeSlot} on ${date} is already booked.`);
        }

        // Fetch patient details if patientId is provided
        let finalPatientName = patientName;
        let finalPatientPhone = patientPhone;
        if (patientId) {
          const patient = await dbService.getDocument('patients', patientId);
          if (patient) {
            finalPatientName = patient.fullName;
            finalPatientPhone = patient.mobileNumber;
          }
        }

        const appointment = await dbService.createDocument('appointments', {
          clinicId,
          patientId: patientId || null,
          patientName: finalPatientName || 'Walk-in Patient',
          patientPhone: finalPatientPhone || '',
          date,
          timeSlot,
          reason,
          isWalkIn: Boolean(isWalkIn),
          status: isWalkIn ? 'checked-in' : status,
          bookedBy: req.user.id,
          bookedByName: req.user.name,
          bookedByRole: req.user.role
        });

        return appointment;
      });

      await logAudit({
        clinicId,
        actorId: req.user.id,
        actorName: req.user.name,
        actorRole: req.user.role,
        action: 'APPOINTMENT_BOOK',
        resourceType: 'appointments',
        resourceId: result.id,
        details: { date, timeSlot, patientName: result.patientName, isWalkIn }
      });

      return res.status(201).json(result);
    } catch (err) {
      console.error('Booking collision / error:', err.message);
      return res.status(409).json({ error: err.message || 'Failed to book appointment' });
    }
  },

  // Public Online Booking for Patients (No auth required)
  async publicBooking(req, res) {
    try {
      const {
        fullName,
        mobileNumber,
        age,
        gender,
        date,
        timeSlot,
        reason = '',
        clinicId = 'clinic-default'
      } = req.body;

      if (!fullName || !mobileNumber || !date || !timeSlot) {
        return res.status(400).json({ error: 'Full name, mobile number, date and time slot are required' });
      }

      // Check slot availability safely
      const result = await dbService.runTransaction(async () => {
        const appointments = await dbService.getCollection('appointments', clinicId);
        const collision = appointments.find(
          a => a.date === date && a.timeSlot === timeSlot && a.status !== 'cancelled'
        );

        if (collision) {
          throw new Error(`Slot ${timeSlot} on ${date} is no longer available. Please select another time.`);
        }

        // Check if patient already exists in clinic database by phone
        const patients = await dbService.getCollection('patients', clinicId);
        const cleanPhone = mobileNumber.replace(/\D/g, '');
        let existingPatient = patients.find(p => p.mobileNumber && p.mobileNumber.replace(/\D/g, '') === cleanPhone);

        const appointment = await dbService.createDocument('appointments', {
          clinicId,
          patientId: existingPatient ? existingPatient.id : null,
          patientName: fullName.trim(),
          patientPhone: mobileNumber.trim(),
          age: age || '',
          gender: gender || '',
          date,
          timeSlot,
          reason,
          isWalkIn: false,
          status: 'requested', // Public bookings start in 'requested' status for clinic confirmation
          bookedBy: 'public-patient',
          bookedByName: fullName.trim(),
          bookedByRole: 'patient'
        });

        return { appointment, isExistingPatient: Boolean(existingPatient) };
      });

      return res.status(201).json({
        message: 'Your appointment request has been submitted successfully! The clinic will confirm shortly.',
        bookingId: result.appointment.id,
        date,
        timeSlot,
        status: result.appointment.status
      });
    } catch (err) {
      return res.status(409).json({ error: err.message || 'Failed to submit appointment request' });
    }
  },

  // Update appointment status
  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const validStatuses = ['requested', 'confirmed', 'checked-in', 'in-consultation', 'completed', 'cancelled', 'no-show'];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      }

      const existing = await dbService.getDocument('appointments', id);
      if (!existing || existing.clinicId !== req.user.clinicId) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      const updated = await dbService.updateDocument('appointments', id, {
        status,
        updatedBy: req.user.id,
        statusUpdatedAt: new Date().toISOString()
      });

      await logAudit({
        clinicId: req.user.clinicId,
        actorId: req.user.id,
        actorName: req.user.name,
        actorRole: req.user.role,
        action: 'APPOINTMENT_STATUS_CHANGE',
        resourceType: 'appointments',
        resourceId: id,
        details: { previousStatus: existing.status, newStatus: status }
      });

      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update appointment status' });
    }
  },

  // Reschedule appointment
  async reschedule(req, res) {
    try {
      const { id } = req.params;
      const { date, timeSlot } = req.body;

      if (!date || !timeSlot) {
        return res.status(400).json({ error: 'New date and timeSlot are required' });
      }

      const clinicId = req.user.clinicId;
      const existing = await dbService.getDocument('appointments', id);
      if (!existing || existing.clinicId !== clinicId) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      // Concurrency check
      await dbService.runTransaction(async () => {
        const appointments = await dbService.getCollection('appointments', clinicId);
        const collision = appointments.find(
          a => a.id !== id && a.date === date && a.timeSlot === timeSlot && a.status !== 'cancelled'
        );
        if (collision) {
          throw new Error(`Time slot ${timeSlot} on ${date} is already taken.`);
        }
      });

      const updated = await dbService.updateDocument('appointments', id, {
        date,
        timeSlot,
        status: 'confirmed',
        rescheduledFrom: { date: existing.date, timeSlot: existing.timeSlot },
        rescheduledBy: req.user.id
      });

      await logAudit({
        clinicId,
        actorId: req.user.id,
        actorName: req.user.name,
        actorRole: req.user.role,
        action: 'APPOINTMENT_RESCHEDULE',
        resourceType: 'appointments',
        resourceId: id,
        details: { oldDate: existing.date, oldSlot: existing.timeSlot, newDate: date, newSlot: timeSlot }
      });

      return res.json(updated);
    } catch (err) {
      return res.status(409).json({ error: err.message || 'Failed to reschedule appointment' });
    }
  },

  // Cancel appointment
  async cancelAppointment(req, res) {
    try {
      const { id } = req.params;
      const { reason = '' } = req.body;
      const existing = await dbService.getDocument('appointments', id);
      if (!existing || existing.clinicId !== req.user.clinicId) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      const updated = await dbService.updateDocument('appointments', id, {
        status: 'cancelled',
        cancellationReason: reason,
        cancelledBy: req.user.id,
        cancelledAt: new Date().toISOString()
      });

      await logAudit({
        clinicId: req.user.clinicId,
        actorId: req.user.id,
        actorName: req.user.name,
        actorRole: req.user.role,
        action: 'APPOINTMENT_CANCEL',
        resourceType: 'appointments',
        resourceId: id,
        details: { reason }
      });

      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to cancel appointment' });
    }
  }
};

