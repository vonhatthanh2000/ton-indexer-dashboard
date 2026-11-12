"use client";

import { Activity, FolderKanban, Inbox, Wallet } from "lucide-react";
import { useState } from "react";
import { AddressChip, AddressStatusPill, HashChip, LtText, NetworkPill, RelativeTime, TonAmount, TxStatusPill } from "@/components/chain";
import { ThemeToggle } from "@/components/shell/topbar";
import {
  Button,
  Card,
  CardHeader,
  DataTable,
  Dialog,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  Input,
  KpiCard,
  LoadMore,
  Menu,
  MonoBox,
  Pagination,
  Pill,
  RadioGroup,
  SkeletonRows,
  Textarea,
} from "@/components/ui";

const USDT = "0:B113A994B5024A16719F69139328EB759596C38A25F59028B146FECDC3621DFE";
const HASH = "Ab3xK9mQ2r7sT1uV5wX8yZ0aB4cD6eF8gH2iJ4kL9w=";
const SAMPLE_TIME = "2026-11-11T22:00:00.000Z";

export function Kit() {
  const [dialog, setDialog] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [page, setPage] = useState(2);
  const [start, setStart] = useState("now");
  return (
    <main id="main" className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-title font-semibold">Component kit</h1>
        <ThemeToggle />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <KpiCard icon={FolderKanban} label="Total projects" value="12" />
        <KpiCard icon={Wallet} label="Linked addresses" value="1.24M" title="1,240,000" />
        <KpiCard icon={Activity} label="Loading" loading />
      </div>

      <Card>
        <CardHeader title="Buttons and pills" subtitle="One pair of button styles" actions={<Menu label="Card actions" actions={[{ label: "View", onSelect: () => {} }]} />} />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Create project</Button>
          <Button>Cancel</Button>
          <Button busy>Creating…</Button>
          <Button disabled>Disabled</Button>
          <Button variant="danger">Unlink address</Button>
          <Pill tone="ok" dot>Success</Pill>
          <Pill tone="err" dot>Failed</Pill>
          <Pill tone="err">Error</Pill>
          <AddressStatusPill status="live" />
          <AddressStatusPill status="syncing" />
          <AddressStatusPill status="pending" />
          <Pill tone="primary">Admin</Pill>
          <NetworkPill />
          <TxStatusPill aborted={false} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Chain values" />
        <div className="flex flex-col gap-4">
          <AddressChip address={USDT} />
          <AddressChip address={USDT} href="/project/transactions" />
          <HashChip hash={HASH} />
          <div className="flex gap-6">
            <TonAmount nano="1234567890123456789" />
            <TonAmount nano="3100000" />
            <TonAmount nano={null} />
            <LtText lt="47123456000003" />
            <RelativeTime iso={SAMPLE_TIME} />
          </div>
          <MonoBox value="kH3x_example-key-for-the-kit-page-only-000" copyLabel="Copy key" />
        </div>
      </Card>

      <Card>
        <CardHeader title="Table" subtitle="64px rows" />
        <DataTable
          caption="Sample rows"
          columns={[
            { key: "a", header: "Address", cell: (row: { id: string }) => <AddressChip address={row.id} /> },
            { key: "s", header: "State", cell: () => <AddressStatusPill status="live" /> },
            { key: "l", header: "Last lt", cell: () => <LtText lt="47123456000003" /> },
          ]}
          rows={[{ id: USDT }]}
          rowKey={(row) => row.id}
        />
        <Pagination page={page} pageCount={12} onPage={setPage} label="Kit pagination" />
        <LoadMore onClick={() => {}} loading={false} disabled={false} />
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader title="Loading" />
          <SkeletonRows rows={3} />
        </Card>
        <Card>
          <EmptyState icon={Inbox} title="No projects yet" body="Create the first one." action={<Button variant="primary">Create project</Button>} />
          <ErrorState message="The API can't be reached. Check that ton-observer is running." onRetry={() => {}} />
        </Card>
      </div>

      <Card>
        <CardHeader title="Forms" />
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Project name" hint="1 to 64 characters.">
            {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} />}
          </Field>
          <Field label="Project name" error="A project with this name already exists.">
            {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} defaultValue="demo" />}
          </Field>
          <Field label="Addresses">{({ id }) => <Textarea id={id} rows={3} />}</Field>
          <RadioGroup
            label="Start"
            value={start}
            onValueChange={setStart}
            options={[
              { value: "now", label: "From now" },
              { value: "lt", label: "From lt" },
            ]}
          />
        </div>
        <div className="mt-6 flex gap-3">
          <Button onClick={() => setDialog(true)}>Open dialog</Button>
          <Button onClick={() => setDrawer(true)}>Open drawer</Button>
        </div>
      </Card>

      <Dialog open={dialog} onOpenChange={setDialog} title="Rotate API key?" description="The current key stops working immediately." footer={<><Button onClick={() => setDialog(false)}>Cancel</Button><Button variant="danger">Rotate API key</Button></>} />
      <Drawer open={drawer} onOpenChange={setDrawer} title="Register addresses">
        <p>Drawer content.</p>
      </Drawer>
    </main>
  );
}
