"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { AddressChip } from "@/components/chain/address-chip";
import { Button, Drawer, Field, Input, Pill, RadioGroup } from "@/components/ui";
import { ApiError, errorCode } from "@/lib/client";
import { errorText } from "@/lib/errors";
import { parseAddressLines, validateStartLt, type LineProblem } from "@/lib/register";
import type { RegisteredAddress } from "@/lib/types";
import { useOnRoleDenied, useRegisterAddresses } from "./hooks";

export function RegisterAddressesDrawer({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const register = useRegisterAddresses(projectId);
  const onRoleDenied = useOnRoleDenied();
  const [text, setText] = useState("");
  const [start, setStart] = useState<"now" | "lt">("now");
  const [lt, setLt] = useState("");
  const [problems, setProblems] = useState<LineProblem[]>([]);
  const [listProblem, setListProblem] = useState<string | null>(null);
  const [ltProblem, setLtProblem] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<RegisteredAddress[] | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const ltRef = useRef<HTMLInputElement>(null);

  const lineCount = Math.max(text.split(/\r?\n/).length, 6);
  const badLines = useMemo(() => new Set(problems.map((problem) => problem.line)), [problems]);

  function reset() {
    setText("");
    setStart("now");
    setLt("");
    setProblems([]);
    setListProblem(null);
    setLtProblem(null);
    setStatus(null);
    setResult(null);
    register.reset();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setStatus(null);
    const parsed = parseAddressLines(text);
    const startProblem = start === "lt" ? validateStartLt(lt) : null;
    setProblems(parsed.problems);
    setListProblem(parsed.listProblem);
    setLtProblem(startProblem);
    const total = parsed.problems.length + (parsed.listProblem ? 1 : 0) + (startProblem ? 1 : 0);
    if (total > 0) {
      setStatus(`${total} ${total === 1 ? "problem" : "problems"} to fix.`);
      if (parsed.problems.length > 0 || parsed.listProblem) textareaRef.current?.focus();
      else ltRef.current?.focus();
      return;
    }
    register.mutate(
      { addresses: parsed.addresses, startLt: start === "now" ? "now" : lt.trim() },
      {
        onSuccess: (data) => setResult(data.addresses),
        onError: (caught) => {
          if (caught instanceof ApiError && caught.field === "addresses" && caught.index !== undefined) {
            const line = parsed.lineOf[caught.index] ?? caught.index + 1;
            setProblems([{ line, message: `Line ${line} ${caught.problem ?? "is not valid"}.` }]);
            setStatus("1 problem to fix.");
            textareaRef.current?.focus();
            return;
          }
          if (caught instanceof ApiError && caught.field === "startLt") {
            setLtProblem(`Start lt ${caught.problem ?? "is not valid"}.`);
            ltRef.current?.focus();
            return;
          }
          onRoleDenied(caught);
          setStatus(
            errorText(caught instanceof ApiError ? { code: caught.code, field: caught.field, index: caught.index, problem: caught.problem } : { code: errorCode(caught) }),
          );
        },
      },
    );
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title="Register addresses"
      description="Up to 100 addresses, one per line, in any form (EQ…, UQ… or 0:…)."
    >
      {result ? (
        <div>
          <p role="status" className="font-medium">
            {result.length} {result.length === 1 ? "address" : "addresses"} registered.
          </p>
          <ul className="mt-4 flex flex-col divide-y divide-line">
            {result.map((row) => (
              <li key={row.address} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <AddressChip address={row.address} />
                <span className="flex flex-wrap gap-2">
                  <Pill tone={row.created ? "primary" : "neutral"}>{row.created ? "New source" : "Already indexed"}</Pill>
                  <Pill tone={row.linked ? "ok" : "neutral"}>{row.linked ? "Linked" : "Already linked"}</Pill>
                  {row.stillSyncing ? <Pill tone="warn">History syncing</Pill> : null}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex justify-end gap-3">
            <Button onClick={() => reset()}>Register more addresses</Button>
            <Button
              variant="primary"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <label htmlFor="register-addresses" className="field-label">
            Addresses
          </label>
          <div className="flex overflow-hidden rounded-control border border-line-strong focus-within:border-primary">
            <div
              ref={gutterRef}
              aria-hidden="true"
              className="mono w-11 shrink-0 overflow-hidden border-r border-line bg-surface-2 py-2.5 text-right text-ink-2 select-none"
            >
              {Array.from({ length: lineCount }, (_, index) => (
                <div key={index} className={`h-5.5 pr-2 leading-5.5 ${badLines.has(index + 1) ? "bg-err-soft font-semibold text-err" : ""}`}>
                  {index + 1}
                </div>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              id="register-addresses"
              value={text}
              onChange={(event) => setText(event.target.value)}
              onScroll={(event) => {
                if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop;
              }}
              rows={8}
              wrap="off"
              spellCheck={false}
              className="mono min-h-48 w-full resize-y bg-surface px-3 py-2.5 leading-5.5 outline-none"
              aria-invalid={problems.length > 0 || listProblem ? true : undefined}
              aria-describedby="register-problems"
            />
          </div>
          <div id="register-problems">
            {listProblem ? <p className="field-error">{listProblem}</p> : null}
            {problems.slice(0, 6).map((problem) => (
              <p key={problem.line} className="field-error">
                {problem.message}
              </p>
            ))}
            {problems.length > 6 ? <p className="field-error">…and {problems.length - 6} more.</p> : null}
          </div>

          <fieldset className="mt-6">
            <legend className="field-label">Start indexing from</legend>
            <RadioGroup
              label="Start indexing from"
              value={start}
              onValueChange={(value) => setStart(value as "now" | "lt")}
              options={[
                { value: "now", label: "From now", hint: "only new transactions" },
                { value: "lt", label: "From lt", hint: "0 = the whole history" },
              ]}
            />
          </fieldset>
          {start === "lt" ? (
            <div className="mt-3">
              <Field label="Start lt" error={ltProblem ?? undefined}>
                {({ id, describedBy, invalid }) => (
                  <Input
                    ref={ltRef}
                    id={id}
                    inputMode="numeric"
                    className="mono"
                    value={lt}
                    onChange={(event) => setLt(event.target.value)}
                    aria-describedby={describedBy}
                    invalid={invalid}
                  />
                )}
              </Field>
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center justify-end gap-3">
            <p role="status" className="mr-auto text-err">
              {status}
            </p>
            <Button onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="primary" busy={register.isPending}>
              {register.isPending ? "Registering…" : "Register addresses"}
            </Button>
          </div>
        </form>
      )}
    </Drawer>
  );
}
