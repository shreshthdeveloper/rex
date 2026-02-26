import PolicyPageLayout from '../components/common/PolicyPageLayout';

const content = `
IMPORTANT — WHOLESALE SITE / 18+ ONLY
THIS IS A WHOLESALE SITE ONLY AND YOU MUST BE OVER 18 TO ENTER.

Phantom Distribution’s catalog and website are intended for wholesale customers who are 18 years of age or older. All customers are required to provide a tax/resale identification number prior to their first order.

NOTICE TO OUR CUSTOMERS
Seller is not liable for any incidental, consequential or special damages, interest, costs or expenses, or for loss of use, loss of data or lost profits or wages, whether or not Seller knew such damages might be incurred. Seller’s liability is in all cases limited to refunding the purchase price or current value of the services, at Seller’s option.

In the event it becomes necessary for the Seller to incur any collection costs or suits to collect payment, the Buyer will be responsible for all such costs, including but not limited to court costs, attorney fees and collection agency fees on said collection/suit.

Phantom Distribution warrants to you that Phantom Distribution shall use its reasonable endeavors to provide the services with reasonable care and skill and, as far as reasonably possible, in accordance with your request and instructions from time to time. Where Phantom Distribution supplies you with any goods or services supplied by a third party, then Phantom Distribution is acting as your agent in sourcing the goods or services. Phantom Distribution will use reasonable care in selecting the supplier and ensuring the order is placed in accordance with your wishes.

All sales are final, unless otherwise agreed by the supplier, vendor or partner, you shall not be entitled to cancel the service requested where, on your instructions, performance has already begun.

Phantom Distribution is not liable for any incidental, consequential or special damages, interest, costs or expenses, or for loss of use, loss of data or lost profits or wages from the sale, use or consumption of the products sold, whether or not Phantom Distribution knew such damages might be incurred. Phantom Distribution’s liability is in all cases limited exclusively to refunding the purchase price or current value of the products, at Phantom Distribution’s discretion.

Taxes & Exemptions
Laws governing taxes & exemptions vary, and you will be held liable for any tax, interest, and possible penalties imposed by your local jurisdiction if your purchase is not legally exempt or if you fail to pay any due tax. To determine what tax & exemptions are applicable in your particular jurisdiction, please refer to your local tax agency.

New Accounts
New accounts can be created by registering online or by contacting a Sales Account Manager. Initial terms for USA and Canada accounts will be credit card payment. Other international accounts will require wire transfer payment.

Payment Methods
Other methods - such as COD Secure, COD Check. Credit applications are available upon request and may take up to 2 weeks to process. Accepted payment methods include Visa, MasterCard, Discover, American Express, Wire Transfer, COD Company Check, or COD Secure Payment. Certain orders are subject to review for limited payment options. Your sales rep will let you know when this is required. All prices and payments are in US Dollars (USD).

Shipping
Our goal is to ship every order within 1 business days. We will make every attempt to meet that goal, but Phantom Distribution is not liable for shipping delays due to unforeseen circumstances, weather or natural disaster, carrier demand or disputes, domestic/international customs or embargos, or seasonal shipping demand. Special or custom orders may require additional lead time.

Shipping Estimates:

Shipping estimates are subject to change based on requested method, destination, product weight and dimensions, or other factors. Shipping estimates do not include COD or Hazmat fees. Orders outside the contiguous United States may require alternate shipping methods. Please contact your Sales Account Manager for more details.

Expedited Shipping: Our process for all Expedited Shipments allows for orders placed prior to 3:00pm (Noon) EST. to be guaranteed to ship by the end of the following business day. Exceptions may include orders totaling over $7500 or orders with specific items associated. Please call your Sales Account Manager for further details.

Shipping Methods
All domestic orders are shipped UPS Ground, all Canada orders are shipped UPS Standard, and all other International orders are shipped UPS Expedited unless otherwise requested. Local customers can arrange pick up at our Asheville warehouse. Customers are responsible for all freight, COD, hazmat, insurance, handling charges, and import fees, taxes, duties, customs charges, etc. associated with international shipments.

Hazmat Shipping Information
All orders containing hazardous materials will incur an additional fee of $33.00 per box containing hazardous materials as charged by UPS and FedEx. Please note that the hazardous materials fee is charged per box. Phantom Distribution will always pack Hazardous Materials in the fewest number of boxes allowable. Phantom Distribution will only ship Hazardous Materials within the 48 contiguous United States under the D.O.T. Code of Federal Regulations, as outlined in Title 49, Parts 100-185 on Transportation (49 C.F.R.).

Hazmat Returns:

Due to Federal shipping regulations, it is illegal for you to return hazardous materials to Phantom Distribution, unless you are an authorized, licensed carrier. Notify Phantom Distribution of any shortages, overcharges, damaged items, or other issues within 5 business days of receiving your shipment. Phantom Distribution will issue credit for approved defects reported within this time frame.

Refused Orders
All refused or unclaimed orders will result in a 15% restocking fee plus all freight charges. If the customer would like the order reshipped, all additional freight charges will be added. If the fault of Phantom Distribution, refused orders will be fully credited or reshipped at our expense.

Return Policy
Only manufacturer defects or items damaged during shipping will be authorized for full credit. All returns must be accompanied by a Return Authorization Number. Damaged or missing items must be reported within 48 hours of delivery. Unless the fault of Phantom Distribution, all returned items will incur a restocking fee of 15%, and the customer will be responsible for any shipping charges. Unauthorized returns will not be credited or reshipped.

Perishable Items Return Policy:

Phantom Distribution will not accept any returns or issue credit on perishable products from our customers.

Price Changes
All prices shown are wholesale prices that are subject to change without notice. Sale prices may expire and cannot be combined with any other discounts, coupons, or offers. Phantom Distribution is not responsible for typographical errors appearing in this catalog, on our website, or in any other publications.

Damages & Shortages
Any order discrepancies must be reported within 5 business days of delivery. If your boxes appear to be opened, re-taped, damaged, or tampered with, keep the original boxes and file a claim with the carrier. If your order arrives in good condition but contains damages, shortages, or overages, please contact your Sales Account Manager to file a claim.

There may be items in this catalog that could be restricted in your city, county, or state. It is the customers’ obligation to check local laws before ordering.

Other Information
Wholesale Only: We're strictly wholesale. We can only sell to you if you've got a Tax or Resale ID.

Payment Methods: Visa, Mastercard, Discover, American Express, COD Company Check, COD Secure Payment, or Wire Transfer.

Late Fees: Phantom Distribution reserves the right to charge a 10% late fee if this invoice is not paid in full within 5 days of the due date.

International Orders: Not in the United States? Please call or e-mail for shipping details.

Contact
Terms & Conditions are encouraged to contact a Sales Account Manager by email or by phone during normal business hours. All rights reserved by Phantom Distribution. Phantom Distribution does not allow reproduction of material in part, or in whole, unless authorized by Phantom through written or notarized documentation. All advertising and advertised products are void where prohibited.

By doing business with Phantom Distribution, you hereby agree to these terms & conditions and declare any information you provide is correct and complete.
`;

const paragraphs = content.split('\n\n').map(p => p.trim()).filter(Boolean);

export default function TermsConditionsPage() {
  const sections = paragraphs.map((para, i) => ({ paragraphs: [para], title: i === 0 ? 'Terms & Conditions' : undefined }));
  return <PolicyPageLayout title="Terms & Conditions" subtitle="Last updated: February 2026" sections={sections} />;
}
