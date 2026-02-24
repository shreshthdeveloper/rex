/**
 * Transaction helper that gracefully handles standalone MongoDB (no replica set).
 *
 * Usage:
 *   const { result } = await withTransaction(connection, async (session) => {
 *     // ... your transactional ops using session ...
 *     return someValue;
 *   });
 *
 * If transactions are supported (replica set / mongos), operations run inside
 * a proper ACID transaction. On standalone MongoDB, the callback runs without
 * a session so the code still works (just without atomicity guarantees).
 */

let _txnSupported = null; // cache across invocations

const withTransaction = async (connection, cb) => {
  // Fast-path: if we already know transactions are unsupported, skip session
  if (_txnSupported === false) {
    const result = await cb(null);
    return { result };
  }

  const session = await connection.startSession();
  try {
    session.startTransaction();
    const result = await cb(session);
    await session.commitTransaction();
    if (_txnSupported === null) _txnSupported = true;
    return { result };
  } catch (err) {
    // Detect "not a replica set" errors
    const isStandaloneErr =
      err.code === 20 ||
      (err.message && err.message.includes('Transaction numbers are only allowed on'));

    if (isStandaloneErr && _txnSupported === null) {
      // Mark as unsupported, retry without session
      _txnSupported = false;
      session.endSession();
      const result = await cb(null);
      return { result };
    }

    try { await session.abortTransaction(); } catch { /* already aborted */ }
    throw err;
  } finally {
    if (session.hasEnded === false || !session.hasEnded) {
      try { session.endSession(); } catch { /* ignore */ }
    }
  }
};

module.exports = { withTransaction };
