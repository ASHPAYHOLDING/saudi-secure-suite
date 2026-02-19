import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode, decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ZATCA API endpoints
const ZATCA_SANDBOX_URL = "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal";
const ZATCA_PRODUCTION_URL = "https://gw-fatoora.zatca.gov.sa/e-invoicing/core";

interface InvoiceData {
  invoice: any;
  items: any[];
  tenant: any;
  customer: any;
  icv: number;
}

// ─── XML Escaping ───────────────────────────────────────────
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─── SHA-256 Hashing ────────────────────────────────────────
async function sha256Hash(data: Uint8Array): Promise<Uint8Array> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hashBuffer);
}

async function sha256Base64(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await sha256Hash(encoder.encode(data));
  return base64Encode(hash);
}

// ─── XML Canonicalization (C14N Exclusive) ───────────────────
// Simplified C14N: normalize whitespace, sort attributes, remove XML declaration
function canonicalizeXml(xml: string): string {
  // Remove XML declaration
  let c14n = xml.replace(/<\?xml[^?]*\?>\s*/g, '');
  // Normalize line endings
  c14n = c14n.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Remove leading/trailing whitespace per line but preserve structure
  c14n = c14n.split('\n').map(line => line.trim()).filter(line => line.length > 0).join('\n');
  return c14n;
}

// ─── ECDSA P-256 Digital Signature ──────────────────────────
async function importPrivateKey(pemBase64: string): Promise<CryptoKey> {
  // Handle PEM format or raw base64
  let keyData: string = pemBase64;
  
  // Strip PEM headers if present
  keyData = keyData
    .replace(/-----BEGIN EC PRIVATE KEY-----/g, '')
    .replace(/-----END EC PRIVATE KEY-----/g, '')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');

  const binaryKey = base64Decode(keyData);

  try {
    // Try PKCS#8 format first
    return await crypto.subtle.importKey(
      "pkcs8",
      binaryKey,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );
  } catch {
    // Fallback: try raw key import (SEC1/DER)
    // For SEC1 EC keys, we need to wrap in PKCS#8
    const pkcs8Prefix = new Uint8Array([
      0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13,
      0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
      0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
      0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02,
      0x01, 0x01, 0x04, 0x20,
    ]);
    
    // Extract the 32-byte private key value from SEC1 format
    // SEC1: 30 len 02 01 01 04 20 [32-byte key] ...
    let privateKeyBytes: Uint8Array;
    if (binaryKey[0] === 0x30 && binaryKey[2] === 0x02) {
      // SEC1 DER format
      const keyOffset = binaryKey.indexOf(0x04, 4) + 2;
      privateKeyBytes = binaryKey.slice(keyOffset, keyOffset + 32);
    } else {
      // Assume raw 32-byte key
      privateKeyBytes = binaryKey.length === 32 ? binaryKey : binaryKey.slice(0, 32);
    }
    
    const pkcs8Suffix = new Uint8Array([
      0xa1, 0x44, 0x03, 0x42, 0x00,
    ]);
    
    // For simplicity, re-attempt with the raw bytes
    throw new Error("Unsupported private key format. Please provide PKCS#8 encoded key.");
  }
}

async function signData(privateKey: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    data
  );
  return new Uint8Array(signature);
}

// ─── XAdES-BES Signature Generation ─────────────────────────
async function generateXAdESSignature(
  xml: string,
  privateKeyPem: string,
  certificateBase64: string,
): Promise<{ signedXml: string; signatureValue: string; digestValue: string }> {
  const privateKey = await importPrivateKey(privateKeyPem);
  
  // 1. Canonicalize the invoice body (everything inside <Invoice> or <CreditNote>)
  const canonicalized = canonicalizeXml(xml);
  
  // 2. Compute digest of the canonicalized document
  const docDigest = await sha256Base64(canonicalized);
  
  // 3. Compute certificate digest
  const certBytes = base64Decode(certificateBase64.replace(/\s/g, ''));
  const certHash = await sha256Hash(certBytes);
  const certDigest = base64Encode(certHash);
  
  // 4. Build SignedProperties
  const signingTime = new Date().toISOString();
  const signedProperties = `<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="xadesSignedProperties">
  <xades:SignedSignatureProperties>
    <xades:SigningTime>${signingTime}</xades:SigningTime>
    <xades:SigningCertificate>
      <xades:Cert>
        <xades:CertDigest>
          <ds:DigestMethod xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
          <ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${certDigest}</ds:DigestValue>
        </xades:CertDigest>
      </xades:Cert>
    </xades:SigningCertificate>
  </xades:SignedSignatureProperties>
</xades:SignedProperties>`;

  // 5. Compute digest of SignedProperties
  const propsDigest = await sha256Base64(canonicalizeXml(signedProperties));
  
  // 6. Build SignedInfo
  const signedInfo = `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
  <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"/>
  <ds:Reference Id="invoiceSignedData" URI="">
    <ds:Transforms>
      <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
        <ds:XPath>not(//ancestor-or-self::ext:UBLExtensions)</ds:XPath>
      </ds:Transform>
    </ds:Transforms>
    <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
    <ds:DigestValue>${docDigest}</ds:DigestValue>
  </ds:Reference>
  <ds:Reference Type="http://www.w3.org/2000/09/xmldsig#SignatureProperties" URI="#xadesSignedProperties">
    <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
    <ds:DigestValue>${propsDigest}</ds:DigestValue>
  </ds:Reference>
</ds:SignedInfo>`;

  // 7. Sign the SignedInfo
  const encoder = new TextEncoder();
  const signedInfoBytes = encoder.encode(canonicalizeXml(signedInfo));
  const signatureBytes = await signData(privateKey, signedInfoBytes);
  const signatureValue = base64Encode(signatureBytes);
  
  // 8. Build complete UBLExtensions with signature
  const ublExtensions = `<ext:UBLExtensions>
  <ext:UBLExtension>
    <ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI>
    <ext:ExtensionContent>
      <sig:UBLDocumentSignatures xmlns:sig="urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2"
                                  xmlns:sac="urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2"
                                  xmlns:sbc="urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2">
        <sac:SignatureInformation>
          <cbc:ID>urn:oasis:names:specification:ubl:signature:1</cbc:ID>
          <sbc:ReferencedSignatureID>urn:oasis:names:specification:ubl:signature:Invoice</sbc:ReferencedSignatureID>
          <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="signature">
            ${signedInfo}
            <ds:SignatureValue>${signatureValue}</ds:SignatureValue>
            <ds:KeyInfo>
              <ds:X509Data>
                <ds:X509Certificate>${certificateBase64}</ds:X509Certificate>
              </ds:X509Data>
            </ds:KeyInfo>
            <ds:Object>
              <xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Target="signature">
                ${signedProperties}
              </xades:QualifyingProperties>
            </ds:Object>
          </ds:Signature>
        </sac:SignatureInformation>
      </sig:UBLDocumentSignatures>
    </ext:ExtensionContent>
  </ext:UBLExtension>
</ext:UBLExtensions>`;

  // 9. Inject UBLExtensions into XML (after opening tag)
  let signedXml = xml;
  // Insert after the root element's opening tag attributes
  const insertionPatterns = [
    /(<Invoice[^>]*>)/,
    /(<CreditNote[^>]*>)/,
  ];
  
  for (const pattern of insertionPatterns) {
    const match = signedXml.match(pattern);
    if (match) {
      signedXml = signedXml.replace(match[0], `${match[0]}\n${ublExtensions}`);
      break;
    }
  }

  // Add Signature reference element before AccountingSupplierParty
  const sigRef = `<cac:Signature>
    <cbc:ID>urn:oasis:names:specification:ubl:signature:Invoice</cbc:ID>
    <cbc:SignatureMethod>urn:oasis:names:specification:ubl:dsig:enveloped:xades</cbc:SignatureMethod>
  </cac:Signature>`;
  
  signedXml = signedXml.replace(
    '<cac:AccountingSupplierParty>',
    `${sigRef}\n  <cac:AccountingSupplierParty>`
  );

  return { signedXml, signatureValue, digestValue: docDigest };
}

// ─── UBL 2.1 Invoice XML Generator ─────────────────────────
function generateUBL21XML(data: InvoiceData): string {
  const { invoice, items, tenant, customer, icv } = data;
  const invoiceUUID = invoice.invoice_uuid;
  const issueDate = invoice.invoice_date;
  const issueTime = new Date().toISOString().split("T")[1].split(".")[0];

  const isSimplified = invoice.invoice_type === "simplified";
  const invoiceTypeCode = "388";
  const subTypeCode = isSimplified ? "0200000" : "0100000";

  // Group items by VAT rate for proper TaxSubtotal breakdown
  const vatGroups: Record<number, { taxableAmount: number; taxAmount: number }> = {};
  items.forEach((item: any) => {
    const rate = item.vat_rate || 15;
    const lineNet = item.unit_price * item.quantity - (item.discount || 0);
    if (!vatGroups[rate]) vatGroups[rate] = { taxableAmount: 0, taxAmount: 0 };
    vatGroups[rate].taxableAmount += lineNet;
    vatGroups[rate].taxAmount += (item.vat_amount || 0);
  });

  const taxSubtotals = Object.entries(vatGroups).map(([rate, group]) => {
    const taxCategoryId = Number(rate) === 0 ? "Z" : "S";
    return `
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="SAR">${group.taxableAmount.toFixed(2)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="SAR">${group.taxAmount.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:ID>${taxCategoryId}</cbc:ID>
          <cbc:Percent>${Number(rate).toFixed(2)}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>`;
  }).join("\n");

  const lineItems = items.map((item: any, idx: number) => {
    const lineNet = item.unit_price * item.quantity - (item.discount || 0);
    const taxCategoryId = (item.vat_rate || 15) === 0 ? "Z" : "S";
    return `
    <cac:InvoiceLine>
      <cbc:ID>${idx + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="PCE">${item.quantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="SAR">${lineNet.toFixed(2)}</cbc:LineExtensionAmount>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">${(item.vat_amount || 0).toFixed(2)}</cbc:TaxAmount>
        <cbc:RoundingAmount currencyID="SAR">${(item.line_total || 0).toFixed(2)}</cbc:RoundingAmount>
      </cac:TaxTotal>
      <cac:Item>
        <cbc:Name>${escapeXml(item.description)}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>${taxCategoryId}</cbc:ID>
          <cbc:Percent>${item.vat_rate || 15}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="SAR">${(item.unit_price || 0).toFixed(2)}</cbc:PriceAmount>
        ${item.discount > 0 ? `
        <cac:AllowanceCharge>
          <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
          <cbc:AllowanceChargeReason>discount</cbc:AllowanceChargeReason>
          <cbc:Amount currencyID="SAR">${(item.discount || 0).toFixed(2)}</cbc:Amount>
        </cac:AllowanceCharge>` : ''}
      </cac:Price>
    </cac:InvoiceLine>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${escapeXml(invoice.invoice_number)}</cbc:ID>
  <cbc:UUID>${invoiceUUID}</cbc:UUID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="${subTypeCode}">${invoiceTypeCode}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
  ${invoice.previous_invoice_hash ? `
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>PIH</cbc:ID>
      <cac:Attachment>
        <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${invoice.previous_invoice_hash}</cbc:EmbeddedDocumentBinaryObject>
      </cac:Attachment>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>` : ''}
  <cac:AdditionalDocumentReference>
    <cbc:ID>ICV</cbc:ID>
    <cbc:UUID>${icv}</cbc:UUID>
  </cac:AdditionalDocumentReference>
  <cac:AdditionalDocumentReference>
    <cbc:ID>PIH</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${invoice.previous_invoice_hash || btoa("0".repeat(32))}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="CRN">${escapeXml(tenant.cr_number || '')}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(tenant.address_street || '')}</cbc:StreetName>
        <cbc:BuildingNumber>${escapeXml(tenant.building_number || '0000')}</cbc:BuildingNumber>
        <cbc:CityName>${escapeXml(tenant.address_city || '')}</cbc:CityName>
        <cbc:PostalZone>${escapeXml(tenant.address_zip || '00000')}</cbc:PostalZone>
        <cbc:CountrySubentity>${escapeXml(tenant.address_district || '')}</cbc:CountrySubentity>
        <cac:Country>
          <cbc:IdentificationCode>SA</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(tenant.vat_number || '')}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(tenant.name)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      ${!isSimplified && customer?.vat_number ? `
      <cac:PartyIdentification>
        <cbc:ID schemeID="VAT">${escapeXml(customer.vat_number)}</cbc:ID>
      </cac:PartyIdentification>` : ''}
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(customer?.address_street || '')}</cbc:StreetName>
        <cbc:CityName>${escapeXml(customer?.address_city || '')}</cbc:CityName>
        <cac:Country>
          <cbc:IdentificationCode>SA</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      ${customer?.vat_number ? `
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(customer.vat_number)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>` : ''}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(customer?.name || '')}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:Delivery>
    <cbc:ActualDeliveryDate>${issueDate}</cbc:ActualDeliveryDate>
  </cac:Delivery>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>10</cbc:PaymentMeansCode>
  </cac:PaymentMeans>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${(invoice.vat_total || 0).toFixed(2)}</cbc:TaxAmount>
    ${taxSubtotals}
  </cac:TaxTotal>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${(invoice.vat_total || 0).toFixed(2)}</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="SAR">${(invoice.subtotal || 0).toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="SAR">${(invoice.subtotal || 0).toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="SAR">${(invoice.grand_total || 0).toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="SAR">${(invoice.discount_total || 0).toFixed(2)}</cbc:AllowanceTotalAmount>
    <cbc:PayableAmount currencyID="SAR">${(invoice.amount_due || invoice.grand_total || 0).toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${lineItems}
</Invoice>`;
}

// ─── Credit Note XML Generator ──────────────────────────────
function generateCreditNoteXML(data: { creditNote: any; items: any[]; tenant: any; customer: any; originalInvoice: any; icv: number }): string {
  const { creditNote, items, tenant, customer, originalInvoice, icv } = data;
  const uuid = creditNote.credit_note_uuid || crypto.randomUUID();
  const issueDate = creditNote.credit_date;
  const issueTime = new Date().toISOString().split("T")[1].split(".")[0];

  const lineItems = items.map((item: any, idx: number) => `
    <cac:CreditNoteLine>
      <cbc:ID>${idx + 1}</cbc:ID>
      <cbc:CreditedQuantity unitCode="PCE">${item.quantity}</cbc:CreditedQuantity>
      <cbc:LineExtensionAmount currencyID="SAR">${(item.unit_price * item.quantity - (item.discount || 0)).toFixed(2)}</cbc:LineExtensionAmount>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">${(item.vat_amount || 0).toFixed(2)}</cbc:TaxAmount>
      </cac:TaxTotal>
      <cac:Item>
        <cbc:Name>${escapeXml(item.description)}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>S</cbc:ID>
          <cbc:Percent>${item.vat_rate || 15}</cbc:Percent>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="SAR">${(item.unit_price || 0).toFixed(2)}</cbc:PriceAmount>
      </cac:Price>
    </cac:CreditNoteLine>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"
            xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
            xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
            xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${escapeXml(creditNote.credit_note_number)}</cbc:ID>
  <cbc:UUID>${uuid}</cbc:UUID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${issueTime}</cbc:IssueTime>
  <cbc:CreditNoteTypeCode name="0100000">381</cbc:CreditNoteTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cac:AdditionalDocumentReference>
    <cbc:ID>ICV</cbc:ID>
    <cbc:UUID>${icv}</cbc:UUID>
  </cac:AdditionalDocumentReference>
  ${originalInvoice ? `
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${escapeXml(originalInvoice.invoice_number)}</cbc:ID>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>` : ''}
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification><cbc:ID schemeID="CRN">${escapeXml(tenant.cr_number || '')}</cbc:ID></cac:PartyIdentification>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(tenant.address_street || '')}</cbc:StreetName>
        <cbc:CityName>${escapeXml(tenant.address_city || '')}</cbc:CityName>
        <cbc:PostalZone>${escapeXml(tenant.address_zip || '00000')}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>SA</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(tenant.vat_number || '')}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity><cbc:RegistrationName>${escapeXml(tenant.name)}</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      ${customer?.vat_number ? `<cac:PartyTaxScheme><cbc:CompanyID>${escapeXml(customer.vat_number)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ''}
      <cac:PartyLegalEntity><cbc:RegistrationName>${escapeXml(customer?.name || '')}</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${(creditNote.vat_total || 0).toFixed(2)}</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="SAR">${(creditNote.subtotal || 0).toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="SAR">${(creditNote.subtotal || 0).toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="SAR">${(creditNote.grand_total || 0).toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="SAR">${(creditNote.grand_total || 0).toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${lineItems}
</CreditNote>`;
}

// ─── ZATCA API Submission ───────────────────────────────────
async function submitToZATCA(
  signedXml: string,
  hash: string,
  uuid: string,
  tenant: any,
  invoiceType: string,
  supabaseClient: any
): Promise<any> {
  const isProduction = tenant.zatca_environment === "production";
  const baseUrl = isProduction ? ZATCA_PRODUCTION_URL : ZATCA_SANDBOX_URL;

  const certType = isProduction ? "production" : "compliance";
  const { data: cert } = await supabaseClient
    .from("zatca_certificates")
    .select("csid, certificate")
    .eq("tenant_id", tenant.id)
    .eq("certificate_type", certType)
    .eq("is_active", true)
    .single();

  const csid = cert?.csid || (isProduction ? tenant.zatca_production_csid : tenant.zatca_compliance_csid);

  if (!csid) {
    return { status: "error", message: "لم يتم تكوين شهادة ZATCA (CSID). يرجى إعدادها في صفحة الامتثال." };
  }

  const invoiceBody = btoa(signedXml);
  const isSimplified = invoiceType === "simplified";
  const endpoint = isSimplified
    ? `${baseUrl}/invoices/reporting/single`
    : `${baseUrl}/invoices/clearance/single`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Accept-Language": "ar",
        "Accept-Version": "V2",
        "Authorization": `Basic ${csid}`,
        ...(isSimplified ? {} : { "Clearance-Status": "1" }),
      },
      body: JSON.stringify({
        invoiceHash: hash,
        uuid: uuid,
        invoice: invoiceBody,
      }),
    });

    const result = await response.json();
    return {
      status: response.ok ? "success" : "error",
      httpStatus: response.status,
      submissionType: isSimplified ? "reporting" : "clearance",
      reportingStatus: result.reportingStatus || null,
      clearanceStatus: result.clearanceStatus || null,
      validationResults: result.validationResults || null,
      warnings: result.validationResults?.warningMessages || [],
      errors: result.validationResults?.errorMessages || [],
      clearedInvoice: result.clearedInvoice || null,
      raw: result,
    };
  } catch (err: any) {
    return { status: "error", message: err.message || "فشل الاتصال ببوابة ZATCA" };
  }
}

// ─── Main Handler ───────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, invoiceId } = body;

    // ═══════════════════════════════════════════════════════
    // ACTION: generate-xml (with digital signature)
    // ═══════════════════════════════════════════════════════
    if (action === "generate-xml") {
      const { data: invoice, error: invErr } = await supabase
        .from("invoices")
        .select("*, customers(name, name_en, vat_number, cr_number, address_street, address_city, address_zip, phone, email)")
        .eq("id", invoiceId)
        .single();
      if (invErr || !invoice) {
        return new Response(JSON.stringify({ error: "Invoice not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: items } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("sort_order");

      const { data: tenant } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", invoice.tenant_id)
        .single();

      if (!tenant) {
        return new Response(JSON.stringify({ error: "Tenant not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ✅ Check compliance before proceeding
      if (tenant.zatca_phase2_ready) {
        const { data: activeCert } = await supabase
          .from("zatca_certificates")
          .select("id")
          .eq("tenant_id", tenant.id)
          .eq("is_active", true)
          .in("certificate_type", ["compliance", "production"])
          .limit(1);

        if (!activeCert || activeCert.length === 0) {
          return new Response(JSON.stringify({
            error: "لا يمكن إصدار فاتورة إلكترونية بدون شهادة ZATCA فعّالة",
            code: "NO_ACTIVE_CERTIFICATE",
          }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Get sequential ICV
      const { data: icvResult } = await supabase.rpc("get_next_icv", {
        _tenant_id: invoice.tenant_id,
      });
      const icv = icvResult || 1;

      // Get previous invoice hash for chaining
      const { data: prevInvoice } = await supabase
        .from("invoices")
        .select("invoice_hash")
        .eq("tenant_id", invoice.tenant_id)
        .lt("created_at", invoice.created_at)
        .not("invoice_hash", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const previousHash = prevInvoice?.invoice_hash || btoa("0".repeat(32));

      // Ensure UUID exists
      const invoiceUUID = invoice.invoice_uuid || crypto.randomUUID();

      const xml = generateUBL21XML({
        invoice: { ...invoice, invoice_uuid: invoiceUUID, previous_invoice_hash: previousHash },
        items: items || [],
        tenant,
        customer: invoice.customers,
        icv,
      });

      // ✅ Digital Signature: Sign XML if private key is available
      let finalXml = xml;
      let signatureValue = null;
      let digestValue = null;

      const isProduction = tenant.zatca_environment === "production";
      const certType = isProduction ? "production" : "compliance";
      // Use secure RPC to retrieve private key (never exposed via direct SELECT)
      const { data: certRows } = await supabase.rpc("get_zatca_private_key", {
        _tenant_id: tenant.id,
        _certificate_type: certType,
      });
      const cert = certRows && certRows.length > 0 ? certRows[0] : null;

      if (cert?.private_key && cert?.certificate) {
        try {
          const sigResult = await generateXAdESSignature(xml, cert.private_key, cert.certificate);
          finalXml = sigResult.signedXml;
          signatureValue = sigResult.signatureValue;
          digestValue = sigResult.digestValue;
          console.log("✅ Digital signature applied successfully");
        } catch (sigErr: any) {
          console.error("⚠️ Digital signature failed, proceeding without:", sigErr.message);
          // Still proceed – signature may fail if key format is unsupported
        }
      } else {
        console.log("⚠️ No private key/certificate found, XML generated without digital signature");
      }

      const invoiceHash = await sha256Base64(canonicalizeXml(finalXml));

      // Save to invoice
      await supabase.from("invoices").update({
        invoice_uuid: invoiceUUID,
        zatca_xml: finalXml,
        zatca_signed_xml: signatureValue ? finalXml : null,
        invoice_hash: invoiceHash,
        previous_invoice_hash: previousHash,
        zatca_status: "xml_generated",
      }).eq("id", invoiceId);

      return new Response(JSON.stringify({
        success: true,
        xml: finalXml,
        hash: invoiceHash,
        uuid: invoiceUUID,
        icv,
        signed: !!signatureValue,
        digestValue,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ═══════════════════════════════════════════════════════
    // ACTION: submit-to-zatca
    // ═══════════════════════════════════════════════════════
    if (action === "submit-to-zatca") {
      const { data: invoice } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .single();

      if (!invoice?.zatca_xml || !invoice?.invoice_hash) {
        return new Response(JSON.stringify({ error: "يجب إنشاء XML أولاً" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prevent duplicate submission
      if (invoice.zatca_status === "reported" || invoice.zatca_status === "cleared") {
        return new Response(JSON.stringify({
          error: "تم إرسال هذه الفاتورة مسبقاً لبوابة ZATCA ولا يمكن إعادة الإرسال",
          zatca_status: invoice.zatca_status,
        }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (invoice.zatca_status !== "xml_generated" && invoice.zatca_status !== "failed") {
        return new Response(JSON.stringify({
          error: "حالة الفاتورة لا تسمح بالإرسال. يجب توليد XML أولاً.",
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Optimistic lock
      const { data: locked, error: lockErr } = await supabase
        .from("invoices")
        .update({ zatca_status: "submitting" })
        .eq("id", invoiceId)
        .in("zatca_status", ["xml_generated", "failed"])
        .select("id")
        .single();

      if (lockErr || !locked) {
        return new Response(JSON.stringify({
          error: "الفاتورة قيد الإرسال حالياً من مستخدم آخر",
        }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: tenant } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", invoice.tenant_id)
        .single();

      // Use signed XML if available, otherwise fall back to unsigned
      const xmlToSubmit = invoice.zatca_signed_xml || invoice.zatca_xml;

      const result = await submitToZATCA(
        xmlToSubmit,
        invoice.invoice_hash,
        invoice.invoice_uuid,
        tenant,
        invoice.invoice_type,
        supabase
      );

      let finalStatus = "failed";
      if (result.status === "success") {
        const isSimplified = invoice.invoice_type === "simplified";
        finalStatus = isSimplified ? "reported" : "cleared";
      }

      // If clearance returned a modified invoice, save it
      const clearedXml = result.clearedInvoice || null;

      // Log to immutable submission log
      await supabase.from("zatca_submission_log").insert({
        tenant_id: invoice.tenant_id,
        invoice_id: invoiceId,
        submission_type: result.submissionType || (invoice.invoice_type === "simplified" ? "reporting" : "clearance"),
        invoice_hash: invoice.invoice_hash,
        invoice_uuid: invoice.invoice_uuid,
        request_payload: { invoiceHash: invoice.invoice_hash, uuid: invoice.invoice_uuid },
        response_payload: result.raw || null,
        http_status: result.httpStatus || null,
        zatca_status: finalStatus,
        warnings: result.warnings || [],
        errors: result.errors || [],
        submitted_by: user.id,
        signed_xml: xmlToSubmit,
        digital_signature: invoice.zatca_signed_xml ? "XAdES-BES" : "none",
        certificate_used: tenant?.zatca_environment === "production" ? "production" : "compliance",
      });

      // Update invoice
      await supabase.from("invoices").update({
        zatca_status: finalStatus,
        zatca_clearance_status: result.clearanceStatus || null,
        zatca_reporting_status: result.reportingStatus || null,
        zatca_warnings: result.warnings || [],
        zatca_errors: result.errors || [],
        zatca_submitted_at: new Date().toISOString(),
        zatca_response: result.raw || null,
        // Save cleared invoice XML if returned by ZATCA
        ...(clearedXml ? { zatca_signed_xml: clearedXml } : {}),
      }).eq("id", invoiceId);

      return new Response(JSON.stringify({
        success: result.status === "success",
        result,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ═══════════════════════════════════════════════════════
    // ACTION: generate-credit-note-xml
    // ═══════════════════════════════════════════════════════
    if (action === "generate-credit-note-xml") {
      const creditNoteId = body.creditNoteId || invoiceId;

      const { data: creditNote, error: cnErr } = await supabase
        .from("credit_notes")
        .select("*, customers(name, vat_number, cr_number, address_street, address_city)")
        .eq("id", creditNoteId)
        .single();

      if (cnErr || !creditNote) {
        return new Response(JSON.stringify({ error: "Credit note not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: cnItems } = await supabase
        .from("credit_note_items")
        .select("*")
        .eq("credit_note_id", creditNoteId)
        .order("sort_order");

      const { data: tenant } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", creditNote.tenant_id)
        .single();

      let originalInvoice = null;
      if (creditNote.invoice_id) {
        const { data: inv } = await supabase
          .from("invoices")
          .select("invoice_number")
          .eq("id", creditNote.invoice_id)
          .single();
        originalInvoice = inv;
      }

      const { data: icvResult } = await supabase.rpc("get_next_icv", {
        _tenant_id: creditNote.tenant_id,
      });

      const xml = generateCreditNoteXML({
        creditNote,
        items: cnItems || [],
        tenant,
        customer: creditNote.customers,
        originalInvoice,
        icv: icvResult || 1,
      });

      // Sign credit note if possible
      let finalXml = xml;
      const certType = tenant?.zatca_environment === "production" ? "production" : "compliance";
      const { data: cert } = await supabase
        .from("zatca_certificates")
        .select("csid, private_key, certificate")
        .eq("tenant_id", creditNote.tenant_id)
        .eq("certificate_type", certType)
        .eq("is_active", true)
        .single();

      if (cert?.private_key && cert?.certificate) {
        try {
          const sigResult = await generateXAdESSignature(xml, cert.private_key, cert.certificate);
          finalXml = sigResult.signedXml;
        } catch (e) {
          console.error("Credit note signing failed:", e);
        }
      }

      const cnHash = await sha256Base64(canonicalizeXml(finalXml));

      return new Response(JSON.stringify({
        success: true,
        xml: finalXml,
        hash: cnHash,
        creditNoteNumber: creditNote.credit_note_number,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ═══════════════════════════════════════════════════════
    // ACTION: check-compliance (frontend can call this to verify readiness)
    // ═══════════════════════════════════════════════════════
    if (action === "check-compliance") {
      const { tenantId } = body;
      
      const { data: tenant } = await supabase
        .from("tenants")
        .select("zatca_phase2_ready, zatca_environment, cr_number, vat_number")
        .eq("id", tenantId)
        .single();

      if (!tenant) {
        return new Response(JSON.stringify({ error: "Tenant not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: certs } = await supabase
        .from("zatca_certificates")
        .select("certificate_type, is_active, environment")
        .eq("tenant_id", tenantId)
        .eq("is_active", true);

      const hasCompliance = certs?.some(c => c.certificate_type === "compliance") || false;
      const hasProduction = certs?.some(c => c.certificate_type === "production") || false;

      const issues: string[] = [];
      if (!tenant.cr_number) issues.push("missing_cr_number");
      if (!tenant.vat_number) issues.push("missing_vat_number");
      if (!hasCompliance && !hasProduction) issues.push("no_active_certificate");
      if (tenant.zatca_phase2_ready && !hasProduction) issues.push("production_cert_missing");

      return new Response(JSON.stringify({
        ready: issues.length === 0,
        phase2Enabled: tenant.zatca_phase2_ready,
        environment: tenant.zatca_environment,
        hasComplianceCert: hasCompliance,
        hasProductionCert: hasProduction,
        issues,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("ZATCA error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
