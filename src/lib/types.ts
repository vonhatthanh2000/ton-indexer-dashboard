// Shapes returned by ton-observer (plans/authorization-plan.md; `GET {API}/docs` has every field).

// ---- who is signed in ---------------------------------------------------------------------

/** A role on one project. `admin` is what an admin sees on a project they are not a member of. */
export type ProjectRole = "owner" | "editor" | "viewer" | "admin";

/** The roles a member can be given. */
export type MemberRole = "owner" | "editor" | "viewer";

export interface MeUser {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
  hasPassword: boolean;
}

export interface MyProjectRef {
  id: string;
  name: string;
  role: ProjectRole;
}

/** `GET /auth/me`. */
export interface Me {
  user: MeUser;
  projects: MyProjectRef[];
}

// ---- members and invites ------------------------------------------------------------------

export interface Member {
  userId: string;
  email: string;
  name: string | null;
  role: MemberRole;
}

/** `GET /projects/:id/members`. */
export interface MembersReply {
  members: Member[];
}

/** `invite.sent: false`: the action succeeded but the email was not sent. */
export interface InviteResult {
  sent: boolean;
}

/** `PUT /projects/:id/members` and `POST /projects/:id/owners`. */
export interface MemberChangeReply {
  member: { userId: string; email: string; role: MemberRole };
  invite: InviteResult;
}

/** `POST /projects/:id/members/:userId/invite`. */
export interface ResendInviteReply {
  invite: InviteResult;
}

// ---- admin --------------------------------------------------------------------------------

export interface OwnerRef {
  userId: string;
  email: string;
}

export interface AdminProject {
  id: string;
  name: string;
  createdAt: string;
  owners: OwnerRef[];
  activeAccounts: number;
  hasApiKey: boolean;
}

/** `GET /projects` (admin). */
export interface AdminProjectsReply {
  projects: AdminProject[];
}

/** `POST /projects` (admin), 201. */
export interface CreatedProjectReply {
  project: ProjectView;
  owner: OwnerRef;
  invite: InviteResult;
}

/** `POST /users` (admin), 201 or 200. */
export interface AdminUserReply {
  user: { id: string; email: string; isAdmin: true };
}

/** `POST /projects/:id/api-key` (owner): shown once. */
export interface ApiKeyReply {
  apiKey: string;
}

// ---- projects and addresses ---------------------------------------------------------------

export interface ProjectView {
  id: string;
  name: string;
  createdAt: string;
}

export type SourceState = "live" | "resyncing";

/** A row of `GET /projects/:id/addresses`. */
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

/** `POST /projects/:id/addresses` replies with `{ addresses: RegisteredAddress[] }`. */
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

/** GraphQL `project(id:)`. */
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
