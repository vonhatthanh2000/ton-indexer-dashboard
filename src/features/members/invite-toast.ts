"use client";

import { toast } from "sonner";
import { apiFetch, errorCode } from "@/lib/client";
import { errorText } from "@/lib/errors";
import type { InviteResult, ResendInviteReply } from "@/lib/types";

export const INVITE_NOT_SENT = "Saved. The invite email wasn't sent.";

/** `POST /api/projects/:id/members/:userId/invite`. */
export function resendInvite(projectId: string, userId: string): Promise<ResendInviteReply> {
  return apiFetch<ResendInviteReply>(
    `/api/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}/invite`,
    { method: "POST" },
  );
}

/** The toast after a resend: sent, or not sent again (with another Resend). */
export function notifyResent(projectId: string, userId: string, invite: InviteResult): void {
  if (invite.sent) toast.success("Invite sent.");
  else inviteNotSent(projectId, userId, "The invite email wasn't sent.");
}

function inviteNotSent(projectId: string, userId: string, text: string): void {
  toast.warning(text, {
    duration: 10_000,
    action: {
      label: "Resend",
      onClick: () => {
        resendInvite(projectId, userId).then(
          (reply) => notifyResent(projectId, userId, reply.invite),
          (caught: unknown) => toast.error(errorText({ code: errorCode(caught) })),
        );
      },
    },
  });
}

/**
 * Every reply that carries `invite` for a new membership (member PUT of a new email, add owner, new project): `sent: false` means the
 * action succeeded but no email went out, so offer Resend. Otherwise `successText`.
 */
export function notifyInvite(projectId: string, userId: string, invite: InviteResult, successText: string): void {
  if (invite.sent) toast.success(successText);
  else inviteNotSent(projectId, userId, INVITE_NOT_SENT);
}
