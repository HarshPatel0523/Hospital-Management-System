const express = require('express');
const Doctor = require('../models/Doctor');
const jwt = require('jsonwebtoken');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const Prescription = require('../models/Prescription');

const router = express.Router();

const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).send({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).send({ error: 'Invalid token' });
  }
};

router.get('/profile', auth, async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.user.id).select('-password');
    if (!doctor) {
      return res.status(404).send({ error: 'Doctor not found' });
    }
    res.json(doctor);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: 'Server error' });
  }
});

router.put('/profile', auth, async (req, res) => {
  try {
    const { firstName, lastName, email, specialty, licenseNumber, phoneNumber } = req.body;
    const doctor = await Doctor.findById(req.user.id);
    if (!doctor) {
      return res.status(404).send({ error: 'Doctor not found' });
    }
    doctor.firstName = firstName;
    doctor.lastName = lastName;
    doctor.email = email;
    doctor.specialty = specialty;
    doctor.licenseNumber = licenseNumber;
    doctor.phoneNumber = phoneNumber;
    await doctor.save();
    const doctorWithoutPassword = doctor.toObject();
    delete doctorWithoutPassword.password;
    res.json(doctorWithoutPassword);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: 'Server error' });
  }
});

router.get('/all', async (req, res) => {
  try {
    const doctors = await Doctor.find().select('firstName lastName specialty');
    res.json(doctors);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: 'Server error' });
  }
});

router.get('/patients-with-appointments', auth, async (req, res) => {
  console.log('Accessing patients-with-appointments route');
  try {
    const doctorId = req.user.id;
    console.log('Doctor ID:', doctorId);
    const appointments = await Appointment.find({ doctorId }).distinct('patientId');
    console.log('Appointments:', appointments);
    const patients = await User.find({ _id: { $in: appointments }, role: 'patient' });
    console.log('Patients found:', patients);
    res.json(patients);
  } catch (error) {
    console.error('Error fetching patients with appointments:', error);
    res.status(500).send({ error: 'Server error' });
  }
});

router.get('/available-slots', auth, async (req, res) => {
  try {
    const { patientId, date } = req.query;
    const doctorId = req.user.id; // Assuming the doctor is making the request

    // Fetch booked appointments for the given doctor and date
    const bookedAppointments = await Appointment.find({ doctorId, date });
    const bookedTimes = bookedAppointments.map(app => app.time);

    // Define all possible time slots
    const allTimeSlots = ['9:00 AM', '10:00 AM', '11:00 AM', '2:00 PM', '3:00 PM', '4:00 PM'];

    // Filter out the booked time slots
    const availableSlots = allTimeSlots.filter(slot => !bookedTimes.includes(slot));

    res.json(availableSlots);
  } catch (error) {
    console.error('Error fetching available slots:', error);
    res.status(500).send({ error: 'Server error' });
  }
});

router.post('/schedule-appointment', auth, async (req, res) => {
  try {
    const { patientId, date, time, reason } = req.body;
    const doctorId = req.user.id; // Assuming the doctor is making the request

    const appointment = new Appointment({
      patientId,
      doctorId,
      date,
      time,
      reason
    });

    await appointment.save();
    res.status(201).json({ message: 'Appointment scheduled successfully', appointment });
  } catch (error) {
    console.error('Error scheduling appointment:', error);
    res.status(500).send({ error: 'Server error' });
  }
});

router.post('/prescribe-medication', auth, async (req, res) => {
  try {
    const { patientId, medication, dosage, frequency } = req.body;
    const doctorId = req.user.id; // Assuming the doctor is making the request

    const prescription = new Prescription({
      patientId,
      doctorId,
      medication,
      dosage,
      frequency
    });

    await prescription.save();
    res.status(201).json({ message: 'Medication prescribed successfully', prescription });
  } catch (error) {
    console.error('Error prescribing medication:', error);
    res.status(500).send({ error: 'Server error' });
  }
});

// Get all prescriptions
router.get('/prescriptions', auth, async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ doctorId: req.user.id });
    res.json(prescriptions);
  } catch (error) {
    console.error('Error fetching prescriptions:', error);
    res.status(500).send({ error: 'Server error' });
  }
});

// Update a prescription
router.put('/prescriptions/:id', auth, async (req, res) => {
  try {
    const { medication, dosage, frequency } = req.body;
    const prescription = await Prescription.findOneAndUpdate(
      { _id: req.params.id, doctorId: req.user.id },
      { medication, dosage, frequency },
      { new: true }
    );
    if (!prescription) {
      return res.status(404).send({ error: 'Prescription not found' });
    }
    res.json(prescription);
  } catch (error) {
    console.error('Error updating prescription:', error);
    res.status(500).send({ error: 'Server error' });
  }
});

// Delete a prescription
router.delete('/prescriptions/:id', auth, async (req, res) => {
  try {
    const prescription = await Prescription.findOneAndDelete({ _id: req.params.id, doctorId: req.user.id });
    if (!prescription) {
      return res.status(404).send({ error: 'Prescription not found' });
    }
    res.json({ message: 'Prescription deleted successfully' });
  } catch (error) {
    console.error('Error deleting prescription:', error);
    res.status(500).send({ error: 'Server error' });
  }
});

module.exports = router;
