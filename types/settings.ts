export interface ThermalBillSettings {
  // Header
  headerTitle: string; // If empty, falls back to business tradeName
  showTagline: boolean;
  tagline: string;
  showAddress: boolean;
  showPhone: boolean;
  showEmail: boolean;
  showGstin: boolean;
  showFssai: boolean;
  fssaiNumber: string;
  showCustomerDetails: boolean;
  showDateAndTime: boolean;
  showCashierName: boolean;

  // Footer
  footerMessage1: string;
  footerMessage2: string;
  showTerms: boolean;
  showUpiQr: boolean;
  upiId: string;
  paperSize: "2inch" | "3inch";
  autoCut: boolean;
}

export const defaultThermalBillSettings: ThermalBillSettings = {
  headerTitle: "",
  showTagline: false,
  tagline: "SWEETS, BAKERY & COLD DRINKS",
  showAddress: true,
  showPhone: true,
  showEmail: false,
  showGstin: true,
  showFssai: false,
  fssaiNumber: "",
  showCustomerDetails: true,
  showDateAndTime: true,
  showCashierName: true,
  footerMessage1: "Thank you for visiting Ravi Sweets! Have a sweet day!",
  footerMessage2: "Goods once sold cannot be returned.",
  showTerms: true,
  showUpiQr: false,
  upiId: "",
  paperSize: "3inch",
  autoCut: true,
};

export interface A4InvoiceSettings {
  logoUrl: string;
  signatureUrl: string;
  signatoryName: string;
  signatoryCompany: string;
  showLogo: boolean;
  showSignature: boolean;
  invoiceTitle: string;
  invoicePrefix: string;
  showGstin: boolean;
  showPan: boolean;
  panNumber: string;
  showFssai: boolean;
  fssaiNumber: string;
  showBankDetails: boolean;
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;
  upiId: string;
  termsAndConditions: string;
  footerNote: string;
}

export const defaultA4InvoiceSettings: A4InvoiceSettings = {
  logoUrl: "",
  signatureUrl: "",
  signatoryName: "Authorized Signatory",
  signatoryCompany: "For Ravi Sweets & Cold Drinks",
  showLogo: true,
  showSignature: true,
  invoiceTitle: "TAX INVOICE",
  invoicePrefix: "RS-INV-",
  showGstin: true,
  showPan: false,
  panNumber: "",
  showFssai: false,
  fssaiNumber: "",
  showBankDetails: true,
  bankName: "State Bank of India",
  accountName: "Ravi Sweets",
  accountNumber: "",
  ifscCode: "",
  branch: "Chirala Main Branch",
  upiId: "",
  termsAndConditions: "1. Goods once sold will not be taken back or exchanged.\n2. Payment is due within 7 days of invoice date.\n3. Subject to Chirala jurisdiction.",
  footerNote: "This is a computer generated invoice and requires no physical signature.",
};
