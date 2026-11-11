import { dbService } from '../services/db.js';
import { logAudit } from '../utils/auditLogger.js';

const generateReceiptNumber = async (clinicId) => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const bills = await dbService.getCollection('bills', clinicId);
  const count = bills.length + 1;
  const padded = String(count).padStart(4, '0');
  return `REC-${dateStr}-${padded}`;
};

export const billingController = {
  // List bills with filtering
  async listBills(req, res) {
    try {
      const { patientId, paymentStatus, startDate, endDate } = req.query;
      const clinicId = req.user.clinicId;
      const bills = await dbService.getCollection('bills', clinicId);

      let filtered = bills.filter(b => {
        if (patientId && b.patientId !== patientId) return false;
        if (paymentStatus && b.paymentStatus !== paymentStatus) return false;
        if (startDate && b.createdAt.slice(0, 10) < startDate) return false;
        if (endDate && b.createdAt.slice(0, 10) > endDate) return false;
        return true;
      });

      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.json(filtered);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to retrieve billing records' });
    }
  },

  // Get single bill by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const bill = await dbService.getDocument('bills', id);
      if (!bill || bill.clinicId !== req.user.clinicId) {
        return res.status(404).json({ error: 'Bill record not found' });
      }
      return res.json(bill);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to retrieve bill' });
    }
  },

  // Generate new bill / receipt
  async createBill(req, res) {
    try {
      const {
        patientId,
        appointmentId,
        consultationFee = 0, // In integer paise
        additionalCharges = [], // [{ item: 'ECG', amount: 30000 }] in paise
        paidAmount = 0, // In integer paise
        paymentMethod = 'cash', // 'cash' | 'upi' | 'card' | 'other'
        notes = ''
      } = req.body;

      if (!patientId) {
        return res.status(400).json({ error: 'Patient ID is required' });
      }

      const clinicId = req.user.clinicId;
      const patient = await dbService.getDocument('patients', patientId);
      if (!patient || patient.clinicId !== clinicId) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      const clinic = await dbService.getDocument('clinicSettings', clinicId);

      // Calculate totals in integer paise
      const addChargesTotal = additionalCharges.reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
      const totalAmount = Number(consultationFee) + addChargesTotal;
      const numPaid = Number(paidAmount);
      const pendingAmount = Math.max(0, totalAmount - numPaid);

      let paymentStatus = 'pending';
      if (numPaid >= totalAmount && totalAmount > 0) {
        paymentStatus = 'paid';
      } else if (numPaid > 0) {
        paymentStatus = 'partially_paid';
      }

      const receiptNumber = await generateReceiptNumber(clinicId);

      const bill = await dbService.createDocument('bills', {
        clinicId,
        receiptNumber,
        patientId,
        patientName: patient.fullName,
        patientPhone: patient.mobileNumber,
        patientIdCode: patient.patientId,
        appointmentId: appointmentId || null,
        consultationFee: Number(consultationFee),
        additionalCharges,
        totalAmount,
        paidAmount: numPaid,
        pendingAmount,
        paymentMethod,
        paymentStatus,
        notes,
        payments: numPaid > 0 ? [{
          amount: numPaid,
          method: paymentMethod,
          date: new Date().toISOString(),
          recordedBy: req.user.name
        }] : [],
        clinicDetails: {
          name: clinic?.name || 'ClinicCare Family Clinic',
          doctorName: clinic?.doctorName || 'Dr. Rajesh Sharma',
          phone: clinic?.phone || '',
          address: clinic?.address || ''
        },
        createdBy: req.user.id,
        createdByName: req.user.name,
        createdByRole: req.user.role
      });

      await logAudit({
        clinicId,
        actorId: req.user.id,
        actorName: req.user.name,
        actorRole: req.user.role,
        action: 'BILL_CREATE',
        resourceType: 'bills',
        resourceId: bill.id,
        details: { receiptNumber, totalAmount, paidAmount: numPaid, paymentStatus }
      });

      return res.status(201).json(bill);
    } catch (err) {
      console.error('Bill creation error:', err);
      return res.status(500).json({ error: 'Failed to generate bill/receipt' });
    }
  },

  // Record additional payment on an existing pending bill
  async recordPayment(req, res) {
    try {
      const { id } = req.params;
      const { amount, paymentMethod = 'cash', notes = '' } = req.body;
      const numAmount = Number(amount);

      if (!numAmount || numAmount <= 0) {
        return res.status(400).json({ error: 'A positive payment amount is required' });
      }

      const existing = await dbService.getDocument('bills', id);
      if (!existing || existing.clinicId !== req.user.clinicId) {
        return res.status(404).json({ error: 'Bill record not found' });
      }

      const newPaidAmount = (existing.paidAmount || 0) + numAmount;
      const newPendingAmount = Math.max(0, (existing.totalAmount || 0) - newPaidAmount);

      let newStatus = 'partially_paid';
      if (newPaidAmount >= (existing.totalAmount || 0)) {
        newStatus = 'paid';
      }

      const paymentEntry = {
        amount: numAmount,
        method: paymentMethod,
        notes,
        date: new Date().toISOString(),
        recordedBy: req.user.name
      };

      const updated = await dbService.updateDocument('bills', id, {
        paidAmount: newPaidAmount,
        pendingAmount: newPendingAmount,
        paymentStatus: newStatus,
        payments: [...(existing.payments || []), paymentEntry]
      });

      await logAudit({
        clinicId: req.user.clinicId,
        actorId: req.user.id,
        actorName: req.user.name,
        actorRole: req.user.role,
        action: 'PAYMENT_RECORDED',
        resourceType: 'bills',
        resourceId: id,
        details: { receiptNumber: existing.receiptNumber, amount: numAmount, method: paymentMethod }
      });

      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to record payment' });
    }
  },

  // Clinic financial & collection reports (Doctor only)
  async getReports(req, res) {
    try {
      const { month, year } = req.query; // YYYY-MM
      const clinicId = req.user.clinicId;
      const bills = await dbService.getCollection('bills', clinicId);

      const todayStr = new Date().toISOString().slice(0, 10);
      const currentMonthPrefix = month || todayStr.slice(0, 7); // e.g. 2026-11

      let todayTotal = 0;
      let todayCash = 0;
      let todayUpi = 0;

      let monthTotal = 0;
      let monthPaid = 0;
      let monthPending = 0;
      let monthCash = 0;
      let monthUpi = 0;

      let totalPendingEver = 0;

      bills.forEach(b => {
        // Ever pending
        totalPendingEver += (b.pendingAmount || 0);

        // All payments on today
        (b.payments || []).forEach(p => {
          if (p.date && p.date.slice(0, 10) === todayStr) {
            todayTotal += p.amount;
            if (p.method === 'cash') todayCash += p.amount;
            if (p.method === 'upi') todayUpi += p.amount;
          }
        });

        // Month collections
        if (b.createdAt && b.createdAt.startsWith(currentMonthPrefix)) {
          monthTotal += (b.totalAmount || 0);
          monthPaid += (b.paidAmount || 0);
          monthPending += (b.pendingAmount || 0);

          (b.payments || []).forEach(p => {
            if (p.method === 'cash') monthCash += p.amount;
            if (p.method === 'upi') monthUpi += p.amount;
          });
        }
      });

      return res.json({
        today: {
          date: todayStr,
          totalCollected: todayTotal,
          cash: todayCash,
          upi: todayUpi
        },
        month: {
          month: currentMonthPrefix,
          billed: monthTotal,
          collected: monthPaid,
          pending: monthPending,
          cash: monthCash,
          upi: monthUpi
        },
        overallPendingDues: totalPendingEver
      });
    } catch (err) {
      console.error('Reports error:', err);
      return res.status(500).json({ error: 'Failed to compute financial reports' });
    }
  }
};

