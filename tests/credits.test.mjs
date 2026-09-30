import test from 'node:test';
import assert from 'node:assert/strict';

// Test pure credit and ledger accounting logic in isolation

function simulateLedger() {
  let balance = 10;
  const transactions = [
    {
      id: 'tx-seed',
      user_id: 'user-1',
      job_id: null,
      transaction_type: 'seed',
      amount: 10,
      description: 'Initial seed',
    },
  ];

  function reserve(jobId) {
    if (balance < 1) {
      return { success: false, error: 'Insufficient credits' };
    }
    balance -= 1;
    transactions.push({
      id: `tx-res-${jobId}`,
      user_id: 'user-1',
      job_id: jobId,
      transaction_type: 'reserve',
      amount: -1,
      description: 'Reservation',
    });
    return { success: true };
  }

  function refund(jobId, reason) {
    // Idempotency check: exactly one refund per job
    const alreadyRefunded = transactions.some(
      (tx) => tx.job_id === jobId && tx.transaction_type === 'refund'
    );
    if (alreadyRefunded) {
      return { refunded: false, message: 'Already refunded' };
    }

    const hasReservation = transactions.some(
      (tx) => tx.job_id === jobId && tx.transaction_type === 'reserve'
    );
    if (!hasReservation) {
      return { refunded: false, message: 'No reservation to refund' };
    }

    balance += 1;
    transactions.push({
      id: `tx-ref-${jobId}`,
      user_id: 'user-1',
      job_id: jobId,
      transaction_type: 'refund',
      amount: 1,
      description: `Refund: ${reason}`,
    });
    return { refunded: true, message: 'Refund applied' };
  }

  return {
    getBalance: () => balance,
    getTransactions: () => [...transactions],
    reserve,
    refund,
  };
}

test('Initial wallet is seeded with exactly 10 credits', () => {
  const ledger = simulateLedger();
  assert.equal(ledger.getBalance(), 10);
  assert.equal(ledger.getTransactions().length, 1);
  assert.equal(ledger.getTransactions()[0].transaction_type, 'seed');
});

test('Reserving a credit deducts 1 from balance and records reserve transaction', () => {
  const ledger = simulateLedger();
  const res = ledger.reserve('job-1');
  assert.equal(res.success, true);
  assert.equal(ledger.getBalance(), 9);

  const txs = ledger.getTransactions();
  assert.equal(txs.length, 2);
  assert.equal(txs[1].transaction_type, 'reserve');
  assert.equal(txs[1].amount, -1);
});

test('Refunding an existing job returns 1 credit and is strictly idempotent', () => {
  const ledger = simulateLedger();
  ledger.reserve('job-1');
  assert.equal(ledger.getBalance(), 9);

  // First refund succeeds
  const refund1 = ledger.refund('job-1', 'Simulated failure');
  assert.equal(refund1.refunded, true);
  assert.equal(ledger.getBalance(), 10);

  // Second refund for same job fails due to idempotency
  const refund2 = ledger.refund('job-1', 'Simulated failure repeat');
  assert.equal(refund2.refunded, false);
  assert.equal(ledger.getBalance(), 10); // Balance stays 10, no double refund!
});

test('Cannot reserve if wallet balance drops below 1', () => {
  const ledger = simulateLedger();
  // Consume all 10 credits
  for (let i = 1; i <= 10; i++) {
    const res = ledger.reserve(`job-${i}`);
    assert.equal(res.success, true);
  }
  assert.equal(ledger.getBalance(), 0);

  // 11th reservation fails
  const res11 = ledger.reserve('job-11');
  assert.equal(res11.success, false);
  assert.match(res11.error, /Insufficient credits/);
});
