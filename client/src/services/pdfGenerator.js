import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate } from '../utils/formatters.js';

export const pdfService = {
  // Generate professional PDF prescription
  generatePrescriptionPDF(rx, clinic = {}) {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const primaryColor = [15, 39, 68]; // #0F2744 Navy
    const accentColor = [13, 148, 136]; // #0D9488 Teal
    const grayText = [100, 116, 139];

    // Top Clinic Header
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 32, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(clinic.name || rx.clinicDetails?.name || 'CLINICCARE', 14, 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(clinic.tagline || rx.clinicDetails?.tagline || 'Compassionate & Comprehensive Healthcare', 14, 19);
    const rxHeaderContact = [
      clinic.address || rx.clinicDetails?.address || '',
      (clinic.phone || rx.clinicDetails?.phone) ? `Phone: ${clinic.phone || rx.clinicDetails?.phone}` : ''
    ].filter(Boolean).join(' | ');
    doc.text(rxHeaderContact, 14, 25);

    // Doctor Details (Right-aligned in header)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(clinic.doctorName || rx.doctorDetails?.name || 'Attending Physician', 196, 13, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const rxRegNo = (clinic.doctorRegNo || rx.doctorDetails?.regNo) ? `Reg No: ${clinic.doctorRegNo || rx.doctorDetails?.regNo}` : 'Registered Medical Practitioner';
    doc.text(rxRegNo, 196, 19, { align: 'right' });
    doc.text(clinic.tagline || 'General Physician & Family Medicine', 196, 25, { align: 'right' });

    // Patient Details Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 38, 182, 22, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('Patient Name:', 18, 44);
    doc.text('Patient ID:', 18, 50);
    doc.text('Age / Gender:', 18, 56);

    doc.setFont('helvetica', 'normal');
    doc.text(rx.patientName || 'N/A', 46, 44);
    doc.text(rx.patientIdCode || rx.patientId || 'N/A', 46, 50);
    doc.text(`${rx.patientAge ? `${rx.patientAge} Yrs` : 'N/A'} / ${rx.patientGender || 'N/A'}`, 46, 56);

    doc.setFont('helvetica', 'bold');
    doc.text('Rx Number:', 115, 44);
    doc.text('Date:', 115, 50);
    doc.text('Contact:', 115, 56);

    doc.setFont('helvetica', 'normal');
    doc.text(rx.rxNumber || rx.id.slice(0, 8), 140, 44);
    doc.text(formatDate(rx.prescriptionDate || rx.createdAt), 140, 50);
    doc.text(rx.patientPhone || 'N/A', 140, 56);

    let currentY = 67;

    // Clinical Diagnosis
    if (rx.diagnosis) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...primaryColor);
      doc.text('Diagnosis / Clinical Summary:', 14, currentY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(rx.diagnosis, 70, currentY);
      currentY += 8;
    }

    // Rx Symbol
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...accentColor);
    doc.text('Rx', 14, currentY + 3);

    // Medicines Table
    const tableRows = (rx.medicines || []).map((m, idx) => [
      idx + 1,
      `${m.name || ''} ${m.strength || ''}`.trim(),
      m.dosage || '1 Tab',
      m.route || 'Oral',
      m.frequency || '1-0-1',
      m.duration || '5 days',
      m.instructions || 'After food'
    ]);

    autoTable(doc, {
      startY: currentY + 6,
      head: [['#', 'Medicine & Strength', 'Dosage', 'Route', 'Frequency', 'Duration', 'Instructions']],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [30, 41, 59]
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 50, fontStyle: 'bold' },
        2: { cellWidth: 20 },
        3: { cellWidth: 18 },
        4: { cellWidth: 24, halign: 'center' },
        5: { cellWidth: 22, halign: 'center' },
        6: { cellWidth: 40 }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = doc.lastAutoTable.finalY + 10;

    // Doctor Advice & General Instructions
    if (rx.generalAdvice || rx.dietaryAdvice) {
      doc.setFillColor(240, 253, 250); // Light teal
      doc.setDrawColor(204, 251, 241);
      doc.roundedRect(14, currentY, 182, 22, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...accentColor);
      doc.text("Doctor's Advice & Instructions:", 18, currentY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      const adviceText = [
        rx.generalAdvice ? `• ${rx.generalAdvice}` : '',
        rx.dietaryAdvice ? `• Diet: ${rx.dietaryAdvice}` : ''
      ].filter(Boolean).join('\n');

      doc.text(adviceText || 'Take medications as scheduled. Stay hydrated.', 18, currentY + 12);
      currentY += 28;
    }

    // Follow-up Alert
    if (rx.followUpDate) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...primaryColor);
      doc.text(`Follow-up Consultation Due On: ${formatDate(rx.followUpDate)}`, 14, currentY + 3);
    }

    // Signature Area
    const footerY = 265;
    doc.setDrawColor(203, 213, 225);
    doc.line(140, footerY - 5, 196, footerY - 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(clinic.doctorName || rx.doctorDetails?.name || 'Attending Physician', 168, footerY, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...grayText);
    const rxSigReg = (clinic.doctorRegNo || rx.doctorDetails?.regNo) ? `Reg: ${clinic.doctorRegNo || rx.doctorDetails?.regNo}` : 'Registered Practitioner';
    doc.text(rxSigReg, 168, footerY + 4, { align: 'center' });
    doc.text('Digitally Approved & Signed', 168, footerY + 8, { align: 'center' });

    // Bottom Notice
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('This digital prescription is generated by ClinicCare Digital Clinic Management System.', 105, 285, { align: 'center' });

    // Download PDF
    doc.save(`Prescription_${rx.rxNumber || rx.patientName || 'Medical'}.pdf`);
  },

  // Generate unified OPD Case Paper PDF
  generateCasePaperPDF(paper, clinic = {}) {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const primaryColor = [15, 39, 68]; // #0F2744 Navy
    const accentColor = [13, 148, 136]; // #0D9488 Teal
    const grayText = [100, 116, 139];

    // Clinic Header
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 32, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text(clinic.name || 'CLINICCARE', 14, 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(clinic.tagline || 'Compassionate & Comprehensive Healthcare', 14, 19);
    const caseContact = [
      clinic.address || '',
      clinic.phone ? `Phone: ${clinic.phone}` : ''
    ].filter(Boolean).join(' | ');
    doc.text(caseContact, 14, 25);

    // Doctor Details (Header Right)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(clinic.doctorName || 'Attending Physician', 196, 13, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const caseRegNo = clinic.doctorRegNo ? `Reg No: ${clinic.doctorRegNo}` : 'Registered Medical Practitioner';
    doc.text(caseRegNo, 196, 19, { align: 'right' });
    doc.text('OPD Case Paper & Consultation Sheet', 196, 25, { align: 'right' });

    // Patient & Vitals Information Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 37, 182, 30, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('Patient Name:', 18, 43);
    doc.text('Patient ID:', 18, 49);
    doc.text('Age / Gender:', 18, 55);

    doc.setFont('helvetica', 'normal');
    doc.text(paper.patient.fullName || 'N/A', 46, 43);
    doc.text(paper.patient.patientId || 'N/A', 46, 49);
    doc.text(`${paper.patient.age ? `${paper.patient.age} Yrs` : 'N/A'} / ${paper.patient.gender || 'N/A'}`, 46, 55);

    doc.setFont('helvetica', 'bold');
    doc.text('Date:', 115, 43);
    doc.text('Contact:', 115, 49);
    doc.text('Receipt / Bill:', 115, 55);

    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(paper.date), 140, 43);
    doc.text(paper.patient.mobileNumber || 'N/A', 140, 49);
    doc.text(`${paper.receiptNumber || 'OPD-CONSULT'} (Rs. ${paper.fee || 500})`, 140, 55);

    // Vitals Bar
    doc.setDrawColor(203, 213, 225);
    doc.line(18, 58, 192, 58);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...accentColor);
    const vitalsStr = `Vitals:  BP: ${paper.vitals?.bp || '-'} mmHg   |   Pulse: ${paper.vitals?.pulse || '-'} bpm   |   Temp: ${paper.vitals?.temperature || '-'} F   |   Weight: ${paper.vitals?.weight || '-'} kg   |   SpO2: ${paper.vitals?.spo2 || '-'}%`;
    doc.text(vitalsStr, 18, 63);

    let currentY = 74;

    // Complaints / Symptoms
    if (paper.symptoms) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...primaryColor);
      doc.text('Chief Complaints & Symptoms:', 14, currentY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(paper.symptoms, 70, currentY);
      currentY += 7;
    }

    // Clinical Diagnosis
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...primaryColor);
    doc.text('Diagnosis / Clinical Summary:', 14, currentY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(paper.diagnosis || 'General Medical Consultation', 70, currentY);
    currentY += 8;

    // Rx Symbol
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...accentColor);
    doc.text('Rx', 14, currentY + 3);

    // Medicines Table
    const tableRows = (paper.medicines || []).map((m, idx) => [
      idx + 1,
      m.name || '',
      m.dosage || '1-0-1',
      m.duration || '5 Days',
      m.instructions || 'After Food'
    ]);

    autoTable(doc, {
      startY: currentY + 6,
      head: [['#', 'Medicine Prescribed', 'Dosage / Timing', 'Duration', 'Instructions']],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [30, 41, 59]
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 70 },
        2: { cellWidth: 35, halign: 'center' },
        3: { cellWidth: 30, halign: 'center' },
        4: { cellWidth: 37 }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = doc.lastAutoTable.finalY + 8;

    // Doctor's Advice Box
    if (paper.advice) {
      doc.setFillColor(254, 252, 232); // soft amber
      doc.setDrawColor(254, 240, 138);
      doc.roundedRect(14, currentY, 182, 16, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(161, 98, 7);
      doc.text("Doctor's Advice & Precautions:", 18, currentY + 6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(68, 64, 60);
      doc.text(paper.advice, 18, currentY + 11);
      currentY += 21;
    }

    // Follow-up Alert
    if (paper.followUpDate) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...primaryColor);
      doc.text(`Follow-up / Review Visit: ${formatDate(paper.followUpDate)}`, 14, currentY + 2);
    }

    // Signature Area
    const footerY = 265;
    doc.setDrawColor(203, 213, 225);
    doc.line(140, footerY - 5, 196, footerY - 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(clinic.doctorName || 'Attending Physician', 168, footerY, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...grayText);
    const caseSigReg = clinic.doctorRegNo ? `Reg: ${clinic.doctorRegNo}` : 'Registered Practitioner';
    doc.text(caseSigReg, 168, footerY + 4, { align: 'center' });
    doc.text('Signature / Medical Seal', 168, footerY + 8, { align: 'center' });

    // Bottom Notice
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('This OPD Case Paper is issued by ClinicCare Digital Clinic Management System.', 105, 285, { align: 'center' });

    doc.save(`CasePaper_${paper.patient.fullName.replace(/\s+/g, '_')}_${paper.date}.pdf`);
  },

  // Generate Official Billing Receipt PDF
  generateReceiptPDF(bill, clinic = {}) {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a5' // A5 standard receipt format
    });

    const primaryColor = [15, 39, 68];

    // Header
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 148, 22, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(clinic.name || bill.clinicDetails?.name || 'CLINICCARE', 10, 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const receiptAddress = clinic.address || bill.clinicDetails?.address || 'Official Payment Receipt';
    doc.text(receiptAddress, 10, 17);

    doc.setFontSize(8);
    const receiptPhone = clinic.phone || bill.clinicDetails?.phone;
    if (receiptPhone) {
      doc.text(`Ph: ${receiptPhone}`, 138, 14, { align: 'right' });
    }
    const receiptDoc = clinic.doctorName || bill.clinicDetails?.doctorName;
    if (receiptDoc) {
      doc.text(receiptDoc, 138, 18, { align: 'right' });
    }

    // Receipt Meta
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`Receipt #: ${bill.receiptNumber || bill.id}`, 10, 30);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${formatDate(bill.createdAt)}`, 138, 30, { align: 'right' });

    // Patient Info
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(10, 34, 128, 14, 1.5, 1.5, 'F');
    doc.text(`Patient: ${bill.patientName || 'N/A'} (ID: ${bill.patientIdCode || bill.patientId || 'N/A'})`, 14, 40);
    doc.text(`Contact: ${bill.patientPhone || 'N/A'}`, 14, 45);

    // Bill Items
    const rows = [
      ['Doctor Consultation Fee', formatCurrency(bill.consultationFee || 0)]
    ];

    (bill.additionalCharges || []).forEach(item => {
      rows.push([item.item || 'Additional Service', formatCurrency(item.amount || 0)]);
    });

    autoTable(doc, {
      startY: 53,
      head: [['Particulars', 'Amount']],
      body: rows,
      theme: 'plain',
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        fontSize: 8.5
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [30, 41, 59]
      },
      columnStyles: {
        0: { cellWidth: 95 },
        1: { cellWidth: 33, halign: 'right' }
      },
      margin: { left: 10, right: 10 }
    });

    const finalY = doc.lastAutoTable.finalY + 5;
    doc.setDrawColor(226, 232, 240);
    doc.line(10, finalY, 138, finalY);

    // Totals
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('Total Amount:', 80, finalY + 7);
    doc.text(formatCurrency(bill.totalAmount), 138, finalY + 7, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129); // Green
    doc.text('Paid Amount:', 80, finalY + 13);
    doc.text(formatCurrency(bill.paidAmount), 138, finalY + 13, { align: 'right' });

    if (bill.pendingAmount > 0) {
      doc.setTextColor(225, 29, 72); // Rose
      doc.text('Pending Balance:', 80, finalY + 19);
      doc.text(formatCurrency(bill.pendingAmount), 138, finalY + 19, { align: 'right' });
    }

    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Payment Mode: ${(bill.paymentMethod || 'Cash').toUpperCase()}`, 10, finalY + 13);
    doc.text(`Status: ${(bill.paymentStatus || 'Paid').toUpperCase()}`, 10, finalY + 18);

    // Signature
    doc.line(95, 180, 138, 180);
    doc.text('Authorized Signature', 116, 185, { align: 'center' });

    doc.save(`Receipt_${bill.receiptNumber || 'Payment'}.pdf`);
  }
};

