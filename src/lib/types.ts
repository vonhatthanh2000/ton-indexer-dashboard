// Shapes returned by ton-observer (dashboard-spec.md §1).

export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  activeAccounts: number;
}

export interface ProjectView {
  id: string;
  name: string;
  createdAt: string;
}

export interface IssuedKeyReply {
  project: ProjectView;
  apiKey: string;
}

export type SourceState = "live" | "resyncing";

export interface AdminAddress {
  address: string;
  sourceId: string;
  state: SourceState;
  startLt: string | null;
  lastLt: string | null;
  stillSyncing: boolean;
  lastError: string | null;
}

export interface AddressPage {
  addresses: AdminAddress[];
  limit: number;
  offset: number;
}

export interface RegisteredAddress {
  address: string;
  sourceId: string;
  created: boolean;
  linked: boolean;
  stillSyncing: boolean;
}

export interface ProjectAddress {
  address: string;
  state: SourceState;
  startLt: string | null;
  lastLt: string | null;
  stillSyncing: boolean;
}

export interface MyProject {
  id: string;
  name: string;
  addresses: ProjectAddress[];
}

export interface OutMessage {
  destination: string | null;
  value: string | null;
  opcode: string | null;
}

export interface Transaction {
  hash: string;
  lt: string;
  utime: string;
  time: string;
  traceId: string | null;
  inMsgOpcode: string | null;
  sender: string | null;
  value: string | null;
  aborted: boolean | null;
  fee: string | null;
  outMsgs: OutMessage[];
}

/** A transaction with the tracked address it was read for. */
export interface FeedTransaction extends Transaction {
  account: string;
}

export type HealthState = "online" | "database_down" | "unreachable";

export interface SessionInfo {
  role: "admin" | "project";
  projectId?: string;
  projectName?: string;
}
