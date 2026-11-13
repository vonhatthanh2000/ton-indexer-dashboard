"use client";

import { MailPlus, ShieldPlus, UserMinus, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/page-header";
import { Button, Card, CardHeader, DataTable, Dialog, EmptyState, ErrorState, Field, Input, Pill, RolePill, Select, SkeletonRows } from "@/components/ui";
import { useAddOwner, useMembers, useOnRoleDenied, usePutMember, useRefreshRoles, useRemoveMember, useResendInvite } from "@/features/project/hooks";
import { useProjectScope } from "@/features/project/scope";
import { projectBase } from "@/features/project/tx-parts";
import { ApiError, errorCode } from "@/lib/client";
import { errorText } from "@/lib/errors";
import { can } from "@/lib/roles";
import type { Member, MemberRole } from "@/lib/types";
import { notifyInvite, notifyResent } from "./invite-toast";

const ROLES: { value: MemberRole; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
];

type FieldName = "email" | "role";

function failureText(caught: unknown): string {
  if (caught instanceof ApiError) {
    return errorText({ code: caught.code, field: caught.field, index: caught.index, problem: caught.problem });
  }
  return errorText({ code: errorCode(caught) });
}

/** After the caller changed their own membership: refresh roles, and leave if the project is gone. */
function useAfterSelfChange() {
  const refreshRoles = useRefreshRoles();
  const router = useRouter();
  const { projectId } = useProjectScope();
  return async () => {
    const me = await refreshRoles();
    if (me && !me.projects.some((project) => project.id === projectId)) router.push("/");
  };
}

function EmailDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  withRole,
  busy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  submitLabel: string;
  withRole: boolean;
  busy: boolean;
  /** Resolves to an error text to show, or null when done. */
  onSubmit: (email: string, role: MemberRole) => Promise<{ field?: FieldName; text: string } | null>;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("viewer");
  const [error, setError] = useState<{ field?: FieldName; text: string } | null>(null);
  const formId = `${title.replace(/\W+/g, "-").toLowerCase()}-form`;

  function close(next: boolean) {
    if (!next) {
      setEmail("");
      setRole("viewer");
      setError(null);
    }
    onOpenChange(next);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError({ field: "email", text: "Enter an email address." });
      return;
    }
    const failed = await onSubmit(trimmed, role);
    if (failed) setError(failed);
    else close(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={title}
      description={description}
      footer={
        <>
          <Button onClick={() => close(false)}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary" busy={busy}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-5">
        <Field label="Email" error={error?.field === "email" ? error.text : undefined}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="email"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
        {withRole ? (
          <Field label="Role" error={error?.field === "role" ? error.text : undefined}>
            {({ id, describedBy }) => (
              <Select id={id} value={role} onChange={(event) => setRole(event.target.value as MemberRole)} aria-describedby={describedBy}>
                {ROLES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}
        {error && !error.field ? (
          <p className="field-error mt-0" role="alert">
            {error.text}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

/** `/projects/[id]/members`: everyone sees the list; owners manage it; admins add owners. */
export function MembersPage() {
  const { projectId, projectName, role, isAdmin, userId } = useProjectScope();
  const members = useMembers(projectId);
  const putMember = usePutMember(projectId);
  const removeMember = useRemoveMember(projectId);
  const resend = useResendInvite(projectId);
  const addOwner = useAddOwner(projectId);
  const onRoleDenied = useOnRoleDenied();
  const afterSelfChange = useAfterSelfChange();
  const [adding, setAdding] = useState(false);
  const [addingOwner, setAddingOwner] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [demotingSelf, setDemotingSelf] = useState<{ member: Member; role: MemberRole } | null>(null);

  const canManage = can(role, "manageMembers", isAdmin);
  const canResend = can(role, "resendInvite", isAdmin);
  const canAddOwner = can(role, "addOwner", isAdmin);

  function failed(caught: unknown) {
    onRoleDenied(caught);
    return failureText(caught);
  }

  async function submitPut(email: string, newRole: MemberRole) {
    // The API only sends an invite for a new membership, so a role change of someone already in the
    // list always replies `invite.sent: false`; that is not a failed invite.
    const existing = (members.data ?? []).some((member) => member.email.toLowerCase() === email.toLowerCase());
    try {
      const reply = await putMember.mutateAsync({ email, role: newRole });
      if (existing) toast.success("Role updated");
      else notifyInvite(projectId, reply.member.userId, reply.invite, "Member saved. Invite sent.");
      if (reply.member.userId === userId) await afterSelfChange();
      return null;
    } catch (caught) {
      const text = failed(caught);
      const field: FieldName | undefined =
        caught instanceof ApiError && (caught.field === "email" || caught.field === "role") ? caught.field : undefined;
      return { field, text };
    }
  }

  async function submitOwner(email: string) {
    try {
      const reply = await addOwner.mutateAsync(email);
      notifyInvite(projectId, reply.member.userId, reply.invite, "Owner added. Invite sent.");
      if (reply.member.userId === userId) await afterSelfChange();
      return null;
    } catch (caught) {
      const text = failed(caught);
      return { field: caught instanceof ApiError && caught.field === "email" ? ("email" as const) : undefined, text };
    }
  }

  function changeRole(member: Member, newRole: MemberRole) {
    if (newRole === member.role) return;
    if (member.userId === userId) {
      setDemotingSelf({ member, role: newRole });
      return;
    }
    void submitPut(member.email, newRole).then((result) => {
      if (result) toast.error(result.text);
    });
  }

  function confirmDemoteSelf() {
    if (!demotingSelf) return;
    const { member, role: newRole } = demotingSelf;
    setDemotingSelf(null);
    void submitPut(member.email, newRole).then((result) => {
      if (result) toast.error(result.text);
    });
  }

  function confirmRemove() {
    if (!removing) return;
    const member = removing;
    setRemoving(null);
    removeMember.mutate(member.userId, {
      onSuccess: () => {
        toast.success(member.userId === userId ? `You left ${projectName}.` : "Member removed.");
        if (member.userId === userId) void afterSelfChange();
      },
      onError: (caught) => toast.error(failed(caught)),
    });
  }

  function resendTo(member: Member) {
    resend.mutate(member.userId, {
      onSuccess: (reply) => notifyResent(projectId, member.userId, reply.invite),
      onError: (caught) => toast.error(failed(caught)),
    });
  }

  const actions =
    canManage || canAddOwner ? (
      <>
        {canAddOwner ? (
          <Button onClick={() => setAddingOwner(true)}>
            <ShieldPlus size={18} strokeWidth={1.5} aria-hidden="true" />
            Add owner
          </Button>
        ) : null}
        {canManage ? (
          <Button variant="primary" onClick={() => setAdding(true)}>
            <UserPlus size={18} strokeWidth={1.75} aria-hidden="true" />
            Add member
          </Button>
        ) : null}
      </>
    ) : null;

  const rows = members.data ?? [];
  const removingSelf = removing?.userId === userId;

  return (
    <>
      <PageHeader title="Members" crumbs={[{ label: projectName, href: projectBase(projectId) }, { label: "Members" }]} />
      <Card aria-labelledby="members-title">
        <CardHeader
          title="Members"
          titleId="members-title"
          subtitle={canManage ? "Add people by email and set their role" : `Who has access to ${projectName}`}
          actions={members.isSuccess ? actions : null}
        />
        {members.isLoading ? (
          <SkeletonRows rows={4} columns={3} />
        ) : members.error ? (
          <ErrorState message={errorText({ code: errorCode(members.error) })} onRetry={() => void members.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Users} title="No members yet" />
        ) : (
          <DataTable<Member>
            caption={`Members of ${projectName}`}
            rows={rows}
            rowKey={(row) => row.userId}
            columns={[
              {
                key: "member",
                header: "Member",
                cell: (row) => (
                  <span className="flex min-w-0 flex-col">
                    {row.name ? <span className="font-medium">{row.name}</span> : null}
                    <span className={row.name ? "break-all text-ink-2" : "break-all"}>{row.email}</span>
                    {row.userId === userId ? (
                      <span className="mt-1">
                        <Pill tone="neutral">You</Pill>
                      </span>
                    ) : null}
                  </span>
                ),
              },
              {
                key: "role",
                header: "Role",
                cell: (row) =>
                  canManage ? (
                    <Select
                      className="w-36"
                      value={row.role}
                      aria-label={`Role of ${row.email}`}
                      onChange={(event) => changeRole(row, event.target.value as MemberRole)}
                    >
                      {ROLES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <RolePill role={row.role} />
                  ),
              },
              ...(canResend || canManage
                ? [
                    {
                      key: "actions",
                      header: "Actions",
                      className: "text-right",
                      cell: (row: Member) => (
                        <span className="inline-flex flex-wrap justify-end gap-2">
                          {canResend ? (
                            <Button onClick={() => resendTo(row)} aria-label={`Resend invite to ${row.email}`}>
                              <MailPlus size={16} strokeWidth={1.5} aria-hidden="true" />
                              Resend invite
                            </Button>
                          ) : null}
                          {canManage ? (
                            <Button onClick={() => setRemoving(row)} aria-label={`Remove ${row.email}`}>
                              <UserMinus size={16} strokeWidth={1.5} aria-hidden="true" />
                              Remove
                            </Button>
                          ) : null}
                        </span>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        )}
      </Card>

      {canManage ? (
        <>
          <EmailDialog
            open={adding}
            onOpenChange={setAdding}
            title="Add a member"
            description="They get an invite email and sign in with Google or a password. An existing member gets the new role."
            submitLabel="Save member"
            withRole
            busy={putMember.isPending}
            onSubmit={submitPut}
          />
          <Dialog
            open={removing !== null}
            onOpenChange={(open) => (open ? undefined : setRemoving(null))}
            title={removingSelf ? "Leave this project?" : "Remove this member?"}
            description={
              removingSelf ? (
                <>You lose access to {projectName}. Another owner can add you back.</>
              ) : (
                <>
                  <span className="break-all text-ink">{removing?.email}</span> loses access to {projectName}.
                </>
              )
            }
            footer={
              <>
                <Button onClick={() => setRemoving(null)}>Cancel</Button>
                <Button variant="danger" onClick={confirmRemove}>
                  {removingSelf ? "Leave project" : "Remove member"}
                </Button>
              </>
            }
          />
          <Dialog
            open={demotingSelf !== null}
            onOpenChange={(open) => (open ? undefined : setDemotingSelf(null))}
            title="Change your own role?"
            description={`You stop being an owner of ${projectName}. Only another owner can make you an owner again.`}
            footer={
              <>
                <Button onClick={() => setDemotingSelf(null)}>Cancel</Button>
                <Button variant="danger" onClick={confirmDemoteSelf}>
                  Change my role
                </Button>
              </>
            }
          />
        </>
      ) : null}
      {canAddOwner ? (
        <EmailDialog
          open={addingOwner}
          onOpenChange={setAddingOwner}
          title="Add an owner"
          description="Gives this project a new owner. Someone without an account gets one and an invite email."
          submitLabel="Add owner"
          withRole={false}
          busy={addOwner.isPending}
          onSubmit={(email) => submitOwner(email)}
        />
      ) : null}
    </>
  );
}
