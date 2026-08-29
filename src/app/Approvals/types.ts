/** An operation that was recorded instead of performed, because its target asks for two people. */
export interface ApprovalRaised {
  id: number;
  /**
   * Always true, and the field the browser branches on.
   *
   * <p>A 202 and a 200 both arrive as a resolved promise, so what separates "recorded" from "done"
   * has to be in the body — and a field that says so is easier to get right than a rule about
   * which fields are absent.
   */
  awaitingApproval: true;
  kind: string;
  connectionName: string | null;
  expiresAt: string;
  message: string;
}

/** Whether an answer that came back is a result or a request for somebody else's agreement. */
export const wasRecorded = <T extends object>(
  answer: T | ApprovalRaised,
): answer is ApprovalRaised => (answer as ApprovalRaised).awaitingApproval === true;

export type ApprovalState =
  'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'DECLINED' | 'WITHDRAWN' | 'EXPIRED';

/** One request, as the page reads it. */
export interface ApprovalSummary {
  id: number;
  kind: string;
  state: ApprovalState;
  connectionId: number;
  connectionName: string | null;
  secondConnectionId: number | null;
  secondConnectionName: string | null;
  /** What it would do, in a sentence written by the server from what was stored. */
  summary: string;
  /** What a sentence cannot hold: the first key names, the cadence, the shaping. */
  particulars: string[];
  requestedBy: string | null;
  requestedAt: string;
  expiresAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  detail: string | null;
  /** Whether the caller is the person who asked, which is who may withdraw it. */
  mine: boolean;
  /** Whether the caller may answer it, which is never their own. */
  canDecide: boolean;
}
