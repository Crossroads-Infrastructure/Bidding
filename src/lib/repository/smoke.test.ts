import { describe, expect, it } from "vitest";
import { InMemoryRepository } from "./in-memory";

describe("smoke test: round 7 features via InMemoryRepository", () => {
  it("company profile upserts in place", async () => {
    const repo = new InMemoryRepository();
    expect(await repo.getCompanyProfile()).toBeUndefined();
    const created = await repo.upsertCompanyProfile({ company_name: "Acme" });
    expect(created.company_name).toBe("Acme");
    const updated = await repo.upsertCompanyProfile({ company_name: "Acme Inc." });
    expect(updated.id).toBe(created.id);
    expect(updated.company_name).toBe("Acme Inc.");
  });

  it("inclusion bank items can be added, listed by category, and removed", async () => {
    const repo = new InMemoryRepository();
    const a = await repo.addInclusionBankItem({ category: "scope_of_work", text: "Bond not included" });
    const b = await repo.addInclusionBankItem({ category: "gc_responsibility", text: "14 day notice" });
    const list = await repo.listInclusionBankItems();
    expect(list.map((i) => i.id)).toEqual(expect.arrayContaining([a.id, b.id]));
    await repo.removeInclusionBankItem(a.id);
    expect((await repo.listInclusionBankItems()).find((i) => i.id === a.id)).toBeUndefined();
  });

  it("project inclusions are independent copies, editable per project", async () => {
    const repo = new InMemoryRepository();
    const project = await repo.createProject({ project_name: "Test Job" });
    const bankItem = await repo.addInclusionBankItem({ category: "scope_of_work", text: "Bond not included" });
    const copy = await repo.addProjectInclusion(project.id, { category: "scope_of_work", text: bankItem.text });
    expect(copy.project_id).toBe(project.id);
    const edited = await repo.updateProjectInclusion(copy.id, "Bond not included, custom wording");
    expect(edited.text).toBe("Bond not included, custom wording");
    // editing the project copy never touches the bank item
    const bankAfter = (await repo.listInclusionBankItems()).find((i) => i.id === bankItem.id);
    expect(bankAfter?.text).toBe("Bond not included");
    await repo.removeProjectInclusion(copy.id);
    expect(await repo.listProjectInclusions(project.id)).toHaveLength(0);
  });

  it("project archive/restore/delete round-trips and hides from listProjects", async () => {
    const repo = new InMemoryRepository();
    const project = await repo.createProject({ project_name: "Archive Me" });
    expect((await repo.listProjects()).some((p) => p.id === project.id)).toBe(true);
    await repo.archiveProject(project.id);
    expect((await repo.listProjects()).some((p) => p.id === project.id)).toBe(false);
    expect((await repo.listArchivedProjects()).some((p) => p.id === project.id)).toBe(true);
    await repo.restoreProject(project.id);
    expect((await repo.listProjects()).some((p) => p.id === project.id)).toBe(true);
    await repo.deleteProjectPermanently(project.id);
    expect(await repo.getProject(project.id)).toBeUndefined();
  });

  it("updateProjectClient sets the Quote screen's editable Bid To value", async () => {
    const repo = new InMemoryRepository();
    const project = await repo.createProject({ project_name: "Client Test" });
    expect(project.client).toBeNull();
    const updated = await repo.updateProjectClient(project.id, "ABC Construction");
    expect(updated.client).toBe("ABC Construction");
    expect((await repo.getProject(project.id))?.client).toBe("ABC Construction");
  });

  it("uploadCompanyLogo sets logo_url", async () => {
    // Note: InMemoryRepository backs onto a module-level singleton store
    // (intentional -- see in-memory.ts), so company_profile may already
    // exist from an earlier test in this file; this only asserts the
    // upload itself works, not the empty-state case.
    const repo = new InMemoryRepository();
    const profile = await repo.uploadCompanyLogo(new Uint8Array([1, 2, 3]), "logo.png");
    expect(profile.logo_url).toContain("data:image");
  });

  it("duration_days survives create -> update -> read round trip on a project line item", async () => {
    const repo = new InMemoryRepository();
    const project = await repo.createProject({ project_name: "Duration Test" });
    const recipe = await repo.createBidItem({
      item_name: "Grading",
      unit: "LS",
      item_type: "lump_sum",
      labor: [],
      equipment: [],
      materials: [],
    });
    const line = await repo.addProjectLineItem({
      project_id: project.id,
      bid_item_id: recipe.item.id,
      quantity: 1,
    });
    expect(line.duration_days).toBeNull();
    const updated = await repo.updateProjectLineItem(line.id, { duration_days: 100 });
    expect(updated.duration_days).toBe(100);
    const [reread] = await repo.listProjectLineItems(project.id);
    expect(reread.duration_days).toBe(100);
  });
});
