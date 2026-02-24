/**
 * Auto-incrementing counter service for generating sequential numbers.
 * Uses a 'counters' collection per org DB.
 */

const getNextSequence = async (models, counterName, prefix = '', padLength = 5) => {
  const Counter = models.Counter;
  const counter = await Counter.findByIdAndUpdate(
    counterName,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  const num = String(counter.seq).padStart(padLength, '0');
  return `${prefix}${num}`;
};

module.exports = { getNextSequence };
