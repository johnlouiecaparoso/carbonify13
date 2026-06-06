/**
 * Generate and download a PDF certificate for a purchase or retirement
 * Everything fits on a single A4 landscape page.
 */
export async function generateCertificatePDF(certificate, transaction = null) {
  try {
    let jsPDF
    try {
      jsPDF = (await import('jspdf')).default
    } catch {
      console.warn('jsPDF not available, using text fallback')
      throw new Error('jsPDF not installed')
    }

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    })

    // Extract data
    const certData = certificate.certificate_data || {}
    const projectDescription = certificate.project_description || certData.project_description || ''
    const beneficiaryName = certificate.beneficiary_name || certData.beneficiary_name || 'Unknown'
    const purpose = certificate.purpose || certData.purpose || (certificate.certificate_type === 'retirement' ? 'Carbon Offset' : 'Purchase')
    const tonnesCO2 = certificate.tonnes_co2 || certData.tonnes_co2 || certificate.credits_quantity || 0
    const transactionId = certificate.transaction_id_ref || certData.transaction_id_ref || certificate.transaction_id || ''
    const paymentRef = certificate.payment_reference || certData.payment_reference || transaction?.payment_reference || ''
    const walletAddress = certificate.wallet_address || certData.wallet_address || ''
    const purchaseDateTime = certificate.purchase_date || certificate.purchase_datetime || certData.purchase_date || certData.purchase_datetime || certificate.timestamp || certData.timestamp || transaction?.created_at || certificate.issued_at || new Date().toISOString()

    // Verification URL + QR code (graceful fallback if the qrcode lib is absent)
    const origin = typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://ecolink.com'
    const verifyUrl = `${origin}/verify/${certificate.certificate_number}`
    let qrDataUrl = null
    try {
      const QRCode = (await import('qrcode')).default
      qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 256 })
    } catch (qrError) {
      console.warn('QR code generation unavailable:', qrError?.message)
    }

    // Colors
    const primaryColor = [6, 158, 45]
    const textColor = [26, 32, 44]
    const mutedColor = [113, 128, 150]

    // Layout constants
    const marginX = 15
    const labelX = marginX + 8
    const valueX = marginX + 80
    const valueMaxWidth = 185
    const boxWidth = 267

    // ── Header band ──
    doc.setFillColor(...primaryColor)
    doc.rect(0, 0, 297, 40, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('EcoLink', 18, 20)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text('Carbon Credit Certificate', 18, 30)

    // ── QR code (top-right of header) ──
    if (qrDataUrl) {
      const qrSize = 28
      const qrX = 297 - qrSize - 10
      const qrY = 6
      // White backing so the QR stays scannable over the green band
      doc.setFillColor(255, 255, 255)
      doc.rect(qrX - 1.5, qrY - 1.5, qrSize + 3, qrSize + 3, 'F')
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)
      doc.setFontSize(6)
      doc.setTextColor(255, 255, 255)
      doc.text('Scan to verify', qrX + qrSize / 2, qrY + qrSize + 4, { align: 'center' })
    }

    // ── Title ──
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...textColor)
    const certTitle = certificate.certificate_type === 'retirement'
      ? 'CERTIFICATE OF CARBON CREDIT RETIREMENT'
      : 'CERTIFICATE OF CARBON CREDIT PURCHASE'
    doc.text(certTitle, 148, 55, { align: 'center' })

    // Certificate number
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...mutedColor)
    doc.text(`Certificate Number: ${certificate.certificate_number}`, 148, 63, { align: 'center' })

    // ── Content area ──
    const contentStartY = 70
    let y = contentStartY + 6

    // Row helper — compact
    function row(label, value, options = {}) {
      const { bold = false, color = textColor, fontSize = 9 } = options
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...mutedColor)
      doc.text(label, labelX, y)
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      doc.setFontSize(fontSize)
      doc.setTextColor(...color)
      const lines = doc.splitTextToSize(toPdfText(value), valueMaxWidth)
      doc.text(lines.slice(0, 2), valueX, y)
      y += Math.max(6, lines.slice(0, 2).length * 5) + 1
    }

    // Separator helper
    function sep() {
      doc.setDrawColor(...primaryColor)
      doc.setLineWidth(0.2)
      doc.line(labelX, y, marginX + boxWidth - 8, y)
      y += 4
    }

    // "This certifies that:"
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...textColor)
    doc.text('This certifies that:', labelX, y)
    y += 7

    // Main fields
    row('Beneficiary:', beneficiaryName, { bold: true, color: primaryColor, fontSize: 11 })
    row('Project Name:', certificate.project_title || 'N/A', { bold: true, fontSize: 10 })

    if (projectDescription) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...mutedColor)
      doc.text('Description:', labelX, y)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...textColor)
      const descLines = doc.splitTextToSize(toPdfText(projectDescription), valueMaxWidth)
      doc.text(descLines.slice(0, 2), valueX, y)
      y += descLines.slice(0, 2).length * 4 + 3
    }

    row('Tonnes of CO2 Retired:', `${tonnesCO2.toLocaleString()} tonnes CO2`, { bold: true, color: primaryColor, fontSize: 10 })

    const purposeLabel = certificate.certificate_type === 'retirement' ? 'Purpose of Retirement:' : 'Purpose of Purchase:'
    row(purposeLabel, purpose)

    sep()

    // Transaction info
    const txId = transactionId || paymentRef || 'N/A'
    row('Transaction ID:', txId)

    if (walletAddress || paymentRef) {
      const verifyMsg = walletAddress ? 'Verified on-chain via wallet' : 'Verified via payment reference'
      row('Verification:', verifyMsg, { color: primaryColor })
    }

    sep()

    // Dates
    row('Purchase Date & Time:', formatDate(purchaseDateTime), { color: primaryColor })
    row('Certificate Issued:', formatDate(certificate.issued_at || purchaseDateTime))
    row('Wallet Address:', walletAddress || 'Not linked to a wallet')

    sep()

    // Additional details — compact inline
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...textColor)
    doc.text('Additional Details:', labelX, y)
    y += 6

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...mutedColor)
    const details = []
    const creditSerial = certificate.credit_serial || certData.credit_serial
    if (creditSerial) details.push(`Carbon Unit Serial: ${toPdfText(creditSerial)}`)
    if (certificate.project_category) details.push(`Category: ${toPdfText(certificate.project_category)}`)
    if (certificate.project_location) details.push(`Location: ${toPdfText(certificate.project_location)}`)
    if (certificate.vintage_year) details.push(`Vintage: ${certificate.vintage_year}`)
    if (certificate.verification_standard) details.push(`Standard: ${toPdfText(certificate.verification_standard)}`)
    if (transaction?.total_amount) details.push(`Amount: ${transaction.currency || 'PHP'} ${transaction.total_amount.toLocaleString()}`)
    if (transaction?.payment_method) details.push(`Payment: ${toPdfText(transaction.payment_method).toUpperCase()}`)

    // Print details 2 per line to save space
    for (let i = 0; i < details.length; i += 2) {
      const left = details[i]
      const right = details[i + 1] || ''
      doc.text(left, labelX, y)
      if (right) doc.text(right, labelX + 130, y)
      y += 5
    }

    // ── Draw content border dynamically ──
    const contentEndY = y + 3
    doc.setDrawColor(...primaryColor)
    doc.setLineWidth(0.5)
    doc.rect(marginX, contentStartY, boxWidth, contentEndY - contentStartY)

    // ── Footer ──
    const footerY = Math.min(contentEndY + 8, 195)
    doc.setDrawColor(...primaryColor)
    doc.setLineWidth(0.3)
    doc.line(marginX, footerY, marginX + boxWidth, footerY)

    doc.setFontSize(8)
    doc.setTextColor(...mutedColor)
    doc.text('This certificate is issued by EcoLink and verifies the ownership/retirement of carbon credits.', 148, footerY + 6, {
      align: 'center',
      maxWidth: 257,
    })
    doc.text(`For verification, scan the QR code or visit: ${verifyUrl}`, 148, footerY + 12, { align: 'center' })
    if (certificate.signature_hash) {
      doc.setFontSize(7)
      doc.text(`Digital signature: ${certificate.signature_hash.slice(0, 32)}…`, 148, footerY + 17, { align: 'center' })
    }

    const filename = `certificate-${certificate.certificate_number}.pdf`
    doc.save(filename)
    return filename
  } catch (error) {
    console.error('Error generating certificate PDF:', error)
    throw new Error('Failed to generate certificate PDF')
  }
}

function formatDate(dateString) {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function toPdfText(value) {
  if (value === null || value === undefined || value === '') {
    return 'N/A'
  }
  return String(value)
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
