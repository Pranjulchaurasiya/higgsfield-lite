import { supabase, DEMO_USER_ID } from './supabase';

export interface CreditTransaction {
  id: string;
  user_id: string;
  job_id: string | null;
  transaction_type: 'seed' | 'reserve' | 'refund';
  amount: number;
  description: string | null;
  created_at: string;
}

interface MockLedgerState {
  balance: number;
  transactions: CreditTransaction[];
}

// In-memory fallback ledger when Supabase tables are not yet migrated
const globalMemoryStore = globalThis as unknown as {
  _mockLedger?: MockLedgerState;
};

if (!globalMemoryStore._mockLedger) {
  globalMemoryStore._mockLedger = {
    balance: 10,
    transactions: [
      {
        id: 'seed-tx-001',
        user_id: DEMO_USER_ID,
        job_id: null,
        transaction_type: 'seed',
        amount: 10,
        description: 'Seeded demo creator grant (MOCK)',
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
    ],
  };
}

const mockLedger = globalMemoryStore._mockLedger;

export async function getCreditBalance(userId: string = DEMO_USER_ID): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('demo_users')
      .select('credit_balance')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return mockLedger.balance;
    }
    return data.credit_balance;
  } catch {
    return mockLedger.balance;
  }
}

export async function getCreditLedger(userId: string = DEMO_USER_ID): Promise<{ balance: number; transactions: CreditTransaction[] }> {
  try {
    const [balanceRes, txRes] = await Promise.all([
      supabase.from('demo_users').select('credit_balance').eq('id', userId).single(),
      supabase.from('credit_transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    ]);

    if (balanceRes.error || txRes.error) {
      return { balance: mockLedger.balance, transactions: [...mockLedger.transactions] };
    }

    const balance = balanceRes.data?.credit_balance ?? 10;
    const transactions = txRes.data ?? [];
    return { balance, transactions };
  } catch {
    return { balance: mockLedger.balance, transactions: [...mockLedger.transactions] };
  }
}

export async function reserveCredit(jobId: string, userId: string = DEMO_USER_ID): Promise<{ success: boolean; error?: string }> {
  try {
    // Check balance first
    const { data: user, error: userErr } = await supabase
      .from('demo_users')
      .select('credit_balance')
      .eq('id', userId)
      .single();

    if (userErr || !user) {
      // Memory store fallback
      if (mockLedger.balance < 1) {
        return { success: false, error: 'Insufficient demo credits. Minimum 1 credit required.' };
      }
      mockLedger.balance -= 1;
      mockLedger.transactions.unshift({
        id: `mock-res-${Date.now()}`,
        user_id: userId,
        job_id: jobId,
        transaction_type: 'reserve',
        amount: -1,
        description: 'Generation reservation (1 image)',
        created_at: new Date().toISOString(),
      });
      return { success: true };
    }

    if (user.credit_balance < 1) {
      return { success: false, error: 'Insufficient demo credits. Minimum 1 credit required.' };
    }

    // Deduct 1 credit
    const { error: updateErr } = await supabase
      .from('demo_users')
      .update({ credit_balance: user.credit_balance - 1, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .gte('credit_balance', 1);

    if (updateErr) {
      return { success: false, error: 'Could not reserve credit (concurrency check failed)' };
    }

    // Record transaction in ledger
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      job_id: jobId,
      transaction_type: 'reserve',
      amount: -1,
      description: 'Generation reservation (1 image)',
    });

    return { success: true };
  } catch {
    if (mockLedger.balance < 1) {
      return { success: false, error: 'Insufficient demo credits. Minimum 1 credit required.' };
    }
    mockLedger.balance -= 1;
    mockLedger.transactions.unshift({
      id: `mock-res-${Date.now()}`,
      user_id: userId,
      job_id: jobId,
      transaction_type: 'reserve',
      amount: -1,
      description: 'Generation reservation (1 image)',
      created_at: new Date().toISOString(),
    });
    return { success: true };
  }
}

export async function refundCredit(
  jobId: string,
  reason: string,
  userId: string = DEMO_USER_ID
): Promise<{ refunded: boolean; message: string }> {
  try {
    // Check if this job has already been refunded (Strict Idempotency)
    const { data: existingRefund, error: checkErr } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('job_id', jobId)
      .eq('transaction_type', 'refund')
      .maybeSingle();

    if (checkErr) {
      // Memory store fallback
      const alreadyRefunded = mockLedger.transactions.some(
        (tx) => tx.job_id === jobId && tx.transaction_type === 'refund'
      );
      if (alreadyRefunded) {
        return { refunded: false, message: 'Refund already applied for this job' };
      }
      const hadReservation = mockLedger.transactions.some(
        (tx) => tx.job_id === jobId && tx.transaction_type === 'reserve'
      );
      if (!hadReservation) {
        return { refunded: false, message: 'No reservation found to refund' };
      }

      mockLedger.balance += 1;
      mockLedger.transactions.unshift({
        id: `mock-ref-${Date.now()}`,
        user_id: userId,
        job_id: jobId,
        transaction_type: 'refund',
        amount: 1,
        description: `Refund: ${reason}`,
        created_at: new Date().toISOString(),
      });
      return { refunded: true, message: 'Credit refunded successfully' };
    }

    if (existingRefund) {
      return { refunded: false, message: 'Refund already applied for this job' };
    }

    // Verify that a reserve transaction actually exists for this job
    const { data: reserveTx } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('job_id', jobId)
      .eq('transaction_type', 'reserve')
      .maybeSingle();

    if (!reserveTx) {
      return { refunded: false, message: 'No reservation found to refund' };
    }

    // Increment credit balance by 1
    const { data: user } = await supabase
      .from('demo_users')
      .select('credit_balance')
      .eq('id', userId)
      .single();

    const currentBalance = user?.credit_balance ?? 0;
    await supabase
      .from('demo_users')
      .update({ credit_balance: currentBalance + 1, updated_at: new Date().toISOString() })
      .eq('id', userId);

    // Insert refund transaction
    const { error: txErr } = await supabase.from('credit_transactions').insert({
      user_id: userId,
      job_id: jobId,
      transaction_type: 'refund',
      amount: 1,
      description: `Refund: ${reason}`,
    });

    if (txErr) {
      console.error('Error recording refund transaction:', txErr);
    }

    return { refunded: true, message: 'Credit refunded successfully' };
  } catch {
    const alreadyRefunded = mockLedger.transactions.some(
      (tx) => tx.job_id === jobId && tx.transaction_type === 'refund'
    );
    if (alreadyRefunded) {
      return { refunded: false, message: 'Refund already applied for this job' };
    }
    const hadReservation = mockLedger.transactions.some(
      (tx) => tx.job_id === jobId && tx.transaction_type === 'reserve'
    );
    if (!hadReservation) {
      return { refunded: false, message: 'No reservation found to refund' };
    }

    mockLedger.balance += 1;
    mockLedger.transactions.unshift({
      id: `mock-ref-${Date.now()}`,
      user_id: userId,
      job_id: jobId,
      transaction_type: 'refund',
      amount: 1,
      description: `Refund: ${reason}`,
      created_at: new Date().toISOString(),
    });
    return { refunded: true, message: 'Credit refunded successfully' };
  }
}
