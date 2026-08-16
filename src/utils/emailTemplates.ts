import { Invoice, Quotation, WorkshopSettings } from '../types';
import { formatZAR } from './sarsTaxEngine';

/**
 * Builds a pre-filled mailto: protocol URL with escaped query params.
 */
export function buildMailtoUrl(to: string, subject: string, body: string): string {
  const cleanTo = (to || '').trim();
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);
  return `mailto:${cleanTo}?subject=${encodedSubject}&body=${encodedBody}`;
}

/**
 * Generates official SARS-compliant Tax Invoice email subject and body
 * with complete line item details, banking info, and Customer Portal instructions.
 */
export function generateInvoiceEmailTemplate(invoice: Invoice, settings: WorkshopSettings) {
  const customerName = invoice.customerName || 'Valued Customer';
  const workshopName = settings.workshopName || "JC's AutoCraft Workshop";
  const vehicleDesc = `${invoice.vehicleMakeModel || 'Vehicle'} (${invoice.vehicleReg || 'N/A'})`;
  const subject = `Tax Invoice ${invoice.invoiceNumber} - ${vehicleDesc} | ${workshopName}`;

  const itemsList = (invoice.items || [])
    .map(
      (item, idx) =>
        `  ${idx + 1}. [${item.type}] ${item.description} | Qty: ${item.quantity} | Unit: ${formatZAR(item.unitPrice)} | Total: ${formatZAR(item.totalExVat)} (ex VAT)`
    )
    .join('\n');

  const isPaid = invoice.status === 'PAID' || invoice.balanceDue <= 0;

  const bankingSection = !isPaid
    ? `--------------------------------------------------
EFT BANKING DETAILS FOR PAYMENT
--------------------------------------------------
Bank Name: ${settings.bankName}
Account Holder: ${settings.accountHolder || settings.workshopName}
Account Number: ${settings.accountNumber}
Account Type: ${settings.accountType || 'Cheque / Current Account'}
Branch Name / Code: ${settings.branchName || 'Standard Branch'} (${settings.branchCode})
Payment Reference: ${invoice.invoiceNumber}
* CRITICAL: Please use "${invoice.invoiceNumber}" as your payment reference so your receipt is allocated automatically.`
    : `--------------------------------------------------
PAYMENT STATUS: SETTLED IN FULL
--------------------------------------------------
Thank you for your payment! This Tax Invoice is marked as PAID in full.`;

  const body = `Dear ${customerName},

Thank you for trusting ${workshopName} with your vehicle maintenance and repairs.

Please find the summary of your official SARS Tax Invoice #${invoice.invoiceNumber} below:

--------------------------------------------------
TAX INVOICE PARTICULARS
--------------------------------------------------
• Invoice Number: ${invoice.invoiceNumber}
• Issue Date: ${invoice.date}
• Payment Due Date: ${invoice.dueDate}
• Invoice Status: ${invoice.status}
• Vehicle: ${invoice.vehicleMakeModel}
• Registration Number: ${invoice.vehicleReg}
• Recorded Odometer: ${invoice.vehicleMileage ? invoice.vehicleMileage.toLocaleString() + ' km' : 'N/A'}
• Work Order Scope: ${invoice.jobDescription || 'Standard Mechanical Service & Inspection'}

--------------------------------------------------
ITEMIZED WORK & PARTS BREAKDOWN
--------------------------------------------------
${itemsList || '  Standard Service Package'}

--------------------------------------------------
SARS STATUTORY FINANCIAL SUMMARY (ZAR)
--------------------------------------------------
• Subtotal (Excl. 15% VAT): ${formatZAR(invoice.subtotalExVat)}
• SARS Output VAT @ 15.0%: ${formatZAR(invoice.vatAmount)}
• Grand Total (Incl. 15% VAT): ${formatZAR(invoice.totalIncVat)}
• Total Settled / Paid to Date: ${formatZAR(invoice.amountPaid || 0)}
• OUTSTANDING BALANCE DUE: ${formatZAR(invoice.balanceDue)}

${bankingSection}

--------------------------------------------------
CUSTOMER PORTAL ACCESS & SERVICE HISTORY
--------------------------------------------------
As a customer of ${workshopName}, you have direct access to your online Customer Portal where you can:
1. View, print, and download official PDF Tax Invoices and Quotations.
2. Review complete vehicle service logs, parts fitted, and past diagnostic notes.
3. Track your vehicle's odometer progression and upcoming scheduled service milestones.
4. Access payment receipts and statements of account.

HOW TO ACCESS YOUR PORTAL:
1. Open the workshop system and navigate to the "Client Portal" section.
2. Search using your vehicle registration number: ${invoice.vehicleReg}
   (Or search by your contact phone: ${invoice.customerPhone || 'your registered number'})
3. Select your profile to view your vehicle dashboard and download your full Service History Dossier.

If you have any questions, require technical assistance, or wish to schedule your next service booking:
📞 Tel / WhatsApp: ${settings.phone}
📧 Email: ${settings.email}
📍 Workshop Address: ${settings.physicalAddress}

Kind regards,
The Service & Accounts Team
${workshopName}
SARS VAT Registration: ${settings.vatNumber}
CIPC Registration: ${settings.registrationNumber}
`;

  return {
    to: invoice.customerEmail || '',
    subject,
    body,
  };
}

/**
 * Generates official Quotation Estimate email template.
 */
export function generateQuotationEmailTemplate(quote: Quotation, settings: WorkshopSettings) {
  const customerName = quote.customerName || 'Valued Customer';
  const workshopName = settings.workshopName || "JC's AutoCraft Workshop";
  const vehicleDesc = `${quote.vehicleMakeModel || 'Vehicle'} (${quote.vehicleReg || 'N/A'})`;
  const subject = `Formal Quotation ${quote.quoteNumber} - ${vehicleDesc} | ${workshopName}`;

  const itemsList = (quote.items || [])
    .map(
      (item, idx) =>
        `  ${idx + 1}. [${item.type}] ${item.description} | Qty: ${item.quantity} | Unit: ${formatZAR(item.unitPrice)} | Total: ${formatZAR(item.totalExVat)} (ex VAT)`
    )
    .join('\n');

  const body = `Dear ${customerName},

Thank you for requesting an estimate from ${workshopName}.

Please find the detailed quotation #${quote.quoteNumber} for your ${vehicleDesc} below:

--------------------------------------------------
QUOTATION PARTICULARS
--------------------------------------------------
• Quote Number: ${quote.quoteNumber}
• Issue Date: ${quote.date}
• Validity Period: Valid until ${quote.expiryDate} (14 days)
• Status: ${quote.status}
• Vehicle: ${quote.vehicleMakeModel}
• Registration Number: ${quote.vehicleReg}
• Recorded Odometer: ${quote.vehicleMileage ? quote.vehicleMileage.toLocaleString() + ' km' : 'N/A'}
• Estimated Work Scope: ${quote.jobDescription || 'Mechanical Repairs & Maintenance Estimate'}

--------------------------------------------------
ESTIMATED PARTS & LABOR SCOPE
--------------------------------------------------
${itemsList || '  Standard Service Package'}

--------------------------------------------------
FINANCIAL ESTIMATE SUMMARY (ZAR)
--------------------------------------------------
• Estimate Subtotal (Excl. 15% VAT): ${formatZAR(quote.subtotalExVat)}
• Estimated SARS VAT @ 15.0%: ${formatZAR(quote.vatAmount)}
• ESTIMATED GRAND TOTAL (Incl. 15% VAT): ${formatZAR(quote.totalIncVat)}

--------------------------------------------------
GUARANTEE & TERMS
--------------------------------------------------
• Quotation prices are valid for 14 calendar days from issue date.
• All replacement parts are brand new OEM or high-grade certified equivalents.
• Workmanship carries a 6-month or 10,000 km warranty.

--------------------------------------------------
CUSTOMER PORTAL ACCESS
--------------------------------------------------
You can track this quote, review past service history, and approve repair work directly in the Customer Portal by searching for your registration number: ${quote.vehicleReg}.

To accept this quotation or book your vehicle into the workshop:
📞 Tel / WhatsApp: ${settings.phone}
📧 Email: ${settings.email}
📍 Workshop Address: ${settings.physicalAddress}

Kind regards,
Estimating Department
${workshopName}
SARS VAT Reg: ${settings.vatNumber}
`;

  return {
    to: quote.customerEmail || '',
    subject,
    body,
  };
}
