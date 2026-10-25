import { ClaimWizard } from "@/components/wizard/claim-wizard";

export default function NewClaimPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">New claim</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        Core fields only. Queries, deductions and payments are added from the claim workspace.
      </p>
      <ClaimWizard />
    </div>
  );
}
