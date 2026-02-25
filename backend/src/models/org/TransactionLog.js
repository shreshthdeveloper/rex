const mongoose = require('mongoose');

const transactionLogSchema = new mongoose.Schema(
  {
    // What happened
    eventType: {
      type: String,
      enum: [
        // Customer events
        'sale_invoice',
        'sale_payment',
        'sale_credit_note',
        'sale_debit_note',
        'customer_topup',
        'customer_adjustment',
        'customer_opening',
        // Supplier events
        'purchase_invoice',
        'purchase_payment',
        'purchase_credit_note',
        'supplier_adjustment',
        'supplier_opening',
      ],
      required: true,
    },

    // Who is this about
    partyType: { type: String, enum: ['customer', 'supplier'], required: true },
    partyId: { type: mongoose.Schema.Types.ObjectId, required: true },
    partyName: { type: String, default: '' },

    // Source document
    sourceType: {
      type: String,
      enum: [
        'order', 'order_payment', 'order_return', 'grn',
        'supplier_payment', 'purchase_return',
        'customer_topup', 'supplier_adjustment', 'manual',
      ],
      required: true,
    },
    sourceId: { type: mongoose.Schema.Types.ObjectId },
    sourceNumber: { type: String, default: '' },

    // Money
    amount: { type: Number, required: true },
    direction: { type: String, enum: ['in', 'out'], required: true },

    // Context
    narration: { type: String, default: '' },
    paymentMethod: { type: String, default: '' },

    // Linked ledger entry
    ledgerEntryId: { type: mongoose.Schema.Types.ObjectId },

    // Audit
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Immutable — block every mutation route
const IMMUTABLE_MSG = 'Transaction log entries are immutable';
transactionLogSchema.pre('findOneAndUpdate', function () { throw new Error(IMMUTABLE_MSG); });
transactionLogSchema.pre('updateOne', function () { throw new Error(IMMUTABLE_MSG); });
transactionLogSchema.pre('updateMany', function () { throw new Error(IMMUTABLE_MSG); });
transactionLogSchema.pre('replaceOne', function () { throw new Error(IMMUTABLE_MSG); });
transactionLogSchema.pre('findOneAndReplace', function () { throw new Error(IMMUTABLE_MSG); });
transactionLogSchema.pre('deleteOne', function () { throw new Error(IMMUTABLE_MSG); });
transactionLogSchema.pre('deleteMany', function () { throw new Error(IMMUTABLE_MSG); });
transactionLogSchema.pre('findOneAndDelete', function () { throw new Error(IMMUTABLE_MSG); });

transactionLogSchema.index({ partyType: 1, partyId: 1, createdAt: -1 });
transactionLogSchema.index({ eventType: 1, createdAt: -1 });
transactionLogSchema.index({ sourceType: 1, sourceId: 1 });
transactionLogSchema.index({ createdAt: -1 });

module.exports = transactionLogSchema;
