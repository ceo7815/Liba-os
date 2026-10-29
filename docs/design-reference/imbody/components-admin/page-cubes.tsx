import { RecordDesk, type DeskCube } from "@/components/admin/record-desk";

export function PageCubes({ cubes }: { cubes: DeskCube[] }) {
  if (cubes.length === 0) return null;
  return <RecordDesk title="" header={false} appearance="board" cubes={cubes} />;
}

export type { DeskCube, DeskRecord } from "@/components/admin/record-desk";
