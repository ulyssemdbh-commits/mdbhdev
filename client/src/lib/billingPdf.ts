import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface BillingData {
  id: string | number;
  merchantName: string;
  merchantAddress?: string;
  merchantCity?: string;
  merchantPostalCode?: string;
  merchantSiret?: string;
  periodStart: Date | string;
  periodEnd: Date | string;
  totalSales: string;
  cashbackAmount: string;
  revFeeAmount: string;
  tvaAmount: string;
  totalBilled: string;
  status: string;
  dueDate: Date | string;
  paidAt?: Date | string | null;
}

export function generateBillingPdf(billing: BillingData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  const periodStart = new Date(billing.periodStart);
  const periodEnd = new Date(billing.periodEnd);
  const dueDate = new Date(billing.dueDate);

  const formatCurrency = (value: string | number): string => {
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(numValue);
  };
  
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("FACTURE", pageWidth / 2, 25, { align: "center" });
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("REV - Retour En Ville", 20, 45);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Plateforme de cashback local", 20, 52);
  
  doc.setFontSize(10);
  doc.text(`Facture N°: REV-${billing.id.toString().padStart(6, '0')}`, pageWidth - 20, 45, { align: "right" });
  doc.text(`Date: ${format(new Date(), "dd/MM/yyyy", { locale: fr })}`, pageWidth - 20, 52, { align: "right" });
  doc.text(`Échéance: ${format(dueDate, "dd/MM/yyyy", { locale: fr })}`, pageWidth - 20, 59, { align: "right" });
  
  doc.setDrawColor(200, 200, 200);
  doc.line(20, 60, pageWidth - 20, 60);
  
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Facturé à:", 20, 75);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(billing.merchantName, 20, 83);
  if (billing.merchantAddress) {
    doc.text(billing.merchantAddress, 20, 90);
  }
  if (billing.merchantPostalCode && billing.merchantCity) {
    doc.text(`${billing.merchantPostalCode} ${billing.merchantCity}`, 20, 97);
  }
  if (billing.merchantSiret) {
    doc.text(`SIRET: ${billing.merchantSiret}`, 20, 104);
  }
  
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Période de facturation:", pageWidth - 20, 75, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Du ${format(periodStart, "dd MMMM yyyy", { locale: fr })}`,
    pageWidth - 20, 83, { align: "right" }
  );
  doc.text(
    `Au ${format(periodEnd, "dd MMMM yyyy", { locale: fr })}`,
    pageWidth - 20, 90, { align: "right" }
  );
  
  autoTable(doc, {
    startY: 120,
    head: [["Description", "Base", "Taux", "Montant"]],
    body: [
      ["Ventes totales de la période", "", "", formatCurrency(billing.totalSales)],
      ["Cashback reversé aux clients", formatCurrency(billing.totalSales), "10%", formatCurrency(billing.cashbackAmount)],
      ["Commission REV (HT)", formatCurrency(billing.totalSales), "3%", formatCurrency(billing.revFeeAmount)],
      ["TVA sur commission", formatCurrency(billing.revFeeAmount), "20%", formatCurrency(billing.tvaAmount)],
    ],
    foot: [["", "", "TOTAL À PAYER", formatCurrency(billing.totalBilled)]],
    theme: "striped",
    headStyles: { 
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: "bold"
    },
    footStyles: { 
      fillColor: [243, 244, 246],
      textColor: [0, 0, 0],
      fontStyle: "bold"
    },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 35, halign: "right" },
      2: { cellWidth: 25, halign: "center" },
      3: { cellWidth: 35, halign: "right" },
    },
    margin: { left: 20, right: 20 },
  });
  
  const finalY = (doc as any).lastAutoTable.finalY + 20;
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Date d'échéance: ${format(dueDate, "dd MMMM yyyy", { locale: fr })}`, 20, finalY);
  
  const statusText = billing.status === "paid" 
    ? `PAYÉE le ${billing.paidAt ? format(new Date(billing.paidAt), "dd/MM/yyyy", { locale: fr }) : ""}`
    : billing.status === "overdue" 
      ? "EN RETARD"
      : "EN ATTENTE";
  
  const statusColor: [number, number, number] = billing.status === "paid" 
    ? [34, 197, 94] 
    : billing.status === "overdue" 
      ? [239, 68, 68]
      : [234, 179, 8];
  
  doc.setTextColor(...statusColor);
  doc.text(`Statut: ${statusText}`, pageWidth - 20, finalY, { align: "right" });
  doc.setTextColor(0, 0, 0);
  
  doc.setDrawColor(200, 200, 200);
  doc.line(20, finalY + 10, pageWidth - 20, finalY + 10);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("REV - Retour En Ville", pageWidth / 2, finalY + 25, { align: "center" });
  doc.text("Plateforme de fidélité et cashback pour le commerce local", pageWidth / 2, finalY + 32, { align: "center" });
  
  const fileName = `facture-REV-${billing.id.toString().padStart(6, '0')}-${billing.merchantName.replace(/\s+/g, '-')}.pdf`;
  doc.save(fileName);
}
